/**
 * Pure functions converting DiagramScene data into SVG path strings
 * for the 100x100 "specimen jar" preview cards.
 *
 * Requirements (docs/briefs/agy-lab-specimen.md):
 * - Pure functions: no DOM, React, or browser APIs.
 * - 100x100 box with padding (default 10 px, mapping [0, 1] to [10, 90]).
 * - Covers segments, polylines (down-sampled to <= 40 points), axes, and bars.
 * - Vertex dots with coordinates.
 * - Handles edge cases gracefully (empty scene, missing point IDs, inverted coordinates).
 * - SVG paths are lightweight (few hundred bytes).
 */

import type { Axes, Bar, DiagramScene, Point, Polyline, Segment } from '../types/scene.gen';

export interface SpecimenPathOptions {
  /** Box dimension in viewBox units. Default 100. */
  boxSize?: number;
  /** Inner padding in viewBox units. Default 10. */
  padding?: number;
  /** Maximum number of points for any polyline. Default 40. */
  maxPolylinePoints?: number;
  /** Radius of vertex dots. Default 2.5. */
  vertexRadius?: number;
  /** Horizontal shift in viewBox units applied to drawn geometry. Default 0. */
  offsetX?: number;
  /** Vertical shift in viewBox units applied to drawn geometry. Default 0. */
  offsetY?: number;
}

export interface SpecimenVertexDot {
  id: string;
  cx: number;
  cy: number;
  r: number;
}

export interface SpecimenPaths {
  /** SVG path d for coordinate axes (empty string if none) */
  axes: string;
  /** SVG path d for straight line segments */
  segments: string;
  /** SVG path d for curve polylines (down-sampled to at most maxPolylinePoints) */
  polylines: string;
  /** SVG path d for bar chart rectangles */
  bars: string;
  /** Combined SVG path d for all stroke elements */
  allLines: string;
  /** Named vertex dots with center coordinates and radius */
  vertexDots: SpecimenVertexDot[];
  /** SVG path d representing all vertex dots as circular subpaths */
  vertexDotsPath: string;
  /** True if the scene produced any drawable geometry */
  hasContent: boolean;
}

export const DEFAULT_BOX_SIZE = 100;
export const DEFAULT_PADDING = 10;
export const DEFAULT_MAX_POLYLINE_POINTS = 40;
export const DEFAULT_VERTEX_RADIUS = 2.5;

/** Formats a coordinate to at most 2 decimal places to keep SVG output compact. */
export function formatCoord(val: number): string {
  if (!Number.isFinite(val)) return '0';
  const rounded = Math.round(val * 100) / 100;
  return rounded.toString();
}

/** Transforms a normalized [0, 1] coordinate to box coordinates with padding. */
export function transformCoord(
  val: number,
  boxSize = DEFAULT_BOX_SIZE,
  padding = DEFAULT_PADDING,
): number {
  if (!Number.isFinite(val)) return padding;
  const usable = boxSize - 2 * padding;
  return padding + val * usable;
}

/**
 * Down-samples a sequence of [x, y] coordinates to at most `maxPoints`.
 * Always preserves the first point and the last point.
 */
export function downsamplePoints(
  points: ReadonlyArray<readonly [number, number]> | ReadonlyArray<[number, number]>,
  maxPoints = DEFAULT_MAX_POLYLINE_POINTS,
): [number, number][] {
  if (!points || points.length === 0) return [];
  if (points.length <= maxPoints) {
    return points.map(([x, y]) => [x, y]);
  }
  if (maxPoints <= 1) {
    const first = points[0];
    return first ? [[first[0], first[1]]] : [];
  }

  const result: [number, number][] = [];
  const total = points.length;
  const lastIndex = total - 1;
  const targetSteps = maxPoints - 1;

  for (let i = 0; i < maxPoints; i++) {
    const srcIndex = Math.round((i * lastIndex) / targetSteps);
    const pt = points[srcIndex];
    if (pt) {
      result.push([pt[0], pt[1]]);
    }
  }

  return result;
}

/**
 * Builds SVG path data for straight line segments connecting referenced points.
 * Missing point IDs or invalid coordinates are safely ignored.
 */
export function getSegmentsPath(
  segments?: ReadonlyArray<Segment> | null,
  points?: ReadonlyArray<Point> | null,
  options?: SpecimenPathOptions,
): string {
  if (!segments || segments.length === 0 || !points || points.length === 0) {
    return '';
  }

  const boxSize = options?.boxSize ?? DEFAULT_BOX_SIZE;
  const padding = options?.padding ?? DEFAULT_PADDING;
  const ox = options?.offsetX ?? 0;
  const oy = options?.offsetY ?? 0;

  const pointMap = new Map<string, { x: number; y: number }>();
  for (const p of points) {
    if (p && typeof p.id === 'string' && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      pointMap.set(p.id, { x: p.x, y: p.y });
    }
  }

  const subpaths: string[] = [];
  for (const s of segments) {
    if (!s || typeof s.a !== 'string' || typeof s.b !== 'string') continue;
    const pA = pointMap.get(s.a);
    const pB = pointMap.get(s.b);
    if (!pA || !pB) continue;

    const xA = formatCoord(transformCoord(pA.x, boxSize, padding) + ox);
    const yA = formatCoord(transformCoord(pA.y, boxSize, padding) + oy);
    const xB = formatCoord(transformCoord(pB.x, boxSize, padding) + ox);
    const yB = formatCoord(transformCoord(pB.y, boxSize, padding) + oy);

    subpaths.push(`M ${xA} ${yA} L ${xB} ${yB}`);
  }

  return subpaths.join(' ');
}

/**
 * Builds SVG path data for polylines (function graphs / curves),
 * down-sampling long point lists to at most `maxPolylinePoints`.
 */
export function getPolylinesPath(
  polylines?: ReadonlyArray<Polyline> | null,
  options?: SpecimenPathOptions,
): string {
  if (!polylines || polylines.length === 0) return '';

  const boxSize = options?.boxSize ?? DEFAULT_BOX_SIZE;
  const padding = options?.padding ?? DEFAULT_PADDING;
  const ox = options?.offsetX ?? 0;
  const oy = options?.offsetY ?? 0;
  const maxPoints = options?.maxPolylinePoints ?? DEFAULT_MAX_POLYLINE_POINTS;

  const subpaths: string[] = [];

  for (const poly of polylines) {
    if (!poly || !poly.points || poly.points.length === 0) continue;
    const sampled = downsamplePoints(poly.points, maxPoints);
    if (sampled.length === 0) continue;

    const first = sampled[0];
    if (!first || !Number.isFinite(first[0]) || !Number.isFinite(first[1])) continue;

    const startX = formatCoord(transformCoord(first[0], boxSize, padding) + ox);
    const startY = formatCoord(transformCoord(first[1], boxSize, padding) + oy);

    if (sampled.length === 1) {
      subpaths.push(`M ${startX} ${startY}`);
      continue;
    }

    let d = `M ${startX} ${startY}`;
    for (let i = 1; i < sampled.length; i++) {
      const pt = sampled[i];
      if (pt && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
        const px = formatCoord(transformCoord(pt[0], boxSize, padding) + ox);
        const py = formatCoord(transformCoord(pt[1], boxSize, padding) + oy);
        d += ` L ${px} ${py}`;
      }
    }
    subpaths.push(d);
  }

  return subpaths.join(' ');
}

/**
 * Builds SVG path data for coordinate axes across the padded box.
 */
export function getAxesPath(
  axes?: Axes | null,
  options?: SpecimenPathOptions,
): string {
  if (!axes) return '';

  const boxSize = options?.boxSize ?? DEFAULT_BOX_SIZE;
  const padding = options?.padding ?? DEFAULT_PADDING;
  const ox = options?.offsetX ?? 0;
  const oy = options?.offsetY ?? 0;

  const minCoord = formatCoord(padding);
  const maxCoord = formatCoord(boxSize - padding);
  const subpaths: string[] = [];

  // Horizontal X axis (at vertical position x_axis_y)
  if (axes.x_axis_y != null && Number.isFinite(axes.x_axis_y)) {
    const y = formatCoord(transformCoord(axes.x_axis_y, boxSize, padding) + oy);
    subpaths.push(`M ${minCoord} ${y} L ${maxCoord} ${y}`);
  }

  // Vertical Y axis (at horizontal position y_axis_x)
  if (axes.y_axis_x != null && Number.isFinite(axes.y_axis_x)) {
    const x = formatCoord(transformCoord(axes.y_axis_x, boxSize, padding) + ox);
    subpaths.push(`M ${x} ${minCoord} L ${x} ${maxCoord}`);
  }

  return subpaths.join(' ');
}

/**
 * Builds SVG path data for bar chart rectangles.
 * Handles inverted coordinates (x0 > x1 or y_top > y_base) safely.
 */
export function getBarsPath(
  bars?: ReadonlyArray<Bar> | null,
  options?: SpecimenPathOptions,
): string {
  if (!bars || bars.length === 0) return '';

  const boxSize = options?.boxSize ?? DEFAULT_BOX_SIZE;
  const padding = options?.padding ?? DEFAULT_PADDING;
  const ox = options?.offsetX ?? 0;
  const oy = options?.offsetY ?? 0;

  const subpaths: string[] = [];

  for (const b of bars) {
    if (
      !b ||
      !Number.isFinite(b.x0) ||
      !Number.isFinite(b.x1) ||
      !Number.isFinite(b.y_top) ||
      !Number.isFinite(b.y_base)
    ) {
      continue;
    }

    const minX = Math.min(b.x0, b.x1);
    const maxX = Math.max(b.x0, b.x1);
    const minY = Math.min(b.y_top, b.y_base);
    const maxY = Math.max(b.y_top, b.y_base);

    const x0 = formatCoord(transformCoord(minX, boxSize, padding) + ox);
    const x1 = formatCoord(transformCoord(maxX, boxSize, padding) + ox);
    const y0 = formatCoord(transformCoord(minY, boxSize, padding) + oy);
    const y1 = formatCoord(transformCoord(maxY, boxSize, padding) + oy);

    subpaths.push(`M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`);
  }

  return subpaths.join(' ');
}

/**
 * Extracts vertex dots with transformed coordinates.
 */
export function getVertexDots(
  points?: ReadonlyArray<Point> | null,
  options?: SpecimenPathOptions,
): SpecimenVertexDot[] {
  if (!points || points.length === 0) return [];

  const boxSize = options?.boxSize ?? DEFAULT_BOX_SIZE;
  const padding = options?.padding ?? DEFAULT_PADDING;
  const ox = options?.offsetX ?? 0;
  const oy = options?.offsetY ?? 0;
  const radius = options?.vertexRadius ?? DEFAULT_VERTEX_RADIUS;

  const dots: SpecimenVertexDot[] = [];
  for (const p of points) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const cx = Math.round((transformCoord(p.x, boxSize, padding) + ox) * 100) / 100;
    const cy = Math.round((transformCoord(p.y, boxSize, padding) + oy) * 100) / 100;
    dots.push({
      id: p.id ?? `dot_${dots.length}`,
      cx,
      cy,
      r: radius,
    });
  }

  return dots;
}

/**
 * Builds an SVG path string containing circular arcs for each vertex dot.
 */
export function getVertexDotsPath(dots: ReadonlyArray<SpecimenVertexDot>): string {
  if (!dots || dots.length === 0) return '';
  const subpaths: string[] = [];
  for (const dot of dots) {
    const cy = formatCoord(dot.cy);
    const r = formatCoord(dot.r);
    const cxMinusR = formatCoord(dot.cx - dot.r);
    const doubleR = formatCoord(dot.r * 2);
    // Draw full circle with two SVG arc commands
    subpaths.push(`M ${cxMinusR} ${cy} a ${r} ${r} 0 1 0 ${doubleR} 0 a ${r} ${r} 0 1 0 -${doubleR} 0`);
  }
  return subpaths.join(' ');
}

/**
 * Neutral static specimen jar outline glyph used as a fallback during loading or on failure.
 * Completely static, non-spoken, decorative vector artwork in a 100x100 box.
 */
export function getPlaceholderJarPath(): string {
  return 'M 36 20 H 64 M 40 20 V 26 H 28 V 74 Q 28 80 34 80 H 66 Q 72 80 72 74 V 26 H 60 V 20 M 42 52 H 58 M 50 44 V 60';
}

/**
 * Computes the viewBox-unit shift that centres a scene's drawn geometry
 * (points, polylines, bars and axis positions) inside the padded box.
 *
 * Sample scenes are laid out for the full-size Explore canvas, where the
 * content sits low (e.g. baselines at y = 0.85). Drawn as-is in a small jar
 * preview the artwork looks pushed downwards relative to the centred
 * placeholder glyph; centring removes that visual jump. Returns zero offsets
 * for empty scenes.
 */
export function getCenteringOffset(
  scene: DiagramScene | null | undefined,
  options?: Pick<SpecimenPathOptions, 'boxSize' | 'padding'>,
): { offsetX: number; offsetY: number } {
  if (!scene) return { offsetX: 0, offsetY: 0 };

  const boxSize = options?.boxSize ?? DEFAULT_BOX_SIZE;
  const padding = options?.padding ?? DEFAULT_PADDING;
  const usable = boxSize - 2 * padding;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const include = (x: number, y: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };

  for (const p of scene.points ?? []) include(p.x, p.y);
  for (const poly of scene.polylines ?? []) {
    for (const pt of poly.points ?? []) include(pt[0], pt[1]);
  }
  for (const b of scene.bars ?? []) {
    include(b.x0, b.y_top);
    include(b.x1, b.y_base);
  }
  if (scene.axes) {
    const ax = scene.axes.y_axis_x;
    if (ax != null && Number.isFinite(ax)) {
      minX = Math.min(minX, ax);
      maxX = Math.max(maxX, ax);
    }
    const ay = scene.axes.x_axis_y;
    if (ay != null && Number.isFinite(ay)) {
      minY = Math.min(minY, ay);
      maxY = Math.max(maxY, ay);
    }
  }

  if (minX === Infinity || minY === Infinity) return { offsetX: 0, offsetY: 0 };

  const round = (v: number): number => Math.round(v * 100) / 100;
  return {
    offsetX: round((0.5 - (minX + maxX) / 2) * usable),
    offsetY: round((0.5 - (minY + maxY) / 2) * usable),
  };
}

/**
 * Pure generator turning a DiagramScene into comprehensive SpecimenPaths.
 */
export function generateSpecimenPaths(
  scene: DiagramScene | null | undefined,
  options?: SpecimenPathOptions,
): SpecimenPaths {
  if (!scene) {
    return {
      axes: '',
      segments: '',
      polylines: '',
      bars: '',
      allLines: '',
      vertexDots: [],
      vertexDotsPath: '',
      hasContent: false,
    };
  }

  const axes = getAxesPath(scene.axes, options);
  const segments = getSegmentsPath(scene.segments, scene.points, options);
  const polylines = getPolylinesPath(scene.polylines, options);
  const bars = getBarsPath(scene.bars, options);
  const vertexDots = getVertexDots(scene.points, options);
  const vertexDotsPath = getVertexDotsPath(vertexDots);

  const lineParts = [axes, segments, polylines, bars].filter((s) => s.length > 0);
  const allLines = lineParts.join(' ');
  const hasContent = lineParts.length > 0 || vertexDots.length > 0;

  return {
    axes,
    segments,
    polylines,
    bars,
    allLines,
    vertexDots,
    vertexDotsPath,
    hasContent,
  };
}
