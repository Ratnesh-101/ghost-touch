/**
 * P132 to P136 - chaos run of the pure touch pipeline (Requirement 36, task 64).
 *
 * Written by Kiro. The harness below is a small MODEL of what Explore.tsx does with pointers
 * (down, move, up, cancel, blur, hidden); it drives the REAL `hitTest`, `followTarget`,
 * `step()` and `heartbeatStep`. The Explore screen itself (pointer capture, keep-alive timer,
 * visibility listeners) is not exercised here. Nothing in `src/` is changed by this file.
 *
 * Coverage comes from fixed generators that reach each state by construction (fingers placed on
 * corners and at the radius band, degenerate scenes, zero-size viewports); no counter over the
 * random draw decides whether a case is "covered".
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import barchartJson from '../public/samples/barchart.json';
import sineJson from '../public/samples/sine.json';
import triangleJson from '../public/samples/triangle.json';
import { makeViewport, toNorm, toScreen, type ScreenPoint, type Viewport } from '../src/core/geometry';
import { DEFAULT_HAPTICS, initialState, step, type Effect, type EngineState } from '../src/core/hapticEngine';
import {
  DEFAULT_HEARTBEAT,
  heartbeatStep,
  initialHeartbeatState,
  type HeartbeatState,
} from '../src/core/heartbeat';
import { DEFAULT_RADII, hitTest, type Target } from '../src/core/hitTest';
import type { DiagramScene } from '../src/core/scene';
import { followTarget, STICKY_RADIUS_PX } from '../src/core/sticky';
import { runs } from './support/runs';

// ---------------------------------------------------------------------------
// Events and cases
// ---------------------------------------------------------------------------

type FingerSpec =
  | { mode: 'onPoint'; i: number }
  | { mode: 'nearPoint'; i: number; ox: number; oy: number }
  | { mode: 'anywhere'; rx: number; ry: number }
  | { mode: 'nonFinite'; x: number; y: number }
  | { mode: 'midSegment'; i: number; f: number };

type Ev =
  | { kind: 'down'; p: number; f: FingerSpec; dt: number }
  | { kind: 'move'; p: number; f: FingerSpec; dt: number }
  | { kind: 'up'; p: number; dt: number }
  | { kind: 'cancel'; p: number; dt: number }
  | { kind: 'blur'; dt: number }
  | { kind: 'hidden'; dt: number };

interface Case {
  scene: DiagramScene;
  view: Viewport;
  sticky: boolean;
  heartbeat: boolean;
  t0: number;
  events: Ev[];
}

const unit = fc.double({ min: 0, max: 1, noNaN: true });
const grid = fc.constantFrom(0, 0.25, 0.5, 0.75, 1);

const dtArb = fc.oneof(
  { weight: 3, arbitrary: fc.constant(0) },
  { weight: 4, arbitrary: fc.integer({ min: 1, max: 100 }) },
  { weight: 2, arbitrary: fc.integer({ min: 0, max: 5000 }) },
);

const fingerArb: fc.Arbitrary<FingerSpec> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ mode: fc.constant('onPoint' as const), i: fc.nat(50) }) },
  {
    weight: 4,
    arbitrary: fc.record({
      mode: fc.constant('nearPoint' as const),
      i: fc.nat(50),
      ox: fc.oneof(fc.constantFrom(-22, -14, 0, 14, 22, 22.0001, 14.0001), fc.double({ min: -40, max: 40, noNaN: true })),
      oy: fc.oneof(fc.constantFrom(-22, -14, 0, 14, 22), fc.double({ min: -40, max: 40, noNaN: true })),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      mode: fc.constant('anywhere' as const),
      rx: fc.double({ min: -0.5, max: 1.5, noNaN: true }),
      ry: fc.double({ min: -0.5, max: 1.5, noNaN: true }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      mode: fc.constant('nonFinite' as const),
      x: fc.constantFrom(NaN, Infinity, -Infinity, 5),
      y: fc.constantFrom(NaN, Infinity, -Infinity, 5),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ mode: fc.constant('midSegment' as const), i: fc.nat(50), f: unit }),
  },
);

const pid = fc.integer({ min: 0, max: 2 });

const evArb: fc.Arbitrary<Ev> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('down' as const), p: pid, f: fingerArb, dt: dtArb }) },
  { weight: 10, arbitrary: fc.record({ kind: fc.constant('move' as const), p: pid, f: fingerArb, dt: dtArb }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('up' as const), p: pid, dt: dtArb }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('cancel' as const), p: pid, dt: dtArb }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('blur' as const), dt: dtArb }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('hidden' as const), dt: dtArb }) },
);

const eventsArb = fc.array(evArb, { minLength: 1, maxLength: 400 });

const viewArb: fc.Arbitrary<Viewport> = fc.oneof(
  { weight: 5, arbitrary: fc.tuple(fc.double({ min: 50, max: 900, noNaN: true }), fc.double({ min: 50, max: 900, noNaN: true })).map(([w, h]) => makeViewport(w, h)) },
  { weight: 1, arbitrary: fc.constant(makeViewport(0, 600)) },
  { weight: 1, arbitrary: fc.constant(makeViewport(400, 0)) },
  { weight: 1, arbitrary: fc.constant(makeViewport(0, 0)) },
);

const sampleScenes: DiagramScene[] = [triangleJson, sineJson, barchartJson] as unknown as DiagramScene[];

/** Valid scene: unique ids and labels, coordinates in [0, 1], segments join existing points. */
const validSceneArb: fc.Arbitrary<DiagramScene> = fc
  .record({
    kind: fc.constantFrom('geometry', 'function_graph', 'bar_chart', 'unknown' as const),
    pts: fc.array(fc.tuple(unit, unit), { maxLength: 7 }),
    segs: fc.array(fc.tuple(fc.nat(6), fc.nat(6)), { maxLength: 8 }),
    polys: fc.array(fc.array(fc.tuple(unit, unit), { minLength: 2, maxLength: 8 }), { maxLength: 2 }),
    bars: fc.array(
      fc.record({
        x0: unit,
        x1: unit,
        yTop: unit,
        yBase: unit,
        value: fc.double({ min: 0.5, max: 100, noNaN: true }),
      }),
      { maxLength: 3 },
    ),
    axes: fc.option(fc.record({ x_axis_y: fc.option(unit, { nil: null }), y_axis_x: fc.option(unit, { nil: null }) }), { nil: null }),
  })
  .map((r): DiagramScene => {
    const points = r.pts.map(([x, y], i) => ({ id: `p${i}`, label: `L${i}`, x, y }));
    const n = points.length;
    const segments = n === 0 ? [] : r.segs.filter(([a, b]) => a !== b).map(([a, b], i) => ({ id: `s${i}`, a: `p${a % n}`, b: `p${b % n}` }));
    return {
      kind: r.kind,
      points,
      segments,
      polylines: r.polys.map((pl, i) => ({ id: `pl${i}`, points: pl })),
      bars: r.bars.map((b, i) => ({
        id: `b${i}`,
        label: `Bar${i}`,
        value: b.value,
        x0: Math.min(b.x0, b.x1),
        x1: Math.max(b.x0, b.x1),
        y_top: Math.min(b.yTop, b.yBase),
        y_base: Math.max(b.yTop, b.yBase),
      })),
      axes: r.axes,
      facts: [],
    };
  });

/**
 * Degenerate family: zero-length and duplicated segments, coincident points, bars with
 * x0 == x1, y_top == y_base and value 0, a polyline of two identical points, axes on the border.
 */
const degenerateSceneArb: fc.Arbitrary<DiagramScene> = fc
  .record({
    kind: fc.constantFrom('geometry', 'function_graph', 'bar_chart', 'unknown' as const),
    pts: fc.array(fc.tuple(grid, grid), { minLength: 1, maxLength: 6 }),
    segs: fc.array(fc.tuple(fc.nat(5), fc.nat(5)), { maxLength: 8 }),
    polyAt: fc.array(fc.tuple(grid, grid), { maxLength: 2 }),
    barX: fc.array(fc.tuple(grid, grid, grid, grid, fc.constantFrom(0, 1, 7)), { maxLength: 3 }),
    axes: fc.option(fc.record({ x_axis_y: fc.option(fc.constantFrom(0, 1), { nil: null }), y_axis_x: fc.option(fc.constantFrom(0, 1), { nil: null }) }), { nil: null }),
  })
  .map((r): DiagramScene => {
    const points = r.pts.map(([x, y], i) => ({ id: `p${i}`, label: `L${i}`, x, y }));
    const n = points.length;
    return {
      kind: r.kind,
      points,
      // a == b is kept on purpose: zero-length segments.
      segments: r.segs.map(([a, b], i) => ({ id: `s${i}`, a: `p${a % n}`, b: `p${b % n}` })),
      polylines: r.polyAt.map(([x, y], i) => ({ id: `pl${i}`, points: [[x, y], [x, y]] as [number, number][] })),
      bars: r.barX.map(([x, y0, y1, xs, v], i) => ({
        id: `b${i}`,
        label: `Bar${i}`,
        value: v,
        x0: x,
        x1: i % 2 === 0 ? x : xs,
        y_top: y0,
        y_base: i % 2 === 0 ? y0 : y1,
      })),
      axes: r.axes,
      facts: [],
    };
  });

const sceneArb: fc.Arbitrary<DiagramScene> = fc.oneof(
  { weight: 1, arbitrary: fc.constantFrom(...sampleScenes) },
  { weight: 3, arbitrary: validSceneArb },
  { weight: 2, arbitrary: degenerateSceneArb },
);

const caseOf = (scene: fc.Arbitrary<DiagramScene>, view: fc.Arbitrary<Viewport> = viewArb): fc.Arbitrary<Case> =>
  fc.record({
    scene,
    view,
    sticky: fc.boolean(),
    heartbeat: fc.boolean(),
    t0: fc.integer({ min: 0, max: 100000 }),
    events: eventsArb,
  });

// ---------------------------------------------------------------------------
// Harness: a model of Explore's pointer handling over the real pure pipeline
// ---------------------------------------------------------------------------

interface Rec {
  ev: Ev;
  t: number;
  /** A pipeline step ran (move processing or a lift). */
  stepped: boolean;
  lift: boolean;
  /** The pointer list was empty when the event arrived. */
  idleBefore: boolean;
  /** A new touch began on this event (engine reset). */
  newTouch: boolean;
  target: Target | null;
  engineEffects: Effect[];
  out: Effect[];
  engineState: EngineState;
  hbState: HeartbeatState;
  followed: Target;
}

const NONE: Target = { kind: 'none' };

function resolve(f: FingerSpec, scene: DiagramScene, view: Viewport): ScreenPoint {
  const pts = scene.points ?? [];
  const at = (i: number): ScreenPoint | null => {
    if (pts.length === 0) return null;
    const p = pts[i % pts.length];
    return p ? toScreen({ x: p.x, y: p.y }, view) : null;
  };
  const fallback = (rx: number, ry: number): ScreenPoint => ({ x: rx * 400, y: ry * 800 });
  switch (f.mode) {
    case 'onPoint':
      return at(f.i) ?? fallback(0.5, 0.5);
    case 'nearPoint': {
      const p = at(f.i) ?? fallback(0.5, 0.5);
      return { x: p.x + f.ox, y: p.y + f.oy };
    }
    case 'anywhere':
      return fallback(f.rx, f.ry);
    case 'nonFinite':
      return { x: f.x, y: f.y };
    case 'midSegment': {
      const segs = scene.segments ?? [];
      if (segs.length === 0) return fallback(f.f, f.f);
      const s = segs[f.i % segs.length];
      const a = pts.find((p) => p.id === s?.a);
      const b = pts.find((p) => p.id === s?.b);
      if (!a || !b) return fallback(f.f, f.f);
      return toScreen({ x: a.x + (b.x - a.x) * f.f, y: a.y + (b.y - a.y) * f.f }, view);
    }
  }
}

function run(c: Case): Rec[] {
  const { scene, view } = c;
  const recs: Rec[] = [];
  let es: EngineState = initialState();
  let hs: HeartbeatState = initialHeartbeatState();
  let followed: Target = NONE;
  let lineSince = 0;
  let t = c.t0;
  const active: number[] = [];

  const process = (finger: ScreenPoint, ev: Ev, newTouch: boolean, idleBefore: boolean): void => {
    const held =
      followed.kind === 'line' && Number.isFinite(t - lineSince) ? t - lineSince : 0;
    const target = c.sticky
      ? followTarget(followed, held, scene, finger, view, DEFAULT_RADII, STICKY_RADIUS_PX)
      : hitTest(scene, finger, view, DEFAULT_RADII);
    const yNorm = toNorm(finger, view).y;
    const r = step(es, { kind: 'move', t, target, yNorm }, DEFAULT_HAPTICS);
    es = r.state;
    let out: Effect[] = r.effects;
    if (c.heartbeat) {
      const hb = heartbeatStep(hs, { kind: 'move', t, target, engineEffects: r.effects }, DEFAULT_HEARTBEAT);
      hs = hb.state;
      out = hb.effects;
    }
    const sameLine =
      target.kind === 'line' && followed.kind === 'line' && followed.id === target.id && followed.elementKind === target.elementKind;
    if (target.kind === 'line' && !sameLine) lineSince = t;
    followed = target;
    recs.push({ ev, t, stepped: true, lift: false, idleBefore, newTouch, target, engineEffects: r.effects, out, engineState: es, hbState: hs, followed });
  };

  const lift = (ev: Ev, idleBefore: boolean): void => {
    const r = step(es, { kind: 'lift', t }, DEFAULT_HAPTICS);
    es = r.state;
    let out: Effect[] = r.effects;
    if (c.heartbeat) {
      const hb = heartbeatStep(hs, { kind: 'lift', t, engineEffects: r.effects }, DEFAULT_HEARTBEAT);
      hs = hb.state;
      out = hb.effects;
    }
    followed = NONE;
    lineSince = 0;
    recs.push({ ev, t, stepped: true, lift: true, idleBefore, newTouch: false, target: null, engineEffects: r.effects, out, engineState: es, hbState: hs, followed });
  };

  const ignored = (ev: Ev, idleBefore: boolean): void => {
    recs.push({ ev, t, stepped: false, lift: false, idleBefore, newTouch: false, target: null, engineEffects: [], out: [], engineState: es, hbState: hs, followed });
  };

  for (const ev of c.events) {
    t += ev.dt;
    const idleBefore = active.length === 0;
    switch (ev.kind) {
      case 'down': {
        if (active.includes(ev.p)) {
          ignored(ev, idleBefore);
        } else if (idleBefore) {
          active.push(ev.p);
          es = initialState();
          hs = initialHeartbeatState();
          followed = NONE;
          lineSince = t;
          process(resolve(ev.f, scene, view), ev, true, true);
        } else {
          active.push(ev.p);
          ignored(ev, idleBefore);
        }
        break;
      }
      case 'move': {
        if (active[0] === ev.p) process(resolve(ev.f, scene, view), ev, false, false);
        else ignored(ev, idleBefore);
        break;
      }
      case 'up':
      case 'cancel': {
        const i = active.indexOf(ev.p);
        if (i < 0) {
          ignored(ev, idleBefore);
        } else {
          active.splice(i, 1);
          if (active.length === 0) lift(ev, idleBefore);
          else ignored(ev, idleBefore); // promotion: no effects (Requirement 4.8)
        }
        break;
      }
      case 'blur':
      case 'hidden': {
        active.length = 0;
        lift(ev, idleBefore);
        break;
      }
    }
  }
  return recs;
}

// ---------------------------------------------------------------------------
// Invariant checks (each returns normally or throws via expect)
// ---------------------------------------------------------------------------

const lastOf = <T,>(xs: T[], pred: (x: T) => boolean): T | undefined => {
  for (let i = xs.length - 1; i >= 0; i--) {
    const x = xs[i] as T;
    if (pred(x)) return x;
  }
  return undefined;
};

function checkBounded(recs: Rec[]): void {
  for (const r of recs) {
    expect(r.out.length).toBeLessThanOrEqual(4);
    for (const e of r.out) {
      if (e.kind === 'tone' && e.hz !== null) expect(Number.isFinite(e.hz)).toBe(true);
    }
  }
}

function checkLift(recs: Rec[]): void {
  let silentSince = false; // a lift happened and no new touch has begun
  for (const r of recs) {
    if (r.newTouch) silentSince = false;
    if (silentSince && !r.lift) {
      // Between a lift and the next down nothing is produced.
      expect(r.out).toEqual([]);
    }
    if (r.lift) {
      const v = lastOf(r.out, (e) => e.kind === 'vibrate');
      const tn = lastOf(r.out, (e) => e.kind === 'tone');
      expect(v).toEqual({ kind: 'vibrate', pattern: 0 });
      expect(tn).toEqual({ kind: 'tone', hz: null });
      expect(r.engineState).toEqual(initialState());
      expect(r.hbState).toEqual(initialHeartbeatState());
      expect(r.followed).toEqual(NONE);
      silentSince = true;
    }
  }
}

function checkNoRepeatedCorner(recs: Rec[]): void {
  let prev: { key: string; t: number } | null = null;
  for (const r of recs) {
    if (r.newTouch || r.lift) prev = null;
    if (r.target?.kind !== 'vertex') continue;
    const sp = r.out.find((e) => e.kind === 'speak' || e.kind === 'speakKey');
    if (!sp) continue;
    const key = sp.kind === 'speak' ? `s:${sp.text}` : sp.kind === 'speakKey' ? `k:${sp.params.id}` : '';
    if (prev && prev.key === key) expect(r.t - prev.t).toBeGreaterThanOrEqual(DEFAULT_HAPTICS.quietMs);
    prev = { key, t: r.t };
  }
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('touch pipeline chaos (Requirement 36)', () => {
  it('P132: never throws, at most 4 effects per step, tones are null or finite', () => {
    fc.assert(fc.property(caseOf(sceneArb), (c) => checkBounded(run(c))), { numRuns: runs(300) });
  });

  it('P133: a lift silences everything and stays silent until the next down', () => {
    fc.assert(fc.property(caseOf(sceneArb), (c) => checkLift(run(c))), { numRuns: runs(300) });
  });

  it('P134: no corner is announced twice inside the quiet window within one touch', () => {
    fc.assert(fc.property(caseOf(sceneArb), (c) => checkNoRepeatedCorner(run(c))), { numRuns: runs(300) });
  });

  it('P134 (jitter): a finger shaking on a corner boundary announces it at most once per quiet window', () => {
    // Fixed shape that reaches the re-entry state by construction: down on a corner, then moves
    // alternating between the corner and a spot 40 px away, with short steps.
    const jitterArb: fc.Arbitrary<Case> = fc
      .record({
        scene: fc.oneof(fc.constantFrom(...sampleScenes), validSceneArb, degenerateSceneArb),
        view: fc.tuple(fc.double({ min: 100, max: 900, noNaN: true }), fc.double({ min: 100, max: 900, noNaN: true })).map(([w, h]) => makeViewport(w, h)),
        sticky: fc.boolean(),
        heartbeat: fc.boolean(),
        i: fc.nat(6),
        steps: fc.array(fc.integer({ min: 0, max: 200 }), { minLength: 2, maxLength: 60 }),
      })
      .map((r): Case => {
        const on: FingerSpec = { mode: 'onPoint', i: r.i };
        const off: FingerSpec = { mode: 'nearPoint', i: r.i, ox: 40, oy: 40 };
        const events: Ev[] = [{ kind: 'down', p: 0, f: on, dt: 0 }];
        r.steps.forEach((dt, k) => events.push({ kind: 'move', p: 0, f: k % 2 === 0 ? off : on, dt }));
        return { scene: r.scene, view: r.view, sticky: r.sticky, heartbeat: r.heartbeat, t0: 0, events };
      });
    fc.assert(fc.property(jitterArb, (c) => checkNoRepeatedCorner(run(c))), { numRuns: runs(300) });
  });

  it('example: shaky finger on a triangle corner gives one announcement per quiet window', () => {
    const scene = triangleJson as unknown as DiagramScene;
    const view = makeViewport(400, 800);
    const on: FingerSpec = { mode: 'onPoint', i: 0 };
    const off: FingerSpec = { mode: 'nearPoint', i: 0, ox: 60, oy: 60 };
    const events: Ev[] = [
      { kind: 'down', p: 0, f: on, dt: 0 },
      { kind: 'move', p: 0, f: off, dt: 50 },
      { kind: 'move', p: 0, f: on, dt: 50 },
      { kind: 'move', p: 0, f: off, dt: 50 },
      { kind: 'move', p: 0, f: on, dt: 50 },
    ];
    const recs = run({ scene, view, sticky: false, heartbeat: false, t0: 0, events });
    const announced = recs.filter((r) => r.out.some((e) => e.kind === 'speak'));
    expect(announced).toHaveLength(1);
    checkNoRepeatedCorner(recs);
  });

  it('P135: replay gives the same effects and leaves the scene untouched', () => {
    fc.assert(
      fc.property(caseOf(sceneArb), (c) => {
        const before = structuredClone(c.scene);
        const a = run(c).map((r) => r.out);
        const b = run(c).map((r) => r.out);
        expect(b).toEqual(a);
        expect(c.scene).toEqual(before);
      }),
      { numRuns: runs(200) },
    );
  });

  it('P136: degenerate scenes, zero-size viewports and non-finite fingers', () => {
    const view0 = fc.oneof(
      fc.constant(makeViewport(0, 600)),
      fc.constant(makeViewport(400, 0)),
      fc.constant(makeViewport(0, 0)),
      fc.constant(makeViewport(300, 300)),
    );
    fc.assert(
      fc.property(caseOf(degenerateSceneArb, view0), (c) => {
        const recs = run(c);
        checkBounded(recs);
        checkLift(recs);
        checkNoRepeatedCorner(recs);
      }),
      { numRuns: runs(300) },
    );
  });

  // Deterministic examples that reach the states by construction.
  it('example: trace the triangle, second finger, promote, blur', () => {
    const scene = triangleJson as unknown as DiagramScene;
    const view = makeViewport(400, 800);
    const onA: FingerSpec = { mode: 'onPoint', i: 0 };
    const events: Ev[] = [
      { kind: 'down', p: 0, f: onA, dt: 0 },
      { kind: 'down', p: 1, f: onA, dt: 10 },
      { kind: 'up', p: 0, dt: 10 },
      { kind: 'move', p: 1, f: { mode: 'midSegment', i: 0, f: 0.5 }, dt: 600 },
      { kind: 'blur', dt: 5 },
      { kind: 'move', p: 1, f: onA, dt: 5 },
    ];
    for (const sticky of [false, true]) {
      for (const heartbeat of [false, true]) {
        const recs = run({ scene, view, sticky, heartbeat, t0: 0, events });
        checkBounded(recs);
        checkLift(recs);
        checkNoRepeatedCorner(recs);
        expect(recs[0]?.out.some((e) => e.kind === 'vibrate' && Array.isArray(e.pattern))).toBe(true);
        expect(recs[3]?.stepped).toBe(true);
        expect(recs[4]?.lift).toBe(true);
        expect(recs[5]?.out).toEqual([]);
      }
    }
  });
});
