/**
 * Ghostwriter (Requirement 19): adding the point or segment the vision model missed.
 * Properties P54-P57 (Kiro, task 34) for `addPoint` and `addSegment` in core/correct.ts.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  addPoint,
  addSegment,
  createHistory,
  historyReducer,
  validateSceneInvariants,
} from '../src/core/correct';
import type { Bar, DiagramScene, Point, Polyline, Segment } from '../src/core/scene';
import triangleJson from '../public/samples/triangle.json';

const RUNS = { numRuns: 250 };
const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/** Ids that collide with the generated ones (letters, P1.., AB-style defaults) as well as random ones. */
const idArb = fc.oneof(
  fc.constantFrom(...LETTERS),
  fc.constantFrom('P1', 'P2', 'P3', 'AB', 'AB2', 'BA', 'CD', 'p0', 's0'),
  fc.string({ minLength: 1, maxLength: 4 }),
);

const unitArb = fc.double({ min: 0, max: 1, noNaN: true });
const labelArb = fc.option(fc.string({ maxLength: 6 }), { nil: undefined });

/**
 * A scene that passes `validateSceneInvariants`: unique ids across points, segments, polylines
 * and bars, no dangling endpoints, every coordinate in [0, 1]. Sometimes every letter A..Z is
 * already a point, so generated ids must move on to P1, P2, ...
 */
function validSceneArb(): fc.Arbitrary<DiagramScene> {
  return fc
    .record({
      allLetters: fc.boolean(),
      ids: fc.uniqueArray(idArb, { minLength: 1, maxLength: 16 }),
      nSeg: fc.nat({ max: 6 }),
      nPoly: fc.nat({ max: 2 }),
      nBar: fc.nat({ max: 2 }),
    })
    .chain(({ allLetters, ids, nSeg, nPoly, nBar }) => {
      const pool = allLetters ? [...LETTERS, ...ids.filter((id) => !LETTERS.includes(id))] : ids;
      const nOther = Math.min(nSeg + nPoly + nBar, Math.max(0, pool.length - 1));
      const pointIds = pool.slice(0, pool.length - nOther);
      const otherIds = pool.slice(pool.length - nOther);
      const segIds = otherIds.slice(0, Math.min(nSeg, otherIds.length));
      const polyIds = otherIds.slice(segIds.length, segIds.length + nPoly);
      const barIds = otherIds.slice(segIds.length + polyIds.length);

      const pointsArb = fc.tuple(
        ...pointIds.map((id) =>
          fc.record({ x: unitArb, y: unitArb, label: labelArb }).map((c): Point => {
            const p: Point = { id, x: c.x, y: c.y };
            if (c.label !== undefined) p.label = c.label;
            return p;
          }),
        ),
      );
      const endpointArb = fc.constantFrom(...pointIds);
      const segmentsArb = fc.tuple(
        ...segIds.map((id) =>
          fc.tuple(endpointArb, endpointArb).map(([a, b]): Segment => ({ id, a, b })),
        ),
      );
      const polylinesArb = fc.tuple(
        ...polyIds.map((id) =>
          fc
            .array(fc.tuple(unitArb, unitArb), { minLength: 2, maxLength: 5 })
            .map((pts): Polyline => ({ id, points: pts })),
        ),
      );
      const barsArb = fc.tuple(
        ...barIds.map((id) =>
          fc.tuple(unitArb, unitArb, unitArb, unitArb).map(
            ([x0, x1, y_top, y_base]): Bar => ({ id, label: id, value: 1, x0, x1, y_top, y_base }),
          ),
        ),
      );

      return fc
        .tuple(pointsArb, segmentsArb, polylinesArb, barsArb)
        .map(
          ([points, segments, polylines, bars]): DiagramScene => ({
            version: 1,
            kind: 'geometry',
            points: [...points],
            segments: [...segments],
            polylines: [...polylines],
            bars: [...bars],
          }),
        );
    });
}

function allIds(scene: DiagramScene): string[] {
  return [
    ...(scene.points ?? []).map((p) => p.id),
    ...(scene.segments ?? []).map((s) => s.id),
    ...(scene.polylines ?? []).map((p) => p.id),
    ...(scene.bars ?? []).map((b) => b.id),
  ];
}

function joined(scene: DiagramScene, a: string, b: string): boolean {
  return (scene.segments ?? []).some(
    (s) => (s.a === a && s.b === b) || (s.a === b && s.b === a),
  );
}

/** Finite numbers of every size, including huge and negative ones. */
const finiteArb = fc.oneof(
  unitArb,
  fc.double({ min: -1e6, max: 1e6, noNaN: true }),
  fc.constantFrom(-0, -1, 2, Number.MAX_VALUE, -Number.MAX_VALUE, Number.MIN_VALUE, 1e308),
);
const nonFiniteArb = fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY);
const anyCoordArb = fc.oneof(finiteArb, nonFiniteArb);
const requestedIdArb = fc.option(fc.oneof(idArb, fc.constantFrom('', '  ', ' A ')), {
  nil: undefined,
});

describe('P54: addPoint keeps the scene valid and adds exactly one point (19.1, 19.3)', () => {
  it('for any valid scene and finite x, y', () => {
    fc.assert(
      fc.property(validSceneArb(), finiteArb, finiteArb, labelArb, requestedIdArb, (scene, x, y, label, id) => {
        expect(validateSceneInvariants(scene).ok).toBe(true);
        const before = structuredClone(scene);
        const next = addPoint(scene, x, y, label, id);

        expect(validateSceneInvariants(next)).toEqual({ ok: true, errors: [] });
        expect(scene).toEqual(before); // input not mutated
        expect(next).not.toBe(scene);

        const oldPoints = scene.points ?? [];
        const newPoints = next.points ?? [];
        expect(newPoints.length).toBe(oldPoints.length + 1);
        expect(newPoints.slice(0, -1)).toEqual(oldPoints);
        expect(next.segments).toBe(scene.segments);
        expect(next.polylines).toBe(scene.polylines);
        expect(next.bars).toBe(scene.bars);

        const added = newPoints[newPoints.length - 1]!;
        expect(allIds(scene)).not.toContain(added.id);
        expect(added.x).toBe(Math.max(0, Math.min(1, x)));
        expect(added.y).toBe(Math.max(0, Math.min(1, y)));
        const trimmed = id?.trim();
        if (trimmed && !allIds(scene).includes(trimmed)) expect(added.id).toBe(trimmed);
        const want = label?.trim();
        if (want) expect(added.label).toBe(want);
        else expect('label' in added).toBe(false);
      }),
      RUNS,
    );
  });

  it('generated ids are the first free letter, then P1, P2, ...', () => {
    fc.assert(
      fc.property(validSceneArb(), (scene) => {
        const used = new Set(allIds(scene));
        const expected =
          LETTERS.find((l) => !used.has(l)) ??
          `P${Array.from({ length: used.size + 1 }, (_, i) => i + 1).find((n) => !used.has(`P${n}`))}`;
        const added = (addPoint(scene, 0.5, 0.5).points ?? []).at(-1)!;
        expect(added.id).toBe(expected);
      }),
      RUNS,
    );
  });
});

describe('P55: addSegment keeps the scene valid, or returns the same scene (19.2, 19.3)', () => {
  it('two distinct existing points that are not joined get exactly one new segment', () => {
    fc.assert(
      fc.property(validSceneArb(), fc.nat(), fc.nat(), requestedIdArb, (scene, i, j, id) => {
        const ids = (scene.points ?? []).map((p) => p.id);
        const a = ids[i % ids.length]!;
        const b = ids[j % ids.length]!;
        fc.pre(a !== b && !joined(scene, a, b));
        const before = structuredClone(scene);
        const next = addSegment(scene, a, b, id);

        expect(validateSceneInvariants(next)).toEqual({ ok: true, errors: [] });
        expect(scene).toEqual(before);
        const oldSegs = scene.segments ?? [];
        const newSegs = next.segments ?? [];
        expect(newSegs.length).toBe(oldSegs.length + 1);
        expect(newSegs.slice(0, -1)).toEqual(oldSegs);
        expect(next.points).toBe(scene.points);
        const added = newSegs[newSegs.length - 1]!;
        expect([added.a, added.b]).toEqual([a, b]);
        expect(allIds(scene)).not.toContain(added.id);
        const trimmed = id?.trim();
        if (trimmed && !allIds(scene).includes(trimmed)) expect(added.id).toBe(trimmed);
        else expect(added.id.startsWith(`${a}${b}`)).toBe(true);
      }),
      RUNS,
    );
  });

  it('when `${a}${b}` and some suffixes are taken, the first free suffix is used', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 5 }),
        fc.constantFrom<'points' | 'polylines' | 'bars'>('points', 'polylines', 'bars'),
        (taken, where) => {
          const occupied = ['AB', ...Array.from({ length: taken }, (_, i) => `AB${i + 2}`)];
          const points: Point[] = [
            { id: 'A', x: 0.1, y: 0.1 },
            { id: 'B', x: 0.9, y: 0.9 },
          ];
          const scene: DiagramScene = { version: 1, kind: 'geometry', points, segments: [] };
          if (where === 'points') scene.points = [...points, ...occupied.map((id) => ({ id, x: 0.5, y: 0.5 }))];
          if (where === 'polylines') scene.polylines = occupied.map((id) => ({ id, points: [[0, 0], [1, 1]] }));
          if (where === 'bars') scene.bars = occupied.map((id) => ({ id, label: id, value: 1, x0: 0, x1: 0.1, y_top: 0.2, y_base: 0.9 }));
          const next = addSegment(scene, 'A', 'B');
          expect(next.segments?.at(-1)?.id).toBe(`AB${taken + 2}`);
          expect(validateSceneInvariants(next).ok).toBe(true);
        },
      ),
      RUNS,
    );
  });

  it('unknown endpoint, a == b, or an existing pair in either direction returns the same object', () => {
    fc.assert(
      fc.property(
        validSceneArb(),
        fc.nat(),
        fc.string({ maxLength: 4 }),
        fc.constantFrom('unknownA', 'unknownB', 'same', 'pair', 'reversed'),
        requestedIdArb,
        (scene, i, stranger, mode, id) => {
          const ids = (scene.points ?? []).map((p) => p.id);
          const p = ids[i % ids.length]!;
          const missing = ids.includes(stranger) ? `${stranger}\u0000missing` : stranger;
          const seg = (scene.segments ?? [])[i % Math.max(1, (scene.segments ?? []).length)];
          let a = p;
          let b = p;
          if (mode === 'unknownA') [a, b] = [missing, p];
          else if (mode === 'unknownB') [a, b] = [p, missing];
          else if (mode === 'pair' || mode === 'reversed') {
            fc.pre(seg !== undefined);
            [a, b] = mode === 'pair' ? [seg!.a, seg!.b] : [seg!.b, seg!.a];
          }
          expect(addSegment(scene, a, b, id)).toBe(scene);
        },
      ),
      RUNS,
    );
  });
});

describe('P56: add then undo restores the previous scene exactly (19.5)', () => {
  it('for addPoint and addSegment through historyReducer', () => {
    fc.assert(
      fc.property(validSceneArb(), finiteArb, finiteArb, fc.nat(), fc.nat(), (scene, x, y, i, j) => {
        const start = historyReducer(createHistory(scene), { type: 'reset', scene });

        const withPoint = addPoint(scene, x, y);
        const h1 = historyReducer(start, { type: 'apply', scene: withPoint });
        expect(h1.present).toBe(withPoint);
        const u1 = historyReducer(h1, { type: 'undo' });
        expect(u1.present).toBe(scene);
        expect(u1.past).toEqual(start.past);
        expect(historyReducer(u1, { type: 'redo' }).present).toBe(withPoint);

        // Tightened in task 39.4 (audit r5-kiro-glue LOW): the old pair (ids[i], ids[j]) could
        // collide or be joined already, which skipped the segment undo. The new point is joined to
        // nothing, so joining it to any other point always adds a segment.
        const added = (withPoint.points ?? []).at(-1)!.id;
        const others = (withPoint.points ?? []).map((p) => p.id).filter((id) => id !== added);
        const other = others[i % others.length]!;
        const withSeg = addSegment(withPoint, added, other);
        expect(withSeg).not.toBe(withPoint);
        const h2 = historyReducer(h1, { type: 'apply', scene: withSeg });
        const u2 = historyReducer(h2, { type: 'undo' });
        expect(u2.present).toBe(withPoint);
        expect(historyReducer(u2, { type: 'redo' }).present).toBe(withSeg);
        const u3 = historyReducer(u2, { type: 'undo' });
        expect(u3.present).toBe(scene);
        const r3 = historyReducer(historyReducer(u3, { type: 'redo' }), { type: 'redo' });
        expect(r3.present).toBe(withSeg);
        // A no-op (same point twice, chosen by j) adds nothing to undo.
        const same = [added, ...others][j % (others.length + 1)]!;
        expect(historyReducer(h2, { type: 'apply', scene: addSegment(withSeg, same, same) })).toBe(h2);
      }),
      RUNS,
    );
  });
});

describe('P57: bad coordinates never make a bad scene (19.3, 19.4)', () => {
  it('NaN or Infinity returns the same scene; anything else stays valid', () => {
    fc.assert(
      fc.property(validSceneArb(), anyCoordArb, anyCoordArb, (scene, x, y) => {
        const next = addPoint(scene, x, y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          expect(next).toBe(scene);
        } else {
          expect(validateSceneInvariants(next).ok).toBe(true);
          const added = (next.points ?? []).at(-1)!;
          expect(Number.isFinite(added.x) && Number.isFinite(added.y)).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it('a chain of adds with any coordinates stays valid', () => {
    fc.assert(
      fc.property(
        validSceneArb(),
        fc.array(fc.tuple(anyCoordArb, anyCoordArb, fc.nat(), fc.nat()), { maxLength: 12 }),
        (scene, steps) => {
          let s = scene;
          for (const [x, y, i, j] of steps) {
            s = addPoint(s, x, y);
            const ids = (s.points ?? []).map((p) => p.id);
            s = addSegment(s, ids[i % ids.length]!, ids[j % ids.length]!);
            expect(validateSceneInvariants(s).ok).toBe(true);
          }
        },
      ),
      RUNS,
    );
  });
});

describe('Example: add the missing corner D and edge CD to the sample triangle', () => {
  it('gives 4 points and 4 segments, the old elements untouched', () => {
    const triangle = triangleJson as DiagramScene;
    expect(triangle.points).toHaveLength(3);
    expect(triangle.segments).toHaveLength(3);

    const withD = addPoint(triangle, 0.7, 0.25, 'D');
    const withCD = addSegment(withD, 'C', 'D');

    expect(withCD.points).toHaveLength(4);
    expect(withCD.segments).toHaveLength(4);
    expect(withCD.points?.at(-1)).toEqual({ id: 'D', x: 0.7, y: 0.25, label: 'D' });
    expect(withCD.segments?.at(-1)).toEqual({ id: 'CD', a: 'C', b: 'D' });
    expect(withCD.points?.slice(0, 3)).toEqual(triangle.points);
    expect(withCD.segments?.slice(0, 3)).toEqual(triangle.segments);
    expect(validateSceneInvariants(withCD).ok).toBe(true);
    expect(triangle.points).toHaveLength(3); // the sample itself is not changed

    // Adding CD again, or DC, changes nothing.
    expect(addSegment(withCD, 'C', 'D')).toBe(withCD);
    expect(addSegment(withCD, 'D', 'C')).toBe(withCD);
  });
});
