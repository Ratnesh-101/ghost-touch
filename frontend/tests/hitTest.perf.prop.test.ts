/**
 * P52 — the optimised hitTest gives exactly the previous answer (Task 32, PERF-01).
 * P53 — a bar whose value is not finite is never announced (Task 32, R3-07).
 *
 * Written by Kiro. `tests/helpers/hitTestOracle.ts` is a frozen copy of hitTest as it was before
 * PERF-01. P52 compares the two with deep equality (same target, same id, same label, same tie
 * winner) on random scenes, random letterboxed viewports and random radii, with the fingers
 * biased into the hard places: on vertices, and in the band around each line where the hit
 * radius and the new bounding-box pre-check meet. One test always includes a 2000-point polyline
 * (the size the share contract allows). P52 uses finite bar values only, because R3-07 changes
 * the answer for non-finite ones on purpose; P53 covers those.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeViewport, toScreen, type ScreenPoint, type Viewport } from '../src/core/geometry';
import { hitTest, type Radii } from '../src/core/hitTest';
import type { Bar, DiagramScene, Point, Polyline, Segment } from '../src/core/scene';
import { hitTestOracle } from './helpers/hitTestOracle';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Mostly inside the unit square, sometimes outside it, rarely not a number at all. */
const coordArb = fc.oneof(
  { weight: 12, arbitrary: fc.double({ min: 0, max: 1, noNaN: true }) },
  { weight: 2, arbitrary: fc.double({ min: -0.3, max: 1.3, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, 1, 0.5) },
  { weight: 1, arbitrary: fc.constantFrom(Number.NaN, Infinity, -Infinity) },
);
const finiteCoordArb = fc.double({ min: -0.2, max: 1.2, noNaN: true });
const labelArb = fc.option(fc.constantFrom('A', 'B', 'apex', 'O', ''), { nil: null });

const viewArb: fc.Arbitrary<Viewport> = fc
  .tuple(fc.integer({ min: 40, max: 1600 }), fc.integer({ min: 40, max: 1600 }))
  .map(([w, h]) => makeViewport(w, h));

const radiiArb: fc.Arbitrary<Radii> = fc.oneof(
  fc.constant<Radii>({ vertex: 22, line: 14 }),
  fc.record({ vertex: fc.integer({ min: 1, max: 40 }), line: fc.integer({ min: 1, max: 30 }) }),
  fc.record({ vertex: fc.double({ min: 0, max: 40, noNaN: true }), line: fc.double({ min: 0, max: 30, noNaN: true }) }),
);

function sceneArb(withLongPolyline: boolean): fc.Arbitrary<DiagramScene> {
  return fc
    .record({
      pts: fc.array(fc.record({ x: coordArb, y: coordArb, label: labelArb }), { maxLength: 12 }),
      segs: fc.array(fc.tuple(fc.nat(14), fc.nat(14)), { maxLength: 12 }),
      lines: fc.array(fc.array(fc.tuple(coordArb, coordArb), { maxLength: 30 }), { maxLength: 3 }),
      bars: fc.array(
        fc.record({ x0: finiteCoordArb, x1: finiteCoordArb, yTop: finiteCoordArb, yBase: finiteCoordArb, value: fc.double({ min: -50, max: 500, noNaN: true }) }),
        { maxLength: 4 },
      ),
      xAxis: fc.option(finiteCoordArb, { nil: null }),
      yAxis: fc.option(finiteCoordArb, { nil: null }),
      dupIds: fc.boolean(),
      longSeed: fc.integer({ min: 1, max: 1_000_000 }),
    })
    .map((g): DiagramScene => {
      // Duplicate ids on purpose sometimes: the first match must win in both versions.
      const points: Point[] = g.pts.map((p, i) => ({ id: g.dupIds && i % 3 === 2 ? 'p0' : `p${i}`, x: p.x, y: p.y, label: p.label }));
      // Endpoint ids up to 14 while there are at most 12 points, so some segments dangle.
      const segments: Segment[] = g.segs.map(([a, b], i) => ({ id: `s${i}`, a: `p${a}`, b: `p${b}`, label: null }));
      const polylines: Polyline[] = g.lines.map((pts, i) => ({ id: `pl${i}`, points: pts, label: null }));
      if (withLongPolyline) polylines.push(longPolyline(g.longSeed));
      const bars: Bar[] = g.bars.map((b, i) => ({ id: `b${i}`, label: `bar ${i}`, value: b.value, x0: b.x0, x1: b.x1, y_top: b.yTop, y_base: b.yBase }));
      return { version: 1, kind: 'geometry', points, segments, polylines, bars, axes: { x_axis_y: g.xAxis, y_axis_x: g.yAxis } };
    });
}

/** A 2000-point curve: a sine with a seeded wobble, so every run gets a different shape. */
function longPolyline(seed: number): Polyline {
  let s = seed;
  const rand = (): number => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const points: [number, number][] = [];
  for (let i = 0; i < 2000; i++) {
    const x = i / 1999;
    points.push([x, 0.5 + 0.35 * Math.sin(x * Math.PI * 6) + (rand() - 0.5) * 0.02]);
  }
  return { id: 'long', points, label: null };
}

/** Screen-space corners of every drawable piece, used to aim fingers at the hard places. */
function pieces(scene: DiagramScene, view: Viewport): [ScreenPoint, ScreenPoint][] {
  const out: [ScreenPoint, ScreenPoint][] = [];
  const byId = new Map((scene.points ?? []).map((p) => [p.id, p] as const));
  for (const s of scene.segments ?? []) {
    const a = byId.get(s.a);
    const b = byId.get(s.b);
    if (a && b) out.push([toScreen(a, view), toScreen(b, view)]);
  }
  for (const pl of scene.polylines ?? []) {
    for (let i = 0; i + 1 < pl.points.length; i += pl.points.length > 100 ? 37 : 1) {
      const a = pl.points[i]!;
      const b = pl.points[i + 1]!;
      out.push([toScreen({ x: a[0], y: a[1] }, view), toScreen({ x: b[0], y: b[1] }, view)]);
    }
  }
  return out.filter(([a, b]) => [a.x, a.y, b.x, b.y].every(Number.isFinite));
}

/** Fingers: uniform, on vertices, and near lines at a distance around the line radius. */
function fingersFor(scene: DiagramScene, view: Viewport, radii: Radii, rnd: number[]): ScreenPoint[] {
  const fingers: ScreenPoint[] = [];
  const segs = pieces(scene, view);
  const pts = (scene.points ?? []).map((p) => toScreen(p, view)).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  let k = 0;
  const next = (): number => rnd[k++ % rnd.length]!;
  for (let i = 0; i < 24; i++) {
    const mode = i % 4;
    if (mode === 0 || (segs.length === 0 && pts.length === 0)) {
      fingers.push({ x: next() * view.canvasWidth, y: next() * view.canvasHeight });
    } else if (mode === 1 && pts.length > 0) {
      const p = pts[Math.floor(next() * pts.length)]!;
      const d = (next() - 0.5) * 2 * (radii.vertex + 2);
      fingers.push({ x: p.x + d, y: p.y - d / 2 });
    } else if (segs.length > 0) {
      // A point on a piece, pushed out perpendicular to it by about the line radius.
      const [a, b] = segs[Math.floor(next() * segs.length)]!;
      const t = next() * 1.4 - 0.2; // sometimes beyond the ends, where the box edge matters
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      const off = radii.line - 1 + next() * 3; // the r-1 .. r+2 band
      const side = next() < 0.5 ? -1 : 1;
      fingers.push({ x: a.x + t * (b.x - a.x) + side * nx * off, y: a.y + t * (b.y - a.y) + side * ny * off });
    } else {
      fingers.push({ x: next() * view.canvasWidth, y: next() * view.canvasHeight });
    }
  }
  return fingers;
}

const randomsArb = fc.array(fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }), { minLength: 72, maxLength: 72 });

// ---------------------------------------------------------------------------
// P52
// ---------------------------------------------------------------------------

describe('P52 — optimised hitTest equals the previous implementation (PERF-01)', () => {
  it('same target on random scenes, viewports, radii and fingers (300 runs, 24 fingers each)', () => {
    fc.assert(
      fc.property(sceneArb(false), viewArb, radiiArb, randomsArb, (scene, view, radii, rnd) => {
        for (const finger of fingersFor(scene, view, radii, rnd)) {
          expect(hitTest(scene, finger, view, radii)).toEqual(hitTestOracle(scene, finger, view, radii));
        }
      }),
      { numRuns: 300 },
    );
  });

  it('same target when the scene has a 2000-point polyline (200 runs, 24 fingers each)', () => {
    fc.assert(
      fc.property(sceneArb(true), viewArb, radiiArb, randomsArb, (scene, view, radii, rnd) => {
        for (const finger of fingersFor(scene, view, radii, rnd)) {
          expect(hitTest(scene, finger, view, radii)).toEqual(hitTestOracle(scene, finger, view, radii));
        }
      }),
      { numRuns: 200 },
    );
  });

  it('same target for fingers far outside the canvas and with the default radii (200 runs)', () => {
    fc.assert(
      fc.property(
        sceneArb(false),
        viewArb,
        fc.record({ x: fc.double({ min: -5000, max: 5000, noNaN: true }), y: fc.double({ min: -5000, max: 5000, noNaN: true }) }),
        (scene, view, finger) => {
          expect(hitTest(scene, finger, view)).toEqual(hitTestOracle(scene, finger, view));
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// P53
// ---------------------------------------------------------------------------

describe('P53 — a bar whose value is not finite is never announced (R3-07)', () => {
  const badValue = fc.constantFrom(Number.NaN, Infinity, -Infinity);

  it('a finger inside a non-finite bar never gets a bar target for it (200 runs)', () => {
    fc.assert(
      fc.property(badValue, viewArb, fc.double({ min: 0.3, max: 0.7, noNaN: true }), fc.double({ min: 0.3, max: 0.7, noNaN: true }), (value, view, fx, fy) => {
        const scene: DiagramScene = {
          kind: 'bar_chart',
          bars: [{ id: 'bad', label: 'Bad', value, x0: 0.2, x1: 0.8, y_top: 0.2, y_base: 0.8 }],
        };
        // Well inside the bar, away from its edges (edges are lines and may still buzz).
        const finger = toScreen({ x: fx, y: fy }, view);
        const hit = hitTest(scene, finger, view, { vertex: 22, line: 0 });
        expect(hit.kind).not.toBe('bar');
      }),
      { numRuns: 200 },
    );
  });

  it('finite bars next to a non-finite one still answer, with a finite maximum (200 runs)', () => {
    fc.assert(
      fc.property(badValue, fc.double({ min: 0.5, max: 100, noNaN: true }), fc.double({ min: 0.5, max: 100, noNaN: true }), (bad, v1, v2) => {
        const view = makeViewport(400, 400);
        const scene: DiagramScene = {
          kind: 'bar_chart',
          bars: [
            { id: 'bad', label: 'Bad', value: bad, x0: 0.05, x1: 0.3, y_top: 0.1, y_base: 0.9 },
            { id: 'one', label: 'One', value: v1, x0: 0.375, x1: 0.625, y_top: 0.1, y_base: 0.9 },
            { id: 'two', label: 'Two', value: v2, x0: 0.7, x1: 0.95, y_top: 0.1, y_base: 0.9 },
          ],
        };
        const hit = hitTest(scene, toScreen({ x: 0.5, y: 0.5 }, view), view, { vertex: 22, line: 0 });
        expect(hit).toEqual({ kind: 'bar', id: 'one', label: 'One', value: v1, maxValue: Math.max(v1, v2) });
      }),
      { numRuns: 200 },
    );
  });

  it('the spoken text for any bar hit never contains NaN or Infinity (200 runs)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.double({ min: 0, max: 1000, noNaN: true }), badValue), { minLength: 1, maxLength: 6 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (values, fx) => {
          const view = makeViewport(600, 400);
          const w = 1 / values.length;
          const scene: DiagramScene = {
            kind: 'bar_chart',
            bars: values.map((value, i) => ({ id: `b${i}`, label: `B${i}`, value, x0: i * w, x1: (i + 1) * w, y_top: 0.2, y_base: 0.8 })),
          };
          const hit = hitTest(scene, toScreen({ x: fx, y: 0.5 }, view), view, { vertex: 22, line: 0 });
          if (hit.kind === 'bar') {
            expect(Number.isFinite(hit.value)).toBe(true);
            expect(Number.isFinite(hit.maxValue)).toBe(true);
            expect(`${hit.label}, ${hit.value}`).not.toMatch(/NaN|Infinity/);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
