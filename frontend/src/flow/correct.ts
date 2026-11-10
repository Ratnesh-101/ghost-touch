/**
 * Flow and state helpers for Teacher Correct mode.
 *
 * Coordinates element selection, hit-testing for interactive editing,
 * and formatting validation results.
 */
import {
  clamp01,
  deleteBar,
  deletePoint,
  deletePolyline,
  deleteSegment,
  type HistoryState,
} from '../core/correct';
import type { Bar, DiagramScene, Point, Polyline, Segment } from '../core/scene';
import { t } from '../i18n';
import { joinAnnouncements } from './explore';

export type CorrectSelection =
  | { kind: 'point'; id: string }
  | { kind: 'segment'; id: string }
  | { kind: 'polyline'; id: string }
  | { kind: 'bar'; id: string }
  | null;

export const HIT_POINT_RADIUS_PX = 24;
export const HIT_SEGMENT_RADIUS_PX = 16;

/**
 * Find the closest point within hit radius of (px, py).
 */
export function hitTestPoint(
  points: Point[] | undefined,
  px: number,
  py: number,
  canvasWidth: number,
  canvasHeight: number,
  radiusPx: number = HIT_POINT_RADIUS_PX,
): Point | null {
  if (!points || points.length === 0) return null;
  let closest: Point | null = null;
  let minDist = radiusPx;

  for (const pt of points) {
    const sx = pt.x * canvasWidth;
    const sy = pt.y * canvasHeight;
    const dist = Math.hypot(sx - px, sy - py);
    if (dist <= minDist) {
      minDist = dist;
      closest = pt;
    }
  }

  return closest;
}

/** Distance from screen point (px, py) to segment with screen endpoints (ax, ay) and (bx, by). */
export function distToScreenSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  const tProj = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + tProj * dx;
  const projY = ay + tProj * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Find the closest segment within hit radius of (px, py).
 */
export function hitTestSegment(
  scene: DiagramScene,
  px: number,
  py: number,
  canvasWidth: number,
  canvasHeight: number,
  radiusPx: number = HIT_SEGMENT_RADIUS_PX,
): Segment | null {
  const segments = scene.segments ?? [];
  const points = scene.points ?? [];
  if (segments.length === 0 || points.length === 0) return null;

  const pointMap = new Map<string, Point>();
  for (const p of points) pointMap.set(p.id, p);

  let closest: Segment | null = null;
  let minDist = radiusPx;

  for (const seg of segments) {
    const pA = pointMap.get(seg.a);
    const pB = pointMap.get(seg.b);
    if (!pA || !pB) continue;

    const ax = pA.x * canvasWidth;
    const ay = pA.y * canvasHeight;
    const bx = pB.x * canvasWidth;
    const by = pB.y * canvasHeight;

    const dist = distToScreenSegment(px, py, ax, ay, bx, by);
    if (dist <= minDist) {
      minDist = dist;
      closest = seg;
    }
  }

  return closest;
}

/**
 * Find the closest polyline within hit radius of (px, py).
 */
export function hitTestPolyline(
  scene: DiagramScene,
  px: number,
  py: number,
  canvasWidth: number,
  canvasHeight: number,
  radiusPx: number = HIT_SEGMENT_RADIUS_PX,
): Polyline | null {
  const polylines = scene.polylines ?? [];
  if (polylines.length === 0) return null;

  let closest: Polyline | null = null;
  let minDist = radiusPx;

  for (const poly of polylines) {
    const pts = poly.points;
    if (!pts || pts.length < 2) continue;

    for (let i = 0; i < pts.length - 1; i++) {
      const pA = pts[i];
      const pB = pts[i + 1];
      if (!pA || !pB) continue;
      if (
        !Number.isFinite(pA[0]) ||
        !Number.isFinite(pA[1]) ||
        !Number.isFinite(pB[0]) ||
        !Number.isFinite(pB[1])
      ) {
        continue;
      }

      const ax = pA[0] * canvasWidth;
      const ay = pA[1] * canvasHeight;
      const bx = pB[0] * canvasWidth;
      const by = pB[1] * canvasHeight;

      const dist = distToScreenSegment(px, py, ax, ay, bx, by);
      if (dist <= minDist) {
        minDist = dist;
        closest = poly;
      }
    }
  }

  return closest;
}

/**
 * Find a bar whose rectangle contains the screen point (px, py).
 */
export function hitTestBar(
  scene: DiagramScene,
  px: number,
  py: number,
  canvasWidth: number,
  canvasHeight: number,
): Bar | null {
  const bars = scene.bars ?? [];
  if (bars.length === 0) return null;

  const w = Math.max(1, canvasWidth);
  const h = Math.max(1, canvasHeight);
  const nx = px / w;
  const ny = py / h;

  for (const bar of bars) {
    if (
      !Number.isFinite(bar.x0) ||
      !Number.isFinite(bar.x1) ||
      !Number.isFinite(bar.y_top) ||
      !Number.isFinite(bar.y_base)
    ) {
      continue;
    }
    const minX = Math.min(bar.x0, bar.x1);
    const maxX = Math.max(bar.x0, bar.x1);
    const minY = Math.min(bar.y_top, bar.y_base);
    const maxY = Math.max(bar.y_top, bar.y_base);
    if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
      return bar;
    }
  }

  return null;
}

/**
 * Interactive hit-test on the Correct canvas:
 * Priority is point > segment > polyline > bar.
 */
export function hitTestCorrect(
  scene: DiagramScene,
  px: number,
  py: number,
  canvasWidth: number,
  canvasHeight: number,
): CorrectSelection {
  const pt = hitTestPoint(scene.points, px, py, canvasWidth, canvasHeight);
  if (pt) return { kind: 'point', id: pt.id };

  const seg = hitTestSegment(scene, px, py, canvasWidth, canvasHeight);
  if (seg) return { kind: 'segment', id: seg.id };

  const poly = hitTestPolyline(scene, px, py, canvasWidth, canvasHeight);
  if (poly) return { kind: 'polyline', id: poly.id };

  const bar = hitTestBar(scene, px, py, canvasWidth, canvasHeight);
  if (bar) return { kind: 'bar', id: bar.id };

  return null;
}

/**
 * Convert screen pointer coordinates to clamped normalized coordinates [0, 1].
 */
export function pointerToNorm(
  px: number,
  py: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  const safeW = Math.max(1, canvasWidth);
  const safeH = Math.max(1, canvasHeight);
  return {
    x: clamp01(px / safeW),
    y: clamp01(py / safeH),
  };
}

/**
 * Inspect the selected element's current label.
 * Returns the element's label if non-empty, otherwise falls back to its id.
 */
export function getSelectedLabel(scene: DiagramScene, selection: CorrectSelection): string {
  if (!selection) return '';
  if (selection.kind === 'point') {
    const pt = (scene.points ?? []).find((p) => p.id === selection.id);
    const label = pt?.label?.trim();
    return label && label.length > 0 ? label : (pt?.id ?? selection.id);
  }
  if (selection.kind === 'segment') {
    const seg = (scene.segments ?? []).find((s) => s.id === selection.id);
    const label = seg?.label?.trim();
    return label && label.length > 0 ? label : (seg?.id ?? selection.id);
  }
  if (selection.kind === 'polyline') {
    const poly = (scene.polylines ?? []).find((p) => p.id === selection.id);
    const label = poly?.label?.trim();
    return label && label.length > 0 ? label : (poly?.id ?? selection.id);
  }
  if (selection.kind === 'bar') {
    const bar = (scene.bars ?? []).find((b) => b.id === selection.id);
    const label = bar?.label?.trim();
    return label && label.length > 0 ? label : (bar?.id ?? selection.id);
  }
  return '';
}

/**
 * Format spoken and visible announcement for selected element.
 */
export function getSelectionAnnouncement(
  scene: DiagramScene,
  selection: CorrectSelection,
): string {
  if (!selection) return t('correct.noSelection');
  if (selection.kind === 'point') {
    const pt = (scene.points ?? []).find((p) => p.id === selection.id);
    const label = pt?.label?.trim();
    const display = label && label.length > 0 ? `${label} (${selection.id})` : selection.id;
    return `${t('correct.selectedPoint')}: ${display}`;
  }
  if (selection.kind === 'segment') {
    const seg = (scene.segments ?? []).find((s) => s.id === selection.id);
    const label = seg?.label?.trim();
    const display = label && label.length > 0 ? `${label} (${selection.id})` : selection.id;
    return `${t('correct.selectedSegment')}: ${display}`;
  }
  if (selection.kind === 'polyline') {
    const poly = (scene.polylines ?? []).find((p) => p.id === selection.id);
    const label = poly?.label?.trim();
    const display = label && label.length > 0 ? `${label} (${selection.id})` : selection.id;
    return `${t('correct.selectedPolyline')}: ${display}`;
  }
  if (selection.kind === 'bar') {
    const bar = (scene.bars ?? []).find((b) => b.id === selection.id);
    const label = bar?.label?.trim();
    const display = label && label.length > 0 ? `${label} (${selection.id})` : selection.id;
    return `${t('correct.selectedBar')}: ${display}`;
  }
  return '';
}

/**
 * Check whether a scene has no drawable elements left to feel
 * (no points, segments, polylines, or bars).
 */
export function isSceneEmpty(scene: DiagramScene): boolean {
  const pointsCount = scene.points?.length ?? 0;
  const segmentsCount = scene.segments?.length ?? 0;
  const polylinesCount = scene.polylines?.length ?? 0;
  const barsCount = scene.bars?.length ?? 0;
  return pointsCount === 0 && segmentsCount === 0 && polylinesCount === 0 && barsCount === 0;
}

export interface DeleteElementResult {
  scene: DiagramScene;
  isNoOp: boolean;
  announcement: string;
}

/**
 * Delete the currently selected element (point, segment, polyline, or bar)
 * from the diagram scene.
 *
 * Calls deletePoint, deleteSegment, deletePolyline, or deleteBar.
 * If the element is not found, returns the same scene object and isNoOp: true.
 * If the deletion leaves no elements in the diagram, appends correct.nothingLeft.
 */
export function deleteSelectedElement(
  scene: DiagramScene,
  selection: CorrectSelection,
): DeleteElementResult {
  if (!selection) {
    return {
      scene,
      isNoOp: true,
      announcement: t('correct.noSelection'),
    };
  }

  let updated = scene;
  let deletedKey = '';
  const id = selection.id;

  if (selection.kind === 'point') {
    if (!(scene.points ?? []).some((p) => p.id === id)) {
      updated = scene;
    } else {
      updated = deletePoint(scene, id);
    }
    deletedKey = 'correct.pointDeleted';
  } else if (selection.kind === 'segment') {
    if (!(scene.segments ?? []).some((s) => s.id === id)) {
      updated = scene;
    } else {
      updated = deleteSegment(scene, id);
    }
    deletedKey = 'correct.segmentDeleted';
  } else if (selection.kind === 'polyline') {
    updated = deletePolyline(scene, id);
    deletedKey = 'correct.polylineDeleted';
  } else if (selection.kind === 'bar') {
    updated = deleteBar(scene, id);
    deletedKey = 'correct.barDeleted';
  }

  if (updated === scene) {
    return {
      scene,
      isNoOp: true,
      announcement: t('correct.noSelection'),
    };
  }

  const deletedMsg = `${t(deletedKey)}: ${id}`;
  const announcement = isSceneEmpty(updated)
    ? joinAnnouncements([deletedMsg, t('correct.nothingLeft')])
    : deletedMsg;

  return {
    scene: updated,
    isNoOp: false,
    announcement,
  };
}

/**
 * Build error text from validation failure.
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) {
    return t('correct.validationFailed').replace('{errors}', 'Unknown error');
  }
  return t('correct.validationFailed').replace('{errors}', errors.join('; '));
}

/**
 * Helper to check if can undo or redo.
 */
export function canUndoHistory(history: HistoryState): boolean {
  return history.past.length > 0;
}

export function canRedoHistory(history: HistoryState): boolean {
  return history.future.length > 0;
}
