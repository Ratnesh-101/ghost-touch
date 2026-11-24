/**
 * Properties P159 to P169 for the Planchette walk (task 85, Requirement 51). P170 is in
 * `walkAnchor.prop.test.ts`.
 *
 * Written before `core/walk.ts`. Every oracle is computed here from the scene, never by calling the
 * code under test: exact decimal arithmetic for the squares, a local reached() for anchors, and a
 * small model of the order in which the reducer may speak.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Target } from '../src/core/hitTest';
import { makeViewport } from '../src/core/geometry';
import { verifyScene } from '../src/core/verify';
import type { DiagramScene } from '../src/core/scene';
import {
  WALK_IDLE_MS,
  WALK_KEYS,
  WALK_MAX_STEPS,
  WALK_TRY_DWELL_MS,
  initialWalkState,
  startWalk,
  templateWalk,
  validateWalk,
  walkCommandOf,
  walkStep,
  type Walk,
  type WalkAnchor,
  type WalkEffect,
  type WalkInput,
  type WalkState,
} from '../src/core/walk';
import barJson from '../public/samples/barchart.json';
import triangleJson from '../public/samples/triangle.json';
import sineJson from '../public/samples/sine.json';
import { axesArb, barScene, curveArb, deepFreeze, graphScene, largestAngleDeg, scaleneScene, triangleScene } from './support/walkScenes';
import { runs } from './support/runs';

const triangleSample = triangleJson as unknown as DiagramScene;
const barSample = barJson as unknown as DiagramScene;
const sineSample = sineJson as unknown as DiagramScene;

const VIEW = makeViewport(400, 400);
const FINGER = { x: 200, y: 200 };
const UNITS = [undefined, 'mm', 'cm', 'm', 'km', 'in', 'ft'] as const;
const TRIPLES = [
  [3, 4, 5],
  [5, 12, 13],
] as const;

// ---------------------------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------------------------

interface Tri {
  scene: DiagramScene;
  a: number;
  b: number;
  c: number;
  ia: number;
  ib: number;
  ic: number;
  unit: string | undefined;
}

const triArb: fc.Arbitrary<Tri> = fc
  .record({
    triple: fc.constantFrom(...TRIPLES),
    m: fc.integer({ min: 1, max: 500 }),
    unit: fc.constantFrom(...UNITS),
    swap: fc.boolean(),
    printHyp: fc.boolean(),
  })
  .map((r) => {
    const [t0, t1, t2] = r.triple;
    const ia = (r.swap ? t1 : t0) * r.m;
    const ib = (r.swap ? t0 : t1) * r.m;
    const ic = t2 * r.m;
    const [a, b, c] = [ia / 10, ib / 10, ic / 10];
    const scene = triangleScene({ a, b, unit: r.unit, ...(r.printHyp ? { hyp: c } : {}) });
    return { scene, a, b, c, ia, ib, ic, unit: r.unit };
  });

const LABELS = ['Q1', 'Q2', 'Q3', 'Q4', 'North', 'South', 'East', 'West'];

interface Bars {
  scene: DiagramScene;
  specs: { label: string; value: number }[];
}

const barsArb: fc.Arbitrary<Bars> = fc
  .record({
    labels: fc.shuffledSubarray(LABELS, { minLength: 2, maxLength: 6 }),
    quarters: fc.array(fc.integer({ min: 0, max: 400 }), { minLength: 6, maxLength: 6 }),
  })
  .map(({ labels, quarters }) => {
    const specs = labels.map((label, i) => ({ label, value: quarters[i]! / 4 }));
    return { scene: barScene(specs), specs };
  });

/** Bars with all different values, so a walk always exists. */
const barsUniqueArb: fc.Arbitrary<Bars> = fc
  .record({
    labels: fc.shuffledSubarray(LABELS, { minLength: 2, maxLength: 6 }),
    quarters: fc.uniqueArray(fc.integer({ min: 0, max: 400 }), { minLength: 6, maxLength: 6 }),
  })
  .map(({ labels, quarters }) => {
    const specs = labels.map((label, i) => ({ label, value: quarters[i]! / 4 }));
    return { scene: barScene(specs), specs };
  });

const scaleneArb: fc.Arbitrary<{ scene: DiagramScene; sides: [number, number, number] }> = fc
  .tuple(fc.integer({ min: 3, max: 14 }), fc.integer({ min: 3, max: 14 }), fc.integer({ min: 3, max: 14 }))
  .filter(([a, b, c]) => {
    const s = [a, b, c].sort((x, y) => x - y);
    if (!(s[0]! + s[1]! > s[2]!) || s[2] === s[1]) return false; // valid, unique longest
    if (Math.abs(largestAngleDeg([a, b, c]) - 90) < 14) return false; // never read as a right angle
    return true;
  })
  .map(([a, b, c]) => ({ sides: [a, b, c] as [number, number, number], scene: scaleneScene([a, b, c], 'cm') }))
  .filter(({ scene }) => scene.points!.every((p) => p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98));

/** A scene that has a walk (task 90: no graph, Requirement 51.14). */
const walkSceneArb: fc.Arbitrary<DiagramScene> = fc.oneof(
  triArb.map((t) => t.scene),
  barsUniqueArb.map((b) => b.scene),
  scaleneArb.map((s) => s.scene),
);

function walkOf(scene: DiagramScene): Walk {
  const w = templateWalk(scene);
  if (w === null) throw new Error('expected a walk');
  return w;
}

const clone = <T>(v: T): T => structuredClone(v);

// ---------------------------------------------------------------------------------------------
// Independent oracles
// ---------------------------------------------------------------------------------------------

function anchorExists(scene: DiagramScene, a: WalkAnchor): boolean {
  if (a.kind === 'vertex') return (scene.points ?? []).some((p) => p.id === a.id);
  if (a.kind === 'segment') {
    return (scene.segments ?? []).some(
      (s) =>
        s.id === a.id &&
        (scene.points ?? []).some((p) => p.id === s.a) &&
        (scene.points ?? []).some((p) => p.id === s.b),
    );
  }
  if (a.kind === 'bar') return (scene.bars ?? []).some((b) => b.id === a.id);
  const poly = (scene.polylines ?? []).find((p) => p.id === a.spot.elementId);
  if (a.spot.name === 'origin') {
    return scene.axes?.y_axis_x === a.spot.x && scene.axes?.x_axis_y === a.spot.y;
  }
  return poly !== undefined && poly.points.some((q) => q[0] === a.spot.x && q[1] === a.spot.y);
}

function reached(anchor: WalkAnchor, t: Target): boolean {
  if (anchor.kind === 'vertex') return t.kind === 'vertex' && t.id === anchor.id;
  if (anchor.kind === 'segment') return t.kind === 'line' && t.elementKind === 'segment' && t.id === anchor.id;
  if (anchor.kind === 'bar') {
    return (t.kind === 'bar' && t.id === anchor.id) || (t.kind === 'line' && t.elementKind === 'bar-edge' && t.id === anchor.id);
  }
  return false; // spots are covered by P170
}

function allAnchors(w: Walk): WalkAnchor[] {
  return [...w.steps.map((s) => s.anchor), ...(w.turn ? [w.turn.anchor] : [])];
}

function stepList(w: Walk): number[] {
  return w.steps.map((_, i) => i);
}

function anchorTarget(a: WalkAnchor): Target {
  if (a.kind === 'vertex') return { kind: 'vertex', id: a.id };
  if (a.kind === 'segment') return { kind: 'line', id: a.id, elementKind: 'segment' };
  if (a.kind === 'bar') return { kind: 'bar', id: a.id, label: 'x', value: 1, maxValue: 1 };
  throw new Error('spots are covered by P170');
}

// ---------------------------------------------------------------------------------------------
// P159
// ---------------------------------------------------------------------------------------------

describe('P159: every anchor is a scene element', () => {
  it('every walk the templates build validates, has 1 to 6 steps and anchors on real elements', () => {
    fc.assert(
      fc.property(walkSceneArb, (scene) => {
        const w = walkOf(scene);
        expect(validateWalk(scene, w)).toEqual({ ok: true });
        expect(w.steps.length).toBeGreaterThanOrEqual(1);
        expect(w.steps.length).toBeLessThanOrEqual(WALK_MAX_STEPS);
        for (const a of allAnchors(w)) expect(anchorExists(scene, a)).toBe(true);
      }),
      { numRuns: runs(250) },
    );
  });

  it('an unknown anchor id, or an anchor of another element kind, is refused with reason anchor', () => {
    fc.assert(
      fc.property(walkSceneArb, fc.nat(), fc.constantFrom('unknown', 'wrongKind'), (scene, pick, how) => {
        const w = walkOf(scene);
        const idx = pick % w.steps.length;
        const bad = clone(w);
        const a = bad.steps[idx]!.anchor;
        if (a.kind === 'spot') {
          bad.steps[idx]!.anchor = { kind: 'spot', spot: { ...a.spot, elementId: 'nope', acceptIds: ['nope'] } };
        } else if (how === 'unknown') {
          bad.steps[idx]!.anchor = { kind: a.kind, id: 'no-such-element' };
        } else {
          // keep the id, name another kind: a point id as a bar, a bar id as a segment, a segment id as a vertex
          const kind = a.kind === 'vertex' ? 'bar' : a.kind === 'segment' ? 'vertex' : 'segment';
          bad.steps[idx]!.anchor = { kind, id: a.id };
        }
        const r = validateWalk(scene, bad);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe('anchor');
      }),
      { numRuns: runs(250) },
    );
  });

  it('a dangling segment is not an anchor', () => {
    fc.assert(
      fc.property(triArb, (t) => {
        const w = walkOf(t.scene);
        const dangling = clone(t.scene);
        // the leg CA loses its end point A (and nothing else): the leg anchor is no longer on the drawing
        dangling.segments![0] = { ...dangling.segments![0]!, b: 'gone' };
        const r = validateWalk(dangling, w);
        expect(r.ok).toBe(false);
      }),
      { numRuns: runs(250) },
    );
  });

  it('a walk that fails validation never starts', () => {
    fc.assert(
      fc.property(walkSceneArb, (scene) => {
        const w = walkOf(scene);
        const bad = clone(w);
        const a = bad.steps[0]!.anchor;
        bad.steps[0]!.anchor = a.kind === 'spot' ? { kind: 'vertex', id: 'x' } : { kind: a.kind, id: 'x' };
        const r = startWalk(scene, bad, 0);
        expect(r.state.phase).toBe('idle');
        expect(r.effects).toEqual([]);
        const ok = startWalk(scene, w, 0);
        expect(ok.state.phase).toBe('find');
        expect(ok.effects.length).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: runs(250) },
    );
  });

  it('the shipped triangle and bar samples have a walk of the expected kind; the sine has none (task 90)', () => {
    expect(templateWalk(triangleSample)?.kind).toBe('pythagoras');
    expect(templateWalk(barSample)?.kind).toBe('barDifference');
    expect(templateWalk(sineSample)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// P187 (task 90, Requirement 51.14)
// ---------------------------------------------------------------------------------------------

describe('P187: no walk on a graph', () => {
  it('is null for any function_graph scene, with or without points and facts', () => {
    fc.assert(
      fc.property(
        fc.array(curveArb, { minLength: 1, maxLength: 3 }),
        axesArb,
        fc.boolean(),
        fc.array(fc.constantFrom('AB = 3 cm', 'AC = 5 cm', 'angle B = 90°', 'not to scale'), { maxLength: 4 }),
        (curves, axes, withPoints, facts) => {
          const base = graphScene(curves, axes, { facts });
          const scene: DiagramScene = withPoints
            ? { ...base, points: [{ id: 'A', x: 0.2, y: 0.3, label: 'A' }, { id: 'B', x: 0.7, y: 0.6, label: 'B' }] }
            : base;
          expect(templateWalk(scene)).toBeNull();
        },
      ),
      { numRuns: runs(250) },
    );
  });

  it('is null for a triangle or bar chart that also has a polyline, and still a walk without it', () => {
    fc.assert(
      fc.property(triArb, barsUniqueArb, curveArb, (t, b, curve) => {
        for (const s of [t.scene, b.scene]) {
          expect(templateWalk(s)).not.toBeNull();
          const withLine: DiagramScene = { ...s, polylines: [{ id: 'curve9', points: curve, label: null }] };
          expect(templateWalk(withLine)).toBeNull();
        }
      }),
      { numRuns: runs(250) },
    );
  });

  it('is null for kind function_graph even with no polyline (a triangle or bar chart relabelled)', () => {
    fc.assert(
      fc.property(triArb, barsUniqueArb, (t, b) => {
        for (const s of [t.scene, b.scene]) {
          expect(templateWalk(s)).not.toBeNull();
          expect(templateWalk({ ...s, kind: 'function_graph' })).toBeNull();
        }
      }),
      { numRuns: runs(250) },
    );
  });

  it('is null for the shipped sine sample', () => {
    expect(templateWalk(sineSample)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// P160
// ---------------------------------------------------------------------------------------------

describe('P160: Pythagoras is exact and needs every premise', () => {
  it('speaks the exact squares, sum and root for scaled 3-4-5 and 5-12-13', () => {
    fc.assert(
      fc.property(triArb, (t) => {
        const w = walkOf(t.scene);
        expect(w.kind).toBe('pythagoras');
        expect(w.steps).toHaveLength(4);
        const hyp = w.steps[3]!;
        const p = hyp.say.params;
        expect(p.a).toBe(t.a);
        expect(p.b).toBe(t.b);
        expect(p.aSq).toBe((t.ia * t.ia) / 100);
        expect(p.bSq).toBe((t.ib * t.ib) / 100);
        expect(p.sum).toBe((t.ia * t.ia + t.ib * t.ib) / 100);
        expect(p.c).toBe(t.ic / 10);
        expect(p.unit).toBe(t.unit ?? '');
        expect(hyp.anchor).toEqual({ kind: 'segment', id: 'AB' });
        expect(w.conclusion).toEqual({ numberName: 'c', elementId: 'AB' });
        expect(w.steps[0]!.anchor).toEqual({ kind: 'segment', id: 'CA' });
        expect(w.steps[1]!.anchor).toEqual({ kind: 'segment', id: 'BC' });
        expect(w.steps[2]!.anchor).toEqual({ kind: 'vertex', id: 'C' });
        expect(w.steps[2]!.say.key).toBe('walk.pyth.rightFact');
        expect(w.turn?.anchor).toEqual({ kind: 'segment', id: 'AB' });
        expect(validateWalk(t.scene, w)).toEqual({ ok: true });
      }),
      { numRuns: runs(250) },
    );
  });

  it('a printed hypotenuse that agrees is never a premise', () => {
    fc.assert(
      fc.property(triArb, (t) => {
        const printed = triangleScene({ a: t.a, b: t.b, unit: t.unit, hyp: t.c });
        const w = walkOf(printed);
        for (const s of w.steps) {
          for (const n of s.numbers) {
            if (n.source.kind === 'fact') expect(n.source.elementId).not.toBe('AB');
          }
        }
        // the walk is the same with and without the printed hypotenuse
        const plain = walkOf(triangleScene({ a: t.a, b: t.b, unit: t.unit }));
        expect(w).toEqual(plain);
      }),
      { numRuns: runs(250) },
    );
  });

  it('a missing leg fact, a missing right angle, or mixed or unknown units give no walk', () => {
    fc.assert(
      fc.property(triArb, (t) => {
        const { a, b } = t;
        const u = t.unit;
        expect(templateWalk(triangleScene({ a, b, unit: u, legFacts: [false, true] }))).toBeNull();
        expect(templateWalk(triangleScene({ a, b, unit: u, legFacts: [true, false] }))).toBeNull();
        // right angle: neither a fact nor a right angle in the drawing
        expect(templateWalk(triangleScene({ a, b, unit: u, rightAngleFact: false, drawnRight: false }))).toBeNull();
        // drawn right angle only, but the scene says it is not to scale: the drawing is not a premise
        expect(
          templateWalk(triangleScene({ a, b, unit: u, rightAngleFact: false, extraFacts: ['The figure is not to scale'] })),
        ).toBeNull();
      }),
      { numRuns: runs(250) },
    );
    const mixed = triangleScene({ a: 4, b: 3, unit: 'cm' });
    mixed.facts = ['angle C = 90 degrees', 'AC = 4 cm', 'BC = 3 mm'];
    expect(templateWalk(mixed)).toBeNull();
    const oneBare = triangleScene({ a: 4, b: 3, unit: 'cm' });
    oneBare.facts = ['angle C = 90 degrees', 'AC = 4 cm', 'BC = 3'];
    expect(templateWalk(oneBare)).toBeNull();
    const unknown = triangleScene({ a: 4, b: 3 });
    unknown.facts = ['angle C = 90 degrees', 'AC = 4 parsecs', 'BC = 3 parsecs'];
    expect(templateWalk(unknown)).toBeNull();
  });

  it('a right angle only in the drawing gives a walk that says so', () => {
    fc.assert(
      fc.property(triArb, (t) => {
        const scene = triangleScene({ a: t.a, b: t.b, unit: t.unit, rightAngleFact: false });
        const w = walkOf(scene);
        expect(w.steps[2]!.say.key).toBe('walk.pyth.rightDrawn');
      }),
      { numRuns: runs(250) },
    );
  });

  it('a printed hypotenuse beyond the tolerance, or a leg that disagrees with the drawing, gives no walk', () => {
    fc.assert(
      fc.property(triArb, (t) => {
        const off = Math.round((t.c * 1.25 + 0.3) * 100) / 100;
        expect(templateWalk(triangleScene({ a: t.a, b: t.b, unit: t.unit, hyp: off }))).toBeNull();
        const forged = triangleScene({ a: t.a, b: t.b, unit: t.unit });
        forged.facts = forged.facts!.map((f) => (f.startsWith('AC') ? `AC = ${t.a * 2}${t.unit ? ` ${t.unit}` : ''}` : f));
        expect(templateWalk(forged)).toBeNull();
      }),
      { numRuns: runs(250) },
    );
  });

  it('a printed hypotenuse 6% off that Spec Ghost accepts is still refused by the walk itself', () => {
    fc.assert(
      fc.property(
        triArb.filter((t) => t.c >= 2),
        (t) => {
          const off = Math.round(t.c * 1.06 * 100) / 100;
          const scene = triangleScene({ a: t.a, b: t.b, unit: t.unit, hyp: off });
          // Spec Ghost allows 15 %, so this scene is not disputed: only the walk's own tolerance refuses it
          expect(verifyScene(scene).status).not.toBe('disagree');
          expect(templateWalk(scene)).toBeNull();
          // inside the tolerance (the exact value) the walk is there
          expect(templateWalk(triangleScene({ a: t.a, b: t.b, unit: t.unit, hyp: t.c }))).not.toBeNull();
        },
      ),
      { numRuns: runs(250) },
    );
  });
});

// ---------------------------------------------------------------------------------------------
// P161
// ---------------------------------------------------------------------------------------------

describe('P161: bar difference is highest minus lowest', () => {
  it('exists exactly when the highest and the lowest are unique, and gives their difference', () => {
    fc.assert(
      fc.property(barsArb, ({ scene, specs }) => {
        const vals = specs.map((s) => s.value);
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        const unique = vals.filter((v) => v === max).length === 1 && vals.filter((v) => v === min).length === 1;
        const w = templateWalk(scene);
        if (!unique || max === min) {
          expect(w).toBeNull();
          return;
        }
        expect(w).not.toBeNull();
        const hi = scene.bars!.find((b) => b.value === max)!;
        const lo = scene.bars!.find((b) => b.value === min)!;
        expect(w!.kind).toBe('barDifference');
        expect(w!.steps.map((s) => s.anchor)).toEqual([
          { kind: 'bar', id: hi.id },
          { kind: 'bar', id: lo.id },
        ]);
        expect(w!.steps[1]!.say.params.diff).toBe(max - min);
        expect(w!.steps[1]!.say.params.high).toBe(hi.label);
        expect(w!.steps[1]!.say.params.low).toBe(lo.label);
        expect(w!.steps[0]!.say.params.value).toBe(max);
        expect(w!.turn?.anchor).toEqual({ kind: 'bar', id: hi.id });
        expect(validateWalk(scene, w!)).toEqual({ ok: true });
      }),
      { numRuns: runs(250) },
    );
  });

  it('values with more than two decimals are spoken rounded to two', () => {
    const s = barScene([
      { label: 'Q1', value: 10.004 },
      { label: 'Q2', value: 25.678 },
      { label: 'Q3', value: 18 },
    ]);
    const w = walkOf(s);
    expect(w.steps[0]!.say.params.value).toBe(25.68);
    expect(w.steps[1]!.say.params.lowValue).toBe(10);
    expect(w.steps[1]!.say.params.diff).toBe(15.68);
  });

  it('a scene with a non-finite bar value has no walk (it is not renderable)', () => {
    const s = barScene([
      { label: 'Q1', value: 3 },
      { label: 'Q2', value: Number.NaN },
      { label: 'Q3', value: 9 },
    ]);
    expect(templateWalk(s)).toBeNull();
  });

  it('a fact that states the difference blocks the walk, a similar number does not', () => {
    fc.assert(
      fc.property(barsArb, fc.constantFrom('{} more than the lowest', 'Difference: {}', 'by {}.'), ({ scene, specs }, tpl) => {
        const vals = specs.map((s) => s.value);
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        if (vals.filter((v) => v === max).length !== 1 || vals.filter((v) => v === min).length !== 1) return;
        const diff = max - min;
        expect(templateWalk({ ...scene, facts: [tpl.replace('{}', String(diff))] })).toBeNull();
        const near = { ...scene, facts: ['The highest is 1' + String(diff) + ' more than the lowest', 'Total 9' + String(diff)] };
        expect(templateWalk(near)).not.toBeNull();
      }),
      { numRuns: runs(250) },
    );
  });
  it('a bar that cannot be named aloud gives no walk', () => {
    const s = barScene([
      { label: 'Q1', value: 3 },
      { label: 'Q2', value: 9 },
    ]);
    s.bars![1] = { ...s.bars![1]!, label: '', id: 'bar_12' };
    expect(templateWalk(s)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// P162
// ---------------------------------------------------------------------------------------------

function evalCalc(op: string, xs: number[]): number | null {
  const r2 = (v: number): number => Math.round(v * 100) / 100;
  if (op === 'square' && xs.length === 1) return r2(xs[0]! * xs[0]!);
  if (op === 'sum' && xs.length >= 1) return r2(xs.reduce((s, v) => s + v, 0));
  if (op === 'sqrt' && xs.length === 1) return r2(Math.sqrt(xs[0]!));
  if (op === 'difference' && xs.length === 2) return r2(xs[0]! - xs[1]!);
  return null;
}

describe('P162: a forged number is refused', () => {
  const mutants: Record<string, (w: Walk, pick: number) => boolean> = {
    valueBumped: (w, pick) => {
      const all = w.steps.flatMap((s) => s.numbers);
      if (all.length === 0) return false;
      all[pick % all.length]!.value += 1;
      return true;
    },
    paramBumped: (w, pick) => {
      const spots: Array<[Record<string, string | number>, string]> = [];
      for (const s of w.steps) for (const [k, v] of Object.entries(s.say.params)) if (typeof v === 'number') spots.push([s.say.params, k]);
      if (spots.length === 0) return false;
      const [obj, k] = spots[pick % spots.length]!;
      obj[k] = (obj[k] as number) + 0.5;
      return true;
    },
    unknownBar: (w, pick) => {
      const bars = w.steps.flatMap((s) => s.numbers).filter((n) => n.source.kind === 'bar');
      if (bars.length === 0) return false;
      const n = bars[pick % bars.length]!;
      n.source = { kind: 'bar', barId: 'no-such-bar' };
      return true;
    },
    unknownFact: (w, pick) => {
      const facts = w.steps.flatMap((s) => s.numbers).filter((n) => n.source.kind === 'fact');
      if (facts.length === 0) return false;
      const n = facts[pick % facts.length]!;
      if (n.source.kind === 'fact') n.source = { ...n.source, fact: 'AC = 999 cm' };
      return true;
    },
    swappedOp: (w, pick) => {
      const calcs = w.steps.flatMap((s) => s.numbers).filter((n) => n.source.kind === 'calc');
      if (calcs.length === 0) return false;
      const n = calcs[pick % calcs.length]!;
      if (n.source.kind !== 'calc') return false;
      const byName = new Map(w.steps.flatMap((s) => s.numbers).map((x) => [x.name, x.value]));
      const xs = n.source.of.map((k) => byName.get(k) ?? Number.NaN);
      const other = { square: 'sqrt', sqrt: 'square', sum: 'difference', difference: 'sum' }[n.source.op];
      const again = evalCalc(other, xs);
      if (again === n.value) return false; // would still be right: not a forgery
      n.source = { ...n.source, op: other as 'square' | 'sqrt' | 'sum' | 'difference' };
      return true;
    },
    unknownInput: (w, pick) => {
      const calcs = w.steps.flatMap((s) => s.numbers).filter((n) => n.source.kind === 'calc');
      if (calcs.length === 0) return false;
      const n = calcs[pick % calcs.length]!;
      if (n.source.kind !== 'calc') return false;
      n.source = { ...n.source, of: ['nothing', ...n.source.of.slice(1)] };
      return true;
    },
    bogusParam: (w) => {
      w.steps[0]!.say.params.bogus = 7;
      return true;
    },
    badName: (w) => {
      for (const s of w.steps) {
        const k = Object.entries(s.say.params).find(([key, v]) => typeof v === 'string' && key !== 'unit');
        if (k) {
          s.say.params[k[0]] = 'Zed';
          return true;
        }
      }
      return false;
    },
    badTurnName: (w) => {
      if (!w.turn) return false;
      w.turn.name = 'Zed';
      return true;
    },
    unknownKey: (w) => {
      (w.steps[0]!.say as { key: string }).key = 'walk.nope';
      return true;
    },
    badUnit: (w) => {
      const s = w.steps.find((x) => 'unit' in x.say.params);
      if (!s) return false;
      s.say.params.unit = 'parsec';
      return true;
    },
    numberInFind: (w) => {
      w.steps[0]!.find.params.hint = 12;
      return true;
    },
    numberInTurn: (w) => {
      if (!w.turn) return false;
      w.turn.prompt.params.hint = 12;
      return true;
    },
  };

  for (const [name, mutate] of Object.entries(mutants)) {
    it(`mutation ${name} is refused`, () => {
      let applied = 0;
      fc.assert(
        fc.property(walkSceneArb, fc.nat(), (scene, pick) => {
          const w = clone(walkOf(scene));
          const ok = (mutate as (w: Walk, p: number) => boolean)(w, pick);
          if (!ok) return;
          applied++;
          const r = validateWalk(scene, w);
          expect(r.ok, name).toBe(false);
        }),
        { numRuns: runs(250) },
      );
      expect(applied).toBeGreaterThan(0);
    });
  }

  it('more than six steps is refused', () => {
    const w = walkOf(triangleSample);
    const long = clone(w);
    long.steps = [...w.steps, ...clone(w).steps, ...clone(w).steps];
    expect(long.steps.length).toBeGreaterThan(6);
    expect(validateWalk(triangleSample, long)).toEqual({ ok: false, reason: 'shape' });
    expect(validateWalk(triangleSample, { ...clone(w), steps: [] })).toEqual({ ok: false, reason: 'shape' });
  });

  it('the unmodified walks are accepted (control)', () => {
    fc.assert(
      fc.property(walkSceneArb, (scene) => {
        expect(validateWalk(scene, clone(walkOf(scene)))).toEqual({ ok: true });
      }),
      { numRuns: runs(250) },
    );
  });
});

// ---------------------------------------------------------------------------------------------
// P163
// ---------------------------------------------------------------------------------------------

describe('P163: no walk uses its own conclusion as a premise', () => {
  it('a Pythagoras walk with a fact about the hypotenuse as a source is refused as selfPremise', () => {
    fc.assert(
      fc.property(triArb, (t) => {
        const scene = triangleScene({ a: t.a, b: t.b, unit: t.unit, hyp: t.c });
        const w = clone(walkOf(scene));
        const c = w.steps[3]!.numbers.find((n) => n.name === 'c')!;
        c.source = { kind: 'fact', fact: scene.facts!.find((f) => f.startsWith('AB'))!, elementId: 'AB' };
        const r = validateWalk(scene, w);
        expect(r).toEqual({ ok: false, reason: 'selfPremise' });
        // a leg quietly replaced by the hypotenuse fact is caught the same way
        const w2 = clone(walkOf(scene));
        const a = w2.steps[0]!.numbers[0]!;
        a.source = { kind: 'fact', fact: scene.facts!.find((f) => f.startsWith('AB'))!, elementId: 'AB' };
        expect(validateWalk(scene, w2)).toEqual({ ok: false, reason: 'selfPremise' });
      }),
      { numRuns: runs(250) },
    );
  });

  it('a printed hypotenuse that disagrees gives no walk', () => {
    fc.assert(
      fc.property(triArb, fc.double({ min: 1.2, max: 3, noNaN: true }), (t, f) => {
        const off = Math.round(t.c * f * 100) / 100 + 0.3;
        expect(templateWalk(triangleScene({ a: t.a, b: t.b, unit: t.unit, hyp: off }))).toBeNull();
      }),
      { numRuns: runs(250) },
    );
  });

  it('longest side: a fact that names the longest side blocks the walk, a printed length does not', () => {
    fc.assert(
      fc.property(scaleneArb, ({ scene, sides }) => {
        const w = walkOf(scene);
        expect(w.kind).toBe('longestSide');
        const [a, b, c] = sides;
        const longest = Math.max(a, b, c);
        const name = longest === c ? 'AB' : longest === a ? 'BC' : 'CA';
        for (const text of [`${name} is the longest side`, `The longest side is ${name}`, `${name} is the hypotenuse`]) {
          expect(templateWalk({ ...scene, facts: [...scene.facts!, text] }), text).toBeNull();
        }
        // a printed length that happens to say "hypotenuse" is a premise, not a statement of the answer
        const printed = { ...scene, facts: scene.facts!.map((f) => (f.startsWith(name) ? `The length of hypotenuse ${f}` : f)) };
        expect(templateWalk(printed)).not.toBeNull();
      }),
      { numRuns: runs(250) },
    );
  });

  it('longest side: lengths, ordering and the unique longest', () => {
    fc.assert(
      fc.property(scaleneArb, ({ scene, sides }) => {
        const w = walkOf(scene);
        expect(w.steps).toHaveLength(3);
        const [a, b, c] = sides;
        const byId: Record<string, number> = { AB: c, BC: a, CA: b };
        w.steps.forEach((s, i) => {
          const id = scene.segments![i]!.id;
          expect(s.anchor).toEqual({ kind: 'segment', id });
          expect(s.say.params.value).toBe(byId[id]);
        });
        const longest = Math.max(a, b, c);
        const id = Object.keys(byId).find((k) => byId[k] === longest)!;
        expect(w.turn?.anchor).toEqual({ kind: 'segment', id });
      }),
      { numRuns: runs(250) },
    );
  });

  it('longest side: a tie for the longest gives no walk, and so do a missing length and too many sides', () => {
    expect(templateWalk(scaleneScene([6, 6, 4], 'cm'))).toBeNull();
    const missing = scaleneScene([5, 6, 7], 'cm');
    missing.facts = missing.facts!.slice(0, 2);
    expect(templateWalk(missing)).toBeNull();
    expect(templateWalk(scaleneScene([5, 6, 7], 'cm'))?.kind).toBe('longestSide');
  });
});

// ---------------------------------------------------------------------------------------------
// P164
// ---------------------------------------------------------------------------------------------

function renameFirstId(scene: DiagramScene): DiagramScene {
  const s = clone(scene);
  if (s.bars && s.bars.length > 0) s.bars[0] = { ...s.bars[0]!, id: 'raw_b1' };
  else if (s.segments && s.segments.length > 0) s.segments[0] = { ...s.segments[0]!, id: 'raw_s1' };
  else if (s.polylines && s.polylines.length > 0) s.polylines[0] = { ...s.polylines[0]!, id: 'raw_c1' };
  return s;
}

describe('P164: where a walk never exists', () => {
  it('raw: true, kind unknown and raw_ ids give no walk; the same scene without the cause gives one', () => {
    fc.assert(
      fc.property(walkSceneArb, (scene) => {
        expect(templateWalk(scene)).not.toBeNull();
        expect(templateWalk(scene, { raw: true })).toBeNull();
        expect(templateWalk(scene, { raw: false })).not.toBeNull();
        expect(templateWalk({ ...scene, kind: 'unknown' })).toBeNull();
        expect(templateWalk(renameFirstId(scene))).toBeNull();
      }),
      { numRuns: runs(250) },
    );
  });

  it('a fact line starting "Grid:" blocks every walk, at any index and in any case', () => {
    fc.assert(
      fc.property(
        walkSceneArb,
        fc.nat(),
        fc.constantFrom('Grid: x 0-6, y 0-8', 'grid: 6 by 8', '  GRID:cells', 'Grid:'),
        (scene, at, line) => {
          const facts = [...(scene.facts ?? [])];
          facts.splice(at % (facts.length + 1), 0, line);
          expect(templateWalk({ ...scene, facts })).toBeNull();
          // not at the start of a line: just text that mentions a grid
          const mention = [...(scene.facts ?? []), 'The grid: is drawn in grey'];
          expect(templateWalk({ ...scene, facts: mention })).not.toBeNull();
        },
      ),
      { numRuns: runs(250) },
    );
  });

  it('a Spec Ghost dispute blocks the walk', () => {
    const forged = triangleScene({ a: 4, b: 3, unit: 'cm' });
    forged.facts = ['angle C = 90 degrees', 'AC = 8 cm', 'BC = 3 cm'];
    expect(templateWalk(forged)).toBeNull();
    expect(templateWalk(triangleScene({ a: 4, b: 3, unit: 'cm' }))).not.toBeNull();
    const bar = barScene([
      { label: 'Q1', value: 3 },
      { label: 'Q2', value: 9 },
    ]);
    expect(templateWalk(bar)).not.toBeNull();
  });

  it('junk never throws and gives null; a frozen scene is not mutated', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        expect(() => templateWalk(v as unknown as DiagramScene)).not.toThrow();
        expect(templateWalk(v as unknown as DiagramScene)).toBeNull();
      }),
      { numRuns: runs(400) },
    );
    const junk: unknown[] = [
      null,
      undefined,
      1,
      'x',
      [],
      {},
      { kind: 'geometry' },
      { kind: 'geometry', points: 3, segments: [], polylines: [], bars: [] },
      { kind: 'bar_chart', points: [], segments: [], polylines: [], bars: [{ id: 'a' }], facts: [1] },
    ];
    for (const j of junk) {
      expect(() => templateWalk(j as DiagramScene)).not.toThrow();
      expect(templateWalk(j as DiagramScene)).toBeNull();
      expect(validateWalk(j as DiagramScene, null).ok).toBe(false);
    }
    fc.assert(
      fc.property(walkSceneArb, (scene) => {
        const frozen = deepFreeze(clone(scene));
        const w = templateWalk(frozen);
        expect(w).not.toBeNull();
        expect(frozen).toEqual(scene);
        expect(() => validateWalk(frozen, deepFreeze(clone(w!)))).not.toThrow();
      }),
      { numRuns: runs(250) },
    );
  });

  it('a walk is the same for the same scene, and every spoken name is real', () => {
    fc.assert(
      fc.property(walkSceneArb, (scene) => {
        expect(templateWalk(scene)).toEqual(templateWalk(clone(scene)));
        const w = walkOf(scene);
        const names = new Set<string>();
        for (const p of scene.points ?? []) names.add(p.label?.trim() || p.id);
        for (const s of scene.segments ?? []) names.add(s.label?.trim() || s.id);
        for (const b of scene.bars ?? []) names.add(b.label.trim());
        for (const s of w.steps) {
          for (const [k, v] of Object.entries(s.say.params)) {
            if (typeof v === 'string' && k !== 'unit') expect(names.has(v), `${k}=${v}`).toBe(true);
          }
        }
      }),
      { numRuns: runs(250) },
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Reducer harness
// ---------------------------------------------------------------------------------------------

function targetsFor(scene: DiagramScene): Target[] {
  const out: Target[] = [{ kind: 'none' }];
  for (const p of scene.points ?? []) out.push({ kind: 'vertex', id: p.id });
  for (const s of scene.segments ?? []) {
    out.push({ kind: 'line', id: s.id, elementKind: 'segment' });
    out.push({ kind: 'line', id: s.id, elementKind: 'polyline' }); // right id, wrong kind
  }
  for (const b of scene.bars ?? []) {
    out.push({ kind: 'bar', id: b.id, label: b.label, value: b.value, maxValue: 100 });
    out.push({ kind: 'line', id: b.id, elementKind: 'bar-edge' });
  }
  return out;
}

const touch = (t: number, target: Target): WalkInput => ({ kind: 'touch', t, target, finger: FINGER, view: VIEW });

const lineKey = (l: { key: string; params: Record<string, unknown> }): string => `${l.key}|${JSON.stringify(l.params)}`;

/** Name an effect by which line of the walk it speaks. */
function labelOf(w: Walk, e: WalkEffect): string {
  if (e.kind === 'guideTo') return 'guide';
  const k = lineKey(e.line);
  for (let i = 0; i < w.steps.length; i++) {
    if (k === lineKey(w.steps[i]!.find)) return `find:${i}`;
    if (k === lineKey(w.steps[i]!.say)) return `say:${i}`;
  }
  if (w.turn && k === lineKey(w.turn.prompt)) return 'turnPrompt';
  return e.line.key; // walk.turn.right, walk.done, walk.turn.answer, walk.stopped
}

// ---------------------------------------------------------------------------------------------
// P165
// ---------------------------------------------------------------------------------------------

describe('P165: a step is spoken only after its anchor is reached', () => {
  const sceneArb = fc.oneof(triArb.map((t) => t.scene), barsUniqueArb.map((b) => b.scene), scaleneArb.map((s) => s.scene));

  type Ev = { k: 'touch'; pick: number; dt: number } | { k: 'hit'; dt: number } | { k: 'next' } | { k: 'repeat' } | { k: 'tick' };
  const evArb: fc.Arbitrary<Ev> = fc.oneof(
    { weight: 4, arbitrary: fc.record({ k: fc.constant('touch' as const), pick: fc.nat(), dt: fc.integer({ min: 1, max: 20 }) }) },
    // a touch on the anchor the model is waiting for, so long sequences get past the first step
    { weight: 4, arbitrary: fc.record({ k: fc.constant('hit' as const), dt: fc.integer({ min: 1, max: 20 }) }) },
    { weight: 4, arbitrary: fc.constant({ k: 'next' as const }) },
    { weight: 1, arbitrary: fc.constant({ k: 'repeat' as const }) },
    { weight: 1, arbitrary: fc.constant({ k: 'tick' as const }) },
  );

  it('speaks a step sentence only for a touch that reaches that step while it is current, and never skips', () => {
    fc.assert(
      fc.property(sceneArb, fc.array(evArb, { minLength: 1, maxLength: 24 }), (scene, evs) => {
        const w = walkOf(scene);
        const targets = [...targetsFor(scene), ...allAnchors(w).map(anchorTarget)];
        let { state } = startWalk(scene, w, 0);
        // model
        let phase: 'find' | 'said' | 'turn' | 'done' = 'find';
        let cur = 0;
        const last = w.steps.length - 1;
        let t = 0;
        for (const ev of evs) {
          let input: WalkInput;
          if (ev.k === 'touch') {
            t += ev.dt;
            input = touch(t, targets[ev.pick % targets.length]!);
          } else if (ev.k === 'hit') {
            t += ev.dt;
            const want = phase === 'find' ? w.steps[cur]!.anchor : phase === 'turn' ? w.turn!.anchor : null;
            input = touch(t, want === null ? { kind: 'none' } : anchorTarget(want));
          } else if (ev.k === 'tick') {
            input = { kind: 'tick', t };
          } else input = { kind: ev.k, t };
          const r = walkStep(state, input);
          state = r.state;
          const labels = r.effects.map((e) => labelOf(w, e));
          let expected: string[] = [];
          if (input.kind === 'touch') {
            if (phase === 'find' && reached(w.steps[cur]!.anchor, input.target)) {
              expected = [`say:${cur}`];
              if (cur === last && !w.turn) {
                expected.push('walk.done');
                phase = 'done';
              } else phase = 'said';
            } else if (phase === 'turn' && reached(w.turn!.anchor, input.target)) {
              expected = ['walk.turn.right', 'walk.done'];
              phase = 'done';
            }
          } else if (input.kind === 'next') {
            if (phase === 'find') expected = [`find:${cur}`];
            else if (phase === 'said') {
              if (cur < last) {
                cur++;
                phase = 'find';
                expected = [`find:${cur}`];
              } else if (w.turn) {
                phase = 'turn';
                expected = ['turnPrompt'];
              }
            } else if (phase === 'turn') expected = ['turnPrompt'];
          } else if (input.kind === 'repeat') {
            if (phase === 'find') expected = [`find:${cur}`];
            else if (phase === 'said') expected = [`say:${cur}`];
            else if (phase === 'turn') expected = ['turnPrompt'];
            else expected = ['walk.done'];
          }
          expect(labels, JSON.stringify({ input: input.kind, phase, cur })).toEqual(expected);
          // never a sentence for a step that is not current, never for a touch that missed
          for (const l of labels) {
            if (l.startsWith('say:') && input.kind !== 'repeat') {
              expect(input.kind).toBe('touch');
              expect(reached(w.steps[Number(l.slice(4))]!.anchor, (input as { target: Target }).target)).toBe(true);
            }
          }
        }
        expect(stepList(w).length).toBeGreaterThan(0);
      }),
      { numRuns: runs(300) },
    );
  });

  it('the right id with the wrong element kind does not reach a step', () => {
    const w = walkOf(triangleSample);
    const { state } = startWalk(triangleSample, w, 0);
    const wrong = walkStep(state, touch(10, { kind: 'line', id: 'CA', elementKind: 'polyline' }));
    expect(wrong.effects).toEqual([]);
    const right = walkStep(state, touch(10, { kind: 'line', id: 'CA', elementKind: 'segment' }));
    expect(right.effects.map((e) => labelOf(w, e))).toEqual(['say:0']);
    // the vertex at the end of the leg is a vertex, not the leg
    const end = walkStep(state, touch(10, { kind: 'vertex', id: 'C' }));
    expect(end.effects).toEqual([]);
  });

  it('walks the triangle sample end to end', () => {
    const w = walkOf(triangleSample);
    let { state } = startWalk(triangleSample, w, 0);
    const script: Array<[WalkInput, string[]]> = [
      [touch(1, { kind: 'line', id: 'CA', elementKind: 'segment' }), ['say:0']],
      [{ kind: 'next', t: 2 }, ['find:1']],
      [touch(3, { kind: 'line', id: 'BC', elementKind: 'segment' }), ['say:1']],
      [{ kind: 'next', t: 4 }, ['find:2']],
      [touch(5, { kind: 'vertex', id: 'C' }), ['say:2']],
      [{ kind: 'next', t: 6 }, ['find:3']],
      [touch(7, { kind: 'line', id: 'AB', elementKind: 'segment' }), ['say:3']],
      [{ kind: 'next', t: 8 }, ['turnPrompt']],
      [touch(9, { kind: 'line', id: 'AB', elementKind: 'segment' }), ['walk.turn.right', 'walk.done']],
    ];
    for (const [input, expected] of script) {
      const r = walkStep(state, input);
      expect(r.effects.map((e) => labelOf(w, e))).toEqual(expected);
      state = r.state;
    }
    expect(state.phase).toBe('done');
  });
});

// ---------------------------------------------------------------------------------------------
// P166
// ---------------------------------------------------------------------------------------------

const KEYS = new Set<string>(WALK_KEYS);

function junkInput(): fc.Arbitrary<unknown> {
  return fc.oneof(
    fc.jsonValue(),
    fc.record({ kind: fc.string(), t: fc.double() }),
    fc.record({ kind: fc.constant('touch'), t: fc.double(), target: fc.jsonValue(), finger: fc.jsonValue(), view: fc.jsonValue() }),
    fc.constant(undefined),
    fc.constant(null),
  );
}

describe('P166: the reducer emits only speech and guidance', () => {
  const sceneArb = fc.oneof(triArb.map((t) => t.scene), barsUniqueArb.map((b) => b.scene), scaleneArb.map((s) => s.scene));

  it('every effect is a walk speech line or a guideTo of one of the walk anchors; nothing is mutated', () => {
    fc.assert(
      fc.property(sceneArb, fc.array(fc.oneof(fc.nat(), junkInput()), { minLength: 1, maxLength: 30 }), (scene, picks) => {
        const w = deepFreeze(clone(walkOf(scene)));
        const targets = targetsFor(scene);
        const anchors = allAnchors(w);
        let { state, effects } = startWalk(scene, w, 0);
        state = deepFreeze(state);
        let t = 0;
        const check = (list: readonly WalkEffect[]): void => {
          for (const e of list) {
            expect(['speak', 'guideTo']).toContain(e.kind);
            if (e.kind === 'speak') {
              expect(KEYS.has(e.line.key), e.line.key).toBe(true);
              expect(e.line.key.startsWith('walk.')).toBe(true);
              for (const v of Object.values(e.line.params)) {
                expect(typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))).toBe(true);
              }
            } else {
              expect(anchors).toContainEqual(e.anchor);
            }
            expect(Object.keys(e).sort()).toEqual(e.kind === 'speak' ? ['kind', 'line'] : ['anchor', 'kind']);
          }
        };
        check(effects);
        for (const p of picks) {
          let input: unknown;
          if (typeof p === 'number') {
            t += 7;
            const choice = p % 5;
            input =
              choice === 0 ? { kind: 'next', t } : choice === 1 ? { kind: 'repeat', t } : choice === 2 ? { kind: 'guideMe', t } : choice === 3 ? { kind: 'tick', t } : touch(t, targets[p % targets.length]!);
          } else input = p;
          const before = JSON.stringify(state);
          const r = walkStep(state, input as WalkInput);
          expect(JSON.stringify(state)).toBe(before);
          check(r.effects);
          state = deepFreeze(r.state);
        }
      }),
      { numRuns: runs(300) },
    );
  });

  it('start speaks the intro and the first find prompt, nothing else', () => {
    const w = walkOf(triangleSample);
    const { effects } = startWalk(triangleSample, w, 0);
    expect(effects.map((e) => (e.kind === 'speak' ? e.line.key : e.kind))).toEqual(['walk.intro', 'walk.find.segment']);
    const first = effects[0]!;
    expect(first.kind === 'speak' && first.line.params.count).toBe(4);
  });
});

// ---------------------------------------------------------------------------------------------
// P167
// ---------------------------------------------------------------------------------------------

describe('P167: stop, idle timeout and time', () => {
  const sceneArb = fc.oneof(triArb.map((t) => t.scene), barsUniqueArb.map((b) => b.scene));

  /** Drive into a random reachable state with a few inputs, then return it with the clock. */
  function reach(scene: DiagramScene, picks: number[]): { state: WalkState; t: number; walk: Walk } {
    const walk = walkOf(scene);
    const targets = [...targetsFor(scene), ...allAnchors(walk).map(anchorTarget)];
    let { state } = startWalk(scene, walk, 1000);
    let t = 1000;
    for (const p of picks) {
      t += 10;
      const c = p % 4;
      const input: WalkInput = c === 0 ? { kind: 'next', t } : c === 1 ? { kind: 'repeat', t } : touch(t, targets[p % targets.length]!);
      state = walkStep(state, input).state;
    }
    return { state, t, walk };
  }

  it('stop gives idle from any state, then nothing speaks until a new start', () => {
    fc.assert(
      fc.property(sceneArb, fc.array(fc.nat(), { maxLength: 30 }), fc.array(fc.nat(), { maxLength: 10 }), (scene, picks, after) => {
        const { state, t, walk } = reach(scene, picks);
        const active = state.phase !== 'idle';
        const r = walkStep(state, { kind: 'stop' });
        expect(r.state.phase).toBe('idle');
        expect(r.effects.length).toBe(active ? 1 : 0);
        if (active) expect(labelOf(walk, r.effects[0]!)).toBe('walk.stopped');
        const silent = walkStep(state, { kind: 'stop', silent: true });
        expect(silent.state.phase).toBe('idle');
        expect(silent.effects).toEqual([]);
        // idle absorbs everything except start
        const targets = targetsFor(scene);
        let s = r.state;
        let tt = t;
        for (const p of after) {
          tt += 10;
          const c = p % 5;
          const input: WalkInput =
            c === 0 ? { kind: 'next', t: tt } : c === 1 ? { kind: 'repeat', t: tt } : c === 2 ? { kind: 'guideMe', t: tt } : c === 3 ? { kind: 'tick', t: tt } : touch(tt, targets[p % targets.length]!);
          const x = walkStep(s, input);
          expect(x.effects).toEqual([]);
          expect(x.state.phase).toBe('idle');
          s = x.state;
        }
        expect(startWalk(scene, walk, tt).state.phase).toBe('find');
      }),
      { numRuns: runs(300) },
    );
  });

  it('ends silently after 120 000 ms without activity, and any activity restarts the clock', () => {
    fc.assert(
      fc.property(sceneArb, fc.integer({ min: 0, max: 5_000_000 }), fc.integer({ min: 1, max: 119_999 }), (scene, t0, gap) => {
        const walk = walkOf(scene);
        const { state } = startWalk(scene, walk, t0);
        expect(WALK_IDLE_MS).toBe(120_000);
        const early = walkStep(state, { kind: 'tick', t: t0 + 119_999 });
        expect(early.state.phase).not.toBe('idle');
        expect(early.effects).toEqual([]);
        const late = walkStep(state, { kind: 'tick', t: t0 + 120_000 });
        expect(late.state.phase).toBe('idle');
        expect(late.effects).toEqual([]);
        // a touch at t0 + gap moves the deadline
        const touched = walkStep(state, touch(t0 + gap, { kind: 'none' }));
        expect(walkStep(touched.state, { kind: 'tick', t: t0 + gap + 119_999 }).state.phase).not.toBe('idle');
        expect(walkStep(touched.state, { kind: 'tick', t: t0 + gap + 120_000 }).state.phase).toBe('idle');
        // next and repeat count as activity too
        const nexted = walkStep(state, { kind: 'repeat', t: t0 + gap });
        expect(walkStep(nexted.state, { kind: 'tick', t: t0 + gap + 119_999 }).state.phase).not.toBe('idle');
      }),
      { numRuns: runs(300) },
    );
  });

  it('NaN, infinite and backwards times never end a walk early and never throw', () => {
    fc.assert(
      fc.property(sceneArb, fc.constantFrom(Number.NaN, Infinity, -Infinity, -1, -1e12), (scene, bad) => {
        const walk = walkOf(scene);
        const { state } = startWalk(scene, walk, 50_000);
        for (const input of [
          { kind: 'tick', t: bad },
          { kind: 'next', t: bad },
          { kind: 'repeat', t: bad },
          touch(bad, { kind: 'none' }),
          { kind: 'guideMe', t: bad },
        ] as WalkInput[]) {
          const r = walkStep(state, input);
          expect(r.state.phase).not.toBe('idle');
          if (!Number.isFinite(bad)) {
            expect(r.effects).toEqual([]);
            expect(r.state).toEqual(state);
          }
          // a time before the last activity does not shorten the clock
          expect(walkStep(r.state, { kind: 'tick', t: 50_000 + 119_999 }).state.phase).not.toBe('idle');
        }
      }),
      { numRuns: runs(300) },
    );
  });

  it('start with a time that is not finite still starts at a defined state and never throws', () => {
    const w = walkOf(triangleSample);
    for (const t of [Number.NaN, Infinity, -Infinity]) {
      expect(() => startWalk(triangleSample, w, t)).not.toThrow();
    }
    expect(initialWalkState()).toEqual({ phase: 'idle' });
  });
});

// ---------------------------------------------------------------------------------------------
// P168
// ---------------------------------------------------------------------------------------------

describe('P168: Your turn', () => {
  const sceneArb = fc.oneof(triArb.map((t) => t.scene), barsUniqueArb.map((b) => b.scene), scaleneArb.map((s) => s.scene));

  /** A walk driven to the Your-turn prompt. */
  function atTurn(scene: DiagramScene): { w: Walk; state: WalkState; t: number } {
    const w = walkOf(scene);
    let { state } = startWalk(scene, w, 0);
    let t = 0;
    for (let i = 0; i < w.steps.length; i++) {
      const a = w.steps[i]!.anchor;
      t += 10;
      state = walkStep(state, touch(t, anchorTarget(a))).state;
      t += 10;
      const r = walkStep(state, { kind: 'next', t });
      state = r.state;
    }
    expect(state.phase).toBe('turn');
    return { w, state, t };
  }

  const holdArb = fc.record({ pick: fc.nat(), ms: fc.integer({ min: 0, max: 1500 }), gap: fc.boolean() });

  it('a wrong touch never advances, a try needs 500 ms of rest, and the answer comes once at the second try', () => {
    fc.assert(
      fc.property(sceneArb, fc.array(holdArb, { maxLength: 8 }), (scene, holds) => {
        const { w, state: s0, t: t0 } = atTurn(scene);
        const wrongs = targetsFor(scene).filter((tg) => tg.kind !== 'none' && !reached(w.turn!.anchor, tg));
        expect(WALK_TRY_DWELL_MS).toBe(500);
        let state = s0;
        let t = t0;
        let lastKey: string | null = null;
        let tries = 0;
        let answers = 0;
        let guides = 0;
        for (const h of holds) {
          const tg = wrongs[h.pick % wrongs.length]!;
          const key = JSON.stringify(tg);
          if (key === lastKey) {
            // the same element again: it only counts as a new rest after the finger left every element
            t += 20;
            state = walkStep(state, touch(t, { kind: 'none' })).state;
          }
          lastKey = key;
          let counted = false;
          for (let el = 0; el <= h.ms; el += 20) {
            t += 20;
            const r = walkStep(state, touch(t, tg));
            state = r.state;
            for (const e of r.effects) {
              const label = labelOf(w, e);
              if (label === 'walk.turn.answer') answers++;
              else if (label === 'guide') guides++;
              else throw new Error(`a wrong touch spoke ${label}`);
            }
            if (el >= 500 && !counted) {
              counted = true;
              tries++;
            }
            expect(state.phase).toBe('turn');
          }
          if (h.gap) {
            t += 20;
            state = walkStep(state, touch(t, { kind: 'none' })).state;
            lastKey = null;
          }
          expect(answers).toBe(tries >= 2 ? 1 : 0);
          expect(guides).toBe(answers);
        }
        // the correct touch always ends it, after any number of wrong tries
        t += 20;
        const done = walkStep(state, touch(t, anchorTarget(w.turn!.anchor)));
        expect(done.effects.map((e) => labelOf(w, e))).toEqual(['walk.turn.right', 'walk.done']);
        expect(done.state.phase).toBe('done');
      }),
      { numRuns: runs(300) },
    );
  });

  it('the answer names the element, and guideTo points at the turn anchor', () => {
    const { w, state: s0, t } = atTurn(triangleSample);
    let state = s0;
    let now = t;
    const out: WalkEffect[] = [];
    for (const id of ['CA', 'BC']) {
      for (let el = 0; el <= 500; el += 20) {
        now += 20;
        const r = walkStep(state, touch(now, { kind: 'line', id, elementKind: 'segment' }));
        state = r.state;
        out.push(...r.effects);
      }
      now += 20;
      state = walkStep(state, touch(now, { kind: 'none' })).state;
    }
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ kind: 'speak', line: { key: 'walk.turn.answer', params: { name: w.turn!.name } } });
    expect(out[1]).toEqual({ kind: 'guideTo', anchor: w.turn!.anchor });
    expect(w.turn!.name).toBe('AB');
  });

  it('passing over wrong elements faster than the rest time counts nothing', () => {
    const { state: s0, t } = atTurn(triangleSample);
    let state = s0;
    let now = t;
    for (let i = 0; i < 40; i++) {
      now += 100;
      const id = i % 2 === 0 ? 'CA' : 'BC'; // switches every 100 ms: no element is rested on
      const r = walkStep(state, touch(now, { kind: 'line', id, elementKind: 'segment' }));
      expect(r.effects).toEqual([]);
      state = r.state;
    }
  });

  it('repeat and next in the turn say the prompt again and never advance', () => {
    const { w, state } = atTurn(triangleSample);
    for (const kind of ['repeat', 'next'] as const) {
      const r = walkStep(state, { kind, t: 99_000 });
      expect(r.effects.map((e) => labelOf(w, e))).toEqual(['turnPrompt']);
      expect(r.state.phase).toBe('turn');
    }
  });
});

// ---------------------------------------------------------------------------------------------
// P169
// ---------------------------------------------------------------------------------------------

describe('P169: a command is a whole phrase', () => {
  const phrases = { start: ['walk me through', 'मुझे समझाओ'], next: ['next step', 'अगला कदम'] };
  const normalise = (s: string): string => s.toLowerCase().trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?।]/g, '').replace(/\s+/g, ' ');

  const wordArb = fc.constantFrom('please', 'the', 'help', 'why', 'is', 'AB', 'five', 'show', 'me', 'how', 'next', 'walk', 'through', 'step', 'a');

  it('starts and moves on only for the exact phrase, whatever the case, punctuation and spaces', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('walk me through', 'next step', 'मुझे समझाओ', 'अगला कदम'),
        fc.boolean(),
        fc.constantFrom('', '.', '!', '।', '?'),
        fc.constantFrom('', ' ', '  '),
        (phrase, upper, punct, pad) => {
          const spaced = phrase.split(' ').join(pad === '' ? ' ' : `${pad}  `);
          const said = `${pad}${upper ? spaced.toUpperCase() : spaced}${punct}${pad}`;
          const expected = normalise(phrase) === 'walk me through' || normalise(phrase) === 'मुझे समझाओ' ? 'start' : 'next';
          expect(walkCommandOf(said, phrases)).toBe(expected);
        },
      ),
      { numRuns: runs(300) },
    );
  });

  it('a longer sentence, a fragment or a neighbour phrase gives null', () => {
    fc.assert(
      fc.property(fc.array(wordArb, { minLength: 0, maxLength: 5 }), fc.array(wordArb, { minLength: 0, maxLength: 5 }), fc.constantFrom('walk me through', 'next step'), (before, after, phrase) => {
        const said = [...before, phrase, ...after].join(' ');
        if (before.length + after.length > 0) expect(walkCommandOf(said, phrases), said).toBeNull();
      }),
      { numRuns: runs(300) },
    );
    for (const s of ['next', 'walk', 'step', 'walk through', 'walk me', 'me through', 'next steps', 'next corner', 'show me why AB is five', 'can you walk me through it', '', '   ', '.']) {
      expect(walkCommandOf(s, phrases), s).toBeNull();
    }
  });

  it('no transcript of more than three words ever starts or moves on, whatever the phrase list holds', () => {
    fc.assert(
      fc.property(fc.array(wordArb, { minLength: 4, maxLength: 9 }), (words) => {
        const said = words.join(' ');
        const longList = { start: [said, 'walk me through'], next: [said, 'next step'] };
        expect(walkCommandOf(said, longList), said).toBeNull();
      }),
      { numRuns: runs(300) },
    );
  });

  it('junk transcripts and phrase lists never throw and give null', () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.jsonValue(), (t, p) => {
        expect(() => walkCommandOf(t as string, p as never)).not.toThrow();
        expect(walkCommandOf(t as string, { start: [], next: [] })).toBeNull();
      }),
      { numRuns: runs(300) },
    );
    for (const p of [null, undefined, 5, {}, { start: 'walk me through' }, { start: [1, null], next: [{}] }]) {
      expect(walkCommandOf('walk me through', p as never)).toBeNull();
    }
    expect(walkCommandOf(5 as unknown as string, phrases)).toBeNull();
  });
});
