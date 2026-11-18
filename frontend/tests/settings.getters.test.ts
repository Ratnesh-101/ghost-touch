// @vitest-environment jsdom
/**
 * Tests for getStoredGraphScanSetting and getStoredGuideSetting (Requirement 46, P148 and P149).
 *
 * P148: with nothing in memory, a stored 'true' reads true, 'false' reads false, and any
 *   other string (or nothing) reads the documented default:
 *   - graph scan default is true
 *   - guide default is false
 * P149: when localStorage.setItem throws, the value just set is what the getter returns,
 *   whatever string was stored before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetGuideSettingForTesting,
  getStoredGuideSetting,
  setStoredGuideSetting,
  STORAGE_KEY_GUIDE,
} from '../src/config/features';
import {
  _resetGraphScanSettingForTesting,
  getStoredGraphScanSetting,
  setStoredGraphScanSetting,
  STORAGE_KEY_GRAPH_SCAN,
} from '../src/flow/explore';
import {
  _resetTeacherSettingForTesting,
  getStoredTeacherSetting,
  setStoredTeacherSetting,
  STORAGE_KEY_TEACHER,
} from '../src/flow/teach';

function failingSetItem(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  });
}

const JUNK_STRINGS = [
  '',
  'yes',
  'no',
  'TRUE',
  'True',
  '1',
  '0',
  ' true',
  'true ',
  'false ',
  'null',
  'undefined',
  'random-junk',
];

describe('Storage getters: graph scan, guide, and teacher (Requirement 46, P148 & P149)', () => {
  beforeEach(() => {
    _resetGraphScanSettingForTesting();
    _resetGuideSettingForTesting();
    _resetTeacherSettingForTesting();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetGraphScanSettingForTesting();
    _resetGuideSettingForTesting();
    _resetTeacherSettingForTesting();
    localStorage.clear();
  });

  describe('P148: stored strings read back exactly, junk reads default', () => {
    describe('graph scan (default: true)', () => {
      it('nothing stored reads documented default (true)', () => {
        expect(getStoredGraphScanSetting()).toBe(true);
      });

      it("stored 'true' reads true", () => {
        localStorage.setItem(STORAGE_KEY_GRAPH_SCAN, 'true');
        expect(getStoredGraphScanSetting()).toBe(true);
      });

      it("stored 'false' reads false", () => {
        localStorage.setItem(STORAGE_KEY_GRAPH_SCAN, 'false');
        expect(getStoredGraphScanSetting()).toBe(false);
      });

      for (const junk of JUNK_STRINGS) {
        it(`stored junk '${junk}' reads default (true)`, () => {
          localStorage.setItem(STORAGE_KEY_GRAPH_SCAN, junk);
          expect(getStoredGraphScanSetting()).toBe(true);
        });
      }
    });

    describe('guide (default: false)', () => {
      it('nothing stored reads documented default (false)', () => {
        expect(getStoredGuideSetting()).toBe(false);
      });

      it("stored 'true' reads true", () => {
        localStorage.setItem(STORAGE_KEY_GUIDE, 'true');
        expect(getStoredGuideSetting()).toBe(true);
      });

      it("stored 'false' reads false", () => {
        localStorage.setItem(STORAGE_KEY_GUIDE, 'false');
        expect(getStoredGuideSetting()).toBe(false);
      });

      for (const junk of JUNK_STRINGS) {
        it(`stored junk '${junk}' reads default (false)`, () => {
          localStorage.setItem(STORAGE_KEY_GUIDE, junk);
          expect(getStoredGuideSetting()).toBe(false);
        });
      }
    });

    describe('teacher (default: false)', () => {
      it('nothing stored reads documented default (false)', () => {
        expect(getStoredTeacherSetting()).toBe(false);
      });

      it("stored 'true' reads true", () => {
        localStorage.setItem(STORAGE_KEY_TEACHER, 'true');
        expect(getStoredTeacherSetting()).toBe(true);
      });

      it("stored 'false' reads false", () => {
        localStorage.setItem(STORAGE_KEY_TEACHER, 'false');
        expect(getStoredTeacherSetting()).toBe(false);
      });

      for (const junk of JUNK_STRINGS) {
        it(`stored junk '${junk}' reads default (false)`, () => {
          localStorage.setItem(STORAGE_KEY_TEACHER, junk);
          expect(getStoredTeacherSetting()).toBe(false);
        });
      }
    });
  });

  describe('P149: failed write is not lost (in-memory value wins)', () => {
    describe('graph scan', () => {
      it('successful writes update in-memory and read back', () => {
        setStoredGraphScanSetting(false);
        expect(getStoredGraphScanSetting()).toBe(false);
        setStoredGraphScanSetting(true);
        expect(getStoredGraphScanSetting()).toBe(true);
      });

      it("after failed write from 'false' to true, in-memory true wins", () => {
        localStorage.setItem(STORAGE_KEY_GRAPH_SCAN, 'false');
        const spy = failingSetItem();
        try {
          setStoredGraphScanSetting(true);
        } finally {
          spy.mockRestore();
        }
        // LocalStorage still holds 'false' because setItem threw
        expect(localStorage.getItem(STORAGE_KEY_GRAPH_SCAN)).toBe('false');
        // But getter returns true (the value just set)
        expect(getStoredGraphScanSetting()).toBe(true);
      });

      it("after failed write from 'true' to false, in-memory false wins", () => {
        localStorage.setItem(STORAGE_KEY_GRAPH_SCAN, 'true');
        const spy = failingSetItem();
        try {
          setStoredGraphScanSetting(false);
        } finally {
          spy.mockRestore();
        }
        expect(localStorage.getItem(STORAGE_KEY_GRAPH_SCAN)).toBe('true');
        expect(getStoredGraphScanSetting()).toBe(false);
      });

      it('after failed write with junk in storage, in-memory value wins', () => {
        localStorage.setItem(STORAGE_KEY_GRAPH_SCAN, 'yes');
        const spy = failingSetItem();
        try {
          setStoredGraphScanSetting(false);
        } finally {
          spy.mockRestore();
        }
        expect(getStoredGraphScanSetting()).toBe(false);
      });
    });

    describe('guide', () => {
      it('successful writes update in-memory and read back', () => {
        setStoredGuideSetting(true);
        expect(getStoredGuideSetting()).toBe(true);
        setStoredGuideSetting(false);
        expect(getStoredGuideSetting()).toBe(false);
      });

      it("after failed write from 'false' to true, in-memory true wins", () => {
        localStorage.setItem(STORAGE_KEY_GUIDE, 'false');
        const spy = failingSetItem();
        try {
          setStoredGuideSetting(true);
        } finally {
          spy.mockRestore();
        }
        expect(localStorage.getItem(STORAGE_KEY_GUIDE)).toBe('false');
        expect(getStoredGuideSetting()).toBe(true);
      });

      it("after failed write from 'true' to false, in-memory false wins", () => {
        localStorage.setItem(STORAGE_KEY_GUIDE, 'true');
        const spy = failingSetItem();
        try {
          setStoredGuideSetting(false);
        } finally {
          spy.mockRestore();
        }
        expect(localStorage.getItem(STORAGE_KEY_GUIDE)).toBe('true');
        expect(getStoredGuideSetting()).toBe(false);
      });

      it('after failed write with junk in storage, in-memory value wins', () => {
        localStorage.setItem(STORAGE_KEY_GUIDE, 'yes');
        const spy = failingSetItem();
        try {
          setStoredGuideSetting(true);
        } finally {
          spy.mockRestore();
        }
        expect(getStoredGuideSetting()).toBe(true);
      });
    });

    describe('teacher', () => {
      it('successful writes update in-memory and read back', () => {
        setStoredTeacherSetting(true);
        expect(getStoredTeacherSetting()).toBe(true);
        setStoredTeacherSetting(false);
        expect(getStoredTeacherSetting()).toBe(false);
      });

      it("after failed write from 'false' to true, in-memory true wins", () => {
        localStorage.setItem(STORAGE_KEY_TEACHER, 'false');
        const spy = failingSetItem();
        try {
          setStoredTeacherSetting(true);
        } finally {
          spy.mockRestore();
        }
        expect(localStorage.getItem(STORAGE_KEY_TEACHER)).toBe('false');
        expect(getStoredTeacherSetting()).toBe(true);
      });

      it("after failed write from 'true' to false, in-memory false wins", () => {
        localStorage.setItem(STORAGE_KEY_TEACHER, 'true');
        const spy = failingSetItem();
        try {
          setStoredTeacherSetting(false);
        } finally {
          spy.mockRestore();
        }
        expect(localStorage.getItem(STORAGE_KEY_TEACHER)).toBe('true');
        expect(getStoredTeacherSetting()).toBe(false);
      });

      it('after failed write with junk in storage, in-memory value wins', () => {
        localStorage.setItem(STORAGE_KEY_TEACHER, 'yes');
        const spy = failingSetItem();
        try {
          setStoredTeacherSetting(true);
        } finally {
          spy.mockRestore();
        }
        expect(getStoredTeacherSetting()).toBe(true);
      });
    });
  });
});
