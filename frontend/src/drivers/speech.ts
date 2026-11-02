/**
 * SpeechDriver — text-to-speech (`speechSynthesis`) and voice questions
 * (`SpeechRecognition`). The only place those APIs are touched.
 *
 * Every `speak` cancels the previous utterance (tech.md: "speech is cancelled
 * and replaced on each new target"). `listen` always settles exactly once and
 * never leaves the recogniser running.
 */

export type ListenFailure = 'unsupported' | 'timeout' | 'no-speech' | 'denied' | 'failed';

/** Rejection type of `listen`; `message` and `reason` hold the failure code. */
export class ListenError extends Error {
  constructor(readonly reason: ListenFailure) {
    super(reason);
    this.name = 'ListenError';
  }
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
}

// --- minimal browser surface (so tests can pass fakes) ----------------------
export interface UtteranceLike {
  rate: number;
  lang: string;
}
export interface SynthesisLike {
  cancel(): void;
  speak(utterance: never): void;
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
/** Slightly faster than default; matches the prototype. */
const SPEECH_RATE = 1.1;

const DENIED_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

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

  constructor(private readonly host: SpeechHost = defaultHost()) {}

  get canSpeak(): boolean {
    return this.host.synth !== undefined && this.host.createUtterance !== undefined;
  }

  get canListen(): boolean {
    return this.host.createRecognition !== undefined;
  }

  speak(text: string, lang: string = DEFAULT_SPEECH_LANG): void {
    const { synth, createUtterance } = this.host;
    if (synth === undefined || createUtterance === undefined) return;
    synth.cancel();
    const utterance = createUtterance(text);
    utterance.rate = SPEECH_RATE;
    utterance.lang = lang;
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
