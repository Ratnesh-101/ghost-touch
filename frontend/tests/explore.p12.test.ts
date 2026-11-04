/**
 * Integration tests for Explore gesture events reaching the engine (Task 7.9, P12, Requirement 13.2).
 *
 * Verifies that synthetic pointer events (down, move, drag, lift) routed through
 * hitTest, step, and runEffects produce the expected haptic patterns, pitch modulation,
 * speech announcements, and silence on lift at each stage of the exploration.
 */

import { describe, expect, it, vi } from 'vitest';
import { makeViewport, toScreen } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  CENTRE_TICK_MS,
  DEFAULT_RADII,
  checkCentreTick,
  checkTwoFingerLongPress,
  checkTwoFingerSwipeDown,
  initialAxisState,
  initialCentreTickState,
  initialState,
  processPointerMove,
  rearmCentreTick,
  seedAxisState,
  step,
  type AxisTrackerState,
  type CentreTickState,
  type EngineState,
  type PointerHistory,
} from '../src/flow/explore';
import { runEffects, type Drivers } from '../src/drivers';
import { pitchForValue } from '../src/core/pitch';
import { t } from '../src/i18n';

function createMockDrivers(): Drivers {
  return {
    haptics: {
      supported: true,
      lastResult: null,
      vibrate: vi.fn(),
      stop: vi.fn(),
    },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running' as const,
    },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    },
  };
}

describe('P12: Explore gesture events reach the engine (Requirement 13.2)', () => {
  const triangleScene: DiagramScene = {
    kind: 'geometry',
    title: 'Triangle ABC',
    points: [
      { id: 'A', x: 0.2, y: 0.2, label: 'Vertex A' },
      { id: 'B', x: 0.8, y: 0.2, label: 'Vertex B' },
      { id: 'C', x: 0.5, y: 0.8, label: 'Vertex C' },
    ],
    segments: [
      { id: 'AB', a: 'A', b: 'B', label: 'Base' },
      { id: 'BC', a: 'B', b: 'C', label: 'Hypotenuse' },
      { id: 'CA', a: 'C', b: 'A' },
    ],
    axes: { x_axis_y: 0.5, y_axis_x: 0.5 },
  };

  const view = makeViewport(400, 400);

  it('stage 1: pointerdown near centre triggers centre tick and initial announcement', () => {
    const drivers = createMockDrivers();
    let engineState: EngineState = initialState();
    let centreTickState: CentreTickState = initialCentreTickState();
    let axisState: AxisTrackerState = initialAxisState();

    // Start touch near canvas centre (200, 200)
    const touchPoint = { x: 200, y: 200 };
    const now = 1000;

    // Simulate hold start logic (mirrors Explore.tsx handlePointerDown)
    centreTickState = rearmCentreTick(centreTickState);
    axisState = seedAxisState({ x: 0.5, y: 0.5 }, triangleScene.axes);

    const distFromCentre = Math.hypot(touchPoint.x - 200, touchPoint.y - 200);
    const centreResult = checkCentreTick(distFromCentre, centreTickState, false, true);
    centreTickState = centreResult.nextState;

    if (centreResult.tick) {
      drivers.haptics.vibrate(CENTRE_TICK_MS);
    }
    if (centreResult.speakCentre) {
      drivers.speech.speak(t('explore.centre'));
    }

    const moveResult = processPointerMove(
      triangleScene,
      touchPoint,
      view,
      now,
      engineState,
      centreTickState,
      axisState,
      DEFAULT_RADII,
    );

    engineState = moveResult.nextEngineState;
    centreTickState = moveResult.centreCheck.nextState;
    axisState = moveResult.nextAxisState;

    runEffects(moveResult.effects, drivers);

    // Centre reference tick should have fired
    expect(drivers.haptics.vibrate).toHaveBeenCalledWith(CENTRE_TICK_MS);
    // First hold announcement
    expect(drivers.speech.speak).toHaveBeenCalledWith(t('explore.centre'));
    // Empty space: audio tone should be null
    expect(drivers.audio.setTone).toHaveBeenCalledWith(null);
  });

  it('stage 2: dragging pointer onto a vertex triggers corner haptic pattern and spoken vertex name', () => {
    const drivers = createMockDrivers();
    let engineState: EngineState = initialState();
    let centreTickState: CentreTickState = { armed: false, firstHoldSpoken: true };
    let axisState: AxisTrackerState = initialAxisState();

    // Screen coordinates of Vertex A (0.2, 0.2)
    const vertexA = toScreen({ x: 0.2, y: 0.2 }, view);
    const now = 2000;

    const moveResult = processPointerMove(
      triangleScene,
      vertexA,
      view,
      now,
      engineState,
      centreTickState,
      axisState,
      DEFAULT_RADII,
    );

    engineState = moveResult.nextEngineState;
    runEffects(moveResult.effects, drivers);

    // Hit test target must be the vertex
    expect(moveResult.target.kind).toBe('vertex');
    // Corner haptics [50, 90, 50]
    expect(drivers.haptics.vibrate).toHaveBeenCalledWith([50, 90, 50]);
    // Spoken label
    expect(drivers.speech.speak).toHaveBeenCalledWith('Vertex A', undefined);
    // Tone stopped at corner
    expect(drivers.audio.setTone).toHaveBeenCalledWith(null);
    // Quiet window must be active (450 ms)
    expect(engineState.quietUntil).toBe(now + 450);
  });

  it('stage 3: dragging pointer along a line segment produces line buzz and stops tone', () => {
    const drivers = createMockDrivers();
    // Start after quiet window has elapsed
    const now = 3000;
    let engineState: EngineState = {
      lastVertexId: 'A',
      lastBarId: null,
      onLine: false,
      lastBuzz: 0,
      quietUntil: 2500, // quiet window already passed
    };
    const centreTickState: CentreTickState = { armed: false, firstHoldSpoken: true };
    const axisState: AxisTrackerState = initialAxisState();

    // Midpoint of segment AB: (0.5, 0.2)
    const midAB = toScreen({ x: 0.5, y: 0.2 }, view);

    const moveResult = processPointerMove(
      triangleScene,
      midAB,
      view,
      now,
      engineState,
      centreTickState,
      axisState,
      DEFAULT_RADII,
    );

    engineState = moveResult.nextEngineState;
    runEffects(moveResult.effects, drivers);

    // Target is line AB (straight segment)
    expect(moveResult.target.kind).toBe('line');
    // Line buzz: 80 ms
    expect(drivers.haptics.vibrate).toHaveBeenCalledWith(80);
    // Straight line has tone: null (tones are for curves / polylines)
    expect(drivers.audio.setTone).toHaveBeenCalledWith(null);
  });

  it('stage 3b: dragging pointer along a curve (polyline) produces line buzz and continuous pitch', () => {
    const drivers = createMockDrivers();
    const curveScene: DiagramScene = {
      kind: 'function_graph',
      title: 'Sine Curve',
      polylines: [
        {
          id: 'sine',
          points: [
            [0.1, 0.5],
            [0.25, 0.2],
            [0.5, 0.5],
            [0.75, 0.8],
            [0.9, 0.5],
          ],
        },
      ],
    };

    const now = 3500;
    const engineState: EngineState = initialState();
    const centreTickState: CentreTickState = { armed: false, firstHoldSpoken: true };
    const axisState: AxisTrackerState = initialAxisState();

    // Point on the curve: (0.25, 0.2)
    const peak = toScreen({ x: 0.25, y: 0.2 }, view);

    const moveResult = processPointerMove(
      curveScene,
      peak,
      view,
      now,
      engineState,
      centreTickState,
      axisState,
      DEFAULT_RADII,
    );

    runEffects(moveResult.effects, drivers);

    expect(moveResult.target.kind).toBe('line');
    expect(drivers.haptics.vibrate).toHaveBeenCalledWith(80);
    // Polyline curve produces a pitch in [200, 1000] Hz proportional to yNorm
    expect(drivers.audio.setTone).toHaveBeenCalledWith(expect.any(Number));
    const firstCall = vi.mocked(drivers.audio.setTone).mock.calls[0];
    expect(firstCall).toBeDefined();
    const toneHz = firstCall?.[0];
    expect(toneHz).toBeGreaterThanOrEqual(200);
    expect(toneHz).toBeLessThanOrEqual(1000);
  });

  it('stage 4: cursor entering a bar speaks label/value and plays value-derived pitch', () => {
    const drivers = createMockDrivers();
    const barScene: DiagramScene = {
      kind: 'bar_chart',
      title: 'Quarterly Sales',
      bars: [
        { id: 'b1', x0: 0.1, x1: 0.3, y_top: 0.3, y_base: 0.9, label: 'Q1', value: 50 },
        { id: 'b2', x0: 0.4, x1: 0.6, y_top: 0.1, y_base: 0.9, label: 'Q2', value: 100 },
      ],
    };

    let engineState: EngineState = initialState();
    const centreTickState: CentreTickState = { armed: false, firstHoldSpoken: true };
    const axisState: AxisTrackerState = initialAxisState();

    // Pointer touches inside bar b2: (0.5, 0.5)
    const barPos = toScreen({ x: 0.5, y: 0.5 }, view);
    const now = 4000;

    const moveResult = processPointerMove(
      barScene,
      barPos,
      view,
      now,
      engineState,
      centreTickState,
      axisState,
      DEFAULT_RADII,
    );

    runEffects(moveResult.effects, drivers);

    expect(moveResult.target.kind).toBe('bar');
    // Entry speech for bar: "Q2, 100"
    expect(drivers.speech.speak).toHaveBeenCalledWith('Q2, 100', undefined);
    // Audio tone matching maxValue (100 is max, so pitchForValue(100, 100) = 1000 Hz)
    const expectedPitch = pitchForValue(100, 100);
    expect(drivers.audio.setTone).toHaveBeenCalledWith(expectedPitch);
  });

  it('stage 5: lifting the pointer silences vibration and audio, resetting engine state', () => {
    const drivers = createMockDrivers();
    // Active state with buzz and tone
    const activeState: EngineState = {
      lastVertexId: null,
      lastBarId: 'b1',
      onLine: true,
      lastBuzz: 4500,
      quietUntil: 4900,
    };

    const liftTime = 5000;
    const { state: nextState, effects } = step(activeState, { kind: 'lift', t: liftTime });
    runEffects(effects, drivers);

    // Both vibration and tone are cancelled
    expect(effects).toEqual([
      { kind: 'vibrate', pattern: 0 },
      { kind: 'tone', hz: null },
    ]);
    expect(drivers.haptics.vibrate).toHaveBeenCalledWith(0);
    expect(drivers.audio.setTone).toHaveBeenCalledWith(null);

    // State returns to clean initialState
    expect(nextState).toEqual(initialState());
  });

  it('two-finger gestures: swipe down triggers exit shortcut and long-press triggers Ask flow', () => {
    const now = 6000;

    // Two fingers moving down 90 px in 200 ms -> swipe down
    const p1Swipe: PointerHistory = {
      start: { x: 100, y: 100, t: now },
      current: { x: 105, y: 195, t: now + 200 },
    };
    const p2Swipe: PointerHistory = {
      start: { x: 200, y: 100, t: now },
      current: { x: 202, y: 192, t: now + 200 },
    };
    expect(checkTwoFingerSwipeDown(p1Swipe, p2Swipe)).toBe(true);

    // Two fingers held stationary for 650 ms -> long press
    const p1Hold: PointerHistory = {
      start: { x: 100, y: 100, t: now },
      current: { x: 102, y: 101, t: now + 650 },
    };
    const p2Hold: PointerHistory = {
      start: { x: 200, y: 100, t: now },
      current: { x: 198, y: 103, t: now + 650 },
    };
    expect(checkTwoFingerLongPress(p1Hold, p2Hold, now + 650)).toBe(true);
  });
});
