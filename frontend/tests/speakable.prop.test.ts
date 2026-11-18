import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isMachineId, speakableName } from '../src/core/speakable';
import { runs } from './support/runs';

const N = runs(300);
const junk = fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.constant(undefined), fc.object());

describe('speakable names', () => {
  it('P139 is total', () => {
    fc.assert(
      fc.property(junk, junk, (a, b) => {
        const m = isMachineId(a as never);
        const s = speakableName(a as never, b as never);
        expect(typeof m).toBe('boolean');
        expect(s === null || typeof s === 'string').toBe(true);
      }),
      { numRuns: N },
    );
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        expect(typeof isMachineId(a)).toBe('boolean');
        const s = speakableName(a, b);
        expect(s === null || typeof s === 'string').toBe(true);
      }),
      { numRuns: N },
    );
  });

  it('P140 a label wins over its id', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }).filter((l) => l.trim() !== ''), fc.string(), (label, id) => {
        expect(speakableName(label, id)).toBe(label.trim());
      }),
      { numRuns: N },
    );
    fc.assert(
      fc.property(fc.constantFrom(undefined, '', '  \t '), fc.string(), (label, id) => {
        expect(speakableName(label, id)).toBe(speakableName(undefined, id));
      }),
      { numRuns: N },
    );
  });

  it('P141 textbook names are speakable', () => {
    const letter = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcxyz'.split(''));
    const caps = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
    const name = fc.oneof(
      letter,
      fc.tuple(letter, fc.constantFrom("'", "''")).map(([l, p]) => l + p),
      fc.tuple(letter, fc.integer({ min: 0, max: 99 })).map(([l, n]) => `${l}${n}`),
      fc.array(caps, { minLength: 2, maxLength: 3 }).map((a) => a.join('')),
    );
    fc.assert(
      fc.property(name, (id) => {
        expect(isMachineId(id)).toBe(false);
        expect(speakableName(undefined, id)).toBe(id);
      }),
      { numRuns: N },
    );
  });

  it('P142 Raw Mode and prefixed ids are never spoken', () => {
    const n = fc.nat({ max: 1_000_000 });
    const prefixed = fc.tuple(fc.constantFrom('raw_', 'point_', 'pt_', 'seg_', 'line_', 'poly_', 'bar_'), n);
    fc.assert(
      fc.property(n, (k) => {
        for (const id of [`raw_p${k}`, `raw_s${k}`]) {
          expect(isMachineId(id)).toBe(true);
          expect(speakableName(undefined, id)).toBeNull();
        }
      }),
      { numRuns: N },
    );
    fc.assert(
      fc.property(prefixed, fc.boolean(), ([p, k], upper) => {
        const id = upper ? `${p}${k}`.toUpperCase() : `${p}${k}`;
        expect(isMachineId(id)).toBe(true);
        expect(speakableName(undefined, id)).toBeNull();
      }),
      { numRuns: N },
    );
    fc.assert(
      fc.property(fc.string({ minLength: 13, maxLength: 40 }).filter((s) => s.trim().length > 12), (id) => {
        expect(isMachineId(id)).toBe(true);
      }),
      { numRuns: N },
    );
  });

  it('P142 also: an underscore with a digit is machine-made, an underscore alone is not', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 4 }), fc.string({ maxLength: 4 }), fc.integer({ min: 0, max: 9 }), (a, b, d) => {
        expect(isMachineId(`x${a}_${b}${d}`)).toBe(true);
      }),
      { numRuns: N },
    );
    expect(isMachineId('a_b')).toBe(false);
  });
});
