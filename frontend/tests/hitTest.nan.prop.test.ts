/**
 * NEEDS-KIRO-01 — a non-finite distance is a miss (Task 26, Requirement 16.12).
 *
 * Written by Kiro. Found by the Antigravity bug hunt (a7). With a NaN coordinate `dist > radius`
 * is false, so the NaN candidate beat "no hit yet", then nothing could replace it: one bad point
 * made hitTest report a vertex under every touch, locking vibration on across the canvas.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeViewport, toScreen } from '../src/core/geometry';
import { hitTest } from '../src/core/hitTest';
import type { DiagramScene } from '../src/core/scene';

const view = makeViewport(400, 400);
const radii = { vertex: 22, line: 14 };
const bad = fc.constantFrom(Number.NaN, Infinity, -Infinity);

describe('hitTest ignores non-finite geometry', () => {
  it('a NaN point never becomes a hit, wherever the finger is (200+ runs)', () => {
    fc.assert(
      fc.property(bad, bad, fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 400 }), (x, y, fx, fy) => {
        const scene: DiagramScene = { kind: 'geometry', points: [{ id: 'bad', x, y, label: 'Bad' }] };
        expect(hitTest(scene, { x: fx, y: fy }, view, radii)).toEqual({ kind: 'none' });
      }),
      { numRuns: 250 },
    );
  });

  it('a good point is still found when a NaN point comes first (200+ runs)', () => {
    fc.assert(
      fc.property(bad, fc.double({ min: 0.1, max: 0.9, noNaN: true }), fc.double({ min: 0.1, max: 0.9, noNaN: true }), (x, gx, gy) => {
        const scene: DiagramScene = {
          kind: 'geometry',
          points: [
            { id: 'bad', x, y: 0.5, label: 'Bad' },
            { id: 'good', x: gx, y: gy, label: 'Good' },
          ],
        };
        const at = toScreen({ x: gx, y: gy }, view);
        const hit = hitTest(scene, at, view, radii);
        expect(hit.kind).toBe('vertex');
        if (hit.kind === 'vertex') expect(hit.id).toBe('good');
      }),
      { numRuns: 250 },
    );
  });

  it('a NaN segment or polyline vertex never becomes a line hit (200+ runs)', () => {
    fc.assert(
      fc.property(bad, fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 400 }), (v, fx, fy) => {
        const scene: DiagramScene = {
          kind: 'function_graph',
          polylines: [{ id: 'pl', points: [[v, 0.2], [0.8, v]] }],
        };
        expect(hitTest(scene, { x: fx, y: fy }, view, radii)).toEqual({ kind: 'none' });
      }),
      { numRuns: 250 },
    );
  });
});
