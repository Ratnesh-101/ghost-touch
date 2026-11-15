import { describe, it, expect, vi } from 'vitest';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  initialAxisState,
  initialCentreTickState,
  initialState,
  processPointerMove,
} from '../src/flow/explore';
import { fallbackPulse, WebHapticDriver } from '../src/drivers/haptics';
import triangleJson from '../public/samples/triangle.json';

const scene = triangleJson as DiagramScene;
const view = makeViewport(400, 400);
const CORNER = [50, 90, 50];

function touch(x: number, y: number) {
  return processPointerMove(
    scene,
    { x, y },
    view,
    1000,
    initialState(),
    initialCentreTickState(),
    initialAxisState(),
  );
}

describe('sample triangle: every corner emits the corner pattern', () => {
  const corners = [
    { id: 'A', x: 100, y: 100 },
    { id: 'B', x: 280, y: 340 },
    { id: 'C', x: 100, y: 340 },
  ];
  for (const c of corners) {
    it(`corner ${c.id} -> vibrate [50,90,50] and speak`, () => {
      const r = touch(c.x, c.y);
      expect(r.target.kind).toBe('vertex');
      expect(r.effects).toContainEqual({ kind: 'vibrate', pattern: CORNER });
      expect(r.effects).toContainEqual({ kind: 'speak', text: c.id });
    });
  }
});

describe('sample triangle: every edge emits the 80 ms line buzz', () => {
  const edges = [
    { id: 'AB', x: 190, y: 220 },
    { id: 'BC', x: 190, y: 340 },
    { id: 'CA', x: 100, y: 220 },
  ];
  for (const e of edges) {
    it(`edge ${e.id} -> vibrate 80`, () => {
      const r = touch(e.x, e.y);
      expect(r.target.kind).toBe('line');
      expect(r.effects).toContainEqual({ kind: 'vibrate', pattern: 80 });
    });
  }
});

describe('WebHapticDriver array fallback', () => {
  it('computes a solid pulse from the active entries, min 100 ms', () => {
    expect(fallbackPulse(CORNER)).toBe(100);
    expect(fallbackPulse([80, 10, 80])).toBe(160);
    expect(fallbackPulse([10])).toBe(100);
    expect(fallbackPulse([])).toBe(100);
  });

  it('retries with a single pulse when the array pattern returns false', () => {
    const vibrate = vi.fn((p: number | number[]) => !Array.isArray(p));
    const driver = new WebHapticDriver({ vibrate });
    expect(driver.vibrate(CORNER)).toBe(true);
    expect(vibrate).toHaveBeenNthCalledWith(1, CORNER);
    expect(vibrate).toHaveBeenNthCalledWith(2, 100);
    expect(driver.lastResult).toBe(true);
  });

  it('retries with a single pulse when the array pattern throws', () => {
    const vibrate = vi.fn((p: number | number[]) => {
      if (Array.isArray(p)) throw new Error('array rejected');
      return true;
    });
    const driver = new WebHapticDriver({ vibrate });
    expect(driver.vibrate(CORNER)).toBe(true);
    expect(vibrate).toHaveBeenLastCalledWith(100);
  });

  it('does not retry when the array pattern succeeds', () => {
    const vibrate = vi.fn().mockReturnValue(true);
    new WebHapticDriver({ vibrate }).vibrate(CORNER);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(CORNER);
  });

  it('does not retry numeric patterns and reports false when everything fails', () => {
    const vibrate = vi.fn().mockReturnValue(false);
    const driver = new WebHapticDriver({ vibrate });
    expect(driver.vibrate(80)).toBe(false);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(driver.vibrate(CORNER)).toBe(false);
    expect(vibrate).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// Requirement 4.9 / P96 regression (task 50): a slow, shaky finger leaving a corner.
// ---------------------------------------------------------------------------

/** Small seeded PRNG so the jitter is the same on every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('sample triangle: a shaky finger leaving corner A along AC (Requirement 4.9)', () => {
  const A = { x: 100, y: 100 }; // 0.25 * 400
  const SPEED = 30; // px/s, downwards along AC (x stays 100)
  const DT = 1000 / 60;
  const JITTER = 2; // px, uniform in [-2, 2] on each axis
  const START_OFFSET = 18; // px below A: inside the 22 px vertex radius even with jitter

  function replay(seed: number) {
    const rand = mulberry32(seed);
    let engine = initialState();
    let centre = initialCentreTickState();
    let axis = initialAxisState();
    const t0 = 1000;
    let corners = 0;
    let speaks = 0;
    let cornerAt = -1;
    let firstLineBuzz = -1;
    let boundaryCrossings = 0;
    let wasVertex = false;
    for (let i = 0; i * DT <= 2000; i++) {
      const t = t0 + i * DT;
      const finger = {
        x: A.x + (rand() * 2 - 1) * JITTER,
        y: A.y + START_OFFSET + (SPEED * (i * DT)) / 1000 + (rand() * 2 - 1) * JITTER,
      };
      const r = processPointerMove(scene, finger, view, t, engine, centre, axis);
      engine = r.nextEngineState;
      centre = r.centreCheck.nextState;
      axis = r.nextAxisState;
      const isVertex = r.target.kind === 'vertex';
      if (wasVertex !== isVertex) boundaryCrossings++;
      wasVertex = isVertex;
      for (const e of r.effects) {
        if (e.kind === 'vibrate' && Array.isArray(e.pattern)) {
          corners++;
          if (cornerAt < 0) cornerAt = t;
        }
        if (e.kind === 'speak' && e.text === 'A') speaks++;
        if (e.kind === 'vibrate' && e.pattern === 80 && firstLineBuzz < 0) firstLineBuzz = t;
      }
    }
    return { corners, speaks, cornerAt, firstLineBuzz, boundaryCrossings };
  }

  for (const seed of [1, 2, 3, 7, 42, 2026]) {
    it(`seed ${seed}: one corner pattern, one "A", first line buzz within quietMs + retriggerMs`, () => {
      const r = replay(seed);
      expect(r.corners).toBe(1);
      expect(r.speaks).toBe(1);
      expect(r.firstLineBuzz).toBeGreaterThanOrEqual(r.cornerAt + 450);
      expect(r.firstLineBuzz).toBeLessThanOrEqual(r.cornerAt + 450 + 70 + 1000 / 60);
    });
  }

  it('the trace really does cross the vertex boundary more than once (the test is not vacuous)', () => {
    // At least one seed must flap at the boundary, otherwise a pass proves nothing.
    const flapped = [1, 2, 3, 7, 42, 2026].filter((s) => replay(s).boundaryCrossings > 2);
    expect(flapped.length).toBeGreaterThan(0);
  });
});
