/**
 * Pure core logic for Teacher Correct mode.
 *
 * Implements immutable diagram scene editing operations (move, rename, delete)
 * and an undo/redo history reducer.
 *
 * Pure core (tech.md rule 1): no DOM, React, window, document, or navigator access.
 */
import type { DiagramScene, Point } from './scene';

/** Clamp a numeric coordinate strictly to the normalized range [0, 1]. */
export function clamp01(val: number): number {
  if (Number.isNaN(val) || !Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(1, val));
}

/**
 * True only for a finite number in [0, 1]. NaN fails every ordering
 * comparison, so range checks written as `v < 0 || v > 1` silently accept it;
 * every coordinate check in this module goes through this helper instead.
 */
function isUnit(val: number): boolean {
  return Number.isFinite(val) && val >= 0 && val <= 1;
}

/**
 * Move a point to new normalized coordinates (x, y), clamping to [0, 1].
 * Returns a new DiagramScene with the updated point. If point is not found,
 * returns the original scene.
 */
export function movePoint(
  scene: DiagramScene,
  pointId: string,
  x: number,
  y: number,
): DiagramScene {
  const points = scene.points ?? [];
  const index = points.findIndex((p) => p.id === pointId);
  if (index === -1) return scene;

  const targetPoint = points[index];
  if (!targetPoint) return scene;

  const updatedPoint: Point = {
    ...targetPoint,
    x: clamp01(x),
    y: clamp01(y),
  };

  const newPoints = [...points];
  newPoints[index] = updatedPoint;

  return {
    ...scene,
    points: newPoints,
  };
}

/**
 * Rename the label of an element (point, segment, polyline, bar, or scene title).
 * Trims whitespace. Rejects empty labels by throwing an Error.
 * Returns a new DiagramScene with the updated label.
 */
export function renameLabel(
  scene: DiagramScene,
  elementId: string,
  newLabel: string,
): DiagramScene {
  const trimmed = newLabel.trim();
  if (trimmed.length === 0) {
    throw new Error('Label cannot be empty');
  }

  // Check scene title
  if (elementId === 'title' || elementId === 'scene:title') {
    return { ...scene, title: trimmed };
  }

  // Check points
  const points = scene.points ?? [];
  const ptIndex = points.findIndex((p) => p.id === elementId);
  if (ptIndex !== -1) {
    const pt = points[ptIndex];
    if (pt) {
      const newPoints = [...points];
      newPoints[ptIndex] = { ...pt, label: trimmed };
      return { ...scene, points: newPoints };
    }
  }

  // Check segments
  const segments = scene.segments ?? [];
  const segIndex = segments.findIndex((s) => s.id === elementId);
  if (segIndex !== -1) {
    const seg = segments[segIndex];
    if (seg) {
      const newSegments = [...segments];
      newSegments[segIndex] = { ...seg, label: trimmed };
      return { ...scene, segments: newSegments };
    }
  }

  // Check polylines
  const polylines = scene.polylines ?? [];
  const polyIndex = polylines.findIndex((p) => p.id === elementId);
  if (polyIndex !== -1) {
    const poly = polylines[polyIndex];
    if (poly) {
      const newPolylines = [...polylines];
      newPolylines[polyIndex] = { ...poly, label: trimmed };
      return { ...scene, polylines: newPolylines };
    }
  }

  // Check bars
  const bars = scene.bars ?? [];
  const barIndex = bars.findIndex((b) => b.id === elementId);
  if (barIndex !== -1) {
    const bar = bars[barIndex];
    if (bar) {
      const newBars = [...bars];
      newBars[barIndex] = { ...bar, label: trimmed };
      return { ...scene, bars: newBars };
    }
  }

  return scene;
}

/**
 * Delete a point by ID.
 * Also removes every segment that references this point (a or b),
 * preventing dangling references.
 */
export function deletePoint(scene: DiagramScene, pointId: string): DiagramScene {
  const points = (scene.points ?? []).filter((p) => p.id !== pointId);
  const segments = (scene.segments ?? []).filter(
    (s) => s.a !== pointId && s.b !== pointId,
  );

  return {
    ...scene,
    points,
    segments,
  };
}

/**
 * Delete a segment by ID.
 * Does not remove the endpoint points.
 */
export function deleteSegment(scene: DiagramScene, segmentId: string): DiagramScene {
  const segments = (scene.segments ?? []).filter((s) => s.id !== segmentId);
  return {
    ...scene,
    segments,
  };
}

/** State container for undo/redo history. */
export interface HistoryState {
  past: DiagramScene[];
  present: DiagramScene;
  future: DiagramScene[];
}

/** Create an initial history state from a starting DiagramScene. */
export function createHistory(initialScene: DiagramScene): HistoryState {
  return {
    past: [],
    present: initialScene,
    future: [],
  };
}

/** Whether an undo operation is available. */
export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

/** Whether a redo operation is available. */
export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}

/**
 * Apply a new scene state to history, pushing present to past and clearing future.
 * If nextScene is identical to present, history is unchanged.
 */
export function applyEdit(state: HistoryState, nextScene: DiagramScene): HistoryState {
  if (state.present === nextScene) return state;
  return {
    past: [...state.past, state.present],
    present: nextScene,
    future: [],
  };
}

/** Undo the last edit operation, restoring the previous scene. */
export function undo(state: HistoryState): HistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1]!;
  const newPast = state.past.slice(0, -1);
  return {
    past: newPast,
    present: previous,
    future: [state.present, ...state.future],
  };
}

/** Redo the previously undone edit operation. */
export function redo(state: HistoryState): HistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0]!;
  const newFuture = state.future.slice(1);
  return {
    past: [...state.past, state.present],
    present: next,
    future: newFuture,
  };
}

export type HistoryAction =
  | { type: 'apply'; scene: DiagramScene }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; scene: DiagramScene };

/** Pure reducer for history state transitions. */
export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'apply':
      return applyEdit(state, action.scene);
    case 'undo':
      return undo(state);
    case 'redo':
      return redo(state);
    case 'reset':
      return createHistory(action.scene);
  }
}

/**
 * Invariant validation result.
 */
export interface InvariantResult {
  ok: boolean;
  errors: string[];
}

/**
 * Pure check of structural DiagramScene invariants:
 * 1. Unique IDs across points, segments, polylines, bars
 * 2. No dangling segment endpoint references (a and b must exist in points)
 * 3. All coordinates are finite and in [0, 1]
 */
export function validateSceneInvariants(scene: DiagramScene): InvariantResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  // Check points
  const pointIdSet = new Set<string>();
  const points = scene.points ?? [];
  for (const pt of points) {
    if (seenIds.has(pt.id)) {
      errors.push(`Duplicate ID: '${pt.id}'`);
    } else {
      seenIds.add(pt.id);
      pointIdSet.add(pt.id);
    }

    if (!isUnit(pt.x)) {
      errors.push(`Point '${pt.id}' x coordinate out of range [0, 1]: ${pt.x}`);
    }
    if (!isUnit(pt.y)) {
      errors.push(`Point '${pt.id}' y coordinate out of range [0, 1]: ${pt.y}`);
    }
  }

  // Check segments
  const segments = scene.segments ?? [];
  for (const seg of segments) {
    if (seenIds.has(seg.id)) {
      errors.push(`Duplicate ID: '${seg.id}'`);
    } else {
      seenIds.add(seg.id);
    }

    if (!pointIdSet.has(seg.a)) {
      errors.push(`Segment '${seg.id}' endpoint a '${seg.a}' does not exist in points`);
    }
    if (!pointIdSet.has(seg.b)) {
      errors.push(`Segment '${seg.id}' endpoint b '${seg.b}' does not exist in points`);
    }
  }

  // Check polylines
  const polylines = scene.polylines ?? [];
  for (const poly of polylines) {
    if (seenIds.has(poly.id)) {
      errors.push(`Duplicate ID: '${poly.id}'`);
    } else {
      seenIds.add(poly.id);
    }

    for (let i = 0; i < poly.points.length; i++) {
      const coord = poly.points[i];
      if (!coord || !isUnit(coord[0]) || !isUnit(coord[1])) {
        errors.push(`Polyline '${poly.id}' coordinate [${coord?.[0]}, ${coord?.[1]}] out of range [0, 1]`);
      }
    }
  }

  // Check bars
  const bars = scene.bars ?? [];
  for (const bar of bars) {
    if (seenIds.has(bar.id)) {
      errors.push(`Duplicate ID: '${bar.id}'`);
    } else {
      seenIds.add(bar.id);
    }

    if (!isUnit(bar.x0) || !isUnit(bar.x1)) {
      errors.push(`Bar '${bar.id}' x coordinates out of range [0, 1]`);
    }
    if (!isUnit(bar.y_top) || !isUnit(bar.y_base)) {
      errors.push(`Bar '${bar.id}' y coordinates out of range [0, 1]`);
    }
  }

  // Check axes
  if (scene.axes) {
    const { x_axis_y, y_axis_x } = scene.axes;
    if (x_axis_y !== null && x_axis_y !== undefined && !isUnit(x_axis_y)) {
      errors.push(`Axes x_axis_y out of range [0, 1]: ${x_axis_y}`);
    }
    if (y_axis_x !== null && y_axis_x !== undefined && !isUnit(y_axis_x)) {
      errors.push(`Axes y_axis_x out of range [0, 1]: ${y_axis_x}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
