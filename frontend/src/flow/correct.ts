/**
 * Flow and state helpers for Teacher Correct mode.
 *
 * Coordinates element selection, hit-testing for interactive editing,
 * and formatting validation results.
 */
import {
  clamp01,
  type HistoryState,
} from '../core/correct';
import type { DiagramScene, Point, Segment } from '../core/scene';
import { t } from '../i18n';

export type CorrectSelection =
  | { kind: 'point'; id: string }
  | { kind: 'segment'; id: string }
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
 * Interactive hit-test on the Correct canvas: points take priority over segments.
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
 */
export function getSelectedLabel(scene: DiagramScene, selection: CorrectSelection): string {
  if (!selection) return '';
  if (selection.kind === 'point') {
    const pt = (scene.points ?? []).find((p) => p.id === selection.id);
    return pt?.label ?? pt?.id ?? '';
  }
  if (selection.kind === 'segment') {
    const seg = (scene.segments ?? []).find((s) => s.id === selection.id);
    return seg?.label ?? seg?.id ?? '';
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
    const label = pt?.label ? `${pt.label} (${pt.id})` : pt?.id ?? '';
    return `${t('correct.selectedPoint')}: ${label}`;
  }
  if (selection.kind === 'segment') {
    const seg = (scene.segments ?? []).find((s) => s.id === selection.id);
    const label = seg?.label ? `${seg.label} (${seg.id})` : seg?.id ?? '';
    return `${t('correct.selectedSegment')}: ${label}`;
  }
  return '';
}

/**
 * Build error text from validation failure.
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) return t('correct.validationFailed').replace('{errors}', 'Unknown error');
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
