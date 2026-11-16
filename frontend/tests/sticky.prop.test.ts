/**
 * P114 to P119 - sticky line following (Requirement 33, task 58).
 *
 * Written by Kiro. The expected answers come from `hitTest` itself (the base answer) and, for
 * how far the held line reaches, from a brute-force minimum over the held element's pieces built
 * here with `distToSegmentXY`. Nothing in `core/sticky.ts` is reused as an oracle.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { distToSegmentXY, makeViewport, type ScreenPoint, type Viewport } from '../src/core/geometry';
import { DEFAULT_RADII, hitTest, type Radii, type Target } from '../src/core/hitTest';
import type { DiagramScene } from '../src/core/scene';
import { followTarget, STICKY_HOLD_MS, STICKY_RADIUS_PX } from '../src/core/sticky';

const RUNS = 250;

type LineTarget = Extract<Target, { kind: 'line' }>;
type Piece = [number, number, number, number];

const unit = fc.double({ min: 0, max: 1, noNaN: true });
const viewArb: fc.Arbitrary<Viewport> = fc
  .tuple(fc.integer({ min: 100, max: 1200 }), fc.integer({ min: 100, max: 1200 }))
  .map(([w, h]) => makeViewport(w, h));
const radiiArb: fc.Arbitrary<Radii> = fc.oneof(
  fc.constant<Radii>(DEFAULT_RADII),
  fc.record({ vertex: fc.integer({ min: 2, max: 30 }), line: fc.integer({ min: 1, max: 30 }) }),
);
/** Uniform in [0, 1) (fc.double is log-distributed and would cluster near 0). */
const uni = fc.integer({ min: 0, max: 999_999 }).map((n) => n / 1_000_000);
const heldOk = fc.double({ min: STICKY_HOLD_MS, max: 1e7, noNaN: true });
const rnd4 = fc.array(uni, { minLength: 5, maxLength: 5 });

/** A scene that always has every line kind: segments, a polyline, both axes and a bar. */
const sceneArb: fc.Arbitrary<DiagramScene> = fc
  .record({
    pts: fc.array(fc.tuple(unit, unit), { minLength: 3, maxLength: 5 }),
    poly: fc.array(fc.array(fc.tuple(unit, unit), { minLength: 2, maxLength: 6 }), { minLength: 1, maxLength: 2 }),
    xAxis: unit,
    yAxis: unit,
    bars: fc.array(fc.record({ x0: unit, x1: unit, top: unit, base: unit }), { minLength: 1, maxLength: 2 }),
  })
  .map(
    (g): DiagramScene => ({
      version: 1,
      kind: 'function_graph',
      points: g.pts.map(([x, y], i) => ({ id: `p${i}`, x, y, label: null })),
      segments: [
        { id: 's0', a: 'p0', b: 'p1', label: null },
        { id: 's1', a: 'p1', b: 'p2', label: null },
      ],
      polylines: g.poly.map((pts, i) => ({ id: `pl${i}`, points: pts.map(([x, y]): [number, number] => [x, y]), label: null })),
      bars: g.bars.map((b, i) => ({ id: `b${i}`, label: `B${i}`, value: 1 + i, x0: b.x0, x1: b.x1, y_top: b.top, y_base: b.base })),
      axes: { x_axis_y: g.xAxis, y_axis_x: g.yAxis },
    }),
  );

const ELEMENT_KINDS = ['segment', 'polyline', 'axis', 'bar-edge'] as const;

/** Every line element the scene has, as the target `hitTest` would name it. */
function candidates(scene: DiagramScene): LineTarget[] {
  const out: LineTarget[] = [];
  for (const s of scene.segments ?? []) out.push({ kind: 'line', id: s.id, elementKind: 'segment' });
  for (const p of scene.polylines ?? []) out.push({ kind: 'line', id: p.id, elementKind: 'polyline' });
  if (scene.axes?.x_axis_y != null) out.push({ kind: 'line', id: 'x-axis', elementKind: 'axis' });
  if (scene.axes?.y_axis_x != null) out.push({ kind: 'line', id: 'y-axis', elementKind: 'axis' });
  for (const b of scene.bars ?? []) out.push({ kind: 'line', id: b.id, elementKind: 'bar-edge' });
  return out;
}

/** The screen-space pieces of one held element, enumerated independently of `hitTest`. */
function pieces(scene: DiagramScene, view: Viewport, held: LineTarget): Piece[] {
  const { offsetX: ox, offsetY: oy, scale: sc } = view;
  const out: Piece[] = [];
  if (held.elementKind === 'segment') {
    for (const s of scene.segments ?? []) {
      if (s.id !== held.id) continue;
      const a = (scene.points ?? []).find((p) => p.id === s.a);
      const b = (scene.points ?? []).find((p) => p.id === s.b);
      if (a === undefined || b === undefined) continue;
      out.push([ox + a.x * sc, oy + a.y * sc, ox + b.x * sc, oy + b.y * sc]);
    }
  } else if (held.elementKind === 'polyline') {
    for (const pl of scene.polylines ?? []) {
      if (pl.id !== held.id) continue;
      for (let i = 1; i < pl.points.length; i++) {
        const a = pl.points[i - 1]!;
        const b = pl.points[i]!;
        out.push([ox + a[0] * sc, oy + a[1] * sc, ox + b[0] * sc, oy + b[1] * sc]);
      }
    }
  } else if (held.elementKind === 'axis') {
    if (held.id === 'x-axis' && scene.axes?.x_axis_y != null) {
      const y = oy + scene.axes.x_axis_y * sc;
      out.push([ox, y, ox + sc, y]);
    }
    if (held.id === 'y-axis' && scene.axes?.y_axis_x != null) {
      const x = ox + scene.axes.y_axis_x * sc;
      out.push([x, oy, x, oy + sc]);
    }
  } else {
    for (const b of scene.bars ?? []) {
      if (b.id !== held.id) continue;
      const l = ox + b.x0 * sc;
      const r = ox + b.x1 * sc;
      const t = oy + b.y_top * sc;
      const bs = oy + b.y_base * sc;
      out.push([l, t, r, t], [l, bs, r, bs], [l, t, l, bs], [r, t, r, bs]);
    }
  }
  return out;
}

function minDist(f: ScreenPoint, pcs: Piece[]): number {
  let m = Infinity;
  for (const [ax, ay, bx, by] of pcs) m = Math.min(m, distToSegmentXY(f.x, f.y, ax, ay, bx, by));
  return m;
}

/** A finger near a random point of a random piece (up to 50 px away), or anywhere on the canvas. */
function aim(pcs: Piece[], view: Viewport, u: number[]): ScreenPoint {
  if (pcs.length === 0 || u[4]! < 0.08) return { x: u[0]! * view.canvasWidth, y: u[1]! * view.canvasHeight };
  const [ax, ay, bx, by] = pcs[Math.floor(u[0]! * pcs.length)]!;
  const t = u[1]!;
  const ang = u[2]! * 2 * Math.PI;
  const r = u[3]! * 50;
  return { x: ax + t * (bx - ax) + r * Math.cos(ang), y: ay + t * (by - ay) + r * Math.sin(ang) };
}

interface Case {
  scene: DiagramScene;
  view: Viewport;
  radii: Radii;
  pick: number;
  kind: (typeof ELEMENT_KINDS)[number];
  u: number[];
}
const caseArb: fc.Arbitrary<Case> = fc.record({
  scene: sceneArb,
  view: viewArb,
  radii: radiiArb,
  pick: uni,
  kind: fc.constantFrom(...ELEMENT_KINDS),
  u: rnd4,
});

function heldOf(c: Case): LineTarget {
  const all = candidates(c.scene).filter((t) => t.elementKind === c.kind);
  return all[Math.floor(c.pick * all.length) % all.length]!;
}

const stripped = (t: Target): Target => (t.kind === 'line' ? { kind: 'line', id: t.id, elementKind: t.elementKind } : t);

describe('P114 - acquisition is unchanged (Requirement 33.1, 33.2, 33.7)', () => {
  it('a previous target that is not a line gives exactly hitTest, whatever heldMs', () => {
    const prevArb = fc.constantFrom<Target>(
      { kind: 'none' },
      { kind: 'vertex', id: 'p0' },
      { kind: 'bar', id: 'b0', label: 'B0', value: 1, maxValue: 1 },
    );
    fc.assert(
      fc.property(caseArb, prevArb, fc.constantFrom(0, 200, 5000, 1e9, Infinity), fc.double({ min: 15, max: 60, noNaN: true }), (c, prev, heldMs, s) => {
        const finger = aim(pieces(c.scene, c.view, heldOf(c)), c.view, c.u);
        expect(followTarget(prev, heldMs, c.scene, finger, c.view, c.radii, s)).toEqual(hitTest(c.scene, finger, c.view, c.radii));
      }),
      { numRuns: RUNS },
    );
  });

  it('a held line with heldMs below 200, NaN or infinite gives exactly hitTest', () => {
    const shortMs = fc.oneof(
      fc.double({ min: -1e6, max: STICKY_HOLD_MS - 1e-9, noNaN: true }),
      fc.constantFrom(0, 199.999, NaN, Infinity, -Infinity),
    );
    fc.assert(
      fc.property(caseArb, shortMs, (c, heldMs) => {
        const held = heldOf(c);
        const finger = aim(pieces(c.scene, c.view, held), c.view, c.u);
        const s = c.radii.line + 10;
        expect(followTarget(held, heldMs, c.scene, finger, c.view, c.radii, s)).toEqual(hitTest(c.scene, finger, c.view, c.radii));
      }),
      { numRuns: RUNS },
    );
  });

  it('after a lift nothing sticks, even for a finger 20 px from a line that was held for a long time', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.1, y: 0.5 },
        { id: 'B', x: 0.9, y: 0.5 },
      ],
      segments: [{ id: 'AB', a: 'A', b: 'B' }],
      polylines: [],
      bars: [],
    };
    const view = makeViewport(400, 400);
    const finger = { x: 200, y: 220 };
    const held: Target = { kind: 'line', id: 'AB', elementKind: 'segment' };
    expect(followTarget(held, 500, scene, finger, view, DEFAULT_RADII, STICKY_RADIUS_PX)).toEqual(held);
    expect(followTarget({ kind: 'none' }, 500, scene, finger, view, DEFAULT_RADII, STICKY_RADIUS_PX)).toEqual({ kind: 'none' });
  });
});

describe('P115 - a vertex always wins (Requirement 33.4)', () => {
  it('a finger inside the vertex radius gets the vertex hitTest names, never a line', () => {
    fc.assert(
      fc.property(caseArb, fc.nat({ max: 4 }), uni, uni, heldOk, (c, which, r, a, heldMs) => {
        const pts = c.scene.points ?? [];
        const p = pts[which % pts.length]!;
        const ang = a * 2 * Math.PI;
        const dist = r * (c.radii.vertex - 0.01);
        const finger = {
          x: c.view.offsetX + p.x * c.view.scale + dist * Math.cos(ang),
          y: c.view.offsetY + p.y * c.view.scale + dist * Math.sin(ang),
        };
        const base = hitTest(c.scene, finger, c.view, c.radii);
        expect(base.kind).toBe('vertex');
        const out = followTarget(heldOf(c), heldMs, c.scene, finger, c.view, c.radii, c.radii.line + 30);
        expect(out).toEqual(base);
        expect(out.kind).toBe('vertex');
      }),
      { numRuns: RUNS },
    );
  });
});

describe('P116 - a line that hitTest reports wins (Requirement 33.4)', () => {
  it('whenever hitTest reports a line, that line is returned whatever the held line', () => {
    let lines = 0;
    fc.assert(
      fc.property(caseArb, heldOk, fc.double({ min: 0.5, max: 40, noNaN: true }), (c, heldMs, extra) => {
        const held = heldOf(c);
        const finger = aim(pieces(c.scene, c.view, held), c.view, c.u);
        const base = hitTest(c.scene, finger, c.view, c.radii);
        if (base.kind !== 'line') return;
        lines++;
        expect(followTarget(held, heldMs, c.scene, finger, c.view, c.radii, c.radii.line + extra)).toEqual(base);
      }),
      { numRuns: RUNS },
    );
    expect(lines).toBeGreaterThan(20);
  });

  it('example: a held line 22 px away loses to a different line 10 px away', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.1, y: 0.5 },
        { id: 'B', x: 0.9, y: 0.5 },
        { id: 'C', x: 0.1, y: 0.58 },
        { id: 'D', x: 0.9, y: 0.58 },
      ],
      segments: [
        { id: 'AB', a: 'A', b: 'B' },
        { id: 'CD', a: 'C', b: 'D' },
      ],
      polylines: [],
      bars: [],
    };
    const view = makeViewport(400, 400); // AB at y = 200, CD at y = 232
    const finger = { x: 200, y: 222 }; // 22 px from AB, 10 px from CD
    const held: Target = { kind: 'line', id: 'AB', elementKind: 'segment' };
    expect(followTarget(held, 500, scene, finger, view, DEFAULT_RADII, STICKY_RADIUS_PX)).toEqual({ kind: 'line', id: 'CD', elementKind: 'segment' });
    // Without CD the held line sticks at 22 px.
    const onlyAB = { ...scene, segments: [scene.segments![0]!] };
    expect(followTarget(held, 500, onlyAB, finger, view, DEFAULT_RADII, STICKY_RADIUS_PX)).toEqual(held);
  });
});

/**
 * The per-case check behind P117, run by the random property for breadth and by the
 * deterministic band-covering cases below. It returns which band the finger fell in so the
 * caller can count coverage. The assertions are identical in both callers, so a mutant that
 * breaks sticking is caught whether the finger was placed at random or on purpose.
 */
type Band = 'stuck' | 'released' | 'other';
function checkCase(
  held: LineTarget,
  heldMs: number,
  scene: DiagramScene,
  view: Viewport,
  radii: Radii,
  s: number,
  finger: ScreenPoint,
): Band {
  const pcs = pieces(scene, view, held);
  const base = hitTest(scene, finger, view, radii);
  const out = followTarget(held, heldMs, scene, finger, view, radii, s);
  const d = minDist(finger, pcs);
  let band: Band = 'other';
  if (base.kind === 'vertex' || base.kind === 'line') {
    expect(out).toEqual(base);
  } else if (d <= s - 1e-6) {
    expect(out).toEqual(stripped(held));
    band = 'stuck';
  } else if (d > s + 1e-6) {
    expect(out).toEqual(base);
    band = 'released';
  }
  // Whenever the answer differs from hitTest, the held line really is within reach.
  if (JSON.stringify(out) !== JSON.stringify(base)) {
    expect(base.kind === 'none' || base.kind === 'bar').toBe(true);
    expect(d).toBeLessThanOrEqual(s + 1e-6);
  }
  return band;
}

describe('P117 - it sticks exactly out to the sticky radius (Requirement 33.3)', () => {
  // One isolated scene per element kind, far from every other drawable, so hitTest reports
  // `none` for a finger beside the held line and the brute-force distance is the held line's.
  // Horizontal element at screen y = 200 on a 400x400 canvas; the finger is offset vertically
  // by a known number of pixels, so the band is chosen by arithmetic, not by luck.
  const view = makeViewport(400, 400);
  const radii = DEFAULT_RADII; // line 14, vertex 22
  const s = STICKY_RADIUS_PX; // 24
  type KindScene = { kind: (typeof ELEMENT_KINDS)[number]; scene: DiagramScene; held: LineTarget };
  const isolated: KindScene[] = [
    {
      kind: 'segment',
      scene: {
        version: 1,
        kind: 'geometry',
        points: [
          { id: 'A', x: 0.1, y: 0.5 },
          { id: 'B', x: 0.9, y: 0.5 },
        ],
        segments: [{ id: 'AB', a: 'A', b: 'B' }],
        polylines: [],
        bars: [],
      },
      held: { kind: 'line', id: 'AB', elementKind: 'segment' },
    },
    {
      kind: 'polyline',
      scene: {
        version: 1,
        kind: 'function_graph',
        points: [],
        segments: [],
        polylines: [
          {
            id: 'PL',
            points: [
              [0.1, 0.5],
              [0.9, 0.5],
            ],
            label: null,
          },
        ],
        bars: [],
      },
      held: { kind: 'line', id: 'PL', elementKind: 'polyline' },
    },
    {
      kind: 'axis',
      scene: {
        version: 1,
        kind: 'function_graph',
        points: [],
        segments: [],
        polylines: [],
        bars: [],
        axes: { x_axis_y: 0.5, y_axis_x: null },
      },
      held: { kind: 'line', id: 'x-axis', elementKind: 'axis' },
    },
    {
      kind: 'bar-edge',
      // The bar's base edge sits at y = 200; its top edge is far above (y = 0.1).
      scene: {
        version: 1,
        kind: 'bar_chart',
        points: [],
        segments: [],
        polylines: [],
        bars: [{ id: 'BAR', label: 'B', value: 1, x0: 0.1, x1: 0.9, y_top: 0.1, y_base: 0.5 }],
      },
      held: { kind: 'line', id: 'BAR', elementKind: 'bar-edge' },
    },
  ];

  it('deterministic bands: each element kind sticks at 20 px and releases at 30 px', () => {
    for (const { scene, held } of isolated) {
      // On the line at (200, 200): hitTest reports the line, so followTarget returns it.
      // 20 px off (and far from the bar top at y=40): hitTest none, within s=24 -> stuck.
      // 30 px off: hitTest none, beyond s=24 -> released.
      expect(checkCase(held, 500, scene, view, radii, s, { x: 200, y: 220 })).toBe('stuck');
      expect(checkCase(held, 500, scene, view, radii, s, { x: 200, y: 230 })).toBe('released');
    }
  });

  it('matches a brute-force distance to the held element (segment, polyline, axis, bar edge)', () => {
    const seen = { stuck: 0, released: 0 };
    const perKind = new Set<string>();
    // Seed the counters and the per-kind set with the deterministic bands, so the coverage
    // gate does not depend on random luck (task 60: the gate flaked ~50% on fresh seeds while
    // every per-case assertion passed). The random property below still explores for breadth.
    for (const { kind, scene, held } of isolated) {
      expect(checkCase(held, 500, scene, view, radii, s, { x: 200, y: 220 })).toBe('stuck');
      expect(checkCase(held, 500, scene, view, radii, s, { x: 200, y: 230 })).toBe('released');
      seen.stuck++;
      seen.released++;
      perKind.add(kind);
      // A whole band of offsets per kind, so the stuck and released counts are comfortably met.
      for (let off = 15; off <= 23; off++) {
        if (checkCase(held, 500, scene, view, radii, s, { x: 200, y: 200 + off }) === 'stuck') seen.stuck++;
      }
      for (let off = 25; off <= 40; off++) {
        if (checkCase(held, 500, scene, view, radii, s, { x: 200, y: 200 + off }) === 'released') seen.released++;
      }
    }
    fc.assert(
      fc.property(caseArb, heldOk, fc.double({ min: 0.5, max: 40, noNaN: true }), (c, heldMs, extra) => {
        const held = heldOf(c);
        const finger = aim(pieces(c.scene, c.view, held), c.view, c.u);
        const band = checkCase(held, heldMs, c.scene, c.view, c.radii, c.radii.line + extra, finger);
        if (band === 'stuck') {
          seen.stuck++;
          perKind.add(held.elementKind);
        } else if (band === 'released') {
          seen.released++;
        }
      }),
      { numRuns: 400 },
    );
    expect(seen.stuck).toBeGreaterThan(20);
    expect(seen.released).toBeGreaterThan(20);
    expect([...perKind].sort()).toEqual(['axis', 'bar-edge', 'polyline', 'segment']);
  });

  it('example: 22 px from a segment sticks, 26 px does not (sticky radius 24)', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.1, y: 0.5 },
        { id: 'B', x: 0.9, y: 0.5 },
      ],
      segments: [{ id: 'AB', a: 'A', b: 'B' }],
      polylines: [],
      bars: [],
    };
    const view = makeViewport(400, 400);
    const held: Target = { kind: 'line', id: 'AB', elementKind: 'segment' };
    expect(followTarget(held, 200, scene, { x: 200, y: 222 }, view, DEFAULT_RADII, 24)).toEqual(held);
    expect(followTarget(held, 200, scene, { x: 200, y: 226 }, view, DEFAULT_RADII, 24)).toEqual({ kind: 'none' });
    expect(followTarget(held, 199, scene, { x: 200, y: 222 }, view, DEFAULT_RADII, 24)).toEqual({ kind: 'none' });
    // Acquisition still needs 14 px: with no held line, 22 px is nothing.
    expect(followTarget({ kind: 'none' }, 9999, scene, { x: 200, y: 222 }, view, DEFAULT_RADII, 24)).toEqual({ kind: 'none' });
  });
});

describe('P118 - off means identical (Requirement 33.5)', () => {
  it('a sticky radius at or below the line radius, NaN or infinite gives exactly hitTest', () => {
    fc.assert(
      fc.property(
        caseArb,
        heldOk,
        fc.oneof(
          fc.constantFrom(NaN, Infinity, -Infinity, 0, -5),
          fc.double({ min: -100, max: 14, noNaN: true }),
        ),
        (c, heldMs, s) => {
          const held = heldOf(c);
          const finger = aim(pieces(c.scene, c.view, held), c.view, c.u);
          const radii: Radii = { vertex: c.radii.vertex, line: Math.max(14, c.radii.line) };
          const sOff = Number.isFinite(s) ? Math.min(s, radii.line) : s;
          expect(followTarget(held, heldMs, c.scene, finger, c.view, radii, sOff)).toEqual(hitTest(c.scene, finger, c.view, radii));
          // Exactly the line radius is off too.
          expect(followTarget(held, heldMs, c.scene, finger, c.view, radii, radii.line)).toEqual(hitTest(c.scene, finger, c.view, radii));
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('P119 - total, and only two answers (Requirement 33.6)', () => {
  const weird = fc.oneof(
    unit,
    fc.constantFrom(NaN, Infinity, -Infinity, -3, 7, 1e308, -1e308, 0),
    fc.double({ noNaN: false }),
  );
  const idArb = fc.constantFrom('a', 'b', 'a', '__proto__', 'x-axis', 'y-axis', 'constructor', '');
  const junkScene: fc.Arbitrary<DiagramScene> = fc
    .record({
      pts: fc.array(fc.record({ id: idArb, x: weird, y: weird }), { maxLength: 4 }),
      segs: fc.array(fc.record({ id: idArb, a: idArb, b: idArb }), { maxLength: 4 }),
      polys: fc.array(fc.record({ id: idArb, points: fc.array(fc.tuple(weird, weird), { maxLength: 4 }) }), { maxLength: 3 }),
      bars: fc.array(fc.record({ id: idArb, x0: weird, x1: weird, y_top: weird, y_base: weird, value: weird }), { maxLength: 3 }),
      axes: fc.oneof(fc.constant(null), fc.constant(undefined), fc.record({ x_axis_y: fc.option(weird), y_axis_x: fc.option(weird) })),
      drop: fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
    })
    .map((g) => {
      const scene: Record<string, unknown> = { version: 1, kind: 'unknown' };
      if (!g.drop[0]) scene.points = g.pts.map((p) => ({ ...p, label: null }));
      if (!g.drop[1]) scene.segments = g.segs.map((s) => ({ ...s, label: null }));
      if (!g.drop[2]) scene.polylines = g.polys.map((p) => ({ ...p, label: null }));
      if (!g.drop[3]) scene.bars = g.bars.map((b) => ({ ...b, label: 'L' }));
      if (g.axes !== undefined) scene.axes = g.axes;
      return scene as unknown as DiagramScene;
    });
  const junkView: fc.Arbitrary<Viewport> = fc.oneof(
    viewArb,
    fc.constantFrom<Viewport>(
      { canvasWidth: NaN, canvasHeight: NaN, scale: NaN, offsetX: NaN, offsetY: NaN },
      { canvasWidth: 0, canvasHeight: 0, scale: 0, offsetX: 0, offsetY: 0 },
      { canvasWidth: 100, canvasHeight: 100, scale: -5, offsetX: 0, offsetY: 0 },
      { canvasWidth: 100, canvasHeight: 100, scale: Infinity, offsetX: 0, offsetY: 0 },
    ),
  );
  const junkPrev: fc.Arbitrary<Target> = fc.oneof(
    fc.constantFrom<Target>({ kind: 'none' }, { kind: 'vertex', id: 'a' }),
    fc.record({ id: idArb, elementKind: fc.constantFrom('segment', 'polyline', 'axis', 'bar-edge', 'nonsense', '') }).map(
      (r) => ({ kind: 'line', ...r }) as unknown as Target,
    ),
    fc.constant({ kind: 'line' } as unknown as Target),
    fc.constant({ kind: 'mystery', id: 'a' } as unknown as Target),
  );

  it('never throws, never mutates, and answers with hitTest or the held line only', () => {
    fc.assert(
      fc.property(
        junkScene,
        junkView,
        junkPrev,
        fc.oneof(heldOk, fc.constantFrom(NaN, Infinity, 0, 200)),
        fc.tuple(weird, weird),
        fc.oneof(fc.constantFrom(NaN, Infinity, -Infinity, 24, 1e308, 15), fc.double({ min: -10, max: 80, noNaN: true })),
        radiiArb,
        (scene, view, prev, heldMs, [fx, fy], s, radii) => {
          const before = structuredClone({ scene, view, prev });
          const finger = { x: fx, y: fy };
          const base = hitTest(scene, finger, view, radii);
          const out = followTarget(prev, heldMs, scene, finger, view, radii, s);
          expect({ scene, view, prev }).toEqual(before);
          if (JSON.stringify(out) === JSON.stringify(base)) return;
          const p = prev as LineTarget;
          expect(prev.kind).toBe('line');
          expect(out).toEqual({ kind: 'line', id: p.id, elementKind: p.elementKind });
          expect(base.kind === 'none' || base.kind === 'bar').toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('a __proto__ id and a dangling segment are fine', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [{ id: '__proto__', x: 0.1, y: 0.5 }],
      segments: [{ id: '__proto__', a: '__proto__', b: 'missing' }],
      polylines: [],
      bars: [],
    };
    const view = makeViewport(400, 400);
    const held: Target = { kind: 'line', id: '__proto__', elementKind: 'segment' };
    expect(() => followTarget(held, 500, scene, { x: 100, y: 300 }, view, DEFAULT_RADII, 24)).not.toThrow();
  });
});
