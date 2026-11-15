import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeViewport, toNorm, toScreen, type ScreenPoint, type Viewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  CENTRE_TICK_MS,
  createHoldKeepAliveTimer,
  initialAxisState,
  initialCentreTickState,
  initialState,
  KEEP_ALIVE_INTERVAL_MS,
  mergeAnnouncements,
  processPointerMove,
  rearmCentreTick,
  seedAxisState,
  step,
  type EngineState,
  type MovePipelineResult,
} from '../src/flow/explore';
import { MemoryDiagramStore, runEffects, type Drivers } from '../src/drivers';

/**
 * Right triangle ABC sample from frontend/public/samples/triangle.json:
 * - Vertex A: (0.25, 0.25)
 * - Vertex B: (0.7, 0.85)
 * - Vertex C: (0.25, 0.85), right angle at C
 * - Segment CA: vertical segment along x = 0.25, connecting C (y = 0.85) and A (y = 0.25)
 */
const triangleSample: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle ABC',
  points: [
    { id: 'A', x: 0.25, y: 0.25, label: 'A' },
    { id: 'B', x: 0.7, y: 0.85, label: 'B' },
    { id: 'C', x: 0.25, y: 0.85, label: 'C' },
  ],
  segments: [
    { id: 'CA', a: 'C', b: 'A', label: 'CA' },
    { id: 'AB', a: 'A', b: 'B', label: 'AB' },
    { id: 'BC', a: 'B', b: 'C', label: 'BC' },
  ],
  polylines: [],
  bars: [],
  facts: [
    'angle C = 90 degrees',
    'AC = 4 cm',
    'BC = 3 cm',
    'AB = 5 cm',
  ],
  aspect: 1.0,
};

function nonNull<T>(value: T | undefined | null, message = 'Expected non-null value'): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
  return value;
}

function fakeDrivers() {
  const vibrateCalls: { t: number; pattern: number | number[] }[] = [];
  const vibrate = vi.fn().mockImplementation((pattern: number | number[]) => {
    vibrateCalls.push({ t: performance.now(), pattern });
    return true;
  });
  const stop = vi.fn().mockImplementation(() => {
    vibrateCalls.push({ t: performance.now(), pattern: 0 });
  });
  const setTone = vi.fn();
  const speak = vi.fn();
  const drivers: Drivers = {
    haptics: { supported: true, lastResult: null, vibrate, stop },
    audio: { unlock: vi.fn(), setTone, beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
    speech: { speak, listen: vi.fn(), canSpeak: true, canListen: true },
    diagramStore: new MemoryDiagramStore(),
  };
  return { drivers, vibrate, stop, setTone, speak, vibrateCalls };
}

/**
 * Recreates the Explore screen's pointer session lifecycle to verify
 * hold keep-alive timer behavior faithfully.
 */
function createExploreHoldSession(scene: DiagramScene, view: Viewport, drivers: Drivers) {
  let engineState: EngineState = initialState();
  let centreTickState = initialCentreTickState();
  let axisState = initialAxisState();
  let isDown = false;
  let isGuiding = false;
  let isAskActive = false;

  const applyMove = (result: MovePipelineResult, extra: string[] = []) => {
    engineState = result.nextEngineState;
    centreTickState = result.centreCheck.nextState;
    axisState = result.nextAxisState;
    if (result.centreCheck.tick) {
      drivers.haptics.vibrate(CENTRE_TICK_MS);
    }
    const moveEffects = mergeAnnouncements([...extra, ...result.axisCrossings], result.effects);
    runEffects(moveEffects, drivers);
  };

  const timer = createHoldKeepAliveTimer({
    intervalMs: KEEP_ALIVE_INTERVAL_MS,
    shouldRun: () => isDown && !isGuiding && !isAskActive,
    onTick: (coords, now) => {
      const result = processPointerMove(
        scene,
        coords,
        view,
        now,
        engineState,
        centreTickState,
        axisState,
      );
      applyMove(result);
    },
  });

  return {
    pointerDown(coords: ScreenPoint, now: number = performance.now()) {
      isDown = true;
      engineState = initialState();
      centreTickState = rearmCentreTick(centreTickState);
      const norm = toNorm(coords, view);
      axisState = seedAxisState(norm, scene.axes);
      const result = processPointerMove(
        scene,
        coords,
        view,
        now,
        engineState,
        centreTickState,
        axisState,
      );
      applyMove(result);
      timer.start(coords, now);
    },
    pointerMove(coords: ScreenPoint, now: number = performance.now()) {
      const result = processPointerMove(
        scene,
        coords,
        view,
        now,
        engineState,
        centreTickState,
        axisState,
      );
      applyMove(result);
      timer.update(coords, now);
    },
    pointerLift(now: number = performance.now()) {
      isDown = false;
      timer.stop();
      const { effects } = step(engineState, { kind: 'lift', t: now });
      runEffects(effects, drivers);
    },
    blur() {
      isDown = false;
      timer.stop();
      const { effects } = step(engineState, { kind: 'lift', t: performance.now() });
      runEffects(effects, drivers);
    },
    documentHidden() {
      isDown = false;
      timer.stop();
      const { effects } = step(engineState, { kind: 'lift', t: performance.now() });
      runEffects(effects, drivers);
    },
    setAskActive(active: boolean) {
      isAskActive = active;
      if (active) timer.stop();
    },
    setGuiding(guiding: boolean) {
      isGuiding = guiding;
      if (guiding) timer.stop();
    },
    timer,
  };
}

describe('Hold keep-alive on Explore screen (Lane A1)', () => {
  const view = makeViewport(400, 400);

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('with fake timers, a still finger on side CA of the triangle sample keeps receiving vibrate(80) with gaps of at most 150 ms for 2 s; after lift no further vibrate call happens', () => {
    const { drivers, vibrateCalls } = fakeDrivers();
    const session = createExploreHoldSession(triangleSample, view, drivers);

    // Midpoint of side CA: x=0.25, y=0.55 -> screen coords (100, 220)
    const coordsCA = toScreen({ x: 0.25, y: 0.55 }, view);
    expect(coordsCA.x).toBeCloseTo(100);
    expect(coordsCA.y).toBeCloseTo(220);

    const startT = performance.now();
    session.pointerDown(coordsCA, startT);

    // Initial down must trigger vibrate(80) on the line
    const initialCalls = vibrateCalls.filter((c) => c.pattern === 80);
    expect(initialCalls.length).toBe(1);

    // Finger rests still for 2000 ms (2 seconds) without any pointermove events
    vi.advanceTimersByTime(2000);

    // Collect all vibrate(80) buzzes during the 2-second hold
    const lineBuzzes = vibrateCalls.filter((c) => c.pattern === 80);

    // Vibrations re-trigger periodically (around every 120 ms outside 70 ms retrigger window)
    // Over 2 s = 2000 ms, there should be at least 15 vibrate(80) calls
    expect(lineBuzzes.length).toBeGreaterThanOrEqual(15);

    // Check gaps between consecutive vibrate(80) calls: must be at most 150 ms
    for (let i = 1; i < lineBuzzes.length; i++) {
      const prev = nonNull(lineBuzzes[i - 1]);
      const curr = nonNull(lineBuzzes[i]);
      const gap = curr.t - prev.t;
      expect(gap).toBeLessThanOrEqual(150);
      expect(gap).toBeGreaterThan(0);
    }

    // Now finger lifts at t = 2000 ms
    const countBeforeLift = vibrateCalls.length;
    session.pointerLift(performance.now());

    // Lift triggers silence effect (vibrate pattern 0)
    const callsDuringLift = vibrateCalls.slice(countBeforeLift);
    expect(callsDuringLift).toEqual([{ t: expect.any(Number), pattern: 0 }]);

    // After lift, advance another 1000 ms: NO further vibrate calls must happen!
    const countAfterLift = vibrateCalls.length;
    vi.advanceTimersByTime(1000);
    expect(vibrateCalls.length).toBe(countAfterLift);
  });

  it('a still finger on a vertex gets the corner pattern once only', () => {
    const { drivers, vibrateCalls } = fakeDrivers();
    const session = createExploreHoldSession(triangleSample, view, drivers);

    // Vertex C at (0.25, 0.85) -> screen coords (100, 340)
    const coordsVertexC = toScreen({ x: 0.25, y: 0.85 }, view);
    session.pointerDown(coordsVertexC, performance.now());

    // Initial touch on vertex emits cornerPattern [50, 90, 50]
    expect(vibrateCalls).toHaveLength(1);
    expect(nonNull(vibrateCalls[0]).pattern).toEqual([50, 90, 50]);

    // Finger rests still on the vertex for 2 seconds (no pointermove)
    vi.advanceTimersByTime(2000);

    // The corner pattern must NOT repeat: vibrate call count remains exactly 1
    expect(vibrateCalls).toHaveLength(1);
    expect(nonNull(vibrateCalls[0]).pattern).toEqual([50, 90, 50]);
  });

  it('a still finger in empty space gets no vibrate', () => {
    const { drivers, vibrateCalls } = fakeDrivers();
    const session = createExploreHoldSession(triangleSample, view, drivers);

    // Point in empty space away from triangle: (0.85, 0.15) -> screen coords (340, 60)
    const coordsEmpty = toScreen({ x: 0.85, y: 0.15 }, view);
    session.pointerDown(coordsEmpty, performance.now());

    // Initial touch in empty space emits no vibrate
    expect(vibrateCalls).toHaveLength(0);

    // Finger rests still in empty space for 2 seconds
    vi.advanceTimersByTime(2000);

    // Still no vibrate calls
    expect(vibrateCalls).toHaveLength(0);
  });

  it('moving within 60 ms updates lastMoveAt so keep-alive does not double-fire', () => {
    const { drivers, vibrateCalls } = fakeDrivers();
    const session = createExploreHoldSession(triangleSample, view, drivers);

    const coordsCA = toScreen({ x: 0.25, y: 0.55 }, view);
    session.pointerDown(coordsCA, performance.now());
    expect(vibrateCalls.filter((c) => c.pattern === 80)).toHaveLength(1);

    // Move after 30 ms
    vi.advanceTimersByTime(30);
    session.pointerMove(coordsCA, performance.now());

    // At 60 ms (only 30 ms since pointerMove), timer ticks but shouldKeepAlive returns false
    vi.advanceTimersByTime(30);
    // At t=60: only the initial down buzz has fired
    expect(vibrateCalls.filter((c) => c.pattern === 80)).toHaveLength(1);

    // Advance another 60 ms (to t=120, which is 90 ms since pointerMove): keep-alive fires
    vi.advanceTimersByTime(60);
    expect(vibrateCalls.filter((c) => c.pattern === 80).length).toBeGreaterThanOrEqual(2);
  });

  it('stops the keep-alive timer on window blur', () => {
    const { drivers, vibrateCalls } = fakeDrivers();
    const session = createExploreHoldSession(triangleSample, view, drivers);

    const coordsCA = toScreen({ x: 0.25, y: 0.55 }, view);
    session.pointerDown(coordsCA, performance.now());
    expect(vibrateCalls.filter((c) => c.pattern === 80)).toHaveLength(1);

    // Window blurs at t = 30 ms
    vi.advanceTimersByTime(30);
    session.blur();

    // Advance 2 seconds: no further vibrate(80) calls must happen
    const countAfterBlur = vibrateCalls.length;
    vi.advanceTimersByTime(2000);
    expect(vibrateCalls.length).toBe(countAfterBlur);
    expect(session.timer.isActive()).toBe(false);
  });

  it('stops the keep-alive timer on document hidden', () => {
    const { drivers, vibrateCalls } = fakeDrivers();
    const session = createExploreHoldSession(triangleSample, view, drivers);

    const coordsCA = toScreen({ x: 0.25, y: 0.55 }, view);
    session.pointerDown(coordsCA, performance.now());

    // Document hides at t = 30 ms
    vi.advanceTimersByTime(30);
    session.documentHidden();

    // Advance 2 seconds: timer inactive, no further vibrate calls
    const countAfterHide = vibrateCalls.length;
    vi.advanceTimersByTime(2000);
    expect(vibrateCalls.length).toBe(countAfterHide);
    expect(session.timer.isActive()).toBe(false);
  });

  it('stops the keep-alive timer when Ask listening is active', () => {
    const { drivers, vibrateCalls } = fakeDrivers();
    const session = createExploreHoldSession(triangleSample, view, drivers);

    const coordsCA = toScreen({ x: 0.25, y: 0.55 }, view);
    session.pointerDown(coordsCA, performance.now());

    // Ask starts listening
    session.setAskActive(true);
    expect(session.timer.isActive()).toBe(false);

    vi.advanceTimersByTime(2000);
    expect(vibrateCalls.filter((c) => c.pattern === 80)).toHaveLength(1);
  });

  it('stops the keep-alive timer while Guide is guiding', () => {
    const { drivers, vibrateCalls } = fakeDrivers();
    const session = createExploreHoldSession(triangleSample, view, drivers);

    const coordsCA = toScreen({ x: 0.25, y: 0.55 }, view);
    session.pointerDown(coordsCA, performance.now());

    // Guide starts guiding
    session.setGuiding(true);
    expect(session.timer.isActive()).toBe(false);

    vi.advanceTimersByTime(2000);
    expect(vibrateCalls.filter((c) => c.pattern === 80)).toHaveLength(1);
  });
});
