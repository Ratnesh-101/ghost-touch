/**
 * Pure state machine for the near-line click cue (Requirement 27, task 51).
 *
 * "Find the line again": off every element but within `radiusPx` of one, the finger hears a soft
 * click that comes faster, higher and louder as it nears the line, panned toward the line. On a
 * line inside the corner quiet window the click is at its closest setting, so a turn is
 * confirmed while the line buzz is suppressed. Audio only: this module can only emit `click`.
 *
 * Same shape as `guide/machine.ts` (state + input -> state + plain-data effects) with its own
 * constants, as in `guide/config.ts`. Pure: no DOM, React, drivers, speech, and no imports.
 *
 * EVERY NUMBER BELOW IS PROPOSED, PENDING OWNER APPROVAL, AND NOT PHONE-TESTED (tech.md has a
 * separate "proposed" row). `lineRadiusPx` copies the tuned line radius (14); it does not change it.
 */

export interface ProximityConfig {
  /** Near-line radius in CSS px: no click beyond this distance. */
  radiusPx: number;
  /** Line radius in CSS px (copy of the tuned value): at or inside it the cue is at its closest. */
  lineRadiusPx: number;
  /** Click interval (ms) at `radiusPx`. */
  farMs: number;
  /** Click interval (ms) at or inside `lineRadiusPx`; also the floor for any gap between clicks. */
  nearMs: number;
  /** Click pitch (Hz) at `radiusPx`. */
  loHz: number;
  /** Click pitch (Hz) at or inside `lineRadiusPx`. */
  hiHz: number;
}

/** Proposed values (Requirement 27.9). */
export const DEFAULT_PROXIMITY: ProximityConfig = {
  radiusPx: 48,
  lineRadiusPx: 14,
  farMs: 400,
  nearMs: 90,
  loHz: 500,
  hiHz: 1200,
};

/** Click loudness at `radiusPx` (proposed). */
export const PROXIMITY_GAIN_FAR = 0.3;
/** Click loudness at or inside `lineRadiusPx` (proposed). */
export const PROXIMITY_GAIN_NEAR = 0.6;

export type ProximityInput =
  | {
      kind: 'move';
      t: number;
      /** Distance in CSS px to the nearest element, or null when there is nothing to find. */
      distPx: number | null;
      /** Horizontal offset in CSS px from the finger to that element (negative: to the left). */
      dxPx: number;
      /** The finger is on a line (the engine's line target). */
      onLine: boolean;
      /** The corner quiet window of Requirement 4.5 is running. */
      inQuietWindow: boolean;
    }
  | { kind: 'lift'; t: number };

/** The only effect this machine can emit. There is deliberately no vibrate effect (27.7). */
export type ProximityEffect = { kind: 'click'; hz: number; pan: number; gain: number };

export interface ProximityState {
  /** Time of the last emitted click; -Infinity before the first. Survives a lift (27.6). */
  lastClickAt: number;
}

export function initialProximityState(): ProximityState {
  return { lastClickAt: -Infinity };
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/**
 * Linear blend that is exact at both ends, never leaves [min(a, b), max(a, b)], and is monotone
 * in `f` to the last bit (Requirement 27.1, task 88): `a + (b - a) * f` has only monotone rounded
 * steps, unlike `a*(1-f) + b*f`, whose two terms move in opposite directions.
 */
function blend(a: number, b: number, f: number): number {
  if (f >= 1) return b;
  return clamp(a + (b - a) * f, Math.min(a, b), Math.max(a, b));
}

/** 0 at `radiusPx` (or beyond, or not a number), 1 at or inside `lineRadiusPx`. */
export function closeness(distPx: number, cfg: ProximityConfig = DEFAULT_PROXIMITY): number {
  if (!isFiniteNumber(distPx)) return 0;
  const span = cfg.radiusPx - cfg.lineRadiusPx;
  if (!(span > 0)) return distPx <= cfg.lineRadiusPx ? 1 : 0;
  return 1 - clamp((distPx - cfg.lineRadiusPx) / span, 0, 1);
}

/** Interval between clicks: `farMs` at f = 0, `nearMs` at f = 1. */
export function clickIntervalMs(distPx: number, cfg: ProximityConfig = DEFAULT_PROXIMITY): number {
  return blend(cfg.farMs, cfg.nearMs, closeness(distPx, cfg));
}

/** Click pitch: `loHz` at f = 0, `hiHz` at f = 1. */
export function clickHz(distPx: number, cfg: ProximityConfig = DEFAULT_PROXIMITY): number {
  return blend(cfg.loHz, cfg.hiHz, closeness(distPx, cfg));
}

/** Click loudness: `PROXIMITY_GAIN_FAR` at f = 0, `PROXIMITY_GAIN_NEAR` at f = 1. */
export function clickGain(distPx: number, cfg: ProximityConfig = DEFAULT_PROXIMITY): number {
  return blend(PROXIMITY_GAIN_FAR, PROXIMITY_GAIN_NEAR, closeness(distPx, cfg));
}

/** Pan in [-1, 1] with the sign of `dxPx`; 0 for zero or a non-finite offset. */
export function clickPan(dxPx: number, cfg: ProximityConfig = DEFAULT_PROXIMITY): number {
  if (!isFiniteNumber(dxPx) || dxPx === 0) return 0;
  const size = cfg.radiusPx > 0 ? Math.min(1, Math.abs(dxPx) / cfg.radiusPx) : 1;
  return dxPx < 0 ? -size : size;
}

/**
 * Step the cue forward by one input. Rules (design.md, "Find the line again"):
 * 1. Lift, an unknown input, or a non-finite `t`: nothing, same state object.
 * 2. On a line outside the quiet window: nothing (the line buzz is the cue).
 * 3. On a line inside the quiet window: distance counts as 0 (closest setting).
 * 4. Off the line: needs a finite `distPx` in [0, radiusPx]; otherwise nothing.
 * 5. `dxPx` must be finite whenever a cue is due.
 * 6. A click is due when `t - lastClickAt >= clickIntervalMs(d)`; every interval is at least
 *    `nearMs`, so no two clicks are closer than that, whatever the timestamps.
 */
export function proximityStep(
  state: ProximityState,
  input: ProximityInput,
  cfg: ProximityConfig = DEFAULT_PROXIMITY,
): { state: ProximityState; effects: ProximityEffect[] } {
  const none = { state, effects: [] as ProximityEffect[] };
  if (input === null || typeof input !== 'object' || input.kind !== 'move') return none;
  if (!isFiniteNumber(input.t) || !isFiniteNumber(input.dxPx)) return none;

  let d: number;
  if (input.onLine === true) {
    if (input.inQuietWindow !== true) return none;
    d = 0;
  } else {
    const dist = input.distPx;
    if (!isFiniteNumber(dist) || dist < 0 || dist > cfg.radiusPx) return none;
    d = dist;
  }

  // Written so that a NaN on either side gives "not due".
  if (!(input.t - state.lastClickAt >= clickIntervalMs(d, cfg))) return none;

  return {
    state: { lastClickAt: input.t },
    effects: [{ kind: 'click', hz: clickHz(d, cfg), pan: clickPan(input.dxPx, cfg), gain: clickGain(d, cfg) }],
  };
}
