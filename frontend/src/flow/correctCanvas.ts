/**
 * Pure coordinate conversion helpers for Teacher Correct canvas.
 *
 * Implements BUG-02 / Finding 7 fix:
 * Converts pointer client coordinates (clientX, clientY) to normalized
 * [0, 1] scene coordinates using the same letterboxed Viewport used for drawing.
 */
import { clamp01 } from '../core/correct';
import type { NormPoint, Viewport } from '../core/geometry';

export interface CanvasBoundingRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CanvasBitmapSize {
  width: number;
  height: number;
}

export interface PointerToSceneParams {
  clientX: number;
  clientY: number;
  rect: CanvasBoundingRect;
  bitmapSize: CanvasBitmapSize;
  dpr: number;
  viewport: Viewport;
}

/**
 * Convert pointer client coordinates to normalized [0, 1] scene coordinates
 * through the letterboxed Viewport.
 *
 * Edge cases handled:
 * - Letterboxed wide boxes (left/right margins)
 * - Letterboxed tall boxes (top/bottom margins)
 * - Device pixel ratios (dpr 1, 2, 3, etc.)
 * - Pointer on corners, edges, and beyond diagram borders (clamped to [0, 1])
 */
export function pointerToScene(
  clientX: number,
  clientY: number,
  rect: CanvasBoundingRect,
  bitmapSize: CanvasBitmapSize,
  dpr: number,
  viewport: Viewport,
): NormPoint;
export function pointerToScene(params: PointerToSceneParams): NormPoint;
export function pointerToScene(
  arg1: number | PointerToSceneParams,
  arg2?: number,
  arg3?: CanvasBoundingRect,
  arg4?: CanvasBitmapSize,
  arg5?: number,
  arg6?: Viewport,
): NormPoint {
  let clientX: number;
  let clientY: number;
  let rect: CanvasBoundingRect;
  let bitmapSize: CanvasBitmapSize;
  let dpr: number;
  let viewport: Viewport;

  if (typeof arg1 === 'object') {
    clientX = arg1.clientX;
    clientY = arg1.clientY;
    rect = arg1.rect;
    bitmapSize = arg1.bitmapSize;
    dpr = arg1.dpr;
    viewport = arg1.viewport;
  } else {
    clientX = arg1;
    clientY = arg2!;
    rect = arg3!;
    bitmapSize = arg4!;
    dpr = arg5!;
    viewport = arg6!;
  }

  // Ensure dpr parameter is marked used for TypeScript strict unused-variable checks
  void dpr;

  // Pointer position in CSS pixels relative to canvas top-left
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;

  // Scale if viewport was constructed in bitmap pixels or if rect was scaled
  let scaleX = 1;
  let scaleY = 1;
  if (
    rect.width > 0 &&
    Math.abs(viewport.canvasWidth - bitmapSize.width) < 1 &&
    Math.abs(viewport.canvasWidth - rect.width) > 1
  ) {
    scaleX = bitmapSize.width / rect.width;
    scaleY = bitmapSize.height / (rect.height > 0 ? rect.height : rect.width);
  } else if (rect.width > 0 && Math.abs(rect.width - viewport.canvasWidth) > 1e-4) {
    scaleX = viewport.canvasWidth / rect.width;
    scaleY = viewport.canvasHeight / (rect.height > 0 ? rect.height : rect.width);
  }

  const canvasX = cssX * scaleX;
  const canvasY = cssY * scaleY;

  if (viewport.scale <= 0) {
    return { x: 0, y: 0 };
  }

  const normX = (canvasX - viewport.offsetX) / viewport.scale;
  const normY = (canvasY - viewport.offsetY) / viewport.scale;

  return {
    x: clamp01(normX),
    y: clamp01(normY),
  };
}

/**
 * Pure helper converting pointer client coordinates to canvas coordinates
 * relative to the letterboxed viewport for hit-testing:
 * pass the returned { px, py } with canvasWidth = viewport.scale and
 * canvasHeight = viewport.scale to hitTestCorrect or hitTestPoint.
 */
export function pointerToHitTestCoords(
  clientX: number,
  clientY: number,
  rect: CanvasBoundingRect,
  viewport: Viewport,
): { px: number; py: number } {
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;
  return {
    px: cssX - viewport.offsetX,
    py: cssY - viewport.offsetY,
  };
}

/**
 * Pure guard checking whether a photo URL represents a PDF source rather than
 * a valid image.
 */
export function isPdfSource(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith('data:application/pdf') ||
    url.includes('application/pdf') ||
    /\.pdf(\?.*)?$/i.test(url)
  );
}
