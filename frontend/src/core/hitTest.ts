/**
 * Pure hit-testing core - maps a finger position to a diagram target.
 *
 * Per architecture rules (tech.md): this module is pure (no DOM, React, or
 * browser API access). Hit testing happens in screen-pixel space: scene
 * coordinates (normalized [0, 1]) are converted to screen pixels with the
 * viewport's letterbox transform (the same arithmetic as `toScreen` in
 * `geometry.ts`), then distances are compared against the hit radii.
 *
 * Priority order (design.md): vertex > line > bar interior > none.
 *   - Vertex hits take priority over line hits (Requirement 4.6).
 *   - Among several vertex hits, the closest wins; likewise for lines.
 *     On an exact tie the first one in scene order wins.
 *   - A bar is reported when the finger is inside the bar rectangle.
 *   - Bar boundary edges are tested as lines (Requirement 6.3).
 *
 * Performance (PERF-01): this runs on every pointer move, 60-120 times a second, and a curve
 * may have 2000 points. The loops therefore allocate nothing per point or per piece, transform
 * each polyline point once (the end of one piece is the start of the next), skip any piece whose
 * bounding box is clearly out of reach before measuring it, and only build the point index when
 * the scene has segments. The answers are exactly those of the previous version: the skip is
 * conservative (see `outOfReach`), the distances use the same arithmetic, and ties keep the
 * first candidate. Property P52 checks this against a frozen copy of the previous code.
 */

import { distToSegmentXY, toNorm } from './geometry';
import type { ScreenPoint, Viewport } from './geometry';
import type { DiagramScene, Point } from './scene';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The element kind that distinguishes a `line` target's source. */
export type LineElementKind = 'segment' | 'polyline' | 'axis' | 'bar-edge';

/**
 * Whatever is under the finger. The haptic engine consumes this to decide
 * which effects to emit.
 */
export type Target =
  | { kind: 'vertex'; id: string; label?: string }
  | { kind: 'line'; id: string; elementKind: LineElementKind }
  | { kind: 'bar'; id: string; label: string; value: number; maxValue: number }
  | { kind: 'none' };

/** Hit radii in CSS pixels. Vertex hits take priority over line hits. */
export interface Radii {
  vertex: number;
  line: number;
}

/**
 * Default hit radii from the haptic vocabulary in tech.md:
 * vertex 22 CSS px, line 14 CSS px.
 */
export const DEFAULT_RADII: Radii = { vertex: 22, line: 14 };

// ---------------------------------------------------------------------------
// Bounding-box pre-check
// ---------------------------------------------------------------------------

/**
 * True only when the finger is so far outside the box around `lo..hi` on one axis that the
 * piece cannot be within `radius`, with room to spare.
 *
 * Every point of a piece lies inside its box, so a finger more than `radius` outside the box on
 * one axis is more than `radius` from the piece. The margin adds 1 px plus a relative term, so
 * the rounding in the exact distance can never turn a skipped piece into a hit: a skip never
 * changes the answer. With a NaN anywhere every comparison is false, nothing is skipped, and the
 * exact distance (NaN) is rejected as before.
 */
function outOfReach(f: number, a: number, b: number, radius: number): boolean {
  const margin = radius + 1 + 1e-9 * (Math.abs(a) + Math.abs(b) + Math.abs(f));
  const lo = a < b ? a : b;
  const hi = a < b ? b : a;
  return f < lo - margin || f > hi + margin;
}

// ---------------------------------------------------------------------------
// hitTest
// ---------------------------------------------------------------------------

/**
 * Map a finger position (screen pixels) to the target under it.
 *
 * Priority (design.md): vertex > line > bar interior > none.
 *   1. Vertex - nearest point within `radii.vertex` (Requirements 4.3, 4.6).
 *   2. Line   - nearest segment / polyline / axis / bar-edge within `radii.line`.
 *   3. Bar    - finger inside a bar rectangle whose value is a finite number (R3-07).
 *   4. None   - nothing under the finger.
 *
 * Vertex is checked first and short-circuits, so a position within the
 * vertex radius is never classified as a line (Requirement 4.6).
 * A non-finite distance (from a NaN or infinite coordinate) is always a miss.
 */
export function hitTest(
  scene: DiagramScene,
  finger: ScreenPoint,
  view: Viewport,
  radii: Radii = DEFAULT_RADII,
): Target {
  // CORE-A6: with no drawable area there is nothing under the finger.
  if (!(view.scale > 0)) return { kind: 'none' };
  const vertex = findVertex(scene, finger, view, radii.vertex);
  if (vertex !== null) return vertex;

  const line = findLine(scene, finger, view, radii.line);
  if (line !== null) return line;

  const bar = findBar(scene, finger, view);
  if (bar !== null) return bar;

  return { kind: 'none' };
}

/** Nearest point within `radius` (first one wins a tie), or null. */
function findVertex(
  scene: DiagramScene,
  finger: ScreenPoint,
  view: Viewport,
  radius: number,
): Target | null {
  const points = scene.points;
  if (points === undefined) return null;
  const fx = finger.x;
  const fy = finger.y;
  const ox = view.offsetX;
  const oy = view.offsetY;
  const sc = view.scale;

  let bestIndex = -1;
  let bestDist = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const sx = ox + p.x * sc;
    const sy = oy + p.y * sc;
    if (outOfReach(fx, sx, sx, radius) || outOfReach(fy, sy, sy, radius)) continue;
    const dist = Math.hypot(fx - sx, fy - sy);
    if (!Number.isFinite(dist) || dist > radius) continue;
    if (bestIndex === -1 || dist < bestDist) {
      bestIndex = i;
      bestDist = dist;
    }
  }
  if (bestIndex === -1) return null;
  const hit = points[bestIndex]!;
  const label = hit.label ?? undefined;
  return label !== undefined ? { kind: 'vertex', id: hit.id, label } : { kind: 'vertex', id: hit.id };
}

/** Nearest segment, polyline piece, axis or bar edge within `radius` (first wins a tie), or null. */
function findLine(
  scene: DiagramScene,
  finger: ScreenPoint,
  view: Viewport,
  radius: number,
): Target | null {
  const fx = finger.x;
  const fy = finger.y;
  const ox = view.offsetX;
  const oy = view.offsetY;
  const sc = view.scale;

  // The best candidate so far, kept in plain variables (no object per candidate).
  let found = false;
  let bestId = '';
  let bestKind: LineElementKind = 'segment';
  let bestDist = 0;

  /** Measure one piece (screen coordinates) and keep it if it is the new nearest. */
  const offer = (
    id: string,
    kind: LineElementKind,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): void => {
    if (outOfReach(fx, ax, bx, radius) || outOfReach(fy, ay, by, radius)) return;
    const dist = distToSegmentXY(fx, fy, ax, ay, bx, by);
    if (!Number.isFinite(dist) || dist > radius) return;
    if (!found || dist < bestDist) {
      found = true;
      bestId = id;
      bestKind = kind;
      bestDist = dist;
    }
  };

  // Segments - resolve endpoint ids to points (the first point with an id wins, as before).
  const segments = scene.segments;
  if (segments !== undefined && segments.length > 0) {
    const byId = indexPoints(scene.points);
    for (const seg of segments) {
      const a = byId.get(seg.a);
      const b = byId.get(seg.b);
      if (a === undefined || b === undefined) continue; // dangling ref - skip
      offer(seg.id, 'segment', ox + a.x * sc, oy + a.y * sc, ox + b.x * sc, oy + b.y * sc);
    }
  }

  // Polylines - each point is transformed once and reused as the start of the next piece.
  const polylines = scene.polylines;
  if (polylines !== undefined) {
    for (const poly of polylines) {
      const pts = poly.points;
      if (pts.length < 2) continue;
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

  // Axes - full-width horizontal (x) and full-height vertical (y) lines.
  const axes = scene.axes;
  if (axes !== null && axes !== undefined) {
    const xAxisY = axes.x_axis_y;
    if (xAxisY !== null && xAxisY !== undefined) {
      const y = oy + xAxisY * sc;
      offer('x-axis', 'axis', ox + 0 * sc, y, ox + 1 * sc, y);
    }
    const yAxisX = axes.y_axis_x;
    if (yAxisX !== null && yAxisX !== undefined) {
      const x = ox + yAxisX * sc;
      offer('y-axis', 'axis', x, oy + 0 * sc, x, oy + 1 * sc);
    }
  }

  // Bar edges - each bar has four boundary edges (Req 6.3): top, bottom, left, right.
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

  return found ? { kind: 'line', id: bestId, elementKind: bestKind } : null;
}

/** Index scene points by id for segment endpoint lookup (built only when there are segments). */
function indexPoints(points: Point[] | undefined): Map<string, Point> {
  const map = new Map<string, Point>();
  if (points !== undefined) {
    for (const p of points) {
      map.set(p.id, p);
    }
  }
  return map;
}

/**
 * Find a bar whose interior contains the finger, or null.
 *
 * `toScreen` is a uniform scale + translation, so containment in normalized
 * space is equivalent to containment in screen space. Checking in
 * normalized space avoids re-deriving each bar's screen rectangle.
 *
 * The returned target includes `maxValue` - the maximum bar value in the
 * scene - so the engine can map the bar's pitch relative to the scene's
 * range rather than a hard-coded constant.
 *
 * R3-07: a bar whose value is NaN or infinite is never reported (it would be spoken as
 * "label, NaN"), and it does not count towards `maxValue` (an infinite value would flatten
 * every other bar's pitch). Its edges still count as lines, because its outline is real.
 */
function findBar(scene: DiagramScene, finger: ScreenPoint, view: Viewport): Target | null {
  const bars = scene.bars;
  if (bars === undefined || bars.length === 0) return null;
  const fn = toNorm(finger, view);
  let maxBarValue = 0;
  for (const b of bars) {
    if (Number.isFinite(b.value) && b.value > maxBarValue) maxBarValue = b.value;
  }
  for (const bar of bars) {
    if (!Number.isFinite(bar.value)) continue;
    if (fn.x >= bar.x0 && fn.x <= bar.x1 && fn.y >= bar.y_top && fn.y <= bar.y_base) {
      return { kind: 'bar', id: bar.id, label: bar.label, value: bar.value, maxValue: maxBarValue };
    }
  }
  return null;
}
