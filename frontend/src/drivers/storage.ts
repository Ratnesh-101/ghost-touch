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

let inMemoryDirectionsSetting: boolean | null = null;

export function getStoredDirectionsSetting(): boolean {
  const stored = safeGet(STORAGE_KEY_DIRECTIONS);
  if (stored !== null) {
    return stored === 'true';
  }
  return inMemoryDirectionsSetting ?? true;
}

export function setStoredDirectionsSetting(enabled: boolean): void {
  safeSet(STORAGE_KEY_DIRECTIONS, enabled ? 'true' : 'false');
  inMemoryDirectionsSetting = enabled;
}

export function _resetDirectionsSettingForTesting(): void {
  inMemoryDirectionsSetting = null;
  safeRemove(STORAGE_KEY_DIRECTIONS);
}
