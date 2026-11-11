/**
 * Pure haptic engine - a state machine that turns finger movement over a
 * DiagramScene into plain-data effects.
 *
 * Per architecture rule 2 (tech.md): step(state, input) -> { state, effects }.
 * Effects are plain data; drivers execute them. This makes every haptic rule
 * property-testable.
 *
 * Per architecture rule 1: this module is pure (no DOM, React, or browser
 * API access).
 */

import type { Target } from './hitTest';
import { pitchForY, pitchForValue } from './pitch';

/** A value for speech: at most 2 decimals, no trailing zeros (CORE-A4). Non-finite is left as is. */
function spokenNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  return String(Number(value.toFixed(2)));
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Keys of the sentences the engine asks the shell to speak (the shell owns the words). */
export type SpeechKey = 'vertex.unlabelled';

/** Plain-data effect emitted by the engine. Drivers execute these. */
export type Effect =
  | { kind: 'vibrate'; pattern: number | number[] }
  | { kind: 'speak'; text: string }
  // Speech the engine cannot word itself because it has no language: the shell looks up
  // `textKey` in the active language and fills in `params` (NEEDS-KIRO-02).
  | { kind: 'speakKey'; textKey: SpeechKey; params: { id: string } }
  | { kind: 'tone'; hz: number | null };

/** Tuned configuration. Defaults come from the tech.md haptic vocabulary. */
export interface HapticConfig {
  lineMs: number;
  retriggerMs: number;
  cornerPattern: number[];
  quietMs: number;
  vertexRadius: number;
  lineRadius: number;
}

/** Input to the engine: a pointer move or a lift. */
export type Input =
  | { kind: 'move'; t: number; target: Target; yNorm: number }
  | { kind: 'lift'; t: number };

/** Mutable engine state carried between steps. */
export interface EngineState {
  lastVertexId: string | null;
  lastBarId: string | null;
  onLine: boolean;
  lastBuzz: number;
  quietUntil: number;
}

// ---------------------------------------------------------------------------
// Tuned defaults (from tech.md haptic vocabulary table)
// ---------------------------------------------------------------------------

/**
 * Default haptic configuration from tech.md:
 *   lineMs 80, retriggerMs 70, cornerPattern [50,90,50],
 *   quietMs 450, vertexRadius 22, lineRadius 14.
 */
export const DEFAULT_HAPTICS: HapticConfig = {
  lineMs: 80,
  retriggerMs: 70,
  cornerPattern: [50, 90, 50],
  quietMs: 450,
  vertexRadius: 22,
  lineRadius: 14,
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Create a fresh engine state with no prior target. */
export function initialState(): EngineState {
  return {
    lastVertexId: null,
    lastBarId: null,
    onLine: false,
    lastBuzz: -Infinity,
    quietUntil: -Infinity,
  };
}

// ---------------------------------------------------------------------------
// Engine rules (mirrors the tuned prototype, design.md)
// ---------------------------------------------------------------------------

/**
 * Step the haptic engine forward by one input.
 *
 * Rules (design.md):
 * 1. Enter a new vertex -> vibrate(cornerPattern), speak(label) or, with no label,
 *    speakKey('vertex.unlabelled', { id }), tone(null); set quietUntil = t + quietMs.
 * 2. Same vertex as last step -> no effects.
 * 3. On a line, t >= quietUntil and t - lastBuzz > retriggerMs -> vibrate(lineMs).
 * 4. On a curve (polyline line) -> also tone(pitchForY(yNorm)).
 * 5. Leave all lines -> vibrate(0) only if t >= quietUntil; tone(null).
 * 6. Lift -> vibrate(0), tone(null); reset state.
 */
export function step(
  state: EngineState,
  input: Input,
  cfg: HapticConfig = DEFAULT_HAPTICS,
): { state: EngineState; effects: Effect[] } {
  // Rule 6: Lift silences everything and resets state.
  if (input.kind === 'lift') {
    return {
      state: initialState(),
      effects: [
        { kind: 'vibrate', pattern: 0 },
        { kind: 'tone', hz: null },
      ],
    };
  }

  const { t, target, yNorm } = input;
  const effects: Effect[] = [];
  const next: EngineState = { ...state };

  // Rule 1 and 2: Vertex entry.
  if (target.kind === 'vertex') {
    next.onLine = false;
    next.lastBarId = null;
    if (state.lastVertexId !== target.id) {
      // Rule 1: New vertex -> corner pulse, speak the label (or, for an unlabelled corner,
      // the 'vertex.unlabelled' sentence in the active language), stop tone.
      next.lastVertexId = target.id;
      next.quietUntil = t + cfg.quietMs;
      effects.push({ kind: 'vibrate', pattern: cfg.cornerPattern });
      if (target.label !== undefined && target.label.trim() !== '') {
        effects.push({ kind: 'speak', text: target.label });
      } else {
        effects.push({ kind: 'speakKey', textKey: 'vertex.unlabelled', params: { id: target.id } });
      }
      effects.push({ kind: 'tone', hz: null });
    }
    // Rule 2: Same vertex -> no effects (effects stays empty).
    return { state: next, effects };
  }

  // Not on a vertex: clear vertex memory.
  next.lastVertexId = null;

  // Rule 3 and 4: Line hit.
  if (target.kind === 'line') {
    next.lastBarId = null;
    // Rule 3: Buzz at retrigger rate, but only outside the quiet window.
    if (t >= state.quietUntil && t - state.lastBuzz > cfg.retriggerMs) {
      effects.push({ kind: 'vibrate', pattern: cfg.lineMs });
      next.lastBuzz = t;
    }
    next.onLine = true;
    // Rule 4: On a curve (polyline), emit a theremin tone.
    if (target.elementKind === 'polyline') {
      effects.push({ kind: 'tone', hz: pitchForY(yNorm) });
    } else {
      effects.push({ kind: 'tone', hz: null });
    }
    return { state: next, effects };
  }

  // Bar hit: speak label and value once, emit tone by value.
  if (target.kind === 'bar') {
    // Leaving a line: stop the line buzz (if outside quiet window).
    if (state.onLine) {
      if (t >= state.quietUntil) {
        effects.push({ kind: 'vibrate', pattern: 0 });
      }
      next.onLine = false;
    }
    // Speak bar label and value once per new bar.
    if (state.lastBarId !== target.id) {
      next.lastBarId = target.id;
      effects.push({ kind: 'speak', text: target.label + ', ' + spokenNumber(target.value) });
    }
    // Emit a tone based on the bar value relative to the scene max.
    effects.push({ kind: 'tone', hz: pitchForValue(target.value, target.maxValue) });
    return { state: next, effects };
  }

  // Rule 5: target.kind === 'none' - leaving all lines and bars.
  if (state.onLine) {
    if (t >= state.quietUntil) {
      effects.push({ kind: 'vibrate', pattern: 0 });
    }
    effects.push({ kind: 'tone', hz: null });
    next.onLine = false;
  } else if (state.lastBarId !== null) {
    // Leaving a bar into empty space: stop the tone.
    effects.push({ kind: 'tone', hz: null });
  }
  next.lastBarId = null;
  return { state: next, effects };
}
