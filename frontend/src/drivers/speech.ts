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

import { t } from '../i18n';
import { safeGet, safeSet } from './storage';

export type ListenFailure =
  | 'unsupported'
  | 'timeout'
  | 'no-speech'
  | 'denied'
  | 'failed'
  | 'cancelled';

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

export interface SpeakOptions {
  queue?: boolean;
}

export interface SpeechDriver {
  /** Cancel anything being spoken (unless queue is true), then speak `text`. No-op without speech synthesis. */
  speak(text: string, lang?: string, options?: SpeakOptions): void;
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
  /** Teardown lifecycle listeners and cancel speech if any */
  dispose?(): void;
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
  abort?(): void;
}
export interface SpeechHost {
  synth?: SynthesisLike;
  createUtterance?: (text: string) => UtteranceLike;
  createRecognition?: () => RecognitionLike;
  window?: {
    addEventListener(type: string, listener: (ev: unknown) => void): void;
    removeEventListener(type: string, listener: (ev: unknown) => void): void;
  };
  document?: {
    addEventListener(type: string, listener: (ev: unknown) => void): void;
    removeEventListener(type: string, listener: (ev: unknown) => void): void;
    readonly hidden?: boolean;
    readonly visibilityState?: string;
  };
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
    window: typeof window !== 'undefined' ? window : undefined,
    document: typeof document !== 'undefined' ? document : undefined,
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
  private cancelActive: ((reason?: ListenFailure, aborted?: boolean) => void) | undefined;
  private rateSetting: SpeechRateSetting = getStoredSpeechRate();
  private lastSpokenText = '';
  private warnedMissingLangs = new Set<string>();
  private isSpeakingNotice = false;
  private readonly win?: {
    addEventListener(type: string, listener: (ev: unknown) => void): void;
    removeEventListener(type: string, listener: (ev: unknown) => void): void;
  };
  private readonly doc?: {
    addEventListener(type: string, listener: (ev: unknown) => void): void;
    removeEventListener(type: string, listener: (ev: unknown) => void): void;
    readonly hidden?: boolean;
    readonly visibilityState?: string;
  };
  private readonly onVisibilityChange?: () => void;
  private readonly onPageHide?: () => void;
  private disposed = false;

  constructor(private readonly host: SpeechHost = defaultHost()) {
    this.win = host.window ?? (typeof window !== 'undefined' ? window : undefined);
    this.doc = host.document ?? (typeof document !== 'undefined' ? document : undefined);

    this.onVisibilityChange = () => {
      if (this.doc && (this.doc.hidden === true || this.doc.visibilityState === 'hidden')) {
        this.host.synth?.cancel();
      }
    };
    this.onPageHide = () => {
      this.host.synth?.cancel();
    };

    this.doc?.addEventListener('visibilitychange', this.onVisibilityChange);
    this.win?.addEventListener('pagehide', this.onPageHide);
  }

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

  speak(
    text: string,
    lang: string = DEFAULT_SPEECH_LANG,
    options?: SpeakOptions,
  ): void {
    const { synth, createUtterance } = this.host;
    if (synth === undefined || createUtterance === undefined) return;
    this.lastSpokenText = text;

    const rate = BASE_SPEECH_RATE * SPEECH_RATE_MULTIPLIERS[this.rateSetting];
    const voices = synth.getVoices?.();
    const match = findVoiceForLang(voices, lang);

    const shouldQueue = options?.queue ?? false;

    // Cancel anything being spoken unless queued
    if (!shouldQueue) {
      synth.cancel();
    }

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
        // Text comes from the language tables, not from this file (CORE-10, rule 7).
        const noticeUtterance = createUtterance(
          t('speech.noVoiceNotice').replace('{lang}', langDisplay),
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

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.onVisibilityChange && this.doc) {
      this.doc.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (this.onPageHide && this.win) {
      this.win.removeEventListener('pagehide', this.onPageHide);
    }
    this.host.synth?.cancel();
  }

  cancelListen(): void {
    this.cancelActive?.('cancelled');
  }

  listen(lang: string = DEFAULT_SPEECH_LANG): Promise<string> {
    const { createRecognition } = this.host;
    if (createRecognition === undefined) {
      return Promise.reject(new ListenError('unsupported'));
    }
    // A second call (for example a double-tap) replaces the first session.
    this.cancelActive?.('failed', false);

    const win = this.win;
    const doc = this.doc;

    return new Promise<string>((resolve, reject) => {
      const recognition = createRecognition();
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const cleanupListeners = (): void => {
        win?.removeEventListener('pagehide', onPageHide);
        doc?.removeEventListener('visibilitychange', onVisibilityChange);
      };

      const finish = (
        outcome: { text: string } | { failure: ListenFailure },
        aborted = false,
      ): void => {
        if (settled) return;
        settled = true;
        this.cancelActive = undefined;
        if (timer !== undefined) clearTimeout(timer);
        cleanupListeners();
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try {
          if (aborted && typeof recognition.abort === 'function') {
            recognition.abort();
          } else {
            recognition.stop();
          }
        } catch {
          // stop() or abort() throws if recognition already ended; nothing left to stop.
        }
        if ('text' in outcome) resolve(outcome.text);
        else reject(new ListenError(outcome.failure));
      };

      const onPageHide = (): void => {
        finish({ failure: 'cancelled' }, true);
      };

      const onVisibilityChange = (): void => {
        if (doc && (doc.hidden === true || doc.visibilityState === 'hidden')) {
          finish({ failure: 'cancelled' }, true);
        }
      };

      win?.addEventListener('pagehide', onPageHide);
      doc?.addEventListener('visibilitychange', onVisibilityChange);

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
      this.cancelActive = (reason = 'cancelled', aborted = true) =>
        finish({ failure: reason }, aborted);
      try {
        recognition.start();
      } catch {
        finish({ failure: 'failed' });
      }
    });
  }
}
