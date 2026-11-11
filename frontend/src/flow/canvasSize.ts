/**
 * Explore canvas sizing rule (Requirement 25, task 42). Pure: no React, no browser API.
 *
 * The CSS size of the canvas comes from its container only. The bitmap (CSS size x
 * devicePixelRatio) is derived from the CSS size and is never read back, so resizing the
 * bitmap can never feed into layout. The previous box is returned unchanged (same object)
 * while the container has not moved, so callers can skip every expensive step.
 */

export interface CssBox {
  readonly width: number;
  readonly height: number;
}

export interface CanvasBox {
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** Capped device pixel ratio actually used for the bitmap. */
  readonly dpr: number;
  readonly bitmapWidth: number;
  readonly bitmapHeight: number;
}

export interface ReconcileResult {
  readonly box: CanvasBox;
  readonly changed: boolean;
}

/** Caps and sanitises a device pixel ratio (PERF-03). */
export function cappedDpr(rawDpr: number, maxDpr = 2): number {
  if (!Number.isFinite(rawDpr) || rawDpr <= 0) return 1;
  return Math.min(rawDpr, maxDpr);
}

/**
 * Whole CSS pixels, at least 1. Returns null for NaN, infinite or non-positive input,
 * which is what a hidden (display: none) container measures as.
 */
export function measureBox(container: { width: number; height: number }): CssBox | null {
  const { width, height } = container;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

/**
 * Decides the canvas box for a measured container. A DPR change alone does not move the
 * CSS box, so it is not compared. An unmeasurable container keeps the previous box (or
 * yields a 1x1 box on first call so callers always have a valid size).
 */
export function reconcileCanvasBox(
  prev: CanvasBox | null,
  container: { width: number; height: number },
  rawDpr: number,
  maxDpr = 2,
): ReconcileResult {
  const measured = measureBox(container);
  if (measured === null) {
    if (prev !== null) return { box: prev, changed: false };
    return { box: buildBox(1, 1, rawDpr, maxDpr), changed: true };
  }
  if (prev !== null && prev.cssWidth === measured.width && prev.cssHeight === measured.height) {
    return { box: prev, changed: false };
  }
  return { box: buildBox(measured.width, measured.height, rawDpr, maxDpr), changed: true };
}

function buildBox(cssWidth: number, cssHeight: number, rawDpr: number, maxDpr: number): CanvasBox {
  const dpr = cappedDpr(rawDpr, maxDpr);
  return {
    cssWidth,
    cssHeight,
    dpr,
    bitmapWidth: Math.round(cssWidth * dpr),
    bitmapHeight: Math.round(cssHeight * dpr),
  };
}
