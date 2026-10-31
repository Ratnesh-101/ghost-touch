import { describe, it, expect } from 'vitest';
import { t } from '../src/i18n';

/**
 * Scaffold smoke test. Confirms the i18n module (through which every
 * user-facing string must flow, per tech.md) resolves known keys.
 */
describe('i18n scaffold', () => {
  it('returns the app name', () => {
    expect(t('app.name')).toBe('Ghost Touch');
  });

  it('falls back to the key for unknown strings', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});
