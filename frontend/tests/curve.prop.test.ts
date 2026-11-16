/**
 * P106-P108 - curveYAtX (Requirement 5.6, task 52). Written by Kiro.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { curveYAtX } from '../src/core/curve';
import { pitchForY } from '../src/core/pitch';
import type { DiagramScene, Polyline } from '../src/core/scene';
import { runs } from './support/runs';

const y01 = fc.double({ min: -0.5, max: 1.5, noNaN: true });

/** A polyline with strictly increasing x. */
const monotoneArb: fc.Arbitrary<[number, number][]> = fc
  .array(fc.tuple(fc.double({ min: 0.001, max: 0.2, noNaN: true }), y01), { minLength: 2, maxLength: 40 })
  .map((steps) => {
    let x = 0;
    return steps.map(([dx, y]): [number, number] => {
      x += dx;
      return [x, y];
    });
  });

/**
 * An x somewhere on the curve. `first + t * (last - first)` can round one ulp past `last`
 * (task 54), where `curveYAtX` rightly answers null, so the sample is clamped into the range.
 */
const xWithin = (pts: [number, number][], t: number): number => {
  const first = pts[0]![0];
  const last = pts[pts.length - 1]![0];
  return Math.min(last, Math.max(first, first + t * (last - first)));
};

const graph = (polylines: Polyline[]): DiagramScene => ({ version: 1, kind: 'function_graph', polylines });
const line = (id: string, points: [number, number][]): Polyline => ({ id, label: null, points });

describe('P106 - height is exact and in range (Requirement 5.6)', () => {
  it('equals the point y at every point x, and stays inside the y range between them (250 runs)', () => {
    fc.assert(
      fc.property(monotoneArb, fc.double({ min: 0, max: 1, noNaN: true }), (pts, t) => {
        const scene = graph([line('f', pts)]);
        for (const [x, y] of pts) {
          expect(curveYAtX(scene, x)).toEqual({ polylineId: 'f', yNorm: y });
        }
        const lo = Math.min(...pts.map((p) => p[1]));
        const hi = Math.max(...pts.map((p) => p[1]));
        const x = xWithin(pts, t);
        const r = curveYAtX(scene, x);
        expect(r).not.toBeNull();
        expect(r!.polylineId).toBe('f');
        expect(r!.yNorm).toBeGreaterThanOrEqual(lo);
        expect(r!.yNorm).toBeLessThanOrEqual(hi);
      }),
      { numRuns: runs(250) },
    );
  });

  it('interpolates linearly inside a piece', () => {
    expect(curveYAtX(graph([line('f', [[0, 0], [1, 1]])]), 0.25)!.yNorm).toBeCloseTo(0.25, 12);
    expect(curveYAtX(graph([line('f', [[0.2, 0.8], [0.6, 0.4]])]), 0.4)!.yNorm).toBeCloseTo(0.6, 12);
  });
});

describe('P107 - no answer outside the curve, and never throws (Requirement 5.6)', () => {
  it('null outside the x range (250 runs)', () => {
    fc.assert(
      fc.property(monotoneArb, fc.double({ min: 0.001, max: 5, noNaN: true }), fc.boolean(), (pts, d, left) => {
        const x = left ? pts[0]![0] - d : pts[pts.length - 1]![0] + d;
        expect(curveYAtX(graph([line('f', pts)]), x)).toBeNull();
      }),
      { numRuns: runs(250) },
    );
  });

  it('null for NaN or infinite x, other kinds, and polylines with fewer than two points (250 runs)', () => {
    fc.assert(
      fc.property(monotoneArb, fc.constantFrom(Number.NaN, Infinity, -Infinity), fc.constantFrom('geometry', 'bar_chart', 'unknown'), (pts, bad, kind) => {
        expect(curveYAtX(graph([line('f', pts)]), bad)).toBeNull();
        const other = { ...graph([line('f', pts)]), kind } as DiagramScene;
        expect(curveYAtX(other, pts[0]![0])).toBeNull();
        expect(curveYAtX(graph([line('a', []), line('b', [pts[0]!])]), pts[0]![0])).toBeNull();
        expect(curveYAtX(graph([]), 0.5)).toBeNull();
      }),
      { numRuns: runs(250) },
    );
  });

  it('never throws on NaN, infinite, missing and out-of-range data (250 runs)', () => {
    const weird = fc.oneof(fc.double({ noNaN: false }), fc.constantFrom(Infinity, -Infinity, Number.NaN, 0, 1e308, -1e308));
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.tuple(weird, weird), { maxLength: 8 }), { maxLength: 3 }),
        weird,
        fc.option(weird, { nil: undefined }),
        fc.boolean(),
        (lines, x, hint, dropArray) => {
          const scene = graph(lines.map((p, i) => line(`p${i}`, p)));
          if (dropArray) (scene as { polylines?: unknown }).polylines = undefined;
          const r = curveYAtX(scene, x, hint);
          if (r !== null) {
            expect(Number.isFinite(r.yNorm)).toBe(true);
          }
        },
      ),
      { numRuns: runs(250) },
    );
  });
});

describe('P108 - hint, order and pitch (Requirements 5.6, 5.2)', () => {
  it('with several curves it picks the offer nearest the hint, first on a tie (250 runs)', () => {
    fc.assert(
      fc.property(fc.array(y01, { minLength: 1, maxLength: 6 }), y01, (ys, hint) => {
        // Every curve is flat at its own height and covers x = 0.5.
        const scene = graph(ys.map((y, i) => line(`c${i}`, [[0, y], [1, y]])));
        const r = curveYAtX(scene, 0.5, hint)!;
        let best = 0;
        for (let i = 1; i < ys.length; i++) if (Math.abs(ys[i]! - hint) < Math.abs(ys[best]! - hint)) best = i;
        expect(r).toEqual({ polylineId: `c${best}`, yNorm: ys[best] });
        // No hint, or a hint that is not a number: the first curve.
        expect(curveYAtX(scene, 0.5)).toEqual({ polylineId: 'c0', yNorm: ys[0] });
        expect(curveYAtX(scene, 0.5, Number.NaN)).toEqual({ polylineId: 'c0', yNorm: ys[0] });
      }),
      { numRuns: runs(250) },
    );
  });

  it('a multi-valued curve (a loop) answers with the branch nearest the hint (250 runs)', () => {
    fc.assert(
      fc.property(y01, y01, y01, (a, b, hint) => {
        // Goes right along y = a, up/down the vertical piece at x = 1, then back left along y = b.
        const scene = graph([line('loop', [[0, a], [1, a], [1, b], [0, b]])]);
        const r = curveYAtX(scene, 0.5, hint)!;
        const expected = Math.abs(a - hint) <= Math.abs(b - hint) ? a : b;
        expect(r.yNorm).toBe(expected);
      }),
      { numRuns: runs(250) },
    );
  });

  it('pitchForY of any answer is in [200, 1000] (250 runs)', () => {
    fc.assert(
      fc.property(monotoneArb, fc.double({ min: 0, max: 1, noNaN: true }), (pts, t) => {
        const r = curveYAtX(graph([line('f', pts)]), xWithin(pts, t))!;
        const hz = pitchForY(r.yNorm);
        expect(hz).toBeGreaterThanOrEqual(200);
        expect(hz).toBeLessThanOrEqual(1000);
      }),
      { numRuns: runs(250) },
    );
  });

  it('regression (task 54, seed -1034279350): t = 1 on a curve ending at x = 0.35624768281849445 still answers', () => {
    const pts: [number, number][] = [
      [0.1062476161456993, 0],
      [0.12280312216238477, 0],
      [0.3128919996590637, 0],
      [0.3551778745875001, 0],
      [0.35624768281849445, 0],
    ];
    // The unclamped formula lands one ulp past the last x; the curve has no answer there.
    const raw = pts[0]![0] + 1 * (pts[4]![0] - pts[0]![0]);
    expect(raw).toBeGreaterThan(pts[4]![0]);
    expect(curveYAtX(graph([line('f', pts)]), raw)).toBeNull();
    // The clamped sample is the last point and answers exactly.
    expect(xWithin(pts, 1)).toBe(pts[4]![0]);
    expect(curveYAtX(graph([line('f', pts)]), xWithin(pts, 1))).toEqual({ polylineId: 'f', yNorm: 0 });
  });
});
