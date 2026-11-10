/**
 * Decision logic for the Ask flow (Requirement 7):
 * - Sequence: listening cue (`audio.beep` / `audio.playEarcon('listening')`) -> `speech.listen` -> `requestAsk` -> `say(answer)`
 * - Errors: speaks short line and offers text fallback; never silence
 * - Concurrency: one Ask at a time; ignore second trigger while busy and say so
 * - Cleanup: timers and abort controllers cleared on every exit path
 *
 * All functions here are pure and unit-tested without DOM or browser APIs.
 */

import {
  requestAsk,
  AskRequestError,
  type AskResponse,
  type AskSource,
  type GuideTarget,
} from '../api/ask';
import type { DiagramScene } from '../core/scene';
import { ListenError, type AudioDriver, type SpeechDriver } from '../drivers';
import { getLang, LANG_BCP47, tables, t, type Lang } from '../i18n';
import { joinAnnouncements } from './explore';
import {
  verifyScene,
  getFindingTarget,
  localizedFindingTarget,
  type VerifyFinding,
} from '../core/verify';

/** Listening cue tone (Task 9.2). */
export const LISTENING_BEEP_HZ = 660;
export const LISTENING_BEEP_MS = 150;

export type AskOutcome =
  | { kind: 'success'; answer: string; source: AskSource; target?: GuideTarget }
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
  formatAnswer?: (answer: string, target?: GuideTarget) => string;
  findings?: readonly VerifyFinding[];
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

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout')) {
      return t('ask.errorTimeout');
    }
    if (msg.includes('network') || msg.includes('offline') || msg.includes('fetch')) {
      return t('ask.errorOffline');
    }
  }

  return t('ask.errorFailed');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Helper translating a dot-path key in the specified language (falling back to English). */
function tForLang(lang: Lang, key: string): string {
  const table = tables[lang];
  if (table && key in table) {
    return table[key] ?? key;
  }
  const enTable = tables.en;
  if (enTable && key in enTable) {
    return enTable[key] ?? key;
  }
  return key;
}

function tfForLang(
  lang: Lang,
  key: string,
  params: Readonly<Record<string, string>>,
): string {
  return tForLang(lang, key).replace(
    /\{(\w+)\}/g,
    (whole: string, name: string) =>
      Object.prototype.hasOwnProperty.call(params, name) ? (params[name] ?? whole) : whole,
  );
}

/**
 * Pure helper for Ask flow: checks if the question names a segment, side, or element
 * that appears in a 'disagree' finding (Requirement 3).
 *
 * Matching rules:
 * - Matches by target, name, or segmentId (case-insensitive).
 * - For 2-character segment names/ids (e.g. "AC" or "CA"), accepts reversed order.
 * - Matches on word boundaries so "AC" does not falsely match "ACTION" or "BACK".
 * - For angle disputes with 3-letter vertex codes ("ADC"), matches vertex point ("D").
 * - Returns caveat localized in caller's language (`lang`), falling back to UI language.
 * - If no match, returns null.
 */
export function caveatForQuestion(
  findings: readonly VerifyFinding[] | undefined | null,
  question: string,
  lang?: string,
): string | null {
  if (!findings || findings.length === 0 || !question) {
    return null;
  }

  const trimmedQ = question.trim();
  if (!trimmedQ) return null;

  const base = lang ? (lang.split('-')[0]?.toLowerCase() as Lang) : null;
  const resolvedLang = base || getLang();
  const safeLang: Lang = resolvedLang in tables ? resolvedLang : getLang();

  for (const finding of findings) {
    const candidates = new Set<string>();

    const addCandidate = (val: string | undefined): void => {
      if (!val) return;
      const tVal = val.trim();
      if (!tVal) return;
      candidates.add(tVal);
      if (tVal.length === 2 && /^[a-zA-Z]{2}$/.test(tVal)) {
        candidates.add(`${tVal[1]}${tVal[0]}`);
      }
      if (/^angle\s+([a-zA-Z0-9]+)$/i.test(tVal)) {
        const vertex = tVal.replace(/^angle\s+/i, '').trim();
        if (vertex) {
          candidates.add(vertex);
          if (vertex.length === 3 && /^[a-zA-Z0-9]{3}$/.test(vertex)) {
            candidates.add(vertex.charAt(1));
          }
        }
      }
    };

    // Matching uses the English target and the bare vertex; the spoken name is localised (M4-10).
    const targetName = getFindingTarget(finding);
    addCandidate(targetName);
    addCandidate(finding.segmentId);
    addCandidate(finding.angleVertex);

    // If finding targets an angle with a 3-letter vertex code,
    // also match the single-letter vertex point (kiro-glue #4).
    if (
      finding.angleVertex &&
      finding.angleVertex.length === 3 &&
      /^[a-zA-Z0-9]{3}$/.test(finding.angleVertex)
    ) {
      candidates.add(finding.angleVertex.charAt(1));
    }

    for (const cand of candidates) {
      const re = new RegExp(`(?:^|[^a-zA-Z0-9_])${escapeRegExp(cand)}(?:$|[^a-zA-Z0-9_])`, 'i');
      if (re.test(trimmedQ)) {
        const spoken = localizedFindingTarget(finding, (vertex) =>
          tfForLang(safeLang, 'verify.angleName', { vertex }),
        );
        const displayTarget = spoken || finding.segmentId || cand;
        return tfForLang(safeLang, 'verify.disagree', { name: displayTarget });
      }
    }
  }

  return null;
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

  setActiveSpeech(speech: SpeechDriver | null): void {
    this.activeSpeech = speech;
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
      try {
        deps.say(t('ask.busy'));
      } catch {
        // speech error is non-fatal
      }
      return { kind: 'busy' };
    }

    if (!deps.speech.canListen) {
      const message = t('ask.errorUnsupported');
      try {
        deps.say(message);
      } catch {
        // speech error is non-fatal
      }
      try {
        deps.onFallbackNeeded?.();
      } catch {
        // non-fatal
      }
      return { kind: 'failed', message, error: new ListenError('unsupported') };
    }

    this.busy = true;
    const controller = new AbortController();
    this.activeController = controller;
    this.activeSpeech = deps.speech;

    try {
      // Stop any TTS first so the microphone does not transcribe it as the question.
      try {
        deps.speech.stopSpeaking?.();
      } catch {
        // non-fatal
      }
      try {
        deps.audio.beep(LISTENING_BEEP_HZ, LISTENING_BEEP_MS);
      } catch {
        // non-fatal
      }
      try {
        deps.onStatusChange?.(t('ask.listening'));
      } catch {
        // non-fatal
      }

      const activeLang = deps.lang ?? LANG_BCP47[getLang()] ?? 'en-IN';
      const question = await deps.speech.listen(activeLang);

      if (controller.signal.aborted) {
        return { kind: 'cancelled' };
      }

      try {
        deps.onStatusChange?.(t('ask.thinking'));
      } catch {
        // non-fatal
      }
      // One spoken cue so a blind user is never left in silence while the request runs;
      // the answer's speak() cancels it. The microphone is already closed here.
      try {
        deps.say(t('ask.thinking'));
      } catch {
        // non-fatal
      }
      const doRequest =
        deps.request ?? ((sc, q, l, sig) => requestAsk(sc, q, l, { signal: sig }));
      const response = await doRequest(deps.scene, question, activeLang, controller.signal);

      if (controller.signal.aborted) {
        return { kind: 'cancelled' };
      }

      try {
        deps.audio.playEarcon?.('success');
      } catch {
        // non-fatal
      }
      try {
        const baseAnswer = deps.formatAnswer
          ? deps.formatAnswer(response.answer, response.target)
          : response.answer;
        const findings = deps.findings ?? (deps.scene ? verifyScene(deps.scene).findings : []);
        const caveat = caveatForQuestion(findings, question, activeLang);
        const finalAnswer = caveat ? joinAnnouncements([caveat, baseAnswer]) : baseAnswer;
        deps.say(finalAnswer);
      } catch {
        // non-fatal
      }
      return {
        kind: 'success',
        answer: response.answer,
        source: response.source,
        target: response.target,
      };
    } catch (err: unknown) {
      if (
        controller.signal.aborted ||
        (err instanceof AskRequestError && err.failure === 'aborted')
      ) {
        return { kind: 'cancelled' };
      }
      try {
        deps.audio.playEarcon?.('error');
      } catch {
        // non-fatal
      }
      const message = askErrorMessage(err);
      try {
        deps.say(message);
      } catch {
        // non-fatal
      }
      try {
        deps.onFallbackNeeded?.();
      } catch {
        // non-fatal
      }
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
      try {
        deps.say(t('ask.busy'));
      } catch {
        // non-fatal
      }
      return { kind: 'busy' };
    }

    const trimmed = question.trim();
    if (trimmed.length === 0) {
      const message = t('ask.errorEmpty');
      try {
        deps.say(message);
      } catch {
        // non-fatal
      }
      return { kind: 'empty' };
    }

    this.busy = true;
    const controller = new AbortController();
    this.activeController = controller;

    try {
      try {
        deps.onStatusChange?.(t('ask.thinking'));
      } catch {
        // non-fatal
      }
      try {
        deps.say(t('ask.thinking'));
      } catch {
        // non-fatal
      }
      const activeLang = deps.lang ?? LANG_BCP47[getLang()] ?? 'en-IN';
      const doRequest =
        deps.request ?? ((sc, q, l, sig) => requestAsk(sc, q, l, { signal: sig }));
      const response = await doRequest(deps.scene, trimmed, activeLang, controller.signal);

      if (controller.signal.aborted) {
        return { kind: 'cancelled' };
      }

      try {
        deps.audio.playEarcon?.('success');
      } catch {
        // non-fatal
      }
      try {
        const baseAnswer = deps.formatAnswer
          ? deps.formatAnswer(response.answer, response.target)
          : response.answer;
        const findings = deps.findings ?? (deps.scene ? verifyScene(deps.scene).findings : []);
        const caveat = caveatForQuestion(findings, question, activeLang);
        const finalAnswer = caveat ? joinAnnouncements([caveat, baseAnswer]) : baseAnswer;
        deps.say(finalAnswer);
      } catch {
        // non-fatal
      }
      return {
        kind: 'success',
        answer: response.answer,
        source: response.source,
        target: response.target,
      };
    } catch (err: unknown) {
      if (
        controller.signal.aborted ||
        (err instanceof AskRequestError && err.failure === 'aborted')
      ) {
        return { kind: 'cancelled' };
      }
      try {
        deps.audio.playEarcon?.('error');
      } catch {
        // non-fatal
      }
      const message = askErrorMessage(err);
      try {
        deps.say(message);
      } catch {
        // non-fatal
      }
      try {
        deps.onFallbackNeeded?.();
      } catch {
        // non-fatal
      }
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
    try {
      this.activeSpeech?.cancelListen?.();
    } catch {
      // non-fatal
    }
    this.activeSpeech = null;
    this.busy = false;
  }
}
