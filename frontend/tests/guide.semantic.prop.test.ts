import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { DiagramScene, Point } from '../src/core/scene';
import {
  matchSemanticPhrase,
  resolveSemantic,
  SEMANTIC_NAMES,
} from '../src/guide';

describe('Semantic Targets Property-Based Tests (fast-check >= 200 runs)', () => {
  it('Property 1: peak.y <= every polyline vertex y across all polylines', () => {
    // Generate scenes with 1 to 5 polylines, each with 1 to 20 vertices in [0, 1]
    const polylineVertexArb = fc.tuple(
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true })
    );

    const polylineArb = fc.record({
      id: fc.stringMatching(/^[a-z0-9_-]{1,10}$/),
      points: fc.array(polylineVertexArb, { minLength: 1, maxLength: 20 }),
    });

    const sceneArb = fc.record({
      version: fc.constant(1 as const),
      kind: fc.constant('function_graph' as const),
      polylines: fc.array(polylineArb, { minLength: 1, maxLength: 5 }),
    });

    fc.assert(
      fc.property(sceneArb, (scene) => {
        const peak = resolveSemantic(scene as DiagramScene, 'peak');
        expect(peak).not.toBeNull();
        if (!peak) return;

        expect(peak.label).toBe('peak');
        expect(peak.x).toBeGreaterThanOrEqual(0);
        expect(peak.x).toBeLessThanOrEqual(1);
        expect(peak.y).toBeGreaterThanOrEqual(0);
        expect(peak.y).toBeLessThanOrEqual(1);

        // peak.y <= every vertex y
        for (const poly of scene.polylines) {
          for (const pt of poly.points) {
            expect(peak.y).toBeLessThanOrEqual(pt[1]);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it('Property 2: trough.y >= every polyline vertex y across all polylines', () => {
    const polylineVertexArb = fc.tuple(
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true })
    );

    const polylineArb = fc.record({
      id: fc.stringMatching(/^[a-z0-9_-]{1,10}$/),
      points: fc.array(polylineVertexArb, { minLength: 1, maxLength: 20 }),
    });

    const sceneArb = fc.record({
      version: fc.constant(1 as const),
      kind: fc.constant('function_graph' as const),
      polylines: fc.array(polylineArb, { minLength: 1, maxLength: 5 }),
    });

    fc.assert(
      fc.property(sceneArb, (scene) => {
        const trough = resolveSemantic(scene as DiagramScene, 'trough');
        expect(trough).not.toBeNull();
        if (!trough) return;

        expect(trough.label).toBe('lowest point');
        expect(trough.x).toBeGreaterThanOrEqual(0);
        expect(trough.x).toBeLessThanOrEqual(1);
        expect(trough.y).toBeGreaterThanOrEqual(0);
        expect(trough.y).toBeLessThanOrEqual(1);

        // trough.y >= every vertex y
        for (const poly of scene.polylines) {
          for (const pt of poly.points) {
            expect(trough.y).toBeGreaterThanOrEqual(pt[1]);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it('Property 3: rightAngle target (if any) has an angle within tolerance (90 +/- 3 deg) and 2 incident segments', () => {
    // Generate scenes with 2 to 8 points and 1 to 10 segments connecting them
    const pointArb = fc.record({
      id: fc.stringMatching(/^[A-Z][0-9]?$/),
      x: fc.double({ min: 0.05, max: 0.95, noNaN: true }),
      y: fc.double({ min: 0.05, max: 0.95, noNaN: true }),
    });

    const pointsListArb = fc
      .array(pointArb, { minLength: 3, maxLength: 8 })
      .map((pts) => {
        // Ensure unique point IDs
        const seen = new Set<string>();
        return pts.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
      })
      .filter((pts) => pts.length >= 3);

    const sceneArb = pointsListArb.chain((points) => {
      const ids = points.map((p) => p.id);
      const segmentArb = fc.record({
        id: fc.stringMatching(/^s[0-9]{1,3}$/),
        a: fc.constantFrom(...ids),
        b: fc.constantFrom(...ids),
      });

      return fc.record({
        version: fc.constant(1 as const),
        kind: fc.constant('geometry' as const),
        points: fc.constant(points),
        segments: fc.array(segmentArb, { minLength: 2, maxLength: 10 }),
      });
    });

    fc.assert(
      fc.property(sceneArb, (scene) => {
        const target = resolveSemantic(scene as DiagramScene, 'rightAngle');
        if (target) {
          // Find the matching point in scene.points
          const matchedPoint = scene.points.find(
            (p) => Math.abs(p.x - target.x) < 1e-5 && Math.abs(p.y - target.y) < 1e-5
          );
          expect(matchedPoint).toBeDefined();
          if (!matchedPoint) return;

          // Must have EXACTLY two incident segments
          const incident = scene.segments.filter(
            (s) => s.a === matchedPoint.id || s.b === matchedPoint.id
          );
          expect(incident.length).toBe(2);
          const s1 = incident[0];
          const s2 = incident[1];
          if (!s1 || !s2) return;

          const id1 = s1.a === matchedPoint.id ? s1.b : s1.a;
          const id2 = s2.a === matchedPoint.id ? s2.b : s2.a;
          expect(id1).not.toBe(id2);

          const p1 = scene.points.find((p) => p.id === id1);
          const p2 = scene.points.find((p) => p.id === id2);
          expect(p1).toBeDefined();
          expect(p2).toBeDefined();
          if (!p1 || !p2) return;

          const v1x = p1.x - matchedPoint.x;
          const v1y = p1.y - matchedPoint.y;
          const v2x = p2.x - matchedPoint.x;
          const v2y = p2.y - matchedPoint.y;
          const len1 = Math.hypot(v1x, v1y);
          const len2 = Math.hypot(v2x, v2y);
          expect(len1).toBeGreaterThan(1e-9);
          expect(len2).toBeGreaterThan(1e-9);

          const dot = v1x * v2x + v1y * v2y;
          const cosTheta = Math.max(-1, Math.min(1, dot / (len1 * len2)));
          const angleDeg = (Math.acos(cosTheta) * 180) / Math.PI;

          // Angle is within 90 +/- 3 degrees
          expect(Math.abs(angleDeg - 90)).toBeLessThanOrEqual(3.0001);
        }
      }),
      { numRuns: 300 }
    );
  });

  it('Property 4: tallestBar has value >= every other bar with finite value', () => {
    const barArb = fc.record({
      id: fc.stringMatching(/^[a-z0-9_-]{1,8}$/),
      label: fc.stringMatching(/^[A-Za-z0-9]{1,8}$/),
      x0: fc.double({ min: 0.1, max: 0.4, noNaN: true }),
      x1: fc.double({ min: 0.5, max: 0.9, noNaN: true }),
      y_base: fc.constant(0.9),
      y_top: fc.double({ min: 0.1, max: 0.8, noNaN: true }),
      value: fc.double({ min: -1000, max: 1000, noNaN: true }),
    });

    const sceneArb = fc.record({
      version: fc.constant(1 as const),
      kind: fc.constant('bar_chart' as const),
      bars: fc.uniqueArray(barArb, { selector: (b) => b.id, minLength: 1, maxLength: 10 }),
    });

    fc.assert(
      fc.property(sceneArb, (scene) => {
        const target = resolveSemantic(scene as DiagramScene, 'tallestBar');
        expect(target).not.toBeNull();
        if (!target) return;

        let maxVal = -Infinity;
        let expectedBar = scene.bars[0]!;
        for (const b of scene.bars) {
          if (b.value > maxVal) {
            maxVal = b.value;
            expectedBar = b;
          }
        }

        // The target label matches the winning bar's label or id
        expect(target.label).toBe(expectedBar.label || expectedBar.id);
        expect(expectedBar.value).toBe(maxVal);
      }),
      { numRuns: 200 }
    );
  });

  it('Property 5: shortestBar has value <= every other bar with finite value', () => {
    const barArb = fc.record({
      id: fc.stringMatching(/^[a-z0-9_-]{1,8}$/),
      label: fc.stringMatching(/^[A-Za-z0-9]{1,8}$/),
      x0: fc.double({ min: 0.1, max: 0.4, noNaN: true }),
      x1: fc.double({ min: 0.5, max: 0.9, noNaN: true }),
      y_base: fc.constant(0.9),
      y_top: fc.double({ min: 0.1, max: 0.8, noNaN: true }),
      value: fc.double({ min: -1000, max: 1000, noNaN: true }),
    });

    const sceneArb = fc.record({
      version: fc.constant(1 as const),
      kind: fc.constant('bar_chart' as const),
      bars: fc.uniqueArray(barArb, { selector: (b) => b.id, minLength: 1, maxLength: 10 }),
    });

    fc.assert(
      fc.property(sceneArb, (scene) => {
        const target = resolveSemantic(scene as DiagramScene, 'shortestBar');
        expect(target).not.toBeNull();
        if (!target) return;

        let minVal = Infinity;
        let expectedBar = scene.bars[0]!;
        for (const b of scene.bars) {
          if (b.value < minVal) {
            minVal = b.value;
            expectedBar = b;
          }
        }

        expect(target.label).toBe(expectedBar.label || expectedBar.id);
        expect(expectedBar.value).toBe(minVal);
      }),
      { numRuns: 200 }
    );
  });

  it('Property 6: longestSide has length >= every other valid segment', () => {
    const pointArb = fc.record({
      id: fc.stringMatching(/^[A-Z][0-9]?$/),
      x: fc.double({ min: 0, max: 1, noNaN: true }),
      y: fc.double({ min: 0, max: 1, noNaN: true }),
    });

    const pointsListArb = fc
      .array(pointArb, { minLength: 2, maxLength: 6 })
      .map((pts) => {
        const seen = new Set<string>();
        return pts.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
      })
      .filter((pts) => pts.length >= 2);

    const sceneArb = pointsListArb.chain((points) => {
      const ids = points.map((p) => p.id);
      const segmentArb = fc.record({
        id: fc.stringMatching(/^s[0-9]{1,3}$/),
        a: fc.constantFrom(...ids),
        b: fc.constantFrom(...ids),
      });

      return fc.record({
        version: fc.constant(1 as const),
        kind: fc.constant('geometry' as const),
        points: fc.constant(points),
        segments: fc.uniqueArray(segmentArb, { selector: (s) => s.id, minLength: 1, maxLength: 8 }),
      });
    });

    fc.assert(
      fc.property(sceneArb, (scene) => {
        const target = resolveSemantic(scene as DiagramScene, 'longestSide');
        if (!target) return;

        // Calculate max length among all segments (ties: first in document order)
        const pMap = new Map<string, Point>();
        for (const p of scene.points) pMap.set(p.id, p);

        let maxLen = -1;
        let expectedSeg = scene.segments[0]!;
        for (const seg of scene.segments) {
          const pa = pMap.get(seg.a);
          const pb = pMap.get(seg.b);
          if (pa && pb) {
            const l = Math.hypot(pb.x - pa.x, pb.y - pa.y);
            if (l > maxLen) {
              maxLen = l;
              expectedSeg = seg;
            }
          }
        }

        const pa = pMap.get(expectedSeg.a)!;
        const pb = pMap.get(expectedSeg.b)!;
        expect(target.x).toBeCloseTo((pa.x + pb.x) / 2, 5);
        expect(target.y).toBeCloseTo((pa.y + pb.y) / 2, 5);
      }),
      { numRuns: 200 }
    );
  });

  it('Property 7: matchSemanticPhrase totality: never throws on arbitrary random unicode/control strings', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const result = matchSemanticPhrase(raw);
        if (result !== null) {
          expect(SEMANTIC_NAMES).toContain(result);
        }
      }),
      { numRuns: 300 }
    );
  });
});
