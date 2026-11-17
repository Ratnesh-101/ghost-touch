/**
 * P143 to P146 - Explore presets (Requirement 44, task 70). Written by Kiro.
 *
 * The expected values are the table in Requirement 44.1, written out here, and (P144) the real
 * storage getters read with nothing stored.
 */
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyPreset, PRESETS, presetOf, type ExploreSettings, type PresetId } from '../src/core/presets';
import {
  _resetCornerHeartbeatSettingForTesting,
  _resetDirectionsSettingForTesting,
  _resetFindingSoundSettingForTesting,
  _resetStickyLineSettingForTesting,
  getStoredCornerHeartbeatSetting,
  getStoredDirectionsSetting,
  getStoredFindingSoundSetting,
  getStoredStickyLineSetting,
} from '../src/drivers/storage';
import {
  _resetGraphScanSettingForTesting,
  _resetSpeechDetailSettingForTesting,
  getStoredGraphScanSetting,
  getStoredSpeechDetailSetting,
} from '../src/flow/explore';
import { runs } from './support/runs';

const IDS: PresetId[] = ['simple', 'standard', 'explorer'];
const KEYS: (keyof ExploreSettings)[] = [
  'speechDetail',
  'directions',
  'findingSound',
  'graphScan',
  'stickyLine',
  'cornerHeartbeat',
];

const TABLE: Record<PresetId, ExploreSettings> = {
  simple: { speechDetail: 'short', directions: true, findingSound: false, graphScan: false, stickyLine: false, cornerHeartbeat: false },
  standard: { speechDetail: 'full', directions: true, findingSound: true, graphScan: true, stickyLine: false, cornerHeartbeat: false },
  explorer: { speechDetail: 'full', directions: true, findingSound: true, graphScan: true, stickyLine: true, cornerHeartbeat: true },
};

const idArb = fc.constantFrom<PresetId>(...IDS);
const keyArb = fc.constantFrom<keyof ExploreSettings>(...KEYS);

/** A value of the wrong type or a different value for one setting. */
function flipped(settings: ExploreSettings, key: keyof ExploreSettings, mode: 'flip' | 'mistype'): unknown {
  const copy: Record<string, unknown> = { ...settings };
  if (mode === 'mistype') {
    copy[key] = key === 'speechDetail' ? 1 : String(settings[key]);
  } else if (key === 'speechDetail') {
    copy[key] = settings.speechDetail === 'full' ? 'short' : 'full';
  } else {
    copy[key] = !settings[key];
  }
  return copy;
}

describe('P143 round trip', () => {
  it('table matches Requirement 44.1', () => {
    for (const id of IDS) expect(PRESETS[id]).toEqual(TABLE[id]);
  });

  it.each(IDS)('presetOf(applyPreset(%s)) is that id', (id) => {
    expect(presetOf(applyPreset(id))).toBe(id);
  });

  it('presets are pairwise different', () => {
    for (const a of IDS) for (const b of IDS) if (a !== b) expect(PRESETS[a]).not.toEqual(PRESETS[b]);
  });

  it('round trip, fresh object, table not editable through the result', () => {
    fc.assert(
      fc.property(idArb, keyArb, (id, key) => {
        const a = applyPreset(id);
        const b = applyPreset(id);
        expect(presetOf(a)).toBe(id);
        expect(a).not.toBe(b);
        expect(a).not.toBe(PRESETS[id]);
        (a as unknown as Record<string, unknown>)[key] = 'edited';
        expect(PRESETS[id]).toEqual(TABLE[id]);
        expect(applyPreset(id)).toEqual(TABLE[id]);
      }),
      { numRuns: runs(200) },
    );
  });
});

describe('P144 standard is the shipped default', () => {
  beforeEach(() => {
    _resetDirectionsSettingForTesting();
    _resetFindingSoundSettingForTesting();
    _resetStickyLineSettingForTesting();
    _resetCornerHeartbeatSettingForTesting();
    _resetGraphScanSettingForTesting();
    _resetSpeechDetailSettingForTesting();
  });

  it('the six getters with nothing stored equal PRESETS.standard', () => {
    const shipped: ExploreSettings = {
      speechDetail: getStoredSpeechDetailSetting(),
      directions: getStoredDirectionsSetting(),
      findingSound: getStoredFindingSoundSetting(),
      graphScan: getStoredGraphScanSetting(),
      stickyLine: getStoredStickyLineSetting(),
      cornerHeartbeat: getStoredCornerHeartbeatSetting(),
    };
    expect(shipped).toEqual(PRESETS.standard);
    expect(presetOf(shipped)).toBe('standard');
  });
});

describe('P145 only Explorer has a PROPOSED feature on', () => {
  it('stickyLine and cornerHeartbeat are on exactly for explorer', () => {
    fc.assert(
      fc.property(idArb, (id) => {
        const s = applyPreset(id);
        expect(s.stickyLine).toBe(id === 'explorer');
        expect(s.cornerHeartbeat).toBe(id === 'explorer');
      }),
      { numRuns: runs(200) },
    );
  });

  it('a junk id gives both off (and equals standard)', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (junk) => {
        const s = applyPreset(junk as unknown as PresetId);
        expect(s.stickyLine).toBe(false);
        expect(s.cornerHeartbeat).toBe(false);
        expect(s).toEqual(TABLE.standard);
      }),
      { numRuns: runs(200) },
    );
  });

  it('Object.prototype names are junk ids too', () => {
    for (const junk of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(applyPreset(junk as unknown as PresetId)).toEqual(TABLE.standard);
    }
  });
});

describe('P146 presetOf is total and exact', () => {
  it('never throws on any JSON value, returns a string', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        expect(typeof presetOf(v)).toBe('string');
      }),
      { numRuns: runs(300) },
    );
  });

  it('junk that is not an object is custom', () => {
    for (const v of [null, undefined, 0, 1, '', 'standard', true, [], () => 1, Symbol('x')]) {
      expect(presetOf(v)).toBe('custom');
    }
  });

  it('objects with random fields of random types never throw', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.constantFrom(...KEYS, 'x', '__proto__'), fc.jsonValue()), (o) => {
        expect(typeof presetOf(o)).toBe('string');
      }),
      { numRuns: runs(300) },
    );
  });

  it('a throwing getter or Proxy is custom', () => {
    const trap = new Proxy({}, { get: () => { throw new Error('boom'); } });
    expect(presetOf(trap)).toBe('custom');
  });

  it('flipping or mistyping any one field gives custom', () => {
    fc.assert(
      fc.property(idArb, keyArb, fc.constantFrom<'flip' | 'mistype'>('flip', 'mistype'), (id, key, mode) => {
        expect(presetOf(flipped(TABLE[id], key, mode))).toBe('custom');
      }),
      { numRuns: runs(300) },
    );
  });

  it('a missing field gives custom', () => {
    fc.assert(
      fc.property(idArb, keyArb, (id, key) => {
        const copy: Record<string, unknown> = { ...TABLE[id] };
        delete copy[key];
        expect(presetOf(copy)).toBe('custom');
      }),
      { numRuns: runs(300) },
    );
  });

  it('extra fields do not change the answer', () => {
    fc.assert(
      fc.property(idArb, fc.dictionary(fc.string().filter((k) => !KEYS.includes(k as keyof ExploreSettings)), fc.jsonValue()), (id, extra) => {
        expect(presetOf({ ...extra, ...TABLE[id] })).toBe(id);
      }),
      { numRuns: runs(300) },
    );
  });
});
