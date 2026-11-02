import { describe, it } from 'vitest';
import fc from 'fast-check';
import { pitchForY, pitchForValue } from '../src/core/pitch';

describe('P7 — Pitch is monotonic and bounded', () => {
  /**
   * P7: y1 < y2 => pitchForY(y1) >= pitchForY(y2) (non-strict, due to
   * floating-point: values differing by less than ~1e-16 produce the same
   * output). Output is always in [200, 1000].
   *
   * Validates: Requirements 5.1, 5.2
   */

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

  it('pitchForY output is always in [200, 1000]', () => {
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
