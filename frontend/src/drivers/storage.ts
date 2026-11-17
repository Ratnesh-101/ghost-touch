/**
 * Safe localStorage wrapper.
 *
 * Architecture rule: browser APIs live only in frontend/src/drivers/.
 * safeGet / safeSet / safeRemove wrap localStorage in try/catch and safely
 * no-op when localStorage is unavailable or in environments without window.
 */

export function safeGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // localStorage unavailable or restricted
  }
  return null;
}

export function safeSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // localStorage unavailable or restricted
  }
}

export function safeRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage unavailable or restricted
  }
}

export const STORAGE_KEY_DIRECTIONS = 'gt_directions_enabled';
export const STORAGE_KEY_FINDING_SOUND = 'gt_finding_sound_enabled';
export const STORAGE_KEY_STICKY_LINE = 'gt_sticky_line_enabled';
export const STORAGE_KEY_CORNER_HEARTBEAT = 'gt_corner_heartbeat_enabled';

export type SettingsListener = (key?: string) => void;
const settingsListeners = new Set<SettingsListener>();

export function subscribeSettings(listener: SettingsListener): () => void {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

export function notifySettingsChanged(key?: string): void {
  for (const listener of settingsListeners) {
    try {
      listener(key);
    } catch {
      // safe no-op
    }
  }
}

let inMemoryDirectionsSetting: boolean | null = null;

function getStoredBoolean(inMemory: boolean | null, key: string, defaultValue: boolean): boolean {
  if (inMemory !== null) {
    return inMemory;
  }
  const stored = safeGet(key);
  if (stored === 'true') {
    return true;
  }
  if (stored === 'false') {
    return false;
  }
  return defaultValue;
}

export function getStoredDirectionsSetting(): boolean {
  return getStoredBoolean(inMemoryDirectionsSetting, STORAGE_KEY_DIRECTIONS, true);
}

export function setStoredDirectionsSetting(enabled: boolean): void {
  safeSet(STORAGE_KEY_DIRECTIONS, enabled ? 'true' : 'false');
  inMemoryDirectionsSetting = enabled;
  notifySettingsChanged(STORAGE_KEY_DIRECTIONS);
}

export function _resetDirectionsSettingForTesting(): void {
  inMemoryDirectionsSetting = null;
  safeRemove(STORAGE_KEY_DIRECTIONS);
  notifySettingsChanged(STORAGE_KEY_DIRECTIONS);
}

let inMemoryFindingSoundSetting: boolean | null = null;

export function getStoredFindingSoundSetting(): boolean {
  return getStoredBoolean(inMemoryFindingSoundSetting, STORAGE_KEY_FINDING_SOUND, true);
}

export function setStoredFindingSoundSetting(enabled: boolean): void {
  safeSet(STORAGE_KEY_FINDING_SOUND, enabled ? 'true' : 'false');
  inMemoryFindingSoundSetting = enabled;
  notifySettingsChanged(STORAGE_KEY_FINDING_SOUND);
}

export function _resetFindingSoundSettingForTesting(): void {
  inMemoryFindingSoundSetting = null;
  safeRemove(STORAGE_KEY_FINDING_SOUND);
  notifySettingsChanged(STORAGE_KEY_FINDING_SOUND);
}

let inMemoryStickyLineSetting: boolean | null = null;

export function getStoredStickyLineSetting(): boolean {
  return getStoredBoolean(inMemoryStickyLineSetting, STORAGE_KEY_STICKY_LINE, false);
}

export function setStoredStickyLineSetting(enabled: boolean): void {
  safeSet(STORAGE_KEY_STICKY_LINE, enabled ? 'true' : 'false');
  inMemoryStickyLineSetting = enabled;
  notifySettingsChanged(STORAGE_KEY_STICKY_LINE);
}

export function _resetStickyLineSettingForTesting(): void {
  inMemoryStickyLineSetting = null;
  safeRemove(STORAGE_KEY_STICKY_LINE);
  notifySettingsChanged(STORAGE_KEY_STICKY_LINE);
}

let inMemoryCornerHeartbeatSetting: boolean | null = null;

export function getStoredCornerHeartbeatSetting(): boolean {
  return getStoredBoolean(inMemoryCornerHeartbeatSetting, STORAGE_KEY_CORNER_HEARTBEAT, false);
}

export function setStoredCornerHeartbeatSetting(enabled: boolean): void {
  safeSet(STORAGE_KEY_CORNER_HEARTBEAT, enabled ? 'true' : 'false');
  inMemoryCornerHeartbeatSetting = enabled;
  notifySettingsChanged(STORAGE_KEY_CORNER_HEARTBEAT);
}

export function _resetCornerHeartbeatSettingForTesting(): void {
  inMemoryCornerHeartbeatSetting = null;
  safeRemove(STORAGE_KEY_CORNER_HEARTBEAT);
  notifySettingsChanged(STORAGE_KEY_CORNER_HEARTBEAT);
}
