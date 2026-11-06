/**
 * Client-side DiagramScene validator and repair logic for shared diagrams.
 *
 * Re-implements the post-LLM validation and repair rules from backend/app/validate.py
 * and structural checks from frontend/src/core/correct.ts (validateSceneInvariants)
 * so that student diagram open works completely offline without network calls.
 *
 * Reference:
 * - backend/app/validate.py: repair coordinates (+/-0.02 tolerance), drop dangling segments, dedupe IDs.
 * - frontend/src/core/correct.ts: validateSceneInvariants.
 * - docs/briefs/guide-share-contract.md § Share contract.
 */

import { validateSceneInvariants } from '../core/correct';
import type {
  Axes,
  Bar,
  DiagramScene,
  Point,
  Polyline,
  SceneKind,
  Segment,
} from '../core/scene';
import { LIMITS } from './limits';

const CLAMP_TOLERANCE = 0.02;

/**
 * Sanitize a string by stripping C0 control characters and DEL, then capping length.
 * Inert text such as HTML tags (<script>) is preserved as plain text.
 */
export function sanitizeString(
  val: unknown,
  maxLen: number,
  allowNewlines = false,
): string {
  if (typeof val !== 'string') return '';
  // Strip ASCII 0x00-0x1F and 0x7F. If allowNewlines is true, preserve \t, \n, \r.
  const pattern = allowNewlines
    ? /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
    : /[\x00-\x1F\x7F]/g;
  return val.replace(pattern, '').slice(0, maxLen);
}

/**
 * Clamp a coordinate to [0, 1] if within +/-0.02 tolerance.
 * Returns ok: false if coordinate is beyond tolerance or not a finite number.
 * Cites: backend/app/validate.py _clamp_coord.
 */
function clampCoord(val: unknown): { val: number; ok: boolean } {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return { val: 0, ok: false };
  }
  if (val < -CLAMP_TOLERANCE || val > 1 + CLAMP_TOLERANCE) {
    return { val, ok: false };
  }
  return { val: Math.max(0, Math.min(1, val)), ok: true };
}

/**
 * Validate and repair a DiagramScene for sharing.
 * Cites: backend/app/validate.py and frontend/src/core/correct.ts.
 *
 * Rules:
 * - Coordinates within +/-0.02 of [0, 1] are clamped to [0, 1]; coordinates beyond are rejected.
 * - Segments with missing endpoints are dropped.
 * - Duplicate element IDs are de-duplicated (_2, _3, ...).
 * - Enforces caps: <=300 points, <=300 segments, <=2000 polyline points, <=60 bars, labels <=60.
 * - At least one drawable element is required.
 * - Unknown extra properties are dropped.
 */
export function validateShareScene(
  scene: unknown,
): { ok: true; scene: DiagramScene } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
    return { ok: false, errors: ['Scene must be a non-null object'] };
  }

  const raw = scene as Record<string, unknown>;

  // Check version (must be 1 if present)
  if (raw.version !== undefined && raw.version !== 1) {
    errors.push(`Unsupported scene version: ${String(raw.version)}`);
  }

  // Check kind
  const validKinds: SceneKind[] = ['geometry', 'function_graph', 'bar_chart', 'unknown'];
  if (typeof raw.kind !== 'string' || !validKinds.includes(raw.kind as SceneKind)) {
    errors.push(`Invalid scene kind: ${String(raw.kind)}`);
    return { ok: false, errors };
  }
  const kind = raw.kind as SceneKind;

  // Title
  const title =
    typeof raw.title === 'string'
      ? sanitizeString(raw.title, LIMITS.maxLabel)
      : raw.title === null
        ? null
        : undefined;

  // Caps checks
  if (Array.isArray(raw.points) && raw.points.length > LIMITS.maxPoints) {
    errors.push(`Points count ${raw.points.length} exceeds maximum ${LIMITS.maxPoints}`);
  }
  if (Array.isArray(raw.segments) && raw.segments.length > LIMITS.maxSegments) {
    errors.push(`Segments count ${raw.segments.length} exceeds maximum ${LIMITS.maxSegments}`);
  }
  if (Array.isArray(raw.bars) && raw.bars.length > LIMITS.maxBars) {
    errors.push(`Bars count ${raw.bars.length} exceeds maximum ${LIMITS.maxBars}`);
  }

  // Points processing
  const points: Point[] = [];
  if (Array.isArray(raw.points)) {
    for (const p of raw.points) {
      if (!p || typeof p !== 'object' || Array.isArray(p)) continue;
      const pObj = p as Record<string, unknown>;
      const id = typeof pObj.id === 'string' && pObj.id.trim() ? sanitizeString(pObj.id, 64) : '';
      if (!id) {
        errors.push('Point missing valid id');
        continue;
      }
      const xClamped = clampCoord(pObj.x);
      const yClamped = clampCoord(pObj.y);
      if (!xClamped.ok) {
        errors.push(`Point '${id}' x coordinate out of range [0, 1]: ${String(pObj.x)}`);
      }
      if (!yClamped.ok) {
        errors.push(`Point '${id}' y coordinate out of range [0, 1]: ${String(pObj.y)}`);
      }
      const label =
        typeof pObj.label === 'string'
          ? sanitizeString(pObj.label, LIMITS.maxLabel)
          : pObj.label === null
            ? null
            : undefined;

      const pt: Point = {
        id,
        x: xClamped.val,
        y: yClamped.val,
      };
      if (label !== undefined) {
        pt.label = label;
      }
      points.push(pt);
    }
  }

  // Segments processing
  const rawSegments: Segment[] = [];
  if (Array.isArray(raw.segments)) {
    for (const s of raw.segments) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) continue;
      const sObj = s as Record<string, unknown>;
      const id = typeof sObj.id === 'string' && sObj.id.trim() ? sanitizeString(sObj.id, 64) : '';
      const a = typeof sObj.a === 'string' ? sanitizeString(sObj.a, 64) : '';
      const b = typeof sObj.b === 'string' ? sanitizeString(sObj.b, 64) : '';
      if (!id || !a || !b) {
        continue;
      }
      const label =
        typeof sObj.label === 'string'
          ? sanitizeString(sObj.label, LIMITS.maxLabel)
          : sObj.label === null
            ? null
            : undefined;

      const seg: Segment = { id, a, b };
      if (label !== undefined) {
        seg.label = label;
      }
      rawSegments.push(seg);
    }
  }

  // Polylines processing
  let totalPolylinePoints = 0;
  const polylines: Polyline[] = [];
  if (Array.isArray(raw.polylines)) {
    for (const poly of raw.polylines) {
      if (!poly || typeof poly !== 'object' || Array.isArray(poly)) continue;
      const polyObj = poly as Record<string, unknown>;
      const id =
        typeof polyObj.id === 'string' && polyObj.id.trim()
          ? sanitizeString(polyObj.id, 64)
          : '';
      if (!id) continue;
      const rawPts = polyObj.points;
      if (!Array.isArray(rawPts) || rawPts.length < 2) {
        errors.push(`Polyline '${id}' must have at least 2 coordinate pairs`);
        continue;
      }
      totalPolylinePoints += rawPts.length;
      const pts: [number, number][] = [];
      for (const pt of rawPts) {
        if (Array.isArray(pt) && pt.length >= 2) {
          const xRes = clampCoord(pt[0]);
          const yRes = clampCoord(pt[1]);
          if (!xRes.ok || !yRes.ok) {
            errors.push(
              `Polyline '${id}' coordinate [${String(pt[0])}, ${String(pt[1])}] out of range [0, 1]`,
            );
          }
          pts.push([xRes.val, yRes.val]);
        } else if (pt && typeof pt === 'object' && 'x' in pt && 'y' in pt) {
          const ptObj = pt as Record<string, unknown>;
          const xRes = clampCoord(ptObj.x);
          const yRes = clampCoord(ptObj.y);
          if (!xRes.ok || !yRes.ok) {
            errors.push(
              `Polyline '${id}' coordinate [${String(ptObj.x)}, ${String(ptObj.y)}] out of range [0, 1]`,
            );
          }
          pts.push([xRes.val, yRes.val]);
        } else {
          errors.push(`Polyline '${id}' contains invalid point coordinate`);
        }
      }
      const label =
        typeof polyObj.label === 'string'
          ? sanitizeString(polyObj.label, LIMITS.maxLabel)
          : polyObj.label === null
            ? null
            : undefined;

      const polyline: Polyline = { id, points: pts };
      if (label !== undefined) {
        polyline.label = label;
      }
      polylines.push(polyline);
    }
  }

  if (totalPolylinePoints > LIMITS.maxPolylinePoints) {
    errors.push(
      `Total polyline points ${totalPolylinePoints} exceeds maximum ${LIMITS.maxPolylinePoints}`,
    );
  }

  // Bars processing
  const bars: Bar[] = [];
  if (Array.isArray(raw.bars)) {
    for (const b of raw.bars) {
      if (!b || typeof b !== 'object' || Array.isArray(b)) continue;
      const bObj = b as Record<string, unknown>;
      const id = typeof bObj.id === 'string' && bObj.id.trim() ? sanitizeString(bObj.id, 64) : '';
      if (!id) continue;
      const label =
        typeof bObj.label === 'string'
          ? sanitizeString(bObj.label, LIMITS.maxLabel)
          : '';
      const val =
        typeof bObj.value === 'number' && Number.isFinite(bObj.value) ? bObj.value : 0;
      const x0Res = clampCoord(bObj.x0);
      const x1Res = clampCoord(bObj.x1);
      const yTopRes = clampCoord(bObj.y_top);
      const yBaseRes = clampCoord(bObj.y_base);
      if (!x0Res.ok || !x1Res.ok || !yTopRes.ok || !yBaseRes.ok) {
        errors.push(`Bar '${id}' coordinates out of range [0, 1]`);
      }
      bars.push({
        id,
        label,
        value: val,
        x0: x0Res.val,
        x1: x1Res.val,
        y_top: yTopRes.val,
        y_base: yBaseRes.val,
      });
    }
  }

  // Axes processing
  let axes: Axes | null | undefined = undefined;
  if (raw.axes !== undefined && raw.axes !== null) {
    if (typeof raw.axes === 'object' && !Array.isArray(raw.axes)) {
      const axObj = raw.axes as Record<string, unknown>;
      let x_axis_y: number | null | undefined = undefined;
      let y_axis_x: number | null | undefined = undefined;
      if (axObj.x_axis_y !== undefined && axObj.x_axis_y !== null) {
        const res = clampCoord(axObj.x_axis_y);
        if (!res.ok) {
          errors.push(`Axes x_axis_y out of range [0, 1]: ${String(axObj.x_axis_y)}`);
        }
        x_axis_y = res.val;
      } else if (axObj.x_axis_y === null) {
        x_axis_y = null;
      }

      if (axObj.y_axis_x !== undefined && axObj.y_axis_x !== null) {
        const res = clampCoord(axObj.y_axis_x);
        if (!res.ok) {
          errors.push(`Axes y_axis_x out of range [0, 1]: ${String(axObj.y_axis_x)}`);
        }
        y_axis_x = res.val;
      } else if (axObj.y_axis_x === null) {
        y_axis_x = null;
      }
      axes = { x_axis_y, y_axis_x };
    } else {
      axes = null;
    }
  } else if (raw.axes === null) {
    axes = null;
  }

  // Facts processing
  let facts: string[] | undefined = undefined;
  if (Array.isArray(raw.facts)) {
    facts = raw.facts
      .filter((f): f is string => typeof f === 'string')
      .map((f) => sanitizeString(f, 280));
  }

  // Repair rule: drop dangling segments whose endpoints don't exist in points
  // Cites: backend/app/validate.py _drop_dangling_segments
  const pointIds = new Set(points.map((p) => p.id));
  const segments = rawSegments.filter(
    (s) => pointIds.has(s.a) && pointIds.has(s.b),
  );

  // Repair rule: de-duplicate IDs across points, segments, polylines, bars
  // Cites: backend/app/validate.py _dedupe_ids
  const seenIds = new Set<string>();
  for (const elem of [...points, ...segments, ...polylines, ...bars]) {
    if (seenIds.has(elem.id)) {
      const base = elem.id;
      let counter = 2;
      let newId = `${base}_${counter}`;
      while (seenIds.has(newId)) {
        counter++;
        newId = `${base}_${counter}`;
      }
      elem.id = newId;
      seenIds.add(newId);
    } else {
      seenIds.add(elem.id);
    }
  }

  // Rule: reject if zero drawable elements
  // Cites: backend/app/validate.py validate_scene
  if (
    points.length === 0 &&
    segments.length === 0 &&
    polylines.length === 0 &&
    bars.length === 0
  ) {
    errors.push('Scene has no drawable elements');
  }

  // Construct sanitized DiagramScene (unknown extra keys are dropped)
  const cleanedScene: DiagramScene = {
    version: 1,
    kind,
    points,
    segments,
    polylines,
    bars,
  };
  if (title !== undefined) {
    cleanedScene.title = title;
  }
  if (axes !== undefined) {
    cleanedScene.axes = axes;
  }
  if (facts !== undefined) {
    cleanedScene.facts = facts;
  }

  // Invariant verification using core/correct.ts
  const invariantCheck = validateSceneInvariants(cleanedScene);
  if (!invariantCheck.ok) {
    errors.push(...invariantCheck.errors);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, scene: cleanedScene };
}
