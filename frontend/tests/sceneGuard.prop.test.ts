/**
 * P128 to P131 - scene ingress guard (Requirement 35, task 61). Written by Kiro.
 * The oracle for "accepted" is the guard itself only where a test must start from an accepted
 * scene; those scenes are built by a generator that is valid by construction.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import validatePy from '../../backend/app/validate.py?raw';
import backendBars from '../../backend/fixtures/barchart.json?raw';
import backendSine from '../../backend/fixtures/sine.json?raw';
import backendTriangle from '../../backend/fixtures/triangle.json?raw';
import sampleBars from '../public/samples/barchart.json?raw';
import sampleSine from '../public/samples/sine.json?raw';
import sampleTriangle from '../public/samples/triangle.json?raw';
import { curveYAtX } from '../src/core/curve';
import { directionOf, lineEnds, nearestElement, vertexExits } from '../src/core/compass';
import { makeViewport, type ScreenPoint, type Viewport } from '../src/core/geometry';
import { initialState, step } from '../src/core/hapticEngine';
import { DEFAULT_RADII, hitTest } from '../src/core/hitTest';
import { deserialise } from '../src/core/savedDiagrams';
import type { DiagramScene } from '../src/core/scene';
import { isRenderableScene, SCENE_GUARD_LIMITS } from '../src/core/sceneGuard';
import { followTarget } from '../src/core/sticky';
import { runs } from './support/runs';

const RUNS = runs(300);

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const unit = fc.double({ min: 0, max: 1, noNaN: true });
const label = fc.option(fc.string({ maxLength: 20 }), { nil: undefined });

/** A scene that is valid by construction: all four arrays, unique ids, in-range numbers. */
const sceneArb: fc.Arbitrary<DiagramScene> = fc
  .record({
    kind: fc.constantFrom('geometry', 'function_graph', 'bar_chart', 'unknown' as const),
    pts: fc.array(fc.record({ x: unit, y: unit, label }), { minLength: 2, maxLength: 8 }),
    segPairs: fc.array(fc.tuple(fc.nat(7), fc.nat(7)), { maxLength: 8 }),
    polys: fc.array(fc.array(fc.tuple(unit, unit), { minLength: 0, maxLength: 12 }), { maxLength: 3 }),
    bars: fc.array(
      fc.record({
        x0: unit,
        x1: unit,
        y_top: unit,
        y_base: unit,
        value: fc.double({ min: -1e6, max: 1e6, noNaN: true }),
      }),
      { maxLength: 4 },
    ),
    axes: fc.option(
      fc.record({ x_axis_y: fc.option(unit, { nil: null }), y_axis_x: fc.option(unit, { nil: null }) }),
      { nil: undefined },
    ),
    facts: fc.option(fc.array(fc.string({ maxLength: 30 }), { maxLength: 4 }), { nil: undefined }),
    aspect: fc.option(fc.double({ min: 0.05, max: 20, noNaN: true }), { nil: undefined }),
    title: fc.option(fc.string({ maxLength: 30 }), { nil: undefined }),
  })
  .map((g): DiagramScene => {
    const points = g.pts.map((p, i) => ({ id: `p${i}`, x: p.x, y: p.y, label: p.label ?? null }));
    const segments = g.segPairs.map(([a, b], i) => ({
      id: `s${i}`,
      a: `p${a % points.length}`,
      b: `p${b % points.length}`,
    }));
    const scene: DiagramScene = {
      version: 1,
      kind: g.kind,
      points,
      segments,
      polylines: g.polys.map((pts, i) => ({ id: `l${i}`, points: pts })),
      bars: g.bars.map((b, i) => ({ id: `b${i}`, label: `bar ${i}`, ...b })),
    };
    if (g.axes !== undefined) scene.axes = g.axes;
    if (g.facts !== undefined) scene.facts = g.facts;
    if (g.aspect !== undefined) scene.aspect = g.aspect;
    if (g.title !== undefined) scene.title = g.title;
    return scene;
  });

const anyDouble = fc.oneof(
  fc.double({ noNaN: false }),
  fc.double({ min: -500, max: 1500, noNaN: true }),
  fc.constantFrom(NaN, Infinity, -Infinity, 0, -0),
);
const fingerArb: fc.Arbitrary<ScreenPoint> = fc.record({ x: anyDouble, y: anyDouble });
const viewArb: fc.Arbitrary<Viewport> = fc
  .tuple(fc.integer({ min: 50, max: 2000 }), fc.integer({ min: 50, max: 2000 }))
  .map(([w, h]) => makeViewport(w, h));

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function allFinite(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(allFinite);
  if (v !== null && typeof v === 'object') return Object.values(v).every(allFinite);
  return true;
}

// ---------------------------------------------------------------------------
// P128 total
// ---------------------------------------------------------------------------

describe('P128: the guard is total', () => {
  it('returns a boolean for any JSON value', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        expect(typeof isRenderableScene(v)).toBe('boolean');
      }),
      { numRuns: RUNS },
    );
  });

  it('returns a boolean for scene-shaped values with junk in random fields', () => {
    const junk = fc.oneof(fc.jsonValue(), fc.constant(undefined), fc.constant(NaN), fc.constant(Infinity));
    fc.assert(
      fc.property(
        sceneArb,
        fc.constantFrom('kind', 'points', 'segments', 'polylines', 'bars', 'facts', 'axes', 'aspect', 'title'),
        junk,
        (scene, key, j) => {
          const s = { ...scene, [key]: j } as unknown;
          expect(typeof isRenderableScene(s)).toBe('boolean');
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('returns false and does not throw for a throwing Proxy and a throwing getter', () => {
    const boom = new Proxy({}, { get: () => { throw new Error('boom'); }, has: () => { throw new Error('boom'); } });
    expect(isRenderableScene(boom)).toBe(false);
    const getter = { get kind(): string { throw new Error('boom'); } };
    expect(isRenderableScene(getter)).toBe(false);
    const nested = { kind: 'geometry', points: boom, segments: [], polylines: [], bars: [] };
    expect(isRenderableScene(nested)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P129 bundled scenes and limits
// ---------------------------------------------------------------------------

describe('P129: bundled scenes are accepted, limits equal the backend', () => {
  const named: [string, string][] = [
    ['samples/triangle', sampleTriangle],
    ['samples/sine', sampleSine],
    ['samples/barchart', sampleBars],
    ['fixtures/triangle', backendTriangle],
    ['fixtures/sine', backendSine],
    ['fixtures/barchart', backendBars],
  ];
  for (const [name, raw] of named) {
    it(`accepts ${name}`, () => {
      expect(isRenderableScene(JSON.parse(raw))).toBe(true);
    });
  }

  const constant = (n: string): number => {
    const m = validatePy.match(new RegExp(`^${n}\\s*=\\s*([\\d_]+)\\s*$`, 'm'));
    if (!m) throw new Error(`${n} not found in backend/app/validate.py`);
    return Number(m[1]!.replace(/_/g, ''));
  };

  it('SCENE_GUARD_LIMITS equals the backend constants', () => {
    expect(SCENE_GUARD_LIMITS.points).toBe(constant('MAX_SCENE_POINTS'));
    expect(SCENE_GUARD_LIMITS.segments).toBe(constant('MAX_SCENE_SEGMENTS'));
    expect(SCENE_GUARD_LIMITS.polylines).toBe(constant('MAX_SCENE_POLYLINES'));
    expect(SCENE_GUARD_LIMITS.polylinePoints).toBe(constant('MAX_POLYLINE_POINTS'));
    expect(SCENE_GUARD_LIMITS.bars).toBe(constant('MAX_SCENE_BARS'));
    expect(SCENE_GUARD_LIMITS.facts).toBe(constant('MAX_SCENE_FACTS'));
    expect(SCENE_GUARD_LIMITS.text).toBe(constant('MAX_TEXT_CHARS'));
  });
});

// ---------------------------------------------------------------------------
// P130 an accepted scene never breaks the core
// ---------------------------------------------------------------------------

describe('P130: an accepted scene never breaks the core', () => {
  it('the generator itself produces accepted scenes', () => {
    fc.assert(
      fc.property(sceneArb, (s) => {
        expect(isRenderableScene(s)).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it('hitTest, step, compass, curveYAtX and followTarget never throw and return finite numbers', () => {
    fc.assert(
      fc.property(sceneArb, fingerArb, viewArb, fc.double({ min: 0, max: 1, noNaN: true }), (scene, finger, view, yn) => {
        expect(isRenderableScene(scene)).toBe(true);

        const target = hitTest(scene, finger, view, DEFAULT_RADII);
        expect(allFinite(target)).toBe(true);

        const out = step(initialState(), { kind: 'move', t: 1000, target, yNorm: yn });
        expect(allFinite(out.effects)).toBe(true);
        const lifted = step(out.state, { kind: 'lift', t: 1100 });
        expect(allFinite(lifted.effects)).toBe(true);

        const near = nearestElement(scene, finger, view);
        expect(allFinite(near)).toBe(true);

        for (const p of scene.points ?? []) {
          expect(allFinite(vertexExits(scene, p.id))).toBe(true);
          expect(directionOf(p, { x: finger.x, y: finger.y })).not.toBeUndefined();
        }
        for (const g of scene.segments ?? []) {
          expect(allFinite(lineEnds(scene, g.id))).toBe(true);
        }

        const curve = curveYAtX(scene, finger.x / 100, yn);
        expect(allFinite(curve)).toBe(true);

        const prev = target.kind === 'line' ? target : ({ kind: 'none' } as const);
        const followed = followTarget(prev, 500, scene, finger, view, DEFAULT_RADII, 24);
        expect(allFinite(followed)).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// P131 damage is rejected
// ---------------------------------------------------------------------------

type Damage = (s: Record<string, any>) => boolean;

const BAD_COORDS: unknown[] = [NaN, Infinity, -Infinity, -0.001, 1.001, '0.5', null];

describe('P131: damage is rejected', () => {
  it('removing or breaking any required array is rejected', () => {
    fc.assert(
      fc.property(
        sceneArb,
        fc.constantFrom('points', 'segments', 'polylines', 'bars'),
        fc.constantFrom('delete', 'null', 'object', 'string'),
        (scene, key, how) => {
          const c = clone(scene) as unknown as Record<string, unknown>;
          if (how === 'delete') delete c[key];
          else c[key] = how === 'null' ? null : how === 'object' ? {} : 'x';
          expect(isRenderableScene(c)).toBe(false);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('a missing or unknown kind is rejected', () => {
    fc.assert(
      fc.property(sceneArb, fc.constantFrom(undefined, 'triangle', '', 3, null), (scene, kind) => {
        const c = { ...clone(scene), kind } as unknown;
        expect(isRenderableScene(c)).toBe(false);
      }),
      { numRuns: RUNS },
    );
  });

  it('corrupting any single coordinate, value, id, endpoint or aspect is rejected', () => {
    fc.assert(
      fc.property(sceneArb, fc.nat(), fc.nat(), fc.constantFrom(...BAD_COORDS), (scene, pick, sub, bad) => {
        const slots: Damage[] = [];
        scene.points?.forEach((_, i) => {
          slots.push((s) => ((s.points[i].x = bad), true));
          slots.push((s) => ((s.points[i].y = bad), true));
          slots.push((s) => ((s.points[i].id = ''), true));
          slots.push((s) => ((s.points[i].id = 7), true));
        });
        scene.segments?.forEach((_, i) => {
          slots.push((s) => ((s.segments[i].a = 'nope'), true));
          slots.push((s) => ((s.segments[i].b = 'nope'), true));
        });
        scene.polylines?.forEach((pl, i) => {
          pl.points.forEach((_, j) => {
            slots.push((s) => ((s.polylines[i].points[j][sub % 2] = bad), true));
          });
          slots.push((s) => ((s.polylines[i].id = ''), true));
        });
        scene.bars?.forEach((_, i) => {
          for (const k of ['x0', 'x1', 'y_top', 'y_base']) slots.push((s) => ((s.bars[i][k] = bad), true));
          slots.push((s) => ((s.bars[i].value = NaN), true));
          slots.push((s) => ((s.bars[i].value = Infinity), true));
          slots.push((s) => ((s.bars[i].id = ''), true));
        });
        slots.push((s) => ((s.aspect = 0.04), true));
        slots.push((s) => ((s.aspect = 21), true));
        slots.push((s) => ((s.aspect = NaN), true));
        slots.push((s) => {
          s.axes = { x_axis_y: bad === null ? 'x' : bad, y_axis_x: null };
          return true;
        });
        const damage = slots[pick % slots.length]!;
        // JSON.stringify turns NaN and Infinity into null, so apply the damage after cloning.
        const c = clone(scene) as unknown as Record<string, any>;
        damage(c);
        expect(isRenderableScene(c)).toBe(false);
      }),
      { numRuns: RUNS },
    );
  });

  it('exceeding one size cap by one is rejected, and the cap itself is accepted', () => {
    const base: DiagramScene = {
      version: 1,
      kind: 'unknown',
      points: [{ id: 'p0', x: 0, y: 0 }],
      segments: [],
      polylines: [],
      bars: [],
    };
    const L = SCENE_GUARD_LIMITS;
    const pts = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, x: 0.5, y: 0.5 }));
    const segs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, a: 'p0', b: 'p0' }));
    const polys = (n: number, m = 0) =>
      Array.from({ length: n }, (_, i) => ({ id: `l${i}`, points: Array.from({ length: m }, () => [0.5, 0.5] as [number, number]) }));
    const bars = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `b${i}`, label: 'b', value: 1, x0: 0, x1: 1, y_top: 0, y_base: 1 }));
    const cases: [string, (n: number) => DiagramScene][] = [
      ['points', (n) => ({ ...base, points: pts(n) })],
      ['segments', (n) => ({ ...base, segments: segs(n) })],
      ['polylines', (n) => ({ ...base, polylines: polys(n) })],
      ['polylinePoints', (n) => ({ ...base, polylines: polys(1, n) })],
      ['bars', (n) => ({ ...base, bars: bars(n) })],
      ['facts', (n) => ({ ...base, facts: Array.from({ length: n }, () => 'f') })],
      ['text', (n) => ({ ...base, title: 'x'.repeat(n) })],
    ];
    for (const [key, make] of cases) {
      const cap = L[key as keyof typeof L] as number;
      expect(isRenderableScene(make(cap)), `${key} at the cap`).toBe(true);
      expect(isRenderableScene(make(cap + 1)), `${key} over the cap`).toBe(false);
    }
    // every string kind is capped
    const long = 'x'.repeat(L.text + 1);
    expect(isRenderableScene({ ...base, facts: [long] })).toBe(false);
    expect(isRenderableScene({ ...base, points: [{ id: 'p0', x: 0, y: 0, label: long }] })).toBe(false);
    expect(isRenderableScene({ ...base, bars: [{ ...bars(1)[0]!, label: long }] })).toBe(false);
  });

  it('deserialise returns undefined for each damaged scene and keeps the good one', () => {
    fc.assert(
      fc.property(sceneArb, fc.constantFrom('points', 'segments', 'polylines', 'bars'), (scene, key) => {
        const entry = { id: 'a', createdAt: 1, title: 't', thumbnailDataUrl: '', pinned: false };
        const good = deserialise({ ...entry, scene });
        expect(good?.scene).toBe(scene);
        const broken = clone(scene) as unknown as Record<string, unknown>;
        delete broken[key];
        expect(deserialise({ ...entry, scene: broken })).toBeUndefined();
        expect(deserialise(JSON.stringify({ ...entry, scene: broken }))).toBeUndefined();
      }),
      { numRuns: RUNS },
    );
  });

  it('a polyline vertex that is not a pair is rejected', () => {
    const mk = (q: unknown): unknown => ({ version: 1, kind: 'unknown', points: [], segments: [], bars: [], polylines: [{ id: 'l', points: [q] }] });
    for (const q of [[], [0.5], [0.5, 0.5, 0.5], 'ab', { 0: 0.5, 1: 0.5 }]) expect(isRenderableScene(mk(q))).toBe(false);
    expect(isRenderableScene(mk([0.5, 0.5]))).toBe(true);
  });
});
