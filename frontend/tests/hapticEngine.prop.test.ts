import { describe, it } from 'vitest';
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
   * Validates: Requirements 4.5, 4.2
   */
  it('no vibrate(lineMs) or vibrate(0) within quietMs after a corner pattern', () => {
    const cfg = DEFAULT_HAPTICS;
    fc.assert(
      fc.property(movesArb, (moves) => {
        let state = initialState();
        for (const move of moves) {
          if (move.kind !== 'move') continue;
          const { state: next, effects } = step(state, move, cfg);
          // If this move is within a quiet window set by a previous corner,
          // no line buzz or stop-vibrate should be emitted.
          if (move.t < state.quietUntil) {
            for (const e of effects) {
              if (e.kind === 'vibrate' && typeof e.pattern === 'number') {
                if (e.pattern === cfg.lineMs || e.pattern === 0) {
                  return false;
                }
              }
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
// P4 — No repeated corner
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
});

// ---------------------------------------------------------------------------
// P5 — Continuous line buzz
// ---------------------------------------------------------------------------

describe('P5 — Continuous line buzz', () => {
  /**
   * While every input is on a line and the quiet window has passed, the gap
   * between line vibrate effects never exceeds retriggerMs + one input interval.
   *
   * Validates: Requirement 4.1
   */
  it('gap between line vibrate effects never exceeds retriggerMs + inputInterval', () => {
    const cfg = DEFAULT_HAPTICS;
    const lineMovesArb = fc
      .record({
        lineId: fc.string({ maxLength: 3 }),
        count: fc.integer({ min: 5, max: 30 }),
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
