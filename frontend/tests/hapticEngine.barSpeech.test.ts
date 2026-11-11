/**
 * CORE-A4 (Kiro, K4, Requirement 6.1): the spoken bar value has at most 2 decimals and no
 * trailing zeros. Only the text changes; the effect structure, tone and haptics are untouched.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_HAPTICS, initialState, step } from '../src/core/hapticEngine';

function spoken(value: number): string | undefined {
  const target = { kind: 'bar' as const, id: 'b', label: 'L', value, maxValue: 10 };
  const { effects } = step(initialState(), { kind: 'move', t: 0, target, yNorm: 0.5 }, DEFAULT_HAPTICS);
  const speak = effects.find((e) => e.kind === 'speak');
  return speak && 'text' in speak ? speak.text : undefined;
}

describe('CORE-A4: bar value speech is rounded', () => {
  it.each([
    [3.3333333333333335, 'L, 3.33'],
    [0.30000000000000004, 'L, 0.3'],
    [5, 'L, 5'],
    [2.5, 'L, 2.5'],
    [2.676, 'L, 2.68'],
    [1234.5678, 'L, 1234.57'],
    [-1.005, 'L, -1'],
    [0, 'L, 0'],
  ])('%s is spoken as "%s"', (value, text) => {
    expect(spoken(value)).toBe(text);
  });

  it('never has more than 2 decimals or a trailing zero', () => {
    for (const v of [1 / 3, 2 / 3, 10 / 7, 99.999, 0.004, 100.1]) {
      expect(spoken(v)).toMatch(/^L, -?\d+(\.\d{1,2})?$/);
      expect(spoken(v)).not.toMatch(/\.\d*0$/);
    }
  });
});
