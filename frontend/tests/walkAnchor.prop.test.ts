/**
 * Property P170 (task 85, Requirement 51.5): spots lie on a real element and the finger can reach them.
 *
 * Written before `core/walkAnchor.ts`. Oracles are computed here, independently: the peak is the
 * sample with the least y (first on a tie), reachability is a real `hitTest` call.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { hitTest } from '../src/core/hitTest';
import { makeViewport, toScreen } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  ANCHOR_RADIUS_PX,
  REACH_SCALES,
  anchorPoint,
  isAnchorReachable,
  spotReached,
} from '../src/core/walkAnchor';
import sineJson from '../public/samples/sine.json';
import { axesArb, curveArb, graphScene } from './support/walkScenes';
import { runs } from './support/runs';

const sine = sineJson as unknown as DiagramScene;

describe('P170: spot anchors (walkAnchor)', () => {
  it('uses the existing vertex radius and the three scales', () => {
    expect(ANCHOR_RADIUS_PX).toBe(22);
    expect([...REACH_SCALES]).toEqual([200, 360, 600]);
  });

  it('peak is the least-y sample and trough the greatest-y sample, both on the polyline', () => {
    fc.assert(
      fc.property(fc.array(curveArb, { minLength: 1, maxLength: 2 }), axesArb, (curves, axes) => {
        const scene = graphScene(curves, axes);
        const all = curves.flatMap((pts, ci) => pts.map((p, i) => ({ p, ci, i })));
        // Independent oracle (task 87): the extreme y, then the FIRST sample within 1e-9 of it.
        const minY = Math.min(...all.map((s) => s.p[1]));
        const maxY = Math.max(...all.map((s) => s.p[1]));
        const lo = all.find((s) => s.p[1] <= minY + 1e-9)!;
        const hi = all.find((s) => s.p[1] >= maxY - 1e-9)!;
        const peak = anchorPoint(scene, 'peak');
        const trough = anchorPoint(scene, 'trough');
        if (maxY - minY <= 1e-9) {
          expect(peak).toBeNull();
          expect(trough).toBeNull();
          return;
        }
        expect(peak).not.toBeNull();
        expect(trough).not.toBeNull();
        const id = (ci: number): string => scene.polylines![ci]!.id;
        expect(peak!.elementId).toBe(id(lo.ci));
        expect([peak!.x, peak!.y]).toEqual(lo.p);
        expect(trough!.elementId).toBe(id(hi.ci));
        expect([trough!.x, trough!.y]).toEqual(hi.p);
        // on the element: the point is one of its samples
        const own = scene.polylines!.find((p) => p.id === peak!.elementId)!;
        expect(own.points.some((q) => q[0] === peak!.x && q[1] === peak!.y)).toBe(true);
      }),
      { numRuns: runs(250) },
    );
  });

  it('the origin is where the axes cross and is accepted on either axis or any curve', () => {
    fc.assert(
      fc.property(curveArb, axesArb, (curve, axes) => {
        const scene = graphScene([curve], axes);
        const o = anchorPoint(scene, 'origin');
        expect(o).not.toBeNull();
        expect([o!.x, o!.y]).toEqual([axes.y_axis_x, axes.x_axis_y]);
        expect(o!.acceptIds).toEqual(expect.arrayContaining(['x-axis', 'y-axis', 'curve']));
      }),
      { numRuns: runs(250) },
    );
  });

  it('a finger at the spot hits an accepted line at every scale, and the disc is 22 px', () => {
    fc.assert(
      fc.property(curveArb, axesArb, fc.constantFrom('origin', 'peak', 'trough'), (curve, axes, name) => {
        const scene = graphScene([curve], axes);
        const a = anchorPoint(scene, name);
        if (a === null) return; // flat curve: no peak, nothing to check
        expect(isAnchorReachable(scene, a)).toBe(true);
        for (const scale of REACH_SCALES) {
          const view = makeViewport(scale, scale);
          const finger = toScreen({ x: a.x, y: a.y }, view);
          const target = hitTest(scene, finger, view);
          expect(target.kind).toBe('line');
          if (target.kind === 'line') expect(a.acceptIds).toContain(target.id);
          expect(spotReached(a, target, finger, view)).toBe(true);
          const near = { x: finger.x + ANCHOR_RADIUS_PX - 1, y: finger.y };
          const far = { x: finger.x + ANCHOR_RADIUS_PX + 1, y: finger.y };
          const line = { kind: 'line' as const, id: a.acceptIds[0]!, elementKind: 'polyline' as const };
          expect(spotReached(a, line, near, view)).toBe(true);
          expect(spotReached(a, line, far, view)).toBe(false);
        }
      }),
      { numRuns: runs(250) },
    );
  });

  it('a target that is not a line of an accepted id never reaches a spot, even on top of it', () => {
    const scene = graphScene([[[0.1, 0.6], [0.5, 0.2], [0.9, 0.6]]], { x_axis_y: 0.6, y_axis_x: 0.1 });
    const peak = anchorPoint(scene, 'peak')!;
    const view = makeViewport(360, 360);
    const finger = toScreen({ x: peak.x, y: peak.y }, view);
    expect(spotReached(peak, { kind: 'none' }, finger, view)).toBe(false);
    expect(spotReached(peak, { kind: 'vertex', id: 'curve' }, finger, view)).toBe(false);
    expect(spotReached(peak, { kind: 'line', id: 'x-axis', elementKind: 'axis' }, finger, view)).toBe(false);
    expect(spotReached(peak, { kind: 'line', id: 'curve', elementKind: 'polyline' }, finger, view)).toBe(true);
  });

  it('a point within 22 px of the peak makes it unreachable', () => {
    fc.assert(
      fc.property(
        curveArb,
        axesArb,
        fc.double({ min: -0.04, max: 0.04, noNaN: true }),
        fc.double({ min: -0.04, max: 0.04, noNaN: true }),
        (curve, axes, dx, dy) => {
          const scene = graphScene([curve], axes);
          const peak = anchorPoint(scene, 'peak');
          if (peak === null) return;
          const x = Math.min(1, Math.max(0, peak.x + dx));
          const y = Math.min(1, Math.max(0, peak.y + dy));
          const blocked: DiagramScene = { ...scene, points: [{ id: 'P', x, y, label: 'P' }] };
          // at scale 200 the point is at most 0.04 * 200 * sqrt(2) = 11.3 px away: it steals the hit
          expect(isAnchorReachable(blocked, peak)).toBe(false);
        },
      ),
      { numRuns: runs(250) },
    );
  });

  it('is the same under a uniform scale and a translation of the curve and the axes', () => {
    fc.assert(
      fc.property(
        curveArb,
        axesArb,
        fc.double({ min: 0.5, max: 1, noNaN: true }),
        fc.double({ min: 0.5, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (curve, axes, sx, sy, ux, uy) => {
          const tx = ux * (1 - sx);
          const ty = uy * (1 - sy);
          // A tolerance has an edge (task 87). A sample whose gap to the extreme is within a factor of
          // 2.5 of 1e-9 can be inside the tie band before a scale of 0.5 and outside it after (found
          // by the hunt at seed 1500: gap 1.0000000e-9). Such a draw says nothing about ulp ties.
          const ys = curve.map((c) => c[1]);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const onEdge = ys.some((y) => {
            const g = Math.min(y - minY, maxY - y);
            return g > 0 && g >= 0.4e-9 && g <= 2.5e-9;
          });
          if (onEdge) return;
          const moved = curve.map(([x, y]) => [sx * x + tx, sy * y + ty] as [number, number]);
          const movedAxes = { x_axis_y: sy * axes.x_axis_y + ty, y_axis_x: sx * axes.y_axis_x + tx };
          const a = graphScene([curve], axes);
          const b = graphScene([moved], movedAxes);
          for (const name of ['origin', 'peak', 'trough'] as const) {
            const p = anchorPoint(a, name);
            const q = anchorPoint(b, name);
            expect(q === null).toBe(p === null);
            if (p !== null && q !== null) {
              expect(q.elementId).toBe(p.elementId);
              expect(q.x).toBeCloseTo(sx * p.x + tx, 9);
              expect(q.y).toBeCloseTo(sy * p.y + ty, 9);
            }
          }
        },
      ),
      { numRuns: runs(250) },
    );
  });

  it('pinned (task 87, seed 45 of the hunt): two samples one ulp apart are a tie, the first wins', () => {
    // 0.3749401429200965 and 0.3749401429200964 are the same height to the eye and to 1e-9. The exact
    // minimum is the later one, so a strict comparison picked x = 0.4 and, after a scale and
    // translation rounded them differently, a different sample. The rule is: first within 1e-9.
    const scene = graphScene(
      [[[0.1, 0.6], [0.2, 0.3749401429200965], [0.3, 0.5], [0.4, 0.3749401429200964], [0.5, 0.6]]],
      { x_axis_y: 0.9, y_axis_x: 0.05 },
    );
    expect(anchorPoint(scene, 'peak')!.x).toBe(0.2);
    const flipped = graphScene(
      [[[0.1, 0.4], [0.2, 0.7549571566237878], [0.3, 0.5], [0.4, 0.7549571566237879], [0.5, 0.4]]],
      { x_axis_y: 0.95, y_axis_x: 0.05 },
    );
    expect(anchorPoint(flipped, 'trough')!.x).toBe(0.2);
    // within the tolerance of flat, there is no peak; a real height difference still gives one
    const nearFlat = graphScene([[[0.1, 0.5], [0.5, 0.5 + 1e-12], [0.9, 0.5]]], { x_axis_y: 0.8, y_axis_x: 0.1 });
    expect(anchorPoint(nearFlat, 'peak')).toBeNull();
    const notFlat = graphScene([[[0.1, 0.5], [0.5, 0.5 + 1e-6], [0.9, 0.5]]], { x_axis_y: 0.8, y_axis_x: 0.1 });
    expect(anchorPoint(notFlat, 'trough')).not.toBeNull();
  });

  it('is null without a polyline (peak, trough), without both axes (origin) and for another kind', () => {
    fc.assert(
      fc.property(curveArb, axesArb, (curve, axes) => {
        const noCurve = graphScene([], axes);
        expect(anchorPoint(noCurve, 'peak')).toBeNull();
        expect(anchorPoint(noCurve, 'trough')).toBeNull();
        expect(anchorPoint(graphScene([curve], null), 'origin')).toBeNull();
        expect(anchorPoint(graphScene([curve], { x_axis_y: 0.5, y_axis_x: null }), 'origin')).toBeNull();
        expect(anchorPoint(graphScene([curve], { x_axis_y: null, y_axis_x: 0.5 }), 'origin')).toBeNull();
        const geometry = { ...graphScene([curve], axes), kind: 'geometry' as const };
        for (const name of ['origin', 'peak', 'trough'] as const) expect(anchorPoint(geometry, name)).toBeNull();
      }),
      { numRuns: runs(250) },
    );
  });

  it('a flat curve has no peak or trough, so no curve walk, but the axes still give an origin', () => {
    const flat = graphScene([[[0.1, 0.5], [0.5, 0.5], [0.9, 0.5]]], { x_axis_y: 0.8, y_axis_x: 0.1 });
    expect(anchorPoint(flat, 'peak')).toBeNull();
    expect(anchorPoint(flat, 'trough')).toBeNull();
    expect(anchorPoint(flat, 'origin')).not.toBeNull();
  });

  it('never throws on junk', () => {
    const junk: unknown[] = [null, undefined, 3, 'x', [], {}, { kind: 'function_graph' }, { kind: 'function_graph', polylines: 5, axes: 7 }];
    for (const s of junk) {
      for (const name of ['origin', 'peak', 'trough'] as const) {
        expect(() => anchorPoint(s as DiagramScene, name)).not.toThrow();
        expect(anchorPoint(s as DiagramScene, name)).toBeNull();
      }
    }
  });

  it('the shipped sine sample has all three spots, reachable at every scale (51.5)', () => {
    for (const name of ['origin', 'peak', 'trough'] as const) {
      const a = anchorPoint(sine, name);
      expect(a, name).not.toBeNull();
      expect(isAnchorReachable(sine, a!), name).toBe(true);
    }
    const peak = anchorPoint(sine, 'peak')!;
    const trough = anchorPoint(sine, 'trough')!;
    expect(peak.y).toBeLessThan(trough.y);
    expect(peak.elementId).toBe('sine_curve');
  });
});
