/**
 * Build-time feature flags for the two flagged features.
 * A flag is ON only when its env value is exactly "1"; unset means OFF.
 * Each feature is active only when the env flag AND the user's settings toggle are both on
 * (the settings toggle is handled by the feature's own lane).
 */

export function isGuideEnvOn(): boolean {
  return import.meta.env.VITE_FEATURE_GUIDE === '1';
}

export function isShareEnvOn(): boolean {
  return import.meta.env.VITE_FEATURE_SHARE === '1';
}

/** Active = env flag on AND the user's setting on. */
export function isGuideActive(settingOn: boolean): boolean {
  return isGuideEnvOn() && settingOn;
}

export function isShareActive(settingOn: boolean): boolean {
  return isShareEnvOn() && settingOn;
}
