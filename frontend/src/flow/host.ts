/**
 * Ghost Host wiring (Requirement 53.6 and 53.15): one failure tracker per flow, built on the pure
 * `core/hostPolicy.ts`. The policy decides; this file only keeps the per-flow state and looks up
 * the wording. An error with a joke is two keys: the plain key (in the language tables) and
 * `<plain key>.joke` (English only, read with `englishOnly`).
 * No browser API, no React.
 */
import {
  composeErrorLine,
  INITIAL_HOST_FLOW,
  mayJoke,
  nextFlowState,
  type HostFlowState,
} from '../core/hostPolicy';
import { englishOnly, getLang, t } from '../i18n';
import { joinAnnouncements } from './explore';

export type HostFlowName = 'capture' | 'ask' | 'save';

/** Screens that have a `host.<screen>.next` line (Requirement 53.3). */
export type HostScreen =
  | 'start'
  | 'capture'
  | 'explore'
  | 'ask'
  | 'correct'
  | 'teach'
  | 'build'
  | 'saved'
  | 'settings'
  | 'raw';

/** i18n key of the next-step line of a screen. */
export function hostNextKey(screen: HostScreen): string {
  return `host.${screen}.next`;
}

/**
 * The one utterance spoken when a screen opens: the screen's own lead (title or intro) followed
 * by its host.<screen>.next line (Requirement 53.3, 53.15a). Joined so speak() never cancels
 * the first half with the second.
 */
export function hostEntryAnnouncement(screen: HostScreen, ...lead: readonly string[]): string {
  return joinAnnouncements([...lead, t(hostNextKey(screen))]);
}

export interface HostFlow {
  /**
   * The spoken error line for one failure. Counts the failure first, so the second failure in a
   * row is the plain part only. A protected line (`jokeless`) never carries a joke.
   */
  errorLine(plainKey: string, options?: { readonly jokeless?: boolean }): string;
  /** A success resets the failure count. */
  success(): void;
  /** Leaving the flow resets the failure count. */
  leave(): void;
  /** Forgets everything, including the joke history (tests and a fresh app start). */
  reset(): void;
  /** For tests. */
  snapshot(): HostFlowState;
}

export function createHostFlow(): HostFlow {
  let state: HostFlowState = INITIAL_HOST_FLOW;
  return {
    errorLine(plainKey, options) {
      const plain = t(plainKey);
      const jokeKey = `${plainKey}.joke`;
      state = nextFlowState(state, { kind: 'failure' });
      const allow = options?.jokeless !== true && mayJoke('error', state, jokeKey, getLang());
      const joke = allow ? (englishOnly(jokeKey) ?? '') : '';
      const usable = allow && joke.trim() !== '';
      const line = composeErrorLine({ plain, joke }, usable);
      state = nextFlowState(state, usable ? { kind: 'line', jokeId: jokeKey } : { kind: 'line' });
      return line;
    },
    success() {
      state = nextFlowState(state, { kind: 'success' });
    },
    leave() {
      state = nextFlowState(state, { kind: 'leave' });
    },
    reset() {
      state = INITIAL_HOST_FLOW;
    },
    snapshot() {
      return state;
    },
  };
}

export const hostFlows: Readonly<Record<HostFlowName, HostFlow>> = {
  capture: createHostFlow(),
  ask: createHostFlow(),
  save: createHostFlow(),
};

/** Resets every flow (tests, and a fresh app start). */
export function resetHostFlows(): void {
  hostFlows.capture.reset();
  hostFlows.ask.reset();
  hostFlows.save.reset();
}
