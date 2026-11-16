/**
 * Stay on line switch and sticky line wiring tests (Lane bu12 / Task T58b).
 *
 * Verifies:
 * 1. Switch default off
 * 2. Off equals today's output for a scripted triangle trace
 * 3. On keeps the line target when the finger drifts 18 px off after 300 ms
 * 4. First touch still needs the normal line radius
 * 5. Resets on lift (and cancel, blur, Ask, Guide)
 * 6. The keep-alive timer still works
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import type { Target } from '../src/core/hitTest';
import {
  DEFAULT_HAPTICS,
  DEFAULT_PROXIMITY,
  DEFAULT_RADII,
  initialAxisState,
  initialCentreTickState,
  initialHeartbeatState,
  initialPageEdgeState,
  initialProximityState,
  initialState,
  initialStickyHoldState,
  KEEP_ALIVE_INTERVAL_MS,
  processPointerMove,
  resetStickyHoldOnLift,
  shouldKeepAlive,
  STICKY_HOLD_MS,
  STICKY_RADIUS_PX,
  getHeldMs,
  updateStickyHoldState,
  getStoredStickyLineSetting,
  setStoredStickyLineSetting,
  _resetStickyLineSettingForTesting,
  STORAGE_KEY_STICKY_LINE,
  type ProcessPointerMoveStickyOptions,
} from '../src/flow/explore';

const triangleScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle',
  points: [
    { id: 'A', x: 0.5, y: 0.15, label: 'Point A' },
    { id: 'B', x: 0.15, y: 0.85, label: 'Point B' },
    { id: 'C', x: 0.85, y: 0.85, label: 'Point C' },
  ],
  segments: [
    { id: 's1', a: 'A', b: 'B' },
    { id: 's2', a: 'B', b: 'C' }, // Horizontal line at y=0.85 (screen y=340 in 400x400)
    { id: 's3', a: 'C', b: 'A' },
  ],
};

const view = makeViewport(400, 400);

describe('Stay on line wiring (Lane bu12 / Task T58b)', () => {
  beforeEach(() => {
    _resetStickyLineSettingForTesting();
  });

  afterEach(() => {
    _resetStickyLineSettingForTesting();
  });

  // 1. Switch default off
  describe('1. switch default off', () => {
    it('storage key is STORAGE_KEY_STICKY_LINE and defaults to false', () => {
      expect(STORAGE_KEY_STICKY_LINE).toBe('gt_sticky_line_enabled');
      expect(getStoredStickyLineSetting()).toBe(false);
    });

    it('can be set to true and persists, then resets back to false for testing', () => {
      setStoredStickyLineSetting(true);
      expect(getStoredStickyLineSetting()).toBe(true);
      setStoredStickyLineSetting(false);
      expect(getStoredStickyLineSetting()).toBe(false);

      setStoredStickyLineSetting(true);
      _resetStickyLineSettingForTesting();
      expect(getStoredStickyLineSetting()).toBe(false);
    });

    it('proposes STICKY_HOLD_MS as 200 ms and STICKY_RADIUS_PX as 24 px from core', () => {
      expect(STICKY_HOLD_MS).toBe(200);
      expect(STICKY_RADIUS_PX).toBe(24);
    });
  });

  // 2. Off equals today's output for a scripted triangle trace
  describe("2. off equals today's output for a scripted triangle trace", () => {
    it("matches today's un-wired output byte-for-byte across a scripted triangle trace", () => {
      // Trace steps:
      // Step 1 (t=100): on segment s1 at (130, 250) -> line buzz
      // Step 2 (t=200): at vertex A at (200, 60) -> corner pulse
      // Step 3 (t=400): on segment s2 at (200, 340) -> inside quiet window (400 < 650)
      // Step 4 (t=700): on segment s2 at (200, 340) -> line buzz resumes
      // Step 5 (t=800): finger drifts 18 px off segment s2 to (200, 358) -> outside normal radius 14 px

      const tracePoints = [
        { t: 100, pt: { x: 130, y: 250 } },
        { t: 200, pt: { x: 200, y: 60 } },
        { t: 400, pt: { x: 200, y: 340 } },
        { t: 700, pt: { x: 200, y: 340 } },
        { t: 800, pt: { x: 200, y: 358 } }, // 18 px off s2
      ];

      // A: Baseline without sticky wiring (today's output)
      let engA = initialState();
      let centreA = initialCentreTickState();
      let axisA = initialAxisState();
      let proxA = initialProximityState();
      const resultsBaseline = tracePoints.map(({ t, pt }) => {
        const r = processPointerMove(
          triangleScene,
          pt,
          view,
          t,
          engA,
          centreA,
          axisA,
          DEFAULT_RADII,
          DEFAULT_HAPTICS,
          proxA,
          DEFAULT_PROXIMITY,
        );
        engA = r.nextEngineState;
        centreA = r.centreCheck.nextState;
        axisA = r.nextAxisState;
        proxA = r.proximityState;
        return { target: r.target, effects: r.effects };
      });

      // B: With switch OFF explicitly (sticky.enabled = false)
      let engB = initialState();
      let centreB = initialCentreTickState();
      let axisB = initialAxisState();
      let proxB = initialProximityState();
      let prevTargetB: Target = { kind: 'none' };
      let stickyHoldB = initialStickyHoldState();

      const resultsOff = tracePoints.map(({ t, pt }) => {
        const heldMs = getHeldMs(stickyHoldB, prevTargetB, t);
        const stickyOpts: ProcessPointerMoveStickyOptions = {
          enabled: false, // Switch is OFF
          prevTarget: prevTargetB,
          heldMs,
          stickyRadiusPx: STICKY_RADIUS_PX,
        };
        const r = processPointerMove(
          triangleScene,
          pt,
          view,
          t,
          engB,
          centreB,
          axisB,
          DEFAULT_RADII,
          DEFAULT_HAPTICS,
          proxB,
          DEFAULT_PROXIMITY,
          initialHeartbeatState(),
          null,
          initialPageEdgeState(),
          stickyOpts,
        );
        engB = r.nextEngineState;
        centreB = r.centreCheck.nextState;
        axisB = r.nextAxisState;
        proxB = r.proximityState;
        stickyHoldB = updateStickyHoldState(stickyHoldB, r.target, t);
        prevTargetB = r.target;
        return { target: r.target, effects: r.effects };
      });

      // Byte-identical check: every target and effect matches
      expect(resultsOff).toEqual(resultsBaseline);

      // Verify that at t=800, 18 px off segment s2 returns 'none' when off
      expect(resultsOff[4]!.target).toEqual({ kind: 'none' });
      expect(resultsOff[4]!.effects.filter((e) => e.kind === 'vibrate')).toEqual([
        { kind: 'vibrate', pattern: 0 },
      ]);
    });
  });

  // 3. On keeps the line target when the finger drifts 18 px off after 300 ms
  describe('3. on keeps the line target when the finger drifts 18 px off after 300 ms', () => {
    it('sticks to the line target when held for 300 ms and finger drifts 18 px off', () => {
      let eng = initialState();
      let centre = initialCentreTickState();
      let axis = initialAxisState();
      let prox = initialProximityState();
      let prevTarget: Target = { kind: 'none' };
      let stickyHold = initialStickyHoldState();

      // Step 1: Touch on segment s2 at t=100 (y=340)
      const t1 = 100;
      const pt1 = { x: 200, y: 340 };
      const heldMs1 = getHeldMs(stickyHold, prevTarget, t1);
      const r1 = processPointerMove(
        triangleScene,
        pt1,
        view,
        t1,
        eng,
        centre,
        axis,
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        prox,
        DEFAULT_PROXIMITY,
        initialHeartbeatState(),
        null,
        initialPageEdgeState(),
        {
          enabled: true,
          prevTarget,
          heldMs: heldMs1,
          stickyRadiusPx: STICKY_RADIUS_PX,
        },
      );
      eng = r1.nextEngineState;
      centre = r1.centreCheck.nextState;
      axis = r1.nextAxisState;
      prox = r1.proximityState;
      stickyHold = updateStickyHoldState(stickyHold, r1.target, t1);
      prevTarget = r1.target;

      expect(r1.target).toEqual({ kind: 'line', id: 's2', elementKind: 'segment' });
      expect(stickyHold.lineTarget?.id).toBe('s2');
      expect(stickyHold.enterTime).toBe(100);

      // Step 2: Finger holds on line until t=400 (300 ms held, >= STICKY_HOLD_MS 200)
      // Finger drifts 18 px off line s2 to y=358 (normal line radius = 14 px, sticky radius = 24 px)
      const t2 = 400;
      const pt2 = { x: 200, y: 358 };
      const heldMs2 = getHeldMs(stickyHold, prevTarget, t2);
      expect(heldMs2).toBe(300);

      const r2 = processPointerMove(
        triangleScene,
        pt2,
        view,
        t2,
        eng,
        centre,
        axis,
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        prox,
        DEFAULT_PROXIMITY,
        initialHeartbeatState(),
        null,
        initialPageEdgeState(),
        {
          enabled: true,
          prevTarget,
          heldMs: heldMs2,
          stickyRadiusPx: STICKY_RADIUS_PX,
        },
      );

      // FAILS if wiring removed: without followTarget, hitTest returns { kind: 'none' }
      expect(r2.target).toEqual({ kind: 'line', id: 's2', elementKind: 'segment' });
      // Line buzz continues!
      expect(r2.effects).toContainEqual({
        kind: 'vibrate',
        pattern: DEFAULT_HAPTICS.lineMs,
      });

      // If finger drifts 30 px off (> 24 px sticky radius), sticky no longer holds
      const t3 = 450;
      const pt3 = { x: 200, y: 370 }; // 30 px off
      const heldMs3 = getHeldMs(stickyHold, prevTarget, t3);
      const r3 = processPointerMove(
        triangleScene,
        pt3,
        view,
        t3,
        r2.nextEngineState,
        r2.centreCheck.nextState,
        r2.nextAxisState,
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        r2.proximityState,
        DEFAULT_PROXIMITY,
        initialHeartbeatState(),
        null,
        initialPageEdgeState(),
        {
          enabled: true,
          prevTarget: r2.target,
          heldMs: heldMs3,
          stickyRadiusPx: STICKY_RADIUS_PX,
        },
      );
      expect(r3.target).toEqual({ kind: 'none' });
    });
  });

  // 4. First touch still needs the normal line radius
  describe('4. first touch still needs the normal line radius', () => {
    it('does not acquire a line when first touch lands 18 px away (outside normal 14 px radius)', () => {
      // First touch: prevTarget is { kind: 'none' }, heldMs is 0
      const prevTarget: Target = { kind: 'none' };
      const stickyHold = resetStickyHoldOnLift();
      const heldMs = getHeldMs(stickyHold, prevTarget, 100);
      expect(heldMs).toBe(0);

      // Touch lands at (200, 358), which is 18 px off segment s2 (y=340)
      const r = processPointerMove(
        triangleScene,
        { x: 200, y: 358 },
        view,
        100,
        initialState(),
        initialCentreTickState(),
        initialAxisState(),
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        initialProximityState(),
        DEFAULT_PROXIMITY,
        initialHeartbeatState(),
        null,
        initialPageEdgeState(),
        {
          enabled: true,
          prevTarget,
          heldMs,
          stickyRadiusPx: STICKY_RADIUS_PX,
        },
      );

      // Acquisition is unchanged: returns none!
      expect(r.target).toEqual({ kind: 'none' });
      expect(r.effects.filter((e) => e.kind === 'vibrate')).toEqual([]);
    });

    it('acquires the line normally when first touch lands within 14 px', () => {
      const prevTarget: Target = { kind: 'none' };
      const stickyHold = resetStickyHoldOnLift();
      const heldMs = getHeldMs(stickyHold, prevTarget, 100);

      // Touch lands at (200, 348), which is 8 px off segment s2 (within 14 px)
      const r = processPointerMove(
        triangleScene,
        { x: 200, y: 348 },
        view,
        100,
        initialState(),
        initialCentreTickState(),
        initialAxisState(),
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        initialProximityState(),
        DEFAULT_PROXIMITY,
        initialHeartbeatState(),
        null,
        initialPageEdgeState(),
        {
          enabled: true,
          prevTarget,
          heldMs,
          stickyRadiusPx: STICKY_RADIUS_PX,
        },
      );

      expect(r.target).toEqual({ kind: 'line', id: 's2', elementKind: 'segment' });
      expect(r.effects).toContainEqual({
        kind: 'vibrate',
        pattern: DEFAULT_HAPTICS.lineMs,
      });
    });
  });

  // 5. Resets on lift
  describe('5. resets on lift (and cancel, blur, Ask, Guide)', () => {
    it('resets sticky hold state on lift so subsequent touch at 18 px off does not stick', () => {
      // 1. Establish hold on segment s2 for 300 ms
      let stickyHold = initialStickyHoldState();
      stickyHold = updateStickyHoldState(
        stickyHold,
        { kind: 'line', id: 's2', elementKind: 'segment' },
        100,
      );
      let prevTarget: Target = { kind: 'line', id: 's2', elementKind: 'segment' };

      expect(getHeldMs(stickyHold, prevTarget, 400)).toBe(300);

      // 2. Lift occurs
      stickyHold = resetStickyHoldOnLift();
      prevTarget = { kind: 'none' };

      // 3. Next touch at t=500 lands at 18 px off segment s2
      const heldMs = getHeldMs(stickyHold, prevTarget, 500);
      expect(heldMs).toBe(0);

      const r = processPointerMove(
        triangleScene,
        { x: 200, y: 358 },
        view,
        500,
        initialState(),
        initialCentreTickState(),
        initialAxisState(),
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        initialProximityState(),
        DEFAULT_PROXIMITY,
        initialHeartbeatState(),
        null,
        initialPageEdgeState(),
        {
          enabled: true,
          prevTarget,
          heldMs,
          stickyRadiusPx: STICKY_RADIUS_PX,
        },
      );

      expect(r.target).toEqual({ kind: 'none' });
    });

    it('resets hold timer on lift so a re-touch held for only 50 ms cannot stick', () => {
      // 1. Finger held s2 for 300 ms
      let stickyHold = updateStickyHoldState(
        initialStickyHoldState(),
        { kind: 'line', id: 's2', elementKind: 'segment' },
        100,
      );
      // Lift
      stickyHold = resetStickyHoldOnLift();
      let prevTarget: Target = { kind: 'none' };

      // 2. Finger re-touches line s2 at t=500
      stickyHold = updateStickyHoldState(
        stickyHold,
        { kind: 'line', id: 's2', elementKind: 'segment' },
        500,
      );
      prevTarget = { kind: 'line', id: 's2', elementKind: 'segment' };

      // 3. At t=550 (only 50 ms after re-touch, 50 < 200 STICKY_HOLD_MS), finger drifts 18 px off
      const heldMs = getHeldMs(stickyHold, prevTarget, 550);
      expect(heldMs).toBe(50);

      const r = processPointerMove(
        triangleScene,
        { x: 200, y: 358 },
        view,
        550,
        initialState(),
        initialCentreTickState(),
        initialAxisState(),
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        initialProximityState(),
        DEFAULT_PROXIMITY,
        initialHeartbeatState(),
        null,
        initialPageEdgeState(),
        {
          enabled: true,
          prevTarget,
          heldMs,
          stickyRadiusPx: STICKY_RADIUS_PX,
        },
      );

      // Not sticky yet because 50 ms < 200 ms!
      expect(r.target).toEqual({ kind: 'none' });
    });

    it('resets sticky hold state when entering a vertex, switching lines, or leaving lines', () => {
      let stickyHold = updateStickyHoldState(
        initialStickyHoldState(),
        { kind: 'line', id: 's2', elementKind: 'segment' },
        100,
      );

      // Enters vertex -> resets
      stickyHold = updateStickyHoldState(
        stickyHold,
        { kind: 'vertex', id: 'C', label: 'Point C' },
        400,
      );
      expect(stickyHold.lineTarget).toBeNull();
      expect(stickyHold.enterTime).toBe(0);

      // Enters line s3 at 500
      stickyHold = updateStickyHoldState(
        stickyHold,
        { kind: 'line', id: 's3', elementKind: 'segment' },
        500,
      );
      expect(stickyHold.lineTarget?.id).toBe('s3');
      expect(stickyHold.enterTime).toBe(500);

      // Switches directly to line s1 at 600
      stickyHold = updateStickyHoldState(
        stickyHold,
        { kind: 'line', id: 's1', elementKind: 'segment' },
        600,
      );
      expect(stickyHold.lineTarget?.id).toBe('s1');
      expect(stickyHold.enterTime).toBe(600); // re-armed for s1
    });
  });

  // 6. The keep-alive timer still works
  describe('6. the keep-alive timer still works', () => {
    it('maintains line target and line buzz on stationary keep-alive tick when in sticky radius', () => {
      let eng = initialState();
      let centre = initialCentreTickState();
      let axis = initialAxisState();
      let prox = initialProximityState();
      let stickyHold = initialStickyHoldState();
      let prevTarget: Target = { kind: 'none' };

      // 1. Touch on s2 at t=100
      stickyHold = updateStickyHoldState(
        stickyHold,
        { kind: 'line', id: 's2', elementKind: 'segment' },
        100,
      );
      prevTarget = { kind: 'line', id: 's2', elementKind: 'segment' };

      // 2. Drift to 18 px off at t=400 (300 ms hold)
      const t400 = 400;
      const coords = { x: 200, y: 358 };
      const heldMs400 = getHeldMs(stickyHold, prevTarget, t400);
      const r1 = processPointerMove(
        triangleScene,
        coords,
        view,
        t400,
        eng,
        centre,
        axis,
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        prox,
        DEFAULT_PROXIMITY,
        initialHeartbeatState(),
        null,
        initialPageEdgeState(),
        {
          enabled: true,
          prevTarget,
          heldMs: heldMs400,
          stickyRadiusPx: STICKY_RADIUS_PX,
        },
      );
      eng = r1.nextEngineState;
      centre = r1.centreCheck.nextState;
      axis = r1.nextAxisState;
      prox = r1.proximityState;
      stickyHold = updateStickyHoldState(stickyHold, r1.target, t400);
      prevTarget = r1.target;

      expect(r1.target.kind).toBe('line');

      // 3. Stationary finger rests at (200, 358).
      // Keep-alive checks: shouldKeepAlive(400, 460) is true
      expect(shouldKeepAlive(400, 460, KEEP_ALIVE_INTERVAL_MS)).toBe(true);

      // Keep-alive timer fires tick at t=460 (60 ms later)
      const t460 = 460;
      const heldMs460 = getHeldMs(stickyHold, prevTarget, t460);
      expect(heldMs460).toBe(360);

      const rKeepAlive = processPointerMove(
        triangleScene,
        coords,
        view,
        t460,
        eng,
        centre,
        axis,
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        prox,
        DEFAULT_PROXIMITY,
        initialHeartbeatState(),
        null,
        initialPageEdgeState(),
        {
          enabled: true,
          prevTarget,
          heldMs: heldMs460,
          stickyRadiusPx: STICKY_RADIUS_PX,
        },
      );

      // Target remains s2 while stationary within sticky radius (within retrigger window, no new buzz yet)
      expect(rKeepAlive.target).toEqual({ kind: 'line', id: 's2', elementKind: 'segment' });
      expect(rKeepAlive.effects.filter((e) => e.kind === 'vibrate')).toEqual([]);

      // Subsequent tick at t=520 (another 60 ms later)
      const t520 = 520;
      const heldMs520 = getHeldMs(stickyHold, rKeepAlive.target, t520);
      expect(heldMs520).toBe(420);

      const rKeepAlive2 = processPointerMove(
        triangleScene,
        coords,
        view,
        t520,
        rKeepAlive.nextEngineState,
        rKeepAlive.centreCheck.nextState,
        rKeepAlive.nextAxisState,
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        rKeepAlive.proximityState,
        DEFAULT_PROXIMITY,
        initialHeartbeatState(),
        null,
        initialPageEdgeState(),
        {
          enabled: true,
          prevTarget: rKeepAlive.target,
          heldMs: heldMs520,
          stickyRadiusPx: STICKY_RADIUS_PX,
        },
      );

      expect(rKeepAlive2.target).toEqual({ kind: 'line', id: 's2', elementKind: 'segment' });
      expect(rKeepAlive2.effects).toContainEqual({
        kind: 'vibrate',
        pattern: DEFAULT_HAPTICS.lineMs,
      });
    });
  });
});
