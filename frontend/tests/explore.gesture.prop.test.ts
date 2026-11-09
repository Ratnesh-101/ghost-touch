/**
 * Property tests for the Explore gesture rules (Task 19.5, Requirement 13).
 *
 * P36  Centre tick fires once per excursion              (Req 13.3)
 * P37  Centre tick never lands in a corner quiet window,
 *      "Centre." is spoken at most once, and the engine
 *      never emits the centre-tick pattern                (Req 13.3, 4.5)
 * P38  Two-finger exit swipe accepts only fast downward,
 *      mostly vertical motion and never doubles as the
 *      Ask long-press                                     (Req 13.5, 13.6)
 *
 * Written by Kiro. The P12 integration test (explore.p12.test.ts) covers the
 * wiring; these tests cover the decision rules for any input sequence.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeViewport, toScreen } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  CENTRE_RADIUS_PX,
  CENTRE_REARM_RADIUS_PX,
  CENTRE_TICK_MS,
  DEFAULT_HAPTICS,
  DEFAULT_RADII,
  checkCentreTick,
  checkTwoFingerLongPress,
  checkTwoFingerSwipeDown,
  initialAxisState,
  initialCentreTickState,
  initialState,
  processPointerMove,
  rearmCentreTick,
  step,
  type CentreTickState,
  type PointerHistory,
} from '../src/flow/explore';

const scene: DiagramScene = {
  kind: 'geometry',
  title: 'Triangle ABC',
  points: [
    { id: 'A', x: 0.2, y: 0.2, label: 'Vertex A' },
    { id: 'B', x: 0.8, y: 0.2, label: 'Vertex B' },
    { id: 'C', x: 0.5, y: 0.8, label: 'Vertex C' },
  ],
  segments: [
    { id: 'AB', a: 'A', b: 'B', label: 'Base' },
    { id: 'BC', a: 'B', b: 'C', label: 'Side BC' },
    { id: 'CA', a: 'C', b: 'A', label: null },
  ],
};

/** Distances from the centre, weighted toward the interesting bands. */
const distanceArb = fc.oneof(
  { weight: 3, arbitrary: fc.double({ min: 0, max: CENTRE_RADIUS_PX, noNaN: true }) },
  { weight: 2, arbitrary: fc.double({ min: CENTRE_RADIUS_PX, max: CENTRE_REARM_RADIUS_PX, noNaN: true }) },
  { weight: 3, arbitrary: fc.double({ min: CENTRE_REARM_RADIUS_PX, max: 400, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, CENTRE_RADIUS_PX, CENTRE_REARM_RADIUS_PX) },
);

describe('P36 — Centre tick fires once per excursion (Requirement 13.3)', () => {
  /**
   * P36: for any sequence of distances from the centre, the tick only fires
   * inside the centre radius, and between two ticks the cursor must have left
   * the re-arm radius. A hold that never leaves the centre ticks exactly once.
   *
   * Validates: Requirement 13.3
   */
  it('ticks only inside the radius and only after leaving the re-arm radius (200+ runs)', () => {
    fc.assert(
      fc.property(fc.array(distanceArb, { minLength: 1, maxLength: 60 }), (distances) => {
        let state: CentreTickState = initialCentreTickState();
        let leftSinceLastTick = true;
        for (const d of distances) {
          const result = checkCentreTick(d, state, false, false);
          if (result.tick) {
            expect(d).toBeLessThanOrEqual(CENTRE_RADIUS_PX);
            expect(leftSinceLastTick).toBe(true);
            leftSinceLastTick = false;
          }
          if (d > CENTRE_REARM_RADIUS_PX) {
            expect(result.tick).toBe(false);
            expect(result.nextState.armed).toBe(true);
            leftSinceLastTick = true;
          }
          state = result.nextState;
        }
      }),
      { numRuns: 300 },
    );
  });

  it('a hold that stays at the centre ticks exactly once (200+ runs)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: CENTRE_RADIUS_PX, noNaN: true }), { minLength: 1, maxLength: 40 }),
        (distances) => {
          let state = initialCentreTickState();
          let ticks = 0;
          for (const d of distances) {
            const result = checkCentreTick(d, state, false, false);
            if (result.tick) ticks += 1;
            state = result.nextState;
          }
          expect(ticks).toBe(1);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('a new hold re-arms the tick (200+ runs)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: CENTRE_RADIUS_PX, noNaN: true }), (d) => {
        const first = checkCentreTick(d, initialCentreTickState(), false, true);
        expect(first.tick).toBe(true);
        const sameHold = checkCentreTick(d, first.nextState, false, false);
        expect(sameHold.tick).toBe(false);
        const secondHold = checkCentreTick(d, rearmCentreTick(first.nextState), false, true);
        expect(secondHold.tick).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

describe('P37 — Centre tick never merges with a corner (Requirements 13.3, 4.5)', () => {
  /**
   * P37a: whatever the quiet-window flag says per sample, a tick never fires
   * while it is set, and "Centre." is spoken at most once across any number
   * of holds, only together with a tick, and only on a new hold.
   */
  it('no tick inside the quiet window; "Centre." at most once (200+ runs)', () => {
    const sampleArb = fc.record({
      d: distanceArb,
      quiet: fc.boolean(),
      newHold: fc.boolean(),
    });
    fc.assert(
      fc.property(fc.array(sampleArb, { minLength: 1, maxLength: 80 }), (samples) => {
        let state = initialCentreTickState();
        let spoken = 0;
        for (const s of samples) {
          if (s.newHold) state = rearmCentreTick(state);
          const result = checkCentreTick(s.d, state, s.quiet, s.newHold);
          if (s.quiet) expect(result.tick).toBe(false);
          if (result.speakCentre) {
            expect(result.tick).toBe(true);
            expect(s.newHold).toBe(true);
            spoken += 1;
          }
          state = result.nextState;
        }
        expect(spoken).toBeLessThanOrEqual(1);
      }),
      { numRuns: 300 },
    );
  });

  /**
   * P37b: through the real hitTest, engine and tracker pipeline, for any
   * walk over the triangle (with lifts), a tick is never reported in a step
   * that emits the corner pattern or while the quiet window is still open, and
   * the engine never emits the centre-tick pattern itself, so the three
   * vocabularies stay distinct.
   */
  it('over any walk, tick and corner never share a step or a quiet window (200+ runs)', () => {
    const view = makeViewport(400, 400);
    const vertexScreens = (scene.points ?? []).map((p) => toScreen(p, view));
    const positionArb = fc.oneof(
      { weight: 4, arbitrary: fc.record({ x: fc.integer({ min: 0, max: 400 }), y: fc.integer({ min: 0, max: 400 }) }) },
      { weight: 2, arbitrary: fc.constantFrom(...vertexScreens) },
      { weight: 2, arbitrary: fc.constantFrom({ x: 200, y: 200 }, { x: 210, y: 195 }) },
    );
    const sampleArb = fc.record({
      pos: positionArb,
      dt: fc.integer({ min: 1, max: 120 }),
      lift: fc.boolean(),
    });
    const allowed = [DEFAULT_HAPTICS.lineMs, 0, DEFAULT_HAPTICS.cornerPattern];

    fc.assert(
      fc.property(fc.array(sampleArb, { minLength: 1, maxLength: 60 }), (samples) => {
        let engine = initialState();
        let centre = initialCentreTickState();
        let axis = initialAxisState();
        let t = 0;
        for (const s of samples) {
          t += s.dt;
          if (s.lift) {
            const lifted = step(engine, { kind: 'lift', t }, DEFAULT_HAPTICS);
            expect(lifted.effects).toContainEqual({ kind: 'vibrate', pattern: 0 });
            expect(lifted.effects).toContainEqual({ kind: 'tone', hz: null });
            engine = lifted.state;
            centre = rearmCentreTick(centre);
            continue;
          }
          const out = processPointerMove(scene, s.pos, view, t, engine, centre, axis, DEFAULT_RADII);
          const corner = out.effects.some(
            (e) => e.kind === 'vibrate' && Array.isArray(e.pattern) && e.pattern.length === 3,
          );
          if (out.centreCheck.tick) {
            expect(corner).toBe(false);
            expect(t).toBeGreaterThanOrEqual(out.nextEngineState.quietUntil);
          }
          for (const e of out.effects) {
            if (e.kind === 'vibrate') {
              expect(allowed).toContainEqual(e.pattern);
              expect(e.pattern).not.toBe(CENTRE_TICK_MS);
            }
          }
          engine = out.nextEngineState;
          centre = out.centreCheck.nextState;
          axis = out.nextAxisState;
        }
      }),
      { numRuns: 250 },
    );
  });

  it('the centre tick is shorter than every line and corner pulse', () => {
    expect(CENTRE_TICK_MS).toBeLessThan(DEFAULT_HAPTICS.lineMs);
    expect(CENTRE_TICK_MS).toBeLessThan(Math.min(...DEFAULT_HAPTICS.cornerPattern));
    expect(CENTRE_TICK_MS).toBeGreaterThan(0);
  });
});

describe('P38 — Two-finger exit swipe (Requirements 13.5, 13.6)', () => {
  const makeHistory = (
    startX: number,
    startY: number,
    startT: number,
    dx: number,
    dy: number,
    dt: number,
  ): PointerHistory => ({
    start: { x: startX, y: startY, t: startT },
    current: { x: startX + dx, y: startY + dy, t: startT + dt },
  });

  const translateHistory = (
    p: PointerHistory,
    tx: number,
    ty: number,
    tt: number,
  ): PointerHistory => ({
    start: { x: p.start.x + tx, y: p.start.y + ty, t: p.start.t + tt },
    current: { x: p.current.x + tx, y: p.current.y + ty, t: p.current.t + tt },
  });

  // Arbitrary start position and start time
  const touchStartArb = fc.record({
    x: fc.integer({ min: -500, max: 2000 }),
    y: fc.integer({ min: -500, max: 2000 }),
    t: fc.integer({ min: 0, max: 100_000 }),
  });

  // Valid downward swipe displacement and timing per finger (Requirement 13.5, 13.6)
  // dy >= 80px, 0 < dt <= 600ms, and horizontal drift |dx| <= dy * 0.5
  const validSwipeDeltaArb: fc.Arbitrary<{ dx: number; dy: number; dt: number }> = fc
    .record({
      dy: fc.integer({ min: 80, max: 500 }),
      dt: fc.integer({ min: 1, max: 600 }),
    })
    .chain(({ dy, dt }) => {
      const maxDx = Math.floor(dy * 0.5);
      return fc.record({
        dy: fc.constant(dy),
        dx: fc.integer({ min: -maxDx, max: maxDx }),
        dt: fc.constant(dt),
      });
    });

  it('P38: valid downward swipes from arbitrary positions and times always fire (200+ runs)', () => {
    fc.assert(
      fc.property(
        touchStartArb,
        validSwipeDeltaArb,
        touchStartArb,
        validSwipeDeltaArb,
        (s1, d1, s2, d2) => {
          const p1 = makeHistory(s1.x, s1.y, s1.t, d1.dx, d1.dy, d1.dt);
          const p2 = makeHistory(s2.x, s2.y, s2.t, d2.dx, d2.dy, d2.dt);
          expect(checkTwoFingerSwipeDown(p1, p2)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('P38: gesture is invariant under arbitrary 2D translation and time shift (200+ runs)', () => {
    const arbitraryDelta = fc.record({
      dx: fc.integer({ min: -300, max: 300 }),
      dy: fc.integer({ min: -300, max: 500 }),
      dt: fc.integer({ min: 0, max: 1500 }),
    });

    fc.assert(
      fc.property(
        touchStartArb,
        arbitraryDelta,
        touchStartArb,
        arbitraryDelta,
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -10_000, max: 10_000 }),
        (s1, d1, s2, d2, tx, ty, tt) => {
          const p1 = makeHistory(s1.x, s1.y, s1.t, d1.dx, d1.dy, d1.dt);
          const p2 = makeHistory(s2.x, s2.y, s2.t, d2.dx, d2.dy, d2.dt);
          const base = checkTwoFingerSwipeDown(p1, p2);
          const shifted = checkTwoFingerSwipeDown(
            translateHistory(p1, tx, ty, tt),
            translateHistory(p2, tx, ty, tt),
          );
          expect(shifted).toBe(base);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('P38: finger order symmetry — swapping finger order never changes outcome (200+ runs)', () => {
    const arbitraryDelta = fc.record({
      dx: fc.integer({ min: -300, max: 300 }),
      dy: fc.integer({ min: -300, max: 500 }),
      dt: fc.integer({ min: 0, max: 1500 }),
    });

    fc.assert(
      fc.property(
        touchStartArb,
        arbitraryDelta,
        touchStartArb,
        arbitraryDelta,
        (s1, d1, s2, d2) => {
          const p1 = makeHistory(s1.x, s1.y, s1.t, d1.dx, d1.dy, d1.dt);
          const p2 = makeHistory(s2.x, s2.y, s2.t, d2.dx, d2.dy, d2.dt);
          expect(checkTwoFingerSwipeDown(p1, p2)).toBe(checkTwoFingerSwipeDown(p2, p1));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('P38: never fires when either finger moves upward, too slowly, or drifts (200+ runs)', () => {
    const invalidDeltaArb: fc.Arbitrary<{ dx: number; dy: number; dt: number }> = fc.oneof(
      // Upward or neutral movement
      fc.record({
        dx: fc.integer({ min: -100, max: 100 }),
        dy: fc.integer({ min: -300, max: 0 }),
        dt: fc.integer({ min: 1, max: 500 }),
      }),
      // Downward but distance too short (< 80px)
      fc.record({
        dx: fc.integer({ min: -30, max: 30 }),
        dy: fc.integer({ min: 1, max: 79 }),
        dt: fc.integer({ min: 1, max: 500 }),
      }),
      // Downward distance ok, but too slow (> 600ms)
      fc.record({
        dx: fc.integer({ min: -10, max: 10 }),
        dy: fc.integer({ min: 80, max: 300 }),
        dt: fc.integer({ min: 601, max: 2000 }),
      }),
      // Excessive horizontal drift (|dx| > dy * 0.5)
      fc
        .record({
          dy: fc.integer({ min: 80, max: 300 }),
          driftExcess: fc.integer({ min: 1, max: 150 }),
          driftSign: fc.constantFrom(-1, 1),
          dt: fc.integer({ min: 1, max: 500 }),
        })
        .map(({ dy, driftExcess, driftSign, dt }) => ({
          dy,
          dx: Math.ceil(dy * 0.5 + driftExcess) * driftSign,
          dt,
        })),
    );

    fc.assert(
      fc.property(
        touchStartArb,
        invalidDeltaArb,
        touchStartArb,
        validSwipeDeltaArb,
        (s1, bad, s2, good) => {
          const badP = makeHistory(s1.x, s1.y, s1.t, bad.dx, bad.dy, bad.dt);
          const goodP = makeHistory(s2.x, s2.y, s2.t, good.dx, good.dy, good.dt);

          expect(checkTwoFingerSwipeDown(badP, goodP)).toBe(false);
          expect(checkTwoFingerSwipeDown(goodP, badP)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('a long enough, quick, purely vertical drop always fires (200+ runs)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 80, max: 400 }),
        fc.integer({ min: 80, max: 400 }),
        fc.integer({ min: 0, max: 600 }),
        (d1, d2, dt) => {
          const p1 = makeHistory(100, 100, 1000, 0, d1, dt);
          const p2 = makeHistory(200, 100, 1000, 0, d2, dt);
          expect(checkTwoFingerSwipeDown(p1, p2)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('exit swipe and Ask long-press are mutually exclusive (200+ runs)', () => {
    const fingerArb = fc.record({
      dx: fc.integer({ min: -200, max: 200 }),
      dy: fc.integer({ min: -200, max: 300 }),
      dt: fc.integer({ min: 0, max: 1500 }),
    });
    fc.assert(
      fc.property(fingerArb, fingerArb, fc.integer({ min: 0, max: 2000 }), (a, b, extra) => {
        const p1 = makeHistory(100, 100, 1000, a.dx, a.dy, a.dt);
        const p2 = makeHistory(200, 100, 1000, b.dx, b.dy, b.dt);
        const now = 1000 + Math.max(a.dt, b.dt) + extra;
        const swipe = checkTwoFingerSwipeDown(p1, p2);
        const press = checkTwoFingerLongPress(p1, p2, now);
        expect(swipe && press).toBe(false);
      }),
      { numRuns: 400 },
    );
  });
});
