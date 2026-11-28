/**
 * Ghost Host policy (Requirement 53, task 92.2). Pure and total: no React, DOM, i18n or flow
 * imports, never throws, never mutates its inputs. Wording comes from the callers through t().
 * It emits no vibrate, tone or earcon effect and holds no tuned haptic value.
 */

export type HostCategory =
  | 'greeting'
  | 'nextStep'
  | 'error'
  | 'permission'
  | 'confirm'
  | 'fact'
  | 'crash';

export interface HostFlowState {
  readonly failures: number;
  readonly lastJoke: string | null;
  readonly linesSinceJoke: number;
}

export interface ErrorParts {
  readonly plain: string;
  readonly joke?: string;
}

export type HostEvent =
  | { readonly kind: 'failure' | 'success' | 'leave' }
  | { readonly kind: 'line'; readonly jokeId?: string };

export interface HostLint {
  readonly ok: boolean;
  readonly problems: string[];
}

export const INITIAL_HOST_FLOW: HostFlowState = { failures: 0, lastJoke: null, linesSinceJoke: 0 };

/** Lines to wait after a joke before the next one (Requirement 53.6: one joke per three lines). */
export const JOKE_GAP_LINES = 3;
/** Longest joke clause, in words (Requirement 53.4). */
export const MAX_JOKE_WORDS = 8;
/** Longest sentence, in words (Requirement 53.9). */
export const MAX_SENTENCE_WORDS = 25;

const JOKE_FREE: ReadonlySet<string> = new Set(['permission', 'confirm', 'fact', 'crash']);
const JOKE_ALLOWED: ReadonlySet<string> = new Set(['greeting', 'nextStep', 'error']);
const LINES_CAP = 1_000_000;

function cleanFlow(flow: unknown): HostFlowState | null {
  if (typeof flow !== 'object' || flow === null) return null;
  const f = flow as { failures?: unknown; lastJoke?: unknown; linesSinceJoke?: unknown };
  if (typeof f.failures !== 'number' || !Number.isFinite(f.failures) || f.failures < 0) return null;
  if (
    typeof f.linesSinceJoke !== 'number' ||
    !Number.isFinite(f.linesSinceJoke) ||
    f.linesSinceJoke < 0
  ) {
    return null;
  }
  const lastJoke = typeof f.lastJoke === 'string' ? f.lastJoke : null;
  return { failures: f.failures, lastJoke, linesSinceJoke: f.linesSinceJoke };
}

/** True when a joke clause may be added to a host line. Anything unclear gives false. */
export function mayJoke(
  category: HostCategory,
  flow: HostFlowState,
  jokeId: string,
  lang: string,
): boolean {
  if (lang !== 'en') return false;
  if (typeof category !== 'string' || JOKE_FREE.has(category) || !JOKE_ALLOWED.has(category)) {
    return false;
  }
  const f = cleanFlow(flow);
  if (f === null || typeof jokeId !== 'string') return false;
  if (f.failures >= 2) return false;
  if (f.lastJoke !== null) {
    if (jokeId === f.lastJoke) return false;
    if (f.linesSinceJoke < JOKE_GAP_LINES) return false;
  }
  return true;
}

/** The plain part, then the joke clause. Never the joke alone. */
export function composeErrorLine(parts: ErrorParts, allowJoke: boolean): string {
  const rawPlain: unknown = (parts as { plain?: unknown } | null | undefined)?.plain;
  const plain = typeof rawPlain === 'string' ? rawPlain : '';
  if (allowJoke !== true || plain.trim() === '') return plain;
  const rawJoke: unknown = (parts as { joke?: unknown }).joke;
  const joke = typeof rawJoke === 'string' ? rawJoke.trim() : '';
  if (joke === '') return plain;
  return `${plain} ${joke}`;
}

/** Advances the per-flow joke and failure bookkeeping. Junk in gives a fresh state. */
export function nextFlowState(flow: HostFlowState, event: HostEvent): HostFlowState {
  const f = cleanFlow(flow) ?? INITIAL_HOST_FLOW;
  const kind: unknown = (event as { kind?: unknown } | null | undefined)?.kind;
  if (kind === 'failure') return { ...f, failures: Math.min(f.failures + 1, LINES_CAP) };
  if (kind === 'success' || kind === 'leave') return { ...f, failures: 0 };
  if (kind === 'line') {
    const jokeId: unknown = (event as { jokeId?: unknown }).jokeId;
    if (typeof jokeId === 'string' && jokeId !== '') {
      return { failures: f.failures, lastJoke: jokeId, linesSinceJoke: 0 };
    }
    return { ...f, linesSinceJoke: Math.min(f.linesSinceJoke + 1, LINES_CAP) };
  }
  return f;
}

const BANNED_CHARS = /[\u2014\u2013()[\]{}/=~*_#]|\p{Extended_Pictographic}/u;
const BANNED_WORDS = ['verified', 'correct', 'approved', 'checked', 'obviously', 'just', 'simply'];
const TECHNICAL = [
  'timed out',
  'server',
  'request',
  'network',
  'permission denied',
  'error',
  'validation',
];
const ACTION_WORDS = ['try', 'type', 'choose', 'pick', 'check', 'allow', 'press', 'wait'];

function hasWord(lower: string, word: string): boolean {
  return new RegExp(`(^|[^\\p{L}])${word.replace(/ /g, '\\s+')}($|[^\\p{L}])`, 'u').test(lower);
}

function maxSentenceWords(line: string): number {
  let max = 0;
  for (const sentence of line.split(/[.!?\u0964]+/u)) {
    const words = sentence.split(/\s+/u).filter((w) => w !== '').length;
    if (words > max) max = words;
  }
  return max;
}

/** Checks one line against Requirement 53.4, 53.7, 53.8 and 53.9. Words are checked in English. */
export function lintHostLine(line: string, lang: string, category?: HostCategory): HostLint {
  const problems: string[] = [];
  if (typeof line !== 'string') return { ok: false, problems: ['not text'] };
  if (BANNED_CHARS.test(line)) problems.push('banned character');
  if (maxSentenceWords(line) > MAX_SENTENCE_WORDS) problems.push('sentence too long');
  if (lang === 'en') {
    const lower = line.toLowerCase();
    for (const w of BANNED_WORDS) if (hasWord(lower, w)) problems.push(`banned word: ${w}`);
    const sorry = lower.match(/(^|[^\p{L}])sorry(?=$|[^\p{L}])/gu);
    if (sorry !== null && sorry.length > 1) problems.push('sorry more than once');
    for (const w of TECHNICAL) if (hasWord(lower, w)) problems.push(`technical word: ${w}`);
    if (category === 'error' && !ACTION_WORDS.some((w) => hasWord(lower, w))) {
      problems.push('no action word');
    }
  }
  return { ok: problems.length === 0, problems };
}
