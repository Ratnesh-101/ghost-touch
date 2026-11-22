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
        let lo = all[0]!;
        let hi = all[0]!;
        for (const s of all) {
          if (s.p[1] < lo.p[1]) lo = s;
          if (s.p[1] > hi.p[1]) hi = s;
        }
        const peak = anchorPoint(scene, 'peak');
        const trough = anchorPoint(scene, 'trough');
        if (lo.p[1] === hi.p[1]) {
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
