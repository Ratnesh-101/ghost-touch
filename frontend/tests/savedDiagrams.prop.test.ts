import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applyAdd,
  chooseEviction,
  deserialise,
  makeId,
  SAVED_DIAGRAMS_CAP,
  type SavedDiagram,
  savedTitle,
  serialise,
} from '../src/core/savedDiagrams';
import type {
  Axes,
  Bar,
  DiagramScene,
  Point,
  Polyline,
  SceneKind,
  Segment,
} from '../src/core/scene';

/**
 * Fast-check arbitrary generating valid DiagramScene objects across all 4 kinds.
 */
function validSceneArbitrary(): fc.Arbitrary<DiagramScene> {
  const kindArb = fc.constantFrom<SceneKind>(
    'geometry',
    'function_graph',
    'bar_chart',
    'unknown',
  );

  const titleArb = fc.option(fc.string({ maxLength: 30 }), { nil: null });

  const pointArb = fc.record({
    x: fc.double({ min: 0, max: 1, noNaN: true }),
    y: fc.double({ min: 0, max: 1, noNaN: true }),
    label: fc.option(fc.string({ maxLength: 10 }), { nil: null }),
  });

  const barArb = fc.record({
    label: fc.string({ minLength: 1, maxLength: 15 }),
    value: fc.double({ min: 0, max: 1000, noNaN: true }),
    x0: fc.double({ min: 0, max: 0.5, noNaN: true }),
    x1: fc.double({ min: 0.5, max: 1, noNaN: true }),
    y_base: fc.double({ min: 0.5, max: 1, noNaN: true }),
    y_top: fc.double({ min: 0, max: 0.5, noNaN: true }),
  });

  const polylinePointsArb = fc.array(
    fc.tuple(
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ),
    { minLength: 2, maxLength: 10 },
  );

  const axesArb = fc.option(
    fc.record<Axes>({
      x_axis_y: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: null }),
      y_axis_x: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: null }),
    }),
    { nil: null },
  );

  const factsArb = fc.option(fc.array(fc.string({ maxLength: 25 }), { maxLength: 4 }), {
    nil: undefined,
  });

  return fc
    .tuple(
      kindArb,
      titleArb,
      fc.array(pointArb, { maxLength: 8 }),
      fc.array(barArb, { maxLength: 5 }),
      fc.array(polylinePointsArb, { maxLength: 3 }),
      axesArb,
      factsArb,
    )
    .chain(([kind, title, rawPoints, rawBars, rawPolylines, axes, facts]) => {
      const points: Point[] = rawPoints.map((p, idx) => ({
        id: `p${idx}`,
        x: p.x,
        y: p.y,
        ...(p.label !== null ? { label: p.label } : { label: null }),
      }));

      const numPoints = points.length;
      const segGenerator =
        numPoints < 2
          ? fc.constant<Segment[]>([])
          : fc
              .array(
                fc.tuple(
                  fc.integer({ min: 0, max: numPoints - 1 }),
                  fc.integer({ min: 0, max: numPoints - 1 }),
                ).filter(([a, b]) => a !== b),
                { maxLength: 6 },
              )
              .map((pairs) =>
                pairs.map(([aIdx, bIdx], sIdx) => ({
                  id: `s${sIdx}`,
                  a: `p${aIdx}`,
                  b: `p${bIdx}`,
                  label: null,
                })),
              );

      return segGenerator.map((segments) => {
        const bars: Bar[] = rawBars.map((b, idx) => ({
          id: `b${idx}`,
          label: b.label,
          value: b.value,
          x0: b.x0,
          x1: b.x1,
          y_base: b.y_base,
          y_top: b.y_top,
        }));

        const polylines: Polyline[] = rawPolylines.map((pts, idx) => ({
          id: `pl${idx}`,
          points: pts,
          label: null,
        }));

        const scene: DiagramScene = {
          version: 1,
          kind,
          title,
          points,
          segments,
          polylines,
          bars,
          axes,
          ...(facts !== undefined ? { facts } : {}),
        };

        return scene;
      });
    });
}

describe('Property P14 — Serialise round-trip', () => {
  /**
   * P14: deserialise(serialise(entry)) returns an identical DiagramScene for any
   * valid scene (all coordinate values preserved, kind preserved, no data loss).
   *
   * Validates: Requirement 11.1
   */
  it('deserialise(serialise(entry)) returns identical DiagramScene (200+ runs)', () => {
    fc.assert(
      fc.property(
        validSceneArbitrary(),
        fc.integer({ min: 1000, max: 2000000000000 }),
        fc.boolean(),
        (scene, createdAt, pinned) => {
          const entry: SavedDiagram = {
            id: makeId(createdAt, Math.random),
            createdAt,
            title: savedTitle(scene),
            thumbnailDataUrl: 'data:image/jpeg;base64,placeholder',
            scene,
            pinned,
          };

          const serialized = serialise(entry);
          expect(typeof serialized).toBe('string');

          const deserialized = deserialise(serialized);
          expect(deserialized).toBeDefined();

          // All scene properties, coordinate values, and kind are preserved identically
          expect(deserialized!.scene).toEqual(scene);
          // Envelope metadata is also preserved identically
          expect(deserialized).toEqual(entry);
        },
      ),
      { numRuns: 250 },
    );
  });
});

describe('Property P15 — Eviction invariants', () => {
  /**
   * P15: after any sequence of saves into a store at the cap, the count never exceeds
   * the cap, a pinned entry is never evicted, and the removed entry is always the oldest
   * unpinned one.
   *
   * Validates: Requirements 11.5, 11.6
   */
  it('count never exceeds cap, pinned entries never evicted, removed is oldest unpinned (200+ runs)', () => {
    // Initial store state: 0 to 20 entries
    const initialStoreArb = fc
      .array(
        fc.record({
          id: fc.uuid(),
          createdAt: fc.integer({ min: 1000, max: 500000 }),
          pinned: fc.boolean(),
        }),
        { maxLength: SAVED_DIAGRAMS_CAP },
      )
      .map((items) =>
        items.map(
          (item): SavedDiagram => ({
            id: item.id,
            createdAt: item.createdAt,
            title: `Initial ${item.id}`,
            thumbnailDataUrl: '',
            scene: { kind: 'geometry' },
            pinned: item.pinned,
          }),
        ),
      );

    // Sequence of incoming saves
    const incomingSavesArb = fc.array(
      fc.record({
        id: fc.uuid(),
        createdAt: fc.integer({ min: 500001, max: 1000000 }),
        pinned: fc.boolean(),
      }),
      { minLength: 1, maxLength: 30 },
    );

    fc.assert(
      fc.property(initialStoreArb, incomingSavesArb, (initialEntries, incoming) => {
        let currentStore: SavedDiagram[] = [...initialEntries];

        for (const inc of incoming) {
          const newEntry: SavedDiagram = {
            id: inc.id,
            createdAt: inc.createdAt,
            title: `Incoming ${inc.id}`,
            thumbnailDataUrl: '',
            scene: { kind: 'geometry' },
            pinned: inc.pinned,
          };

          const storeBefore = [...currentStore];
          const victimBefore = chooseEviction(storeBefore);

          const result = applyAdd(currentStore, newEntry, SAVED_DIAGRAMS_CAP);

          if (result.ok) {
            currentStore = result.next;

            // Invariant 1: Count never exceeds cap
            expect(currentStore.length).toBeLessThanOrEqual(SAVED_DIAGRAMS_CAP);

            // Invariant 2: No pinned entry from storeBefore is ever evicted
            for (const prev of storeBefore) {
              if (prev.pinned) {
                const stillPresent = currentStore.some((e) => e.id === prev.id);
                expect(stillPresent).toBe(true);
              }
            }

            // Invariant 3: If an eviction took place, the removed entry is strictly
            // the oldest unpinned entry
            if (result.evictedId !== undefined) {
              expect(victimBefore).toBeDefined();
              expect(result.evictedId).toBe(victimBefore!.id);
              expect(victimBefore!.pinned).toBe(false);

              // It must be older than or equal to any other unpinned entry before eviction
              for (const prev of storeBefore) {
                if (!prev.pinned) {
                  expect(victimBefore!.createdAt).toBeLessThanOrEqual(prev.createdAt);
                }
              }
            }
          } else {
            // Invariant 4: Save was refused because all entries are pinned at cap
            expect(result.reason).toBe('all_pinned');
            expect(storeBefore.length).toBeGreaterThanOrEqual(SAVED_DIAGRAMS_CAP);
            expect(storeBefore.every((e) => e.pinned)).toBe(true);
            expect(victimBefore).toBeUndefined();
          }
        }
      }),
      { numRuns: 250 },
    );
  });
});
