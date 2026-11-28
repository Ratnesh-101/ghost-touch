import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { deviceLang } from '../src/drivers/locale';
import { safeGet } from '../src/drivers/storage';
import {
  hasSpokenLangOffer,
  setSpokenLangOffer,
  speakLangOffer,
  STORAGE_KEY_LANG_OFFER,
} from '../src/flow/start';
import {
  clearStoredLang,
  getLang,
  getStoredLang,
  initLang,
  resolveInitialLang,
  setLang,
  setStoredLang,
  STORAGE_KEY_LANG,
  t,
  _resetLangForTesting,
} from '../src/i18n';
import type { Drivers } from '../src/drivers';
import { MemoryDiagramStore } from '../src/drivers';

// In-memory localStorage mock for node test runner
const memoryStorage = new Map<string, string>();
const storageMock = {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, val: string) => {
    memoryStorage.set(key, String(val));
  },
  removeItem: (key: string) => {
    memoryStorage.delete(key);
  },
  clear: () => {
    memoryStorage.clear();
  },
  key: (index: number) => Array.from(memoryStorage.keys())[index] ?? null,
  get length() {
    return memoryStorage.size;
  },
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storageMock,
    writable: true,
    configurable: true,
  });
}

// Mockable navigator.languages
const origNavigator = globalThis.navigator;
let mockLanguages: string[] | undefined = undefined;

if (typeof globalThis.navigator === 'undefined') {
  (globalThis as unknown as { navigator: unknown }).navigator = {};
}

Object.defineProperty(globalThis.navigator, 'languages', {
  get: () => mockLanguages,
  configurable: true,
});

afterAll(() => {
  if (origNavigator !== undefined) {
    Object.defineProperty(globalThis, 'navigator', {
      value: origNavigator,
      configurable: true,
    });
  }
});

function fakeDrivers(): {
  drivers: Drivers;
  calls: Array<{ text: string; lang?: string; queue?: boolean; onEnd?: () => void }>;
} {
  const calls: Array<{ text: string; lang?: string; queue?: boolean; onEnd?: () => void }> = [];
  const drivers: Drivers = {
    haptics: {
      supported: true,
      lastResult: null,
      vibrate: vi.fn(),
      stop: vi.fn(),
    },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running',
    },
    speech: {
      speak: (text, lang, options) => {
        calls.push({ text, lang, queue: options?.queue, onEnd: options?.onEnd });
      },
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  };
  return { drivers, calls };
}

describe('UX8: First-run locale & Hindi phone initialization', () => {
  beforeEach(() => {
    memoryStorage.clear();
    mockLanguages = undefined;
    _resetLangForTesting();
    setSpokenLangOffer(false);
  });

  describe('deviceLang() from navigator.languages', () => {
    it('navigator.languages missing gives en', () => {
      mockLanguages = undefined;
      expect(deviceLang()).toBe('en');
    });

    it('returns hi for hi-IN or hi locale', () => {
      mockLanguages = ['hi-IN', 'en-US'];
      expect(deviceLang()).toBe('hi');

      mockLanguages = ['hi'];
      expect(deviceLang()).toBe('hi');
    });

    it('returns gu for gu-IN or gu locale', () => {
      mockLanguages = ['gu-IN', 'en-US'];
      expect(deviceLang()).toBe('gu');

      mockLanguages = ['gu'];
      expect(deviceLang()).toBe('gu');
    });

    it('returns en for en-US or en locale', () => {
      mockLanguages = ['en-US', 'hi-IN'];
      expect(deviceLang()).toBe('en');

      mockLanguages = ['en'];
      expect(deviceLang()).toBe('en');
    });

    it('picks the first match on prefix', () => {
      // fr has no match; next is hi-IN which matches 'hi'
      mockLanguages = ['fr-FR', 'hi-IN', 'en-US'];
      expect(deviceLang()).toBe('hi');

      // de has no match; next is gu-IN which matches 'gu'
      mockLanguages = ['de-DE', 'gu-IN', 'hi-IN'];
      expect(deviceLang()).toBe('gu');
    });

    it('returns en when no languages match prefix', () => {
      mockLanguages = ['fr-FR', 'de-DE', 'es-ES'];
      expect(deviceLang()).toBe('en');
    });

    it('returns en for empty array', () => {
      mockLanguages = [];
      expect(deviceLang()).toBe('en');
    });

    it('accepts explicit language list parameter', () => {
      expect(deviceLang(['hi-IN'])).toBe('hi');
      expect(deviceLang(['gu-IN'])).toBe('gu');
      expect(deviceLang(['en-GB'])).toBe('en');
      expect(deviceLang(['ja-JP'])).toBe('en');
      expect(deviceLang([])).toBe('en');
    });

    it('safely catches errors and returns en inside try/catch', () => {
      const throwingObj = {
        get length(): number {
          throw new Error('Access denied');
        },
      };
      expect(deviceLang(throwingObj as unknown as string[])).toBe('en');
    });
  });

  describe('First run language resolution & storage invariants', () => {
    it('no stored value + hi-IN gives hi, and stores nothing until user chooses', () => {
      // Setup: no stored value in localStorage
      clearStoredLang();
      expect(safeGet(STORAGE_KEY_LANG)).toBeNull();
      expect(getStoredLang()).toBeNull();

      // Device indicates Hindi
      mockLanguages = ['hi-IN'];

      // Resolution gives Hindi
      expect(resolveInitialLang()).toBe('hi');
      expect(initLang()).toBe('hi');
      expect(getLang()).toBe('hi');

      // Crucial invariant: stores NOTHING until user chooses
      expect(safeGet(STORAGE_KEY_LANG)).toBeNull();
      expect(getStoredLang()).toBeNull();

      // All user-facing strings resolve in Hindi
      expect(t('start.intro')).toBe('घोस्ट टच। शुरू करने के लिए कहीं भी टैप करें।');
      expect(t('lab.start.wake')).toBe('जीव को जगाएं');
      expect(t('start.begin')).toBe('शुरू करें');

      // When the user explicitly chooses, only then it is stored
      setLang('gu');
      expect(getLang()).toBe('gu');
      expect(getStoredLang()).toBe('gu');
      expect(safeGet(STORAGE_KEY_LANG)).toBe('gu');
    });

    it('stored en + hi-IN gives en', () => {
      // User previously stored English
      setStoredLang('en');
      expect(getStoredLang()).toBe('en');
      expect(safeGet(STORAGE_KEY_LANG)).toBe('en');

      // Device indicates Hindi
      mockLanguages = ['hi-IN'];

      // Stored language wins over device language
      expect(resolveInitialLang()).toBe('en');
      expect(initLang()).toBe('en');
      expect(getLang()).toBe('en');

      // Strings resolve in English
      expect(t('start.intro')).toBe('Ghost Touch. Tap anywhere to begin.');
      expect(t('lab.start.wake')).toBe('Wake the creature');
      expect(t('start.begin')).toBe('Begin');
    });

    it('navigator.languages missing gives en', () => {
      clearStoredLang();
      mockLanguages = undefined;

      expect(deviceLang()).toBe('en');
      expect(resolveInitialLang()).toBe('en');
      expect(initLang()).toBe('en');
      expect(getLang()).toBe('en');
      expect(getStoredLang()).toBeNull();
    });

    it('stored gu + en-US device gives gu', () => {
      setStoredLang('gu');
      mockLanguages = ['en-US'];

      expect(resolveInitialLang()).toBe('gu');
      expect(initLang()).toBe('gu');
      expect(getLang()).toBe('gu');
    });
  });

  describe('Start and lab.start.wake strings in hi, gu, en', () => {
    it('hi translates start.begin and lab.start.wake', () => {
      setLang('hi');
      expect(t('start.begin')).toBe('शुरू करें');
      expect(t('lab.start.wake')).toBe('जीव को जगाएं');
    });

    it('gu translates start.begin and lab.start.wake', () => {
      setLang('gu');
      expect(t('start.begin')).toBe('શરૂ કરો');
      expect(t('lab.start.wake')).toBe('પ્રાણીને જગાડો');
    });

    it('en preserves start.begin and Wake the creature', () => {
      setLang('en');
      expect(t('start.begin')).toBe('Begin');
      expect(t('lab.start.wake')).toBe('Wake the creature');
    });
  });

  describe('start.langOffer in en, hi, gu and once-per-install speech', () => {
    it('start.langOffer exists in en and names Hindi, Gujarati, and Settings', () => {
      setLang('en');
      const offer = t('start.langOffer');
      expect(offer).toContain('Hindi');
      expect(offer).toContain('Gujarati');
      expect(offer).toContain('Settings');
    });

    it('start.langOffer exists in hi and names अंग्रेज़ी, गुजराती, and सेटिंग्स', () => {
      setLang('hi');
      const offer = t('start.langOffer');
      expect(offer).toContain('अंग्रेज़ी');
      expect(offer).toContain('गुजराती');
      expect(offer).toContain('सेटिंग्स');
    });

    it('start.langOffer exists in gu and names અંગ્રેજી, હિન્દી, and સેટિંગ્સ', () => {
      setLang('gu');
      const offer = t('start.langOffer');
      expect(offer).toContain('અંગ્રેજી');
      expect(offer).toContain('હિન્દી');
      expect(offer).toContain('સેટિંગ્સ');
    });

    it('speaks one line once per install naming other two languages with queue: true', () => {
      const { drivers, calls } = fakeDrivers();
      setLang('hi');

      // Initially not spoken
      expect(hasSpokenLangOffer()).toBe(false);

      // First run: speaks the offer with queue: true so it plays after intro
      const spokenFirst = speakLangOffer(drivers);
      expect(spokenFirst).toBe(true);
      // GH-05 (Requirement 53.14d): the flag is not written before the offer has been heard.
      expect(hasSpokenLangOffer()).toBe(false);
      expect(safeGet(STORAGE_KEY_LANG_OFFER)).not.toBe('true');

      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      expect(firstCall?.text).toBe(t('start.langOffer'));
      expect(firstCall?.queue).toBe(true);

      // A blocked, cancelled or replaced utterance never calls onEnd: the offer is tried again.
      expect(speakLangOffer(drivers)).toBe(true);
      expect(calls).toHaveLength(2);
      expect(hasSpokenLangOffer()).toBe(false);

      // Heard to its end: now the flag is written.
      calls[1]?.onEnd?.();
      expect(hasSpokenLangOffer()).toBe(true);
      expect(safeGet(STORAGE_KEY_LANG_OFFER)).toBe('true');

      // Subsequent visits: does not speak again (once per install)
      const spokenThird = speakLangOffer(drivers);
      expect(spokenThird).toBe(false);
      expect(calls).toHaveLength(2);
    });
  });
});
