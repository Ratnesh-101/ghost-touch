/**
 * Corner heartbeat (Requirement 34, task 59). Optional, OFF by default, phone-untested.
 *
 * Pure core (tech.md rule 1): no DOM, React, browser API, audio, speech or timer. It wraps the
 * output of the haptic engine for one step and, while the finger rests on the same vertex, adds
 * one `vibrate(pattern)` per period. `hapticEngine.ts` is not touched, so the corner pattern,
 * the quiet window and the 4.9 re-entry rule behave exactly as before.
 *
 * One `vibrate` call per beat, never one long repeating pattern: any later call silently ends
 * the rest of a long pattern, nothing cancels it when the finger leaves a vertex for empty
 * space, and a driver that cannot play arrays would turn it into one long solid buzz.
 *
 * All numbers are PROPOSED, pending owner approval and a phone test (tech.md). `quietMs` is a
 * copy of the tuned quiet window (as `proximity.ts` copies the line radius), not a new value.
 */

import type { Effect } from './hapticEngine';
import type { Target } from './hitTest';

export interface HeartbeatConfig {
  /** Beat pattern for one `navigator.vibrate` call: on, off, on, ... in ms. */
  pattern: number[];
  /** Start-to-start time between beats, ms. */
  periodMs: number;
  /** Copy of the engine's corner quiet window, ms. */
  quietMs: number;
}

/** Proposed: the tuned corner pattern reused, one beat every 900 ms. */
export const DEFAULT_HEARTBEAT: HeartbeatConfig = {
  pattern: [50, 90, 50],
  periodMs: 900,
  quietMs: 450,
};

export interface HeartbeatState {
  /** The vertex the heartbeat is resting on, or null. */
  vertexId: string | null;
  /** When the next beat is due. */
  nextBeatAt: number;
  /** When the last beat of this visit started. */
  lastBeatAt: number;
}

export type HeartbeatInput =
  | { kind: 'move'; t: number; target: Target; engineEffects: readonly Effect[] }
  | { kind: 'lift'; t: number; engineEffects: readonly Effect[] };

export function initialHeartbeatState(): HeartbeatState {
  return { vertexId: null, nextBeatAt: Infinity, lastBeatAt: -Infinity };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Sum of the pattern, or null when the config is not valid (Requirement 34.6). */
function beatLengthIfValid(cfg: unknown): number | null {
  if (typeof cfg !== 'object' || cfg === null) return null;
  const c = cfg as Partial<HeartbeatConfig>;
  const { pattern, periodMs, quietMs } = c;
  if (!Array.isArray(pattern) || pattern.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < pattern.length; i++) {
    const v: unknown = pattern[i];
    if (!isNum(v) || v <= 0) return null;
    sum += v;
  }
  if (!isNum(periodMs) || !isNum(quietMs) || quietMs < 0) return null;
  if (!Number.isFinite(sum) || periodMs < quietMs + sum) return null;
  return sum;
}

const hasVibrate = (effects: readonly Effect[]): boolean => effects.some((e) => e?.kind === 'vibrate');

/**
 * The complete effect list for one step: the engine's effects in order, plus at most one added
 * `vibrate` (a beat at the end, or `vibrate(0)` at the front when the finger leaves a beat).
 */
export function heartbeatStep(
  state: HeartbeatState,
  input: HeartbeatInput,
  cfg?: HeartbeatConfig | null,
): { state: HeartbeatState; effects: Effect[] } {
  const raw: unknown = input?.engineEffects;
  const engine: readonly Effect[] = Array.isArray(raw) ? (raw as Effect[]) : [];
  const passThrough = (s: HeartbeatState): { state: HeartbeatState; effects: Effect[] } => ({
    state: s,
    effects: [...engine],
  });

  // Rule 1: off, or an invalid configuration.
  const beatLength = beatLengthIfValid(cfg);
  if (beatLength === null || cfg == null) return passThrough(initialHeartbeatState());

  // Rule 2: a lift. The engine's own vibrate(0) stops everything.
  if (input.kind === 'lift') return passThrough(initialHeartbeatState());
  if (input.kind !== 'move') return passThrough(state);

  // Rule 3: no beat and no bookkeeping for a time that is not a number.
  const t = input.t;
  if (!isNum(t)) return passThrough(state);

  const prevId = typeof state?.vertexId === 'string' ? state.vertexId : null;
  const nextBeatAt = typeof state?.nextBeatAt === 'number' ? state.nextBeatAt : Infinity;
  const lastBeatAt = typeof state?.lastBeatAt === 'number' ? state.lastBeatAt : -Infinity;

  const target: unknown = input.target;
  const vertexId =
    typeof target === 'object' && target !== null &&
    (target as { kind?: unknown }).kind === 'vertex' &&
    typeof (target as { id?: unknown }).id === 'string'
      ? (target as { id: string }).id
      : null;

  if (vertexId !== null) {
    // Rules 4 and 5: an entry, or a re-entry the engine kept silent. Start the schedule here.
    if (hasVibrate(engine) || vertexId !== prevId) {
      return passThrough({ vertexId, nextBeatAt: t + cfg.periodMs, lastBeatAt: -Infinity });
    }
    // Rule 6: resting on the same vertex.
    if (t >= nextBeatAt) {
      const advanced = nextBeatAt + cfg.periodMs;
      return {
        state: {
          vertexId,
          nextBeatAt: advanced > t ? advanced : t + cfg.periodMs,
          lastBeatAt: t,
        },
        effects: [...engine, { kind: 'vibrate', pattern: [...cfg.pattern] }],
      };
    }
    return passThrough(state);
  }

  // Rule 7: any other target. Forget the vertex; stop a beat that may still be playing.
  const forgotten = initialHeartbeatState();
  if (prevId !== null && t < lastBeatAt + beatLength && !hasVibrate(engine)) {
    return { state: forgotten, effects: [{ kind: 'vibrate', pattern: 0 }, ...engine] };
  }
  return passThrough(forgotten);
}
