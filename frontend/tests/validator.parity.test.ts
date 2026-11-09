/**
 * Validator parity, share side (Kiro, task 37.3).
 *
 * Runs every case in `backend/fixtures/validator_parity.json` through `validateShareScene`.
 * The same file goes through `backend/app/validate.py` in `backend/tests/test_validator_parity.py`.
 * A case marked `known_mismatch` records what this side gives today (`frontend`), so the suite
 * stays green and any change in either validator shows up here. See
 * `docs/reports/validator-parity.md`.
 */
import { describe, expect, it } from 'vitest';
import { validateShareScene } from '../src/share/validate';
import parity from '../../backend/fixtures/validator_parity.json';

interface Verdict {
  verdict: 'accept' | 'reject';
  reason?: string;
}
interface ParityCase {
  name: string;
  note: string;
  scene: unknown;
  expected: Verdict;
  known_mismatch?: boolean;
  backend?: Verdict;
  frontend?: Verdict;
}

const CASES = (parity as { cases: ParityCase[] }).cases;

/** Share-validator error text -> fixture reason key. First match wins. */
const REASONS: readonly [RegExp, string][] = [
  [/Points count \d+ exceeds/, 'too_many_points'],
  [/Bars count \d+ exceeds/, 'too_many_bars'],
  [/must have at least 2 coordinate pairs/, 'polyline_too_short'],
  [/out of range \[0, 1\]/, 'coord_out_of_range'],
  [/missing valid id/, 'empty_id'],
  [/Unsupported scene version/, 'bad_version'],
  [/Invalid scene kind/, 'invalid_kind'],
  [/no drawable elements/, 'no_drawable'],
];

function reasonOf(errors: readonly string[]): string {
  const text = errors.join('\n');
  for (const [pattern, key] of REASONS) if (pattern.test(text)) return key;
  return `unclassified: ${text.slice(0, 200)}`;
}

describe('validator parity: frontend/src/share/validate.ts', () => {
  it('the fixture is well formed', () => {
    const names = CASES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(CASES.length).toBeGreaterThanOrEqual(20);
    for (const c of CASES) {
      if (c.expected.verdict === 'reject') expect(c.expected.reason, c.name).toBeTruthy();
      if (c.known_mismatch) expect(c.frontend, c.name).not.toEqual(c.backend);
    }
  });

  for (const c of CASES) {
    it(c.name, () => {
      const want = c.known_mismatch ? c.frontend! : c.expected;
      const result = validateShareScene(structuredClone(c.scene));
      const got = result.ok ? 'accept' : 'reject';
      expect(got, `${c.name}: ${result.ok ? '' : result.errors.join(' | ')}`).toBe(want.verdict);
      if (!result.ok) expect(reasonOf(result.errors)).toBe(want.reason);
    });
  }
});
