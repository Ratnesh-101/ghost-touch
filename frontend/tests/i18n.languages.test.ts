import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getStoredLang,
  LANG_BCP47,
  LANG_NAMES,
  setLang,
  setStoredLang,
  subscribeLang,
  SUPPORTED_LANGS,
  t,
} from '../src/i18n';

function installMemoryStorage(): () => void {
  const store = new Map<string, string>();
  const fakeStorage: Storage = {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      store.set(key, String(value));
    },
    removeItem: (key: string): void => {
      store.delete(key);
    },
    clear: (): void => {
      store.clear();
    },
    get length(): number {
      return store.size;
    },
    key: (index: number): string | null => Array.from(store.keys())[index] ?? null,
  };
  const original = (globalThis as unknown as { localStorage?: Storage }).localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    value: fakeStorage,
    configurable: true,
    writable: true,
  });
  return () => {
    if (original !== undefined) {
      Object.defineProperty(globalThis, 'localStorage', {
        value: original,
        configurable: true,
        writable: true,
      });
    } else {
      delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    }
  };
}

describe('i18n multilingual support', () => {
  let restoreStorage: () => void;

  beforeEach(() => {
    restoreStorage = installMemoryStorage();
    setLang('en');
  });

  afterEach(() => {
    restoreStorage();
  });

  it('supports English, Hindi, and Gujarati with BCP47 mappings', () => {
    expect(SUPPORTED_LANGS).toEqual(['en', 'hi', 'gu']);
    expect(LANG_BCP47.en).toBe('en-IN');
    expect(LANG_BCP47.hi).toBe('hi-IN');
    expect(LANG_BCP47.gu).toBe('gu-IN');

    expect(LANG_NAMES.en.native).toBe('English');
    expect(LANG_NAMES.hi.native).toBe('हिन्दी');
    expect(LANG_NAMES.gu.native).toBe('ગુજરાતી');
  });

  it('persists language selection in localStorage', () => {
    setStoredLang('hi');
    expect(getStoredLang()).toBe('hi');
    setStoredLang('gu');
    expect(getStoredLang()).toBe('gu');
    setStoredLang('en');
    expect(getStoredLang()).toBe('en');
  });

  it('translates core UI strings across English, Hindi, and Gujarati', () => {
    setLang('en');
    expect(t('start.intro')).toBe('Ghost Touch. Tap anywhere to begin.');
    expect(t('capture.takePhoto')).toBe('Take photo');

    setLang('hi');
    expect(t('start.intro')).toBe('घोस्ट टच। शुरू करने के लिए कहीं भी टैप करें।');
    expect(t('capture.takePhoto')).toBe('फोटो लें');

    setLang('gu');
    expect(t('start.intro')).toBe('ગોસ્ટ ટચ. શરૂ કરવા માટે ગમે ત્યાં ટેપ કરો.');
    expect(t('capture.takePhoto')).toBe('ફોટો લો');
  });

  it('translates speech rate and voice command strings in all languages', () => {
    setLang('en');
    expect(t('rate.setFast')).toBe('Speech rate set to fast.');
    expect(t('commands.noSpoken')).toBe('Nothing has been spoken yet.');

    setLang('hi');
    expect(t('rate.setFast')).toBe('बोलने की गति तेज़ कर दी गई है।');
    expect(t('commands.noSpoken')).toBe('अभी तक कुछ नहीं बोला गया है।');

    setLang('gu');
    expect(t('rate.setFast')).toBe('વાણી ગતિ ઝડપી કરી દેવામાં આવી છે.');
    expect(t('commands.noSpoken')).toBe('હજુ સુધી કંઈ બોલાયું નથી.');
  });

  it('notifies subscribers on language change', () => {
    const received: string[] = [];
    const unsubscribe = subscribeLang((lang) => received.push(lang));

    setLang('hi');
    setLang('gu');
    unsubscribe();
    setLang('en');

    expect(received).toEqual(['hi', 'gu']);
  });
});
