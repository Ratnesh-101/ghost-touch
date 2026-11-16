/**
 * Scene ingress guard (Requirement 35, task 61).
 *
 * One structural check for every scene that reaches Explore: "can the engine and the hit test
 * run on this without throwing or producing NaN". It is not `validateSceneInvariants` (that one
 * reports editing errors such as duplicate and reserved ids and tolerates missing arrays).
 *
 * Pure (tech.md rule 1): no DOM, React, i18n or browser API; only a scene type import. Plain
 * loops, no allocation per element beyond one id set, no recursion. Total: one try/catch turns
 * even a hostile object (a throwing getter or Proxy) into `false`.
 */

import type { DiagramScene } from './scene';

/** Mirrors `MAX_SCENE_*`, `MAX_POLYLINE_POINTS` and `MAX_TEXT_CHARS` in backend/app/validate.py. */
export const SCENE_GUARD_LIMITS = {
  points: 500,
  segments: 1000,
  polylines: 50,
  polylinePoints: 1000,
  bars: 100,
  facts: 100,
  text: 300,
  aspectMin: 0.05,
  aspectMax: 20,
} as const;

const KINDS = ['geometry', 'function_graph', 'bar_chart', 'unknown'];

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function unit(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

function text(v: unknown): boolean {
  return typeof v === 'string' && v.length <= SCENE_GUARD_LIMITS.text;
}

function optText(v: unknown): boolean {
  return v === undefined || v === null || text(v);
}

function id(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function check(s: Record<string, unknown>): boolean {
  const L = SCENE_GUARD_LIMITS;
  if (typeof s.kind !== 'string' || !KINDS.includes(s.kind)) return false;

  const { points, segments, polylines, bars } = s;
  if (!Array.isArray(points) || points.length > L.points) return false;
  if (!Array.isArray(segments) || segments.length > L.segments) return false;
  if (!Array.isArray(polylines) || polylines.length > L.polylines) return false;
  if (!Array.isArray(bars) || bars.length > L.bars) return false;

  if (s.facts !== undefined) {
    const facts = s.facts;
    if (!Array.isArray(facts) || facts.length > L.facts) return false;
    for (let i = 0; i < facts.length; i++) if (!text(facts[i])) return false;
  }

  if (s.aspect !== undefined) {
    const a = s.aspect;
    if (typeof a !== 'number' || !Number.isFinite(a) || a < L.aspectMin || a > L.aspectMax) {
      return false;
    }
  }
  if (!optText(s.title)) return false;

  const pointIds = new Set<string>();
  for (let i = 0; i < points.length; i++) {
    const p: unknown = points[i];
    if (!isObject(p) || !id(p.id) || !unit(p.x) || !unit(p.y) || !optText(p.label)) return false;
    pointIds.add(p.id);
  }

  for (let i = 0; i < segments.length; i++) {
    const g: unknown = segments[i];
    if (!isObject(g) || !id(g.id) || !optText(g.label)) return false;
    if (!id(g.a) || !id(g.b) || !pointIds.has(g.a) || !pointIds.has(g.b)) return false;
  }

  for (let i = 0; i < polylines.length; i++) {
    const pl: unknown = polylines[i];
    if (!isObject(pl) || !id(pl.id) || !optText(pl.label)) return false;
    const pts = pl.points;
    if (!Array.isArray(pts) || pts.length > L.polylinePoints) return false;
    for (let j = 0; j < pts.length; j++) {
      const q: unknown = pts[j];
      if (!Array.isArray(q) || q.length !== 2 || !unit(q[0]) || !unit(q[1])) return false;
    }
  }

  for (let i = 0; i < bars.length; i++) {
    const b: unknown = bars[i];
    if (!isObject(b) || !id(b.id) || !text(b.label)) return false;
    if (typeof b.value !== 'number' || !Number.isFinite(b.value)) return false;
    if (!unit(b.x0) || !unit(b.x1) || !unit(b.y_top) || !unit(b.y_base)) return false;
  }

  const axes = s.axes;
  if (axes !== undefined && axes !== null) {
    if (!isObject(axes)) return false;
    for (const v of [axes.x_axis_y, axes.y_axis_x]) {
      if (v !== undefined && v !== null && !unit(v)) return false;
    }
  }
  return true;
}

/** True when `value` is a scene the engine and hit test can run on. Never throws. */
export function isRenderableScene(value: unknown): value is DiagramScene {
  try {
    return isObject(value) && check(value);
  } catch {
    return false;
  }
}
