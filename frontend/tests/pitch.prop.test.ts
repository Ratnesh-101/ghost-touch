import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pitchForY, pitchForValue } from '../src/core/pitch';

describe('P7 — Pitch is monotonic and bounded', () => {
  /**
   * P7: pitchForY is monotonically non-increasing (strict for well-separated
   * values), and output is always in [200, 1000]. pitchForY(0) = 1000,
   * pitchForY(1) = 200. Non-finite input returns 200.
   *
   * Validates: Requirements 5.1, 5.2
   */

  it('pitchForY(0) = 1000 and pitchForY(1) = 200', () => {
    expect(pitchForY(0)).toBe(1000);
    expect(pitchForY(1)).toBe(200);
  });

  it('pitchForY is monotonically non-increasing: y1 < y2 => pitchForY(y1) >= pitchForY(y2)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (y1, y2) => {
          if (y1 < y2) {
            return pitchForY(y1) >= pitchForY(y2);
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('pitchForY is strictly decreasing for well-separated values (y2 - y1 >= 1e-4)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (y1, y2) => {
          if (y1 < y2 && y2 - y1 >= 1e-4) {
            return pitchForY(y1) > pitchForY(y2);
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('pitchForY output is always in [200, 1000] including non-finite input', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true }),
        (y) => {
          const hz = pitchForY(y);
          return hz >= 200 && hz <= 1000;
        },
      ),
      { numRuns: 200 },
    );
    // Non-finite input returns 200 (bottom of range)
    expect(pitchForY(NaN)).toBe(200);
    expect(pitchForY(Infinity)).toBe(200);
    expect(pitchForY(-Infinity)).toBe(200);
  });

  it('pitchForValue output is always in [200, 1000]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 1000, noNaN: true }),
        fc.double({ min: -100, max: 1000, noNaN: true }),
        (v, max) => {
          const hz = pitchForValue(v, max);
          return hz >= 200 && hz <= 1000;
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('P11 — Bar pitch order', () => {
  /**
   * P11: bars with larger values never get a lower pitch.
   * pitchForValue is monotonically non-decreasing in v for fixed max.
   *
   * Validates: Requirement 6.2
   */
  it('v1 > v2 => pitchForValue(v1, max) >= pitchForValue(v2, max)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 1, max: 100, noNaN: true }),
        (v1, v2, max) => {
          if (v1 > v2) {
            return pitchForValue(v1, max) >= pitchForValue(v2, max);
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('pitchForValue is strictly increasing for well-separated values', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 95, noNaN: true }),
        fc.double({ min: 5, max: 100, noNaN: true }),
        (v1, v2) => {
          if (v2 > v1 + 5) {
            return pitchForValue(v2, 100) > pitchForValue(v1, 100);
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});
