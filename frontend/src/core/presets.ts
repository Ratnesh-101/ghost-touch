/**
 * Explore presets as pure data (Requirement 44, task 70).
 *
 * Three named sets of the six Explore settings. No storage, React, i18n or imports: reading the
 * stored values and writing them back is the Settings lane's job. `standard` equals the defaults
 * the app ships today. Only `explorer` turns on the two PROPOSED features (stay on line, corner
 * heartbeat, see `tech.md`).
 */

export type PresetId = 'simple' | 'standard' | 'explorer';

export interface ExploreSettings {
  speechDetail: 'full' | 'short';
  directions: boolean;
  findingSound: boolean;
  graphScan: boolean;
  stickyLine: boolean;
  cornerHeartbeat: boolean;
}

const SETTING_KEYS = [
  'speechDetail',
  'directions',
  'findingSound',
  'graphScan',
  'stickyLine',
  'cornerHeartbeat',
] as const;

export const PRESETS: Record<PresetId, ExploreSettings> = {
  simple: {
    speechDetail: 'short',
    directions: true,
    findingSound: false,
    graphScan: false,
    stickyLine: false,
    cornerHeartbeat: false,
  },
  standard: {
    speechDetail: 'full',
    directions: true,
    findingSound: true,
    graphScan: true,
    stickyLine: false,
    cornerHeartbeat: false,
  },
  explorer: {
    speechDetail: 'full',
    directions: true,
    findingSound: true,
    graphScan: true,
    stickyLine: true,
    cornerHeartbeat: true,
  },
};

const PRESET_IDS: readonly PresetId[] = ['simple', 'standard', 'explorer'];

function isPresetId(id: unknown): id is PresetId {
  return typeof id === 'string' && (PRESET_IDS as readonly string[]).includes(id);
}

/** A fresh copy of the preset's settings; an unknown id gives a copy of `standard`. */
export function applyPreset(id: PresetId): ExploreSettings {
  const source = isPresetId(id) ? PRESETS[id] : PRESETS.standard;
  return { ...source };
}

/** The preset whose six values all equal `settings`, or `'custom'`. Never throws. */
export function presetOf(settings: unknown): PresetId | 'custom' {
  try {
    if (typeof settings !== 'object' || settings === null) return 'custom';
    const record = settings as Record<string, unknown>;
    for (const id of PRESET_IDS) {
      const preset = PRESETS[id];
      let same = true;
      for (const key of SETTING_KEYS) {
        if (record[key] !== preset[key]) {
          same = false;
          break;
        }
      }
      if (same) return id;
    }
  } catch {
    // a throwing getter or Proxy is not a preset
  }
  return 'custom';
}
