import { describe, it, expect } from 'vitest';
import {
  makeViewport,
  toScreen,
  toNorm,
  distToSegment,
  type NormPoint,
  type ScreenPoint,
} from '../src/core/geometry';

const EPS = 1e-9;

// ---------------------------------------------------------------------------
// makeViewport — letterbox math
// ---------------------------------------------------------------------------

describe('makeViewport', () => {
  it('maps a square canvas with no margins', () => {
    const v = makeViewport(400, 400);
    expect(v.scale).toBe(400);
    expect(v.offsetX).toBe(0);
    expect(v.offsetY).toBe(0);
  });

  it('centers the unit square in a wide canvas with equal side margins', () => {
    const v = makeViewport(800, 400);
    expect(v.scale).toBe(400);
    expect(v.offsetX).toBe(200); // (800 - 400) / 2
    expect(v.offsetY).toBe(0);
  });

  it('centers the unit square in a tall canvas with equal top/bottom margins', () => {
    const v = makeViewport(400, 800);
    expect(v.scale).toBe(400);
    expect(v.offsetX).toBe(0);
    expect(v.offsetY).toBe(200); // (800 - 400) / 2
  });

  it('handles non-round dimensions', () => {
    const v = makeViewport(640, 360);
    expect(v.scale).toBe(360);
    expect(v.offsetX).toBe(140); // (640 - 360) / 2
    expect(v.offsetY).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// toScreen
// ---------------------------------------------------------------------------

describe('toScreen', () => {
  it('maps the origin to the letterbox top-left', () => {
    const v = makeViewport(800, 400);
    const s = toScreen({ x: 0, y: 0 }, v);
    expect(s.x).toBeCloseTo(200, 9);
    expect(s.y).toBeCloseTo(0, 9);
  });

  it('maps (1, 1) to the letterbox bottom-right', () => {
    const v = makeViewport(800, 400);
    const s = toScreen({ x: 1, y: 1 }, v);
    expect(s.x).toBeCloseTo(600, 9); // 200 + 400
    expect(s.y).toBeCloseTo(400, 9);
  });

  it('maps the center of the unit square to the canvas center', () => {
    const v = makeViewport(800, 400);
    const s = toScreen({ x: 0.5, y: 0.5 }, v);
    expect(s.x).toBeCloseTo(400, 9); // canvas center
    expect(s.y).toBeCloseTo(200, 9);
  });

  it('uses the full square for a square canvas', () => {
    const v = makeViewport(500, 500);
    const s = toScreen({ x: 1, y: 1 }, v);
    expect(s.x).toBeCloseTo(500, 9);
    expect(s.y).toBeCloseTo(500, 9);
  });
});

// ---------------------------------------------------------------------------
// toNorm
// ---------------------------------------------------------------------------

describe('toNorm', () => {
  it('inverts toScreen for the origin', () => {
    const v = makeViewport(800, 400);
    const n = toNorm({ x: 200, y: 0 }, v);
    expect(n.x).toBeCloseTo(0, 9);
    expect(n.y).toBeCloseTo(0, 9);
  });

  it('inverts toScreen for (1, 1)', () => {
    const v = makeViewport(800, 400);
    const n = toNorm({ x: 600, y: 400 }, v);
    expect(n.x).toBeCloseTo(1, 9);
    expect(n.y).toBeCloseTo(1, 9);
  });

  it('returns out-of-range values for points outside the letterbox', () => {
    const v = makeViewport(800, 400);
    const n = toNorm({ x: 100, y: 100 }, v); // left of the box
    expect(n.x).toBeLessThan(0);
  });

  it('returns {0,0} when the canvas is degenerate (scale 0)', () => {
    const v = makeViewport(0, 0);
    const n = toNorm({ x: 50, y: 50 }, v);
    expect(n).toEqual({ x: 0, y: 0 });
  });
});

// ---------------------------------------------------------------------------
// Round-trip — toNorm ∘ toScreen ≈ identity (unit-level; P8 covers the
// property test across many viewports)
// ---------------------------------------------------------------------------

describe('round-trip toNorm(toScreen(p))', () => {
  it('is the identity for a square viewport', () => {
    const v = makeViewport(500, 500);
    const p: NormPoint = { x: 0.3, y: 0.7 };
    const rt = toNorm(toScreen(p, v), v);
    expect(rt.x).toBeCloseTo(p.x, 9);
    expect(rt.y).toBeCloseTo(p.y, 9);
  });

  it('is the identity for a wide viewport', () => {
    const v = makeViewport(1920, 1080);
    const p: NormPoint = { x: 0.25, y: 0.9 };
    const rt = toNorm(toScreen(p, v), v);
    expect(rt.x).toBeCloseTo(p.x, 9);
    expect(rt.y).toBeCloseTo(p.y, 9);
  });

  it('is the identity for a tall viewport', () => {
    const v = makeViewport(300, 1200);
    const p: NormPoint = { x: 0.5, y: 0.5 };
    const rt = toNorm(toScreen(p, v), v);
    expect(rt.x).toBeCloseTo(p.x, 9);
    expect(rt.y).toBeCloseTo(p.y, 9);
  });

  it('is the identity at the corners', () => {
    const v = makeViewport(800, 400);
    for (const p of [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]) {
      const rt = toNorm(toScreen(p, v), v);
      expect(Math.abs(rt.x - p.x)).toBeLessThanOrEqual(EPS);
      expect(Math.abs(rt.y - p.y)).toBeLessThanOrEqual(EPS);
    }
  });
});

// ---------------------------------------------------------------------------
// distToSegment
// ---------------------------------------------------------------------------

describe('distToSegment', () => {
  const a: ScreenPoint = { x: 0, y: 0 };
  const b: ScreenPoint = { x: 10, y: 0 };

  it('returns 0 when the point is on the segment', () => {
    expect(distToSegment({ x: 5, y: 0 }, a, b)).toBeCloseTo(0, 9);
  });

  it('returns the perpendicular distance for a point off the segment', () => {
    expect(distToSegment({ x: 5, y: 3 }, a, b)).toBeCloseTo(3, 9);
  });

  it('returns the distance to endpoint a when projected before the segment', () => {
    expect(distToSegment({ x: -4, y: 3 }, a, b)).toBeCloseTo(5, 9); // 3-4-5
  });

  it('returns the distance to endpoint b when projected past the segment', () => {
    expect(distToSegment({ x: 13, y: 4 }, a, b)).toBeCloseTo(5, 9); // 3-4-5
  });

  it('handles a degenerate segment (a === b) as distance to the point', () => {
    expect(distToSegment({ x: 3, y: 4 }, a, a)).toBeCloseTo(5, 9);
  });

  it('works for a diagonal segment', () => {
    const d: ScreenPoint = { x: 0, y: 0 };
    const e: ScreenPoint = { x: 6, y: 8 }; // length 10
    // Point (0, 8): perpendicular foot is at t = (0*6 + 8*8)/100 = 0.64
    // closest = (3.84, 5.12), distance = sqrt(3.84^2 + 2.88^2) = 4.8
    expect(distToSegment({ x: 0, y: 8 }, d, e)).toBeCloseTo(4.8, 9);
  });
});
