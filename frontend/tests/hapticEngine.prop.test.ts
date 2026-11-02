import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  step,
  initialState,
  DEFAULT_HAPTICS,
  type Input,
} from '../src/core/hapticEngine';
import type { Target } from '../src/core/hitTest';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const targetArb: fc.Arbitrary<Target> = fc.oneof(
  fc.record({
    kind: fc.constant('vertex' as const),
    id: fc.string({ maxLength: 3 }),
    label: fc.option(fc.string({ maxLength: 5 }), { nil: undefined }),
  }),
  fc.record({
    kind: fc.constant('line' as const),
    id: fc.string({ maxLength: 3 }),
    elementKind: fc.constant('segment' as const),
  }),
  fc.record({
    kind: fc.constant('line' as const),
    id: fc.string({ maxLength: 3 }),
    elementKind: fc.constant('polyline' as const),
  }),
  fc.record({
    kind: fc.constant('bar' as const),
    id: fc.string({ maxLength: 3 }),
    label: fc.string({ maxLength: 5 }),
    value: fc.double({ min: 0, max: 100, noNaN: true }),
    maxValue: fc.double({ min: 1, max: 100, noNaN: true }),
  }),
  fc.record({
    kind: fc.constant('none' as const),
  }),
);

// A sequence of moves with increasing timestamps (no lifts).
const movesArb = fc
  .array(
    fc.record({
      target: targetArb,
      dt: fc.double({ min: 10, max: 200, noNaN: true }),
      yNorm: fc.double({ min: 0, max: 1, noNaN: true }),
    }),
    { minLength: 1, maxLength: 50 },
  )
  .map((items) => {
    let t = 0;
    return items.map(
      (m): Input => ({ kind: 'move', t: (t += m.dt), target: m.target, yNorm: m.yNorm }),
    );
  });

// ---------------------------------------------------------------------------
// P3 — Corner pulse never merged
// ---------------------------------------------------------------------------

describe('P3 — Corner pulse never merged', () => {
  /**
   * For any input sequence, no vibrate(lineMs) or vibrate(0) effect is
   * emitted within quietMs after a corner pattern.
   *
   * Tracks an independent expected quiet-until (t + cfg.quietMs) from the
   * corner effect, not from the engine's internal state.
   *
   * Validates: Requirements 4.5, 4.2
   */
  it('no vibrate(lineMs) or vibrate(0) within quietMs after a corner pattern', () => {
    const cfg = DEFAULT_HAPTICS;
    fc.assert(
      fc.property(movesArb, (moves) => {
        let state = initialState();
        let expectedQuietUntil = -Infinity;
        for (const move of moves) {
          if (move.kind !== 'move') continue;
          const { state: next, effects } = step(state, move, cfg);
          // If this move is within the independent quiet window, no line
          // buzz or stop-vibrate should be emitted.
          if (move.t < expectedQuietUntil) {
            for (const e of effects) {
              if (e.kind === 'vibrate' && typeof e.pattern === 'number') {
                if (e.pattern === cfg.lineMs || e.pattern === 0) {
                  return false;
                }
              }
            }
          }
          // Update independent quiet-until when a corner pattern is emitted.
          for (const e of effects) {
            if (e.kind === 'vibrate' && Array.isArray(e.pattern)) {
              expectedQuietUntil = move.t + cfg.quietMs;
            }
          }
          state = next;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// P4 — No repeated corner + vertex speech
// ---------------------------------------------------------------------------

describe('P4 — No repeated corner', () => {
  /**
   * Consecutive moves on the same vertex emit the corner pattern exactly once.
   *
   * Validates: Requirement 4.4
   */
  it('consecutive moves on the same vertex emit corner pattern exactly once', () => {
    const cfg = DEFAULT_HAPTICS;
    const vertexMovesArb = fc
      .record({
        vertexId: fc.string({ maxLength: 3 }),
        label: fc.option(fc.string({ maxLength: 5 }), { nil: undefined }),
        count: fc.integer({ min: 2, max: 20 }),
        dt: fc.double({ min: 10, max: 200, noNaN: true }),
        yNorm: fc.double({ min: 0, max: 1, noNaN: true }),
      })
      .map(({ vertexId, label, count, dt, yNorm }) => {
        const vertex: Target = { kind: 'vertex', id: vertexId, label };
        let t = 0;
        const moves: Input[] = [];
        for (let i = 0; i < count; i++) {
          t += dt;
          moves.push({ kind: 'move', t, target: vertex, yNorm });
        }
        return moves;
      });

    fc.assert(
      fc.property(vertexMovesArb, (moves) => {
        let state = initialState();
        let cornerCount = 0;
        for (const move of moves) {
          if (move.kind !== 'move') continue;
          const { state: next, effects } = step(state, move, cfg);
          for (const e of effects) {
            if (e.kind === 'vibrate' && Array.isArray(e.pattern)) {
              cornerCount++;
            }
          }
          state = next;
        }
        return cornerCount === 1;
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Vertex speech: entering a new vertex always produces a speak effect.
   * If the label is non-blank, speak the label; otherwise speak "Point " + id.
   */
  it('entering a new vertex always speaks label or "Point " + id', () => {
    const cfg = DEFAULT_HAPTICS;
    const vertexArb = fc.record({
      id: fc.string({ minLength: 1, maxLength: 5 }),
      label: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
    });

    fc.assert(
      fc.property(vertexArb, ({ id, label }) => {
        const target: Target = { kind: 'vertex', id, label };
        const { effects } = step(initialState(), {
          kind: 'move',
          t: 100,
          target,
          yNorm: 0.5,
        }, cfg);
        const speakEff = effects.find((e) => e.kind === 'speak');
        if (speakEff === undefined || speakEff.kind !== 'speak') return false;
        const expected = label !== undefined && label.trim() !== '' ? label : 'Point ' + id;
        return speakEff.text === expected;
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// P5 — Continuous line buzz
// ---------------------------------------------------------------------------

describe('P5 — Continuous line buzz', () => {
  /**
   * While every input is on a line and the quiet window has passed, the gap
   * between line vibrate effects never exceeds retriggerMs + one input interval.
   *
   * Non-vacuous: asserts at least 2 buzzes happen before checking gaps.
   *
   * Validates: Requirement 4.1
   */
  it('gap between line vibrate effects never exceeds retriggerMs + inputInterval (pure line)', () => {
    const cfg = DEFAULT_HAPTICS;
    const lineMovesArb = fc
      .record({
        lineId: fc.string({ maxLength: 3 }),
        count: fc.integer({ min: 10, max: 30 }),
        inputInterval: fc.double({ min: 30, max: 100, noNaN: true }),
        yNorm: fc.double({ min: 0, max: 1, noNaN: true }),
      })
      .map(({ lineId, count, inputInterval, yNorm }) => {
        const line: Target = { kind: 'line', id: lineId, elementKind: 'segment' };
        let t = 0;
        const moves: Input[] = [];
        for (let i = 0; i < count; i++) {
          t += inputInterval;
          moves.push({ kind: 'move', t, target: line, yNorm });
        }
        return { moves, inputInterval };
      });

    fc.assert(
      fc.property(lineMovesArb, ({ moves, inputInterval }) => {
        let state = initialState();
        const buzzTimes: number[] = [];
        for (const move of moves) {
          if (move.kind !== 'move') continue;
          const { state: next, effects } = step(state, move, cfg);
          for (const e of effects) {
            if (e.kind === 'vibrate' && e.pattern === cfg.lineMs) {
              buzzTimes.push(move.t);
            }
          }
          state = next;
        }
        // Non-vacuous: at least 2 buzzes must happen.
        if (buzzTimes.length < 2) return false;
        // After the quiet window, check gaps between buzzes.
        for (let i = 1; i < buzzTimes.length; i++) {
          const gap = buzzTimes[i]! - buzzTimes[i - 1]!;
          if (gap > cfg.retriggerMs + inputInterval) {
            return false;
          }
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Quiet-window recovery: line moves follow a corner (vertex). The first
   * line buzz is suppressed during the quiet window, then resumes after it.
   * Non-vacuous: asserts corner happened and at least 2 line buzzes occurred.
   */
  it('line buzz resumes after quiet window following a corner (non-vacuous)', () => {
    const cfg = DEFAULT_HAPTICS;
    const scenarioArb = fc
      .record({
        vertexId: fc.string({ maxLength: 3 }),
        lineId: fc.string({ maxLength: 3 }),
        inputInterval: fc.double({ min: 30, max: 80, noNaN: true }),
        yNorm: fc.double({ min: 0, max: 1, noNaN: true }),
        postCornerMoves: fc.integer({ min: 20, max: 30 }),
      })
      .map(({ vertexId, lineId, inputInterval, yNorm, postCornerMoves }) => {
        const vertex: Target = { kind: 'vertex', id: vertexId, label: vertexId };
        const line: Target = { kind: 'line', id: lineId, elementKind: 'segment' };
        let t = 0;
        const moves: Input[] = [];
        // 1. Enter vertex (corner pulse, sets quiet window)
        t += 50;
        moves.push({ kind: 'move', t, target: vertex, yNorm });
        // 2. Move on line repeatedly (buzz suppressed during quiet, resumes after)
        for (let i = 0; i < postCornerMoves; i++) {
          t += inputInterval;
          moves.push({ kind: 'move', t, target: line, yNorm });
        }
        return { moves, inputInterval };
      });

    fc.assert(
      fc.property(scenarioArb, ({ moves, inputInterval }) => {
        let state = initialState();
        const buzzTimes: number[] = [];
        let hadCorner = false;
        for (const move of moves) {
          if (move.kind !== 'move') continue;
          const { state: next, effects } = step(state, move, cfg);
          for (const e of effects) {
            if (e.kind === 'vibrate' && Array.isArray(e.pattern)) {
              hadCorner = true;
            }
            if (e.kind === 'vibrate' && e.pattern === cfg.lineMs) {
              buzzTimes.push(move.t);
            }
          }
          state = next;
        }
        // Non-vacuous: corner happened and at least 2 line buzzes occurred.
        if (!hadCorner) return false;
        if (buzzTimes.length < 2) return false;
        // Gaps between buzzes are bounded.
        for (let i = 1; i < buzzTimes.length; i++) {
          const gap = buzzTimes[i]! - buzzTimes[i - 1]!;
          if (gap > cfg.retriggerMs + inputInterval) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// P6 — Lift silences everything
// ---------------------------------------------------------------------------

describe('P6 — Lift silences everything', () => {
  /**
   * After lift, the effect list contains vibrate(0) and tone(null).
   *
   * Validates: Requirement 4.7
   */
  it('after lift, effects contain vibrate(0) and tone(null)', () => {
    const cfg = DEFAULT_HAPTICS;
    // Build up state with a sequence of moves, then lift.
    const scenarioArb = movesArb.chain((moves) => {
      const lastMove = moves[moves.length - 1]!;
      return fc.constant({ moves, liftT: lastMove.t + 100 });
    });

    fc.assert(
      fc.property(scenarioArb, ({ moves, liftT }) => {
        let state = initialState();
        for (const move of moves) {
          if (move.kind !== 'move') continue;
          const { state: next } = step(state, move, cfg);
          state = next;
        }
        const { effects } = step(state, { kind: 'lift', t: liftT }, cfg);
        return (
          effects.some((e) => e.kind === 'vibrate' && e.pattern === 0) &&
          effects.some((e) => e.kind === 'tone' && e.hz === null)
        );
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Scripted triangle trace (moved from flow.explore.test.ts)
// ---------------------------------------------------------------------------

describe('Scripted triangle trace (DoD trace)', () => {
  it('line buzz -> corner pulse -> 450 ms silence -> line buzz', () => {
    let state = initialState();

    // 1. Moving along segment: line buzz
    const step1 = step(state, {
      kind: 'move',
      t: 100,
      target: { kind: 'line', id: 's1', elementKind: 'segment' },
      yNorm: 0.5,
    });
    expect(step1.effects).toContainEqual({ kind: 'vibrate', pattern: 80 });
    state = step1.state;

    // 2. Reaches vertex A: corner pattern, quietUntil = 200 + 450 = 650
    const step2 = step(state, {
      kind: 'move',
      t: 200,
      target: { kind: 'vertex', id: 'A', label: 'Point A' },
      yNorm: 0.15,
    });
    expect(step2.effects).toContainEqual({ kind: 'vibrate', pattern: [50, 90, 50] });
    state = step2.state;

    // 3. Moves onto segment 2 at t=400 (400 < 650): silence (quiet window blocks line buzz)
    const step3 = step(state, {
      kind: 'move',
      t: 400,
      target: { kind: 'line', id: 's2', elementKind: 'segment' },
      yNorm: 0.3,
    });
    expect(step3.effects.filter((e) => e.kind === 'vibrate')).toHaveLength(0);
    state = step3.state;

    // 4. Continues on segment 2 at t=700 (700 >= 650): line buzz returns
    const step4 = step(state, {
      kind: 'move',
      t: 700,
      target: { kind: 'line', id: 's2', elementKind: 'segment' },
      yNorm: 0.45,
    });
    expect(step4.effects).toContainEqual({ kind: 'vibrate', pattern: 80 });
  });
});
