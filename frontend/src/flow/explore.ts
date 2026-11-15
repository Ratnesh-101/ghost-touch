/**
 * Decision logic for the Explore screen:
 * - Centre reference tick & re-arm logic
 * - Axis crossings
 * - Two-finger swipe down gesture detector
 * - Per-move hit-test and engine step pipeline
 *
 * All functions here are pure and unit-tested without DOM or browser APIs.
 */

import { hitTest, type Radii, type Target } from '../core/hitTest';
import { toNorm, type ScreenPoint, type Viewport } from '../core/geometry';
import type { DiagramScene } from '../core/scene';
import { lineEnds, nearestElement, vertexExits, type Compass8, type NearestElement } from '../core/compass';
import {
  DEFAULT_PROXIMITY,
  initialProximityState,
  proximityStep,
  type ProximityConfig,
  type ProximityEffect,
  type ProximityState,
} from '../core/proximity';
import {
  getStoredDirectionsSetting,
  safeGet,
  safeRemove,
  safeSet,
  setStoredDirectionsSetting,
  STORAGE_KEY_DIRECTIONS,
} from '../drivers/storage';
import {
  step,
  initialState,
  DEFAULT_HAPTICS,
  type EngineState,
  type Effect,
  type HapticConfig,
} from '../core/hapticEngine';
import { pitchForY } from '../core/pitch';
import { t, tf } from '../i18n';

export const STORAGE_KEY_FINDING_SOUND = 'gt_finding_sound_enabled';

let inMemoryFindingSoundSetting: boolean | null = null;

export function getStoredFindingSoundSetting(): boolean {
  const stored = safeGet(STORAGE_KEY_FINDING_SOUND);
  if (stored !== null) {
    return stored === 'true';
  }
  return inMemoryFindingSoundSetting ?? true;
}

export function setStoredFindingSoundSetting(enabled: boolean): void {
  safeSet(STORAGE_KEY_FINDING_SOUND, enabled ? 'true' : 'false');
  inMemoryFindingSoundSetting = enabled;
}

export function _resetFindingSoundSettingForTesting(): void {
  inMemoryFindingSoundSetting = null;
  safeRemove(STORAGE_KEY_FINDING_SOUND);
}

export {
  step,
  initialState,
  DEFAULT_HAPTICS,
  pitchForY,
  getStoredDirectionsSetting,
  setStoredDirectionsSetting,
  STORAGE_KEY_DIRECTIONS,
  DEFAULT_PROXIMITY,
  initialProximityState,
  proximityStep,
};
export type {
  EngineState,
  Effect,
  HapticConfig,
  Compass8,
  ProximityConfig,
  ProximityEffect,
  ProximityState,
  NearestElement,
};

/**
 * Proposed centre tick pattern: 25 ms single pulse.
 * Proposed new pattern not yet formally added to tech.md (decision for the owner).
 */
export const CENTRE_TICK_MS = 25;
export const CENTRE_RADIUS_PX = 24;
export const CENTRE_REARM_RADIUS_PX = CENTRE_RADIUS_PX * 1.5; // 36 px

export const DEFAULT_RADII: Radii = {
  vertex: DEFAULT_HAPTICS.vertexRadius,
  line: DEFAULT_HAPTICS.lineRadius,
};

export interface CentreTickState {
  armed: boolean;
  firstHoldSpoken: boolean;
}

export function initialCentreTickState(): CentreTickState {
  return {
    armed: true,
    firstHoldSpoken: false,
  };
}

/**
 * Re-arms the centre tick for a new hold (pointerdown / lift) while preserving
 * firstHoldSpoken so the spoken "Centre." announcement happens only on the first hold.
 */
export function rearmCentreTick(state: CentreTickState): CentreTickState {
  return {
    ...state,
    armed: true,
  };
}

export interface CentreCheckResult {
  tick: boolean;
  speakCentre: boolean;
  nextState: CentreTickState;
}

/**
 * Checks whether the centre tick should fire and whether "Centre." should be spoken.
 *
 * Rules:
 * - Fires on hold start (pointerdown) if within CENTRE_RADIUS_PX of centre.
 * - Fires when moving into CENTRE_RADIUS_PX from outside.
 * - Re-arms ONLY after the cursor leaves the radius by more than 1.5 * CENTRE_RADIUS_PX (36 px).
 * - NEVER fires during the corner quiet window.
 * - On the first hold of the Explore visit: speaks "Centre." right after the tick.
 */
export function checkCentreTick(
  distFromCentre: number,
  state: CentreTickState,
  inQuietWindow: boolean = false,
  isNewHold: boolean = false,
): CentreCheckResult {
  if (distFromCentre > CENTRE_REARM_RADIUS_PX) {
    return {
      tick: false,
      speakCentre: false,
      nextState: { ...state, armed: true },
    };
  }

  if (distFromCentre <= CENTRE_RADIUS_PX) {
    if (state.armed && !inQuietWindow) {
      const speak = isNewHold && !state.firstHoldSpoken;
      return {
        tick: true,
        speakCentre: speak,
        nextState: {
          armed: false,
          firstHoldSpoken: state.firstHoldSpoken || speak,
        },
      };
    }
  }

  return {
    tick: false,
    speakCentre: false,
    nextState: state,
  };
}

const SENTENCE_END = /[.!?।॥]$/;

/**
 * Join announcements into one utterance: blank parts are dropped, order is kept, and parts are
 * separated by a full stop unless the previous part already ends a sentence.
 *
 * The speech driver cancels the running utterance on every `speak`, so announcements made
 * together must be spoken together or all but the last are lost (CORE-02, Requirement 17.2).
 */
export function joinAnnouncements(parts: readonly string[]): string {
  let out = '';
  for (const raw of parts) {
    const part = raw.trim();
    if (part === '') continue;
    out = out === '' ? part : `${out}${SENTENCE_END.test(out) ? ' ' : '. '}${part}`;
  }
  return out;
}

/**
 * Fold the axis crossings of one pointer move and the engine's own `speak` effects into a
 * single `speak` effect: axis crossings first, then the vertex or bar. Other effects are kept
 * in order. When there is nothing to say the effects are returned unchanged.
 */
/** The words of a speech effect: literal text, or the keyed sentence in the active language. */
export function speechText(effect: Effect): string | null {
  if (effect.kind === 'speak') return effect.text;
  if (effect.kind === 'speakKey') return tf(effect.textKey, effect.params);
  return null;
}

export function mergeAnnouncements(
  axisCrossings: readonly string[],
  effects: Effect[],
  afterAnnouncements: readonly string[] = [],
): Effect[] {
  // Keyed speech (an unlabelled corner) counts as speech too, so it is joined with the axis
  // crossings instead of being spoken separately and cutting them off.
  const engineSpeech = effects.flatMap((e) => {
    const words = speechText(e);
    return words === null ? [] : [words];
  });
  const text = joinAnnouncements([...axisCrossings, ...engineSpeech, ...afterAnnouncements]);
  if (text === '') return effects;

  const merged: Effect[] = [];
  let placed = false;
  for (const effect of effects) {
    if (effect.kind !== 'speak' && effect.kind !== 'speakKey') {
      merged.push(effect);
    } else if (!placed) {
      merged.push({ kind: 'speak', text });
      placed = true;
    }
  }
  if (!placed) merged.push({ kind: 'speak', text });
  return merged;
}

export const DEFAULT_AXIS_HYSTERESIS_NORM = 0.015;

export interface AxisTrackerState {
  lastXSide: 'left' | 'right' | null;
  lastYSide: 'above' | 'below' | null;
}

export function initialAxisState(): AxisTrackerState {
  return {
    lastXSide: null,
    lastYSide: null,
  };
}

/**
 * Seeds axis tracker state on pointerdown without triggering speech.
 */
export function seedAxisState(
  normPos: { x: number; y: number },
  axes: { x_axis_y?: number | null; y_axis_x?: number | null } | undefined | null,
  hysteresis: number = DEFAULT_AXIS_HYSTERESIS_NORM,
): AxisTrackerState {
  let lastXSide: 'left' | 'right' | null = null;
  let lastYSide: 'above' | 'below' | null = null;

  if (axes?.y_axis_x != null) {
    if (normPos.x < axes.y_axis_x - hysteresis) {
      lastXSide = 'left';
    } else if (normPos.x > axes.y_axis_x + hysteresis) {
      lastXSide = 'right';
    }
  }

  if (axes?.x_axis_y != null) {
    if (normPos.y < axes.x_axis_y - hysteresis) {
      lastYSide = 'above';
    } else if (normPos.y > axes.x_axis_y + hysteresis) {
      lastYSide = 'below';
    }
  }

  return { lastXSide, lastYSide };
}

export interface AxisCrossingResult {
  spoken: string[];
  nextState: AxisTrackerState;
}

/**
 * Tracks crossing of coordinate axes (x_axis_y, y_axis_x from scene.axes)
 * and speaks "x-axis" or "y-axis" once per crossing in each direction.
 * Uses a small dead band (hysteresis) to prevent jitter from repeating speech.
 */
export function checkAxisCrossing(
  normPos: { x: number; y: number },
  axes: { x_axis_y?: number | null; y_axis_x?: number | null } | undefined | null,
  state: AxisTrackerState,
  hysteresis: number = DEFAULT_AXIS_HYSTERESIS_NORM,
): AxisCrossingResult {
  const spoken: string[] = [];
  let nextXSide = state.lastXSide;
  let nextYSide = state.lastYSide;

  if (axes?.y_axis_x != null) {
    const ax = axes.y_axis_x;
    if (normPos.x < ax - hysteresis) {
      if (state.lastXSide === 'right') {
        spoken.push(t('explore.yAxis'));
      }
      nextXSide = 'left';
    } else if (normPos.x > ax + hysteresis) {
      if (state.lastXSide === 'left') {
        spoken.push(t('explore.yAxis'));
      }
      nextXSide = 'right';
    }
  }

  if (axes?.x_axis_y != null) {
    const ay = axes.x_axis_y;
    if (normPos.y < ay - hysteresis) {
      if (state.lastYSide === 'below') {
        spoken.push(t('explore.xAxis'));
      }
      nextYSide = 'above';
    } else if (normPos.y > ay + hysteresis) {
      if (state.lastYSide === 'above') {
        spoken.push(t('explore.xAxis'));
      }
      nextYSide = 'below';
    }
  }

  return {
    spoken,
    nextState: {
      lastXSide: nextXSide,
      lastYSide: nextYSide,
    },
  };
}

export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

export interface PointerHistory {
  start: PointerSample;
  current: PointerSample;
}

/**
 * Two-finger swipe down gesture detector (TalkBack off shortcut):
 * Fires when two active pointers both move down at least minDistance (80 px)
 * within maxDuration (600 ms), with horizontal drift < maxDriftRatio * vertical distance.
 */
export function checkTwoFingerSwipeDown(
  p1: PointerHistory,
  p2: PointerHistory,
  minDistancePx: number = 80,
  maxDurationMs: number = 600,
  maxDriftRatio: number = 0.5,
): boolean {
  const dy1 = p1.current.y - p1.start.y;
  const dx1 = Math.abs(p1.current.x - p1.start.x);
  const dt1 = p1.current.t - p1.start.t;

  const dy2 = p2.current.y - p2.start.y;
  const dx2 = Math.abs(p2.current.x - p2.start.x);
  const dt2 = p2.current.t - p2.start.t;

  if (dy1 < minDistancePx || dy2 < minDistancePx) return false;
  if (dt1 > maxDurationMs || dt2 > maxDurationMs) return false;
  if (dx1 > dy1 * maxDriftRatio || dx2 > dy2 * maxDriftRatio) return false;

  return true;
}

export const TWO_FINGER_LONG_PRESS_MS = 600;
export const TWO_FINGER_MAX_MOVE_PX = 20;

/**
 * Two-finger long-press gesture detector (starts Ask flow):
 * Fires if both pointers have been held for at least minDurationMs (600 ms)
 * without either pointer moving more than maxMovePx (20 px) from its initial touch point.
 */
export function checkTwoFingerLongPress(
  p1: PointerHistory,
  p2: PointerHistory,
  now: number,
  minDurationMs: number = TWO_FINGER_LONG_PRESS_MS,
  maxMovePx: number = TWO_FINGER_MAX_MOVE_PX,
): boolean {
  const d1 = Math.hypot(p1.current.x - p1.start.x, p1.current.y - p1.start.y);
  const d2 = Math.hypot(p2.current.x - p2.start.x, p2.current.y - p2.start.y);

  if (d1 > maxMovePx || d2 > maxMovePx) return false;

  const dt1 = now - p1.start.t;
  const dt2 = now - p2.start.t;

  return dt1 >= minDurationMs && dt2 >= minDurationMs;
}

export interface MovePipelineResult {
  target: Target;
  yNorm: number;
  effects: Effect[];
  nextEngineState: EngineState;
  centreCheck: CentreCheckResult;
  axisCrossings: string[];
  nextAxisState: AxisTrackerState;
  nearest: NearestElement | null;
  proximityState: ProximityState;
  proximityEffects: ProximityEffect[];
}

/**
 * Per-move hit-test, engine step and auxiliary tracker pipeline.
 */
export function processPointerMove(
  scene: DiagramScene,
  finger: ScreenPoint,
  view: Viewport,
  t: number,
  engineState: EngineState,
  centreTickState: CentreTickState,
  axisState: AxisTrackerState,
  radii: Radii = DEFAULT_RADII,
  cfg: HapticConfig = DEFAULT_HAPTICS,
  proximityState: ProximityState = initialProximityState(),
  proximityCfg: ProximityConfig = DEFAULT_PROXIMITY,
): MovePipelineResult {
  const target = hitTest(scene, finger, view, radii);
  const norm = toNorm(finger, view);

  const { state: nextEngineState, effects } = step(
    engineState,
    { kind: 'move', t, target, yNorm: norm.y },
    cfg,
  );

  const cx = view.canvasWidth / 2;
  const cy = view.canvasHeight / 2;
  const distFromCentre = Math.hypot(finger.x - cx, finger.y - cy);
  const inQuietWindow = t < nextEngineState.quietUntil;

  const centreCheck = checkCentreTick(distFromCentre, centreTickState, inQuietWindow, false);
  const { spoken: axisCrossings, nextState: nextAxisState } = checkAxisCrossing(
    norm,
    scene.axes,
    axisState,
  );

  const onLine = target.kind === 'line';
  const nearest = nearestElement(scene, finger, view, proximityCfg.radiusPx);
  const distPx =
    target.kind === 'vertex' || target.kind === 'bar' || nearest === null
      ? null
      : nearest.distPx;
  const dxPx = nearest ? nearest.dxPx : 0;

  const { state: nextProximityState, effects: proximityEffects } = proximityStep(
    proximityState,
    {
      kind: 'move',
      t,
      distPx,
      dxPx,
      onLine,
      inQuietWindow,
    },
    proximityCfg,
  );

  return {
    target,
    yNorm: norm.y,
    effects,
    nextEngineState,
    centreCheck,
    axisCrossings,
    nextAxisState,
    nearest,
    proximityState: nextProximityState,
    proximityEffects,
  };
}

/**
 * Hold keep-alive interval: 60 ms.
 * Ensures stationary fingers resting on lines continue receiving haptic feedback.
 */
export const KEEP_ALIVE_INTERVAL_MS = 60;

/**
 * Determines whether a keep-alive move event should be dispatched.
 * Returns true when at least intervalMs has elapsed since the last handled move (or down/keep-alive).
 */
export function shouldKeepAlive(
  lastMoveAt: number,
  now: number,
  intervalMs: number = KEEP_ALIVE_INTERVAL_MS,
): boolean {
  if (intervalMs <= 0) return true;
  return now - lastMoveAt >= intervalMs;
}

export interface HoldKeepAliveOptions {
  intervalMs?: number;
  shouldRun?: () => boolean;
  onTick: (coords: ScreenPoint, now: number) => void;
}

export interface HoldKeepAliveTimer {
  start(coords: ScreenPoint, now?: number): void;
  update(coords: ScreenPoint, now?: number): void;
  stop(): void;
  isActive(): boolean;
}

/**
 * Creates a hold keep-alive timer that ticks at intervalMs (default 60 ms).
 * Calls onTick with the last known coordinates when no move has occurred within intervalMs.
 */
export function createHoldKeepAliveTimer(
  options: HoldKeepAliveOptions,
): HoldKeepAliveTimer {
  const intervalMs = options.intervalMs ?? KEEP_ALIVE_INTERVAL_MS;
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastMoveAt = 0;
  let lastCoords: ScreenPoint | null = null;

  const stop = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    lastCoords = null;
  };

  const start = (coords: ScreenPoint, now: number = performance.now()): void => {
    stop();
    lastCoords = coords;
    lastMoveAt = now;
    timer = setInterval(() => {
      if (options.shouldRun && !options.shouldRun()) {
        stop();
        return;
      }
      if (!lastCoords) return;
      const currentNow = performance.now();
      if (shouldKeepAlive(lastMoveAt, currentNow, intervalMs)) {
        lastMoveAt = currentNow;
        options.onTick(lastCoords, currentNow);
      }
    }, intervalMs);
  };

  const update = (coords: ScreenPoint, now: number = performance.now()): void => {
    lastCoords = coords;
    lastMoveAt = now;
  };

  return {
    start,
    update,
    stop,
    isActive: () => timer !== null,
  };
}

export const VERTEX_VISIT_WINDOW_MS = 10000;
export const LINE_DWELL_MS = 800;

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Pure corner compass helper:
 * - Text after the label: one short clause per exit, e.g. "Down-right to B."
 * - Skips the segment the finger arrived on.
 * - If more than 4 exits: says "{n} edges" only.
 * - If visitedRecently is true: returns ''.
 * - Words through i18n keys in en, hi, and gu.
 * - Compass text never longer than 12 words.
 */
export function cornerCompass(
  scene: DiagramScene,
  vertexId: string,
  arrivedLineId: string | null = null,
  visitedRecently: boolean = false,
): string {
  if (visitedRecently) return '';

  const allExits = vertexExits(scene, vertexId);
  if (allExits.length === 0) return '';

  const exits = arrivedLineId
    ? allExits.filter((e) => e.segmentId !== arrivedLineId)
    : allExits;

  if (allExits.length > 4 || exits.length > 4) {
    const count = allExits.length > 4 ? allExits.length : exits.length;
    return `${tf('compass.edges', { n: String(count) })}.`;
  }

  if (exits.length === 0) return '';

  const clauses = exits.map((exit) => {
    const target = exit.toLabel || exit.toId;
    const dirWord = t(`compass.dir.${exit.dir}`);
    const clause = tf('compass.toTarget', { dir: dirWord, target });
    return `${capitalize(clause)}.`;
  });

  const text = clauses.join(' ');
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length > 12) {
    return `${tf('compass.edges', { n: String(allExits.length) })}.`;
  }
  return text;
}

/**
 * Pure line name helper:
 * - Segment: e.g. "Side AB. Up-left to A, down-right to B."
 * - Axes: "x-axis, left to right" or "y-axis, top to bottom".
 * - Polylines and bar edges: their label only.
 * - All words through i18n keys in en, hi, gu.
 */
export function lineName(scene: DiagramScene, lineId: string): string {
  if (lineId === 'x-axis') {
    return t('compass.xAxis');
  }
  if (lineId === 'y-axis') {
    return t('compass.yAxis');
  }

  // Check polylines: label only
  const poly = scene.polylines?.find((p) => p.id === lineId);
  if (poly) {
    return poly.label?.trim() || poly.id;
  }

  // Check bar edges: label only
  const bar = scene.bars?.find((b) => b.id === lineId);
  if (bar) {
    return bar.label?.trim() || bar.id;
  }

  // Check segments
  const seg = scene.segments?.find((s) => s.id === lineId);
  if (seg) {
    const sideName = seg.label?.trim() || seg.id;
    const sidePart = tf('compass.side', { name: sideName });
    const ends = lineEnds(scene, lineId);
    if (!ends) {
      return `${sidePart}.`;
    }
    const pointA = scene.points?.find((p) => p.id === ends.aId);
    const pointB = scene.points?.find((p) => p.id === ends.bId);
    const labelA = pointA?.label?.trim() || ends.aId;
    const labelB = pointB?.label?.trim() || ends.bId;
    const dirA = t(`compass.dir.${ends.dirToA}`);
    const dirB = t(`compass.dir.${ends.dirToB}`);
    const clauseA = capitalize(tf('compass.toTarget', { dir: dirA, target: labelA }));
    const clauseB = tf('compass.toTarget', { dir: dirB, target: labelB });
    const endsPart = tf('compass.lineEnds', { clauseA, clauseB });
    return `${sidePart}. ${endsPart}.`;
  }

  return '';
}


