import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_GUIDE,
  pulseIntervalMs,
  pitchFor,
  panFor,
  directionHint,
  hasArrived,
  vectorTo,
} from '../src/guide';

describe('Guide Geometry Properties (>= 200 runs)', () => {
  it('pulseIntervalMs is monotone non-decreasing in dist', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2, noNaN: true }),
        fc.double({ min: 0, max: 2, noNaN: true }),
        (d1, d2) => {
          if (d1 <= d2) {
            expect(pulseIntervalMs(d1)).toBeLessThanOrEqual(pulseIntervalMs(d2));
          } else {
            expect(pulseIntervalMs(d1)).toBeGreaterThanOrEqual(pulseIntervalMs(d2));
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('pulseIntervalMs is always within [nearMs, farMs] for any input', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        (dist) => {
          const val = pulseIntervalMs(dist);
          expect(val).toBeGreaterThanOrEqual(DEFAULT_GUIDE.nearMs);
          expect(val).toBeLessThanOrEqual(DEFAULT_GUIDE.farMs);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('pulseIntervalMs is within [nearMs, farMs] for arbitrary valid configs', () => {
    fc.assert(
      fc.property(
        fc.record({
          farMs: fc.integer({ min: 300, max: 1500 }),
          nearMs: fc.integer({ min: 50, max: 299 }),
          arriveRadius: fc.double({ min: 0.01, max: 0.2, noNaN: true }),
          hintEveryMs: fc.integer({ min: 1000, max: 5000 }),
          timeoutMs: fc.integer({ min: 5000, max: 30000 }),
          pitchLoHz: fc.integer({ min: 100, max: 400 }),
          pitchHiHz: fc.integer({ min: 500, max: 2000 }),
        }),
        fc.double({ min: -5, max: 5, noNaN: true }),
        (cfg, dist) => {
          const val = pulseIntervalMs(dist, cfg);
          expect(val).toBeGreaterThanOrEqual(cfg.nearMs);
          expect(val).toBeLessThanOrEqual(cfg.farMs);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('pitchFor: target above (smaller dy) gives pitch >= target below (larger dy)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        (dy1, dy2) => {
          // dy = target.y - finger.y; smaller dy means target is higher above finger
          if (dy1 <= dy2) {
            expect(pitchFor(dy1)).toBeGreaterThanOrEqual(pitchFor(dy2));
          } else {
            expect(pitchFor(dy1)).toBeLessThanOrEqual(pitchFor(dy2));
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('pitchFor is always within [pitchLoHz, pitchHiHz] for any input', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        (dy) => {
          const val = pitchFor(dy);
          expect(val).toBeGreaterThanOrEqual(DEFAULT_GUIDE.pitchLoHz);
          expect(val).toBeLessThanOrEqual(DEFAULT_GUIDE.pitchHiHz);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('panFor is within [-1, 1] and sign matches dx', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true }),
        (dx) => {
          const pan = panFor(dx);
          expect(pan).toBeGreaterThanOrEqual(-1);
          expect(pan).toBeLessThanOrEqual(1);

          if (dx > 0) {
            expect(pan).toBeGreaterThan(0);
          } else if (dx < 0) {
            expect(pan).toBeLessThan(0);
          } else {
            expect(pan).toBe(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('directionHint: within dead-zone always returns here', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.05, noNaN: true }),
        fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }),
        (r, theta) => {
          const dx = r * Math.cos(theta);
          const dy = r * Math.sin(theta);
          expect(directionHint(dx, dy, 0.05)).toBe('here');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('directionHint: the 8 compass directions with varying magnitudes outside dead-zone', () => {
    const directions = [
      { key: 'right', deg: 0 },
      { key: 'down-right', deg: 45 },
      { key: 'down', deg: 90 },
      { key: 'down-left', deg: 135 },
      { key: 'left', deg: 180 },
      { key: 'up-left', deg: -135 },
      { key: 'up', deg: -90 },
      { key: 'up-right', deg: -45 },
    ] as const;

    for (const d of directions) {
      fc.assert(
        fc.property(
          fc.double({ min: 0.06, max: 1.0, noNaN: true }),
          (r) => {
            const rad = (d.deg * Math.PI) / 180;
            const dx = r * Math.cos(rad);
            const dy = r * Math.sin(rad);
            expect(directionHint(dx, dy)).toBe(d.key);
          }
        ),
        { numRuns: 200 }
      );
    }
  });

  it('hasArrived accurately reflects distance <= arriveRadius', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.5, noNaN: true }),
        fc.double({ min: 0.01, max: 0.2, noNaN: true }),
        (dist, radius) => {
          const arrived = hasArrived(dist, { ...DEFAULT_GUIDE, arriveRadius: radius });
          expect(arrived).toBe(dist <= radius);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('vectorTo computes exact dx, dy, and euclidean distance', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (fx, fy, tx, ty) => {
          const v = vectorTo({ x: fx, y: fy }, { x: tx, y: ty });
          expect(v.dx).toBeCloseTo(tx - fx);
          expect(v.dy).toBeCloseTo(ty - fy);
          expect(v.dist).toBeCloseTo(Math.hypot(tx - fx, ty - fy));
        }
      ),
      { numRuns: 200 }
    );
  });
});
