/**
 * Compass helpers - "know where the line goes" (Requirement 26, task 43).
 *
 * Pure core (tech.md rule 1): no DOM, React, or browser API. The 8-way idea is the one in
 * `guide/geometry.ts` (`HintKey`), re-implemented here because the core must not import from
 * `guide/`.
 *
 * Directions are measured in the unit square as Explore draws it (the scene's `aspect` is not
 * applied), so the word matches what the finger feels. `y = 0` is the top, so "up" is the
 * smaller y.
 */

import type { NormPoint, ScreenPoint, Viewport } from './geometry';
import type { DiagramScene, Point } from './scene';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Compass8 =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'up-left'
  | 'up-right'
  | 'down-left'
  | 'down-right';

/** One edge leaving a vertex. */
export interface VertexExit {
  segmentId: string;
  toId: string;
  toLabel?: string;
  dir: Compass8;
}

/** The two ends of a segment and the way to travel along it to reach each one. */
export interface LineEnds {
  aId: string;
  bId: string;
  dirToA: Compass8;
  dirToB: Compass8;
}

export type NearestKind = 'vertex' | 'segment' | 'polyline' | 'axis' | 'bar-edge';

/** The drawn element nearest a finger, and the vector from the finger to it (screen pixels). */
export interface NearestElement {
  id: string;
  elementKind: NearestKind;
  distPx: number;
  dxPx: number;
  dyPx: number;
}

// ---------------------------------------------------------------------------
// directionOf
// ---------------------------------------------------------------------------

/** tan(22.5 degrees): the slope at the edge of a horizontal or vertical sector. */
const SECTOR_SLOPE = Math.SQRT2 - 1;

/**
 * The compass word for the way from `from` to `to`, or null when they coincide or any
 * coordinate is NaN or infinite.
 *
 * No trigonometry: only |dx|, |dy| and the signs are used. `a - b` is exactly `-(b - a)` in
 * floating point, so swapping the points flips the signs and keeps the magnitudes, and the
 * answer is exactly the opposite word, even on a sector boundary (which goes to the axis word).
 */
export function directionOf(from: NormPoint, to: NormPoint): Compass8 | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (dx === 0 && dy === 0) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay <= SECTOR_SLOPE * ax) return dx > 0 ? 'right' : 'left';
  if (ax <= SECTOR_SLOPE * ay) return dy > 0 ? 'down' : 'up';
  if (dy > 0) return dx > 0 ? 'down-right' : 'down-left';
  return dx > 0 ? 'up-right' : 'up-left';
}

// ---------------------------------------------------------------------------
// vertexExits, lineEnds
// ---------------------------------------------------------------------------

/** The first point with this id (as `hitTest` does), or undefined. */
function findPoint(points: Point[], id: string): Point | undefined {
  for (const p of points) {
    if (p.id === id) return p;
  }
  return undefined;
}

/**
 * Every edge that leaves the vertex `pointId`, in scene order: one entry per segment that joins
 * it to a different, existing point at a different position. A self-loop, a dangling segment
 * and a segment to a coincident or non-finite point give no entry. An unknown id gives [].
 * The caller omits the edge the finger arrived on by its `segmentId`.
 */
export function vertexExits(scene: DiagramScene, pointId: string): VertexExit[] {
  const points = scene.points;
  const segments = scene.segments;
  if (points === undefined || segments === undefined) return [];
  const self = findPoint(points, pointId);
  if (self === undefined) return [];

  const exits: VertexExit[] = [];
  for (const seg of segments) {
    let otherId: string;
    if (seg.a === pointId && seg.b !== pointId) otherId = seg.b;
    else if (seg.b === pointId && seg.a !== pointId) otherId = seg.a;
    else continue;
    const other = findPoint(points, otherId);
    if (other === undefined) continue;
    const dir = directionOf(self, other);
    if (dir === null) continue;
    const label = typeof other.label === 'string' ? other.label.trim() : '';
    if (label === '') {
      exits.push({ segmentId: seg.id, toId: otherId, dir });
    } else {
      exits.push({ segmentId: seg.id, toId: otherId, toLabel: label, dir });
    }
  }
  return exits;
}

/**
 * Both ends of the segment `lineId` and the direction of travel towards each: `dirToA` is the
 * way from b to a, `dirToB` the way from a to b, so the two are always opposite. The first
 * segment with the id decides. Null for any other id, a dangling segment, or ends that coincide.
 */
export function lineEnds(scene: DiagramScene, lineId: string): LineEnds | null {
  const points = scene.points;
  const segments = scene.segments;
  if (points === undefined || segments === undefined) return null;
  for (const seg of segments) {
    if (seg.id !== lineId) continue;
    const a = findPoint(points, seg.a);
    const b = findPoint(points, seg.b);
    if (a === undefined || b === undefined) return null;
    const dirToA = directionOf(b, a);
    const dirToB = directionOf(a, b);
    if (dirToA === null || dirToB === null) return null;
    return { aId: seg.a, bId: seg.b, dirToA, dirToB };
  }
  return null;
}

// ---------------------------------------------------------------------------
// nearestElement
// ---------------------------------------------------------------------------

/**
 * The drawn element nearest the finger, with the vector from the finger to its closest point
 * (screen y grows downward). Works in screen pixels with the same arithmetic as `hitTest`.
 *
 * Candidates, in tie-break order (the first wins a tie): vertices, segments, polyline pieces,
 * the two axes, four edges per bar. Bar interiors are not elements. With `maxDistPx` the result
 * is null unless the nearest element is at most that far (a NaN maximum keeps nothing).
 * Null also for a viewport without drawable area, a non-finite finger, or nothing drawable.
 * `distPx` is `Math.hypot(dxPx, dyPx)`, so the vector length equals the distance exactly.
 */
export function nearestElement(
  scene: DiagramScene,
  finger: ScreenPoint,
  view: Viewport,
  maxDistPx?: number,
): NearestElement | null {
  if (!(view.scale > 0)) return null;
  const fx = finger.x;
  const fy = finger.y;
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
  const limit = maxDistPx === undefined ? Infinity : maxDistPx;
  const ox = view.offsetX;
  const oy = view.offsetY;
  const sc = view.scale;

  let found = false;
  let bestId = '';
  let bestKind: NearestKind = 'vertex';
  let bestDist = 0;
  let bestDx = 0;
  let bestDy = 0;

  /** Keep the candidate if its (finite, in-limit) distance beats the best so far. */
  const consider = (id: string, kind: NearestKind, dx: number, dy: number): void => {
    const dist = Math.hypot(dx, dy);
    if (!Number.isFinite(dist) || !(dist <= limit)) return;
    if (!found || dist < bestDist) {
      found = true;
      bestId = id;
      bestKind = kind;
      bestDist = dist;
      bestDx = dx;
      bestDy = dy;
    }
  };

  /** Offer one piece a -> b (screen coordinates): the closest point is the clamped projection. */
  const offer = (
    id: string,
    kind: NearestKind,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): void => {
    const sx = bx - ax;
    const sy = by - ay;
    const lenSq = sx * sx + sy * sy;
    let cx = ax;
    let cy = ay;
    if (lenSq !== 0) {
      let t = ((fx - ax) * sx + (fy - ay) * sy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      cx = ax + t * sx;
      cy = ay + t * sy;
    }
    consider(id, kind, cx - fx, cy - fy);
  };

  const points = scene.points;
  if (points !== undefined) {
    for (const p of points) {
      consider(p.id, 'vertex', ox + p.x * sc - fx, oy + p.y * sc - fy);
    }
  }

  const segments = scene.segments;
  if (segments !== undefined && segments.length > 0 && points !== undefined) {
    const byId = new Map<string, Point>();
    for (const p of points) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    for (const seg of segments) {
      const a = byId.get(seg.a);
      const b = byId.get(seg.b);
      if (a === undefined || b === undefined) continue; // dangling reference
      offer(seg.id, 'segment', ox + a.x * sc, oy + a.y * sc, ox + b.x * sc, oy + b.y * sc);
    }
  }

  const polylines = scene.polylines;
  if (polylines !== undefined) {
    for (const poly of polylines) {
      const pts = poly.points;
      if (pts === undefined || pts.length < 2) continue;
      const first = pts[0];
      if (first === undefined) continue;
      let ax = ox + first[0] * sc;
      let ay = oy + first[1] * sc;
      for (let i = 1; i < pts.length; i++) {
        const next = pts[i];
        if (next === undefined) continue;
        const bx = ox + next[0] * sc;
        const by = oy + next[1] * sc;
        offer(poly.id, 'polyline', ax, ay, bx, by);
        ax = bx;
        ay = by;
      }
    }
  }

  const axes = scene.axes;
  if (axes !== null && axes !== undefined) {
    const xAxisY = axes.x_axis_y;
    if (xAxisY !== null && xAxisY !== undefined) {
      const y = oy + xAxisY * sc;
      offer('x-axis', 'axis', ox, y, ox + sc, y);
    }
    const yAxisX = axes.y_axis_x;
    if (yAxisX !== null && yAxisX !== undefined) {
      const x = ox + yAxisX * sc;
      offer('y-axis', 'axis', x, oy, x, oy + sc);
    }
  }

  const bars = scene.bars;
  if (bars !== undefined) {
    for (const bar of bars) {
      const left = ox + bar.x0 * sc;
      const right = ox + bar.x1 * sc;
      const top = oy + bar.y_top * sc;
      const base = oy + bar.y_base * sc;
      offer(bar.id, 'bar-edge', left, top, right, top);
      offer(bar.id, 'bar-edge', left, base, right, base);
      offer(bar.id, 'bar-edge', left, top, left, base);
      offer(bar.id, 'bar-edge', right, top, right, base);
    }
  }

  if (!found) return null;
  return { id: bestId, elementKind: bestKind, distPx: bestDist, dxPx: bestDx, dyPx: bestDy };
}
