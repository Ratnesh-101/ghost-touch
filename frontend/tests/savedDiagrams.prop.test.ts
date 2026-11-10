import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applyAdd,
  chooseEviction,
  deserialise,
  makeId,
  orderForDisplay,
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

// ---------------------------------------------------------------------------
// Kiro additions (Task 19.4): P33, P34, P35 for Requirement 11
// ---------------------------------------------------------------------------

function entryArb(): fc.Arbitrary<SavedDiagram> {
  return fc.record({
    id: fc.uuid(),
    createdAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
    title: fc.string({ maxLength: 20 }),
    thumbnailDataUrl: fc.constant(''),
    scene: fc.constant<DiagramScene>({ kind: 'geometry' }),
    pinned: fc.boolean(),
  });
}

describe('P33 — List order and spoken title (Requirements 11.1, 11.3)', () => {
  /**
   * P33a: orderForDisplay returns every entry exactly once, newest first,
   * without mutating its input, and is idempotent.
   *
   * Validates: Requirement 11.3
   */
  it('orderForDisplay is a newest-first permutation and does not mutate (200+ runs)', () => {
    fc.assert(
      fc.property(fc.array(entryArb(), { maxLength: 25 }), (entries) => {
        const snapshot = structuredClone(entries);
        const ordered = orderForDisplay(entries);

        expect(entries).toEqual(snapshot);
        expect(ordered).toHaveLength(entries.length);
        expect(ordered.map((e) => e.id).sort()).toEqual(entries.map((e) => e.id).sort());
        for (let i = 1; i < ordered.length; i++) {
          expect(ordered[i - 1]!.createdAt).toBeGreaterThanOrEqual(ordered[i]!.createdAt);
        }
        expect(orderForDisplay(ordered)).toEqual(ordered);
      }),
      { numRuns: 250 },
    );
  });

  /**
   * P33b: savedTitle is never blank. It is the trimmed scene title when one
   * exists; otherwise the kind, followed by at most three trimmed non-blank
   * point labels in scene order.
   *
   * Validates: Requirement 11.1
   */
  it('savedTitle is never blank and follows the title / kind + labels rule (200+ runs)', () => {
    fc.assert(
      fc.property(validSceneArbitrary(), (scene) => {
        const title = savedTitle(scene);
        expect(title.trim().length).toBeGreaterThan(0);
        expect(title).toBe(title.trim());

        const sceneTitle = typeof scene.title === 'string' ? scene.title.trim() : '';
        if (sceneTitle !== '') {
          expect(title).toBe(sceneTitle);
          return;
        }
        const labels = (scene.points ?? [])
          .map((p) => (typeof p.label === 'string' ? p.label.trim() : ''))
          .filter((l) => l !== '')
          .slice(0, 3);
        expect(title).toBe(labels.length > 0 ? `${scene.kind}: ${labels.join(', ')}` : scene.kind);
      }),
      { numRuns: 250 },
    );
  });
});

describe('P34 — Re-saving or pinning an existing entry never evicts (Requirements 11.5, 11.6)', () => {
  /**
   * P34: applyAdd with an id that is already stored replaces that entry in
   * place. The count does not change, nothing is evicted (even when the store
   * is full and every entry is pinned), position and all other entries are
   * unchanged. This is the path the Saved Diagrams screen uses to pin and
   * unpin.
   *
   * Validates: Requirements 11.5, 11.6
   */
  it('replacing an existing id keeps count, order and other entries (200+ runs)', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb(), { minLength: 1, maxLength: SAVED_DIAGRAMS_CAP }),
        fc.nat(SAVED_DIAGRAMS_CAP),
        fc.boolean(),
        fc.string({ maxLength: 10 }),
        (entries, pick, pinned, title) => {
          const unique = entries.filter((e, i) => entries.findIndex((o) => o.id === e.id) === i);
          const index = pick % unique.length;
          const original = unique[index]!;
          const replacement: SavedDiagram = { ...original, pinned, title };

          const result = applyAdd(unique, replacement, SAVED_DIAGRAMS_CAP);

          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(result.evictedId).toBeUndefined();
          expect(result.next).toHaveLength(unique.length);
          expect(result.next[index]).toEqual(replacement);
          result.next.forEach((e, i) => {
            if (i !== index) expect(e).toEqual(unique[i]);
          });
        },
      ),
      { numRuns: 250 },
    );
  });

  it('a full store of pinned entries still accepts a pin toggle (200+ runs)', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb(), { minLength: SAVED_DIAGRAMS_CAP, maxLength: SAVED_DIAGRAMS_CAP }),
        fc.nat(SAVED_DIAGRAMS_CAP - 1),
        (raw, pick) => {
          const allPinned = raw.map((e, i) => ({ ...e, id: `id-${i}`, pinned: true }));
          const target = allPinned[pick]!;
          const result = applyAdd(allPinned, { ...target, pinned: false }, SAVED_DIAGRAMS_CAP);
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.next).toHaveLength(SAVED_DIAGRAMS_CAP);
            expect(result.evictedId).toBeUndefined();
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('P35 — Corrupt storage never crashes the reader (Requirement 11.7)', () => {
  /**
   * P35a: deserialise never throws on any input and returns either undefined
   * or a fully typed entry.
   *
   * Validates: Requirement 11.7
   */
  it('deserialise never throws and returns undefined or a well-typed entry (200+ runs)', () => {
    fc.assert(
      fc.property(fc.oneof(fc.anything(), fc.string(), fc.jsonValue().map((v) => JSON.stringify(v))), (raw) => {
        const result = deserialise(raw);
        if (result === undefined) return;
        expect(typeof result.id).toBe('string');
        expect(result.id.trim()).not.toBe('');
        expect(Number.isFinite(result.createdAt)).toBe(true);
        expect(typeof result.title).toBe('string');
        expect(typeof result.thumbnailDataUrl).toBe('string');
        expect(typeof result.pinned).toBe('boolean');
        expect(['geometry', 'function_graph', 'bar_chart', 'unknown']).toContain(result.scene.kind);
      }),
      { numRuns: 400 },
    );
  });

  /**
   * P35b: a stored entry that is missing a required field, or has one of the
   * wrong type, is dropped rather than returned half-formed.
   */
  it('an entry with a missing or mistyped required field is rejected (200+ runs)', () => {
    const keys = ['id', 'createdAt', 'title', 'thumbnailDataUrl', 'scene', 'pinned'] as const;
    fc.assert(
      fc.property(
        entryArb(),
        fc.constantFrom(...keys),
        fc.constantFrom<'missing' | 'wrongType'>('missing', 'wrongType'),
        (entry, key, how) => {
          const stored: Record<string, unknown> = JSON.parse(serialise(entry)) as Record<string, unknown>;
          if (how === 'missing') delete stored[key];
          else stored[key] = key === 'pinned' || key === 'createdAt' ? 'x' : 42;
          expect(deserialise(stored)).toBeUndefined();
        },
      ),
      { numRuns: 250 },
    );
  });
});

describe('Task 20.4 — savedTitle localized kind names (Req 11.1)', () => {
  const base = (kind: SceneKind, labels: string[] = []): DiagramScene => ({
    version: 1,
    kind,
    title: null,
    points: labels.map((label, i) => ({ id: `p${i}`, x: 0.1, y: 0.1, label })),
    segments: [],
    polylines: [],
    bars: [],
    axes: null,
  });

  it('speaks Hindi kind names', () => {
    expect(savedTitle(base('geometry'), 'hi')).toBe('ज्यामिति');
    expect(savedTitle(base('function_graph'), 'hi')).toBe('फलन ग्राफ़');
    expect(savedTitle(base('bar_chart'), 'hi')).toBe('बार चार्ट');
    expect(savedTitle(base('unknown'), 'hi')).toBe('आरेख');
    expect(savedTitle(base('geometry', ['A', 'B']), 'hi')).toBe('ज्यामिति: A, B');
  });

  it('speaks Gujarati kind names', () => {
    expect(savedTitle(base('geometry'), 'gu')).toBe('ભૂમિતિ');
    expect(savedTitle(base('function_graph'), 'gu')).toBe('વિધેય આલેખ');
    expect(savedTitle(base('bar_chart'), 'gu')).toBe('સ્તંભ આલેખ');
    expect(savedTitle(base('unknown'), 'gu')).toBe('આકૃતિ');
    expect(savedTitle(base('bar_chart', ['X']), 'gu')).toBe('સ્તંભ આલેખ: X');
  });

  it('keeps the raw kind for en and unrecognized languages', () => {
    expect(savedTitle(base('geometry'), 'en')).toBe('geometry');
    expect(savedTitle(base('geometry'), 'fr')).toBe('geometry');
    expect(savedTitle(base('geometry'))).toBe('geometry');
  });
});
