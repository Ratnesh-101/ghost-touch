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
import {
  step,
  initialState,
  DEFAULT_HAPTICS,
  type EngineState,
  type Effect,
  type HapticConfig,
} from '../_temp/hapticEngine.stub';
import { pitchForY } from '../_temp/pitch.stub';
import { t } from '../i18n';

export { step, initialState, DEFAULT_HAPTICS, pitchForY };
export type { EngineState, Effect, HapticConfig };

/**
 * Proposed centre tick pattern: 25 ms single pulse.
 * Proposed new pattern not yet formally added to tech.md (decision for the owner).
 */
export const CENTRE_TICK_MS = 25;
export const CENTRE_RADIUS_PX = 24;
export const CENTRE_REARM_RADIUS_PX = CENTRE_RADIUS_PX * 1.5; // 36 px

export const DEFAULT_RADII: Radii = {
  vertex: 22,
  line: 14,
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

export interface AxisCrossingResult {
  spoken: string[];
  nextState: AxisTrackerState;
}

/**
 * Tracks crossing of coordinate axes (x_axis_y, y_axis_x from scene.axes)
 * and speaks "x-axis" or "y-axis" once per crossing in each direction.
 */
export function checkAxisCrossing(
  normPos: { x: number; y: number },
  axes: { x_axis_y?: number | null; y_axis_x?: number | null } | undefined | null,
  state: AxisTrackerState,
): AxisCrossingResult {
  const spoken: string[] = [];
  let nextXSide = state.lastXSide;
  let nextYSide = state.lastYSide;

  if (axes?.y_axis_x != null) {
    const currentXSide: 'left' | 'right' = normPos.x < axes.y_axis_x ? 'left' : 'right';
    if (state.lastXSide !== null && currentXSide !== state.lastXSide) {
      spoken.push(t('explore.yAxis'));
    }
    nextXSide = currentXSide;
  }

  if (axes?.x_axis_y != null) {
    const currentYSide: 'above' | 'below' = normPos.y < axes.x_axis_y ? 'above' : 'below';
    if (state.lastYSide !== null && currentYSide !== state.lastYSide) {
      spoken.push(t('explore.xAxis'));
    }
    nextYSide = currentYSide;
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

export interface MovePipelineResult {
  target: Target;
  yNorm: number;
  effects: Effect[];
  nextEngineState: EngineState;
  centreCheck: CentreCheckResult;
  axisCrossings: string[];
  nextAxisState: AxisTrackerState;
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

  return {
    target,
    yNorm: norm.y,
    effects,
    nextEngineState,
    centreCheck,
    axisCrossings,
    nextAxisState,
  };
}
