import { afterEach, describe, expect, it, vi } from 'vitest';
import { isGuideActive, isGuideEnvOn, isShareActive, isShareEnvOn } from '../src/config/features';

describe('feature flags', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('are OFF when unset', () => {
    vi.stubEnv('VITE_FEATURE_GUIDE', '');
    vi.stubEnv('VITE_FEATURE_SHARE', '');
    expect(isGuideEnvOn()).toBe(false);
    expect(isShareEnvOn()).toBe(false);
  });

  it('are ON only for exactly "1"', () => {
    vi.stubEnv('VITE_FEATURE_GUIDE', 'true');
    expect(isGuideEnvOn()).toBe(false);
    vi.stubEnv('VITE_FEATURE_GUIDE', '1');
    expect(isGuideEnvOn()).toBe(true);
  });

  it('need the env flag AND the setting', () => {
    vi.stubEnv('VITE_FEATURE_SHARE', '1');
    expect(isShareActive(true)).toBe(true);
    expect(isShareActive(false)).toBe(false);
    vi.stubEnv('VITE_FEATURE_GUIDE', '');
    expect(isGuideActive(true)).toBe(false);
  });
});
