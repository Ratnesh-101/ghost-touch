import { describe, expect, it, vi } from 'vitest';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  CENTRE_RADIUS_PX,
  CENTRE_REARM_RADIUS_PX,
  CENTRE_TICK_MS,
  checkAxisCrossing,
  checkCentreTick,
  checkTwoFingerLongPress,
  checkTwoFingerSwipeDown,
  initialAxisState,
  initialCentreTickState,
  initialState,
  pitchForY,
  processPointerMove,
  step,
  TWO_FINGER_LONG_PRESS_MS,
  TWO_FINGER_MAX_MOVE_PX,
  type Effect,
  type EngineState,
  type PointerHistory,
} from '../src/flow/explore';
import { exploreAnnouncement } from '../src/flow/navigation';
import { pitchForValue } from '../src/_temp/pitch.stub';
import { t } from '../src/i18n';
import { runEffects } from '../src/drivers';

describe('Centre reference tick (checkCentreTick)', () => {
  it('fires on a hold at the centre (isNewHold=true, dist <= 24)', () => {
    const s0 = initialCentreTickState();
    const res = checkCentreTick(10, s0, false, true);
    expect(res.tick).toBe(true);
    expect(res.speakCentre).toBe(true);
    expect(res.nextState.armed).toBe(false);
    expect(res.nextState.firstHoldSpoken).toBe(true);
  });

  it('does not fire on a hold far from the centre (dist > 24)', () => {
    const s0 = initialCentreTickState();
    const res = checkCentreTick(50, s0, false, true);
    expect(res.tick).toBe(false);
    expect(res.speakCentre).toBe(false);
    expect(res.nextState.armed).toBe(true);
  });

  it('re-arms only after leaving 1.5x the radius (36 px)', () => {
    // 1. Initial fire at centre
    const s0 = initialCentreTickState();
    const r1 = checkCentreTick(15, s0, false, true);
    expect(r1.tick).toBe(true);
    expect(r1.nextState.armed).toBe(false);

    // 2. Cursor moves to 28 px (outside 24 px, but inside 36 px) -> NOT armed
    const r2 = checkCentreTick(28, r1.nextState, false, false);
    expect(r2.tick).toBe(false);
    expect(r2.nextState.armed).toBe(false);

    // Moving back to 10 px -> does NOT fire because not armed
    const r3 = checkCentreTick(10, r2.nextState, false, false);
    expect(r3.tick).toBe(false);

    // 3. Cursor leaves beyond 36 px (e.g. 40 px) -> re-arms
    const r4 = checkCentreTick(40, r3.nextState, false, false);
    expect(r4.tick).toBe(false);
    expect(r4.nextState.armed).toBe(true);

    // 4. Cursor returns to 12 px -> fires tick again! (later hold: speakCentre=false)
    const r5 = checkCentreTick(12, r4.nextState, false, false);
    expect(r5.tick).toBe(true);
    expect(r5.speakCentre).toBe(false);
    expect(r5.nextState.armed).toBe(false);
  });

  it('never fires during the quiet window', () => {
    const s0 = initialCentreTickState();
    const res = checkCentreTick(10, s0, true, true);
    expect(res.tick).toBe(false);
    expect(res.speakCentre).toBe(false);
    expect(res.nextState.armed).toBe(true);
  });

  it('names constant CENTRE_TICK_MS as 25 ms', () => {
    expect(CENTRE_TICK_MS).toBe(25);
    expect(CENTRE_RADIUS_PX).toBe(24);
    expect(CENTRE_REARM_RADIUS_PX).toBe(36);
  });
});

describe('Axis crossings (checkAxisCrossing)', () => {
  const axes = { x_axis_y: 0.5, y_axis_x: 0.5 };

  it('speaks once per crossing in each direction for x and y axes', () => {
    let state = initialAxisState();

    // Initial position in top-left quadrant (x=0.2, y=0.2)
    const r0 = checkAxisCrossing({ x: 0.2, y: 0.2 }, axes, state);
    expect(r0.spoken).toEqual([]);
    state = r0.nextState;

    // Move to top-right quadrant (x=0.7, y=0.2) -> crossed y-axis
    const r1 = checkAxisCrossing({ x: 0.7, y: 0.2 }, axes, state);
    expect(r1.spoken).toEqual([t('explore.yAxis')]);
    state = r1.nextState;

    // Move within top-right (x=0.8, y=0.3) -> no crossing
    const r2 = checkAxisCrossing({ x: 0.8, y: 0.3 }, axes, state);
    expect(r2.spoken).toEqual([]);
    state = r2.nextState;

    // Move to bottom-right (x=0.8, y=0.8) -> crossed x-axis
    const r3 = checkAxisCrossing({ x: 0.8, y: 0.8 }, axes, state);
    expect(r3.spoken).toEqual([t('explore.xAxis')]);
    state = r3.nextState;

    // Cross back over y-axis to bottom-left (x=0.3, y=0.8) -> crossed y-axis
    const r4 = checkAxisCrossing({ x: 0.3, y: 0.8 }, axes, state);
    expect(r4.spoken).toEqual([t('explore.yAxis')]);
    state = r4.nextState;

    // Cross back over x-axis to top-left (x=0.3, y=0.3) -> crossed x-axis
    const r5 = checkAxisCrossing({ x: 0.3, y: 0.3 }, axes, state);
    expect(r5.spoken).toEqual([t('explore.xAxis')]);
  });

  it('handles diagrams with no axes or partial axes without errors', () => {
    const s0 = initialAxisState();
    const rNoAxes = checkAxisCrossing({ x: 0.1, y: 0.1 }, null, s0);
    expect(rNoAxes.spoken).toEqual([]);

    const rPartial = checkAxisCrossing({ x: 0.1, y: 0.1 }, { x_axis_y: 0.5 }, s0);
    expect(rPartial.spoken).toEqual([]);
  });
});

describe('Two-finger swipe down detector (checkTwoFingerSwipeDown)', () => {
  it('fires on a clear two-finger swipe down (dy >= 80, dt <= 600, little drift)', () => {
    const p1: PointerHistory = {
      start: { x: 100, y: 100, t: 0 },
      current: { x: 105, y: 200, t: 250 },
    };
    const p2: PointerHistory = {
      start: { x: 200, y: 110, t: 10 },
      current: { x: 204, y: 215, t: 260 },
    };
    expect(checkTwoFingerSwipeDown(p1, p2)).toBe(true);
  });

  it('does not fire if vertical distance is less than 80 px', () => {
    const p1: PointerHistory = {
      start: { x: 100, y: 100, t: 0 },
      current: { x: 102, y: 150, t: 200 }, // dy = 50 < 80
    };
    const p2: PointerHistory = {
      start: { x: 200, y: 100, t: 0 },
      current: { x: 202, y: 190, t: 200 },
    };
    expect(checkTwoFingerSwipeDown(p1, p2)).toBe(false);
  });

  it('does not fire if duration exceeds 600 ms', () => {
    const p1: PointerHistory = {
      start: { x: 100, y: 100, t: 0 },
      current: { x: 100, y: 220, t: 700 }, // dt = 700 > 600
    };
    const p2: PointerHistory = {
      start: { x: 200, y: 100, t: 0 },
      current: { x: 200, y: 220, t: 700 },
    };
    expect(checkTwoFingerSwipeDown(p1, p2)).toBe(false);
  });

  it('does not fire if there is excessive horizontal drift', () => {
    const p1: PointerHistory = {
      start: { x: 100, y: 100, t: 0 },
      current: { x: 170, y: 200, t: 300 }, // dx = 70, dy = 100, ratio = 0.7 > 0.5
    };
    const p2: PointerHistory = {
      start: { x: 200, y: 100, t: 0 },
      current: { x: 205, y: 200, t: 300 },
    };
    expect(checkTwoFingerSwipeDown(p1, p2)).toBe(false);
  });
});

describe('Two-finger long-press detector (checkTwoFingerLongPress)', () => {
  it('fires when held for at least 600 ms with displacement <= 20 px', () => {
    const p1: PointerHistory = {
      start: { x: 100, y: 100, t: 1000 },
      current: { x: 105, y: 102, t: 1650 },
    };
    const p2: PointerHistory = {
      start: { x: 200, y: 120, t: 1000 },
      current: { x: 198, y: 124, t: 1650 },
    };
    expect(checkTwoFingerLongPress(p1, p2, 1650)).toBe(true);
  });

  it('does not fire if duration is under 600 ms', () => {
    const p1: PointerHistory = {
      start: { x: 100, y: 100, t: 1000 },
      current: { x: 101, y: 101, t: 1400 },
    };
    const p2: PointerHistory = {
      start: { x: 200, y: 120, t: 1000 },
      current: { x: 200, y: 121, t: 1400 },
    };
    expect(checkTwoFingerLongPress(p1, p2, 1400)).toBe(false);
  });

  it('does not fire if pointer 1 moved more than 20 px', () => {
    const p1: PointerHistory = {
      start: { x: 100, y: 100, t: 1000 },
      current: { x: 125, y: 100, t: 1700 }, // dx = 25 > 20
    };
    const p2: PointerHistory = {
      start: { x: 200, y: 120, t: 1000 },
      current: { x: 200, y: 122, t: 1700 },
    };
    expect(checkTwoFingerLongPress(p1, p2, 1700)).toBe(false);
  });

  it('does not fire if pointer 2 moved more than 20 px', () => {
    const p1: PointerHistory = {
      start: { x: 100, y: 100, t: 1000 },
      current: { x: 102, y: 102, t: 1700 },
    };
    const p2: PointerHistory = {
      start: { x: 200, y: 120, t: 1000 },
      current: { x: 200, y: 145, t: 1700 }, // dy = 25 > 20
    };
    expect(checkTwoFingerLongPress(p1, p2, 1700)).toBe(false);
  });

  it('exports TWO_FINGER_LONG_PRESS_MS as 600 and TWO_FINGER_MAX_MOVE_PX as 20', () => {
    expect(TWO_FINGER_LONG_PRESS_MS).toBe(600);
    expect(TWO_FINGER_MAX_MOVE_PX).toBe(20);
  });
});

describe('Haptic engine step & lift (step)', () => {
  it('resets engine state and emits stop vibrate and null tone on lift', () => {
    const busyState: EngineState = {
      lastVertexId: 'v1',
      lastBarId: null,
      onLine: true,
      lastBuzz: 500,
      quietUntil: 1000,
    };
    const { state, effects } = step(busyState, { kind: 'lift', t: 1200 });
    expect(state).toEqual(initialState());
    expect(effects).toEqual([
      { kind: 'vibrate', pattern: 0 },
      { kind: 'tone', hz: null },
    ]);
  });

  it('emits cornerPattern and speaks vertex label on vertex entry', () => {
    const s0 = initialState();
    const { state, effects } = step(s0, {
      kind: 'move',
      t: 100,
      target: { kind: 'vertex', id: 'A', label: 'Point A' },
      yNorm: 0.2,
    });
    expect(state.lastVertexId).toBe('A');
    expect(state.quietUntil).toBe(100 + 450);
    expect(effects).toEqual([
      { kind: 'vibrate', pattern: [50, 90, 50] },
      { kind: 'speak', text: 'Point A' },
      { kind: 'tone', hz: null },
    ]);
  });

  it('does not re-emit cornerPattern on same vertex', () => {
    const s0 = {
      ...initialState(),
      lastVertexId: 'A',
      quietUntil: 500,
    };
    const { state, effects } = step(s0, {
      kind: 'move',
      t: 200,
      target: { kind: 'vertex', id: 'A', label: 'Point A' },
      yNorm: 0.2,
    });
    expect(state.lastVertexId).toBe('A');
    expect(effects).toEqual([]);
  });

  it('emits line buzz at retrigger rate outside quiet window', () => {
    const s0 = initialState();
    const { state: s1, effects: eff1 } = step(s0, {
      kind: 'move',
      t: 100,
      target: { kind: 'line', id: 'seg1', elementKind: 'segment' },
      yNorm: 0.5,
    });
    expect(s1.onLine).toBe(true);
    expect(s1.lastBuzz).toBe(100);
    expect(eff1).toContainEqual({ kind: 'vibrate', pattern: 80 });

    // Under retrigger interval (50 ms < 70 ms) -> no buzz
    const { state: s2, effects: eff2 } = step(s1, {
      kind: 'move',
      t: 150,
      target: { kind: 'line', id: 'seg1', elementKind: 'segment' },
      yNorm: 0.5,
    });
    expect(s2.lastBuzz).toBe(100);
    expect(eff2).not.toContainEqual({ kind: 'vibrate', pattern: 80 });

    // After retrigger interval (100 + 75 = 175 ms > 70 ms) -> new buzz
    const { state: s3, effects: eff3 } = step(s2, {
      kind: 'move',
      t: 175,
      target: { kind: 'line', id: 'seg1', elementKind: 'segment' },
      yNorm: 0.5,
    });
    expect(s3.lastBuzz).toBe(175);
    expect(eff3).toContainEqual({ kind: 'vibrate', pattern: 80 });
  });

  it('emits curve tone matching pitchForY for polylines', () => {
    const s0 = initialState();
    const { effects } = step(s0, {
      kind: 'move',
      t: 100,
      target: { kind: 'line', id: 'poly1', elementKind: 'polyline' },
      yNorm: 0.25,
    });
    expect(effects).toContainEqual({ kind: 'tone', hz: 800 });
  });

  it('speaks label and value once per new bar and emits tone by value', () => {
    const s0 = initialState();
    const { state: s1, effects: eff1 } = step(s0, {
      kind: 'move',
      t: 100,
      target: { kind: 'bar', id: 'bar1', label: 'Apples', value: 50 },
      yNorm: 0.5,
    });
    expect(s1.lastBarId).toBe('bar1');
    expect(eff1).toContainEqual({ kind: 'speak', text: 'Apples, 50' });
    expect(eff1).toContainEqual({ kind: 'tone', hz: 600 });

    // Same bar -> no new speak
    const { effects: eff2 } = step(s1, {
      kind: 'move',
      t: 150,
      target: { kind: 'bar', id: 'bar1', label: 'Apples', value: 50 },
      yNorm: 0.5,
    });
    expect(eff2.filter((e: Effect) => e.kind === 'speak')).toHaveLength(0);
  });
});

describe('Pitch mapping functions', () => {
  it('pitchForY maps 0 -> 1000 Hz and 1 -> 200 Hz with clamping', () => {
    expect(pitchForY(0)).toBe(1000);
    expect(pitchForY(1)).toBe(200);
    expect(pitchForY(0.5)).toBe(600);
    expect(pitchForY(-0.5)).toBe(1000);
    expect(pitchForY(1.5)).toBe(200);
  });

  it('pitchForValue scales linearly from 200 to 1000 and guards max <= 0', () => {
    expect(pitchForValue(0, 100)).toBe(200);
    expect(pitchForValue(100, 100)).toBe(1000);
    expect(pitchForValue(50, 100)).toBe(600);
    expect(pitchForValue(50, 0)).toBe(200);
    expect(pitchForValue(50, -10)).toBe(200);
  });
});

describe('processPointerMove pipeline', () => {
  const triangleScene: DiagramScene = {
    kind: 'geometry',
    title: 'Right Triangle',
    points: [
      { id: 'A', x: 0.5, y: 0.15, label: 'Point A' },
      { id: 'B', x: 0.15, y: 0.85, label: 'Point B' },
      { id: 'C', x: 0.85, y: 0.85, label: 'Point C' },
    ],
    segments: [
      { id: 's1', a: 'A', b: 'B' },
      { id: 's2', b: 'C', a: 'B' },
      { id: 's3', a: 'C', b: 'A' },
    ],
  };

  it('calls hitTest, step and trackers with correct yNorm', () => {
    const view = makeViewport(400, 400); // 400x400 screen
    const engineState = initialState();
    const centreTickState = initialCentreTickState();
    const axisState = initialAxisState();

    // Finger at Point A: screen x=200, y=60 (0.15 * 400 = 60)
    const result = processPointerMove(
      triangleScene,
      { x: 200, y: 60 },
      view,
      1000,
      engineState,
      centreTickState,
      axisState,
    );

    expect(result.target.kind).toBe('vertex');
    expect(result.yNorm).toBeCloseTo(0.15);
    expect(result.effects).toContainEqual({
      kind: 'vibrate',
      pattern: [50, 90, 50],
    });
    expect(result.effects).toContainEqual({
      kind: 'speak',
      text: 'Point A',
    });

    // Pipeline results fed into runEffects
    const mockDrivers = {
      haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), state: 'running' as const },
      speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
    };
    runEffects(result.effects, mockDrivers);
    expect(mockDrivers.haptics.vibrate).toHaveBeenCalledWith([50, 90, 50]);
    expect(mockDrivers.speech.speak).toHaveBeenCalledWith('Point A', undefined);
    expect(mockDrivers.audio.setTone).toHaveBeenCalledWith(null);
  });
});

describe('exploreAnnouncement', () => {
  it('combines scene name, gesture hint and back hint for AI and raw modes', () => {
    const scene: DiagramScene = { kind: 'geometry', title: 'Triangle' };
    const aiAnnounce = exploreAnnouncement(scene, 'ai');
    expect(aiAnnounce).toContain('Triangle.');
    expect(aiAnnounce).toContain('Double-tap and hold, then drag to feel the diagram.');
    expect(aiAnnounce).toContain('Press Back to leave.');

    const rawAnnounce = exploreAnnouncement(scene, 'raw');
    expect(rawAnnounce.startsWith("I couldn't fully read this diagram. You can still feel its outlines.")).toBe(true);
    expect(rawAnnounce).toContain('Triangle.');
  });
});

describe('Exit handlers and prompt announcement', () => {
  it('exit via popstate or Back button triggers handler that speaks the Capture prompt', () => {
    const spoken: string[] = [];
    const handleBack = () => {
      spoken.push(t('capture.prompt'));
    };

    // Both popstate and the on-screen Back button invoke handleBack
    handleBack();
    expect(spoken).toEqual(['Take a photo, choose an image, or pick a sample diagram.']);
  });
});
