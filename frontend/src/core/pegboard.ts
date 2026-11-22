/**
 * Ghost Hand pegboard (Requirement 52, task 86): the pure half of "a blind student plots her own
 * graph".
 *
 * The draft is an ordinary `DiagramScene` on a FIXED grid: whole-number crossings x 0 to 6 and
 * y 0 to 8 (63 crossings), mapped onto the unit square with no margin. A pin is a point exactly on
 * a crossing. `pin` refuses an occupied crossing BEFORE it calls `addPoint`, because `addPoint`
 * would nudge the new point off the crossing (Requirement 23.6). `stitchInOrder` joins neighbours
 * in x order with `addSegment`, segments only, never a polyline.
 *
 * Pure (tech.md rule 1): no DOM, React, i18n or browser API. Wording is the lane's: this module
 * holds i18n KEYS and parameters, and the only text it builds is the coordinate label
 * `x 2 y 5` (digits only; no brackets, commas or equals signs, because Android text-to-speech
 * may read them aloud). Total: junk input gives a refusal or an empty answer, never a throw.
 */

import { addPoint, addSegment, COINCIDENT_EPSILON } from './correct';
import type { DiagramScene } from './scene';

export const GRID_MAX_X = 6;
export const GRID_MAX_Y = 8;
/** The one fact line a draft carries. It starts with `Grid:` so it is never read as a fact. */
export const GRID_FACT = 'Grid: x 0 to 6, y 0 to 8';
/** Twice the 22 px vertex radius (`DEFAULT_RADII.vertex`): two pins' vertex areas never overlap. */
export const MIN_PIN_SPACING_PX = 44;

export interface Crossing {
  gx: number;
  gy: number;
}

export interface PinEntry {
  id: string;
  label: string;
  gx: number;
  gy: number;
}

export type PinResult =
  | { kind: 'pinned'; scene: DiagramScene; id: string; label: string; crossing: Crossing }
  | { kind: 'occupied'; scene: DiagramScene; id: string }
  | { kind: 'badInput'; scene: DiagramScene };

export const BUILD_WORK_KEYS = [
  'build.work.empty',
  'build.work.count',
  'build.work.pin',
  'build.work.stitched',
] as const;
export type BuildWorkKey = (typeof BUILD_WORK_KEYS)[number];

export interface WorkLine {
  key: BuildWorkKey;
  params: Record<string, string | number>;
}

export interface WorkSummary {
  pinCount: number;
  segmentCount: number;
  pins: PinEntry[];
  lines: WorkLine[];
}

const GRID_FACT_LINE = /^\s*grid\s*:/i;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** An object whose element lists are arrays of objects, or absent (`addPoint` reads every element's id). */
function usable(scene: unknown): scene is DiagramScene {
  if (!isObj(scene)) return false;
  for (const key of ['points', 'segments', 'polylines', 'bars']) {
    const v = scene[key];
    if (v === undefined) continue;
    if (!Array.isArray(v)) return false;
    for (const item of v) if (!isObj(item)) return false;
  }
  return true;
}

function listOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** -0 becomes 0, so a crossing never carries a negative zero. */
function plain(n: number): number {
  return n + 0;
}

/** Whole-number crossing nearest to (gx, gy), clamped to the grid; `null` unless both are finite. */
export function snapCrossing(gx: number, gy: number): Crossing | null {
  if (typeof gx !== 'number' || typeof gy !== 'number') return null;
  if (!Number.isFinite(gx) || !Number.isFinite(gy)) return null;
  return {
    gx: plain(Math.min(GRID_MAX_X, Math.max(0, Math.round(gx)))),
    gy: plain(Math.min(GRID_MAX_Y, Math.max(0, Math.round(gy)))),
  };
}

/** Normalized position of a crossing: x = gx / 6, y = 1 - gy / 8 (y = 0 is the top). */
export function gridToNorm(c: Crossing): { x: number; y: number } {
  return { x: c.gx / GRID_MAX_X, y: 1 - c.gy / GRID_MAX_Y };
}

/** Crossing nearest to a normalized position, clamped to the grid; `null` unless both are finite. */
export function snapNorm(x: number, y: number): Crossing | null {
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  // Far outside the square the answer is a corner anyway; clamping first keeps the products finite.
  const cx = Math.min(2, Math.max(-1, x));
  const cy = Math.min(2, Math.max(-1, y));
  return snapCrossing(cx * GRID_MAX_X, (1 - cy) * GRID_MAX_Y);
}

/** The spoken form of a crossing: `x 2 y 5`. */
export function pinLabel(c: Crossing): string {
  return `x ${c.gx} y ${c.gy}`;
}

/** A fresh, empty draft (Requirement 52.2). */
export function emptyDraft(): DiagramScene {
  return {
    version: 1,
    kind: 'geometry',
    points: [],
    segments: [],
    polylines: [],
    bars: [],
    axes: { x_axis_y: 1, y_axis_x: 0 },
    facts: [GRID_FACT],
  };
}

/** True when the scene carries the grid fact line, which marks it as a student's own draft. */
export function isDraft(scene: unknown): boolean {
  if (!isObj(scene)) return false;
  return listOf(scene.facts).some((f) => typeof f === 'string' && GRID_FACT_LINE.test(f));
}

/** Points that sit on a crossing, in stitch order: x ascending, then gy ascending, then id. */
export function pinsOf(scene: unknown): PinEntry[] {
  if (!isObj(scene)) return [];
  const out: PinEntry[] = [];
  for (const p of listOf(scene.points)) {
    if (!isObj(p) || typeof p.id !== 'string') continue;
    const px = p.x;
    const py = p.y;
    if (typeof px !== 'number' || typeof py !== 'number') continue;
    const c = snapNorm(px, py);
    if (c === null) continue;
    const at = gridToNorm(c);
    if (Math.abs(at.x - px) > COINCIDENT_EPSILON || Math.abs(at.y - py) > COINCIDENT_EPSILON) continue;
    out.push({ id: p.id, label: pinLabel(c), gx: c.gx, gy: c.gy });
  }
  out.sort((a, b) => a.gx - b.gx || a.gy - b.gy || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/** Pin the crossing nearest (gx, gy), or say why not (Requirement 52.4). Never nudges. */
export function pin(scene: DiagramScene, gx: number, gy: number): PinResult {
  if (!usable(scene)) return { kind: 'badInput', scene };
  const c = snapCrossing(gx, gy);
  if (c === null) return { kind: 'badInput', scene };
  const at = gridToNorm(c);
  // Same test `addPoint` uses to decide to nudge, so it is never asked to.
  for (const p of listOf(scene.points)) {
    if (!isObj(p)) continue;
    const dx = Math.abs((p.x as number) - at.x);
    const dy = Math.abs((p.y as number) - at.y);
    if (dx <= COINCIDENT_EPSILON && dy <= COINCIDENT_EPSILON) {
      return { kind: 'occupied', scene, id: String(p.id) };
    }
  }
  const label = pinLabel(c);
  const next = addPoint(scene, at.x, at.y, label);
  const added = listOf(next.points).at(-1);
  if (next === scene || !isObj(added) || typeof added.id !== 'string') {
    return { kind: 'badInput', scene };
  }
  return { kind: 'pinned', scene: next, id: added.id, label, crossing: c };
}

/**
 * Make the segments the chain that joins each pin to the next in stitch order (Requirement 52.7).
 * Segments only. Rebuilt from nothing, so the answer depends on the pin set alone. Returns the
 * same scene when the segments already are that chain.
 */
export function stitchInOrder(scene: DiagramScene): DiagramScene {
  if (!usable(scene)) return scene;
  const pins = pinsOf(scene);
  let next: DiagramScene = { ...scene, segments: [] };
  for (let i = 0; i + 1 < pins.length; i++) {
    const a = pins[i];
    const b = pins[i + 1];
    if (a === undefined || b === undefined) continue;
    next = addSegment(next, a.id, b.id);
  }
  const before = listOf(scene.segments);
  const after = listOf(next.segments);
  if (before.length === after.length) {
    let same = true;
    for (let i = 0; i < before.length && same; i++) {
      const a = before[i];
      const b = after[i];
      same = isObj(a) && isObj(b) && a.id === b.id && a.a === b.a && a.b === b.b;
    }
    if (same) return scene;
  }
  return next;
}

/** Feel needs something drawn: the share validator rejects an empty scene (Requirement 52.8). */
export function canFeel(scene: unknown): boolean {
  return pinsOf(scene).length >= 1;
}

/** Hand in needs the same: at least one pin. */
export function canHandIn(scene: unknown): boolean {
  return pinsOf(scene).length >= 1;
}

/** What the student hears about her work, as keys and parameters (Requirement 52.13). */
export function describeWork(scene: unknown): WorkSummary {
  const pins = pinsOf(scene);
  const segmentCount = isObj(scene) ? listOf(scene.segments).length : 0;
  const lines: WorkLine[] = [];
  if (pins.length === 0) {
    lines.push({ key: 'build.work.empty', params: {} });
  } else {
    lines.push({ key: 'build.work.count', params: { count: pins.length } });
    for (const p of pins) {
      lines.push({ key: 'build.work.pin', params: { id: p.id, label: p.label, x: p.gx, y: p.gy } });
    }
    if (segmentCount > 0) lines.push({ key: 'build.work.stitched', params: { count: segmentCount } });
  }
  return { pinCount: pins.length, segmentCount, pins, lines };
}

/** The text list of the hand-in: one entry per pin, in stitch order (Requirement 52.14). */
export function handInList(scene: unknown): PinEntry[] {
  return pinsOf(scene);
}

/** Smallest distance between two crossings on a canvas whose unit square has side `scalePx`. */
export function pinSpacingPx(scalePx: number): number {
  if (typeof scalePx !== 'number' || !Number.isFinite(scalePx) || scalePx <= 0) return 0;
  return scalePx / GRID_MAX_Y;
}

/** True when pins are at least `MIN_PIN_SPACING_PX` apart (scale 352 or more). */
export function pinSpacingOk(scalePx: number): boolean {
  return pinSpacingPx(scalePx) >= MIN_PIN_SPACING_PX;
}
