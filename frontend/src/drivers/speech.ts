/**
 * SpeechDriver — text-to-speech (`speechSynthesis`) and voice questions
 * (`SpeechRecognition`). The only place those APIs are touched.
 *
 * Every `speak` cancels the previous utterance (tech.md: "speech is cancelled
 * and replaced on each new target"). `listen` always settles exactly once and
 * never leaves the recogniser running.
 *
 * Supports speech rate settings (slow / normal / fast) persisted in localStorage,
 * system voice picking by language (en-IN, hi-IN, gu-IN) with fallback and
 * missing voice notice.
 */

import { safeGet, safeSet } from './storage';

export type ListenFailure = 'unsupported' | 'timeout' | 'no-speech' | 'denied' | 'failed';

/** Rejection type of `listen`; `message` and `reason` hold the failure code. */
export class ListenError extends Error {
  constructor(readonly reason: ListenFailure) {
    super(reason);
    this.name = 'ListenError';
  }
}

export type SpeechRateSetting = 'slow' | 'normal' | 'fast';

export const BASE_SPEECH_RATE = 1.1;

export const SPEECH_RATE_MULTIPLIERS: Record<SpeechRateSetting, number> = {
  slow: 0.8,
  normal: 1.0,
  fast: 1.25,
};

export const STORAGE_KEY_RATE = 'gt_speech_rate';

export function getStoredSpeechRate(): SpeechRateSetting {
  const val = safeGet(STORAGE_KEY_RATE);
  if (val === 'slow' || val === 'normal' || val === 'fast') return val;
  return 'normal';
}

export function setStoredSpeechRate(rate: SpeechRateSetting): void {
  safeSet(STORAGE_KEY_RATE, rate);
}

export interface SpeechVoiceLike {
  readonly lang: string;
  readonly name: string;
  readonly default?: boolean;
}

export interface SpeechDriver {
  /** Cancel anything being spoken, then speak `text`. No-op without speech synthesis. */
  speak(text: string, lang?: string): void;
  /** Listen for one phrase. Rejects with a `ListenError`. */
  listen(lang?: string): Promise<string>;
  /** Cancel anything being spoken without starting new speech. */
  stopSpeaking?(): void;
  /** Abort a listen in progress (it rejects); no-op when idle. */
  cancelListen?(): void;
  readonly canSpeak: boolean;
  readonly canListen: boolean;

  /** Set speech rate setting: 'slow' | 'normal' | 'fast' */
  setRate?(rate: SpeechRateSetting): void;
  /** Get current speech rate setting */
  getRate?(): SpeechRateSetting;
  /** Retrieve the most recently spoken line of text */
  getLastSpoken?(): string;
  /** Check whether a system voice exists for the given language */
  hasVoiceFor?(lang: string): boolean;
  /** Reset missing voice notice warning for a language */
  resetVoiceNotice?(lang?: string): void;
}

// --- minimal browser surface (so tests can pass fakes) ----------------------
export interface UtteranceLike {
  rate: number;
  lang: string;
  voice?: SpeechVoiceLike | null;
  text?: string;
}
export interface SynthesisLike {
  cancel(): void;
  speak(utterance: never): void;
  getVoices?(): SpeechVoiceLike[];
}
export interface RecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
export interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: RecognitionResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
export interface SpeechHost {
  synth?: SynthesisLike;
  createUtterance?: (text: string) => UtteranceLike;
  createRecognition?: () => RecognitionLike;
}

export const DEFAULT_SPEECH_LANG = 'en-IN';
export const LISTEN_TIMEOUT_MS = 6000;

const DENIED_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

export interface VoiceMatchResult {
  voice?: SpeechVoiceLike;
  matchType: 'exact' | 'prefix' | 'default' | 'none';
  hasVoiceForLang: boolean;
}

/** Pure helper to pick a system voice by language with prefix fallback and default. */
export function findVoiceForLang(
  voices: readonly SpeechVoiceLike[] | undefined,
  targetLang: string,
): VoiceMatchResult {
  if (!voices || voices.length === 0) {
    return { matchType: 'none', hasVoiceForLang: false };
  }
  const normalizedTarget = targetLang.toLowerCase().replace('_', '-');
  const targetPrefix = normalizedTarget.split('-')[0] ?? normalizedTarget;

  // 1. Exact match (e.g. 'en-in' or 'hi-in')
  const exact = voices.find(
    (v) => v.lang.toLowerCase().replace('_', '-') === normalizedTarget,
  );
  if (exact) {
    return { voice: exact, matchType: 'exact', hasVoiceForLang: true };
  }

  // 2. Prefix match (e.g. 'hi' matches 'hi-IN' or 'hi-any')
  const prefix = voices.find((v) => {
    const vNorm = v.lang.toLowerCase().replace('_', '-');
    return vNorm.startsWith(targetPrefix + '-') || vNorm === targetPrefix;
  });
  if (prefix) {
    return { voice: prefix, matchType: 'prefix', hasVoiceForLang: true };
  }

  // 3. Fallback to default voice or first available
  const defaultVoice = voices.find((v) => v.default) ?? voices[0];
  return { voice: defaultVoice, matchType: 'default', hasVoiceForLang: false };
}

function defaultHost(): SpeechHost {
  if (typeof window === 'undefined') return {};
  const w = window as Window & {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : undefined;
  return {
    synth: synth as unknown as SynthesisLike | undefined,
    createUtterance:
      synth === undefined ? undefined : (text) => new SpeechSynthesisUtterance(text),
    createRecognition: Recognition === undefined ? undefined : () => new Recognition(),
  };
}

function failureFor(error: string): ListenFailure {
  if (error === 'no-speech') return 'no-speech';
  if (DENIED_ERRORS.has(error)) return 'denied';
  if (error === 'language-not-supported') return 'unsupported';
  return 'failed';
}

export class WebSpeechDriver implements SpeechDriver {
  /** Ends the listen session in progress, if any (only one at a time). */
  private endActive: (() => void) | undefined;
  private rateSetting: SpeechRateSetting = getStoredSpeechRate();
  private lastSpokenText = '';
  private warnedMissingLangs = new Set<string>();
  private isSpeakingNotice = false;

  constructor(private readonly host: SpeechHost = defaultHost()) {}

  get canSpeak(): boolean {
    return this.host.synth !== undefined && this.host.createUtterance !== undefined;
  }

  get canListen(): boolean {
    return this.host.createRecognition !== undefined;
  }

  getRate(): SpeechRateSetting {
    return this.rateSetting;
  }

  setRate(rate: SpeechRateSetting): void {
    this.rateSetting = rate;
    setStoredSpeechRate(rate);
  }

  getLastSpoken(): string {
    return this.lastSpokenText;
  }

  hasVoiceFor(lang: string): boolean {
    const voices = this.host.synth?.getVoices?.();
    if (!voices || voices.length === 0) return true; // Cannot determine: assume true
    return findVoiceForLang(voices, lang).hasVoiceForLang;
  }

  resetVoiceNotice(lang?: string): void {
    if (lang) {
      this.warnedMissingLangs.delete(lang);
    } else {
      this.warnedMissingLangs.clear();
    }
  }

  speak(text: string, lang: string = DEFAULT_SPEECH_LANG): void {
    const { synth, createUtterance } = this.host;
    if (synth === undefined || createUtterance === undefined) return;
    this.lastSpokenText = text;

    const rate = BASE_SPEECH_RATE * SPEECH_RATE_MULTIPLIERS[this.rateSetting];
    const voices = synth.getVoices?.();
    const match = findVoiceForLang(voices, lang);

    // Cancel anything being spoken
    synth.cancel();

    // Speak a notice when no voice for the chosen language exists (once per language session)
    if (
      voices &&
      voices.length > 0 &&
      !match.hasVoiceForLang &&
      !this.warnedMissingLangs.has(lang) &&
      !this.isSpeakingNotice
    ) {
      this.warnedMissingLangs.add(lang);
      this.isSpeakingNotice = true;
      try {
        const langDisplay = lang.split('-')[0]?.toUpperCase() ?? lang;
        const noticeUtterance = createUtterance(
          `No system voice found for ${langDisplay}. Using default voice.`,
        );
        noticeUtterance.rate = rate;
        noticeUtterance.lang = match.voice?.lang ?? DEFAULT_SPEECH_LANG;
        if (match.voice) noticeUtterance.voice = match.voice;
        synth.speak(noticeUtterance as never);
      } finally {
        this.isSpeakingNotice = false;
      }
    }

    const utterance = createUtterance(text);
    utterance.rate = rate;
    utterance.lang = match.voice?.lang ?? lang;
    if (match.voice) {
      utterance.voice = match.voice;
    }
    synth.speak(utterance as never);
  }

  stopSpeaking(): void {
    this.host.synth?.cancel();
  }

  cancelListen(): void {
    this.endActive?.();
  }

  listen(lang: string = DEFAULT_SPEECH_LANG): Promise<string> {
    const { createRecognition } = this.host;
    if (createRecognition === undefined) {
      return Promise.reject(new ListenError('unsupported'));
    }
    // A second call (for example a double-tap) replaces the first session.
    this.endActive?.();
    return new Promise<string>((resolve, reject) => {
      const recognition = createRecognition();
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const finish = (outcome: { text: string } | { failure: ListenFailure }): void => {
        if (settled) return;
        settled = true;
        this.endActive = undefined;
        if (timer !== undefined) clearTimeout(timer);
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try {
          recognition.stop();
        } catch {
          // stop() throws if recognition already ended; nothing left to stop.
        }
        if ('text' in outcome) resolve(outcome.text);
        else reject(new ListenError(outcome.failure));
      };

      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const text = event.results[0]?.[0]?.transcript?.trim() ?? '';
        finish(text === '' ? { failure: 'no-speech' } : { text });
      };
      recognition.onerror = (event) => finish({ failure: failureFor(event.error) });
      recognition.onend = () => finish({ failure: 'no-speech' });
      timer = setTimeout(() => finish({ failure: 'timeout' }), LISTEN_TIMEOUT_MS);
      this.endActive = () => finish({ failure: 'failed' });
      try {
        recognition.start();
      } catch {
        finish({ failure: 'failed' });
      }
    });
  }
}
