import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applyEdit,
  canRedo,
  canUndo,
  createHistory,
  deletePoint,
  deleteSegment,
  historyReducer,
  movePoint,
  redo,
  renameLabel,
  undo,
  validateSceneInvariants,
  type HistoryAction,
} from '../src/core/correct';
import type { Bar, DiagramScene, Point, Polyline, Segment } from '../src/core/scene';

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

// ---------------------------------------------------------------------------
// Kiro additions (Task 19.2, 19.3): P31, P32 and a P17 supplement
// ---------------------------------------------------------------------------

/**
 * A valid scene that always contains every element kind: at least two points,
 * one segment, one polyline, one bar, and both axes. All ids are unique.
 */
function richSceneArb(): fc.Arbitrary<DiagramScene> {
  const unit = fc.double({ min: 0, max: 1, noNaN: true });
  const label = fc.option(fc.string({ minLength: 1, maxLength: 8 }), { nil: null });
  return fc
    .record({
      pts: fc.array(fc.record({ x: unit, y: unit, label }), { minLength: 2, maxLength: 6 }),
      extraSegs: fc.array(fc.tuple(fc.nat(5), fc.nat(5)), { maxLength: 4 }),
      lines: fc.array(fc.array(fc.tuple(unit, unit), { minLength: 2, maxLength: 5 }), {
        minLength: 1,
        maxLength: 2,
      }),
      bars: fc.array(
        fc.record({ x0: unit, x1: unit, yTop: unit, yBase: unit, value: fc.double({ min: 0, max: 100, noNaN: true }) }),
        { minLength: 1, maxLength: 2 },
      ),
      xAxis: unit,
      yAxis: unit,
      title: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
    })
    .map((g): DiagramScene => {
      const points: Point[] = g.pts.map((p, i) => ({ id: `p${i}`, x: p.x, y: p.y, label: p.label }));
      const n = points.length;
      const segments: Segment[] = [{ id: 's0', a: 'p0', b: 'p1', label: null }];
      g.extraSegs.forEach(([a, b], i) => {
        if (a % n !== b % n) segments.push({ id: `s${i + 1}`, a: `p${a % n}`, b: `p${b % n}`, label: null });
      });
      const polylines: Polyline[] = g.lines.map((pts, i) => ({ id: `pl${i}`, points: pts, label: null }));
      const bars: Bar[] = g.bars.map((b, i) => ({
        id: `b${i}`,
        label: `bar ${i}`,
        value: b.value,
        x0: b.x0,
        x1: b.x1,
        y_top: b.yTop,
        y_base: b.yBase,
      }));
      return {
        version: 1,
        kind: 'geometry',
        title: g.title,
        points,
        segments,
        polylines,
        bars,
        axes: { x_axis_y: g.xAxis, y_axis_x: g.yAxis },
      };
    });
}

/** Any number a pointer or a bug could produce, including the awkward ones. */
const anyNumberArb = fc.oneof(
  fc.double(),
  fc.constantFrom(Number.NaN, Infinity, -Infinity, 1e308, -1e308, 0, -0, 1, 1.0000001, -0.0000001),
);

/** Unwrap an array that the scene type marks optional. */
function listOf<T>(value: T[] | undefined): T[] {
  return value ?? [];
}

describe('P31 — Edit operations are total, local and bounded (Requirement 9.2)', () => {
  /**
   * P31: for any scene and any numeric input (including NaN and Infinity):
   * movePoint never throws, leaves every other element equal, never mutates
   * its input, and returns coordinates inside [0, 1].
   *
   * Validates: Requirement 9.2
   */
  it('movePoint is total, bounded, and touches only its target (200+ runs)', () => {
    fc.assert(
      fc.property(richSceneArb(), fc.nat(5), anyNumberArb, anyNumberArb, (scene, idx, x, y) => {
        const snapshot = structuredClone(scene);
        const points = listOf(scene.points);
        const target = points[idx % points.length]!;

        const next = movePoint(scene, target.id, x, y);

        expect(scene).toEqual(snapshot); // input not mutated
        const moved = listOf(next.points).find((p) => p.id === target.id)!;
        expect(moved.x).toBeGreaterThanOrEqual(0);
        expect(moved.x).toBeLessThanOrEqual(1);
        expect(moved.y).toBeGreaterThanOrEqual(0);
        expect(moved.y).toBeLessThanOrEqual(1);
        expect(moved.id).toBe(target.id);
        expect(moved.label).toBe(target.label);
        if (Number.isFinite(x)) expect(moved.x).toBe(Math.min(1, Math.max(0, x)));
        if (Number.isFinite(y)) expect(moved.y).toBe(Math.min(1, Math.max(0, y)));

        // Every other element is untouched
        expect(listOf(next.points).filter((p) => p.id !== target.id)).toEqual(
          points.filter((p) => p.id !== target.id),
        );
        expect(next.segments).toEqual(scene.segments);
        expect(next.polylines).toEqual(scene.polylines);
        expect(next.bars).toEqual(scene.bars);
        expect(next.axes).toEqual(scene.axes);
        expect(validateSceneInvariants(next).ok).toBe(true);
      }),
      { numRuns: 250 },
    );
  });

  it('movePoint on an unknown id returns the same scene (200+ runs)', () => {
    fc.assert(
      fc.property(richSceneArb(), anyNumberArb, anyNumberArb, (scene, x, y) => {
        expect(movePoint(scene, 'no-such-point', x, y)).toBe(scene);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * renameLabel trims, changes exactly one label, and rejects blank labels
   * with an Error rather than a silent no-op.
   */
  it('renameLabel changes exactly one label and trims it (200+ runs)', () => {
    fc.assert(
      fc.property(
        richSceneArb(),
        fc.nat(20),
        fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim().length > 0),
        fc.constantFrom('', ' ', '  '),
        (scene, pick, raw, pad) => {
          const snapshot = structuredClone(scene);
          const ids = [
            ...listOf(scene.points).map((p) => p.id),
            ...listOf(scene.segments).map((s) => s.id),
            ...listOf(scene.polylines).map((p) => p.id),
            ...listOf(scene.bars).map((b) => b.id),
          ];
          const id = ids[pick % ids.length]!;
          const next = renameLabel(scene, id, `${pad}${raw}${pad}`);

          expect(scene).toEqual(snapshot);
          const all = (s: DiagramScene) => [
            ...listOf(s.points),
            ...listOf(s.segments),
            ...listOf(s.polylines),
            ...listOf(s.bars),
          ];
          const after = all(next);
          const before = all(scene);
          expect(after.map((e) => e.id)).toEqual(before.map((e) => e.id));
          after.forEach((e, i) => {
            if (e.id === id) expect(e.label).toBe(raw.trim());
            else expect(e).toEqual(before[i]);
          });
        },
      ),
      { numRuns: 250 },
    );
  });

  it('renameLabel rejects blank labels with an Error and never mutates (200+ runs)', () => {
    fc.assert(
      fc.property(richSceneArb(), fc.constantFrom('', ' ', '   ', '\t', '\n '), (scene, blank) => {
        const snapshot = structuredClone(scene);
        expect(() => renameLabel(scene, 'p0', blank)).toThrow(Error);
        expect(scene).toEqual(snapshot);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * deletePoint removes the point and exactly the segments that touch it;
   * deleteSegment removes only that segment. Both keep the scene valid.
   */
  it('deletePoint removes the point and only its incident segments (200+ runs)', () => {
    fc.assert(
      fc.property(richSceneArb(), fc.nat(5), (scene, idx) => {
        const snapshot = structuredClone(scene);
        const points = listOf(scene.points);
        const target = points[idx % points.length]!;
        const next = deletePoint(scene, target.id);

        expect(scene).toEqual(snapshot);
        expect(listOf(next.points)).toEqual(points.filter((p) => p.id !== target.id));
        expect(listOf(next.segments)).toEqual(
          listOf(scene.segments).filter((s) => s.a !== target.id && s.b !== target.id),
        );
        expect(next.polylines).toEqual(scene.polylines);
        expect(next.bars).toEqual(scene.bars);
        expect(validateSceneInvariants(next).ok).toBe(true);
      }),
      { numRuns: 250 },
    );
  });

  it('deleteSegment removes only that segment and keeps all points (200+ runs)', () => {
    fc.assert(
      fc.property(richSceneArb(), fc.nat(5), (scene, idx) => {
        const segments = listOf(scene.segments);
        const target = segments[idx % segments.length]!;
        const next = deleteSegment(scene, target.id);

        expect(listOf(next.segments)).toEqual(segments.filter((s) => s.id !== target.id));
        expect(next.points).toEqual(scene.points);
        expect(validateSceneInvariants(next).ok).toBe(true);
      }),
      { numRuns: 250 },
    );
  });
});

describe('P32 — The invariant checker catches every violation (Requirement 9.3)', () => {
  /**
   * P32: validateSceneInvariants accepts every well-formed scene and rejects
   * a well-formed scene after any single injected violation. This is what
   * makes P16 meaningful: a checker that misses a violation would let P16
   * pass on a broken scene.
   *
   * Validates: Requirements 9.2, 9.3
   */
  it('accepts every well-formed scene, including polylines, bars and axes (200+ runs)', () => {
    fc.assert(
      fc.property(richSceneArb(), (scene) => {
        const result = validateSceneInvariants(scene);
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
      }),
      { numRuns: 250 },
    );
  });

  const badCoordArb = fc.constantFrom(-0.0001, 1.0001, -5, 5, Number.NaN, Infinity, -Infinity);

  it('rejects any single injected violation (200+ runs)', () => {
    const violationArb = fc.constantFrom(
      'duplicatePointId',
      'segmentReusesPointId',
      'danglingSegmentA',
      'danglingSegmentB',
      'pointX',
      'pointY',
      'polylineX',
      'polylineY',
      'barX0',
      'barX1',
      'barYTop',
      'barYBase',
      'axisX',
      'axisY',
    );
    fc.assert(
      fc.property(richSceneArb(), violationArb, badCoordArb, (scene, violation, bad) => {
        const broken = structuredClone(scene);
        const pts = listOf(broken.points);
        const seg = listOf(broken.segments)[0]!;
        const line = listOf(broken.polylines)[0]!;
        const bar = listOf(broken.bars)[0]!;
        switch (violation) {
          case 'duplicatePointId':
            pts[1]!.id = pts[0]!.id;
            // keep references resolvable so only the duplicate is wrong
            break;
          case 'segmentReusesPointId':
            seg.id = pts[0]!.id;
            break;
          case 'danglingSegmentA':
            seg.a = 'ghost';
            break;
          case 'danglingSegmentB':
            seg.b = 'ghost';
            break;
          case 'pointX':
            pts[0]!.x = bad;
            break;
          case 'pointY':
            pts[0]!.y = bad;
            break;
          case 'polylineX':
            line.points[0] = [bad, 0.5];
            break;
          case 'polylineY':
            line.points[0] = [0.5, bad];
            break;
          case 'barX0':
            bar.x0 = bad;
            break;
          case 'barX1':
            bar.x1 = bad;
            break;
          case 'barYTop':
            bar.y_top = bad;
            break;
          case 'barYBase':
            bar.y_base = bad;
            break;
          case 'axisX':
            broken.axes = { ...broken.axes, x_axis_y: bad };
            break;
          case 'axisY':
            broken.axes = { ...broken.axes, y_axis_x: bad };
            break;
        }
        const result = validateSceneInvariants(broken);
        expect(result.ok, `${violation} with ${String(bad)} was not detected`).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: 400 },
    );
  });
});

describe('P17 supplement — History reducer bookkeeping (Requirement 9.2)', () => {
  /**
   * For any sequence of apply / undo / redo / reset actions:
   * - undo and redo preserve the total number of snapshots (past + future),
   * - a new apply always clears the redo stack,
   * - canUndo / canRedo agree with the stacks,
   * - undo then redo returns the identical state.
   */
  it('keeps the stacks consistent for any action sequence (200+ runs)', () => {
    const actionArb = (scene: DiagramScene): fc.Arbitrary<HistoryAction> =>
      fc.oneof(
        fc.constant<HistoryAction>({ type: 'undo' }),
        fc.constant<HistoryAction>({ type: 'redo' }),
        fc
          .tuple(fc.nat(5), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }))
          .map(([i, x, y]): HistoryAction => ({
            type: 'apply',
            scene: movePoint(scene, `p${i % listOf(scene.points).length}`, x, y),
          })),
        fc.constant<HistoryAction>({ type: 'reset', scene }),
      );

    fc.assert(
      fc.property(
        richSceneArb().chain((scene) => fc.tuple(fc.constant(scene), fc.array(actionArb(scene), { maxLength: 25 }))),
        ([scene, actions]) => {
          let state = createHistory(scene);
          for (const action of actions) {
            const before = state;
            state = historyReducer(state, action);

            expect(canUndo(state)).toBe(state.past.length > 0);
            expect(canRedo(state)).toBe(state.future.length > 0);

            if (action.type === 'undo' || action.type === 'redo') {
              expect(state.past.length + state.future.length).toBe(before.past.length + before.future.length);
            }
            if (action.type === 'apply' && state !== before) {
              expect(state.future).toEqual([]);
            }
            if (action.type === 'reset') {
              expect(state.past).toEqual([]);
              expect(state.future).toEqual([]);
            }
            if (action.type === 'undo' && canUndo(before)) {
              expect(redo(state)).toEqual(before);
            }
          }
        },
      ),
      { numRuns: 250 },
    );
  });
});
