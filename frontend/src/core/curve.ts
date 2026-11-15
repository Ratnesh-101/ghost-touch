/**
 * Pure curve helper - the height of a function graph's curve at a given x (Requirement 5.6).
 *
 * Per architecture rule 1 (tech.md): no DOM, React or browser API. It has no pitch rule of its
 * own; the shell passes `yNorm` to `pitchForY`.
 */

import type { DiagramScene } from './scene';

/** The curve's normalized y at some x, and the polyline it belongs to. */
export interface CurveHeight {
  polylineId: string;
  yNorm: number;
}

/**
 * Height of the curve at `xNorm`, by linear interpolation between neighbouring polyline points.
 *
 * - `null` unless the scene is a `function_graph` and `xNorm` is finite.
 * - A piece is two consecutive points whose four numbers are all finite. It covers x when x lies
 *   between its two x values. At a piece's own end the answer is that point's y exactly. A
 *   vertical piece at x offers both of its y values.
 * - Offers are collected in scene order. With a finite `yHint` the nearest offer wins (the first
 *   wins a tie); without one the first offer wins. No offer gives `null`.
 */
export function curveYAtX(scene: DiagramScene, xNorm: number, yHint?: number): CurveHeight | null {
  if (scene.kind !== 'function_graph' || !Number.isFinite(xNorm)) return null;
  const polylines = scene.polylines;
  if (!Array.isArray(polylines)) return null;
  const useHint = yHint !== undefined && Number.isFinite(yHint);

  let found = null as CurveHeight | null;
  let bestGap = 0;

  const offer = (polylineId: string, yNorm: number): void => {
    if (found === null) {
      found = { polylineId, yNorm };
      if (useHint) bestGap = Math.abs(yNorm - (yHint as number));
      return;
    }
    if (!useHint) return; // the first offer wins
    const gap = Math.abs(yNorm - (yHint as number));
    if (gap < bestGap) {
      found = { polylineId, yNorm };
      bestGap = gap;
    }
  };

  for (const poly of polylines) {
    const pts = poly?.points;
    if (!Array.isArray(pts) || pts.length < 2) continue;
    for (let i = 0; i + 1 < pts.length; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      if (p === undefined || q === undefined) continue;
      const x1 = p[0];
      const y1 = p[1];
      const x2 = q[0];
      const y2 = q[1];
      if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) continue;
      if (xNorm < Math.min(x1, x2) || xNorm > Math.max(x1, x2)) continue;
      if (x1 === x2) {
        offer(poly.id, y1);
        offer(poly.id, y2);
      } else if (xNorm === x1) {
        offer(poly.id, y1);
      } else if (xNorm === x2) {
        offer(poly.id, y2);
      } else {
        // Halving first keeps the differences finite for any finite input (no overflow at 1e308).
        const t = (xNorm / 2 - x1 / 2) / (x2 / 2 - x1 / 2);
        if (!Number.isFinite(t)) continue;
        const y = y1 * (1 - t) + y2 * t;
        offer(poly.id, Math.min(Math.max(y, Math.min(y1, y2)), Math.max(y1, y2)));
      }
    }
  }
  return found;
}
