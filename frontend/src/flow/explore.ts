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
import { followTarget, STICKY_HOLD_MS, STICKY_RADIUS_PX } from '../core/sticky';
import { toNorm, type ScreenPoint, type Viewport } from '../core/geometry';
import type { DiagramScene } from '../core/scene';
import { curveYAtX } from '../core/curve';
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
  DEFAULT_HEARTBEAT,
  heartbeatStep,
  initialHeartbeatState,
  type HeartbeatConfig,
  type HeartbeatState,
} from '../core/heartbeat';
import {
  _resetCornerHeartbeatSettingForTesting,
  _resetDirectionsSettingForTesting,
  _resetFindingSoundSettingForTesting,
  _resetStickyLineSettingForTesting,
  getStoredCornerHeartbeatSetting,
  getStoredDirectionsSetting,
  getStoredFindingSoundSetting,
  getStoredStickyLineSetting,
  notifySettingsChanged,
  safeGet,
  safeRemove,
  safeSet,
  setStoredCornerHeartbeatSetting,
  setStoredDirectionsSetting,
  setStoredFindingSoundSetting,
  setStoredStickyLineSetting,
  STORAGE_KEY_CORNER_HEARTBEAT,
  STORAGE_KEY_DIRECTIONS,
  STORAGE_KEY_FINDING_SOUND,
  STORAGE_KEY_STICKY_LINE,
  subscribeSettings,
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

export const STORAGE_KEY_GRAPH_SCAN = 'gt_graph_scan_enabled';

let inMemoryGraphScanSetting: boolean | null = null;

export function getStoredGraphScanSetting(): boolean {
  const stored = safeGet(STORAGE_KEY_GRAPH_SCAN);
  if (stored !== null) {
    return stored === 'true';
  }
  return inMemoryGraphScanSetting ?? true;
}

export function setStoredGraphScanSetting(enabled: boolean): void {
  safeSet(STORAGE_KEY_GRAPH_SCAN, enabled ? 'true' : 'false');
  inMemoryGraphScanSetting = enabled;
  notifySettingsChanged(STORAGE_KEY_GRAPH_SCAN);
}

export function _resetGraphScanSettingForTesting(): void {
  inMemoryGraphScanSetting = null;
  safeRemove(STORAGE_KEY_GRAPH_SCAN);
  notifySettingsChanged(STORAGE_KEY_GRAPH_SCAN);
}

export type SpeechDetail = 'full' | 'short';

export const STORAGE_KEY_SPEECH_DETAIL = 'gt_speech_detail';

let inMemorySpeechDetailSetting: SpeechDetail | null = null;

export function getStoredSpeechDetailSetting(): SpeechDetail {
  const stored = safeGet(STORAGE_KEY_SPEECH_DETAIL);
  if (stored === 'full' || stored === 'short') {
    return stored;
  }
  return inMemorySpeechDetailSetting ?? 'full';
}

export function setStoredSpeechDetailSetting(detail: SpeechDetail): void {
  safeSet(STORAGE_KEY_SPEECH_DETAIL, detail);
  inMemorySpeechDetailSetting = detail;
  notifySettingsChanged(STORAGE_KEY_SPEECH_DETAIL);
}

export function _resetSpeechDetailSettingForTesting(): void {
  inMemorySpeechDetailSetting = null;
  safeRemove(STORAGE_KEY_SPEECH_DETAIL);
  notifySettingsChanged(STORAGE_KEY_SPEECH_DETAIL);
}

/**
 * Pure graph scan tone helper (Lane A6).
 *
 * Only for kind 'function_graph'. Target is the polyline: null (the engine
 * already plays it at full level). Otherwise use curveYAtX(scene, xNorm, yNorm):
 * if it returns a value, hz = pitchForY(yNorm of curve), level 0.33; else null.
 */
export function scanTone(
  scene: DiagramScene,
  target: Target,
  xNorm: number,
  yNorm: number,
): { hz: number; level: number } | null {
  if (scene.kind !== 'function_graph') return null;
  if (target.kind === 'line' && target.elementKind === 'polyline') {
    return null;
  }
  let curve = curveYAtX(scene, xNorm, yNorm);
  if (curve === null && Number.isFinite(xNorm)) {
    // Handle floating-point imprecision near boundaries (e.g. 0.9000000000000006)
    const rounded = Math.round(xNorm * 100000) / 100000;
    if (rounded !== xNorm) {
      curve = curveYAtX(scene, rounded, yNorm);
    }
  }
  if (curve !== null) {
    return {
      hz: pitchForY(curve.yNorm),
      level: 0.33,
    };
  }
  return null;
}

export {
  step,
  initialState,
  DEFAULT_HAPTICS,
  pitchForY,
  getStoredDirectionsSetting,
  setStoredDirectionsSetting,
  _resetDirectionsSettingForTesting,
  STORAGE_KEY_DIRECTIONS,
  getStoredFindingSoundSetting,
  setStoredFindingSoundSetting,
  _resetFindingSoundSettingForTesting,
  STORAGE_KEY_FINDING_SOUND,
  getStoredStickyLineSetting,
  setStoredStickyLineSetting,
  _resetStickyLineSettingForTesting,
  STORAGE_KEY_STICKY_LINE,
  followTarget,
  STICKY_HOLD_MS,
  STICKY_RADIUS_PX,
  getStoredCornerHeartbeatSetting,
  setStoredCornerHeartbeatSetting,
  _resetCornerHeartbeatSettingForTesting,
  STORAGE_KEY_CORNER_HEARTBEAT,
  DEFAULT_HEARTBEAT,
  initialHeartbeatState,
  heartbeatStep,
  subscribeSettings,
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
  HeartbeatConfig,
  HeartbeatState,
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

export interface ProcessPointerMoveStickyOptions {
  enabled: boolean;
  prevTarget: Target;
  heldMs: number;
  stickyRadiusPx?: number;
}

export interface StickyHoldState {
  lineTarget: Extract<Target, { kind: 'line' }> | null;
  enterTime: number;
}

export function initialStickyHoldState(): StickyHoldState {
  return {
    lineTarget: null,
    enterTime: 0,
  };
}

export function resetStickyHoldOnLift(): StickyHoldState {
  return initialStickyHoldState();
}

/**
 * Computes how long (in ms) the current line target has been held without a break.
 * Returns 0 if prevTarget is not a line or does not match the active line target.
 */
export function getHeldMs(
  state: StickyHoldState,
  prevTarget: Target,
  now: number,
): number {
  if (
    prevTarget.kind === 'line' &&
    state.lineTarget !== null &&
    state.lineTarget.id === prevTarget.id &&
    state.lineTarget.elementKind === prevTarget.elementKind
  ) {
    return Math.max(0, now - state.enterTime);
  }
  return 0;
}

/**
 * Updates sticky hold state with the newly resolved target:
 * - If target is a line and matches the current held line: preserves enterTime.
 * - If target is a new line: records enterTime = now.
 * - If target is not a line (none, vertex, bar): resets sticky hold state.
 */
export function updateStickyHoldState(
  state: StickyHoldState,
  newTarget: Target,
  now: number,
): StickyHoldState {
  if (newTarget.kind === 'line') {
    if (
      state.lineTarget !== null &&
      state.lineTarget.id === newTarget.id &&
      state.lineTarget.elementKind === newTarget.elementKind
    ) {
      return state;
    }
    return {
      lineTarget: {
        kind: 'line',
        id: newTarget.id,
        elementKind: newTarget.elementKind,
      },
      enterTime: now,
    };
  }
  return initialStickyHoldState();
}

export interface MovePipelineResult {
  target: Target;
  xNorm: number;
  yNorm: number;
  effects: Effect[];
  nextEngineState: EngineState;
  centreCheck: CentreCheckResult;
  axisCrossings: string[];
  nextAxisState: AxisTrackerState;
  nearest: NearestElement | null;
  proximityState: ProximityState;
  proximityEffects: ProximityEffect[];
  pageEdge: PageEdgeResult;
  heartbeatState: HeartbeatState;
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
  heartbeatState: HeartbeatState = initialHeartbeatState(),
  heartbeatCfg: HeartbeatConfig | null = null,
  pageEdgeState: PageEdgeState = initialPageEdgeState(),
  sticky?: ProcessPointerMoveStickyOptions,
): MovePipelineResult {
  const target = sticky?.enabled
    ? followTarget(
        sticky.prevTarget,
        sticky.heldMs,
        scene,
        finger,
        view,
        radii,
        sticky.stickyRadiusPx ?? STICKY_RADIUS_PX,
      )
    : hitTest(scene, finger, view, radii);
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

  const pageEdge = checkPageEdge(norm, pageEdgeState, view.scale);
  let finalEffects = effects;
  let nextHeartbeatState = heartbeatState;
  if (heartbeatCfg !== null) {
    const hb = heartbeatStep(
      heartbeatState,
      { kind: 'move', t, target, engineEffects: effects },
      heartbeatCfg,
    );
    finalEffects = hb.effects;
    nextHeartbeatState = hb.state;
  }

  return {
    target,
    xNorm: norm.x,
    yNorm: norm.y,
    effects: finalEffects,
    nextEngineState,
    centreCheck,
    axisCrossings,
    nextAxisState,
    nearest,
    proximityState: nextProximityState,
    proximityEffects,
    pageEdge,
    heartbeatState: nextHeartbeatState,
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

  const startInterval = (): void => {
    if (timer !== null) return;
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

  const start = (coords: ScreenPoint, now: number = performance.now()): void => {
    stop();
    lastCoords = coords;
    lastMoveAt = now;
    startInterval();
  };

  const update = (coords: ScreenPoint, now: number = performance.now()): void => {
    lastCoords = coords;
    lastMoveAt = now;
    if (timer === null) {
      startInterval();
    }
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

// ---------------------------------------------------------------------------
// Where Am I dwell detection (Lane A5)
// ---------------------------------------------------------------------------

export const WHERE_AM_I_DWELL_MS = 1200;
export const WHERE_AM_I_REST_MAX_MOVE_PX = 6;
export const WHERE_AM_I_REARM_MOVE_PX = 20;
export const WHERE_AM_I_SPEECH_QUIET_MS = 1500;

export interface WhereAmIDwellState {
  armed: boolean;
  spoken: boolean;
  restAnchor: ScreenPoint | null;
  restStartTime: number;
  lastSpokenCoords: ScreenPoint | null;
}

export function initialWhereAmIDwellState(): WhereAmIDwellState {
  return {
    armed: true,
    spoken: false,
    restAnchor: null,
    restStartTime: 0,
    lastSpokenCoords: null,
  };
}

export interface WhereAmIDwellCheckInput {
  targetKind: Target['kind'];
  coords: ScreenPoint;
  now: number;
  lastSpeechStartTime: number;
  isAskActive: boolean;
  isGuiding: boolean;
  isDirectionsEnabled?: boolean;
}

export interface WhereAmIDwellResult {
  shouldSpeak: boolean;
  nextState: WhereAmIDwellState;
}

/**
 * Updates dwell state when the pointer moves:
 * - If not armed (already spoken): re-arms once the finger moves >= 20 px from last spoken position.
 * - If armed: if moved >= 6 px from restAnchor, resets restAnchor and restStartTime.
 */
export function updateWhereAmIDwellOnMove(
  state: WhereAmIDwellState,
  coords: ScreenPoint,
  now: number,
): WhereAmIDwellState {
  if (!state.armed) {
    if (state.lastSpokenCoords) {
      const distFromSpoken = Math.hypot(
        coords.x - state.lastSpokenCoords.x,
        coords.y - state.lastSpokenCoords.y,
      );
      if (distFromSpoken >= WHERE_AM_I_REARM_MOVE_PX) {
        return {
          armed: true,
          spoken: false,
          restAnchor: coords,
          restStartTime: now,
          lastSpokenCoords: null,
        };
      }
    }
    return state;
  }

  if (!state.restAnchor) {
    return {
      ...state,
      restAnchor: coords,
      restStartTime: now,
    };
  }

  const distFromAnchor = Math.hypot(
    coords.x - state.restAnchor.x,
    coords.y - state.restAnchor.y,
  );
  if (distFromAnchor >= WHERE_AM_I_REST_MAX_MOVE_PX) {
    return {
      ...state,
      restAnchor: coords,
      restStartTime: now,
    };
  }

  return state;
}

/**
 * Checks if the finger has rested (moved < 6 px) for 1200 ms on a 'none' target.
 * Guards against speech that started < 1500 ms ago, Ask listening, and Guide active.
 * Sitting behind Directions switch (M4): if Directions is off, dwell does not speak.
 */
export function checkWhereAmIDwell(
  state: WhereAmIDwellState,
  input: WhereAmIDwellCheckInput,
): WhereAmIDwellResult {
  const { targetKind, coords, now, lastSpeechStartTime, isAskActive, isGuiding } = input;

  if (input.isDirectionsEnabled === false) {
    return {
      shouldSpeak: false,
      nextState: state,
    };
  }

  if (targetKind !== 'none') {
    return {
      shouldSpeak: false,
      nextState: {
        ...state,
        restAnchor: coords,
        restStartTime: now,
      },
    };
  }

  if (isAskActive || isGuiding) {
    return {
      shouldSpeak: false,
      nextState: state,
    };
  }

  if (now - lastSpeechStartTime < WHERE_AM_I_SPEECH_QUIET_MS) {
    return {
      shouldSpeak: false,
      nextState: state,
    };
  }

  if (!state.armed || state.spoken) {
    return {
      shouldSpeak: false,
      nextState: state,
    };
  }

  const anchor = state.restAnchor ?? coords;
  const dist = Math.hypot(coords.x - anchor.x, coords.y - anchor.y);
  if (dist >= WHERE_AM_I_REST_MAX_MOVE_PX) {
    return {
      shouldSpeak: false,
      nextState: {
        ...state,
        restAnchor: coords,
        restStartTime: now,
      },
    };
  }

  const startTime = state.restAnchor !== null ? state.restStartTime : now;
  if (now - startTime < WHERE_AM_I_DWELL_MS) {
    return {
      shouldSpeak: false,
      nextState: {
        ...state,
        restAnchor: anchor,
        restStartTime: startTime,
      },
    };
  }

  return {
    shouldSpeak: true,
    nextState: {
      armed: false,
      spoken: true,
      restAnchor: coords,
      restStartTime: now,
      lastSpokenCoords: coords,
    },
  };
}

export function resetWhereAmIDwellOnLift(): WhereAmIDwellState {
  return initialWhereAmIDwellState();
}

// ---------------------------------------------------------------------------
// Page Edge Cue Tracker (Lane bu8b)
// ---------------------------------------------------------------------------

export type PageEdgeSide = 'top' | 'bottom' | 'left' | 'right';

export interface PageEdgeState {
  armed: boolean;
  lastSide: PageEdgeSide | null;
}

export function initialPageEdgeState(): PageEdgeState {
  return {
    armed: true,
    lastSide: null,
  };
}

export interface PageEdgeResult {
  spoken: string | null;
  nextState: PageEdgeState;
}

export const PAGE_EDGE_REARM_PX = 20;

/**
 * Pure page edge tracker (Lane bu8b):
 * - Fires when the finger goes outside [0, 1] on either axis and names the side
 *   ("Edge, top", "Edge, bottom", "Edge, left", "Edge, right" through i18n).
 * - Re-arms only after the finger is back inside by at least 20 px worth of
 *   normalized distance (viewport scale passed in).
 * - Landing outside speaks once (seeded on pointerdown with initialPageEdgeState()).
 */
export function checkPageEdge(
  normPos: { x: number; y: number },
  state: PageEdgeState = initialPageEdgeState(),
  viewScale: number = 300,
): PageEdgeResult {
  if (!Number.isFinite(normPos.x) || !Number.isFinite(normPos.y)) {
    return { spoken: null, nextState: state };
  }

  const scale = Number.isFinite(viewScale) && viewScale > 0 ? viewScale : 300;
  const margin = PAGE_EDGE_REARM_PX / scale;

  const isOutside =
    normPos.x < 0 || normPos.x > 1 || normPos.y < 0 || normPos.y > 1;

  if (isOutside) {
    if (state.armed) {
      const dLeft = normPos.x < 0 ? -normPos.x : 0;
      const dRight = normPos.x > 1 ? normPos.x - 1 : 0;
      const dTop = normPos.y < 0 ? -normPos.y : 0;
      const dBottom = normPos.y > 1 ? normPos.y - 1 : 0;

      const maxDist = Math.max(dTop, dBottom, dLeft, dRight);
      let side: PageEdgeSide;
      if (maxDist === dTop) side = 'top';
      else if (maxDist === dBottom) side = 'bottom';
      else if (maxDist === dLeft) side = 'left';
      else side = 'right';

      return {
        spoken: t(`edge.${side}`),
        nextState: {
          armed: false,
          lastSide: side,
        },
      };
    }

    return {
      spoken: null,
      nextState: state,
    };
  }

  // Inside [0, 1]: check if re-armed by moving >= 20 px inside on all axes
  if (!state.armed) {
    const isBackInside =
      normPos.x >= margin - 1e-9 &&
      normPos.x <= 1 - margin + 1e-9 &&
      normPos.y >= margin - 1e-9 &&
      normPos.y <= 1 - margin + 1e-9;

    if (isBackInside) {
      return {
        spoken: null,
        nextState: {
          armed: true,
          lastSide: null,
        },
      };
    }
  }

  return {
    spoken: null,
    nextState: state,
  };
}

/**
 * Seeds page edge tracker on pointerdown.
 * If landing outside [0, 1], speaks once and disarms.
 * If landing inside, returns spoken: null and armed: true.
 */
export function seedPageEdgeState(
  normPos: { x: number; y: number },
  viewScale: number = 300,
): PageEdgeResult {
  return checkPageEdge(normPos, initialPageEdgeState(), viewScale);
}

// ---------------------------------------------------------------------------
// Speech Pacing (Lane A7)
// ---------------------------------------------------------------------------

export const AXIS_QUIET_AFTER_CORNER_OR_BAR_MS = 600;
export const SAME_AXIS_REPEAT_INTERVAL_MS = 2000;
export const BAR_SHORT_FOLLOW_INTERVAL_MS = 700;
export const BAR_REST_FULL_SPEECH_MS = 500;

export type SpeechSource = 'corner' | 'bar' | 'axis' | 'other';

export interface SpeechPacingInput {
  t: number;
  text: string;
  source: SpeechSource;
  detail?: SpeechDetail;
  barId?: string | null;
  label?: string;
  value?: string | number;
  coords?: ScreenPoint | null;
}

export interface PendingBarRest {
  barId?: string | null;
  fullText: string;
  label: string;
  enterTime: number;
  lastMoveTime: number;
  spoken: boolean;
  restAnchor?: ScreenPoint | null;
}

export interface SpeechPacingState {
  detail: SpeechDetail;
  lastCornerOrBarTime: number;
  lastAxisWords: Record<string, number>;
  lastBarTime: number;
  lastBarId?: string | null;
  pendingBarRest: PendingBarRest | null;
}

export interface SpeechPacingResult {
  state: SpeechPacingState;
  speakNow: string | null;
}

export function initialSpeechPacingState(
  detail: SpeechDetail = getStoredSpeechDetailSetting(),
): SpeechPacingState {
  return {
    detail,
    lastCornerOrBarTime: -Infinity,
    lastAxisWords: {},
    lastBarTime: -Infinity,
    lastBarId: null,
    pendingBarRest: null,
  };
}

export function extractBarLabel(text: string): string {
  const trimmed = text.trim();
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx !== -1) {
    return trimmed.slice(0, commaIdx).trim();
  }
  return trimmed;
}

export function extractCornerLabel(text: string): string {
  const match = text.match(
    /^(.*?)[.!?।॥]\s+(?:(?:up|down|left|right|up-left|up-right|down-left|down-right|ऊपर|नीचे|बाएँ|दाएँ|ऊपर-बाएँ|ऊपर-दाएँ|नीचे-बाएँ|नीचे-दाएँ|ઉપર|નીચે|ડાબે|જમણે|ઉપર-ડાબે|ઉપર-જમણે|નીચે-ડાબે|નીચે-જમણે)\b|\d+\s*(?:edges|किनारे|કાંઠા|કિનારીઓ)\b)/i,
  );
  if (match && match[1] !== undefined) {
    return match[1].trim();
  }
  return text;
}

/**
 * Pure speech pacing function (Lane A7).
 *
 * Rules:
 * - an 'axis' text within 600 ms after a 'corner' or 'bar' text is dropped;
 * - the same axis word is not repeated within 2000 ms;
 * - in short mode a 'bar' text that follows another bar within 700 ms is reduced to its label,
 *   and the full "label, value" is spoken after the finger has rested on that bar for 500 ms;
 * - corners in short mode speak the label only;
 * - in full mode, do not drop or reorder anything except the axis rules above.
 */
export function paceSpeech(
  state: SpeechPacingState,
  input: SpeechPacingInput,
): SpeechPacingResult {
  const detail = input.detail ?? state.detail ?? 'full';
  const { t, text, source } = input;
  const currentAxisWords = { ...(state.lastAxisWords || {}) };

  // Rule 1: 'axis' text handling
  if (source === 'axis') {
    // An 'axis' text within 600 ms after a 'corner' or 'bar' text is dropped
    if (
      state.lastCornerOrBarTime !== undefined &&
      t - state.lastCornerOrBarTime < AXIS_QUIET_AFTER_CORNER_OR_BAR_MS
    ) {
      return {
        state: { ...state, detail },
        speakNow: null,
      };
    }

    // The same axis word is not repeated within 2000 ms
    const normWord = text.trim().toLowerCase();
    const lastWordTime = currentAxisWords[normWord];
    if (lastWordTime !== undefined && t - lastWordTime < SAME_AXIS_REPEAT_INTERVAL_MS) {
      return {
        state: { ...state, detail },
        speakNow: null,
      };
    }

    currentAxisWords[normWord] = t;
    return {
      state: {
        ...state,
        detail,
        lastAxisWords: currentAxisWords,
      },
      speakNow: text,
    };
  }

  // Rule 2: 'corner' text handling
  if (source === 'corner') {
    const nextState: SpeechPacingState = {
      ...state,
      detail,
      lastCornerOrBarTime: t,
      pendingBarRest: null,
    };

    if (detail === 'short') {
      const label = input.label !== undefined ? input.label : extractCornerLabel(text);
      return {
        state: nextState,
        speakNow: label,
      };
    }

    return {
      state: nextState,
      speakNow: text,
    };
  }

  // Rule 3: 'bar' text handling
  if (source === 'bar') {
    // If querying rest dwell on the current bar
    if (
      (!text || text === state.pendingBarRest?.fullText || text === state.pendingBarRest?.label) &&
      state.pendingBarRest &&
      !state.pendingBarRest.spoken &&
      t - state.pendingBarRest.lastMoveTime >= BAR_REST_FULL_SPEECH_MS
    ) {
      return {
        state: {
          ...state,
          detail,
          pendingBarRest: {
            ...state.pendingBarRest,
            spoken: true,
          },
        },
        speakNow: state.pendingBarRest.fullText,
      };
    }

    const nextState: SpeechPacingState = {
      ...state,
      detail,
      lastCornerOrBarTime: t,
      lastBarTime: t,
      lastBarId: input.barId ?? state.lastBarId,
    };

    if (detail === 'short') {
      const followsAnotherBar =
        state.lastBarTime !== undefined &&
        state.lastBarTime > -Infinity &&
        t - state.lastBarTime < BAR_SHORT_FOLLOW_INTERVAL_MS;

      if (followsAnotherBar) {
        const label = input.label !== undefined ? input.label : extractBarLabel(text);
        nextState.pendingBarRest = {
          barId: input.barId ?? null,
          fullText: text,
          label,
          enterTime: t,
          lastMoveTime: t,
          spoken: false,
          restAnchor: input.coords ?? null,
        };
        return {
          state: nextState,
          speakNow: label,
        };
      } else {
        nextState.pendingBarRest = null;
        return {
          state: nextState,
          speakNow: text,
        };
      }
    }

    // Full mode: full "label, value"
    nextState.pendingBarRest = null;
    return {
      state: nextState,
      speakNow: text,
    };
  }

  // Rule 4: 'other' source
  return {
    state: {
      ...state,
      detail,
    },
    speakNow: text,
  };
}

export const BAR_REST_MAX_MOVE_PX = 20;

export function updateBarMove(
  state: SpeechPacingState,
  t: number,
  barId?: string | null,
  coords?: ScreenPoint | null,
  maxMovePx: number = BAR_REST_MAX_MOVE_PX,
): SpeechPacingState {
  if (!state.pendingBarRest) return state;
  if (barId && state.pendingBarRest.barId && state.pendingBarRest.barId !== barId) {
    return {
      ...state,
      pendingBarRest: null,
    };
  }

  const anchor = state.pendingBarRest.restAnchor;
  if (coords) {
    if (!anchor) {
      return {
        ...state,
        pendingBarRest: {
          ...state.pendingBarRest,
          restAnchor: coords,
        },
      };
    }
    const dist = Math.hypot(coords.x - anchor.x, coords.y - anchor.y);
    if (dist < maxMovePx) {
      return state;
    }
    return {
      ...state,
      pendingBarRest: {
        ...state.pendingBarRest,
        restAnchor: coords,
        lastMoveTime: t,
      },
    };
  }

  return {
    ...state,
    pendingBarRest: {
      ...state.pendingBarRest,
      lastMoveTime: t,
    },
  };
}

export const noteBarMove = updateBarMove;

export function checkBarRest(
  state: SpeechPacingState,
  t: number,
  currentBarId?: string | null,
): { state: SpeechPacingState; speakNow: string | null } {
  if (
    state.pendingBarRest &&
    !state.pendingBarRest.spoken &&
    t - state.pendingBarRest.lastMoveTime >= BAR_REST_FULL_SPEECH_MS &&
    (!currentBarId || !state.pendingBarRest.barId || state.pendingBarRest.barId === currentBarId)
  ) {
    return {
      state: {
        ...state,
        pendingBarRest: {
          ...state.pendingBarRest,
          spoken: true,
        },
      },
      speakNow: state.pendingBarRest.fullText,
    };
  }
  return { state, speakNow: null };
}

export function resetBarRest(state: SpeechPacingState): SpeechPacingState {
  if (!state.pendingBarRest) return state;
  return {
    ...state,
    pendingBarRest: null,
  };
}


