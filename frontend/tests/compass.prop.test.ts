/**
 * P88-P95: compass helpers (Requirement 26, task 43). Written by Kiro.
 *
 * Oracles are built independently of `core/compass.ts`: directions are checked against an
 * `atan2` sector table, distances against a brute-force minimum over pieces assembled in this
 * file and measured with `distToSegmentXY` from `geometry.ts`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  directionOf,
  lineEnds,
  nearestElement,
  vertexExits,
  type Compass8,
} from '../src/core/compass';
import { distToSegmentXY, makeViewport, type ScreenPoint, type Viewport } from '../src/core/geometry';
import { DEFAULT_RADII, hitTest } from '../src/core/hitTest';
import type { DiagramScene } from '../src/core/scene';

/** A scene whose element arrays are all present (the generated type makes them optional). */
type FullScene = DiagramScene & Required<Pick<DiagramScene, 'points' | 'segments' | 'polylines' | 'bars'>>;

const RUNS = { numRuns: 250 };

const OPPOSITE: Record<Compass8, Compass8> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
  'up-left': 'down-right',
  'down-right': 'up-left',
  'up-right': 'down-left',
  'down-left': 'up-right',
};
const WORDS = Object.keys(OPPOSITE) as Compass8[];

/** Independent oracle: sectors of 45 degrees centred on the compass directions, y down. */
const SECTOR_NAMES: Record<number, Compass8> = {
  0: 'right',
  1: 'down-right',
  2: 'down',
  3: 'down-left',
  4: 'left',
  '-4': 'left',
  '-3': 'up-left',
  '-2': 'up',
  '-1': 'up-right',
};
function atan2Direction(dx: number, dy: number): Compass8 | 'boundary' {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const off = Math.abs(((deg + 22.5) % 45) + 45) % 45; // distance past the last boundary
  if (off < 0.001 || 45 - off < 0.001) return 'boundary';
  return SECTOR_NAMES[Math.round(deg / 45)]!;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const labelArb = fc.constantFrom<string | null | undefined>('A', 'B', ' C ', '', '  ', null, undefined);
const gridArb = fc.integer({ min: -20, max: 20 });

interface GridScene {
  scene: FullScene;
  /** Integer coordinates, so scale and translation by powers of two stay exact. */
  raw: [number, number][];
}

/** Points on distinct integer grid cells; segments between any indices (self-loops, repeats, dangling). */
const gridSceneArb: fc.Arbitrary<GridScene> = fc
  .record({
    cells: fc.uniqueArray(fc.tuple(gridArb, gridArb), { minLength: 2, maxLength: 8, selector: (c) => `${c[0]},${c[1]}` }),
    labels: fc.array(labelArb, { minLength: 8, maxLength: 8 }),
    segs: fc.array(fc.tuple(fc.nat(9), fc.nat(9)), { maxLength: 14 }),
  })
  .map(({ cells, labels, segs }) => ({
    raw: cells,
    scene: buildScene(cells, labels, segs, 1, 0, 0),
  }));

function buildScene(
  cells: [number, number][],
  labels: (string | null | undefined)[],
  segs: [number, number][],
  scale: number,
  tx: number,
  ty: number,
): FullScene {
  return {
    version: 1,
    kind: 'geometry',
    points: cells.map(([x, y], i) => ({ id: `p${i}`, x: x * scale + tx, y: y * scale + ty, label: labels[i] ?? null })),
    // Indices 8 and 9 never exist (at most 8 points), so those segments dangle.
    segments: segs.map(([a, b], i) => ({ id: `s${i}`, a: `p${a}`, b: `p${b}`, label: null })),
    polylines: [],
    bars: [],
    axes: null,
    facts: [],
  } as FullScene;
}

// ---------------------------------------------------------------------------
// P89, direction
// ---------------------------------------------------------------------------

describe('P89 direction is antisymmetric and means what it says', () => {
  const coord = fc.double({ min: -1000, max: 1000, noNaN: true });

  it('the word from a to b is the opposite of the word from b to a', () => {
    fc.assert(
      fc.property(coord, coord, coord, coord, (ax, ay, bx, by) => {
        const ab = directionOf({ x: ax, y: ay }, { x: bx, y: by });
        const ba = directionOf({ x: bx, y: by }, { x: ax, y: ay });
        if (ab === null) expect(ba).toBeNull();
        else expect(ba).toBe(OPPOSITE[ab]);
      }),
      RUNS,
    );
  });

  it('is null exactly when the points coincide', () => {
    fc.assert(
      fc.property(coord, coord, coord, coord, (ax, ay, bx, by) => {
        const d = directionOf({ x: ax, y: ay }, { x: bx, y: by });
        expect(d === null).toBe(ax === bx && ay === by);
        expect(directionOf({ x: ax, y: ay }, { x: ax, y: ay })).toBeNull();
      }),
      RUNS,
    );
  });

  it('agrees with an atan2 sector oracle away from sector boundaries', () => {
    fc.assert(
      fc.property(fc.integer({ min: -500, max: 500 }), fc.integer({ min: -500, max: 500 }), (dx, dy) => {
        fc.pre(dx !== 0 || dy !== 0);
        const expected = atan2Direction(dx, dy);
        fc.pre(expected !== 'boundary');
        expect(directionOf({ x: 0, y: 0 }, { x: dx, y: dy })).toBe(expected);
      }),
      { numRuns: 1000 },
    );
  });

  it('names the four compass points (y = 0 is the top)', () => {
    const o = { x: 0.5, y: 0.5 };
    expect(directionOf(o, { x: 0.5, y: 0.1 })).toBe('up');
    expect(directionOf(o, { x: 0.5, y: 0.9 })).toBe('down');
    expect(directionOf(o, { x: 0.1, y: 0.5 })).toBe('left');
    expect(directionOf(o, { x: 0.9, y: 0.5 })).toBe('right');
    expect(directionOf(o, { x: 0.9, y: 0.1 })).toBe('up-right');
    expect(directionOf(o, { x: 0.1, y: 0.9 })).toBe('down-left');
  });

  it('is null for NaN and infinite coordinates', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(directionOf({ x: bad, y: 0 }, { x: 1, y: 1 })).toBeNull();
      expect(directionOf({ x: 0, y: 0 }, { x: 1, y: bad })).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// P88, exits
// ---------------------------------------------------------------------------

describe('P88 exits are complete and exact', () => {
  it('one entry per segment joining the point to a different existing point, in order', () => {
    fc.assert(
      fc.property(gridSceneArb, ({ scene }) => {
        for (const p of scene.points) {
          const expected = scene.segments.flatMap((s) => {
            const touchesA = s.a === p.id;
            const touchesB = s.b === p.id;
            if (touchesA === touchesB) return []; // not touching, or a self-loop
            const otherId = touchesA ? s.b : s.a;
            const other = scene.points.find((q) => q.id === otherId);
            if (other === undefined) return []; // dangling
            const dir = atan2Direction(other.x - p.x, other.y - p.y);
            return [{ s, other, dir }];
          });
          const exits = vertexExits(scene, p.id);
          expect(exits.map((e) => e.segmentId)).toEqual(expected.map((e) => e.s.id));
          expect(exits.map((e) => e.toId)).toEqual(expected.map((e) => e.other.id));
          exits.forEach((e, i) => {
            const want = expected[i]!;
            expect(e.toId).not.toBe(p.id);
            expect(e.dir).toBe(directionOf(p, want.other));
            if (want.dir !== 'boundary') expect(e.dir).toBe(want.dir);
            const label = (want.other.label ?? '').trim();
            if (label === '') expect('toLabel' in e).toBe(false);
            else expect(e.toLabel).toBe(label);
          });
        }
      }),
      RUNS,
    );
  });

  it('gives [] for an unknown id, and skips coincident points', () => {
    fc.assert(
      fc.property(gridSceneArb, ({ scene }) => {
        expect(vertexExits(scene, 'nope')).toEqual([]);
      }),
      RUNS,
    );
    const scene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.2, y: 0.2, label: 'A' },
        { id: 'B', x: 0.2, y: 0.2, label: 'B' },
        { id: 'C', x: 0.8, y: 0.2, label: 'C' },
      ],
      segments: [
        { id: 'AB', a: 'A', b: 'B', label: null },
        { id: 'AC', a: 'A', b: 'C', label: null },
        { id: 'AA', a: 'A', b: 'A', label: null },
      ],
      polylines: [],
      bars: [],
      axes: null,
      facts: [],
    } as DiagramScene;
    expect(vertexExits(scene, 'A')).toEqual([{ segmentId: 'AC', toId: 'C', toLabel: 'C', dir: 'right' }]);
  });
});

// ---------------------------------------------------------------------------
// P90, scale and translation
// ---------------------------------------------------------------------------

describe('P90 direction is invariant under uniform scale and translation', () => {
  const scaleArb = fc.constantFrom(0.25, 0.5, 1, 2, 4, 8);
  it('directionOf, vertexExits and lineEnds do not change', () => {
    fc.assert(
      fc.property(
        gridSceneArb,
        scaleArb,
        fc.integer({ min: -50, max: 50 }),
        fc.integer({ min: -50, max: 50 }),
        ({ raw, scene }, scale, tx, ty) => {
          const moved = buildScene(
            raw,
            scene.points.map((p) => p.label),
            scene.segments.map((s) => [Number(s.a.slice(1)), Number(s.b.slice(1))] as [number, number]),
            scale,
            tx,
            ty,
          );
          for (const p of scene.points) {
            expect(vertexExits(moved, p.id)).toEqual(vertexExits(scene, p.id));
          }
          for (const s of scene.segments) {
            expect(lineEnds(moved, s.id)).toEqual(lineEnds(scene, s.id));
          }
          const [p0, p1] = [raw[0]!, raw[1]!];
          expect(
            directionOf({ x: p0[0] * scale + tx, y: p0[1] * scale + ty }, { x: p1[0] * scale + tx, y: p1[1] * scale + ty }),
          ).toBe(directionOf({ x: p0[0], y: p0[1] }, { x: p1[0], y: p1[1] }));
        },
      ),
      RUNS,
    );
  });
});

// ---------------------------------------------------------------------------
// P91, line ends
// ---------------------------------------------------------------------------

describe('P91 line ends are the segment\'s own', () => {
  it('returns the endpoints and two opposite words, or null', () => {
    fc.assert(
      fc.property(gridSceneArb, ({ scene }) => {
        for (const s of scene.segments) {
          const a = scene.points.find((p) => p.id === s.a);
          const b = scene.points.find((p) => p.id === s.b);
          const ends = lineEnds(scene, s.id);
          if (a === undefined || b === undefined || (a.x === b.x && a.y === b.y)) {
            expect(ends).toBeNull();
            continue;
          }
          expect(ends).not.toBeNull();
          expect(ends!.aId).toBe(s.a);
          expect(ends!.bId).toBe(s.b);
          expect(ends!.dirToA).toBe(directionOf(b, a));
          expect(ends!.dirToB).toBe(directionOf(a, b));
          expect(ends!.dirToA).toBe(OPPOSITE[ends!.dirToB]);
        }
      }),
      RUNS,
    );
  });

  it('is null for points, curves, axes, bars and unknown ids', () => {
    const scene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.1, y: 0.1, label: 'A' },
        { id: 'B', x: 0.9, y: 0.9, label: 'B' },
      ],
      segments: [{ id: 'AB', a: 'A', b: 'B', label: null }],
      polylines: [{ id: 'curve', points: [[0, 0], [1, 1]], label: null }],
      bars: [{ id: 'bar', label: 'Q', value: 1, x0: 0.1, x1: 0.2, y_top: 0.1, y_base: 0.5 }],
      axes: { x_axis_y: 0.5, y_axis_x: 0.5 },
      facts: [],
    } as DiagramScene;
    for (const id of ['A', 'curve', 'bar', 'x-axis', 'y-axis', 'nope', '']) {
      expect(lineEnds(scene, id)).toBeNull();
    }
    expect(lineEnds(scene, 'AB')).toEqual({ aId: 'A', bId: 'B', dirToA: 'up-left', dirToB: 'down-right' });
  });
});

// ---------------------------------------------------------------------------
// Scenes in screen space for P92-P94
// ---------------------------------------------------------------------------

const unit = fc.double({ min: -0.2, max: 1.2, noNaN: true });
const viewArb: fc.Arbitrary<Viewport> = fc
  .tuple(fc.integer({ min: 40, max: 1000 }), fc.integer({ min: 40, max: 1000 }))
  .map(([w, h]) => makeViewport(w, h));

const drawnSceneArb: fc.Arbitrary<FullScene> = fc
  .record({
    pts: fc.array(fc.tuple(unit, unit), { maxLength: 6 }),
    segs: fc.array(fc.tuple(fc.nat(8), fc.nat(8)), { maxLength: 6 }),
    lines: fc.array(fc.array(fc.tuple(unit, unit), { maxLength: 8 }), { maxLength: 2 }),
    bars: fc.array(fc.tuple(unit, unit, unit, unit), { maxLength: 3 }),
    xAxis: fc.option(unit, { nil: null }),
    yAxis: fc.option(unit, { nil: null }),
  })
  .map(
    (g): FullScene =>
      ({
        version: 1,
        kind: 'geometry',
        points: g.pts.map(([x, y], i) => ({ id: `p${i}`, x, y, label: null })),
        segments: g.segs.map(([a, b], i) => ({ id: `s${i}`, a: `p${a}`, b: `p${b}`, label: null })),
        polylines: g.lines.map((pts, i) => ({ id: `pl${i}`, points: pts, label: null })),
        bars: g.bars.map(([x0, x1, yt, yb], i) => ({ id: `b${i}`, label: `bar${i}`, value: i + 1, x0, x1, y_top: yt, y_base: yb })),
        axes: { x_axis_y: g.xAxis, y_axis_x: g.yAxis },
        facts: [],
      }) as FullScene,
  );

interface Piece {
  id: string;
  kind: 'vertex' | 'segment' | 'polyline' | 'axis' | 'bar-edge';
  a: ScreenPoint;
  b: ScreenPoint;
}

/** Every piece of a scene in screen space, assembled independently of compass.ts. */
function piecesOf(scene: FullScene, v: Viewport): Piece[] {
  const sp = (x: number, y: number): ScreenPoint => ({ x: v.offsetX + x * v.scale, y: v.offsetY + y * v.scale });
  const out: Piece[] = [];
  for (const p of scene.points) out.push({ id: p.id, kind: 'vertex', a: sp(p.x, p.y), b: sp(p.x, p.y) });
  for (const s of scene.segments) {
    const a = scene.points.find((p) => p.id === s.a);
    const b = scene.points.find((p) => p.id === s.b);
    if (a && b) out.push({ id: s.id, kind: 'segment', a: sp(a.x, a.y), b: sp(b.x, b.y) });
  }
  for (const pl of scene.polylines) {
    for (let i = 1; i < pl.points.length; i++) {
      const p = pl.points[i - 1]!;
      const q = pl.points[i]!;
      out.push({ id: pl.id, kind: 'polyline', a: sp(p[0], p[1]), b: sp(q[0], q[1]) });
    }
  }
  if (scene.axes?.x_axis_y != null) out.push({ id: 'x-axis', kind: 'axis', a: sp(0, scene.axes.x_axis_y), b: sp(1, scene.axes.x_axis_y) });
  if (scene.axes?.y_axis_x != null) out.push({ id: 'y-axis', kind: 'axis', a: sp(scene.axes.y_axis_x, 0), b: sp(scene.axes.y_axis_x, 1) });
  for (const b of scene.bars) {
    const l = sp(b.x0, b.y_top);
    const r = sp(b.x1, b.y_base);
    const tl = { x: l.x, y: l.y };
    const tr = { x: r.x, y: l.y };
    const bl = { x: l.x, y: r.y };
    const br = { x: r.x, y: r.y };
    out.push({ id: b.id, kind: 'bar-edge', a: tl, b: tr }, { id: b.id, kind: 'bar-edge', a: bl, b: br });
    out.push({ id: b.id, kind: 'bar-edge', a: tl, b: bl }, { id: b.id, kind: 'bar-edge', a: tr, b: br });
  }
  return out;
}

const dist = (f: ScreenPoint, p: Piece): number => distToSegmentXY(f.x, f.y, p.a.x, p.a.y, p.b.x, p.b.y);

/** Brute-force minimum distance and the pieces of the given id and kind. */
function minDist(pieces: Piece[], f: ScreenPoint): number {
  let best = Infinity;
  for (const p of pieces) best = Math.min(best, dist(f, p));
  return best;
}

/** A finger: anywhere on the canvas, or near a random piece (so the radius band is exercised). */
function fingerFor(pieces: Piece[], v: Viewport, u: number, w: number, pick: number, off: [number, number]): ScreenPoint {
  if (pieces.length > 0 && u < 0.6) {
    const p = pieces[pick % pieces.length]!;
    return { x: p.a.x + (p.b.x - p.a.x) * w + off[0], y: p.a.y + (p.b.y - p.a.y) * w + off[1] };
  }
  return { x: u * v.canvasWidth, y: w * v.canvasHeight };
}

const fingerArgs = [
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.nat(1000),
  fc.tuple(fc.double({ min: -30, max: 30, noNaN: true }), fc.double({ min: -30, max: 30, noNaN: true })),
] as const;

// ---------------------------------------------------------------------------
// P92, P93
// ---------------------------------------------------------------------------

describe('P92 nearest is truly nearest', () => {
  it('matches the brute-force minimum, names an element at that distance, and the vector is exact', () => {
    fc.assert(
      fc.property(drawnSceneArb, viewArb, ...fingerArgs, (scene, view, u, w, pick, off) => {
        const pieces = piecesOf(scene, view);
        const f = fingerFor(pieces, view, u, w, pick, off);
        const got = nearestElement(scene, f, view);
        const min = minDist(pieces, f);
        if (!Number.isFinite(min)) {
          // Nothing measurable (no pieces, or only non-finite ones).
          if (pieces.length === 0) expect(got).toBeNull();
          return;
        }
        expect(got).not.toBeNull();
        const tol = 1e-9 * (1 + min);
        expect(Math.abs(got!.distPx - min)).toBeLessThanOrEqual(tol);
        expect(got!.distPx).toBe(Math.hypot(got!.dxPx, got!.dyPx));
        // The named element really is at that distance...
        const own = pieces.filter((p) => p.id === got!.id && p.kind === got!.elementKind);
        expect(own.length).toBeGreaterThan(0);
        expect(Math.abs(minDist(own, f) - got!.distPx)).toBeLessThanOrEqual(tol);
        // ...and finger + vector lies on it.
        const hit = { x: f.x + got!.dxPx, y: f.y + got!.dyPx };
        expect(minDist(own, hit)).toBeLessThanOrEqual(1e-6 * (1 + min) + 1e-6);
      }),
      RUNS,
    );
  });
});

describe('P92 (task 53) the last piece of a curve and every bar edge are measured', () => {
  const baseScene = (over: Partial<FullScene>): FullScene =>
    ({ version: 1, kind: 'geometry', points: [], segments: [], polylines: [], bars: [], axes: null, facts: [], ...over }) as FullScene;

  it('a finger beside the middle of the LAST piece of a polyline gets that distance', () => {
    const view = makeViewport(400, 400);
    fc.assert(
      fc.property(
        // Points stay well apart so the last piece is long and its middle is far from other pieces.
        fc.array(fc.tuple(fc.double({ min: 0.05, max: 0.95, noNaN: true }), fc.double({ min: 0.05, max: 0.95, noNaN: true })), {
          minLength: 2,
          maxLength: 6,
        }),
        fc.double({ min: 0.5, max: 8, noNaN: true }),
        fc.constantFrom(-1, 1),
        (pts, off, side) => {
          const scene = baseScene({ polylines: [{ id: 'pl', points: pts, label: null }] as FullScene['polylines'] });
          const pieces = piecesOf(scene, view);
          const last = pieces[pieces.length - 1]!;
          const len = Math.hypot(last.b.x - last.a.x, last.b.y - last.a.y);
          fc.pre(len > 20);
          const mx = (last.a.x + last.b.x) / 2;
          const my = (last.a.y + last.b.y) / 2;
          const nx = (-(last.b.y - last.a.y) / len) * side * off;
          const ny = ((last.b.x - last.a.x) / len) * side * off;
          const f = { x: mx + nx, y: my + ny };
          const got = nearestElement(scene, f, view);
          const min = minDist(pieces, f);
          expect(got).not.toBeNull();
          expect(Math.abs(got!.distPx - min)).toBeLessThanOrEqual(1e-9 * (1 + min));
          // The last piece is no farther than `off`, so the answer can be no farther either.
          expect(got!.distPx).toBeLessThanOrEqual(off + 1e-9);
        },
      ),
      RUNS,
    );
  });

  it('a finger just outside each of the four edges of a bar is measured to that edge', () => {
    const view = makeViewport(400, 400);
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 0.4, noNaN: true }),
        fc.double({ min: 0.6, max: 0.9, noNaN: true }),
        fc.double({ min: 0.1, max: 0.4, noNaN: true }),
        fc.double({ min: 0.6, max: 0.9, noNaN: true }),
        fc.double({ min: 0.5, max: 8, noNaN: true }),
        fc.constantFrom('top', 'bottom', 'left', 'right'),
        (x0, x1, yTop, yBase, off, edge) => {
          const scene = baseScene({
            bars: [{ id: 'b', label: 'bar', value: 1, x0, x1, y_top: yTop, y_base: yBase }] as FullScene['bars'],
          });
          const sx = (x: number): number => view.offsetX + x * view.scale;
          const sy = (y: number): number => view.offsetY + y * view.scale;
          const midX = (sx(x0) + sx(x1)) / 2;
          const midY = (sy(yTop) + sy(yBase)) / 2;
          const f =
            edge === 'top'
              ? { x: midX, y: sy(yTop) - off }
              : edge === 'bottom'
                ? { x: midX, y: sy(yBase) + off }
                : edge === 'left'
                  ? { x: sx(x0) - off, y: midY }
                  : { x: sx(x1) + off, y: midY };
          const got = nearestElement(scene, f, view);
          expect(got).not.toBeNull();
          expect(got!.elementKind).toBe('bar-edge');
          expect(got!.id).toBe('b');
          expect(Math.abs(got!.distPx - off)).toBeLessThanOrEqual(1e-9 * (1 + off));
        },
      ),
      RUNS,
    );
  });
});

describe('task 53 tie and duplicate-id rules (examples)', () => {
  const view = makeViewport(100, 100);
  const mk = (over: Partial<FullScene>): FullScene =>
    ({ version: 1, kind: 'geometry', points: [], segments: [], polylines: [], bars: [], axes: null, facts: [], ...over }) as FullScene;

  it('the first point with an id wins (vertexExits)', () => {
    const scene = mk({
      points: [
        { id: 'A', x: 0.5, y: 0.5, label: null },
        { id: 'A', x: 0.9, y: 0.9, label: null },
        { id: 'B', x: 0.5, y: 0.1, label: null },
      ],
      segments: [{ id: 's', a: 'A', b: 'B', label: null }],
    } as Partial<FullScene>);
    // From the first A (0.5, 0.5) the way to B (0.5, 0.1) is up; from the second A it would be up-left.
    expect(vertexExits(scene, 'A')).toEqual([{ segmentId: 's', toId: 'B', dir: 'up' }]);
    expect(lineEnds(scene, 's')).toEqual({ aId: 'A', bId: 'B', dirToA: 'down', dirToB: 'up' });
  });

  it('the first candidate wins a tie, in the order vertex, segment, polyline, axis, bar', () => {
    // A vertex at (50, 50) and a segment through it, a curve through it and the x-axis through it:
    // all are at distance 0 from the finger, so the vertex must be named.
    const scene = mk({
      kind: 'function_graph',
      points: [
        { id: 'A', x: 0.5, y: 0.5, label: null },
        { id: 'B', x: 0.9, y: 0.5, label: null },
      ],
      segments: [{ id: 's', a: 'A', b: 'B', label: null }],
      polylines: [{ id: 'pl', points: [[0.1, 0.5], [0.9, 0.5]], label: null }],
      axes: { x_axis_y: 0.5, y_axis_x: null },
    } as Partial<FullScene>);
    expect(nearestElement(scene, { x: 50, y: 50 }, view)).toMatchObject({ id: 'A', elementKind: 'vertex', distPx: 0 });
    // Without the vertex, a finger on the segment/curve/axis ties at 0 and the segment comes first.
    const noPoint = { ...scene, points: [scene.points![1]!, { id: 'C', x: 0.2, y: 0.9, label: null }] } as FullScene;
    const tie = nearestElement({ ...noPoint, segments: [{ id: 's', a: 'B', b: 'C', label: null }] } as FullScene, { x: 70, y: 50 }, view);
    expect(tie).not.toBeNull();
    // Segment B-C passes through (90, 50) only at B; the finger at (70, 50) is on the curve and axis, curve first.
    expect(tie).toMatchObject({ id: 'pl', elementKind: 'polyline', distPx: 0 });
  });
});


describe('P93 null exactly when nothing is within the maximum', () => {
  it('compares the brute-force minimum with maxDistPx', () => {
    fc.assert(
      fc.property(
        drawnSceneArb,
        viewArb,
        ...fingerArgs,
        fc.double({ min: 0, max: 400, noNaN: true }),
        (scene, view, u, w, pick, off, max) => {
          const pieces = piecesOf(scene, view);
          const f = fingerFor(pieces, view, u, w, pick, off);
          const min = minDist(pieces, f);
          const free = nearestElement(scene, f, view);
          const capped = nearestElement(scene, f, view, max);
          if (Number.isFinite(min) && Math.abs(min - max) > 1e-9 * (1 + max)) {
            expect(capped === null).toBe(min > max);
          }
          if (capped !== null) expect(capped).toEqual(free);
          // Without a maximum: null only when nothing is drawable.
          if (pieces.length === 0) expect(free).toBeNull();
          else if (Number.isFinite(min)) expect(free).not.toBeNull();
        },
      ),
      RUNS,
    );
  });

  it('counts a distance equal to the maximum as within', () => {
    const scene = {
      version: 1,
      kind: 'geometry',
      points: [{ id: 'A', x: 0, y: 0, label: null }],
      segments: [],
      polylines: [],
      bars: [],
      axes: null,
      facts: [],
    } as DiagramScene;
    const view = makeViewport(100, 100);
    expect(nearestElement(scene, { x: 3, y: 4 }, view, 5)).toMatchObject({ id: 'A', distPx: 5, dxPx: -3, dyPx: -4 });
    expect(nearestElement(scene, { x: 3, y: 4 }, view, 4.999)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// P94, agreement with hitTest
// ---------------------------------------------------------------------------

describe('P94 agrees with hitTest', () => {
  it('a vertex or line hit is within its radius; a bar hit gives a result', () => {
    fc.assert(
      fc.property(drawnSceneArb, viewArb, ...fingerArgs, (scene, view, u, w, pick, off) => {
        const pieces = piecesOf(scene, view);
        const f = fingerFor(pieces, view, u, w, pick, off);
        const hit = hitTest(scene, f, view, DEFAULT_RADII);
        const near = nearestElement(scene, f, view);
        if (hit.kind === 'line') {
          expect(near).not.toBeNull();
          expect(near!.distPx).toBeLessThanOrEqual(DEFAULT_RADII.line + 1e-9);
        } else if (hit.kind === 'vertex') {
          expect(near).not.toBeNull();
          expect(near!.distPx).toBeLessThanOrEqual(DEFAULT_RADII.vertex + 1e-9);
        } else if (hit.kind === 'bar') {
          expect(near).not.toBeNull();
        }
      }),
      RUNS,
    );
  });
});

// ---------------------------------------------------------------------------
// P95, bad input
// ---------------------------------------------------------------------------

describe('P95 total on bad input', () => {
  const nasty = fc.oneof(
    fc.double({ noNaN: false }),
    fc.constantFrom(Number.NaN, Infinity, -Infinity, 0, -0, 1e308, -1e308),
  );
  const idArb = fc.constantFrom('A', 'B', '__proto__', 'constructor', 'x-axis', '', 'p0', 'nope');

  const badSceneArb = fc
    .record({
      pts: fc.array(fc.record({ id: idArb, x: nasty, y: nasty, label: fc.option(fc.string(), { nil: null }) }), { maxLength: 6 }),
      segs: fc.array(fc.record({ id: idArb, a: idArb, b: idArb }), { maxLength: 6 }),
      lines: fc.array(fc.array(fc.tuple(nasty, nasty), { maxLength: 5 }), { maxLength: 2 }),
      bars: fc.array(fc.record({ x0: nasty, x1: nasty, yt: nasty, yb: nasty, value: nasty }), { maxLength: 2 }),
      xAxis: fc.option(nasty, { nil: null }),
      yAxis: fc.option(nasty, { nil: null }),
      drop: fc.constantFrom('none', 'points', 'segments', 'polylines', 'bars', 'axes'),
    })
    .map((g) => {
      const scene: Record<string, unknown> = {
        version: 1,
        kind: 'geometry',
        points: g.pts.map((p) => ({ ...p })),
        segments: g.segs.map((s) => ({ ...s, label: null })),
        polylines: g.lines.map((pts, i) => ({ id: `pl${i}`, points: pts, label: null })),
        bars: g.bars.map((b, i) => ({ id: `b${i}`, label: 'q', value: b.value, x0: b.x0, x1: b.x1, y_top: b.yt, y_base: b.yb })),
        axes: { x_axis_y: g.xAxis, y_axis_x: g.yAxis },
        facts: [],
      };
      if (g.drop !== 'none') delete scene[g.drop];
      return scene as unknown as DiagramScene;
    });

  const viewBad: fc.Arbitrary<Viewport> = fc.oneof(
    viewArb,
    fc.record({ canvasWidth: nasty, canvasHeight: nasty, scale: nasty, offsetX: nasty, offsetY: nasty }),
    fc.constant<Viewport>({ canvasWidth: 0, canvasHeight: 0, scale: 0, offsetX: 0, offsetY: 0 }),
  );

  it('never throws, and every result is finite and well formed', () => {
    fc.assert(
      fc.property(
        badSceneArb,
        viewBad,
        nasty,
        nasty,
        fc.option(nasty, { nil: undefined }),
        idArb,
        (scene, view, fx, fy, max, id) => {
          const d = directionOf({ x: fx, y: fy }, { x: fy, y: fx });
          expect(d === null || WORDS.includes(d)).toBe(true);

          for (const e of vertexExits(scene, id)) {
            expect(WORDS).toContain(e.dir);
            expect(e.toId).not.toBe(id);
          }
          const ends = lineEnds(scene, id);
          if (ends !== null) {
            expect(WORDS).toContain(ends.dirToA);
            expect(ends.dirToA).toBe(OPPOSITE[ends.dirToB]);
          }

          const near = nearestElement(scene, { x: fx, y: fy }, view, max);
          if (near !== null) {
            for (const n of [near.distPx, near.dxPx, near.dyPx]) expect(Number.isFinite(n)).toBe(true);
            expect(near.distPx).toBe(Math.hypot(near.dxPx, near.dyPx));
            if (max !== undefined) expect(near.distPx <= max).toBe(true);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('is null for a viewport with no drawable area or a non-finite finger', () => {
    const scene = {
      version: 1,
      kind: 'geometry',
      points: [{ id: 'A', x: 0.5, y: 0.5, label: null }],
      segments: [],
      polylines: [],
      bars: [],
      axes: null,
      facts: [],
    } as DiagramScene;
    const ok = makeViewport(100, 100);
    expect(nearestElement(scene, { x: 50, y: 50 }, ok)).not.toBeNull();
    for (const scale of [0, -5, Number.NaN]) {
      expect(nearestElement(scene, { x: 50, y: 50 }, { ...ok, scale })).toBeNull();
    }
    expect(nearestElement(scene, { x: Number.NaN, y: 50 }, ok)).toBeNull();
    expect(nearestElement(scene, { x: Infinity, y: 50 }, ok)).toBeNull();
    for (const max of [Number.NaN, -1]) {
      expect(nearestElement(scene, { x: 50, y: 50 }, ok, max)).toBeNull();
    }
    expect(nearestElement({ version: 1, kind: 'unknown' } as DiagramScene, { x: 1, y: 1 }, ok)).toBeNull();
  });
});
