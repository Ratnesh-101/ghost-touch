/**
 * Pure state machine for "Guide my finger".
 *
 * Per architecture rules:
 * - step(state, input) -> { state, effects }
 * - pure logic: no DOM, React, or drivers imported
 * - hints spoken on direction change OR every hintEveryMs
 * - pulses throttled by pulseIntervalMs
 * - tick past timeoutMs => stopped
 * - arrive emitted exactly once
 * - cancel for each reason => toneOff + stopped
 * - lift => toneOff, phase stays guiding
 * - no effects after stopped / arrived
 */

import { type GuideConfig, DEFAULT_GUIDE } from './config';
import {
  type NormPoint,
  type ResolvedTarget,
  type HintKey,
  vectorTo,
  pulseIntervalMs,
  pitchFor,
  panFor,
  directionHint,
  hasArrived,
} from './geometry';

export interface GuideState {
  phase: 'idle' | 'guiding' | 'arrived' | 'stopped';
  target: ResolvedTarget | null;
  startedAt: number;
  lastHintAt: number;
  lastHint: HintKey | null;
  lastPulseAt: number;
}

export type GuideInput =
  | { type: 'start'; target: ResolvedTarget; now: number }
  | { type: 'move'; finger: NormPoint; now: number }
  | { type: 'lift'; now: number }
  | { type: 'cancel'; reason: 'voice' | 'back' | 'timeout' | 'user'; now: number }
  | { type: 'tick'; now: number };

export type GuideEffect =
  | { type: 'pulse'; ms: number }
  | { type: 'tone'; hz: number; pan: number }
  | { type: 'toneOff' }
  | { type: 'speak'; key: string /* i18n key */; hint?: HintKey; label?: string }
  | { type: 'arrive'; label: string }
  | { type: 'stopped'; reason: string };

export function initialGuideState(): GuideState {
  return {
    phase: 'idle',
    target: null,
    startedAt: 0,
    lastHintAt: 0,
    lastHint: null,
    lastPulseAt: 0,
  };
}

export function guideStep(
  s: GuideState,
  i: GuideInput,
  cfg: GuideConfig = DEFAULT_GUIDE
): { state: GuideState; effects: GuideEffect[] } {
  // 1. If already arrived or stopped, reject any further effects
  if (s.phase === 'arrived' || s.phase === 'stopped') {
    if (i.type === 'start') {
      const nextState: GuideState = {
        phase: 'guiding',
        target: i.target,
        startedAt: i.now,
        lastHintAt: 0,
        lastHint: null,
        lastPulseAt: 0,
      };
      return {
        state: nextState,
        effects: [
          { type: 'speak', key: 'guide.start', label: i.target.label },
        ],
      };
    }
    return { state: s, effects: [] };
  }

  // 2. Start input
  if (i.type === 'start') {
    const nextState: GuideState = {
      phase: 'guiding',
      target: i.target,
      startedAt: i.now,
      lastHintAt: 0,
      lastHint: null,
      lastPulseAt: 0,
    };
    return {
      state: nextState,
      effects: [
        { type: 'speak', key: 'guide.start', label: i.target.label },
      ],
    };
  }

  // If still idle or target is missing, ignore moves/ticks/lifts/cancels
  if (s.phase === 'idle' || !s.target) {
    return { state: s, effects: [] };
  }

  // At this point, s.phase is 'guiding' and s.target is guaranteed non-null.

  // 3. Cancel input
  if (i.type === 'cancel') {
    return {
      state: {
        ...s,
        phase: 'stopped',
      },
      effects: [
        { type: 'toneOff' },
        { type: 'speak', key: 'guide.stopped' },
        { type: 'stopped', reason: i.reason },
      ],
    };
  }

  // 4. Tick input
  if (i.type === 'tick') {
    const elapsed = i.now - s.startedAt;
    if (elapsed >= cfg.timeoutMs) {
      return {
        state: {
          ...s,
          phase: 'stopped',
        },
        effects: [
          { type: 'toneOff' },
          { type: 'speak', key: 'guide.stopped' },
          { type: 'stopped', reason: 'timeout' },
        ],
      };
    }
    return { state: s, effects: [] };
  }

  // 5. Lift input
  if (i.type === 'lift') {
    return {
      state: s, // phase stays 'guiding'
      effects: [{ type: 'toneOff' }],
    };
  }

  // 6. Move input
  if (i.type === 'move') {
    const { dx, dy, dist } = vectorTo(i.finger, s.target);

    // Check arrival
    if (hasArrived(dist, cfg)) {
      return {
        state: {
          ...s,
          phase: 'arrived',
        },
        effects: [
          { type: 'toneOff' },
          { type: 'arrive', label: s.target.label },
          { type: 'speak', key: 'guide.arrived', label: s.target.label },
        ],
      };
    }

    const effects: GuideEffect[] = [];

    // Continuous tone: pitch from dy, pan from dx
    const hz = pitchFor(dy, cfg);
    const pan = panFor(dx);
    effects.push({ type: 'tone', hz, pan });

    // Pulse: throttled by pulseIntervalMs
    const interval = pulseIntervalMs(dist, cfg);
    let nextLastPulseAt = s.lastPulseAt;
    if (s.lastPulseAt === 0 || i.now - s.lastPulseAt >= interval) {
      effects.push({ type: 'pulse', ms: 25 });
      nextLastPulseAt = i.now;
    }

    // Direction hint: spoken on direction change OR every hintEveryMs
    // Sector-boundary jitter is suppressed by hysteresis in directionHint
    const hint = directionHint(dx, dy, cfg.arriveRadius, s.lastHint ?? undefined);
    let nextLastHint = s.lastHint;
    let nextLastHintAt = s.lastHintAt;

    const directionChanged = hint !== s.lastHint;
    const timeForRepeat = s.lastHintAt === 0 || i.now - s.lastHintAt >= cfg.hintEveryMs;

    if (directionChanged || timeForRepeat) {
      effects.push({
        type: 'speak',
        key: `guide.hint.${hint}`,
        hint,
      });
      nextLastHint = hint;
      nextLastHintAt = i.now;
    }

    return {
      state: {
        ...s,
        lastPulseAt: nextLastPulseAt,
        lastHint: nextLastHint,
        lastHintAt: nextLastHintAt,
      },
      effects,
    };
  }

  return { state: s, effects: [] };
}
