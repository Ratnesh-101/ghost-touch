/**
 * Pure core logic for Teacher Correct mode.
 *
 * Implements immutable diagram scene editing operations (move, rename, delete,
 * and, for Requirement 19, add a missed point or segment) and an undo/redo history reducer.
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

/**
 * Delete a polyline (curve) by id (Requirement 21.1). An id that is not a polyline id returns the
 * same scene (21.3). Nothing else is touched, and the input is never mutated.
 */
export function deletePolyline(scene: DiagramScene, polylineId: string): DiagramScene {
  const polylines = scene.polylines ?? [];
  if (!polylines.some((p) => p.id === polylineId)) return scene;
  return { ...scene, polylines: polylines.filter((p) => p.id !== polylineId) };
}

/**
 * Delete a bar by id (Requirement 21.2). An id that is not a bar id returns the same scene (21.3).
 * Nothing else is touched, and the input is never mutated.
 */
export function deleteBar(scene: DiagramScene, barId: string): DiagramScene {
  const bars = scene.bars ?? [];
  if (!bars.some((b) => b.id === barId)) return scene;
  return { ...scene, bars: bars.filter((b) => b.id !== barId) };
}

/** Every id used by a point, segment, polyline or bar (ids are unique across all kinds). */
function usedIds(scene: DiagramScene): Set<string> {
  const ids = new Set<string>();
  for (const p of scene.points ?? []) ids.add(p.id);
  for (const s of scene.segments ?? []) ids.add(s.id);
  for (const pl of scene.polylines ?? []) ids.add(pl.id);
  for (const b of scene.bars ?? []) ids.add(b.id);
  return ids;
}

/**
 * Ids no element may have (Requirement 23.1), lower case. `renameLabel` reads `title` and
 * `scene:title` as the scene title; the rest are object-prototype names. The share validator
 * renames them to `el_…`.
 */
export const RESERVED_ELEMENT_IDS: ReadonlySet<string> = new Set([
  'title',
  'scene:title',
  '__proto__',
  'constructor',
  'prototype',
  'tostring',
  'valueof',
  'hasownproperty',
  'isprototypeof',
  'propertyisenumerable',
  'tolocalestring',
]);

/** True when `id` is reserved, ignoring case and surrounding spaces (Requirement 23.1). */
export function isReservedId(id: string): boolean {
  return RESERVED_ELEMENT_IDS.has(id.trim().toLowerCase());
}

/** The requested id, trimmed, when it is not blank, not taken and not reserved; otherwise undefined. */
function freeRequestedId(id: string | undefined, used: Set<string>): string | undefined {
  const trimmed = id?.trim();
  return trimmed && !used.has(trimmed) && !isReservedId(trimmed) ? trimmed : undefined;
}

/** First free point id: `A` to `Z`, then `P1`, `P2`, ... (Requirement 19.1). */
function nextPointId(used: Set<string>): string {
  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code);
    if (!used.has(letter)) return letter;
  }
  let n = 1;
  while (used.has(`P${n}`)) n++;
  return `P${n}`;
}

/** Two points closer than this on both axes share a position (Requirement 23.6). */
export const COINCIDENT_EPSILON = 1e-6;
/** Distance a new point is moved off an occupied spot, per ring (Requirement 23.6). */
export const NUDGE_STEP = 0.04;
const NUDGE_RINGS = 25;
/** Right, below, left, above, then the diagonals (y grows downwards). */
const NUDGE_DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

function isOccupied(points: readonly Point[], x: number, y: number): boolean {
  return points.some(
    (p) => Math.abs(p.x - x) <= COINCIDENT_EPSILON && Math.abs(p.y - y) <= COINCIDENT_EPSILON,
  );
}

/**
 * The spot itself when no point is there, else the first free in-range nudge (Requirement 23.6),
 * else undefined.
 */
function freeSpot(points: readonly Point[], x: number, y: number): { x: number; y: number } | undefined {
  if (!isOccupied(points, x, y)) return { x, y };
  for (let ring = 1; ring <= NUDGE_RINGS; ring++) {
    for (const [dx, dy] of NUDGE_DIRECTIONS) {
      const cx = x + dx * ring * NUDGE_STEP;
      const cy = y + dy * ring * NUDGE_STEP;
      if (cx < 0 || cx > 1 || cy < 0 || cy > 1) continue;
      if (!isOccupied(points, cx, cy)) return { x: cx, y: cy };
    }
  }
  return undefined;
}

/**
 * Add a point the vision model missed (Requirement 19.1, 19.4).
 * When a point already sits at the (clamped) spot, the new one is nudged next to it so neither
 * hides the other (Requirement 23.6).
 * NaN or infinite coordinates return the same scene. Finite coordinates are clamped to [0, 1].
 * The id is `id` when free, otherwise the next free one (`A`..`Z`, then `P1`, `P2`, ...).
 * A blank label is left out. Existing elements are untouched; the input is never mutated.
 */
export function addPoint(
  scene: DiagramScene,
  x: number,
  y: number,
  label?: string,
  id?: string,
): DiagramScene {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return scene;
  const spot = freeSpot(scene.points ?? [], clamp01(x), clamp01(y));
  if (spot === undefined) return scene;

  const used = usedIds(scene);
  const pointId = freeRequestedId(id, used) ?? nextPointId(used);
  const trimmedLabel = label?.trim();
  const point: Point = { id: pointId, x: spot.x, y: spot.y };
  if (trimmedLabel) point.label = trimmedLabel;

  return { ...scene, points: [...(scene.points ?? []), point] };
}

/**
 * Add a segment the vision model missed, between two existing distinct points (Requirement 19.2).
 * Unknown endpoints, a === b, or an existing segment between the same two points (either
 * direction) return the same scene. The id is `id` when free, otherwise `${a}${b}`, then
 * `${a}${b}2`, `${a}${b}3`, ... The input is never mutated.
 */
export function addSegment(
  scene: DiagramScene,
  a: string,
  b: string,
  id?: string,
): DiagramScene {
  if (a === b) return scene;
  const points = scene.points ?? [];
  if (!points.some((p) => p.id === a) || !points.some((p) => p.id === b)) return scene;
  const segments = scene.segments ?? [];
  const joined = segments.some((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a));
  if (joined) return scene;

  const used = usedIds(scene);
  let segmentId = freeRequestedId(id, used);
  if (segmentId === undefined) {
    const base = `${a}${b}`;
    segmentId = base;
    for (let n = 2; used.has(segmentId) || isReservedId(segmentId); n++) segmentId = `${base}${n}`;
  }

  return { ...scene, segments: [...segments, { id: segmentId, a, b }] };
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

  // Reserved ids (Requirement 23.3)
  for (const el of [
    ...(scene.points ?? []),
    ...(scene.segments ?? []),
    ...(scene.polylines ?? []),
    ...(scene.bars ?? []),
  ]) {
    if (isReservedId(el.id)) errors.push(`Reserved ID: '${el.id}'`);
  }

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
