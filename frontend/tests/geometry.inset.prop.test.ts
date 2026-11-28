import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { VIEW_INSET_PX, makeInsetViewport, toNorm, toScreen } from '../src/core/geometry';
import { DEFAULT_RADII, hitTest } from '../src/core/hitTest';
import type { DiagramScene } from '../src/core/scene';

describe('task 94: inset viewport (Requirement 54.1)', () => {
  it('every scene point in [0,1] maps at least the vertex radius inside the canvas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 100, max: 2000 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (w, h, x, y) => {
          const view = makeInsetViewport(w, h);
          const s = toScreen({ x, y }, view);
          const r = DEFAULT_RADII.vertex;
          expect(s.x).toBeGreaterThanOrEqual(r);
          expect(s.y).toBeGreaterThanOrEqual(r);
          expect(s.x).toBeLessThanOrEqual(w - r);
          expect(s.y).toBeLessThanOrEqual(h - r);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('round-trips and never has a negative scale, even on tiny canvases', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: 0, max: 2000 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (w, h, x) => {
          const view = makeInsetViewport(w, h);
          expect(view.scale).toBeGreaterThanOrEqual(0);
          if (view.scale > 0) {
            const back = toNorm(toScreen({ x, y: x }, view), view);
            expect(back.x).toBeCloseTo(x, 6);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('a corner at x=0 is hit at its own drawn position and uses the same mapping', () => {
    const scene = {
      version: 1,
      kind: 'geometry',
      points: [{ id: 'C', x: 0, y: 1, label: 'C' }],
      segments: [],
      polylines: [],
      bars: [],
      axes: null,
      facts: [],
    } as unknown as DiagramScene;
    const view = makeInsetViewport(390, 700);
    expect(VIEW_INSET_PX).toBeGreaterThan(DEFAULT_RADII.vertex);
    const at = toScreen({ x: 0, y: 1 }, view);
    expect(hitTest(scene, at, view)).toMatchObject({ kind: 'vertex' });
  });
});
