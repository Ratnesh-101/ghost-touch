import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applyEdit,
  createHistory,
  deletePoint,
  deleteSegment,
  movePoint,
  redo,
  renameLabel,
  undo,
  validateSceneInvariants,
} from '../src/core/correct';
import type { DiagramScene, Point, Segment } from '../src/core/scene';

/**
 * Fast-check arbitrary for a structurally valid DiagramScene.
 */
function validSceneArb(): fc.Arbitrary<DiagramScene> {
  const coordArb = fc.record({
    x: fc.double({ min: 0, max: 1, noNaN: true }),
    y: fc.double({ min: 0, max: 1, noNaN: true }),
    label: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
  });

  return fc
    .array(coordArb, { minLength: 1, maxLength: 8 })
    .chain((coords) => {
      const points: Point[] = coords.map((c, i) => ({
        id: `p${i}`,
        x: c.x,
        y: c.y,
        label: c.label,
      }));

      const n = points.length;
      const segArb =
        n < 2
          ? fc.constant<Segment[]>([])
          : fc
              .array(
                fc
                  .record({
                    aIdx: fc.integer({ min: 0, max: n - 1 }),
                    bIdx: fc.integer({ min: 0, max: n - 1 }),
                    label: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
                  })
                  .filter((s) => s.aIdx !== s.bIdx),
                { maxLength: 6 },
              )
              .map((segs) =>
                segs.map((s, i) => ({
                  id: `s${i}`,
                  a: `p${s.aIdx}`,
                  b: `p${s.bIdx}`,
                  label: s.label,
                })),
              );

      return segArb.map(
        (segments): DiagramScene => ({
          kind: 'geometry',
          title: 'Property Test Scene',
          points,
          segments,
        }),
      );
    });
}

type EditOperation =
  | { kind: 'move'; pointId: string; x: number; y: number }
  | { kind: 'rename'; elementId: string; label: string }
  | { kind: 'deletePoint'; pointId: string }
  | { kind: 'deleteSegment'; segmentId: string };

function editOpArb(): fc.Arbitrary<EditOperation> {
  return fc.oneof(
    // Move: x, y can be out-of-bounds, negative, or normal
    fc.record({
      kind: fc.constant<'move'>('move'),
      pointId: fc.oneof(fc.constantFrom('p0', 'p1', 'p2', 'p3', 'p4', 'p5'), fc.string({ maxLength: 5 })),
      x: fc.double({ min: -5, max: 5, noNaN: true }),
      y: fc.double({ min: -5, max: 5, noNaN: true }),
    }),
    // Rename: valid non-empty label
    fc.record({
      kind: fc.constant<'rename'>('rename'),
      elementId: fc.oneof(
        fc.constantFrom('p0', 'p1', 's0', 's1', 'title'),
        fc.string({ maxLength: 5 }),
      ),
      label: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    }),
    // Delete point
    fc.record({
      kind: fc.constant<'deletePoint'>('deletePoint'),
      pointId: fc.oneof(fc.constantFrom('p0', 'p1', 'p2', 'p3', 'p4', 'p5'), fc.string({ maxLength: 5 })),
    }),
    // Delete segment
    fc.record({
      kind: fc.constant<'deleteSegment'>('deleteSegment'),
      segmentId: fc.oneof(fc.constantFrom('s0', 's1', 's2', 's3'), fc.string({ maxLength: 5 })),
    }),
  );
}

function applyOperation(scene: DiagramScene, op: EditOperation): DiagramScene {
  switch (op.kind) {
    case 'move':
      return movePoint(scene, op.pointId, op.x, op.y);
    case 'rename':
      return renameLabel(scene, op.elementId, op.label);
    case 'deletePoint':
      return deletePoint(scene, op.pointId);
    case 'deleteSegment':
      return deleteSegment(scene, op.segmentId);
  }
}

describe('P16 — Correct edit invariants', () => {
  /**
   * P16: Any sequence of valid edit operations on a valid scene yields a scene
   * that preserves structural invariants: unique IDs, no dangling segment
   * references, and all coordinates in [0, 1].
   *
   * Validates: Requirements 9.2, 9.3
   */
  it('any sequence of edits preserves invariants (200+ runs)', () => {
    fc.assert(
      fc.property(
        validSceneArb(),
        fc.array(editOpArb(), { minLength: 1, maxLength: 15 }),
        (initialScene, operations) => {
          let current = initialScene;
          for (const op of operations) {
            try {
              current = applyOperation(current, op);
            } catch (err) {
              // If an operation is rejected (e.g. empty label), it must be an Error
              expect(err).toBeInstanceOf(Error);
              continue;
            }

            // Invariants must hold after each edit
            const inv = validateSceneInvariants(current);
            expect(inv.ok).toBe(true);
            expect(inv.errors).toEqual([]);

            // Explicit checks
            const pointIds = new Set((current.points ?? []).map((p) => p.id));
            expect(pointIds.size).toBe((current.points ?? []).length);

            for (const seg of current.segments ?? []) {
              expect(pointIds.has(seg.a)).toBe(true);
              expect(pointIds.has(seg.b)).toBe(true);
            }

            for (const pt of current.points ?? []) {
              expect(pt.x).toBeGreaterThanOrEqual(0);
              expect(pt.x).toBeLessThanOrEqual(1);
              expect(pt.y).toBeGreaterThanOrEqual(0);
              expect(pt.y).toBeLessThanOrEqual(1);
            }
          }
        },
      ),
      { numRuns: 250 },
    );
  });
});

describe('P17 — Undo/Redo round-trip', () => {
  /**
   * P17: Undo after any edit restores the previous scene exactly; redo re-applies it.
   *
   * Validates: Requirement 9.2
   */
  it('undo restores previous scene and redo restores edited scene (200+ runs)', () => {
    fc.assert(
      fc.property(validSceneArb(), editOpArb(), (initialScene, op) => {
        let editedScene: DiagramScene;
        try {
          editedScene = applyOperation(initialScene, op);
        } catch {
          return; // Skip rejected operations
        }

        const initialHistory = createHistory(initialScene);
        const historyWithEdit = applyEdit(initialHistory, editedScene);

        expect(historyWithEdit.present).toEqual(editedScene);

        const historyAfterUndo = undo(historyWithEdit);
        expect(historyAfterUndo.present).toEqual(initialScene);

        const historyAfterRedo = redo(historyAfterUndo);
        expect(historyAfterRedo.present).toEqual(editedScene);
      }),
      { numRuns: 250 },
    );
  });

  it('undo and redo work across multiple sequential edits (200+ runs)', () => {
    fc.assert(
      fc.property(
        validSceneArb(),
        fc.array(editOpArb(), { minLength: 2, maxLength: 8 }),
        (initialScene, operations) => {
          const snapshots: DiagramScene[] = [initialScene];
          let current = initialScene;
          let history = createHistory(initialScene);

          for (const op of operations) {
            try {
              const next = applyOperation(current, op);
              if (next !== current) {
                current = next;
                snapshots.push(current);
                history = applyEdit(history, current);
              }
            } catch {
              // Skip rejected edits
            }
          }

          // Undo backwards through snapshots
          for (let i = snapshots.length - 2; i >= 0; i--) {
            history = undo(history);
            expect(history.present).toEqual(snapshots[i]);
          }

          // Redo forwards through snapshots
          for (let i = 1; i < snapshots.length; i++) {
            history = redo(history);
            expect(history.present).toEqual(snapshots[i]);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
