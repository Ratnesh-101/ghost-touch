/**
 * Planchette: a guided "Walk me through" built from templates (Requirement 51, task 85).
 *
 * A walk leads a finger through the reasoning behind a number on a diagram: find this part, hear
 * what it is, find the next part. Every number it speaks comes from the scene (a printed length, a
 * bar value, or arithmetic on those), every part it names is a real element a finger can reach, and
 * it never uses its own conclusion as a premise. No AI, no backend, no new vibration, tone or earcon.
 *
 * Pure core (tech.md rule 1): no DOM, React, browser API, i18n or `guide/` import. The core holds
 * i18n KEYS and parameters, never wording. Every function is total: junk input gives `null`, `false`
 * or an unchanged state, never an exception, and no input is mutated.
 */

import type { ScreenPoint, Viewport } from './geometry';
import type { Target } from './hitTest';
import type { Bar, DiagramScene, Point, Segment } from './scene';
import { isRenderableScene } from './sceneGuard';
import { speakableName } from './speakable';
import { parseFacts, verifyScene } from './verify';
import type { ParsedFactsResult } from './verify';
import { anchorPoint, isAnchorReachable, spotReached } from './walkAnchor';
import type { SpotAnchor } from './walkAnchor';

// ---------------------------------------------------------------------------------------------
// Constants (none is a haptic value)
// ---------------------------------------------------------------------------------------------

/** Most steps in one walk (Your turn is not counted). */
export const WALK_MAX_STEPS = 6;
/** Rest on one wrong element that counts as a wrong try, in ms. PROPOSED. */
export const WALK_TRY_DWELL_MS = 500;
/** Wrong tries after which the answer is spoken. */
export const WALK_TURN_MISSES = 2;
/** A walk with no activity for this long ends silently, in ms. PROPOSED. */
export const WALK_IDLE_MS = 120_000;

/** Length units a walk can speak (Requirement 18.7). */
export const WALK_UNITS = ['mm', 'cm', 'm', 'km', 'in', 'ft'] as const;

/** A right angle in the drawing counts within this many degrees of 90 (the Spec Ghost angle tolerance). */
const RIGHT_ANGLE_DRAWN_TOLERANCE_DEG = 8;
/** A right angle in a fact counts within this many degrees of 90. */
const RIGHT_ANGLE_FACT_TOLERANCE_DEG = 0.5;

/** Every i18n key the walk can ask for. The lane words them in en, hi and gu. */
export const WALK_KEYS = [
  'walk.start',
  'walk.next',
  'walk.intro',
  'walk.stopped',
  'walk.done',
  'walk.find.segment',
  'walk.find.vertex',
  'walk.find.bar',
  'walk.find.spot.origin',
  'walk.find.spot.peak',
  'walk.find.spot.trough',
  'walk.pyth.leg',
  'walk.pyth.rightFact',
  'walk.pyth.rightDrawn',
  'walk.pyth.hyp',
  'walk.bar.high',
  'walk.bar.diff',
  'walk.longest.side',
  'walk.curve.origin',
  'walk.curve.peak',
  'walk.curve.trough',
  'walk.turn.prompt.hyp',
  'walk.turn.prompt.bar',
  'walk.turn.prompt.longest',
  'walk.turn.answer',
  'walk.turn.right',
  'walk.unit.mm',
  'walk.unit.cm',
  'walk.unit.m',
  'walk.unit.km',
  'walk.unit.in',
  'walk.unit.ft',
] as const;

export type WalkKey = (typeof WALK_KEYS)[number];

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export type WalkAnchor =
  | { kind: 'vertex'; id: string }
  | { kind: 'segment'; id: string }
  | { kind: 'bar'; id: string }
  | { kind: 'spot'; spot: SpotAnchor };

export type WalkParams = Record<string, string | number>;

/** One spoken line: an i18n key and its parameters. */
export interface WalkLine {
  key: WalkKey;
  params: WalkParams;
}

export type NumberSource =
  | { kind: 'fact'; fact: string; elementId: string }
  | { kind: 'bar'; barId: string }
  | { kind: 'calc'; op: 'square' | 'sum' | 'sqrt' | 'difference'; of: string[] };

/** A number the walk speaks, with where it comes from. */
export interface WalkNumber {
  /** Unique within the walk; a calculation or a later step refers to it by this name. */
  name: string;
  /** The parameter of this step's `say` line it fills, when that is not `name`. */
  param?: string;
  value: number;
  source: NumberSource;
}

export interface WalkStep {
  find: WalkLine;
  say: WalkLine;
  anchor: WalkAnchor;
  numbers: WalkNumber[];
}

export interface WalkTurn {
  prompt: WalkLine;
  /** The element's name, spoken as the answer after two wrong tries. */
  name: string;
  anchor: WalkAnchor;
}

export type WalkKind = 'pythagoras' | 'barDifference' | 'longestSide' | 'curveShape';

export interface Walk {
  kind: WalkKind;
  steps: WalkStep[];
  turn?: WalkTurn;
  /** What the walk derives: no premise may be a fact about `elementId`. */
  conclusion?: { numberName: string; elementId?: string };
}

export type WalkReason = 'scene' | 'shape' | 'key' | 'anchor' | 'unreachable' | 'selfPremise' | 'number' | 'name';
export type WalkValidation = { ok: true } | { ok: false; reason: WalkReason };

export type WalkEffect = { kind: 'speak'; line: WalkLine } | { kind: 'guideTo'; anchor: WalkAnchor };

export type WalkState =
  | { phase: 'idle' }
  | { phase: 'find'; walk: Walk; index: number; lastActivity: number }
  | { phase: 'said'; walk: Walk; index: number; lastActivity: number }
  | {
      phase: 'turn';
      walk: Walk;
      misses: number;
      revealed: boolean;
      wrongKey: string | null;
      wrongSince: number;
      counted: boolean;
      lastActivity: number;
    }
  | { phase: 'done'; walk: Walk; lastActivity: number };

export type WalkInput =
  | { kind: 'touch'; t: number; target: Target; finger: ScreenPoint; view: Viewport }
  | { kind: 'next'; t: number }
  | { kind: 'repeat'; t: number }
  | { kind: 'guideMe'; t: number }
  | { kind: 'tick'; t: number }
  | { kind: 'stop'; silent?: boolean };

export interface WalkPhrases {
  start: readonly string[];
  next: readonly string[];
}

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

const KEY_SET: ReadonlySet<string> = new Set<string>(WALK_KEYS);
const UNIT_SET: ReadonlySet<string> = new Set<string>(WALK_UNITS);

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

function round2(v: number): number {
  return Math.round(v * 100) / 100 + 0;
}

const norm = (s: string): string => s.trim().toLowerCase();

function line(key: WalkKey, params: WalkParams = {}): WalkLine {
  return { key, params };
}

function speak(l: WalkLine): WalkEffect {
  return { kind: 'speak', line: { key: l.key, params: { ...l.params } } };
}

function cloneAnchor(a: WalkAnchor): WalkAnchor {
  if (a.kind === 'spot') return { kind: 'spot', spot: { ...a.spot, acceptIds: [...a.spot.acceptIds] } };
  return { kind: a.kind, id: a.id };
}

function pointMap(scene: DiagramScene): Map<string, Point> {
  const m = new Map<string, Point>();
  for (const p of scene.points ?? []) if (!m.has(p.id)) m.set(p.id, p);
  return m;
}

function evalCalc(op: string, xs: number[]): number | null {
  if (xs.some((x) => typeof x !== 'number' || !Number.isFinite(x))) return null;
  if (op === 'square' && xs.length === 1) return round2(xs[0]! * xs[0]!);
  if (op === 'sum' && xs.length >= 1) return round2(xs.reduce((s, v) => s + v, 0));
  if (op === 'sqrt' && xs.length === 1 && xs[0]! >= 0) return round2(Math.sqrt(xs[0]!));
  if (op === 'difference' && xs.length === 2) return round2(xs[0]! - xs[1]!);
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------------------------
// Names and lengths
// ---------------------------------------------------------------------------------------------

function pointName(p: Point | undefined): string | null {
  return p === undefined ? null : speakableName(p.label ?? undefined, p.id);
}

/** A segment's spoken name: its label or speakable id, else its two end names joined. */
function segmentName(seg: Segment, pts: Map<string, Point>): string | null {
  const own = speakableName(seg.label ?? undefined, seg.id);
  if (own !== null) return own;
  const a = pointName(pts.get(seg.a));
  const b = pointName(pts.get(seg.b));
  return a !== null && b !== null ? `${a}${b}` : null;
}

/** Lower-case names a printed fact may use for a segment: id, label, and its ends in either order. */
function segmentTargets(seg: Segment, pts: Map<string, Point>): Set<string> {
  const out = new Set<string>();
  const add = (s: string | null | undefined): void => {
    if (typeof s === 'string' && s.trim() !== '') out.add(norm(s));
  };
  add(seg.id);
  add(seg.label);
  const pa = pts.get(seg.a);
  const pb = pts.get(seg.b);
  add(seg.a + seg.b);
  add(seg.b + seg.a);
  if (pa && pb) {
    add((pa.label ?? '') + (pb.label ?? ''));
    add((pb.label ?? '') + (pa.label ?? ''));
  }
  return out;
}

function segmentsForTarget(scene: DiagramScene, pts: Map<string, Point>, target: string, reversed?: string): Segment[] {
  const t = norm(target);
  const r = reversed === undefined ? null : norm(reversed);
  return (scene.segments ?? []).filter((s) => {
    const names = segmentTargets(s, pts);
    return names.has(t) || (r !== null && names.has(r));
  });
}

interface Length {
  value: number;
  /** '' for none, else one of WALK_UNITS. */
  unit: string;
  fact: string;
  elementId: string;
}

function unitOf(u: string | undefined): string | null {
  if (u === undefined || u === '') return '';
  const l = u.toLowerCase();
  return UNIT_SET.has(l) ? l : null;
}

/**
 * The one printed length for a segment, or null: no fact, a fact that fits another segment too, two
 * facts that disagree, or a unit that is not a known one.
 */
function lengthOf(scene: DiagramScene, pts: Map<string, Point>, seg: Segment, pf: ParsedFactsResult): Length | null {
  let found: Length | null = null;
  for (const f of pf.lengths) {
    const fits = segmentsForTarget(scene, pts, f.target, f.reversedTarget);
    if (fits.length !== 1 || fits[0]!.id !== seg.id) continue;
    const unit = unitOf(f.unit);
    if (unit === null || !Number.isFinite(f.value) || !(f.value > 0)) return null;
    const here: Length = { value: f.value, unit, fact: f.raw, elementId: seg.id };
    if (found !== null && (found.value !== here.value || found.unit !== here.unit)) return null;
    found ??= here;
  }
  return found;
}

function sceneAspect(scene: DiagramScene): number {
  const a = scene.aspect;
  return typeof a === 'number' && Number.isFinite(a) && a > 0 ? a : 1;
}

// ---------------------------------------------------------------------------------------------
// Anchors
// ---------------------------------------------------------------------------------------------

/**
 * The finger has reached the anchor: the same `hitTest` target the engine got is that element
 * (a segment is a `line` of element kind `segment`, a bar is a `bar` or one of its edges), or, for a
 * spot, the finger is on its element and within 22 px of the spot.
 */
export function anchorReached(anchor: WalkAnchor, target: Target, finger: ScreenPoint, view: Viewport): boolean {
  try {
    if (!isObj(anchor) || !isObj(target)) return false;
    switch (anchor.kind) {
      case 'vertex':
        return target.kind === 'vertex' && target.id === anchor.id;
      case 'segment':
        return target.kind === 'line' && target.elementKind === 'segment' && target.id === anchor.id;
      case 'bar':
        return (
          (target.kind === 'bar' && target.id === anchor.id) ||
          (target.kind === 'line' && target.elementKind === 'bar-edge' && target.id === anchor.id)
        );
      case 'spot':
        return spotReached(anchor.spot, target, finger, view);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

function anchorExists(scene: DiagramScene, a: unknown): { ok: true } | { ok: false; reason: 'anchor' | 'unreachable' } {
  if (!isObj(a)) return { ok: false, reason: 'anchor' };
  const pts = pointMap(scene);
  if (a.kind === 'vertex') {
    return typeof a.id === 'string' && pts.has(a.id) ? { ok: true } : { ok: false, reason: 'anchor' };
  }
  if (a.kind === 'segment') {
    const seg = (scene.segments ?? []).find((s) => s.id === a.id);
    return seg !== undefined && pts.has(seg.a) && pts.has(seg.b) && seg.a !== seg.b
      ? { ok: true }
      : { ok: false, reason: 'anchor' };
  }
  if (a.kind === 'bar') {
    return (scene.bars ?? []).some((b) => b.id === a.id) ? { ok: true } : { ok: false, reason: 'anchor' };
  }
  if (a.kind === 'spot' && isObj(a.spot)) {
    const s = a.spot as unknown as SpotAnchor;
    const real = anchorPoint(scene, s.name);
    if (real === null || JSON.stringify(real) !== JSON.stringify(s)) return { ok: false, reason: 'anchor' };
    return isAnchorReachable(scene, real) ? { ok: true } : { ok: false, reason: 'unreachable' };
  }
  return { ok: false, reason: 'anchor' };
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

/** Every name a line may speak: labels, speakable ids, and a segment's ends joined. */
function nameSet(scene: DiagramScene): Set<string> {
  const pts = pointMap(scene);
  const out = new Set<string>();
  const add = (s: string | null): void => {
    if (s !== null) out.add(s);
  };
  for (const p of scene.points ?? []) add(pointName(p));
  for (const s of scene.segments ?? []) {
    add(segmentName(s, pts));
    const a = pointName(pts.get(s.a));
    const b = pointName(pts.get(s.b));
    if (a !== null && b !== null) {
      out.add(`${a}${b}`);
      out.add(`${b}${a}`);
    }
  }
  for (const b of scene.bars ?? []) add(speakableName(b.label, b.id));
  return out;
}

function checkLine(l: unknown, allowNumbers: boolean): WalkReason | null {
  if (!isObj(l) || typeof l.key !== 'string' || !isObj(l.params)) return 'shape';
  if (!KEY_SET.has(l.key)) return 'key';
  for (const v of Object.values(l.params)) {
    if (typeof v === 'string') continue;
    if (typeof v === 'number' && Number.isFinite(v)) {
      if (!allowNumbers) return 'number';
      continue;
    }
    return 'shape';
  }
  return null;
}

/**
 * Refuse a walk the scene does not support: anchors that are not scene elements (or spots the finger
 * cannot reach), numbers that are not derivable from the printed facts and bar values, a premise that
 * is a fact about the element the walk derives, names that cannot be spoken, keys outside `WALK_KEYS`.
 */
export function validateWalk(scene: unknown, walk: unknown): WalkValidation {
  try {
    if (!isRenderableScene(scene)) return { ok: false, reason: 'scene' };
    if (!isObj(walk) || !Array.isArray(walk.steps)) return { ok: false, reason: 'shape' };
    const steps = walk.steps as unknown[];
    if (steps.length < 1 || steps.length > WALK_MAX_STEPS) return { ok: false, reason: 'shape' };
    if (!['pythagoras', 'barDifference', 'longestSide', 'curveShape'].includes(String(walk.kind))) {
      return { ok: false, reason: 'shape' };
    }

    // lines and shapes
    for (const raw of steps) {
      if (!isObj(raw) || !Array.isArray(raw.numbers)) return { ok: false, reason: 'shape' };
      const bad = checkLine(raw.find, false) ?? checkLine(raw.say, true);
      if (bad !== null) return { ok: false, reason: bad };
    }
    const turn = walk.turn;
    if (turn !== undefined) {
      if (!isObj(turn) || typeof turn.name !== 'string') return { ok: false, reason: 'shape' };
      const bad = checkLine(turn.prompt, false);
      if (bad !== null) return { ok: false, reason: bad };
    }

    // anchors
    const anchors: unknown[] = steps.map((s) => (s as Record<string, unknown>).anchor);
    if (turn !== undefined) anchors.push((turn as Record<string, unknown>).anchor);
    for (const a of anchors) {
      const r = anchorExists(scene, a);
      if (!r.ok) return r;
    }

    // premises: nothing may be a fact about the element the walk derives
    const conclusion = isObj(walk.conclusion) ? walk.conclusion : undefined;
    const all: Array<{ n: WalkNumber; step: number }> = [];
    steps.forEach((raw, si) => {
      for (const n of (raw as { numbers: WalkNumber[] }).numbers) all.push({ n, step: si });
    });
    if (conclusion !== undefined && typeof conclusion.elementId === 'string') {
      for (const { n } of all) {
        if (isObj(n) && isObj(n.source) && n.source.kind === 'fact' && n.source.elementId === conclusion.elementId) {
          return { ok: false, reason: 'selfPremise' };
        }
      }
    }

    // numbers
    const pts = pointMap(scene);
    const seen = new Map<string, number>();
    for (const { n } of all) {
      if (!isObj(n) || typeof n.name !== 'string' || n.name === '' || seen.has(n.name)) return { ok: false, reason: 'number' };
      if (typeof n.value !== 'number' || !Number.isFinite(n.value) || !isObj(n.source)) return { ok: false, reason: 'number' };
      const src = n.source as unknown as NumberSource;
      if (src.kind === 'fact') {
        const fact = typeof src.fact === 'string' ? src.fact.trim() : '';
        if (fact === '' || !(scene.facts ?? []).some((f) => typeof f === 'string' && f.trim() === fact)) {
          return { ok: false, reason: 'number' };
        }
        const parsed = parseFacts([fact], scene).lengths[0];
        if (parsed === undefined || parsed.value !== n.value) return { ok: false, reason: 'number' };
        const fits = segmentsForTarget(scene, pts, parsed.target, parsed.reversedTarget);
        if (fits.length !== 1 || fits[0]!.id !== src.elementId) return { ok: false, reason: 'number' };
      } else if (src.kind === 'bar') {
        const bar = (scene.bars ?? []).find((b: Bar) => b.id === src.barId);
        if (bar === undefined || round2(bar.value) !== n.value) return { ok: false, reason: 'number' };
      } else if (src.kind === 'calc') {
        if (!Array.isArray(src.of)) return { ok: false, reason: 'number' };
        const inputs = src.of.map((k) => (typeof k === 'string' && seen.has(k) ? seen.get(k)! : Number.NaN));
        const result = evalCalc(String(src.op), inputs);
        if (result === null || result !== n.value) return { ok: false, reason: 'number' };
      } else return { ok: false, reason: 'number' };
      seen.set(n.name, n.value);
    }
    if (conclusion !== undefined && (typeof conclusion.numberName !== 'string' || !seen.has(conclusion.numberName))) {
      return { ok: false, reason: 'shape' };
    }

    // every number a sentence speaks has a source
    for (let si = 0; si < steps.length; si++) {
      const say = (steps[si] as { say: WalkLine }).say;
      for (const [p, v] of Object.entries(say.params)) {
        if (typeof v !== 'number') continue;
        const ok = all.some(({ n, step }) => n.value === v && ((n.name === p && step <= si) || (n.param === p && step === si)));
        if (!ok) return { ok: false, reason: 'number' };
      }
    }

    // names and units
    const names = nameSet(scene);
    const lines: WalkLine[] = steps.flatMap((s) => [(s as WalkStep).find, (s as WalkStep).say]);
    if (turn !== undefined) lines.push((turn as unknown as WalkTurn).prompt);
    for (const l of lines) {
      for (const [p, v] of Object.entries(l.params)) {
        if (typeof v !== 'string') continue;
        if (p === 'unit') {
          if (v !== '' && !UNIT_SET.has(v)) return { ok: false, reason: 'name' };
        } else if (!names.has(v)) return { ok: false, reason: 'name' };
      }
    }
    if (turn !== undefined && !names.has((turn as unknown as WalkTurn).name)) return { ok: false, reason: 'name' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'shape' };
  }
}

// ---------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------

function unitParam(unit: string): string {
  return unit;
}

function angleBetween(v: Point, p: Point, q: Point, aspect: number): number | null {
  const ux = (p.x - v.x) * aspect;
  const uy = p.y - v.y;
  const wx = (q.x - v.x) * aspect;
  const wy = q.y - v.y;
  const lu = Math.hypot(ux, uy);
  const lw = Math.hypot(wx, wy);
  if (!(lu > 0) || !(lw > 0)) return null;
  const c = Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (lu * lw)));
  return (Math.acos(c) * 180) / Math.PI;
}

/** 'conflict': the scene has a right triangle whose printed hypotenuse contradicts its legs, so no walk of any kind. */
function pythagoras(scene: DiagramScene, pf: ParsedFactsResult): Walk | null | 'conflict' {
  const pts = pointMap(scene);
  const segs = scene.segments ?? [];
  const aspect = sceneAspect(scene);
  for (const v of pts.values()) {
    // exactly two sides meet at v, to two different points
    const incident = segs.filter((s) => (s.a === v.id && s.b !== v.id) || (s.b === v.id && s.a !== v.id));
    if (incident.length !== 2) continue;
    const ends = incident.map((s) => (s.a === v.id ? s.b : s.a));
    if (ends[0] === ends[1]) continue;
    const p = pts.get(ends[0]!);
    const q = pts.get(ends[1]!);
    if (!p || !q) continue;
    const [s1, s2] = incident as [Segment, Segment];
    const h = segs.find((s) => (s.a === p.id && s.b === q.id) || (s.a === q.id && s.b === p.id));
    if (!h || h.id === s1.id || h.id === s2.id) continue;

    // the right angle: a fact, else (when the figure is to scale) the drawing
    const vNames = new Set([norm(v.id), ...(v.label ? [norm(v.label)] : [])]);
    const stated = pf.angles.filter((a) => vNames.has(norm(a.vertex)));
    let right: 'fact' | 'drawing' | null = null;
    if (stated.length > 0) {
      right = stated.every((a) => Math.abs(a.value - 90) <= RIGHT_ANGLE_FACT_TOLERANCE_DEG) ? 'fact' : null;
    } else if (!pf.hasNotToScale) {
      const deg = angleBetween(v, p, q, aspect);
      right = deg !== null && Math.abs(deg - 90) <= RIGHT_ANGLE_DRAWN_TOLERANCE_DEG ? 'drawing' : null;
    }
    if (right === null) continue;

    const l1 = lengthOf(scene, pts, s1, pf);
    const l2 = lengthOf(scene, pts, s2, pf);
    if (l1 === null || l2 === null || l1.unit !== l2.unit) continue;
    const n1 = segmentName(s1, pts);
    const n2 = segmentName(s2, pts);
    const nh = segmentName(h, pts);
    const nv = pointName(v);
    if (n1 === null || n2 === null || nh === null || nv === null) continue;

    const a = l1.value;
    const b = l2.value;
    const aSq = round2(a * a);
    const bSq = round2(b * b);
    const sum = round2(aSq + bSq);
    const c = round2(Math.sqrt(sum));
    if (![aSq, bSq, sum, c].every((x) => Number.isFinite(x) && x > 0)) continue;

    // a printed hypotenuse is never a premise; if it is there it must agree with the computed one
    const lh = lengthOf(scene, pts, h, pf);
    if (lh !== null && (lh.unit !== l1.unit || Math.abs(lh.value - c) > Math.max(0.05, 0.01 * c))) return 'conflict';
    // a drawn side that disagrees with the printed legs is Spec Ghost's to report, not the walk's
    const unit = unitParam(l1.unit);

    const leg = (n: string, name: 'a' | 'b', l: Length, seg: Segment): WalkStep => ({
      find: line('walk.find.segment', { name: n }),
      say: line('walk.pyth.leg', { name: n, value: l.value, unit }),
      anchor: { kind: 'segment', id: seg.id },
      numbers: [{ name, param: 'value', value: l.value, source: { kind: 'fact', fact: l.fact, elementId: seg.id } }],
    });
    return {
      kind: 'pythagoras',
      steps: [
        leg(n1, 'a', l1, s1),
        leg(n2, 'b', l2, s2),
        {
          find: line('walk.find.vertex', { name: nv }),
          say: line(right === 'fact' ? 'walk.pyth.rightFact' : 'walk.pyth.rightDrawn', { name: nv }),
          anchor: { kind: 'vertex', id: v.id },
          numbers: [],
        },
        {
          find: line('walk.find.segment', { name: nh }),
          say: line('walk.pyth.hyp', { name: nh, aName: n1, bName: n2, a, b, aSq, bSq, sum, c, unit }),
          anchor: { kind: 'segment', id: h.id },
          numbers: [
            { name: 'aSq', value: aSq, source: { kind: 'calc', op: 'square', of: ['a'] } },
            { name: 'bSq', value: bSq, source: { kind: 'calc', op: 'square', of: ['b'] } },
            { name: 'sum', value: sum, source: { kind: 'calc', op: 'sum', of: ['aSq', 'bSq'] } },
            { name: 'c', value: c, source: { kind: 'calc', op: 'sqrt', of: ['sum'] } },
          ],
        },
      ],
      turn: { prompt: line('walk.turn.prompt.hyp', { vertex: nv }), name: nh, anchor: { kind: 'segment', id: h.id } },
      conclusion: { numberName: 'c', elementId: h.id },
    };
  }
  return null;
}

/** True when a fact contains `value` as a standalone number ("22", "22.", not "122" or "22.5"). */
function containsNumberToken(fact: string, value: number): boolean {
  const re = new RegExp(`(?<!\\d|\\d\\.)${escapeRe(String(value))}(?!\\d|\\.\\d)`);
  return re.test(fact);
}

function barDifference(scene: DiagramScene): Walk | null {
  const bars = scene.bars ?? [];
  if (bars.length < 2) return null;
  const max = Math.max(...bars.map((b) => b.value));
  const min = Math.min(...bars.map((b) => b.value));
  const hi = bars.filter((b) => b.value === max);
  const lo = bars.filter((b) => b.value === min);
  if (hi.length !== 1 || lo.length !== 1) return null;
  const high = hi[0]!;
  const low = lo[0]!;
  const highValue = round2(high.value);
  const lowValue = round2(low.value);
  const diff = round2(highValue - lowValue);
  if (!(diff > 0)) return null;
  const nh = speakableName(high.label, high.id);
  const nl = speakableName(low.label, low.id);
  if (nh === null || nl === null) return null;
  // a fact that already states the difference makes the walk circular
  if ((scene.facts ?? []).some((f) => typeof f === 'string' && containsNumberToken(f, diff))) return null;
  return {
    kind: 'barDifference',
    steps: [
      {
        find: line('walk.find.bar', { name: nh }),
        say: line('walk.bar.high', { label: nh, value: highValue }),
        anchor: { kind: 'bar', id: high.id },
        numbers: [{ name: 'highValue', param: 'value', value: highValue, source: { kind: 'bar', barId: high.id } }],
      },
      {
        find: line('walk.find.bar', { name: nl }),
        say: line('walk.bar.diff', { high: nh, low: nl, highValue, lowValue, diff }),
        anchor: { kind: 'bar', id: low.id },
        numbers: [
          { name: 'lowValue', value: lowValue, source: { kind: 'bar', barId: low.id } },
          { name: 'diff', value: diff, source: { kind: 'calc', op: 'difference', of: ['highValue', 'lowValue'] } },
        ],
      },
    ],
    turn: { prompt: line('walk.turn.prompt.bar', { low: nl }), name: nh, anchor: { kind: 'bar', id: high.id } },
    conclusion: { numberName: 'diff' },
  };
}

function longestSide(scene: DiagramScene, pf: ParsedFactsResult): Walk | null {
  const pts = pointMap(scene);
  const seen = new Set<string>();
  const segs: Segment[] = [];
  for (const s of scene.segments ?? []) {
    const a = pts.get(s.a);
    const b = pts.get(s.b);
    if (!a || !b || s.a === s.b || (a.x === b.x && a.y === b.y) || seen.has(s.id)) return null;
    seen.add(s.id);
    segs.push(s);
  }
  if (segs.length < 2 || segs.length > 5) return null;
  const lengths: Length[] = [];
  for (const s of segs) {
    const l = lengthOf(scene, pts, s, pf);
    if (l === null || (lengths[0] !== undefined && l.unit !== lengths[0].unit)) return null;
    lengths.push(l);
  }
  const max = Math.max(...lengths.map((l) => l.value));
  const winners = lengths.filter((l) => l.value === max);
  if (winners.length !== 1) return null;
  const longest = segs[lengths.indexOf(winners[0]!)]!;
  const names = segs.map((s) => segmentName(s, pts));
  if (names.some((n) => n === null)) return null;
  const winnerName = names[segs.indexOf(longest)]!;

  // a fact that is not a printed length and calls the longest side the longest makes the walk circular
  const printed = new Set(pf.lengths.map((l) => l.raw));
  const nameRe = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(winnerName)}($|[^\\p{L}\\p{N}])`, 'iu');
  for (const f of scene.facts ?? []) {
    if (typeof f !== 'string' || printed.has(f.trim())) continue;
    if (/longest|largest|biggest|hypotenuse/i.test(f) && nameRe.test(f)) return null;
  }

  const unit = unitParam(lengths[0]!.unit);
  return {
    kind: 'longestSide',
    steps: segs.map((s, i) => ({
      find: line('walk.find.segment', { name: names[i]! }),
      say: line('walk.longest.side', { name: names[i]!, value: lengths[i]!.value, unit }),
      anchor: { kind: 'segment', id: s.id },
      numbers: [
        { name: `len${i}`, param: 'value', value: lengths[i]!.value, source: { kind: 'fact', fact: lengths[i]!.fact, elementId: s.id } },
      ],
    })),
    turn: { prompt: line('walk.turn.prompt.longest'), name: winnerName, anchor: { kind: 'segment', id: longest.id } },
  };
}

function curveShape(scene: DiagramScene): Walk | null {
  if (scene.kind !== 'function_graph') return null;
  const origin = anchorPoint(scene, 'origin');
  const peak = anchorPoint(scene, 'peak');
  const trough = anchorPoint(scene, 'trough');
  if (origin === null || peak === null || trough === null) return null;
  for (const a of [origin, peak, trough]) if (!isAnchorReachable(scene, a)) return null;
  const order = peak.x <= trough.x ? [peak, trough] : [trough, peak];
  return {
    kind: 'curveShape',
    steps: [origin, ...order].map((spot) => ({
      find: line(`walk.find.spot.${spot.name}` as WalkKey),
      say: line(`walk.curve.${spot.name}` as WalkKey),
      anchor: { kind: 'spot', spot },
      numbers: [],
    })),
  };
}

const GRID_FACT = /^\s*grid\s*:/i;

/**
 * The walk for a scene, or `null` (Requirement 51.1 to 51.3). Templates are tried in this order and
 * the first that builds a valid walk wins: Pythagoras, bar difference, longest side, curve shape.
 */
export function templateWalk(scene: unknown, opts?: { raw?: boolean }): Walk | null {
  try {
    if (!isRenderableScene(scene)) return null;
    if (opts?.raw === true || scene.kind === 'unknown') return null;
    const ids: string[] = [];
    for (const p of scene.points ?? []) ids.push(p.id);
    for (const s of scene.segments ?? []) ids.push(s.id);
    for (const p of scene.polylines ?? []) ids.push(p.id);
    for (const b of scene.bars ?? []) ids.push(b.id);
    if (ids.some((id) => /^raw_/i.test(id))) return null;
    if ((scene.facts ?? []).some((f) => typeof f === 'string' && GRID_FACT.test(f))) return null;
    if (verifyScene(scene).status === 'disagree') return null;

    const pf = parseFacts(scene.facts, scene);
    const py = pythagoras(scene, pf);
    if (py === 'conflict') return null;
    const builders: Array<() => Walk | null> = [
      () => py,
      () => barDifference(scene),
      () => longestSide(scene, pf),
      () => curveShape(scene),
    ];
    for (const build of builders) {
      const w = build();
      if (w !== null && validateWalk(scene, w).ok) return w;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------------------------

export function initialWalkState(): WalkState {
  return { phase: 'idle' };
}

/** Validate and start a walk: the intro and the first find prompt. An invalid walk stays idle, silent. */
export function startWalk(
  scene: unknown,
  walk: Walk,
  t: number,
): { state: WalkState; effects: WalkEffect[] } {
  try {
    if (!Number.isFinite(t) || !validateWalk(scene, walk).ok) return { state: initialWalkState(), effects: [] };
    return {
      state: { phase: 'find', walk, index: 0, lastActivity: t },
      effects: [speak(line('walk.intro', { count: walk.steps.length })), speak(walk.steps[0]!.find)],
    };
  } catch {
    return { state: initialWalkState(), effects: [] };
  }
}

const none = (state: WalkState): { state: WalkState; effects: WalkEffect[] } => ({ state, effects: [] });

function isTouch(i: Record<string, unknown>): i is { kind: 'touch'; t: number; target: Target; finger: ScreenPoint; view: Viewport } {
  return isObj(i.target) && typeof i.target.kind === 'string' && isObj(i.finger) && isObj(i.view);
}

function targetKey(t: Target): string | null {
  if (t.kind === 'none') return null;
  if (t.kind === 'line') return `line:${t.id}:${t.elementKind}`;
  if (t.kind === 'vertex' || t.kind === 'bar') return `${t.kind}:${t.id}`;
  return null;
}

/**
 * The walk reducer. It speaks only through `speak` lines and asks for guidance only through
 * `guideTo`; it never asks for a vibration, tone or earcon. Inputs that are not understood, and
 * inputs with a time that is not a finite number, change nothing.
 */
export function walkStep(state: WalkState, input: WalkInput): { state: WalkState; effects: WalkEffect[] } {
  try {
    return reduce(state, input);
  } catch {
    return none(state);
  }
}

function reduce(state: WalkState, rawInput: WalkInput): { state: WalkState; effects: WalkEffect[] } {
  const input = rawInput as unknown;
  if (!isObj(state) || !isObj(input) || typeof input.kind !== 'string') return none(state);
  if (state.phase === 'idle') return none(state);

  if (input.kind === 'stop') {
    return { state: initialWalkState(), effects: input.silent === true ? [] : [speak(line('walk.stopped'))] };
  }

  const t = input.t;
  if (typeof t !== 'number' || !Number.isFinite(t)) return none(state);
  // a walk with no activity for WALK_IDLE_MS has ended; whatever arrives now is ordinary exploring
  if (t - state.lastActivity >= WALK_IDLE_MS) return none(initialWalkState());
  if (input.kind === 'tick') return none(state);

  const lastActivity = Math.max(state.lastActivity, t);
  const walk = state.walk;
  const stay = (s: WalkState, effects: WalkEffect[] = []): { state: WalkState; effects: WalkEffect[] } => ({ state: s, effects });

  if (input.kind === 'guideMe') {
    if (state.phase === 'find') return stay({ ...state, lastActivity }, [{ kind: 'guideTo', anchor: cloneAnchor(walk.steps[state.index]!.anchor) }]);
    if (state.phase === 'turn' && walk.turn) return stay({ ...state, lastActivity }, [{ kind: 'guideTo', anchor: cloneAnchor(walk.turn.anchor) }]);
    return stay({ ...state, lastActivity });
  }

  if (input.kind === 'repeat') {
    const s = { ...state, lastActivity };
    if (state.phase === 'find') return stay(s, [speak(walk.steps[state.index]!.find)]);
    if (state.phase === 'said') return stay(s, [speak(walk.steps[state.index]!.say)]);
    if (state.phase === 'turn' && walk.turn) return stay(s, [speak(walk.turn.prompt)]);
    return stay(s, [speak(line('walk.done'))]);
  }

  if (input.kind === 'next') {
    if (state.phase === 'find') return stay({ ...state, lastActivity }, [speak(walk.steps[state.index]!.find)]);
    if (state.phase === 'said') {
      if (state.index < walk.steps.length - 1) {
        const index = state.index + 1;
        return stay({ phase: 'find', walk, index, lastActivity }, [speak(walk.steps[index]!.find)]);
      }
      if (walk.turn) {
        return stay(
          { phase: 'turn', walk, misses: 0, revealed: false, wrongKey: null, wrongSince: lastActivity, counted: false, lastActivity },
          [speak(walk.turn.prompt)],
        );
      }
      return stay({ phase: 'done', walk, lastActivity });
    }
    if (state.phase === 'turn' && walk.turn) return stay({ ...state, lastActivity }, [speak(walk.turn.prompt)]);
    return stay({ ...state, lastActivity });
  }

  if (input.kind === 'touch') {
    if (!isTouch(input)) return none(state);
    const { target, finger, view } = input;
    if (state.phase === 'find') {
      const step = walk.steps[state.index]!;
      if (!anchorReached(step.anchor, target, finger, view)) return stay({ ...state, lastActivity });
      const lastStep = state.index === walk.steps.length - 1;
      if (lastStep && !walk.turn) return stay({ phase: 'done', walk, lastActivity }, [speak(step.say), speak(line('walk.done'))]);
      return stay({ phase: 'said', walk, index: state.index, lastActivity }, [speak(step.say)]);
    }
    if (state.phase === 'turn' && walk.turn) {
      if (anchorReached(walk.turn.anchor, target, finger, view)) {
        return stay({ phase: 'done', walk, lastActivity }, [speak(line('walk.turn.right', { name: walk.turn.name })), speak(line('walk.done'))]);
      }
      const key = targetKey(target);
      if (key === null) return stay({ ...state, wrongKey: null, counted: false, lastActivity });
      if (key !== state.wrongKey) return stay({ ...state, wrongKey: key, wrongSince: t, counted: false, lastActivity });
      if (state.counted || t - state.wrongSince < WALK_TRY_DWELL_MS) return stay({ ...state, lastActivity });
      const misses = state.misses + 1;
      if (misses === WALK_TURN_MISSES && !state.revealed) {
        return stay({ ...state, misses, counted: true, revealed: true, lastActivity }, [
          speak(line('walk.turn.answer', { name: walk.turn.name })),
          { kind: 'guideTo', anchor: cloneAnchor(walk.turn.anchor) },
        ]);
      }
      return stay({ ...state, misses, counted: true, lastActivity });
    }
    return stay({ ...state, lastActivity });
  }

  return none(state);
}

// ---------------------------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------------------------

/** The same normalisation as `flow/commands.ts`: lower case, trim, punctuation and danda out, spaces collapsed. */
function normalizeTranscript(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?।]/g, '')
    .replace(/\s+/g, ' ');
}

function listed(list: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(list)) return out;
  for (const p of list) {
    if (typeof p !== 'string') continue;
    const n = normalizeTranscript(p);
    if (n !== '' && n.split(' ').length <= 3) out.add(n);
  }
  return out;
}

/**
 * Whole-phrase matching only (Requirement 45.6): the normalised transcript must EQUAL a listed
 * phrase of at most three words. A phrase inside a longer sentence, a fragment of a phrase, and a
 * listed phrase of more than three words never match.
 */
export function walkCommandOf(transcript: unknown, phrases: WalkPhrases): 'start' | 'next' | null {
  try {
    if (typeof transcript !== 'string' || !isObj(phrases)) return null;
    const said = normalizeTranscript(transcript);
    if (said === '') return null;
    if (listed(phrases.start).has(said)) return 'start';
    if (listed(phrases.next).has(said)) return 'next';
    return null;
  } catch {
    return null;
  }
}
