/**
 * Build-time feature flags for the two flagged features.
 * A flag is ON only when its env value is exactly "1"; unset means OFF.
 * Each feature is active only when the env flag AND the user's settings toggle are both on
 * (the settings toggle is handled by the feature's own lane).
 */
import { safeGet, safeSet } from '../drivers/storage';

export const STORAGE_KEY_GUIDE = 'gt_guide_enabled';

let inMemoryGuideSetting: boolean | null = null;

export function getStoredGuideSetting(): boolean {
  const stored = safeGet(STORAGE_KEY_GUIDE);
  if (stored !== null) {
    return stored === 'true';
  }
  return inMemoryGuideSetting ?? false;
}

export function setStoredGuideSetting(enabled: boolean): void {
  safeSet(STORAGE_KEY_GUIDE, enabled ? 'true' : 'false');
  inMemoryGuideSetting = enabled;
}

export function isGuideEnvOn(): boolean {
  return import.meta.env.VITE_FEATURE_GUIDE === '1';
}

export function isShareEnvOn(): boolean {
  return import.meta.env.VITE_FEATURE_SHARE === '1';
}

/** Active = env flag on AND the user's setting on. */
export function isGuideActive(settingOn: boolean = getStoredGuideSetting()): boolean {
  return isGuideEnvOn() && settingOn;
}

export function isShareActive(settingOn: boolean): boolean {
  return isShareEnvOn() && settingOn;
}
