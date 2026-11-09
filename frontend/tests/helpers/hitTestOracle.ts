/**
 * TEST ORACLE (Kiro, task 32): a frozen, verbatim copy of `frontend/src/core/hitTest.ts` as it
 * was before PERF-01 (commit d8e6d09). Do not "fix" or optimise this file: the optimised
 * `hitTest` must give exactly the same answer on every input with finite bar values, and this
 * copy is what it is compared against. The only edits are this header, the import paths, and
 * the export names (`hitTestOracle`).
 */
/**
 * Pure hit-testing core - maps a finger position to a diagram target.
 *
 * Per architecture rules (tech.md): this module is pure (no DOM, React, or
 * browser API access). Hit testing happens in screen-pixel space: scene
 * coordinates (normalized [0, 1]) are converted to screen pixels via
 * `toScreen` from `geometry.ts`, then distances are compared against the
 * hit radii.
 *
 * Priority order (design.md): vertex > line > bar interior > none.
 *   - Vertex hits take priority over line hits (Requirement 4.6).
 *   - Among several vertex hits, the closest wins; likewise for lines.
 *   - A bar is reported when the finger is inside the bar rectangle.
 *   - Bar boundary edges are tested as lines (Requirement 6.3).
 */

import type { NormPoint, ScreenPoint, Viewport } from '../../src/core/geometry';

// Frozen copies of the geometry helpers as they were before PERF-01, so that a change in
// `core/geometry.ts` cannot change the oracle too and hide itself.
function toScreen(p: NormPoint, view: Viewport): ScreenPoint {
  return {
    x: view.offsetX + p.x * view.scale,
    y: view.offsetY + p.y * view.scale,
  };
}

function toNorm(p: ScreenPoint, view: Viewport): NormPoint {
  if (view.scale === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: (p.x - view.offsetX) / view.scale,
    y: (p.y - view.offsetY) / view.scale,
  };
}

function distToSegment(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;
  return Math.hypot(p.x - closestX, p.y - closestY);
}
import type { DiagramScene, Point } from '../../src/core/scene';

import type { Radii, Target, LineElementKind } from '../../src/core/hitTest';

// ---------------------------------------------------------------------------
// Internal hit candidates (carry distance so the closest wins)
// ---------------------------------------------------------------------------

interface VertexHit {
  id: string;
  label: string | undefined;
  dist: number;
}

interface LineHit {
  id: string;
  elementKind: LineElementKind;
  dist: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Index scene points by id for fast endpoint lookup. */
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
 * Keep the closer of `prev` and a vertex candidate at `dist`, but only if the
 * candidate is within `radius`. A null `prev` always loses to a valid hit.
 */
function closerVertex(
  prev: VertexHit | null,
  id: string,
  label: string | undefined,
  dist: number,
  radius: number,
): VertexHit | null {
  // NaN fails every comparison, so `dist > radius` alone lets a NaN candidate win and then
  // never lose (`dist < NaN` is false). A non-finite distance is a miss.
  if (!Number.isFinite(dist) || dist > radius) return prev;
  if (prev === null || dist < prev.dist) return { id, label, dist };
  return prev;
}

/**
 * Keep the closer of `prev` and a line candidate at `dist`, but only if the
 * candidate is within `radius`. A null `prev` always loses to a valid hit.
 */
function closerLine(
  prev: LineHit | null,
  id: string,
  elementKind: LineElementKind,
  dist: number,
  radius: number,
): LineHit | null {
  // Same NaN rule as closerVertex.
  if (!Number.isFinite(dist) || dist > radius) return prev;
  if (prev === null || dist < prev.dist) return { id, elementKind, dist };
  return prev;
}

/** Find the nearest vertex within the vertex radius, or null. */
function findVertex(
  scene: DiagramScene,
  finger: ScreenPoint,
  view: Viewport,
  radii: Radii,
): VertexHit | null {
  let best: VertexHit | null = null;
  const points = scene.points;
  if (points === undefined) return best;
  for (const p of points) {
    const s = toScreen({ x: p.x, y: p.y }, view);
    const dist = Math.hypot(finger.x - s.x, finger.y - s.y);
    best = closerVertex(best, p.id, p.label ?? undefined, dist, radii.vertex);
  }
  return best;
}

/** Find the nearest line (segment, polyline, axis, or bar edge) within the line radius. */
function findLine(
  scene: DiagramScene,
  finger: ScreenPoint,
  view: Viewport,
  radii: Radii,
  pointMap: Map<string, Point>,
): LineHit | null {
  let best: LineHit | null = null;

  // Segments - resolve endpoint ids to points, then distance to segment.
  const segments = scene.segments;
  if (segments !== undefined) {
    for (const seg of segments) {
      const a = pointMap.get(seg.a);
      const b = pointMap.get(seg.b);
      if (a === undefined || b === undefined) continue; // dangling ref - skip
      const sa = toScreen({ x: a.x, y: a.y }, view);
      const sb = toScreen({ x: b.x, y: b.y }, view);
      best = closerLine(best, seg.id, 'segment', distToSegment(finger, sa, sb), radii.line);
    }
  }

  // Polylines - distance to each consecutive pair of points.
  const polylines = scene.polylines;
  if (polylines !== undefined) {
    for (const poly of polylines) {
      const pts = poly.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (a === undefined || b === undefined) continue;
        const sa = toScreen({ x: a[0], y: a[1] }, view);
        const sb = toScreen({ x: b[0], y: b[1] }, view);
        best = closerLine(best, poly.id, 'polyline', distToSegment(finger, sa, sb), radii.line);
      }
    }
  }

  // Axes - full-width horizontal (x) and full-height vertical (y) lines.
  const axes = scene.axes;
  if (axes !== null && axes !== undefined) {
    const xAxisY = axes.x_axis_y;
    if (xAxisY !== null && xAxisY !== undefined) {
      const sa = toScreen({ x: 0, y: xAxisY }, view);
      const sb = toScreen({ x: 1, y: xAxisY }, view);
      best = closerLine(best, 'x-axis', 'axis', distToSegment(finger, sa, sb), radii.line);
    }
    const yAxisX = axes.y_axis_x;
    if (yAxisX !== null && yAxisX !== undefined) {
      const sa = toScreen({ x: yAxisX, y: 0 }, view);
      const sb = toScreen({ x: yAxisX, y: 1 }, view);
      best = closerLine(best, 'y-axis', 'axis', distToSegment(finger, sa, sb), radii.line);
    }
  }

  // Bar edges - each bar has four boundary edges (Req 6.3).
  const bars = scene.bars;
  if (bars !== undefined) {
    for (const bar of bars) {
      const tl = toScreen({ x: bar.x0, y: bar.y_top }, view);
      const tr = toScreen({ x: bar.x1, y: bar.y_top }, view);
      const bl = toScreen({ x: bar.x0, y: bar.y_base }, view);
      const br = toScreen({ x: bar.x1, y: bar.y_base }, view);
      best = closerLine(best, bar.id, 'bar-edge', distToSegment(finger, tl, tr), radii.line);
      best = closerLine(best, bar.id, 'bar-edge', distToSegment(finger, bl, br), radii.line);
      best = closerLine(best, bar.id, 'bar-edge', distToSegment(finger, tl, bl), radii.line);
      best = closerLine(best, bar.id, 'bar-edge', distToSegment(finger, tr, br), radii.line);
    }
  }

  return best;
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
 */
function findBar(
  scene: DiagramScene,
  finger: ScreenPoint,
  view: Viewport,
): Target | null {
  const bars = scene.bars;
  if (bars === undefined || bars.length === 0) return null;
  const fn = toNorm(finger, view);
  let maxBarValue = 0;
  for (const b of bars) {
    if (b.value > maxBarValue) maxBarValue = b.value;
  }
  for (const bar of bars) {
    if (fn.x >= bar.x0 && fn.x <= bar.x1 && fn.y >= bar.y_top && fn.y <= bar.y_base) {
      return { kind: 'bar', id: bar.id, label: bar.label, value: bar.value, maxValue: maxBarValue };
    }
  }
  return null;
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
 *   3. Bar    - finger inside a bar rectangle.
 *   4. None   - nothing under the finger.
 *
 * Vertex is checked first and short-circuits, so a position within the
 * vertex radius is never classified as a line (Requirement 4.6).
 */
export function hitTestOracle(
  scene: DiagramScene,
  finger: ScreenPoint,
  view: Viewport,
  radii: Radii = { vertex: 22, line: 14 },
): Target {
  const pointMap = indexPoints(scene.points);

  // Priority 1: vertex (closest wins). Short-circuits before any line check.
  const vertex = findVertex(scene, finger, view, radii);
  if (vertex !== null) {
    return vertex.label !== undefined
      ? { kind: 'vertex', id: vertex.id, label: vertex.label }
      : { kind: 'vertex', id: vertex.id };
  }

  // Priority 2: line - segments, polylines, axes, bar edges (closest wins).
  const line = findLine(scene, finger, view, radii, pointMap);
  if (line !== null) {
    return { kind: 'line', id: line.id, elementKind: line.elementKind };
  }

  // Priority 3: bar interior.
  const bar = findBar(scene, finger, view);
  if (bar !== null) return bar;

  // Priority 4: nothing under the finger.
  return { kind: 'none' };
}
