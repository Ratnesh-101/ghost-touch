/**
 * P85 (Kiro, task 41, Requirement 1.4-1.5): the audible buzz fallback plays the vibration pattern's
 * timing. Checks `patternToBuzzes` in drivers/haptics.ts (written by Antigravity, lane W3,
 * `5bf9b1e`) against an oracle written here from the requirement, not from the code.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { patternToBuzzes } from '../src/drivers/haptics';
import { DEFAULT_HAPTICS } from '../src/core/hapticEngine';

const RUNS = { numRuns: 300 };

const ok = (v: number): boolean => Number.isFinite(v) && v > 0;

/** Requirement 1.4, literally: an ON (even-index) positive finite entry is a buzz at the sum so far. */
function oracle(pattern: number | number[]): { atMs: number; durationMs: number }[] {
  if (typeof pattern === 'number') return ok(pattern) ? [{ atMs: 0, durationMs: pattern }] : [];
  const out: { atMs: number; durationMs: number }[] = [];
  let sum = 0;
  pattern.forEach((v, i) => {
    if (!ok(v)) return;
    if (i % 2 === 0) out.push({ atMs: sum, durationMs: v });
    sum += v;
  });
  return out;
}

/** Entries of every kind: ordinary durations, zero, negative, NaN and infinities. */
const entryArb = fc.oneof(
  { weight: 6, arbitrary: fc.integer({ min: 1, max: 2000 }) },
  { weight: 2, arbitrary: fc.double({ min: 0.001, max: 5000, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -0, -1, -250, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY) },
);
const patternArb = fc.array(entryArb, { maxLength: 24 });

describe('P85: buzz timing matches the vibration pattern (1.4)', () => {
  it('equals the requirement oracle for any pattern (300 runs)', () => {
    fc.assert(
      fc.property(patternArb, (p) => {
        expect(patternToBuzzes(p)).toEqual(oracle(p));
      }),
      RUNS,
    );
  });

  it('every positive ON entry gives exactly one buzz with its own duration, in order', () => {
    fc.assert(
      fc.property(patternArb, (p) => {
        const buzzes = patternToBuzzes(p);
        const ons = p.filter((v, i) => i % 2 === 0 && ok(v));
        expect(buzzes.map((b) => b.durationMs)).toEqual(ons);
        for (let k = 1; k < buzzes.length; k++) {
          expect(buzzes[k]!.atMs).toBeGreaterThanOrEqual(buzzes[k - 1]!.atMs + buzzes[k - 1]!.durationMs);
        }
        expect(buzzes.length).toBeLessThanOrEqual(Math.ceil(p.length / 2));
        for (const b of buzzes) expect(Number.isFinite(b.atMs) && b.atMs >= 0).toBe(true);
      }),
      RUNS,
    );
  });

  it('zero, negative and non-finite entries add no buzz and do not move the offset', () => {
    fc.assert(
      fc.property(patternArb, fc.nat(), fc.constantFrom(0, -5, Number.NaN, Number.POSITIVE_INFINITY), (p, at, bad) => {
        // Replacing an OFF entry with a bad value removes exactly its own length from later offsets.
        const i = (at % Math.max(1, p.length)) | 1; // an odd (OFF) index
        fc.pre(i < p.length);
        const q = [...p];
        const removed = ok(q[i]!) ? q[i]! : 0;
        q[i] = bad;
        const before = patternToBuzzes(p);
        const after = patternToBuzzes(q);
        expect(after.length).toBe(before.length);
        before.forEach((b, k) => {
          const shift = b.atMs > oracleOffsetOfIndex(p, i) ? removed : 0;
          expect(after[k]!.atMs).toBeCloseTo(b.atMs - shift, 6);
        });
      }),
      RUNS,
    );
  });

  it('a number gives one buzz at 0 when positive and finite, otherwise none', () => {
    fc.assert(
      fc.property(fc.oneof(fc.double({ noNaN: false }), fc.integer()), (n) => {
        expect(patternToBuzzes(n)).toEqual(ok(n) ? [{ atMs: 0, durationMs: n }] : []);
      }),
      RUNS,
    );
  });

  it("the engine's corner pattern [50, 90, 50] gives buzzes at 0 and 140 ms, 50 ms each", () => {
    expect(DEFAULT_HAPTICS.cornerPattern).toEqual([50, 90, 50]);
    expect(patternToBuzzes(DEFAULT_HAPTICS.cornerPattern)).toEqual([
      { atMs: 0, durationMs: 50 },
      { atMs: 140, durationMs: 50 },
    ]);
    expect(patternToBuzzes(DEFAULT_HAPTICS.lineMs)).toEqual([{ atMs: 0, durationMs: 80 }]);
    expect(patternToBuzzes([])).toEqual([]);
  });
});

/** Offset at which entry `i` starts (sum of positive finite entries before it). */
function oracleOffsetOfIndex(p: readonly number[], i: number): number {
  return p.slice(0, i).reduce((s, v) => s + (ok(v) ? v : 0), 0);
}
