import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  step,
  initialState,
  DEFAULT_HAPTICS,
  type EngineState,
  type Effect,
  type Input,
} from '../src/core/hapticEngine';
import type { Target } from '../src/core/hitTest';
import { runs } from './support/runs';

/**
 * P96 (Requirement 4.9, task 50): a corner is not repeated inside its quiet window.
 * The only time constant is quietMs.
 */

const cfg = DEFAULT_HAPTICS;
const Q = cfg.quietMs;

const isCorner = (e: Effect): boolean => e.kind === 'vibrate' && Array.isArray(e.pattern);
const isSpeech = (e: Effect): boolean =>
  (e.kind === 'speak' && /^[VW]$/.test(e.text)) || e.kind === 'speakKey';

const vertex = (id: string): Target => ({ kind: 'vertex', id, label: id });

const nonVertexArb: fc.Arbitrary<Target> = fc.oneof(
  fc.constant<Target>({ kind: 'none' }),
  fc.constant<Target>({ kind: 'line', id: 'L', elementKind: 'segment' }),
  fc.constant<Target>({ kind: 'line', id: 'P', elementKind: 'polyline' }),
  fc.constant<Target>({ kind: 'bar', id: 'B', label: 'bar', value: 3, maxValue: 5 }),
);

/** One step of a trace: a time offset from the first pulse, and either the vertex or something else. */
interface Hop {
  at: number;
  target: Target;
}

function run(
  hops: Hop[],
  t0: number,
  yNorm = 0.5,
): { corners: number; speeches: number; finalState: EngineState; perHop: Effect[][] } {
  let state = initialState();
  let corners = 0;
  let speeches = 0;
  const perHop: Effect[][] = [];
  for (const h of hops) {
    const input: Input = { kind: 'move', t: t0 + h.at, target: h.target, yNorm };
    const r = step(state, input, cfg);
    corners += r.effects.filter(isCorner).length;
    speeches += r.effects.filter(isSpeech).length;
    perHop.push(r.effects);
    state = r.state;
  }
  return { corners, speeches, finalState: state, perHop };
}

const t0Arb = fc.integer({ min: 0, max: 100000 });
// Strictly increasing offsets inside (0, quietMs).
const inWindowOffsetsArb = fc
  .uniqueArray(fc.integer({ min: 1, max: Q - 1 }), { minLength: 1, maxLength: 40 })
  .map((xs) => xs.sort((a, b) => a - b));

describe('P96 — a corner is not repeated inside its quiet window', () => {
  it('(a) leaving and re-entering the same vertex within quietMs fires once and keeps quietUntil', () => {
    fc.assert(
      fc.property(
        t0Arb,
        inWindowOffsetsArb,
        fc.infiniteStream(fc.boolean()),
        fc.infiniteStream(nonVertexArb),
        (t0, offsets, flips, others) => {
          const fi = flips[Symbol.iterator]();
          const oi = others[Symbol.iterator]();
          const hops: Hop[] = [{ at: 0, target: vertex('V') }];
          // Make sure the trace really leaves and re-enters at least once.
          hops.push({ at: offsets[0]!, target: oi.next().value as Target });
          for (const at of offsets.slice(1)) {
            hops.push({
              at,
              target: fi.next().value ? vertex('V') : (oi.next().value as Target),
            });
          }
          // A final re-entry at the last offset, so the trace always ends on V.
          hops.push({ at: offsets[offsets.length - 1]!, target: vertex('V') });
          const { corners, speeches, finalState } = run(hops, t0);
          return corners === 1 && speeches === 1 && finalState.quietUntil === t0 + Q;
        },
      ),
      { numRuns: runs(300) },
    );
  });

  it('(a) the suppressed re-entry emits nothing except tone(null)', () => {
    fc.assert(
      fc.property(
        t0Arb,
        fc.integer({ min: 1, max: Q - 2 }),
        fc.integer({ min: 0, max: Q - 2 }),
        (t0, leaveAt, gap) => {
          const backAt = Math.min(leaveAt + gap, Q - 1);
          const hops: Hop[] = [
            { at: 0, target: vertex('V') },
            { at: leaveAt, target: { kind: 'none' } },
            { at: backAt, target: vertex('V') },
          ];
          const { perHop } = run(hops, t0);
          return (
            perHop[2]!.length === 1 &&
            perHop[2]![0]!.kind === 'tone' &&
            (perHop[2]![0] as { hz: number | null }).hz === null
          );
        },
      ),
      { numRuns: runs(200) },
    );
  });

  it('(a) a tone started on a curve between the two visits is silenced on the suppressed re-entry', () => {
    const { perHop } = run(
      [
        { at: 0, target: vertex('V') },
        { at: 100, target: { kind: 'line', id: 'P', elementKind: 'polyline' } },
        { at: 200, target: vertex('V') },
      ],
      1000,
      0.3,
    );
    expect(perHop[1]!.some((e) => e.kind === 'tone' && e.hz !== null)).toBe(true);
    expect(perHop[2]).toEqual([{ kind: 'tone', hz: null }]);
  });

  it('(e) staying on the vertex across quietUntil after a suppressed re-entry fires nothing more', () => {
    fc.assert(
      fc.property(
        t0Arb,
        fc.integer({ min: 1, max: Q - 2 }),
        fc.integer({ min: 0, max: Q - 2 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 2000 }), { minLength: 1, maxLength: 30 }),
        (t0, leaveAt, gap, stays) => {
          const backAt = Math.min(leaveAt + gap, Q - 1);
          const hops: Hop[] = [
            { at: 0, target: vertex('V') },
            { at: leaveAt, target: { kind: 'none' } },
            { at: backAt, target: vertex('V') },
          ];
          // Moves that stay on V, always including one before and one after the window ends.
          const times = [...stays.map((s) => backAt + s), Q - 1, Q, Q + 1].filter((x) => x > backAt);
          for (const at of [...new Set(times)].sort((a, b) => a - b)) {
            hops.push({ at, target: vertex('V') });
          }
          const { corners, speeches, perHop } = run(hops, t0);
          return (
            corners === 1 &&
            speeches === 1 &&
            perHop.slice(3).every((effs) => effs.length === 0)
          );
        },
      ),
      { numRuns: runs(300) },
    );
  });


  it('(b) re-entry at or after quietMs fires again and starts a new window', () => {
    fc.assert(
      fc.property(
        t0Arb,
        inWindowOffsetsArb,
        fc.integer({ min: 0, max: 5000 }),
        (t0, offsets, extra) => {
          const hops: Hop[] = [{ at: 0, target: vertex('V') }];
          offsets.forEach((at, i) =>
            hops.push({ at, target: i % 2 === 0 ? { kind: 'none' } : vertex('V') }),
          );
          const lateAt = Q + extra;
          hops.push({ at: lateAt - 1, target: { kind: 'none' } });
          hops.push({ at: lateAt, target: vertex('V') });
          const { perHop, finalState } = run(hops, t0);
          const last = perHop[perHop.length - 1]!;
          return (
            last.some(isCorner) &&
            last.some(isSpeech) &&
            finalState.quietUntil === t0 + lateAt + Q
          );
        },
      ),
      { numRuns: runs(300) },
    );
  });

  it('(b) a re-entry exactly at quietMs fires (the window is half-open, like the line rule)', () => {
    fc.assert(
      fc.property(t0Arb, (t0) => {
        const { perHop } = run(
          [
            { at: 0, target: vertex('V') },
            { at: 100, target: { kind: 'none' } },
            { at: Q, target: vertex('V') },
          ],
          t0,
        );
        return perHop[2]!.some(isCorner);
      }),
      { numRuns: runs(200) },
    );
  });

  it('(c) entering a different vertex always fires, also inside the window and after other hops', () => {
    fc.assert(
      fc.property(
        t0Arb,
        fc.integer({ min: 0, max: Q - 1 }),
        fc.boolean(),
        nonVertexArb,
        (t0, at, viaOther, other) => {
          const hops: Hop[] = [{ at: 0, target: vertex('V') }];
          if (viaOther) hops.push({ at: Math.floor(at / 2), target: other });
          hops.push({ at, target: vertex('W') });
          const { perHop, finalState } = run(hops, t0);
          const last = perHop[perHop.length - 1]!;
          return (
            last.some(isCorner) && last.some(isSpeech) && finalState.quietUntil === t0 + at + Q
          );
        },
      ),
      { numRuns: runs(300) },
    );
  });

  it('(c) V, W, then V again inside the window: V fires again because W was the last corner', () => {
    const { perHop } = run(
      [
        { at: 0, target: vertex('V') },
        { at: 50, target: { kind: 'none' } },
        { at: 100, target: vertex('W') },
        { at: 150, target: { kind: 'none' } },
        { at: 200, target: vertex('V') },
      ],
      1000,
    );
    expect(perHop[2]!.some(isCorner)).toBe(true);
    expect(perHop[4]!.some(isCorner)).toBe(true);
  });

  it('a lift resets the memory: touching the same vertex after a lift fires', () => {
    fc.assert(
      fc.property(t0Arb, fc.integer({ min: 1, max: Q - 1 }), (t0, at) => {
        let state = initialState();
        state = step(state, { kind: 'move', t: t0, target: vertex('V'), yNorm: 0.5 }, cfg).state;
        state = step(state, { kind: 'lift', t: t0 + at }, cfg).state;
        const r = step(
          state,
          { kind: 'move', t: t0 + at + 1, target: vertex('V'), yNorm: 0.5 },
          cfg,
        );
        return r.effects.some(isCorner);
      }),
      { numRuns: runs(200) },
    );
  });

  it('a suppressed re-entry still reports no line buzz or stop inside the window (P3 holds)', () => {
    fc.assert(
      fc.property(t0Arb, inWindowOffsetsArb, (t0, offsets) => {
        const hops: Hop[] = [{ at: 0, target: vertex('V') }];
        offsets.forEach((at, i) =>
          hops.push({
            at,
            target: i % 2 === 0 ? { kind: 'line', id: 'L', elementKind: 'segment' } : vertex('V'),
          }),
        );
        const { perHop } = run(hops, t0);
        return perHop.slice(1).every((effs) =>
          effs.every(
            (e) => !(e.kind === 'vibrate' && (e.pattern === 0 || e.pattern === cfg.lineMs)),
          ),
        );
      }),
      { numRuns: runs(200) },
    );
  });
});
