/**
 * Decision logic for the Ask flow (Requirement 7):
 * - Sequence: listening cue (`audio.beep` / `audio.playEarcon('listening')`) -> `speech.listen` -> `requestAsk` -> `say(answer)`
 * - Errors: speaks short line and offers text fallback; never silence
 * - Concurrency: one Ask at a time; ignore second trigger while busy and say so
 * - Cleanup: timers and abort controllers cleared on every exit path
 *
 * All functions here are pure and unit-tested without DOM or browser APIs.
 */

import { requestAsk, AskRequestError, type AskResponse, type AskSource } from '../api/ask';
import type { DiagramScene } from '../core/scene';
import { ListenError, type AudioDriver, type SpeechDriver } from '../drivers';
import { getLang, LANG_BCP47, t } from '../i18n';

/** Listening cue tone (Task 9.2). */
export const LISTENING_BEEP_HZ = 660;
export const LISTENING_BEEP_MS = 150;

export type AskOutcome =
  | { kind: 'success'; answer: string; source: AskSource }
  | { kind: 'busy' }
  | { kind: 'empty' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string; error?: unknown };

export interface AskDeps {
  audio: AudioDriver;
  speech: SpeechDriver;
  scene: DiagramScene;
  lang?: string;
  /** Say aloud and display in status text. */
  say: (text: string) => void;
  onStatusChange?: (status: string) => void;
  onFallbackNeeded?: () => void;
  request?: (
    scene: DiagramScene,
    question: string,
    lang: string,
    signal: AbortSignal,
  ) => Promise<AskResponse>;
}

/**
 * Maps listen, network, and server errors to friendly spoken failure lines.
 * Every failure line offers the text box fallback (Requirement 7.4).
 */
export function askErrorMessage(error: unknown): string {
  if (error instanceof ListenError) {
    switch (error.reason) {
      case 'no-speech':
        return t('ask.errorNoSpeech');
      case 'denied':
        return t('ask.errorDenied');
      case 'timeout':
        return t('ask.errorListenTimeout');
      case 'unsupported':
        return t('ask.errorUnsupported');
      case 'failed':
      default:
        return t('ask.errorFailed');
    }
  }

  if (error instanceof AskRequestError) {
    switch (error.failure) {
      case 'timeout':
        return t('ask.errorTimeout');
      case 'network':
        return t('ask.errorOffline');
      case 'http':
      case 'bad-response':
      default:
        return t('ask.errorServer');
    }
  }

  return t('ask.errorFailed');
}

/**
 * AskManager manages single-flight execution, abort signaling on unmount,
 * and error fallbacks for voice and text questions.
 */
export class AskManager {
  private busy = false;
  private activeController: AbortController | null = null;
  private activeSpeech: SpeechDriver | null = null;

  isBusy(): boolean {
    return this.busy;
  }

  /**
   * Run the voice ask flow:
   * 1. Cue beep / listening earcon
   * 2. Listen
   * 3. Send request
   * 4. Speak answer
   */
  async startVoiceAsk(deps: AskDeps): Promise<AskOutcome> {
    if (this.busy) {
      deps.say(t('ask.busy'));
      return { kind: 'busy' };
    }

    if (!deps.speech.canListen) {
      const message = t('ask.errorUnsupported');
      deps.say(message);
      deps.onFallbackNeeded?.();
      return { kind: 'failed', message, error: new ListenError('unsupported') };
    }

    this.busy = true;
    const controller = new AbortController();
    this.activeController = controller;
    this.activeSpeech = deps.speech;

    try {
      // Stop any TTS first so the microphone does not transcribe it as the question.
      deps.speech.stopSpeaking?.();
      deps.audio.beep(LISTENING_BEEP_HZ, LISTENING_BEEP_MS);
      deps.onStatusChange?.(t('ask.listening'));

      const activeLang = deps.lang ?? LANG_BCP47[getLang()] ?? 'en-IN';
      const question = await deps.speech.listen(activeLang);

      if (controller.signal.aborted) {
        return { kind: 'cancelled' };
      }

      deps.onStatusChange?.(t('ask.thinking'));
      // One spoken cue so a blind user is never left in silence while the request runs;
      // the answer's speak() cancels it. The microphone is already closed here.
      deps.say(t('ask.thinking'));
      const doRequest =
        deps.request ?? ((sc, q, l, sig) => requestAsk(sc, q, l, { signal: sig }));
      const response = await doRequest(deps.scene, question, activeLang, controller.signal);

      if (controller.signal.aborted) {
        return { kind: 'cancelled' };
      }

      deps.audio.playEarcon?.('success');
      deps.say(response.answer);
      return { kind: 'success', answer: response.answer, source: response.source };
    } catch (err: unknown) {
      if (
        controller.signal.aborted ||
        (err instanceof AskRequestError && err.failure === 'aborted')
      ) {
        return { kind: 'cancelled' };
      }
      deps.audio.playEarcon?.('error');
      const message = askErrorMessage(err);
      deps.say(message);
      deps.onFallbackNeeded?.();
      return { kind: 'failed', message, error: err };
    } finally {
      // Only the active call may clear state; an aborted call must not clobber a newer ask.
      if (this.activeController === controller) {
        this.busy = false;
        this.activeController = null;
        this.activeSpeech = null;
      }
    }
  }

  /**
   * Submit a typed question via text fallback.
   */
  async submitTextAsk(question: string, deps: AskDeps): Promise<AskOutcome> {
    if (this.busy) {
      deps.say(t('ask.busy'));
      return { kind: 'busy' };
    }

    const trimmed = question.trim();
    if (trimmed.length === 0) {
      const message = t('ask.errorEmpty');
      deps.say(message);
      return { kind: 'empty' };
    }

    this.busy = true;
    const controller = new AbortController();
    this.activeController = controller;

    try {
      deps.onStatusChange?.(t('ask.thinking'));
      deps.say(t('ask.thinking'));
      const activeLang = deps.lang ?? LANG_BCP47[getLang()] ?? 'en-IN';
      const doRequest =
        deps.request ?? ((sc, q, l, sig) => requestAsk(sc, q, l, { signal: sig }));
      const response = await doRequest(deps.scene, trimmed, activeLang, controller.signal);

      if (controller.signal.aborted) {
        return { kind: 'cancelled' };
      }

      deps.audio.playEarcon?.('success');
      deps.say(response.answer);
      return { kind: 'success', answer: response.answer, source: response.source };
    } catch (err: unknown) {
      if (
        controller.signal.aborted ||
        (err instanceof AskRequestError && err.failure === 'aborted')
      ) {
        return { kind: 'cancelled' };
      }
      deps.audio.playEarcon?.('error');
      const message = askErrorMessage(err);
      deps.say(message);
      return { kind: 'failed', message, error: err };
    } finally {
      // Only the active call may clear state; an aborted call must not clobber a newer ask.
      if (this.activeController === controller) {
        this.busy = false;
        this.activeController = null;
        this.activeSpeech = null;
      }
    }
  }

  /**
   * Abort any ongoing request (for example, on screen unmount).
   */
  abort(): void {
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
    this.activeSpeech?.cancelListen?.();
    this.activeSpeech = null;
    this.busy = false;
  }
}
