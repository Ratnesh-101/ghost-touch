/**
 * P171 to P180 - Ghost Hand pegboard (Requirement 52, task 86). Written by Kiro.
 *
 * Oracles are independent of `core/pegboard.ts`: the crossing grid, the sort order and the
 * brute-force pin spacing are rebuilt here from the Requirement text and `geometry.ts`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addPoint,
  COINCIDENT_EPSILON,
  createHistory,
  historyReducer,
  validateSceneInvariants,
} from '../src/core/correct';
import { makeViewport, toScreen } from '../src/core/geometry';
import {
  BUILD_WORK_KEYS,
  canFeel,
  canHandIn,
  describeWork,
  emptyDraft,
  GRID_FACT,
  gridToNorm,
  handInList,
  isDraft,
  MIN_PIN_SPACING_PX,
  pin,
  pinLabel,
  pinSpacingOk,
  pinSpacingPx,
  pinsOf,
  snapCrossing,
  snapNorm,
  stitchInOrder,
  type Crossing,
} from '../src/core/pegboard';
import type { DiagramScene } from '../src/core/scene';
import { isRenderableScene } from '../src/core/sceneGuard';
import { parseFacts, verifyScene } from '../src/core/verify';
import { templateWalk } from '../src/core/walk';
import { decodeShare, encodeShare } from '../src/share/codec';
import { validateShareScene } from '../src/share/validate';
import { runs } from './support/runs';

const ALL: Crossing[] = [];
for (let gx = 0; gx <= 6; gx++) for (let gy = 0; gy <= 8; gy++) ALL.push({ gx, gy });
const key = (c: Crossing): string => `${c.gx},${c.gy}`;

/** Apply attempts in order; return the final draft and the crossings that were accepted. */
function build(attempts: ReadonlyArray<readonly [number, number]>): { scene: DiagramScene; pinned: Crossing[] } {
  let scene = emptyDraft();
  const pinned: Crossing[] = [];
  for (const [gx, gy] of attempts) {
    const r = pin(scene, gx, gy);
    if (r.kind === 'pinned') {
      scene = r.scene;
      pinned.push(r.crossing);
    }
  }
  return { scene, pinned };
}

const attemptArb = fc.tuple(fc.integer({ min: -2, max: 8 }), fc.integer({ min: -2, max: 10 }));
const attemptsArb = fc.array(attemptArb, { maxLength: 120 });
const draftArb = attemptsArb.map((a) => build(a));
const bigNumber = fc.oneof(
  fc.double({ noNaN: true, min: -1e6, max: 1e6 }),
  fc.constantFrom(Number.MAX_VALUE, -Number.MAX_VALUE, 1e308, -1e308, 0, -0, 0.5, -0.5, 6.5, 8.5),
);

function sortedCrossings(list: Crossing[]): Crossing[] {
  return [...list].sort((a, b) => a.gx - b.gx || a.gy - b.gy);
}

function deepFreeze<T>(v: T): T {
  if (v !== null && typeof v === 'object') {
    for (const k of Object.keys(v as object)) deepFreeze((v as Record<string, unknown>)[k]);
    Object.freeze(v);
  }
  return v;
}

describe('P171 snap is idempotent and a crossing is its own snap (52.1)', () => {
  it('every crossing snaps to itself, from its own position and from its grid numbers', () => {
    expect(ALL).toHaveLength(63);
    for (const c of ALL) {
      const n = gridToNorm(c);
      expect(snapNorm(n.x, n.y)).toEqual(c);
      expect(snapCrossing(c.gx, c.gy)).toEqual(c);
      expect(n.x).toBe(c.gx / 6);
      expect(n.y).toBe(1 - c.gy / 8);
    }
  });

  it('any finite position lands on the grid, snapping again changes nothing', () => {
    fc.assert(
      fc.property(bigNumber, bigNumber, (x, y) => {
        const c = snapNorm(x, y);
        expect(c).not.toBeNull();
        if (c === null) return;
        expect(Number.isInteger(c.gx) && c.gx >= 0 && c.gx <= 6).toBe(true);
        expect(Number.isInteger(c.gy) && c.gy >= 0 && c.gy <= 8).toBe(true);
        expect(Object.is(c.gx, -0) || Object.is(c.gy, -0)).toBe(false);
        const p = gridToNorm(c);
        expect(snapNorm(p.x, p.y)).toEqual(c);
      }),
      { numRuns: runs(300) },
    );
  });

  it('inside the unit square the snapped position is at most half a cell away on each axis', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (x, y) => {
        const c = snapNorm(x, y);
        if (c === null) throw new Error('finite input gave no crossing');
        const p = gridToNorm(c);
        expect(Math.abs(p.x - x)).toBeLessThanOrEqual(0.5 / 6 + 1e-12);
        expect(Math.abs(p.y - y)).toBeLessThanOrEqual(0.5 / 8 + 1e-12);
      }),
      { numRuns: runs(300) },
    );
  });

  it('NaN and infinity give no crossing', () => {
    const bad = [Number.NaN, Infinity, -Infinity];
    for (const a of bad) {
      expect(snapNorm(a, 0.5)).toBeNull();
      expect(snapNorm(0.5, a)).toBeNull();
      expect(snapCrossing(a, 1)).toBeNull();
      expect(snapCrossing(1, a)).toBeNull();
    }
  });
});

describe('P172 a pin is exactly on its crossing and is never nudged (52.4, 52.5)', () => {
  it('pinned exactly when the input is finite and the crossing is free; occupied returns the same object', () => {
    fc.assert(
      fc.property(draftArb, bigNumber, bigNumber, ({ scene, pinned }, gx, gy) => {
        const frozen = JSON.stringify(scene);
        const cx = Math.min(6, Math.max(0, Math.round(gx))) + 0;
        const cy = Math.min(8, Math.max(0, Math.round(gy))) + 0;
        const taken = pinned.some((c) => c.gx === cx && c.gy === cy);
        const r = pin(scene, gx, gy);
        expect(JSON.stringify(scene)).toBe(frozen);
        if (taken) {
          expect(r.kind).toBe('occupied');
          expect(r.scene).toBe(scene);
          const there = scene.points?.find((p) => p.x === cx / 6 && p.y === 1 - cy / 8);
          expect(r.kind === 'occupied' ? r.id : '').toBe(there?.id);
          return;
        }
        expect(r.kind).toBe('pinned');
        if (r.kind !== 'pinned') return;
        expect(r.scene.points).toHaveLength((scene.points?.length ?? 0) + 1);
        const added = r.scene.points?.at(-1);
        expect(added?.x).toBe(cx / 6);
        expect(added?.y).toBe(1 - cy / 8);
        expect(added?.label).toBe(`x ${cx} y ${cy}`);
        expect(added?.id).toBe(r.id);
        expect(r.label).toBe(`x ${cx} y ${cy}`);
        expect(r.crossing).toEqual({ gx: cx, gy: cy });
        expect(r.scene.points?.slice(0, -1)).toEqual(scene.points);
        expect(r.scene.segments).toEqual(scene.segments);
        expect(r.scene.axes).toEqual(scene.axes);
        expect(r.scene.facts).toEqual(scene.facts);
      }),
      { numRuns: runs(300) },
    );
  });

  it('non-finite input is badInput and returns the same object', () => {
    const scene = emptyDraft();
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      for (const r of [pin(scene, bad, 1), pin(scene, 1, bad)]) {
        expect(r.kind).toBe('badInput');
        expect(r.scene).toBe(scene);
      }
    }
  });

  it('a point within COINCIDENT_EPSILON of the crossing still makes it occupied (addPoint would have nudged)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL),
        fc.double({ min: -0.9, max: 0.9, noNaN: true }),
        fc.double({ min: -0.9, max: 0.9, noNaN: true }),
        (c, fx, fy) => {
          const at = gridToNorm(c);
          const near = { id: 'Q1', x: at.x + fx * COINCIDENT_EPSILON, y: at.y + fy * COINCIDENT_EPSILON };
          const base: DiagramScene = { ...emptyDraft(), points: [near] };
          const r = pin(base, c.gx, c.gy);
          expect(r.kind).toBe('occupied');
          expect(r.scene).toBe(base);
          expect(r.kind === 'occupied' ? r.id : '').toBe('Q1');
          // control: addPoint on that spot does nudge, which is why `pin` must refuse first
          const nudged = addPoint(base, at.x, at.y, 'x');
          expect(nudged.points?.at(-1)?.x === at.x && nudged.points?.at(-1)?.y === at.y).toBe(false);
        },
      ),
      { numRuns: runs(200) },
    );
  });
});

describe('P173 any pin sequence stays on the grid (52.4)', () => {
  it('points are on crossings, unique, labelled by position, ids unique, at most 63', () => {
    fc.assert(
      fc.property(draftArb, ({ scene, pinned }) => {
        const pts = scene.points ?? [];
        expect(pts.length).toBe(pinned.length);
        expect(pts.length).toBeLessThanOrEqual(63);
        expect(new Set(pinned.map(key)).size).toBe(pinned.length);
        const ids = new Set<string>();
        for (const p of pts) {
          const c = snapNorm(p.x, p.y);
          expect(c).not.toBeNull();
          if (c === null) continue;
          expect(gridToNorm(c)).toEqual({ x: p.x, y: p.y });
          expect(p.label).toBe(`x ${c.gx} y ${c.gy}`);
          ids.add(p.id);
        }
        expect(ids.size).toBe(pts.length);
        for (const id of ids) expect(id.toLowerCase()).not.toBe('title');
        expect(validateSceneInvariants(scene).ok).toBe(true);
      }),
      { numRuns: runs(200) },
    );
  });

  it('attempting all 63 crossings in any order fills all 63', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(ALL, { minLength: 63, maxLength: 63 }), (order) => {
        const { scene, pinned } = build(order.map((c) => [c.gx, c.gy] as const));
        expect(pinned).toHaveLength(63);
        expect(scene.points).toHaveLength(63);
        expect(sortedCrossings(pinned).map(key)).toEqual(ALL.map(key));
        expect(validateSceneInvariants(scene).ok).toBe(true);
      }),
      { numRuns: runs(200) },
    );
  });
});

describe('P174 stitch is the neighbour chain, segments only (52.7)', () => {
  function expectedChain(pinned: Crossing[], scene: DiagramScene): Array<[string, string]> {
    const idAt = new Map<string, string>();
    for (const p of scene.points ?? []) {
      const c = snapNorm(p.x, p.y);
      if (c) idAt.set(key(c), p.id);
    }
    const sorted = sortedCrossings(pinned);
    const out: Array<[string, string]> = [];
    for (let i = 0; i + 1 < sorted.length; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (a === undefined || b === undefined) continue;
      out.push([idAt.get(key(a)) ?? '?', idAt.get(key(b)) ?? '?']);
    }
    return out;
  }

  it('n pins give n - 1 segments joining consecutive pins in x, gy order, no polyline, nothing else changed', () => {
    fc.assert(
      fc.property(draftArb, ({ scene, pinned }) => {
        const out = stitchInOrder(scene);
        const want = expectedChain(pinned, scene);
        expect(out.segments?.map((s) => [s.a, s.b])).toEqual(want);
        expect(out.segments).toHaveLength(Math.max(0, pinned.length - 1));
        expect(new Set(out.segments?.map((s) => s.id)).size).toBe(out.segments?.length);
        expect(out.polylines).toEqual([]);
        expect(out.points).toBe(scene.points);
        expect(out.axes).toEqual(scene.axes);
        expect(out.facts).toEqual(scene.facts);
        expect(out.kind).toBe(scene.kind);
        expect(out.bars).toEqual(scene.bars);
        expect(validateSceneInvariants(out).ok).toBe(true);
      }),
      { numRuns: runs(300) },
    );
  });

  it('applying it twice returns the same object; stale segments in the input are dropped', () => {
    fc.assert(
      fc.property(draftArb, ({ scene }) => {
        const once = stitchInOrder(scene);
        expect(stitchInOrder(once)).toBe(once);
        const ids = (scene.points ?? []).map((p) => p.id);
        const stale: DiagramScene = {
          ...scene,
          segments: ids.length >= 2 ? [{ id: 'old1', a: ids[ids.length - 1] ?? '', b: ids[0] ?? '' }] : [],
        };
        const fixed = stitchInOrder(stale);
        expect(fixed.segments).toEqual(once.segments);
      }),
      { numRuns: runs(250) },
    );
  });

  it('the chain does not depend on the order the pins were placed in', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(ALL, { minLength: 0, maxLength: 20 }),
        fc.integer({ min: 1, max: 1000 }),
        (set, seed) => {
          const rnd = ((): (() => number) => {
            let s = seed;
            return () => {
              s = (s * 48271) % 2147483647;
              return s / 2147483647;
            };
          })();
          const shuffled = [...set].sort(() => rnd() - 0.5);
          const chainOf = (order: Crossing[]): string[] => {
            const { scene } = build(order.map((c) => [c.gx, c.gy] as const));
            const byId = new Map((scene.points ?? []).map((p) => [p.id, snapNorm(p.x, p.y)] as const));
            return (stitchInOrder(scene).segments ?? []).map((s) => {
              const a = byId.get(s.a);
              const b = byId.get(s.b);
              return `${a ? key(a) : '?'}>${b ? key(b) : '?'}`;
            });
          };
          expect(chainOf(shuffled)).toEqual(chainOf(set));
        },
      ),
      { numRuns: runs(200) },
    );
  });

  it('example: pins (2,5), (0,1), (1,3) chain left to right; a vertical pair goes upward', () => {
    const { scene } = build([
      [2, 5],
      [0, 1],
      [1, 3],
      [1, 1],
    ]);
    const out = stitchInOrder(scene);
    const label = (id: string): string => scene.points?.find((p) => p.id === id)?.label ?? '?';
    expect((out.segments ?? []).map((s) => `${label(s.a)} > ${label(s.b)}`)).toEqual([
      'x 0 y 1 > x 1 y 1',
      'x 1 y 1 > x 1 y 3',
      'x 1 y 3 > x 2 y 5',
    ]);
  });
});

describe('P175 drafts are valid and share (52.2, 52.8, 52.10)', () => {
  const stitchedArb = fc.tuple(attemptsArb, fc.boolean()).map(([a, s]) => {
    const d = build(a);
    return { ...d, scene: s ? stitchInOrder(d.scene) : d.scene };
  });

  it('every draft is renderable and has no invariant error; the share validator accepts it exactly with a pin', () => {
    fc.assert(
      fc.property(stitchedArb, ({ scene, pinned }) => {
        expect(isRenderableScene(scene)).toBe(true);
        expect(validateSceneInvariants(scene).ok).toBe(true);
        const shared = validateShareScene(scene);
        expect(shared.ok).toBe(pinned.length >= 1);
        expect(canFeel(scene)).toBe(shared.ok);
        expect(canHandIn(scene)).toBe(shared.ok);
      }),
      { numRuns: runs(200) },
    );
  });

  it('with a pin, the share link round-trips points, segments, kind, axes and facts', () => {
    fc.assert(
      fc.property(stitchedArb, ({ scene, pinned }) => {
        fc.pre(pinned.length >= 1);
        const encoded = encodeShare({ v: 1, scene, verifiedBy: '', note: '', verifiedAt: '2026-11-22T00:00:00.000Z' });
        const back = decodeShare(encoded).scene;
        const pts = (s: DiagramScene) => (s.points ?? []).map((p) => ({ id: p.id, label: p.label, x: p.x, y: p.y }));
        const segs = (s: DiagramScene) => (s.segments ?? []).map((g) => ({ id: g.id, a: g.a, b: g.b }));
        expect(pts(back)).toEqual(pts(scene));
        expect(segs(back)).toEqual(segs(scene));
        expect(back.kind).toBe(scene.kind);
        expect(back.axes).toEqual(scene.axes);
        expect(back.facts).toEqual(scene.facts);
      }),
      { numRuns: runs(200) },
    );
  });

  it('example: the empty draft is renderable and not shareable', () => {
    const d = emptyDraft();
    expect(isRenderableScene(d)).toBe(true);
    expect(validateShareScene(d).ok).toBe(false);
    expect(canFeel(d)).toBe(false);
    expect(d).toEqual({
      version: 1,
      kind: 'geometry',
      points: [],
      segments: [],
      polylines: [],
      bars: [],
      axes: { x_axis_y: 1, y_axis_x: 0 },
      facts: ['Grid: x 0 to 6, y 0 to 8'],
    });
    expect(emptyDraft()).not.toBe(d);
  });
});

describe('P176 the grid line is not a fact and a draft has no walk (52.11)', () => {
  it('parseFacts reads nothing and verifyScene is silent for any draft', () => {
    fc.assert(
      fc.property(fc.tuple(attemptsArb, fc.boolean()), ([a, s]) => {
        const d = build(a);
        const scene = s ? stitchInOrder(d.scene) : d.scene;
        const parsed = parseFacts(scene.facts, scene);
        expect(parsed.all).toEqual([]);
        expect(parsed.lengths).toEqual([]);
        expect(parsed.angles).toEqual([]);
        expect(parsed.bars).toEqual([]);
        expect(parsed.hasNotToScale).toBe(false);
        const v = verifyScene(scene, { mode: 'shared' });
        expect(v.status).toBe('silent');
        expect(v.findings).toEqual([]);
        expect(templateWalk(scene)).toBeNull();
        expect(isDraft(scene)).toBe(true);
      }),
      { numRuns: runs(200) },
    );
  });

  it('the guard is what stops a walk: with printed lengths a walk exists without the grid line and not with it', () => {
    // A(0,0), B(2,0), C(2,8): drawn AB = 1/3, BC = 1, so the facts AB = 1 cm and BC = 3 cm agree with the drawing.
    const { scene } = build([
      [0, 0],
      [2, 0],
      [2, 8],
    ]);
    const stitched = stitchInOrder(scene);
    expect((stitched.segments ?? []).map((s) => s.id)).toEqual(['AB', 'BC']);
    const lengths = ['AB = 1 cm', 'BC = 3 cm'];
    const withLine: DiagramScene = { ...stitched, facts: [GRID_FACT, ...lengths] };
    const withoutLine: DiagramScene = { ...stitched, facts: lengths };
    expect(templateWalk(withoutLine)).not.toBeNull();
    expect(templateWalk(withLine)).toBeNull();
    for (let i = 0; i < 3; i++) {
      const facts = [...lengths];
      facts.splice(i, 0, GRID_FACT.toUpperCase());
      expect(templateWalk({ ...stitched, facts })).toBeNull();
    }
  });
});

describe('P177 pin and stitch undo exactly (52.6)', () => {
  it('one apply per pin or stitch; undo gives the previous object, redo the edited one; a refusal makes no entry', () => {
    fc.assert(
      fc.property(attemptsArb, (attempts) => {
        let h = createHistory(emptyDraft());
        for (const [gx, gy] of attempts) {
          const before = h;
          const r = pin(h.present, gx, gy);
          const next = historyReducer(h, { type: 'apply', scene: r.scene });
          if (r.kind === 'pinned') {
            expect(next.present).toBe(r.scene);
            expect(historyReducer(next, { type: 'undo' }).present).toBe(before.present);
            expect(historyReducer(historyReducer(next, { type: 'undo' }), { type: 'redo' }).present).toBe(r.scene);
          } else {
            expect(next).toBe(before);
          }
          h = next;
        }
        const stitched = stitchInOrder(h.present);
        const after = historyReducer(h, { type: 'apply', scene: stitched });
        if (stitched === h.present) {
          expect(after).toBe(h);
        } else {
          expect(after.present).toBe(stitched);
          expect(historyReducer(after, { type: 'undo' }).present).toBe(h.present);
          expect(historyReducer(historyReducer(after, { type: 'undo' }), { type: 'redo' }).present).toBe(stitched);
        }
      }),
      { numRuns: runs(200) },
    );
  });
});

describe('P178 what is said about the work is exact and bracket-free (52.5, 52.13)', () => {
  const FORBIDDEN = /verified|correct|checked|approved/i;
  const NO_PUNCT = /[()[\]{}<>,=]/;

  it('lists exactly the pins once each in stitch order; strings are bracket-free; keys are declared', () => {
    fc.assert(
      fc.property(fc.tuple(attemptsArb, fc.boolean()), ([a, s]) => {
        const d = build(a);
        const scene = s ? stitchInOrder(d.scene) : d.scene;
        const w = describeWork(scene);
        const want = sortedCrossings(d.pinned);
        expect(w.pinCount).toBe(want.length);
        expect(w.pins.map((p) => ({ gx: p.gx, gy: p.gy }))).toEqual(want);
        expect(w.pins.map((p) => p.label)).toEqual(want.map(pinLabel));
        expect(new Set(w.pins.map((p) => p.id)).size).toBe(want.length);
        expect(handInList(scene)).toEqual(w.pins);
        expect(pinsOf(scene)).toEqual(w.pins);
        expect(w.segmentCount).toBe(scene.segments?.length ?? 0);
        if (want.length === 0) {
          expect(w.lines).toEqual([{ key: 'build.work.empty', params: {} }]);
        } else {
          expect(w.lines[0]).toEqual({ key: 'build.work.count', params: { count: want.length } });
          expect(w.lines.filter((l) => l.key === 'build.work.pin')).toHaveLength(want.length);
          expect(w.lines.some((l) => l.key === 'build.work.stitched')).toBe(w.segmentCount > 0);
        }
        for (const line of w.lines) {
          expect((BUILD_WORK_KEYS as readonly string[]).includes(line.key)).toBe(true);
          for (const v of Object.values(line.params)) {
            if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
            else {
              expect(v).not.toMatch(NO_PUNCT);
              expect(v).not.toMatch(FORBIDDEN);
            }
          }
        }
        for (const p of w.pins) {
          expect(p.label).not.toMatch(NO_PUNCT);
          expect(p.label).toMatch(/^x [0-6] y [0-8]$/);
        }
      }),
      { numRuns: runs(250) },
    );
  });

  it('example: a labelled pin reads "x 2 y 5"', () => {
    expect(pinLabel({ gx: 2, gy: 5 })).toBe('x 2 y 5');
  });
});

describe('P179 pin spacing follows the geometry (52.12)', () => {
  function minSpacing(w: number, h: number, offset: boolean): { min: number; scale: number } {
    const vp = makeViewport(w, h);
    const view = offset ? vp : { ...vp, offsetX: 0, offsetY: 0 };
    const pts = ALL.map((c) => toScreen(gridToNorm(c), view));
    let min = Infinity;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const p = pts[i];
        const q = pts[j];
        if (p === undefined || q === undefined) continue;
        min = Math.min(min, Math.hypot(p.x - q.x, p.y - q.y));
      }
    }
    return { min, scale: vp.scale };
  }

  it('equals the brute-force minimum over all pairs, and the 44 px rule is true exactly from 352', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 1200, noNaN: true }),
        fc.double({ min: 100, max: 1200, noNaN: true }),
        fc.boolean(),
        (w, h, offset) => {
          const { min, scale } = minSpacing(w, h, offset);
          expect(pinSpacingPx(scale)).toBeCloseTo(min, 6);
          if (Math.abs(min - MIN_PIN_SPACING_PX) > 1e-6) {
            expect(pinSpacingOk(scale)).toBe(min >= MIN_PIN_SPACING_PX);
          }
        },
      ),
      { numRuns: runs(250) },
    );
  });

  it('examples at the edge: 351.9 fails, 352 holds, a 360 px phone canvas is 45 px', () => {
    expect(MIN_PIN_SPACING_PX).toBe(44);
    expect(pinSpacingOk(351.9)).toBe(false);
    expect(pinSpacingOk(352)).toBe(true);
    expect(pinSpacingPx(360)).toBe(45);
    expect(pinSpacingOk(320)).toBe(false);
    expect(pinSpacingPx(0)).toBe(0);
    expect(pinSpacingPx(Number.NaN)).toBe(0);
    expect(pinSpacingOk(Infinity)).toBe(false);
  });
});

describe('P180 total and pure (52.16)', () => {
  const junkScene = fc.oneof(
    fc.anything(),
    fc.constantFrom<unknown>(
      null,
      undefined,
      5,
      'x',
      [],
      {},
      { points: 5 },
      { points: 'abc', segments: {} },
      { points: [null, 3, { id: 1, x: 'a', y: null }, { id: '__proto__', x: NaN, y: Infinity }] },
      { points: [{ id: 'A', x: 0, y: 1 }, { id: 'A', x: 0, y: 1 }], segments: [{ id: 1 }, null], facts: 7 },
      { kind: 'geometry', points: [{ id: 'A', x: 0.5, y: 0.5 }], segments: 'no', polylines: null },
    ),
  );

  it('no export throws on junk scenes or junk numbers', () => {
    fc.assert(
      fc.property(junkScene, fc.anything(), fc.anything(), (scene, a, b) => {
        const s = scene as DiagramScene;
        expect(() => {
          pin(s, a as number, b as number);
          stitchInOrder(s);
          canFeel(scene);
          canHandIn(scene);
          describeWork(scene);
          handInList(scene);
          pinsOf(scene);
          isDraft(scene);
          snapNorm(a as number, b as number);
          snapCrossing(a as number, b as number);
          pinSpacingPx(a as number);
          pinSpacingOk(b as number);
        }).not.toThrow();
      }),
      { numRuns: runs(300) },
    );
  });

  it('a deep-frozen draft is never mutated', () => {
    fc.assert(
      fc.property(attemptsArb, bigNumber, bigNumber, (attempts, gx, gy) => {
        const { scene } = build(attempts);
        deepFreeze(scene);
        expect(() => {
          pin(scene, gx, gy);
          stitchInOrder(scene);
          describeWork(scene);
          handInList(scene);
        }).not.toThrow();
      }),
      { numRuns: runs(200) },
    );
  });
});
