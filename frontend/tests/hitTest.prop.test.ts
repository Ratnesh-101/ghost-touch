import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { hitTest, DEFAULT_RADII } from '../src/core/hitTest';
import { makeViewport, toScreen, type Viewport } from '../src/core/geometry';
import type { DiagramScene, Point, Segment } from '../src/core/scene';

describe('P1 — Every point is reachable', () => {
  /**
   * P1: For any DiagramScene with at least one point and any viewport with
   * positive dimensions, hitTest at a point's exact screen position returns
   * that vertex — `{ kind: 'vertex', id: point.id }`.
   *
   * At a point's screen position the distance to that point is exactly 0 —
   * the global minimum — so it is always the closest vertex and is returned
   * (Requirement 4.3: vertex hit). Because the vertex check short-circuits
   * before any line check, a point that is also a segment endpoint (so the
   * segment passes through it, `distToSegment = 0`) is still classified as a
   * vertex rather than a line (Requirement 4.6: vertex priority).
   *
   * **Validates: Requirements 4.3, 4.6**
   */
  it('hitTest at each point screen position returns that vertex (≥200 runs)', () => {
    // A normalized coordinate pair with an optional label (string | null).
    const coordArb = fc.record({
      x: fc.float({ min: 0, max: 1, noNaN: true }),
      y: fc.float({ min: 0, max: 1, noNaN: true }),
      label: fc.option(fc.string({ maxLength: 8 }), { nil: null }),
    });

    // 1-5 points with distinct (x, y) screen positions. Distinct positions
    // avoid distance-0 ties, where the first point in iteration order would
    // win instead of the one under test.
    const pointsArb = fc
      .uniqueArray(coordArb, {
        minLength: 1,
        maxLength: 5,
        selector: (c) => `${c.x}|${c.y}`,
      })
      .map(
        (coords): Point[] =>
          coords.map((c, i) => ({
            id: `p${i}`,
            x: c.x,
            y: c.y,
            label: c.label,
          })),
      );

    // 0-3 segments whose endpoints reference the *same* generated points, so
    // segment endpoints coincide with points and exercise vertex-over-line.
    const sceneArb = pointsArb.chain((points) => {
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
                  })
                  .filter((s) => s.aIdx !== s.bIdx),
                { maxLength: 3 },
              )
              .map(
                (pairs): Segment[] =>
                  pairs.map((s, i) => ({
                    id: `s${i}`,
                    // aIdx/bIdx are in [0, n-1] = valid indices by construction.
                    a: points[s.aIdx]!.id,
                    b: points[s.bIdx]!.id,
                  })),
              );
      return segArb.map((segments) => ({ points, segments }));
    });

    // Any viewport with positive dimensions (square or letterboxed).
    const dimensionsArb = fc.record({
      w: fc.float({ min: 1, max: 2000, noNaN: true }),
      h: fc.float({ min: 1, max: 2000, noNaN: true }),
    });

    fc.assert(
      fc.property(
        sceneArb,
        dimensionsArb,
        ({ points, segments }, { w, h }) => {
          const view: Viewport = makeViewport(w, h);
          const scene: DiagramScene = { kind: 'geometry', points, segments };

          // Every point must be reachable: test each at its own screen
          // position. At distance 0 the point is the closest vertex and the
          // vertex check short-circuits before any line check.
          for (const p of points) {
            const finger = toScreen({ x: p.x, y: p.y }, view);
            const result = hitTest(scene, finger, view, DEFAULT_RADII);
            expect(result).toEqual(
              expect.objectContaining({ kind: 'vertex', id: p.id }),
            );
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
