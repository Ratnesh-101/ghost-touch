/**
 * Spot anchors for a guided walk (Requirement 51.5, task 85).
 *
 * `hitTest` only ever answers a vertex, a line (segment, polyline, axis, bar edge), a bar or nothing,
 * so "the peak of the curve" is not something a finger can be "on". A spot is therefore a real element
 * plus a point on it: the finger has reached it when the `hitTest` target is one of the element ids the
 * spot accepts AND the finger is within the existing vertex radius of the point.
 *
 * Pure core (tech.md rule 1): no DOM, React, browser API, i18n or `guide/` import. Total: junk input
 * gives `null` or `false`, never an exception.
 */

import { makeViewport, toScreen } from './geometry';
import type { ScreenPoint, Viewport } from './geometry';
import { DEFAULT_RADII, hitTest } from './hitTest';
import type { Target } from './hitTest';
import type { DiagramScene } from './scene';

export type SpotName = 'origin' | 'peak' | 'trough';

/** The disc around a spot inside which the finger counts as there. The existing vertex radius, copied. */
export const ANCHOR_RADIUS_PX: number = DEFAULT_RADII.vertex;

/**
 * Canvas sizes (CSS px, the side of the letterboxed unit square) at which a spot must be reachable.
 * PROPOSED: 22 px is a fixed number of pixels, so another element near a spot steals the hit on a small
 * canvas and not on a large one. Not a haptic value.
 */
export const REACH_SCALES: readonly number[] = [200, 360, 600];

export interface SpotAnchor {
  name: SpotName;
  /** The element the point lies on (a polyline id for peak and trough, `x-axis` for the origin). */
  elementId: string;
  /** Line ids of a `hitTest` target that count as being on the spot. */
  acceptIds: string[];
  /** Normalised position of the spot. */
  x: number;
  y: number;
}

function isUnit(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

function polylineIds(scene: DiagramScene): string[] {
  const out: string[] = [];
  if (!Array.isArray(scene.polylines)) return out;
  for (const p of scene.polylines) {
    if (p !== null && typeof p === 'object' && typeof p.id === 'string') out.push(p.id);
  }
  return out;
}

/** The least-y (peak) or greatest-y (trough) usable sample over all polylines, first in scene order on a tie. */
function extremeSample(
  scene: DiagramScene,
  pick: 'min' | 'max',
): { id: string; x: number; y: number; lo: number; hi: number } | null {
  if (!Array.isArray(scene.polylines)) return null;
  let best: { id: string; x: number; y: number } | null = null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const poly of scene.polylines) {
    if (poly === null || typeof poly !== 'object' || typeof poly.id !== 'string') continue;
    if (!Array.isArray(poly.points)) continue;
    let usable = 0;
    for (const pt of poly.points) {
      if (Array.isArray(pt) && isUnit(pt[0]) && isUnit(pt[1])) usable++;
    }
    if (usable < 2) continue;
    for (const pt of poly.points) {
      if (!Array.isArray(pt) || !isUnit(pt[0]) || !isUnit(pt[1])) continue;
      const y = pt[1];
      if (y < lo) lo = y;
      if (y > hi) hi = y;
      const better = best === null || (pick === 'min' ? y < best.y : y > best.y);
      if (better) best = { id: poly.id, x: pt[0], y };
    }
  }
  return best === null ? null : { ...best, lo, hi };
}

/**
 * The structural anchor for a named spot, or `null`. Only a `function_graph` has spots. The peak and
 * trough are `null` when the curve is flat (no distinct highest and lowest sample). Reachability by a
 * finger is a separate question: see `isAnchorReachable`.
 */
export function anchorPoint(scene: DiagramScene, name: SpotName): SpotAnchor | null {
  if (scene === null || typeof scene !== 'object' || scene.kind !== 'function_graph') return null;
  if (name === 'origin') {
    const axes = scene.axes;
    if (axes === null || axes === undefined || typeof axes !== 'object') return null;
    const x = axes.y_axis_x;
    const y = axes.x_axis_y;
    if (!isUnit(x) || !isUnit(y)) return null;
    return { name, elementId: 'x-axis', acceptIds: ['x-axis', 'y-axis', ...polylineIds(scene)], x, y };
  }
  if (name !== 'peak' && name !== 'trough') return null;
  const found = extremeSample(scene, name === 'peak' ? 'min' : 'max');
  if (found === null || found.lo === found.hi) return null;
  return { name, elementId: found.id, acceptIds: [found.id], x: found.x, y: found.y };
}

/**
 * True when, at every scale, `hitTest` at the spot's own screen position reports a line whose id the
 * anchor accepts. A vertex, segment or bar within the radius that wins the hit makes this false, and
 * a walk then never promises that spot.
 */
export function isAnchorReachable(
  scene: DiagramScene,
  anchor: SpotAnchor,
  scales: readonly number[] = REACH_SCALES,
): boolean {
  try {
    if (!(scales.length > 0)) return false;
    for (const scale of scales) {
      if (!(scale > 0) || !Number.isFinite(scale)) return false;
      const view = makeViewport(scale, scale);
      const finger = toScreen({ x: anchor.x, y: anchor.y }, view);
      const target = hitTest(scene, finger, view);
      if (target.kind !== 'line' || !anchor.acceptIds.includes(target.id)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * The finger has reached the spot: the `hitTest` target is a line the anchor accepts, and the finger is
 * within `ANCHOR_RADIUS_PX` of the spot's screen position.
 */
export function spotReached(
  anchor: SpotAnchor,
  target: Target,
  finger: ScreenPoint,
  view: Viewport,
): boolean {
  if (anchor === null || typeof anchor !== 'object' || target === null || typeof target !== 'object') return false;
  if (target.kind !== 'line' || !Array.isArray(anchor.acceptIds) || !anchor.acceptIds.includes(target.id)) {
    return false;
  }
  if (finger === null || typeof finger !== 'object' || view === null || typeof view !== 'object') return false;
  const spot = toScreen({ x: anchor.x, y: anchor.y }, view);
  const d = Math.hypot(finger.x - spot.x, finger.y - spot.y);
  return Number.isFinite(d) && d <= ANCHOR_RADIUS_PX;
}
