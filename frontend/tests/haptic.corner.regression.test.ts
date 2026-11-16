import { describe, it, expect, vi } from 'vitest';
import { makeViewport, toScreen } from '../src/core/geometry';
import type { Viewport } from '../src/core/geometry';
import type { EngineState } from '../src/core/hapticEngine';
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

// ---------------------------------------------------------------------------
// Adopted from outside PR 36 (drv653), fixed in task 57: edge <-> corner transitions
// and viewports, now asserted on the engine's effects through the quiet window.
// ---------------------------------------------------------------------------

type Step = ReturnType<typeof processPointerMove>;
/** Result of run(): array-like, with the first seven steps known to exist (noUncheckedIndexedAccess). */
type Steps = Step[] & Record<0 | 1 | 2 | 3 | 4 | 5 | 6, Step>;

/** Runs a trace through processPointerMove, threading the engine, centre and axis state. */
function run(vp: Viewport, trace: { x: number; y: number; t: number }[]): Steps {
  let engine: EngineState = initialState();
  let centre = initialCentreTickState();
  let axis = initialAxisState();
  const out: Step[] = [];
  for (const s of trace) {
    const r = processPointerMove(scene, { x: s.x, y: s.y }, vp, s.t, engine, centre, axis);
    engine = r.nextEngineState;
    centre = r.centreCheck.nextState;
    axis = r.nextAxisState;
    out.push(r);
  }
  return out as Steps;
}

const hasCorner = (r: Step) =>
  r.effects.some((e) => e.kind === 'vibrate' && Array.isArray(e.pattern));
const hasLineBuzz = (r: Step) => r.effects.some((e) => e.kind === 'vibrate' && e.pattern === 80);
const speaks = (r: Step, text: string) =>
  r.effects.some((e) => e.kind === 'speak' && e.text === text);

describe('sample triangle: edge, corner, edge through the quiet window', () => {
  it('AB to corner B to BC: no buzz inside 450 ms, buzz again from t = 1550', () => {
    const [ab, b, bcQuiet, bcAt1549, bcAt1550] = run(view, [
      { x: 190, y: 220, t: 1000 }, // on AB
      { x: 280, y: 340, t: 1100 }, // vertex B, quietUntil = 1550
      { x: 190, y: 340, t: 1200 }, // on BC, inside the window
      { x: 190, y: 340, t: 1549 }, // last millisecond of the window
      { x: 190, y: 340, t: 1550 }, // window over
    ]);
    expect(ab.target.kind).toBe('line');
    expect(hasLineBuzz(ab)).toBe(true);
    expect(b.target.kind).toBe('vertex');
    expect(b.effects).toContainEqual({ kind: 'vibrate', pattern: CORNER });
    expect(speaks(b, 'B')).toBe(true);
    expect(bcQuiet.target.kind).toBe('line');
    expect(hasLineBuzz(bcQuiet)).toBe(false);
    expect(hasLineBuzz(bcAt1549)).toBe(false);
    expect(hasLineBuzz(bcAt1550)).toBe(true);
  });

  it('BC to corner C to CA: no buzz at t=1200 or 1549, buzz resumes at 1550, not retriggered at 1600', () => {
    const [bc, c, caQuiet, caAt1549, caAt1550, caAt1600] = run(view, [
      { x: 190, y: 340, t: 1000 }, // on BC
      { x: 100, y: 340, t: 1100 }, // vertex C, quietUntil = 1550
      { x: 100, y: 220, t: 1200 }, // on CA, inside the window
      { x: 100, y: 220, t: 1549 },
      { x: 100, y: 220, t: 1550 },
      { x: 100, y: 220, t: 1600 },
    ]);
    expect(bc.target.kind).toBe('line');
    expect(hasLineBuzz(bc)).toBe(true);
    expect(c.target.kind).toBe('vertex');
    expect(c.effects).toContainEqual({ kind: 'vibrate', pattern: CORNER });
    expect(speaks(c, 'C')).toBe(true);
    expect(caQuiet.target.kind).toBe('line');
    expect(hasLineBuzz(caQuiet)).toBe(false);
    expect(hasLineBuzz(caAt1549)).toBe(false);
    expect(hasLineBuzz(caAt1550)).toBe(true);
    expect(caAt1600.target.kind).toBe('line');
    expect(hasLineBuzz(caAt1600)).toBe(false); // 50 ms after the last buzz
  });

  it('staying on corner C emits the corner pattern once, not on every move', () => {
    const rs = run(view, [
      { x: 100, y: 340, t: 1000 },
      { x: 101, y: 339, t: 1020 },
      { x: 99, y: 341, t: 1040 },
    ]);
    expect(rs.filter(hasCorner)).toHaveLength(1);
    expect(rs.filter((r) => speaks(r, 'C'))).toHaveLength(1);
  });

  it('holding corner C across the end of its quiet window does not fire it again', () => {
    const rs = run(view, [
      { x: 100, y: 340, t: 1000 }, // quietUntil = 1450
      { x: 100, y: 340, t: 1300 },
      { x: 100, y: 340, t: 1500 }, // window over, finger never left
      { x: 101, y: 340, t: 1700 },
    ]);
    expect(rs.filter(hasCorner)).toHaveLength(1);
    expect(rs.filter((r) => speaks(r, 'C'))).toHaveLength(1);
  });
});

describe('sample triangle: re-entering a corner (Requirement 4.9 / P96)', () => {
  it('leave C onto CA and come back inside the window: no pattern, no label, window kept', () => {
    const rs = run(view, [
      { x: 100, y: 340, t: 1000 }, // vertex C, quietUntil = 1450
      { x: 100, y: 220, t: 1100 }, // CA, quiet
      { x: 100, y: 340, t: 1200 }, // back on C inside the window
      { x: 100, y: 220, t: 1300 }, // CA again, still quiet
      { x: 100, y: 220, t: 1450 }, // window of the FIRST pulse is over
    ]);
    const [first, , reentry, , after] = rs;
    expect(hasCorner(first)).toBe(true);
    expect(first.nextEngineState.quietUntil).toBe(1450);
    expect(reentry.target.kind).toBe('vertex');
    expect(hasCorner(reentry)).toBe(false);
    expect(reentry.effects.some((e) => e.kind === 'speak')).toBe(false);
    expect(reentry.nextEngineState.quietUntil).toBe(1450); // not pushed out to 1650
    expect(rs.filter(hasCorner)).toHaveLength(1);
    expect(hasLineBuzz(rs[3])).toBe(false);
    expect(hasLineBuzz(after)).toBe(true); // proves the window was not extended
  });

  it('re-entry at or after the window end fires the corner pattern and label again', () => {
    const rs = run(view, [
      { x: 100, y: 340, t: 1000 }, // vertex C, quietUntil = 1450
      { x: 100, y: 220, t: 1500 }, // CA after the window: buzz
      { x: 100, y: 340, t: 1600 }, // back on C
    ]);
    expect(hasLineBuzz(rs[1])).toBe(true);
    expect(hasCorner(rs[2])).toBe(true);
    expect(speaks(rs[2], 'C')).toBe(true);
  });

  it('a different corner inside the window always fires', () => {
    const rs = run(view, [
      { x: 100, y: 340, t: 1000 }, // C
      { x: 280, y: 340, t: 1100 }, // B, 100 ms later, inside the window
    ]);
    expect(hasCorner(rs[1])).toBe(true);
    expect(speaks(rs[1], 'B')).toBe(true);
    expect(rs[1].nextEngineState.quietUntil).toBe(1550);
  });
});

describe('sample triangle: responsive viewports and orientations', () => {
  const viewports = [
    { name: 'Samsung Galaxy S24+ portrait (412x915)', vp: makeViewport(412, 915) },
    { name: 'Mobile landscape (915x412)', vp: makeViewport(915, 412) },
    { name: 'Tablet portrait (768x1024)', vp: makeViewport(768, 1024) },
    { name: 'Desktop widescreen (1280x800)', vp: makeViewport(1280, 800) },
  ];
  const norm = (id: string) => {
    const p = (scene.points ?? []).find((q) => q.id === id)!;
    return { x: p.x, y: p.y };
  };
  const mid = (a: string, b: string) => ({
    x: (norm(a).x + norm(b).x) / 2,
    y: (norm(a).y + norm(b).y) / 2,
  });

  for (const { name, vp } of viewports) {
    it(`feels the same on ${name}: line buzz, corner once, quiet window, then buzz`, () => {
      const s = (n: { x: number; y: number }, t: number) => ({ ...toScreen(n, vp), t });
      const rs = run(vp, [
        s(mid('A', 'B'), 1000), // on AB
        s(norm('B'), 1100), // vertex B, quietUntil = 1550
        s(norm('B'), 1150), // still on B
        s(mid('B', 'C'), 1200), // on BC inside the window
        s(norm('B'), 1300), // jitter back onto B (Requirement 4.9)
        s(mid('B', 'C'), 1600), // BC after the window
        s(norm('C'), 1700), // a different vertex
      ]);
      const [ab, b, bAgain, bcQuiet, bBack, bcLate, c] = rs;
      expect(ab.target.kind).toBe('line');
      expect(hasLineBuzz(ab)).toBe(true);
      expect(b.target.kind).toBe('vertex');
      expect(b.effects).toContainEqual({ kind: 'vibrate', pattern: CORNER });
      expect(speaks(b, 'B')).toBe(true);
      expect(bAgain.effects.filter((e) => e.kind === 'vibrate')).toEqual([]);
      expect(bcQuiet.target.kind).toBe('line');
      expect(hasLineBuzz(bcQuiet)).toBe(false);
      expect(hasCorner(bBack)).toBe(false);
      expect(bBack.effects.some((e) => e.kind === 'speak')).toBe(false);
      expect(bcLate.target.kind).toBe('line');
      expect(hasLineBuzz(bcLate)).toBe(true);
      expect(c.effects).toContainEqual({ kind: 'vibrate', pattern: CORNER });
      expect(speaks(c, 'C')).toBe(true);
      expect(rs.filter(hasCorner)).toHaveLength(2); // B once, C once
    });
  }
});
