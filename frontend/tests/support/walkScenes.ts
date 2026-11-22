/**
 * Scene builders and generators shared by the Planchette tests (task 85, Requirement 51).
 * Nothing here imports the code under test except types; the properties compute their own oracles.
 */
import fc from 'fast-check';
import type { DiagramScene } from '../../src/core/scene';

type Pt = [number, number];

export interface TriangleSpec {
  /** Leg lengths as printed (numbers), the right angle at C. */
  a: number;
  b: number;
  unit?: string;
  /** Printed hypotenuse, or undefined for none. */
  hyp?: number;
  /** Which facts to print. */
  rightAngleFact?: boolean;
  legFacts?: [boolean, boolean];
  /** Draw the corner at C as a right angle (true) or as 60 degrees (false). */
  drawnRight?: boolean;
  extraFacts?: string[];
}

const fmt = (v: number, unit?: string): string => `${v}${unit ? ` ${unit}` : ''}`;

/**
 * A right triangle A (top), C (bottom left, the right angle), B (bottom right). The drawn sides are
 * proportional to the printed legs so Spec Ghost stays silent. Segment ids: CA, AB, BC.
 */
export function triangleScene(spec: TriangleSpec): DiagramScene {
  const { a, b } = spec; // a = CA, b = BC
  const longest = Math.max(a, b);
  const k = 0.6 / longest;
  const cx = 0.2;
  const cy = 0.8;
  const ax = cx;
  const ay = cy - a * k;
  const bx = spec.drawnRight === false ? cx + b * k * 0.5 : cx + b * k;
  const by = spec.drawnRight === false ? cy - b * k * 0.87 : cy;
  const facts: string[] = [];
  if (spec.rightAngleFact !== false) facts.push('angle C = 90 degrees');
  if (spec.legFacts?.[0] !== false) facts.push(`AC = ${fmt(a, spec.unit)}`);
  if (spec.legFacts?.[1] !== false) facts.push(`BC = ${fmt(b, spec.unit)}`);
  if (spec.hyp !== undefined) facts.push(`AB = ${fmt(spec.hyp, spec.unit)}`);
  facts.push(...(spec.extraFacts ?? []));
  return {
    version: 1,
    kind: 'geometry',
    title: 'Right Triangle ABC',
    points: [
      { id: 'A', x: ax, y: ay, label: 'A' },
      { id: 'B', x: bx, y: by, label: 'B' },
      { id: 'C', x: cx, y: cy, label: 'C' },
    ],
    segments: [
      { id: 'CA', a: 'C', b: 'A', label: 'CA' },
      { id: 'AB', a: 'A', b: 'B', label: 'AB' },
      { id: 'BC', a: 'B', b: 'C', label: 'BC' },
    ],
    polylines: [],
    bars: [],
    axes: null,
    facts,
    aspect: 1,
  };
}

export interface BarSpec {
  label: string;
  value: number;
}

/** A bar chart with one bar per spec, heights proportional to value (Spec Ghost stays silent). */
export function barScene(bars: BarSpec[], facts: string[] = []): DiagramScene {
  const finite = bars.filter((b) => Number.isFinite(b.value));
  const max = Math.max(1, ...finite.map((b) => Math.abs(b.value)));
  const n = Math.max(1, bars.length);
  const w = 0.8 / n;
  return {
    version: 1,
    kind: 'bar_chart',
    title: 'Chart',
    points: [],
    segments: [],
    polylines: [],
    bars: bars.map((b, i) => {
      const h = Number.isFinite(b.value) ? (Math.max(0, b.value) / max) * 0.6 : 0.1;
      return {
        id: `bar${String.fromCharCode(97 + i)}`,
        label: b.label,
        value: b.value,
        x0: 0.1 + i * w + w * 0.1,
        x1: 0.1 + (i + 1) * w - w * 0.1,
        y_top: 0.85 - h,
        y_base: 0.85,
      };
    }),
    axes: { x_axis_y: 0.85, y_axis_x: 0.08 },
    facts,
    aspect: 1,
  };
}

/** A function graph with the given curves (already in [0, 1]) and axes. */
export function graphScene(
  curves: Pt[][],
  axes: { x_axis_y: number | null; y_axis_x: number | null } | null = { x_axis_y: 0.5, y_axis_x: 0.1 },
  extra: Partial<DiagramScene> = {},
): DiagramScene {
  return {
    version: 1,
    kind: 'function_graph',
    title: 'graph',
    points: [],
    segments: [],
    polylines: curves.map((points, i) => ({ id: `curve${i === 0 ? '' : i + 1}`, points, label: null })),
    bars: [],
    axes,
    facts: [],
    aspect: 1,
    ...extra,
  };
}

const unit = fc.double({ min: 0, max: 1, noNaN: true });

/** One smooth curve with no symmetric ties: sine, parabola or a sloped line, sampled left to right. */
export const curveArb: fc.Arbitrary<Pt[]> = fc
  .record({
    family: fc.constantFrom('sine', 'parabola', 'line'),
    n: fc.integer({ min: 25, max: 70 }),
    amp: fc.double({ min: 0.12, max: 0.32, noNaN: true }),
    mid: fc.double({ min: 0.4, max: 0.6, noNaN: true }),
    phase: fc.double({ min: 0, max: 6.2, noNaN: true }),
    cycles: fc.double({ min: 0.6, max: 2.2, noNaN: true }),
    centre: fc.double({ min: 0.2, max: 0.8, noNaN: true }),
    x0: fc.double({ min: 0.05, max: 0.2, noNaN: true }),
    x1: fc.double({ min: 0.75, max: 0.95, noNaN: true }),
    slopeSign: fc.constantFrom(-1, 1),
  })
  .map((c) => {
    const pts: Pt[] = [];
    for (let i = 0; i < c.n; i++) {
      const t = i / (c.n - 1);
      const x = c.x0 + t * (c.x1 - c.x0);
      let y: number;
      if (c.family === 'sine') y = c.mid - c.amp * Math.sin(2 * Math.PI * c.cycles * t + c.phase);
      else if (c.family === 'parabola') y = c.mid - c.amp + 1.4 * c.amp * (t - c.centre) ** 2 * 2;
      else y = c.mid + c.slopeSign * c.amp * (t - 0.5);
      pts.push([x, Math.min(1, Math.max(0, y))]);
    }
    return pts;
  });

export const axesArb = fc.record({
  x_axis_y: fc.double({ min: 0.08, max: 0.92, noNaN: true }),
  y_axis_x: fc.double({ min: 0.08, max: 0.92, noNaN: true }),
});

export const unitFraction = unit;


/**
 * A scalene triangle with the exact printed side lengths (law of cosines), so Spec Ghost stays
 * silent. Sides: AB = c, BC = a, CA = b. Points A, B, C; segment ids AB, BC, CA. Needs a valid
 * triangle (each side shorter than the sum of the other two).
 */
export function scaleneScene(sides: [number, number, number], unit?: string, extraFacts: string[] = []): DiagramScene {
  const [a, b, c] = sides;
  const k = 0.6 / Math.max(a, b, c);
  const ax = 0.2;
  const ay = 0.8;
  const bx = ax + c * k;
  const by = ay;
  const cxl = (b * b + c * c - a * a) / (2 * c); // distance of C along AB from A
  const h = Math.sqrt(Math.max(0, b * b - cxl * cxl));
  const cx = ax + cxl * k;
  const cy = ay - h * k;
  return {
    version: 1,
    kind: 'geometry',
    title: 'Triangle',
    points: [
      { id: 'A', x: ax, y: ay, label: 'A' },
      { id: 'B', x: Math.min(1, bx), y: by, label: 'B' },
      { id: 'C', x: Math.min(1, Math.max(0, cx)), y: Math.max(0, cy), label: 'C' },
    ],
    segments: [
      { id: 'AB', a: 'A', b: 'B', label: 'AB' },
      { id: 'BC', a: 'B', b: 'C', label: 'BC' },
      { id: 'CA', a: 'C', b: 'A', label: 'CA' },
    ],
    polylines: [],
    bars: [],
    axes: null,
    facts: [`AB = ${fmt(c, unit)}`, `BC = ${fmt(a, unit)}`, `CA = ${fmt(b, unit)}`, ...extraFacts],
    aspect: 1,
  };
}

/** Largest interior angle of a triangle with these sides, in degrees. */
export function largestAngleDeg(sides: [number, number, number]): number {
  const [a, b, c] = [...sides].sort((x, y) => x - y) as [number, number, number];
  return (Math.acos((a * a + b * b - c * c) / (2 * a * b)) * 180) / Math.PI;
}

/** Freeze a value and everything reachable from it (a write then throws in strict mode). */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}
