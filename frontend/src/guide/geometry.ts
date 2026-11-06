/**
 * Pure geometry and target resolution helpers for "Guide my finger".
 *
 * All coordinates are normalized to [0, 1] with origin at top-left.
 * No browser APIs, React, or drivers imported.
 */

import type { DiagramScene } from '../types/scene.gen';
import { type GuideConfig, DEFAULT_GUIDE } from './config';

/** Normalized [0, 1] coordinate point. */
export interface NormPoint {
  x: number;
  y: number;
}

/** Target requested by user or AI. */
export type GuideTarget =
  | { kind: 'element'; elementId: string }
  | { kind: 'point'; x: number; y: number };

/** Resolved concrete point in scene space with human-readable label. */
export interface ResolvedTarget {
  x: number;
  y: number;
  label: string;
}

/** 8 compass directions plus 'here' when within arrival dead-zone. */
export type HintKey =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'up-left'
  | 'up-right'
  | 'down-left'
  | 'down-right'
  | 'here';

/**
 * Resolve a GuideTarget against the current DiagramScene into a normalized point and label.
 *
 * Rules:
 * - unknown id => null
 * - point => coordinates and label (or id)
 * - segment => midpoint of endpoints a and b
 * - polyline => nearest-to-centroid point along polyline
 * - bar => geometric centre ((x0 + x1)/2, (y_base + y_top)/2)
 * - out-of-range coordinates ([0, 1]) => null
 */
export function resolveTarget(
  scene: DiagramScene,
  t: GuideTarget
): ResolvedTarget | null {
  if (!scene || !t) return null;

  if (t.kind === 'point') {
    if (
      typeof t.x !== 'number' ||
      typeof t.y !== 'number' ||
      !Number.isFinite(t.x) ||
      !Number.isFinite(t.y) ||
      t.x < 0 ||
      t.x > 1 ||
      t.y < 0 ||
      t.y > 1
    ) {
      return null;
    }
    return {
      x: t.x,
      y: t.y,
      label: `(${t.x.toFixed(2)}, ${t.y.toFixed(2)})`,
    };
  }

  if (t.kind === 'element') {
    if (!t.elementId) return null;

    // 1. Point
    if (scene.points) {
      const pt = scene.points.find((p) => p.id === t.elementId);
      if (pt) {
        if (
          !Number.isFinite(pt.x) ||
          !Number.isFinite(pt.y) ||
          pt.x < 0 ||
          pt.x > 1 ||
          pt.y < 0 ||
          pt.y > 1
        ) {
          return null;
        }
        return {
          x: pt.x,
          y: pt.y,
          label: pt.label || pt.id,
        };
      }
    }

    // 2. Segment (midpoint of endpoints a and b)
    if (scene.segments && scene.points) {
      const seg = scene.segments.find((s) => s.id === t.elementId);
      if (seg) {
        const pa = scene.points.find((p) => p.id === seg.a);
        const pb = scene.points.find((p) => p.id === seg.b);
        if (pa && pb) {
          if (
            !Number.isFinite(pa.x) ||
            !Number.isFinite(pa.y) ||
            pa.x < 0 ||
            pa.x > 1 ||
            pa.y < 0 ||
            pa.y > 1 ||
            !Number.isFinite(pb.x) ||
            !Number.isFinite(pb.y) ||
            pb.x < 0 ||
            pb.x > 1 ||
            pb.y < 0 ||
            pb.y > 1
          ) {
            return null;
          }
          const midX = (pa.x + pb.x) / 2;
          const midY = (pa.y + pb.y) / 2;
          if (
            !Number.isFinite(midX) ||
            !Number.isFinite(midY) ||
            midX < 0 ||
            midX > 1 ||
            midY < 0 ||
            midY > 1
          ) {
            return null;
          }
          const label = seg.label || `${pa.label || seg.a}-${pb.label || seg.b}`;
          return {
            x: midX,
            y: midY,
            label,
          };
        }
        return null;
      }
    }

    // 3. Polyline (nearest-to-centroid point)
    if (scene.polylines) {
      const poly = scene.polylines.find((pl) => pl.id === t.elementId);
      if (poly && poly.points && poly.points.length > 0) {
        let sumX = 0;
        let sumY = 0;
        let validCount = 0;
        for (const pt of poly.points) {
          if (
            !Array.isArray(pt) ||
            pt.length < 2 ||
            !Number.isFinite(pt[0]) ||
            !Number.isFinite(pt[1]) ||
            pt[0] < 0 ||
            pt[0] > 1 ||
            pt[1] < 0 ||
            pt[1] > 1
          ) {
            return null;
          }
          sumX += pt[0];
          sumY += pt[1];
          validCount++;
        }
        if (validCount === 0) return null;
        const cX = sumX / validCount;
        const cY = sumY / validCount;

        let bestDistSq = Infinity;
        let bestPt: [number, number] | null = null;
        for (const pt of poly.points) {
          if (
            Array.isArray(pt) &&
            pt.length >= 2 &&
            Number.isFinite(pt[0]) &&
            Number.isFinite(pt[1])
          ) {
            const dx = pt[0] - cX;
            const dy = pt[1] - cY;
            const dSq = dx * dx + dy * dy;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestPt = [pt[0], pt[1]];
            }
          }
        }
        if (!bestPt) return null;
        return {
          x: bestPt[0],
          y: bestPt[1],
          label: poly.label || poly.id,
        };
      }
    }

    // 4. Bar (centre)
    if (scene.bars) {
      const bar = scene.bars.find((b) => b.id === t.elementId);
      if (bar) {
        if (
          !Number.isFinite(bar.x0) ||
          !Number.isFinite(bar.x1) ||
          !Number.isFinite(bar.y_base) ||
          !Number.isFinite(bar.y_top) ||
          bar.x0 < 0 ||
          bar.x0 > 1 ||
          bar.x1 < 0 ||
          bar.x1 > 1 ||
          bar.y_base < 0 ||
          bar.y_base > 1 ||
          bar.y_top < 0 ||
          bar.y_top > 1
        ) {
          return null;
        }
        const midX = (bar.x0 + bar.x1) / 2;
        const midY = (bar.y_base + bar.y_top) / 2;
        return {
          x: midX,
          y: midY,
          label: bar.label || bar.id,
        };
      }
    }

    return null;
  }

  return null;
}

/**
 * Compute vector from finger to target in normalized scene space.
 */
export function vectorTo(
  finger: NormPoint,
  target: NormPoint
): { dx: number; dy: number; dist: number } {
  const dx = target.x - finger.x;
  const dy = target.y - finger.y;
  const dist = Math.hypot(dx, dy);
  return { dx, dy, dist };
}

/**
 * Monotone non-decreasing pulse throttle interval.
 * Nearer distance => shorter interval (more rapid pulsing).
 * Clamped strictly to [nearMs, farMs].
 */
export function pulseIntervalMs(dist: number, cfg?: GuideConfig): number {
  const nearMs = cfg?.nearMs ?? DEFAULT_GUIDE.nearMs;
  const farMs = cfg?.farMs ?? DEFAULT_GUIDE.farMs;
  const lo = Math.min(nearMs, farMs);
  const hi = Math.max(nearMs, farMs);

  if (!Number.isFinite(dist) || dist <= 0) {
    return lo;
  }

  const maxDist = 1.0;
  const clampedDist = Math.min(maxDist, Math.max(0, dist));
  const t = clampedDist / maxDist;
  const interval = lo + t * (hi - lo);
  return Math.min(hi, Math.max(lo, interval));
}

/**
 * Guide tone frequency based on vertical distance dy = target.y - finger.y.
 * y = 0 is top of screen. Target above (dy < 0) gives pitch >= target below (dy > 0).
 * Always clamped strictly to [pitchLoHz, pitchHiHz].
 */
export function pitchFor(dy: number, cfg?: GuideConfig): number {
  const lo = cfg?.pitchLoHz ?? DEFAULT_GUIDE.pitchLoHz;
  const hi = cfg?.pitchHiHz ?? DEFAULT_GUIDE.pitchHiHz;
  const minHz = Math.min(lo, hi);
  const maxHz = Math.max(lo, hi);

  if (!Number.isFinite(dy)) {
    return (minHz + maxHz) / 2;
  }

  // dy ranges from -1 (target far above) to +1 (target far below).
  const clampedDy = Math.max(-1, Math.min(1, dy));
  // When clampedDy = -1, factor = 1 -> maxHz.
  // When clampedDy = +1, factor = 0 -> minHz.
  const factor = (1 - clampedDy) / 2;
  const pitch = minHz + factor * (maxHz - minHz);
  return Math.min(maxHz, Math.max(minHz, pitch));
}

/**
 * Stereo pan in [-1, 1] based on horizontal distance dx = target.x - finger.x.
 * Target left (dx < 0) => negative pan. Target right (dx > 0) => positive pan.
 * Sign strictly matches dx.
 */
export function panFor(dx: number): number {
  if (!Number.isFinite(dx) || dx === 0) {
    return 0;
  }
  return Math.max(-1, Math.min(1, dx));
}

/**
 * Direction hint: dead-zone => 'here', or one of 8 compass directions.
 * y = 0 is top of screen.
 */
export function directionHint(
  dx: number,
  dy: number,
  deadZone: number = DEFAULT_GUIDE.arriveRadius
): HintKey {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    return 'here';
  }

  const dist = Math.hypot(dx, dy);
  if (dist <= deadZone) {
    return 'here';
  }

  // dy < 0 is UP, dy > 0 is DOWN
  // dx < 0 is LEFT, dx > 0 is RIGHT
  // Angle in degrees [-180, 180]
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (deg >= -22.5 && deg <= 22.5) {
    return 'right';
  } else if (deg > 22.5 && deg <= 67.5) {
    return 'down-right';
  } else if (deg > 67.5 && deg <= 112.5) {
    return 'down';
  } else if (deg > 112.5 && deg <= 157.5) {
    return 'down-left';
  } else if (deg > 157.5 || deg <= -157.5) {
    return 'left';
  } else if (deg > -157.5 && deg <= -112.5) {
    return 'up-left';
  } else if (deg > -112.5 && deg <= -67.5) {
    return 'up';
  } else {
    return 'up-right';
  }
}

/**
 * Returns true if finger distance is within arrival radius.
 */
export function hasArrived(dist: number, cfg?: GuideConfig): boolean {
  if (!Number.isFinite(dist)) return false;
  const radius = cfg?.arriveRadius ?? DEFAULT_GUIDE.arriveRadius;
  return dist <= radius + 1e-9;
}
