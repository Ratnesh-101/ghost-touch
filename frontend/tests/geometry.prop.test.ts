import { describe, it } from 'vitest';
import fc from 'fast-check';
import { makeViewport, toScreen, toNorm } from '../src/core/geometry';

const EPS = 1e-9;

describe('P8 — Coordinate round-trip', () => {
  /**
   * For any normalized point p in [0, 1]² and any viewport with positive
   * dimensions, converting p to screen space and back must recover p exactly
   * (within floating-point tolerance).
   *
   * **Validates: Requirements 3.2** (normalized coordinates)
   */
  it('toNorm(toScreen(p, view), view) ≈ p within 1e-9 for any viewport', () => {
    const normPoint = fc.record({
      x: fc.float({ min: 0, max: 1, noNaN: true }),
      y: fc.float({ min: 0, max: 1, noNaN: true }),
    });

    const dimensions = fc.record({
      w: fc.float({ min: 1, max: 2000, noNaN: true }),
      h: fc.float({ min: 1, max: 2000, noNaN: true }),
    });

    fc.assert(
      fc.property(normPoint, dimensions, (p, { w, h }) => {
        const view = makeViewport(w, h);
        const roundTrip = toNorm(toScreen(p, view), view);
        return (
          Math.abs(roundTrip.x - p.x) <= EPS &&
          Math.abs(roundTrip.y - p.y) <= EPS
        );
      }),
      { numRuns: 200 },
    );
  });
});
