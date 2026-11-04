import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BASE_SPEECH_RATE,
  findVoiceForLang,
  getStoredSpeechRate,
  setStoredSpeechRate,
  SPEECH_RATE_MULTIPLIERS,
  STORAGE_KEY_RATE,
  WebSpeechDriver,
  type SpeechHost,
  type SpeechVoiceLike,
  type UtteranceLike,
} from '../src/drivers/speech';

function makeVoices(): SpeechVoiceLike[] {
  return [
    { lang: 'en-US', name: 'Samantha', default: true },
    { lang: 'en-IN', name: 'Rishi' },
    { lang: 'hi-IN', name: 'Lekha' },
    { lang: 'es-ES', name: 'Monica' },
  ];
}

describe('findVoiceForLang', () => {
  it('finds exact match for en-IN', () => {
    const voices = makeVoices();
    const result = findVoiceForLang(voices, 'en-IN');
    expect(result.hasVoiceForLang).toBe(true);
    expect(result.matchType).toBe('exact');
    expect(result.voice?.name).toBe('Rishi');
  });

  it('finds exact match for hi-IN', () => {
    const voices = makeVoices();
    const result = findVoiceForLang(voices, 'hi-IN');
    expect(result.hasVoiceForLang).toBe(true);
    expect(result.matchType).toBe('exact');
    expect(result.voice?.name).toBe('Lekha');
  });

  it('finds prefix match when country code differs', () => {
    const voices = makeVoices();
    const result = findVoiceForLang(voices, 'en-GB');
    expect(result.hasVoiceForLang).toBe(true);
    expect(result.matchType).toBe('prefix');
    expect(result.voice?.lang.startsWith('en')).toBe(true);
  });

  it('falls back to default voice when no language matches (e.g. gu-IN)', () => {
    const voices = makeVoices();
    const result = findVoiceForLang(voices, 'gu-IN');
    expect(result.hasVoiceForLang).toBe(false);
    expect(result.matchType).toBe('default');
    expect(result.voice?.name).toBe('Samantha');
  });

  it('handles empty or undefined voice list safely', () => {
    expect(findVoiceForLang([], 'en-IN')).toEqual({ matchType: 'none', hasVoiceForLang: false });
    expect(findVoiceForLang(undefined, 'en-IN')).toEqual({ matchType: 'none', hasVoiceForLang: false });
  });
});

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

describe('Speech rate storage', () => {
  let restoreStorage: () => void;

  beforeEach(() => {
    restoreStorage = installMemoryStorage();
  });

  afterEach(() => {
    restoreStorage();
  });

  it('persists and retrieves speech rate from localStorage', () => {
    setStoredSpeechRate('fast');
    expect(getStoredSpeechRate()).toBe('fast');
    setStoredSpeechRate('slow');
    expect(getStoredSpeechRate()).toBe('slow');
    setStoredSpeechRate('normal');
    expect(getStoredSpeechRate()).toBe('normal');
  });

  it('defaults to normal when stored value is invalid', () => {
    localStorage.setItem(STORAGE_KEY_RATE, 'invalid_speed');
    expect(getStoredSpeechRate()).toBe('normal');
  });
});

function fakeSpeechHost(voices?: SpeechVoiceLike[]): {
  host: SpeechHost;
  spokenUtterances: Array<UtteranceLike & { text: string }>;
  cancelled: number;
} {
  const spokenUtterances: Array<UtteranceLike & { text: string }> = [];
  let cancelled = 0;

  const host: SpeechHost = {
    synth: {
      cancel: () => {
        cancelled++;
      },
      speak: (utt) => {
        spokenUtterances.push(utt as unknown as UtteranceLike & { text: string });
      },
      getVoices: () => voices ?? makeVoices(),
    },
    createUtterance: (text: string) => {
      const u = {
        text,
        rate: 1.0,
        lang: '',
        voice: null,
      };
      return u;
    },
  };

  return { host, spokenUtterances, cancelled };
}

describe('WebSpeechDriver voice and rate integration', () => {
  it('applies speech rate multipliers correctly: slow (0.8x), normal (1.0x), fast (1.25x)', () => {
    const { host, spokenUtterances } = fakeSpeechHost();
    const driver = new WebSpeechDriver(host);

    driver.setRate('slow');
    driver.speak('Slow test', 'en-IN');
    expect(spokenUtterances[0]?.rate).toBeCloseTo(BASE_SPEECH_RATE * SPEECH_RATE_MULTIPLIERS.slow, 4);

    driver.setRate('normal');
    driver.speak('Normal test', 'en-IN');
    expect(spokenUtterances[1]?.rate).toBeCloseTo(BASE_SPEECH_RATE * SPEECH_RATE_MULTIPLIERS.normal, 4);

    driver.setRate('fast');
    driver.speak('Fast test', 'en-IN');
    expect(spokenUtterances[2]?.rate).toBeCloseTo(BASE_SPEECH_RATE * SPEECH_RATE_MULTIPLIERS.fast, 4);
  });

  it('sets matched voice on utterance', () => {
    const { host, spokenUtterances } = fakeSpeechHost();
    const driver = new WebSpeechDriver(host);

    driver.speak('नमस्ते', 'hi-IN');
    expect(spokenUtterances[0]?.voice?.name).toBe('Lekha');
    expect(spokenUtterances[0]?.lang).toBe('hi-IN');
  });

  it('speaks notice when no voice for chosen language exists', () => {
    const { host, spokenUtterances } = fakeSpeechHost();
    const driver = new WebSpeechDriver(host);

    driver.speak('નમસ્તે', 'gu-IN');
    // First utterance is the missing voice notice
    expect(spokenUtterances).toHaveLength(2);
    expect(spokenUtterances[0]?.text).toContain('No system voice found for GU');
    // Second utterance is the actual text
    expect(spokenUtterances[1]?.text).toBe('નમસ્તે');
  });

  it('does not repeat missing voice notice consecutively for same language', () => {
    const { host, spokenUtterances } = fakeSpeechHost();
    const driver = new WebSpeechDriver(host);

    driver.speak('લાઇન A', 'gu-IN');
    driver.speak('લાઇન B', 'gu-IN');
    // Notice spoken only once on first occurrence
    const notices = spokenUtterances.filter((u) => u.text.includes('No system voice found'));
    expect(notices).toHaveLength(1);
  });

  it('tracks last spoken text', () => {
    const { host } = fakeSpeechHost();
    const driver = new WebSpeechDriver(host);

    expect(driver.getLastSpoken()).toBe('');
    driver.speak('Point C');
    expect(driver.getLastSpoken()).toBe('Point C');
    driver.speak('Segment AB');
    expect(driver.getLastSpoken()).toBe('Segment AB');
  });
});
