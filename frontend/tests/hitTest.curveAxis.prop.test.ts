/**
 * P104, P105 - a curve beats an axis in hitTest (Requirement 5.5, task 52).
 *
 * Written by Kiro. The expected answer is built from the frozen pre-PERF-01 `hitTestOracle`:
 *  - when some polyline piece is within the line radius, the new answer equals the oracle's
 *    answer on the same scene with the axes removed (and is never an axis);
 *  - otherwise it equals the oracle's answer on the scene as it is.
 * "Some polyline piece is within the radius" is decided by the oracle on a scene that holds
 * only the polylines, so the check never reuses the code under test.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeViewport, toScreen, type ScreenPoint, type Viewport } from '../src/core/geometry';
import { hitTest, type Radii } from '../src/core/hitTest';
import type { DiagramScene } from '../src/core/scene';
import { hitTestOracle } from './helpers/hitTestOracle';
import { runs } from './support/runs';

const unit = fc.double({ min: 0, max: 1, noNaN: true });
const radiiArb: fc.Arbitrary<Radii> = fc.oneof(
  fc.constant<Radii>({ vertex: 22, line: 14 }),
  fc.record({ vertex: fc.integer({ min: 1, max: 30 }), line: fc.integer({ min: 1, max: 30 }) }),
);
const viewArb: fc.Arbitrary<Viewport> = fc
  .tuple(fc.integer({ min: 100, max: 1200 }), fc.integer({ min: 100, max: 1200 }))
  .map(([w, h]) => makeViewport(w, h));

interface Gen {
  scene: DiagramScene;
  rnd: number[];
}

/** Polylines hug the axes so that "both within the radius" happens often. */
const genArb: fc.Arbitrary<Gen> = fc
  .record({
    xAxis: unit,
    yAxis: unit,
    lines: fc.array(
      fc.array(fc.tuple(unit, fc.double({ min: -0.04, max: 0.04, noNaN: true }), fc.boolean()), { minLength: 2, maxLength: 8 }),
      { minLength: 0, maxLength: 3 },
    ),
    pts: fc.array(fc.tuple(unit, unit), { maxLength: 3 }),
    bars: fc.array(fc.record({ x0: unit, x1: unit, top: unit, base: unit }), { maxLength: 2 }),
    rnd: fc.array(fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }), { minLength: 60, maxLength: 60 }),
  })
  .map((g): Gen => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'function_graph',
      points: g.pts.map(([x, y], i) => ({ id: `p${i}`, x, y, label: null })),
      segments: g.pts.length >= 2 ? [{ id: 's0', a: 'p0', b: 'p1', label: null }] : [],
      polylines: g.lines.map((pts, i) => ({
        id: `pl${i}`,
        label: null,
        // Each point is near the x-axis line or near the y-axis line, so curves cross both axes.
        points: pts.map(([x, d, nearY]): [number, number] => (nearY ? [g.yAxis + d, x] : [x, g.xAxis + d])),
      })),
      bars: g.bars.map((b, i) => ({ id: `b${i}`, label: `B${i}`, value: 1 + i, x0: b.x0, x1: b.x1, y_top: b.top, y_base: b.base })),
      axes: { x_axis_y: g.xAxis, y_axis_x: g.yAxis },
    };
    return { scene, rnd: g.rnd };
  });

function fingers(scene: DiagramScene, view: Viewport, radii: Radii, rnd: number[]): ScreenPoint[] {
  const out: ScreenPoint[] = [];
  const xa = scene.axes?.x_axis_y ?? 0.5;
  const ya = scene.axes?.y_axis_x ?? 0.5;
  const polys = (scene.polylines ?? []).filter((p) => p.points.length >= 2);
  let k = 0;
  const next = (): number => rnd[k++ % rnd.length]!;
  for (let i = 0; i < 20; i++) {
    const off = (next() * 2 - 1) * (radii.line + 3);
    const mode = i % 3;
    if (mode === 0) {
      out.push(toScreen({ x: next(), y: xa }, view)); // on the x-axis line ...
      out[out.length - 1]!.y += off; // ... pushed by up to the radius band
    } else if (mode === 1) {
      out.push(toScreen({ x: ya, y: next() }, view));
      out[out.length - 1]!.x += off;
    } else if (polys.length > 0) {
      const pl = polys[Math.floor(next() * polys.length)]!;
      const j = Math.floor(next() * (pl.points.length - 1));
      const a = pl.points[j]!;
      const b = pl.points[j + 1]!;
      const t = next();
      const f = toScreen({ x: a[0] + t * (b[0] - a[0]), y: a[1] + t * (b[1] - a[1]) }, view);
      out.push({ x: f.x + off / 2, y: f.y + off / 2 });
    } else {
      out.push({ x: next() * view.canvasWidth, y: next() * view.canvasHeight });
    }
  }
  return out;
}

/** Is any polyline piece within the line radius? Decided by the frozen oracle on polylines only. */
function polylineInRadius(scene: DiagramScene, finger: ScreenPoint, view: Viewport, radii: Radii): boolean {
  const only: DiagramScene = { version: 1, kind: 'function_graph', polylines: scene.polylines ?? [] };
  return hitTestOracle(only, finger, view, radii).kind === 'line';
}

/** The per-case assertion of P104, shared by the random property and the deterministic grid. Returns true when it applied. */
function checkCurveBeatsAxis(scene: DiagramScene, finger: ScreenPoint, view: Viewport, radii: Radii): boolean {
  if (!polylineInRadius(scene, finger, view, radii)) return false;
  const noAxes: DiagramScene = { ...scene, axes: { x_axis_y: null, y_axis_x: null } };
  const got = hitTest(scene, finger, view, radii);
  expect(got.kind === 'line' && got.elementKind === 'axis').toBe(false);
  expect(got).toEqual(hitTestOracle(noAxes, finger, view, radii));
  return true;
}

/** The per-case assertion of P105. Returns true when it applied. */
function checkUnchangedOutsideCurve(scene: DiagramScene, finger: ScreenPoint, view: Viewport, radii: Radii): boolean {
  if (polylineInRadius(scene, finger, view, radii)) return false;
  expect(hitTest(scene, finger, view, radii)).toEqual(hitTestOracle(scene, finger, view, radii));
  return true;
}

/**
 * Fixed scene for the deterministic grids (task 62): a curve that runs along and across both
 * axes, a segment, and a bar. Coverage is counted on this grid, never on random draws.
 */
const gridScene: DiagramScene = {
  version: 1,
  kind: 'function_graph',
  points: [
    { id: 'p0', x: 0.1, y: 0.2, label: null },
    { id: 'p1', x: 0.3, y: 0.2, label: null },
  ],
  segments: [{ id: 's0', a: 'p0', b: 'p1', label: null }],
  polylines: [
    {
      id: 'pl0',
      label: null,
      points: [
        [0.05, 0.52],
        [0.5, 0.5],
        [0.95, 0.48],
        [0.5, 0.9],
      ],
    },
  ],
  bars: [{ id: 'b0', label: 'B0', value: 2, x0: 0.6, x1: 0.8, y_top: 0.7, y_base: 0.95 }],
  axes: { x_axis_y: 0.5, y_axis_x: 0.5 },
};
const gridView = makeViewport(400, 400);
const gridRadii: Radii = { vertex: 22, line: 14 };
const gridFingers: ScreenPoint[] = [];
for (let gx = 0; gx <= 400; gx += 20) {
  for (let gy = 0; gy <= 400; gy += 20) gridFingers.push({ x: gx, y: gy });
}

describe('P104 - a curve beats an axis (Requirement 5.5)', () => {
  it('deterministic grid: the curve-near-axis case is reached and always answered as the old code without axes', () => {
    let aimed = 0;
    for (const f of gridFingers) if (checkCurveBeatsAxis(gridScene, f, gridView, gridRadii)) aimed++;
    // Counted on fixed fingers over a fixed scene, so this is a property of the fixture, not of a draw.
    expect(aimed).toBeGreaterThan(40);
  });

  it('with a polyline within the radius the answer is never an axis and equals the old answer without axes (300 runs)', () => {
    fc.assert(
      fc.property(genArb, viewArb, radiiArb, (g, view, radii) => {
        for (const finger of fingers(g.scene, view, radii, g.rnd)) checkCurveBeatsAxis(g.scene, finger, view, radii);
      }),
      { numRuns: runs(300) },
    );
  });

  it('an axis still wins when the curve is out of reach, and a plain axis scene is unchanged', () => {
    const view = makeViewport(400, 400);
    const scene: DiagramScene = {
      version: 1,
      kind: 'function_graph',
      polylines: [{ id: 'c', label: null, points: [[0.1, 0.9], [0.9, 0.9]] }],
      axes: { x_axis_y: 0.5, y_axis_x: null },
    };
    const finger = toScreen({ x: 0.5, y: 0.5 }, view);
    expect(hitTest(scene, finger, view)).toEqual({ kind: 'line', id: 'x-axis', elementKind: 'axis' });
    const onBoth: DiagramScene = { ...scene, polylines: [{ id: 'c', label: null, points: [[0.1, 0.5], [0.9, 0.5]] }] };
    expect(hitTest(onBoth, finger, view)).toEqual({ kind: 'line', id: 'c', elementKind: 'polyline' });
  });
});

describe('P105 - everything else is as before (Requirement 5.5)', () => {
  it('deterministic grid: the no-curve-nearby case is reached and answered exactly as before', () => {
    let checked = 0;
    for (const f of gridFingers) if (checkUnchangedOutsideCurve(gridScene, f, gridView, gridRadii)) checked++;
    const noCurves: DiagramScene = { ...gridScene, polylines: [] };
    for (const f of gridFingers) if (checkUnchangedOutsideCurve(noCurves, f, gridView, gridRadii)) checked++;
    expect(checked).toBeGreaterThan(500);
  });

  it('with no polyline within the radius, or no polylines, the answer equals the frozen old one (300 runs)', () => {
    fc.assert(
      fc.property(genArb, viewArb, radiiArb, fc.boolean(), (g, view, radii, dropCurves) => {
        const scene: DiagramScene = dropCurves ? { ...g.scene, polylines: [] } : g.scene;
        for (const finger of fingers(g.scene, view, radii, g.rnd)) checkUnchangedOutsideCurve(scene, finger, view, radii);
      }),
      { numRuns: runs(300) },
    );
  });

  it('a segment or bar edge nearer than the curve still wins over it', () => {
    const view = makeViewport(400, 400);
    const scene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'a', x: 0, y: 0.5, label: null },
        { id: 'b', x: 1, y: 0.5, label: null },
      ],
      segments: [{ id: 's', a: 'a', b: 'b', label: null }],
      polylines: [{ id: 'c', label: null, points: [[0.1, 0.53], [0.9, 0.53]] }],
    };
    const finger = toScreen({ x: 0.5, y: 0.5 }, view);
    expect(hitTest(scene, finger, view)).toEqual({ kind: 'line', id: 's', elementKind: 'segment' });
  });
});
