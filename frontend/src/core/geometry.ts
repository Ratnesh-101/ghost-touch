/**
 * Pure geometry core — coordinate transforms and distance helpers.
 *
 * Per architecture rule 4 (tech.md): all `DiagramScene` coordinates are
 * normalized to [0, 1] with origin top-left. Conversion to screen pixels
 * happens *only* here, through the letterboxed `Viewport`.
 *
 * This module is pure: no DOM, React, or browser API access. It is safe to
 * property-test in a Node environment.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A point in normalized [0, 1] space (origin top-left). */
export interface NormPoint {
  x: number;
  y: number;
}

/** A point in CSS-pixel screen space. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Describes how the unit square [0, 1] × [0, 1] maps into a sub-rectangle of
 * the canvas. The mapping preserves aspect ratio (letterboxed) so a
 * normalized circle never becomes an ellipse regardless of canvas shape.
 *
 * The unit square is scaled to the largest square that fits the canvas and
 * centered, leaving margins on the longer axis.
 */
export interface Viewport {
  /** Full canvas width in CSS pixels. */
  canvasWidth: number;
  /** Full canvas height in CSS pixels. */
  canvasHeight: number;
  /** Side length of the letterboxed unit square, in CSS pixels. */
  scale: number;
  /** Left offset of the unit square within the canvas, in CSS pixels. */
  offsetX: number;
  /** Top offset of the unit square within the canvas, in CSS pixels. */
  offsetY: number;
}

// ---------------------------------------------------------------------------
// Viewport construction
// ---------------------------------------------------------------------------

/**
 * Build a letterboxed `Viewport` for the given canvas dimensions.
 *
 * The unit square is scaled to `min(width, height)` and centered, so:
 *  - A square canvas → no margins, scale equals the side.
 *  - A wide canvas → equal left/right margins.
 *  - A tall canvas → equal top/bottom margins.
 *
 * @param canvasWidth  canvas width in CSS pixels (≥ 0)
 * @param canvasHeight canvas height in CSS pixels (≥ 0)
 */
export function makeViewport(
  canvasWidth: number,
  canvasHeight: number,
): Viewport {
  const scale = Math.min(canvasWidth, canvasHeight);
  return {
    canvasWidth,
    canvasHeight,
    scale,
    offsetX: (canvasWidth - scale) / 2,
    offsetY: (canvasHeight - scale) / 2,
  };
}

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------

/**
 * Convert a normalized [0, 1] point to screen pixels using the viewport's
 * letterbox transform.
 *
 *   screen = offset + norm × scale
 */
export function toScreen(p: NormPoint, view: Viewport): ScreenPoint {
  return {
    x: view.offsetX + p.x * view.scale,
    y: view.offsetY + p.y * view.scale,
  };
}

/**
 * Convert a screen-pixel point back to normalized [0, 1] coordinates — the
 * exact inverse of `toScreen`.
 *
 * Points outside the letterboxed area produce values outside [0, 1]; the
 * caller (hit-test) is responsible for clamping or rejecting as needed.
 */
export function toNorm(p: ScreenPoint, view: Viewport): NormPoint {
  if (view.scale === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: (p.x - view.offsetX) / view.scale,
    y: (p.y - view.offsetY) / view.scale,
  };
}

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

/**
 * Euclidean distance from point `p` to the line segment `a → b` (all in
 * screen pixels).
 *
 * Projects `p` onto the infinite line through `a` and `b`, clamps the
 * projection parameter to [0, 1] so the closest point stays on the segment,
 * and returns the distance to that closest point. A degenerate segment
 * (`a === b`) returns the distance to that single point.
 */
export function distToSegment(
  p: ScreenPoint,
  a: ScreenPoint,
  b: ScreenPoint,
): number {
  return distToSegmentXY(p.x, p.y, a.x, a.y, b.x, b.y);
}

/**
 * `distToSegment` on plain numbers, so a hot loop allocates nothing (PERF-01). This is the one
 * implementation: `distToSegment` calls it, so the two can never give different answers.
 */
export function distToSegmentXY(
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

  // Degenerate segment: distance to the lone endpoint.
  if (lenSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  // Scalar projection of (p - a) onto (b - a), clamped to the segment.
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;

  return Math.hypot(px - closestX, py - closestY);
}
