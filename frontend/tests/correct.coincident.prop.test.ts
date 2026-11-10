/**
 * P82 (Kiro, task 39.5, Requirement 23.6; audit u1-g1 Finding 7): no two points share a position.
 * Pressing "Add point" twice at the centre used to stack D on top of C, and `hitTestPoint` (nearest
 * wins, the later point on a tie) then never selected C again.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { COINCIDENT_EPSILON, NUDGE_STEP, addPoint, validateSceneInvariants } from '../src/core/correct';
import type { DiagramScene, Point } from '../src/core/scene';
import { hitTestPoint } from '../src/flow/correct';

const RUNS = { numRuns: 250 };

function noTwoShare(points: readonly Point[]): boolean {
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!;
      const b = points[j]!;
      if (Math.abs(a.x - b.x) <= COINCIDENT_EPSILON && Math.abs(a.y - b.y) <= COINCIDENT_EPSILON) return false;
    }
  }
  return true;
}

/** Coordinates that hit the same spots often: a coarse grid, the edges, the centre, out of range. */
const coordArb = fc.oneof(
  fc.constantFrom(0, 0.5, 1, -3, 7, 0.04, 0.96),
  fc.integer({ min: 0, max: 10 }).map((n) => n / 10),
  fc.double({ min: -2, max: 3, noNaN: true }),
);

const startArb: fc.Arbitrary<DiagramScene> = fc
  .uniqueArray(fc.tuple(fc.integer({ min: 0, max: 10 }), fc.integer({ min: 0, max: 10 })), {
    maxLength: 12,
    selector: ([x, y]) => `${x},${y}`,
  })
  .map((cells) => ({
    version: 1,
    kind: 'geometry',
    points: cells.map(([x, y], i) => ({ id: `s${i}`, x: x / 10, y: y / 10 })),
  }));

describe('P82: no two points share a position (23.6)', () => {
  it('any sequence of adds keeps every point apart, in range, and the old points fixed', () => {
    fc.assert(
      fc.property(startArb, fc.array(fc.tuple(coordArb, coordArb), { minLength: 1, maxLength: 20 }), (start, adds) => {
        let scene = start;
        for (const [x, y] of adds) {
          const before = scene.points ?? [];
          const next = addPoint(scene, x, y);
          const after = next.points ?? [];
          expect(after.length).toBe(before.length + 1);
          expect(after.slice(0, -1)).toEqual(before); // existing points never move
          const p = after.at(-1)!;
          const cx = Math.max(0, Math.min(1, x));
          const cy = Math.max(0, Math.min(1, y));
          const wasFree = !before.some((q) => Math.abs(q.x - cx) <= COINCIDENT_EPSILON && Math.abs(q.y - cy) <= COINCIDENT_EPSILON);
          if (wasFree) expect([p.x, p.y]).toEqual([cx, cy]);
          else {
            // Nudged by a whole number of steps along one of the eight directions.
            const rx = Math.round((p.x - cx) / NUDGE_STEP);
            const ry = Math.round((p.y - cy) / NUDGE_STEP);
            expect(rx === 0 || ry === 0 || Math.abs(rx) === Math.abs(ry)).toBe(true);
            expect(Math.max(Math.abs(rx), Math.abs(ry))).toBeGreaterThanOrEqual(1);
          }
          expect(noTwoShare(after)).toBe(true);
          expect(validateSceneInvariants(next).ok).toBe(true);
          scene = next;
        }
      }),
      RUNS,
    );
  });

  it('the audit case: two adds at the centre, and each point is selected by a tap on it', () => {
    const c: DiagramScene = { version: 1, kind: 'geometry', points: [{ id: 'C', x: 0.5, y: 0.5 }] };
    const scene = addPoint(addPoint(c, 0.5, 0.5), 0.5, 0.5);
    const pts = scene.points!;
    expect(pts.map((p) => [p.id, p.x, p.y])).toEqual([
      ['C', 0.5, 0.5],
      ['A', 0.54, 0.5],
      ['B', 0.5, 0.54],
    ]);
    for (const p of pts) expect(hitTestPoint(pts, p.x * 400, p.y * 400, 400, 400)?.id).toBe(p.id);
  });

  it('a corner nudges inwards', () => {
    const s: DiagramScene = { version: 1, kind: 'geometry', points: [{ id: 'A', x: 1, y: 1 }] };
    expect(addPoint(s, 5, 5).points!.at(-1)).toMatchObject({ x: 0.96, y: 1 });
  });
});
