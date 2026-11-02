import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { hitTest, DEFAULT_RADII } from '../src/core/hitTest';
import { makeViewport, toScreen } from '../src/core/geometry';
import type { DiagramScene, Point, Segment } from '../src/core/scene';

describe('P1 — Every point is reachable', () => {
  /**
   * P1: For any DiagramScene with at least one point and any viewport with
   * realistic dimensions, hitTest at a point's exact screen position returns
   * that vertex — { kind: 'vertex', id: point.id }.
   *
   * The generator ensures every pair of points is separated by more than the
   * vertex radius (22 CSS px) in screen space, so no two points share the
   * same pixel after projection through toScreen. This avoids distance-0
   * ties where the first point in iteration order would win instead of the
   * one under test. The property itself is unchanged: at a point's own screen
   * position, the distance to that point is 0 — the global minimum — so
   * hitTest returns it.
   *
   * At a point's screen position the distance to that point is exactly 0,
   * the global minimum, so it is always the closest vertex and is returned
   * (Requirement 4.3: vertex hit). Because the vertex check short-circuits
   * before any line check, a point that is also a segment endpoint (so the
   * segment passes through it, distToSegment = 0) is still classified as a
   * vertex rather than a line (Requirement 4.6: vertex priority).
   *
   * Validates: Requirements 4.3, 4.6
   */
  it('hitTest at each point screen position returns that vertex (200+ runs)', () => {
    const minSep = DEFAULT_RADII.vertex; // 22 px - > vertex radius ensures no tie

    // Realistic canvas sizes (real phones are 300+ px). Using fc.double for
    // better precision than fc.float (32-bit), which was producing denormals
    // (1e-45) that collapsed to the same screen pixel in tiny viewports.
    const dimensionsArb = fc.record({
      w: fc.double({ min: 200, max: 2000, noNaN: true }),
      h: fc.double({ min: 200, max: 2000, noNaN: true }),
    });

    // Generate viewport and points together so the screen-space separation
    // filter can use the actual viewport.
    const sceneArb = dimensionsArb.chain(({ w, h }) => {
      const view = makeViewport(w, h);

      const coordArb = fc.record({
        x: fc.double({ min: 0, max: 1, noNaN: true }),
        y: fc.double({ min: 0, max: 1, noNaN: true }),
        label: fc.option(fc.string({ maxLength: 8 }), { nil: null }),
      });

      // Points must be > minSep apart in screen space (not just normalized
      // space). Two distinct normalized points can collapse to the same
      // screen pixel when the viewport is small or the coordinates differ by
      // less than one pixel. Requiring > vertex-radius separation ensures
      // each point is the unique closest vertex at its own screen position.
      const pointsArb = fc
        .array(coordArb, { minLength: 1, maxLength: 5 })
        .filter((coords) => {
          const screen = coords.map((c) => toScreen({ x: c.x, y: c.y }, view));
          for (let i = 0; i < screen.length; i++) {
            for (let j = i + 1; j < screen.length; j++) {
              const si = screen[i]!;
              const sj = screen[j]!;
              if (Math.hypot(si.x - sj.x, si.y - sj.y) <= minSep) return false;
            }
          }
          return true;
        })
        .map(
          (coords): Point[] =>
            coords.map((c, i) => ({
              id: 'p' + i,
              x: c.x,
              y: c.y,
              label: c.label,
            })),
        );

      // 0-3 segments whose endpoints reference the generated points,
      // so segment endpoints coincide with points and exercise vertex-over-line.
      return pointsArb.chain((points) => {
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
                      id: 's' + i,
                      a: points[s.aIdx]!.id,
                      b: points[s.bIdx]!.id,
                    })),
                );
        return segArb.map((segments) => ({ points, segments, view }));
      });
    });

    fc.assert(
      fc.property(
        sceneArb,
        ({ points, segments, view }) => {
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

describe('P1 — Tie rule (regression from flake)', () => {
  /**
   * Documents the tie rule discovered by the P1 property test: when two
   * points share the same screen position (which can happen when normalized
   * coordinates differ by less than one pixel in the viewport), hitTest
   * returns the first one in iteration order. This is correct and
   * deterministic — the P1 property simply cannot distinguish them, so the
   * generator now prevents ties by requiring screen-space separation greater
   * than the vertex radius.
   *
   * Counterexample from fast-check run 2 (seed -732699702), where two points
   * differing by 1.4e-45 in normalized y collapsed to the same pixel in a
   * ~1px viewport.
   */
  it('two points on the same pixel: the first one wins', () => {
    const view = makeViewport(1, 1.0000001192092896);
    const pts: Point[] = [
      { id: 'p0', x: 0.9999992847442627, y: 0 },
      { id: 'p1', x: 0.9999992847442627, y: 1.401298464324817e-45 },
    ];
    const scene: DiagramScene = { kind: 'geometry', points: pts };

    // Both points project to the same screen position
    const s0 = toScreen({ x: pts[0]!.x, y: pts[0]!.y }, view);
    const s1 = toScreen({ x: pts[1]!.x, y: pts[1]!.y }, view);
    expect(s0).toEqual(s1);

    // hitTest at that shared position returns the first point
    const result = hitTest(scene, s0, view, DEFAULT_RADII);
    expect(result).toEqual({ kind: 'vertex', id: 'p0' });
  });
});
