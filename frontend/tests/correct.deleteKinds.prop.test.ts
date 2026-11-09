/**
 * Requirement 21 (Kiro, task 37.1): Correct mode can delete curves (polylines) and bars.
 * Properties P62-P65 for `deletePolyline` and `deleteBar` in core/correct.ts.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createHistory,
  deleteBar,
  deletePolyline,
  historyReducer,
  validateSceneInvariants,
} from '../src/core/correct';
import type { Bar, DiagramScene, Point, Polyline, Segment } from '../src/core/scene';

const RUNS = { numRuns: 250 };
const unitArb = fc.double({ min: 0, max: 1, noNaN: true });

type Kind = 'polyline' | 'bar';
const del = (kind: Kind, scene: DiagramScene, id: string): DiagramScene =>
  kind === 'polyline' ? deletePolyline(scene, id) : deleteBar(scene, id);
const listOf = (kind: Kind, scene: DiagramScene): readonly { id: string }[] =>
  (kind === 'polyline' ? scene.polylines : scene.bars) ?? [];

/**
 * A scene that passes `validateSceneInvariants`, with ids unique across all kinds, 0-4 polylines
 * and 0-4 bars, and the optional fields (axes, facts, title, aspect) present or absent.
 */
function validSceneArb(): fc.Arbitrary<DiagramScene> {
  return fc
    .record({
      ids: fc.uniqueArray(fc.string({ minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 16 }),
      nPoly: fc.nat({ max: 4 }),
      nBar: fc.nat({ max: 4 }),
      nSeg: fc.nat({ max: 4 }),
      extras: fc.record({
        title: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
        facts: fc.option(fc.array(fc.string({ maxLength: 8 }), { maxLength: 3 }), { nil: undefined }),
        aspect: fc.option(fc.double({ min: 0.5, max: 2, noNaN: true }), { nil: undefined }),
        axes: fc.option(fc.record({ x_axis_y: unitArb, y_axis_x: unitArb }), { nil: undefined }),
      }),
    })
    .chain(({ ids, nPoly, nBar, nSeg, extras }) => {
      const polyIds = ids.slice(0, nPoly);
      const barIds = ids.slice(polyIds.length, polyIds.length + nBar);
      const rest = ids.slice(polyIds.length + barIds.length);
      const pointIds = rest.slice(0, Math.max(0, rest.length - nSeg));
      const segIds = pointIds.length > 0 ? rest.slice(pointIds.length) : [];

      const points = fc.tuple(
        ...pointIds.map((id) => fc.tuple(unitArb, unitArb).map(([x, y]): Point => ({ id, x, y }))),
      );
      const segments = fc.tuple(
        ...segIds.map((id) =>
          fc
            .tuple(fc.constantFrom(...pointIds), fc.constantFrom(...pointIds))
            .map(([a, b]): Segment => ({ id, a, b })),
        ),
      );
      const polylines = fc.tuple(
        ...polyIds.map((id) =>
          fc
            .array(fc.tuple(unitArb, unitArb), { minLength: 2, maxLength: 5 })
            .map((pts): Polyline => ({ id, points: pts })),
        ),
      );
      const bars = fc.tuple(
        ...barIds.map((id) =>
          fc
            .tuple(unitArb, unitArb, unitArb, unitArb, fc.double({ min: 0, max: 100, noNaN: true }))
            .map(([x0, x1, y_top, y_base, value]): Bar => ({ id, label: id, value, x0, x1, y_top, y_base })),
        ),
      );
      return fc.tuple(points, segments, polylines, bars).map(([p, s, pl, b]): DiagramScene => {
        const scene: DiagramScene = {
          version: 1,
          kind: b.length > 0 ? 'bar_chart' : 'geometry',
          points: [...p],
          segments: [...s],
          polylines: [...pl],
          bars: [...b],
        };
        if (extras.title !== undefined) scene.title = extras.title;
        if (extras.facts !== undefined) scene.facts = extras.facts;
        if (extras.aspect !== undefined) scene.aspect = extras.aspect;
        if (extras.axes !== undefined) scene.axes = extras.axes;
        return scene;
      });
    });
}

const kindArb = fc.constantFrom<Kind>('polyline', 'bar');

/** A scene with at least one element of `kind`, and the id of one of them. */
function sceneWithTarget(): fc.Arbitrary<{ scene: DiagramScene; kind: Kind; id: string; index: number }> {
  return fc
    .tuple(validSceneArb(), kindArb, fc.nat())
    .filter(([scene, kind]) => listOf(kind, scene).length > 0)
    .map(([scene, kind, n]) => {
      const list = listOf(kind, scene);
      const index = n % list.length;
      return { scene, kind, id: list[index]!.id, index };
    });
}

describe('P62: deleting a curve or bar keeps the scene valid and removes exactly one (21.1, 21.2, 21.4, 21.5)', () => {
  it('for any valid scene and any existing polyline or bar id', () => {
    fc.assert(
      fc.property(sceneWithTarget(), ({ scene, kind, id, index }) => {
        expect(validateSceneInvariants(scene).ok).toBe(true);
        const before = structuredClone(scene);
        const next = del(kind, scene, id);

        expect(validateSceneInvariants(next)).toEqual({ ok: true, errors: [] });
        expect(scene).toEqual(before); // input not mutated
        const oldList = listOf(kind, scene);
        const newList = listOf(kind, next);
        expect(newList.length).toBe(oldList.length - 1);
        expect(newList.some((e) => e.id === id)).toBe(false);
        expect(newList).toEqual([...oldList.slice(0, index), ...oldList.slice(index + 1)]);
      }),
      RUNS,
    );
  });

  it('deleting every curve and bar, one by one, is allowed and stays valid (21.7)', () => {
    fc.assert(
      fc.property(validSceneArb(), (scene) => {
        let s = scene;
        for (const p of scene.polylines ?? []) s = deletePolyline(s, p.id);
        for (const b of scene.bars ?? []) s = deleteBar(s, b.id);
        expect(s.polylines ?? []).toEqual([]);
        expect(s.bars ?? []).toEqual([]);
        expect(validateSceneInvariants(s).ok).toBe(true);
      }),
      RUNS,
    );
  });
});

describe('P63: an unknown id returns the same scene object (21.3)', () => {
  it('ids of other kinds and strangers change nothing', () => {
    fc.assert(
      fc.property(validSceneArb(), kindArb, fc.string({ maxLength: 4 }), fc.nat(), (scene, kind, stranger, n) => {
        const others = [
          ...(scene.points ?? []).map((p) => p.id),
          ...(scene.segments ?? []).map((s) => s.id),
          ...listOf(kind === 'polyline' ? 'bar' : 'polyline', scene).map((e) => e.id),
        ];
        const own = new Set(listOf(kind, scene).map((e) => e.id));
        const candidates = [...others, stranger].filter((id) => !own.has(id));
        fc.pre(candidates.length > 0);
        const id = candidates[n % candidates.length]!;
        expect(del(kind, scene, id)).toBe(scene);
      }),
      RUNS,
    );
  });

  it('a scene without polylines or bars arrays is returned as is', () => {
    fc.assert(
      fc.property(kindArb, fc.string(), (kind, id) => {
        const bare: DiagramScene = { kind: 'geometry' };
        expect(del(kind, bare, id)).toBe(bare);
      }),
      RUNS,
    );
  });
});

describe('P64: delete then undo restores the scene exactly (21.6)', () => {
  it('through historyReducer, with redo and with no-ops', () => {
    fc.assert(
      fc.property(sceneWithTarget(), fc.string({ maxLength: 4 }), ({ scene, kind, id }, stranger) => {
        const h0 = createHistory(scene);
        const next = del(kind, scene, id);
        const h1 = historyReducer(h0, { type: 'apply', scene: next });
        expect(h1.present).toBe(next);
        const u = historyReducer(h1, { type: 'undo' });
        expect(u.present).toBe(scene);
        expect(u.past).toEqual([]);
        expect(historyReducer(u, { type: 'redo' }).present).toBe(next);

        const ownIds = new Set(listOf(kind, next).map((e) => e.id));
        fc.pre(!ownIds.has(stranger));
        const noop = del(kind, next, stranger);
        expect(historyReducer(h1, { type: 'apply', scene: noop })).toBe(h1);
      }),
      RUNS,
    );
  });
});

describe('P65: all other element kinds and fields are unchanged (21.1, 21.2)', () => {
  it('same references for everything but the edited list', () => {
    fc.assert(
      fc.property(sceneWithTarget(), ({ scene, kind, id }) => {
        const next = del(kind, scene, id);
        expect(next.points).toBe(scene.points);
        expect(next.segments).toBe(scene.segments);
        expect(next.axes).toBe(scene.axes);
        expect(next.facts).toBe(scene.facts);
        expect(next.title).toBe(scene.title);
        expect(next.kind).toBe(scene.kind);
        expect(next.aspect).toBe(scene.aspect);
        expect(next.version).toBe(scene.version);
        if (kind === 'polyline') expect(next.bars).toBe(scene.bars);
        else expect(next.polylines).toBe(scene.polylines);
        // The kept elements are the very same objects.
        const kept = listOf(kind, next);
        for (const e of kept) expect(listOf(kind, scene)).toContain(e);
        expect(Object.keys(next).sort()).toEqual(Object.keys(scene).sort());
      }),
      RUNS,
    );
  });
});
