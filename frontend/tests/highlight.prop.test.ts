/**
 * P151-P154 (Requirement 49, task 80.1): `highlightFor`.
 * Oracle: the set of (kind, id) pairs a scene really contains, built here from the scene alone.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { highlightFor, type Highlight } from '../src/core/highlight';
import type { Target } from '../src/core/hitTest';
import type { DiagramScene } from '../src/core/scene';
import { runs } from './support/runs';

const asScene = (v: unknown): DiagramScene => v as DiagramScene;
const asHit = (v: unknown): Target => v as Target;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const idPool = fc.constantFrom(
  'A', 'B', 'AB', 'p1', 's1', 'l1', 'b1', 'x-axis', 'y-axis', '__proto__', 'constructor', 'toString', '',
);

const maybeNumber = fc.oneof(fc.constant(null), fc.double({ min: 0, max: 1, noNaN: true }));

/** A well-formed scene with ids that are unique across kinds. */
const validScene = fc
  .record({
    points: fc.integer({ min: 0, max: 6 }),
    segments: fc.integer({ min: 0, max: 6 }),
    polylines: fc.integer({ min: 0, max: 3 }),
    bars: fc.integer({ min: 0, max: 4 }),
    xAxis: maybeNumber,
    yAxis: maybeNumber,
    hasAxes: fc.boolean(),
  })
  .map((n) =>
    asScene({
      version: 1,
      kind: 'unknown',
      points: Array.from({ length: n.points }, (_, i) => ({ id: `p${i}`, x: 0.5, y: 0.5 })),
      segments: Array.from({ length: n.segments }, (_, i) => ({ id: `s${i}`, a: 'p0', b: 'p1' })),
      polylines: Array.from({ length: n.polylines }, (_, i) => ({ id: `l${i}`, points: [[0, 0], [1, 1]] })),
      bars: Array.from({ length: n.bars }, (_, i) => ({
        id: `b${i}`, x0: 0, x1: 0.1, y_top: 0, y_base: 0.5, label: 'L', value: 1,
      })),
      axes: n.hasAxes ? { x_axis_y: n.xAxis, y_axis_x: n.yAxis } : null,
      facts: [],
    }),
  );

const looseList = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant('nope'),
  fc.array(fc.oneof(fc.record({ id: idPool }), fc.record({ id: fc.integer() }), fc.constant(null), fc.constant(3))),
);

/** Scenes with missing or mistyped arrays, duplicate and prototype-ish ids, odd axes. */
const looseScene = fc
  .record(
    {
      points: looseList,
      segments: looseList,
      polylines: looseList,
      bars: looseList,
      axes: fc.oneof(
        fc.constant(undefined),
        fc.constant(null),
        fc.constant(7),
        fc.record({ x_axis_y: fc.oneof(maybeNumber, fc.constant('0.5')), y_axis_x: fc.oneof(maybeNumber, fc.constant(undefined)) }),
      ),
    },
    { requiredKeys: [] },
  )
  .map(asScene);

const hitKind = fc.constantFrom('vertex', 'line', 'bar', 'none', 'weird');
const elementKind = fc.constantFrom('segment', 'polyline', 'axis', 'bar-edge', 'other');
const looseHit = fc
  .record(
    { kind: hitKind, id: fc.oneof(idPool, fc.integer(), fc.constant(null)), elementKind },
    { requiredKeys: [] },
  )
  .map(asHit);

// ---------------------------------------------------------------------------
// Independent oracle
// ---------------------------------------------------------------------------

function listIds(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((e) =>
    typeof e === 'object' && e !== null && typeof (e as { id?: unknown }).id === 'string'
      ? [(e as { id: string }).id]
      : [],
  );
}

/** Every (kind, id) a scene really has, as `kind|id` strings. */
function truth(scene: DiagramScene): Set<string> {
  const s = scene as unknown as Record<string, unknown>;
  const out = new Set<string>();
  for (const id of listIds(s.points)) out.add(`vertex|${id}`);
  for (const id of listIds(s.segments)) out.add(`segment|${id}`);
  for (const id of listIds(s.polylines)) out.add(`polyline|${id}`);
  for (const id of listIds(s.bars)) out.add(`bar|${id}`);
  const axes = s.axes;
  if (typeof axes === 'object' && axes !== null) {
    if (typeof (axes as { x_axis_y?: unknown }).x_axis_y === 'number') out.add('axis|x-axis');
    if (typeof (axes as { y_axis_x?: unknown }).y_axis_x === 'number') out.add('axis|y-axis');
  }
  return out;
}

function deepFreeze<T>(v: T): T {
  if (typeof v === 'object' && v !== null && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

const isHighlight = (h: Highlight): boolean =>
  ['vertex', 'segment', 'polyline', 'axis', 'bar', 'none'].includes(h.kind) &&
  (h.kind === 'none' ? h.id === null : typeof h.id === 'string');

/** One hit per element of a valid scene, with the answer it must give. */
function hitsFor(scene: DiagramScene): Array<{ hit: Target; want: Highlight }> {
  const out: Array<{ hit: Target; want: Highlight }> = [];
  for (const p of scene.points ?? []) {
    out.push({ hit: { kind: 'vertex', id: p.id }, want: { kind: 'vertex', id: p.id } });
  }
  for (const s of scene.segments ?? []) {
    out.push({ hit: { kind: 'line', id: s.id, elementKind: 'segment' }, want: { kind: 'segment', id: s.id } });
  }
  for (const l of scene.polylines ?? []) {
    out.push({ hit: { kind: 'line', id: l.id, elementKind: 'polyline' }, want: { kind: 'polyline', id: l.id } });
  }
  for (const b of scene.bars ?? []) {
    out.push({
      hit: { kind: 'bar', id: b.id, label: b.label, value: b.value, maxValue: b.value },
      want: { kind: 'bar', id: b.id },
    });
    out.push({ hit: { kind: 'line', id: b.id, elementKind: 'bar-edge' }, want: { kind: 'bar', id: b.id } });
  }
  const axes = scene.axes;
  if (axes && typeof axes.x_axis_y === 'number') {
    out.push({ hit: { kind: 'line', id: 'x-axis', elementKind: 'axis' }, want: { kind: 'axis', id: 'x-axis' } });
  }
  if (axes && typeof axes.y_axis_x === 'number') {
    out.push({ hit: { kind: 'line', id: 'y-axis', elementKind: 'axis' }, want: { kind: 'axis', id: 'y-axis' } });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('P151 highlightFor never invents an id', () => {
  it('is none, or names an element of that kind that the scene really has', () => {
    fc.assert(
      fc.property(looseHit, looseScene, (hit, scene) => {
        const r = highlightFor(hit, scene);
        if (r.kind === 'none') {
          expect(r.id).toBeNull();
        } else {
          expect(truth(scene).has(`${r.kind}|${String(r.id)}`)).toBe(true);
        }
      }),
      { numRuns: runs(250) },
    );
  });

  it('examples: __proto__ and a missing axis', () => {
    const scene = asScene({ points: [{ id: 'A' }], segments: [], polylines: [], bars: [], axes: { x_axis_y: null, y_axis_x: 0.5 } });
    expect(highlightFor({ kind: 'vertex', id: '__proto__' }, scene)).toEqual({ kind: 'none', id: null });
    expect(highlightFor({ kind: 'line', id: 'x-axis', elementKind: 'axis' }, scene)).toEqual({ kind: 'none', id: null });
    expect(highlightFor({ kind: 'line', id: 'y-axis', elementKind: 'axis' }, scene)).toEqual({ kind: 'axis', id: 'y-axis' });
  });
});

describe('P152 a hit on X returns X', () => {
  it('names exactly the touched element, and none for an id the scene lacks', () => {
    fc.assert(
      fc.property(validScene, (scene) => {
        for (const { hit, want } of hitsFor(scene)) {
          expect(highlightFor(hit, scene)).toEqual(want);
        }
        expect(highlightFor({ kind: 'vertex', id: 'zzz' }, scene)).toEqual({ kind: 'none', id: null });
        expect(highlightFor({ kind: 'line', id: 'zzz', elementKind: 'segment' }, scene)).toEqual({ kind: 'none', id: null });
        // An element id under the wrong kind is not found either.
        for (const p of scene.points ?? []) {
          expect(highlightFor({ kind: 'line', id: p.id, elementKind: 'segment' }, scene).kind).toBe('none');
        }
      }),
      { numRuns: runs(250) },
    );
  });
});

describe('P153 deterministic, copy-equal, pure', () => {
  it('gives deep-equal fresh objects for the same, a cloned and a frozen input', () => {
    fc.assert(
      fc.property(validScene, (scene) => {
        const cases = hitsFor(scene).map((c) => c.hit);
        cases.push({ kind: 'none' });
        const frozenScene = deepFreeze(structuredClone(scene));
        for (const hit of cases) {
          const a = highlightFor(hit, scene);
          const b = highlightFor(hit, scene);
          expect(a).toEqual(b);
          expect(a).not.toBe(b);
          expect(highlightFor(structuredClone(hit), structuredClone(scene))).toEqual(a);
          expect(highlightFor(deepFreeze(structuredClone(hit)), frozenScene)).toEqual(a);
        }
      }),
      { numRuns: runs(250) },
    );
  });
});

describe('P154 highlightFor is total', () => {
  it('never throws and always gives a well-formed Highlight, for any junk', () => {
    const anyHit = fc.oneof(fc.anything(), looseHit);
    const anyScene = fc.oneof(fc.anything(), looseScene, validScene);
    fc.assert(
      fc.property(anyHit, anyScene, (hit, scene) => {
        const r = highlightFor(hit as Target, scene as DiagramScene);
        expect(isHighlight(r)).toBe(true);
      }),
      { numRuns: runs(300) },
    );
  });

  it('null and undefined hits are none', () => {
    const scene = asScene({ points: [], segments: [], polylines: [], bars: [], axes: null });
    expect(highlightFor(null, scene)).toEqual({ kind: 'none', id: null });
    expect(highlightFor(undefined, scene)).toEqual({ kind: 'none', id: null });
    expect(highlightFor({ kind: 'none' }, scene)).toEqual({ kind: 'none', id: null });
  });
});
