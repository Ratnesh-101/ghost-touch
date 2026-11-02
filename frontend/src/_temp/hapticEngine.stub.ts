// TEMP-STUB: replaced by core/hapticEngine.ts (Task 4, Kiro). Do not extend.

import type { Target } from '../core/hitTest';
import {
  type Effect,
  type HapticConfig,
  DEFAULT_HAPTICS,
} from './hapticTypes.stub';
import { pitchForY, pitchForValue } from './pitch.stub';

export type { Effect, HapticConfig };
export { DEFAULT_HAPTICS };

export type Input =
  | { kind: 'move'; t: number; target: Target; yNorm: number }
  | { kind: 'lift'; t: number };

export interface EngineState {
  lastVertexId: string | null;
  lastBarId: string | null;
  onLine: boolean;
  lastBuzz: number;
  quietUntil: number;
}

export function initialState(): EngineState {
  return {
    lastVertexId: null,
    lastBarId: null,
    onLine: false,
    lastBuzz: -Infinity,
    quietUntil: -Infinity,
  };
}

/**
 * Step function implementing engine rules 1 to 6 from design.md.
 */
export function step(
  state: EngineState,
  input: Input,
  cfg: HapticConfig = DEFAULT_HAPTICS,
): { state: EngineState; effects: Effect[] } {
  if (input.kind === 'lift') {
    const effects: Effect[] = [
      { kind: 'vibrate', pattern: 0 },
      { kind: 'tone', hz: null },
    ];
    return { state: initialState(), effects };
  }

  const { t, target, yNorm } = input;
  const effects: Effect[] = [];
  const next: EngineState = { ...state };

  if (target.kind === 'vertex') {
    next.onLine = false;
    next.lastBarId = null;
    if (state.lastVertexId !== target.id) {
      next.lastVertexId = target.id;
      next.quietUntil = t + cfg.quietMs;
      effects.push({ kind: 'vibrate', pattern: cfg.cornerPattern });
      if (target.label !== undefined && target.label.trim() !== '') {
        effects.push({ kind: 'speak', text: target.label });
      }
      effects.push({ kind: 'tone', hz: null });
    }
    return { state: next, effects };
  }

  // Not on vertex
  next.lastVertexId = null;

  if (target.kind === 'line') {
    next.lastBarId = null;
    if (t >= state.quietUntil && t - state.lastBuzz > cfg.retriggerMs) {
      effects.push({ kind: 'vibrate', pattern: cfg.lineMs });
      next.lastBuzz = t;
    }
    next.onLine = true;
    if (target.elementKind === 'polyline') {
      effects.push({ kind: 'tone', hz: pitchForY(yNorm) });
    } else {
      effects.push({ kind: 'tone', hz: null });
    }
    return { state: next, effects };
  }

  if (target.kind === 'bar') {
    if (state.onLine) {
      if (t >= state.quietUntil) {
        effects.push({ kind: 'vibrate', pattern: 0 });
      }
      next.onLine = false;
    }
    if (state.lastBarId !== target.id) {
      next.lastBarId = target.id;
      effects.push({ kind: 'speak', text: `${target.label}, ${target.value}` });
    }
    effects.push({ kind: 'tone', hz: pitchForValue(target.value, 100) });
    return { state: next, effects };
  }

  // target.kind === 'none'
  if (state.onLine) {
    if (t >= state.quietUntil) {
      effects.push({ kind: 'vibrate', pattern: 0 });
    }
    effects.push({ kind: 'tone', hz: null });
    next.onLine = false;
  } else if (state.lastBarId !== null) {
    effects.push({ kind: 'tone', hz: null });
  }
  next.lastBarId = null;
  return { state: next, effects };
}
