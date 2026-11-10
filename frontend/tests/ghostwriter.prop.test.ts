/**
 * Properties P58-P61 (Task 36, Requirement 20):
 * Pure flow logic contracts for Ghostwriter in Teach mode.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  addPoint,
  addSegment,
  deletePoint,
  deleteSegment,
  movePoint,
  renameLabel,
} from '../src/core/correct';
import type { DiagramScene, Point, Segment } from '../src/core/scene';
import {
  cleanLabel,
  describeUndo,
  GHOSTWRITER_KEYS,
  GHOSTWRITER_POINT_CAP,
  GHOSTWRITER_SEGMENT_CAP,
  planAddPoint,
  planAddSegment,
} from '../src/flow/ghostwriter';
import { tables, t, tf, setLang, getLang } from '../src/i18n';

const RUNS = { numRuns: 250 };
const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const idArb = fc.oneof(
  fc.constantFrom(...LETTERS),
  fc.constantFrom('P1', 'P2', 'P3', 'P4', 'p10', 's1', 's2'),
  fc.string({ minLength: 1, maxLength: 5 }),
);

const unitArb = fc.double({ min: 0, max: 1, noNaN: true });
const labelArb = fc.option(fc.string({ maxLength: 10 }), { nil: undefined });

function validSceneArb(): fc.Arbitrary<DiagramScene> {
  return fc
    .record({
      ids: fc.uniqueArray(idArb, { minLength: 2, maxLength: 12 }),
      nSeg: fc.nat({ max: 5 }),
    })
    .chain(({ ids, nSeg }) => {
      const pointIds = ids.slice(0, Math.max(2, ids.length - nSeg));
      const segIds = ids.slice(pointIds.length);

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
          fc.tuple(endpointArb, endpointArb).map(
            ([a, b]): Segment => ({ id, a, b }),
          ),
        ),
      );

      return fc.tuple(pointsArb, segmentsArb).map(
        ([points, segments]): DiagramScene => ({
          version: 1,
          kind: 'geometry',
          title: 'Test Scene',
          points: [...points],
          segments: [...segments],
        }),
      );
    });
}

const coordArb = fc.oneof(
  unitArb,
  fc.constant(NaN),
  fc.constant(Infinity),
  fc.constant(-Infinity),
  fc.double({ min: -100, max: -0.001, noNaN: true }),
  fc.double({ min: 1.001, max: 1000, noNaN: true }),
);

const testLabelArb = fc.option(fc.string({ maxLength: 80 }), { nil: undefined });

describe('P58: Add point outcome', () => {
  it(
    'returns added exactly when coords are finite and points < cap; otherwise limit or badCoords',
    () => {
      fc.assert(
        fc.property(
          validSceneArb(),
          coordArb,
          coordArb,
          testLabelArb,
          fc.boolean(),
          (baseScene, x, y, label, atCap) => {
            let scene = baseScene;
            if (atCap) {
              const fullPoints: Point[] = Array.from(
                { length: GHOSTWRITER_POINT_CAP },
                (_, i) => ({ id: `pt_${i}`, x: 0.5, y: 0.5 }),
              );
              scene = { ...baseScene, points: fullPoints };
            }

            const outcome = planAddPoint(scene, x, y, label);

            if (!Number.isFinite(x) || !Number.isFinite(y)) {
              expect(outcome.kind).toBe('badCoords');
              expect(outcome.scene).toBe(scene);
            } else if ((scene.points ?? []).length >= GHOSTWRITER_POINT_CAP) {
              expect(outcome.kind).toBe('limit');
              expect(outcome.scene).toBe(scene);
            } else {
              expect(outcome.kind).toBe('added');
              if (outcome.kind !== 'added') throw new Error('expected added');
              const cleaned = cleanLabel(label);
              const expectedScene = addPoint(scene, x, y, cleaned);
              expect(outcome.scene).toEqual(expectedScene);
              const lastPt =
                outcome.scene.points![outcome.scene.points!.length - 1]!;
              expect(outcome.id).toBe(lastPt.id);
              expect(outcome.label).toBe(lastPt.label);
            }

            expect((outcome.scene.points ?? []).length).toBeLessThanOrEqual(
              GHOSTWRITER_POINT_CAP,
            );
          },
        ),
        RUNS,
      );
    },
  );
});

describe('P59: Add edge outcome and reason', () => {
  it(
    'asserts invariant properties directly: preservation, monotonicity, and idempotency',
    () => {
      fc.assert(
        fc.property(
          validSceneArb(),
          fc.string({ maxLength: 6 }),
          fc.string({ maxLength: 6 }),
          fc.boolean(),
          (baseScene, a, b, atCap) => {
            let scene = baseScene;
            if (atCap) {
              const pts = scene.points ?? [];
              const fullSegments: Segment[] = Array.from(
                { length: GHOSTWRITER_SEGMENT_CAP },
                (_, i) => ({ id: `seg_${i}`, a: pts[0]?.id ?? 'A', b: pts[1]?.id ?? 'B' }),
              );
              scene = { ...baseScene, segments: fullSegments };
            }

            const outcome = planAddSegment(scene, a, b);
            const points = scene.points ?? [];
            const segments = scene.segments ?? [];
            const hasA = points.some((p) => p.id === a);
            const hasB = points.some((p) => p.id === b);
            const joined = segments.some(
              (s) => (s.a === a && s.b === b) || (s.a === b && s.b === a),
            );

            // Invariant 1: Preservation — any rejection leaves the scene unmodified
            if (outcome.kind !== 'added') {
              expect(outcome.scene).toBe(scene);
            }

            // Invariant 2: Addition state invariants — monotonicity, endpoint binding, idempotency
            if (outcome.kind === 'added') {
              expect(outcome.scene.segments?.length).toBe(segments.length + 1);
              expect(outcome.scene.points).toBe(scene.points);
              expect(outcome.a).toBe(a);
              expect(outcome.b).toBe(b);

              const newSeg = outcome.scene.segments?.find((s) => s.id === outcome.id);
              expect(newSeg).toBeDefined();
              expect(
                (newSeg?.a === a && newSeg?.b === b) || (newSeg?.a === b && newSeg?.b === a),
              ).toBe(true);

              // Idempotency: immediately re-adding the same edge is rejected as alreadyJoined
              const reAddForward = planAddSegment(outcome.scene, a, b);
              expect(reAddForward.kind).toBe('alreadyJoined');
              expect(reAddForward.scene).toBe(outcome.scene);

              const reAddReverse = planAddSegment(outcome.scene, b, a);
              expect(reAddReverse.kind).toBe('alreadyJoined');
              expect(reAddReverse.scene).toBe(outcome.scene);
            }

            // Invariant 3: Outcome kinds soundly imply their contractual preconditions
            switch (outcome.kind) {
              case 'samePoint':
                expect(a).toBe(b);
                break;
              case 'unknownPoint':
                expect(a).not.toBe(b);
                expect(!hasA || !hasB).toBe(true);
                break;
              case 'alreadyJoined':
                expect(a).not.toBe(b);
                expect(hasA && hasB).toBe(true);
                expect(joined).toBe(true);
                break;
              case 'limit':
                expect(a).not.toBe(b);
                expect(hasA && hasB).toBe(true);
                expect(joined).toBe(false);
                expect(segments.length).toBeGreaterThanOrEqual(GHOSTWRITER_SEGMENT_CAP);
                break;
              case 'added':
                expect(a).not.toBe(b);
                expect(hasA && hasB).toBe(true);
                expect(joined).toBe(false);
                expect(segments.length).toBeLessThan(GHOSTWRITER_SEGMENT_CAP);
                break;
            }

            // Invariant 4: Self-loop contract holds for any input
            expect(planAddSegment(scene, a, a).kind).toBe('samePoint');

            // Invariant 5: When all conditions for edge addition hold, outcome is added
            if (
              a !== b &&
              hasA &&
              hasB &&
              !joined &&
              segments.length < GHOSTWRITER_SEGMENT_CAP
            ) {
              expect(outcome.kind).toBe('added');
            }
          },
        ),
        RUNS,
      );
    },
  );
});

describe('P60: Undo names what it removes', () => {
  it('names the added point or edge; returns undefined for moves, renames, deletes', () => {
    fc.assert(
      fc.property(
        validSceneArb(),
        unitArb,
        unitArb,
        labelArb,
        (scene, x, y, label) => {
          // 1. Add point round-trip
          const pointAfter = addPoint(scene, x, y, cleanLabel(label));
          const pointDesc = describeUndo(pointAfter, scene);
          const lastPoint =
            pointAfter.points![pointAfter.points!.length - 1]!;
          expect(pointDesc).toEqual({ kind: 'point', id: lastPoint.id });

          // 2. Add segment round-trip
          const pts = scene.points ?? [];
          if (pts.length >= 2) {
            const pA = pts[0]!.id;
            const pB = pts[1]!.id;
            const segs = scene.segments ?? [];
            const already = segs.some(
              (s) => (s.a === pA && s.b === pB) || (s.a === pB && s.b === pA),
            );
            if (!already) {
              const segAfter = addSegment(scene, pA, pB);
              const segDesc = describeUndo(segAfter, scene);
              expect(segDesc).toEqual({ kind: 'segment', a: pA, b: pB });
            }
          }

          // 3. Move point gives undefined
          if (pts.length > 0) {
            const moved = movePoint(scene, pts[0]!.id, 0.42, 0.42);
            expect(describeUndo(moved, scene)).toBeUndefined();
          }

          // 4. Rename label gives undefined
          if (pts.length > 0) {
            const renamed = renameLabel(scene, pts[0]!.id, 'NewName');
            expect(describeUndo(renamed, scene)).toBeUndefined();
          }

          // 5. Delete point gives undefined
          if (pts.length > 0) {
            const deleted = deletePoint(scene, pts[0]!.id);
            expect(describeUndo(deleted, scene)).toBeUndefined();
          }

          // 6. Delete segment gives undefined
          const segs = scene.segments ?? [];
          if (segs.length > 0) {
            const delSeg = deleteSegment(scene, segs[0]!.id);
            expect(describeUndo(delSeg, scene)).toBeUndefined();
          }
        },
      ),
      RUNS,
    );
  });
});

describe('P61: New strings are complete and honest', () => {
  const FORBIDDEN = ['verified', 'correct', 'checked', 'approved'];

  function extractPlaceholders(str: string): string[] {
    const matches = str.match(/\{(\w+)\}/g) ?? [];
    return matches.map((m) => m.slice(1, -1)).sort();
  }

  it('every key exists in en, hi, gu, matches placeholders, honest English', () => {
    for (const key of GHOSTWRITER_KEYS) {
      const enVal = tables.en[key];
      const hiVal = tables.hi[key];
      const guVal = tables.gu[key];

      expect(enVal, `Missing English key: ${key}`).toBeDefined();
      expect(hiVal, `Missing Hindi key: ${key}`).toBeDefined();
      expect(guVal, `Missing Gujarati key: ${key}`).toBeDefined();

      expect(enVal!.trim().length, `Empty English key: ${key}`).toBeGreaterThan(0);
      expect(hiVal!.trim().length, `Empty Hindi key: ${key}`).toBeGreaterThan(0);
      expect(guVal!.trim().length, `Empty Gujarati key: ${key}`).toBeGreaterThan(0);

      // Hindi and Gujarati differ from English
      expect(hiVal, `Hindi leaked English: ${key}`).not.toBe(enVal);
      expect(guVal, `Gujarati leaked English: ${key}`).not.toBe(enVal);

      // Placeholders match exactly
      const enHolders = extractPlaceholders(enVal!);
      const hiHolders = extractPlaceholders(hiVal!);
      const guHolders = extractPlaceholders(guVal!);
      expect(hiHolders, `Placeholder mismatch in hi for ${key}`).toEqual(enHolders);
      expect(guHolders, `Placeholder mismatch in gu for ${key}`).toEqual(enHolders);

      // English contains no forbidden words
      const lower = enVal!.toLowerCase();
      for (const word of FORBIDDEN) {
        expect(lower).not.toContain(word);
      }
    }
  });

  it('runs over random placeholder values through tf() (200+ runs)', () => {
    const safeString = fc
      .string({ minLength: 1, maxLength: 20 })
      .map((s) => s.replace(/[{}]/g, ''));
    const originalLang = getLang();

    try {
      fc.assert(
        fc.property(
          safeString,
          safeString,
          safeString,
          safeString,
          safeString,
          safeString,
          (point, id, label, max, a, b) => {
            const params = { point, id, label, max, a, b };

            for (const lang of ['en', 'hi', 'gu'] as const) {
              setLang(lang);
              for (const key of GHOSTWRITER_KEYS) {
                const template = t(key);
                const result = tf(key, params);
                expect(result).toBeDefined();
                expect(result.length).toBeGreaterThan(0);
                // Every placeholder name in the template must be gone from the result
                for (const holder of extractPlaceholders(template)) {
                  expect(result).not.toContain(`{${holder}}`);
                }
              }
            }
          },
        ),
        RUNS,
      );
    } finally {
      setLang(originalLang);
    }
  });
});
