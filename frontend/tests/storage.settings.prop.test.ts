// @vitest-environment jsdom
/**
 * Task 72 (Requirement 46, P148 and P149): the seven boolean setting getters.
 *
 * P148: with nothing in memory, a stored `'true'` reads true, `'false'` reads false, and any
 *   other string (or nothing) reads the documented default.
 * P149: when `localStorage.setItem` throws, the value just set is what the getter returns,
 *   whatever string was stored before.
 *
 * Today every getter returns `stored === 'true'` once anything is stored and ignores the
 * in-memory value, so junk reads false even where the default is true (P148, directions, finding
 * sound, graph scan) and a failed write loses to an older stored string (P149, all seven). Those
 * rows are `it.fails`; the agy lane that fixes the getters removes `.fails`. The pinned examples
 * are the shrunk counterexamples.
 */
import fc from 'fast-check';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  getStoredGuideSetting,
  setStoredGuideSetting,
  STORAGE_KEY_GUIDE,
} from '../src/config/features';
import {
  getStoredCornerHeartbeatSetting,
  getStoredDirectionsSetting,
  getStoredFindingSoundSetting,
  getStoredStickyLineSetting,
  setStoredCornerHeartbeatSetting,
  setStoredDirectionsSetting,
  setStoredFindingSoundSetting,
  setStoredStickyLineSetting,
  STORAGE_KEY_CORNER_HEARTBEAT,
  STORAGE_KEY_DIRECTIONS,
  STORAGE_KEY_FINDING_SOUND,
  STORAGE_KEY_STICKY_LINE,
} from '../src/drivers/storage';
import {
  getStoredGraphScanSetting,
  setStoredGraphScanSetting,
  STORAGE_KEY_GRAPH_SCAN,
} from '../src/flow/explore';
import {
  getStoredTeacherSetting,
  setStoredTeacherSetting,
  STORAGE_KEY_TEACHER,
} from '../src/flow/teach';
import { runs } from './support/runs';

interface Getter {
  name: string;
  key: string;
  /** The documented default (Requirement 46.1). */
  def: boolean;
  get: () => boolean;
  set: (v: boolean) => void;
}

/** The instance the write tests use. Its in-memory values are overwritten by every write. */
const used: Getter[] = [
  { name: 'directions', key: STORAGE_KEY_DIRECTIONS, def: true, get: getStoredDirectionsSetting, set: setStoredDirectionsSetting },
  { name: 'finding sound', key: STORAGE_KEY_FINDING_SOUND, def: true, get: getStoredFindingSoundSetting, set: setStoredFindingSoundSetting },
  { name: 'graph scan', key: STORAGE_KEY_GRAPH_SCAN, def: true, get: getStoredGraphScanSetting, set: setStoredGraphScanSetting },
  { name: 'sticky line', key: STORAGE_KEY_STICKY_LINE, def: false, get: getStoredStickyLineSetting, set: setStoredStickyLineSetting },
  { name: 'corner heartbeat', key: STORAGE_KEY_CORNER_HEARTBEAT, def: false, get: getStoredCornerHeartbeatSetting, set: setStoredCornerHeartbeatSetting },
  { name: 'guide', key: STORAGE_KEY_GUIDE, def: false, get: getStoredGuideSetting, set: setStoredGuideSetting },
  { name: 'teacher', key: STORAGE_KEY_TEACHER, def: false, get: getStoredTeacherSetting, set: setStoredTeacherSetting },
];

/**
 * A second instance of the same modules, loaded after `vi.resetModules()` and never written
 * through a setter, so no in-memory value exists. Guide and Teacher have no reset function, so
 * this is the only way to get "no in-memory value" for them.
 */
let clean: Getter[] = [];

beforeAll(async () => {
  vi.resetModules();
  const [features, storage, explore, teach] = await Promise.all([
    import('../src/config/features'),
    import('../src/drivers/storage'),
    import('../src/flow/explore'),
    import('../src/flow/teach'),
  ]);
  const byName: Record<string, Pick<Getter, 'get' | 'set'>> = {
    directions: { get: storage.getStoredDirectionsSetting, set: storage.setStoredDirectionsSetting },
    'finding sound': { get: storage.getStoredFindingSoundSetting, set: storage.setStoredFindingSoundSetting },
    'graph scan': { get: explore.getStoredGraphScanSetting, set: explore.setStoredGraphScanSetting },
    'sticky line': { get: storage.getStoredStickyLineSetting, set: storage.setStoredStickyLineSetting },
    'corner heartbeat': { get: storage.getStoredCornerHeartbeatSetting, set: storage.setStoredCornerHeartbeatSetting },
    guide: { get: features.getStoredGuideSetting, set: features.setStoredGuideSetting },
    teacher: { get: teach.getStoredTeacherSetting, set: teach.setStoredTeacherSetting },
  };
  clean = used.map((g) => ({ ...g, ...byName[g.name] }));
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

/** Random strings, plus the near-misses a real store could hold. */
const storedString = fc.oneof(
  fc.string({ maxLength: 12 }),
  fc.constantFrom('', 'TRUE', 'True', '1', '0', 'yes', 'no', ' true', 'true ', 'false ', 'null', 'undefined'),
  fc.constantFrom('true', 'false'),
);

function expectedFor(stored: string, def: boolean): boolean {
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return def;
}

describe('P148 stored strings read back exactly (Requirement 46.1, task 72)', () => {
  it('the table covers the seven boolean getters', () => {
    expect(used.map((g) => g.name)).toEqual([
      'directions', 'finding sound', 'graph scan', 'sticky line', 'corner heartbeat', 'guide', 'teacher',
    ]);
    expect(clean).toHaveLength(7);
  });

  it('control: nothing stored reads the documented default, and exact strings read exactly', () => {
    for (const g of clean) {
      localStorage.clear();
      expect(g.get(), `${g.name} default`).toBe(g.def);
      localStorage.setItem(g.key, 'true');
      expect(g.get(), `${g.name} 'true'`).toBe(true);
      localStorage.setItem(g.key, 'false');
      expect(g.get(), `${g.name} 'false'`).toBe(false);
    }
  });

  for (const index of [0, 1, 2, 3, 4, 5, 6]) {
    const g = used[index];
    if (g === undefined) throw new Error('getter table is incomplete');
    // Default-true getters are red today: junk reads `false`. Default-false getters pass.
    const test = g.def ? it.fails : it;
    test(`${g.name}: any other stored string reads the default (${g.def})`, () => {
      const c = clean[index];
      if (c === undefined) throw new Error('clean getter table is incomplete');
      fc.assert(
        fc.property(storedString, (stored) => {
          localStorage.setItem(c.key, stored);
          return c.get() === expectedFor(stored, c.def);
        }),
        { numRuns: runs(250), examples: [['yes'], [''], ['TRUE'], ['1'], [' true']] },
      );
    });
  }
});

describe('P149 a failed write is not lost (Requirement 46.2 and 46.3, task 72)', () => {
  const prior = fc.option(storedString, { nil: undefined });

  function failingSetItem(): ReturnType<typeof vi.spyOn> {
    return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
  }

  for (const g of used) {
    it(`control: ${g.name}: a write that succeeds reads back`, () => {
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), (first, second) => {
          g.set(first);
          g.set(second);
          return g.get() === second;
        }),
        { numRuns: runs(100) },
      );
    });

    // Red today for all seven: a stored string (valid or junk) beats the in-memory value.
    it.fails(`${g.name}: after a failed write the in-memory value wins`, () => {
      fc.assert(
        fc.property(prior, fc.boolean(), (before, value) => {
          localStorage.clear();
          if (before !== undefined) localStorage.setItem(g.key, before);
          const spy = failingSetItem();
          try {
            g.set(value);
          } finally {
            spy.mockRestore();
          }
          return g.get() === value;
        }),
        {
          numRuns: runs(250),
          examples: [
            ['false', true],
            ['true', false],
            ['yes', true],
            [undefined, true],
          ],
        },
      );
    });
  }
});
