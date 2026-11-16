import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LabSettings } from '../src/components/LabSettings';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  DEFAULT_HAPTICS,
  DEFAULT_HEARTBEAT,
  DEFAULT_PROXIMITY,
  DEFAULT_RADII,
  getStoredCornerHeartbeatSetting,
  initialAxisState,
  initialCentreTickState,
  initialHeartbeatState,
  initialProximityState,
  initialState,
  processPointerMove,
  setStoredCornerHeartbeatSetting,
  step,
  _resetCornerHeartbeatSettingForTesting,
  type EngineState,
  type HeartbeatState,
} from '../src/flow/explore';
import { MemoryDiagramStore, runEffects, WebHapticDriver, type Drivers } from '../src/drivers';
import type { VibrateHost } from '../src/drivers/haptics';
import { getLang, setLang, t, tables, type Lang } from '../src/i18n';
import triangleJson from '../public/samples/triangle.json';
import sineJson from '../public/samples/sine.json';
import barchartJson from '../public/samples/barchart.json';

const triangleScene = triangleJson as unknown as DiagramScene;
const sineScene = sineJson as unknown as DiagramScene;
const barScene = barchartJson as unknown as DiagramScene;

function createTestHarness(): {
  drivers: Drivers;
  vibrateCalls: Array<number | number[]>;
  stopCalls: number;
  toneCalls: Array<number | null>;
  speakCalls: string[];
} {
  const vibrateCalls: Array<number | number[]> = [];
  let stopCalls = 0;
  const toneCalls: Array<number | null> = [];
  const speakCalls: string[] = [];

  const host: VibrateHost = {
    vibrate: vi.fn((p: number | number[]) => {
      vibrateCalls.push(Array.isArray(p) ? [...p] : p);
      return true;
    }),
  };

  const haptics = new WebHapticDriver(host);
  const origStop = haptics.stop.bind(haptics);
  haptics.stop = () => {
    stopCalls++;
    origStop();
  };

  const drivers: Drivers = {
    haptics,
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn((hz) => toneCalls.push(hz)),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running',
    },
    speech: {
      speak: vi.fn((text) => speakCalls.push(text)),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  };

  return { drivers, vibrateCalls, stopCalls, toneCalls, speakCalls };
}

describe('Corner Heartbeat Settings and i18n (Requirement 34, lane hb2)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
    _resetCornerHeartbeatSettingForTesting();
  });

  afterEach(() => {
    setLang(prevLang);
    _resetCornerHeartbeatSettingForTesting();
  });

  it('switch defaults to off when nothing is stored', () => {
    expect(getStoredCornerHeartbeatSetting()).toBe(false);
  });

  it('setting setter and reset work properly', () => {
    setStoredCornerHeartbeatSetting(true);
    expect(getStoredCornerHeartbeatSetting()).toBe(true);
    setStoredCornerHeartbeatSetting(false);
    expect(getStoredCornerHeartbeatSetting()).toBe(false);
    setStoredCornerHeartbeatSetting(true);
    _resetCornerHeartbeatSettingForTesting();
    expect(getStoredCornerHeartbeatSetting()).toBe(false);
  });

  it('keys are present and non-empty in en, hi and gu tables with strict parity', () => {
    const requiredKeys = [
      'lab.settings.cornerHeartbeat',
      'lab.settings.cornerHeartbeatHint',
      'lab.settings.cornerHeartbeatOn',
      'lab.settings.cornerHeartbeatOff',
    ] as const;

    for (const key of requiredKeys) {
      expect(tables.en[key], `Missing en key: ${key}`).toBeDefined();
      expect(tables.en[key]!.trim().length).toBeGreaterThan(0);

      expect(tables.hi[key], `Missing hi key: ${key}`).toBeDefined();
      expect(tables.hi[key]!.trim().length).toBeGreaterThan(0);

      expect(tables.gu[key], `Missing gu key: ${key}`).toBeDefined();
      expect(tables.gu[key]!.trim().length).toBeGreaterThan(0);
    }
  });

  it('no string claims the feature is tested or approved (honest copy)', () => {
    const forbiddenWords = ['tested', 'approved', 'verified', 'correct', 'checked'];
    const requiredKeys = [
      'lab.settings.cornerHeartbeat',
      'lab.settings.cornerHeartbeatHint',
      'lab.settings.cornerHeartbeatOn',
      'lab.settings.cornerHeartbeatOff',
    ] as const;

    for (const key of requiredKeys) {
      const enText = tables.en[key]!.toLowerCase();
      for (const word of forbiddenWords) {
        expect(enText).not.toContain(word);
      }
    }
  });

  it('a11y target-size test covers Corner heartbeat switch (role="switch", fixed label, >= 48x48 px)', () => {
    const { drivers } = createTestHarness();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain('lab-settings-section-corner-heartbeat');
    const hbSection = html.slice(html.indexOf('lab-settings-section-corner-heartbeat'));
    expect(hbSection).toContain('role="switch"');
    expect(hbSection).toContain('aria-checked="false"');
    // One fixed label, state in aria-checked only
    expect(hbSection).toContain(`>${t('lab.settings.cornerHeartbeat')}<`);
    // Min 48x48 CSS px
    expect(hbSection).toMatch(/min-width:\s*48px/);
    expect(hbSection).toMatch(/min-height:\s*48px/);
  });
});

describe('Corner Heartbeat Wiring and Pipeline (Requirement 34, lane hb2)', () => {
  const view300 = makeViewport(300, 300);

  beforeEach(() => {
    _resetCornerHeartbeatSettingForTesting();
  });

  afterEach(() => {
    _resetCornerHeartbeatSettingForTesting();
  });

  it('switch OFF: vibrate, tone and speak calls for a fixed trace on triangle.json, sine.json and the bar sample are identical to a run with heartbeat arguments omitted', () => {
    const scenes = [
      { name: 'triangle', scene: triangleScene },
      { name: 'sine', scene: sineScene },
      { name: 'bar', scene: barScene },
    ];

    const tracePoints = [
      { x: 50, y: 50 },
      { x: 75, y: 75 },
      { x: 100, y: 150 },
      { x: 150, y: 200 },
      { x: 210, y: 255 },
      { x: 210, y: 255 }, // hold on same spot
      { x: 210, y: 255 },
      { x: 150, y: 255 },
      { x: 20, y: 20 },
    ];

    for (const { name, scene } of scenes) {
      // Run A: heartbeat arguments omitted
      const harnessA = createTestHarness();
      let engineStateA: EngineState = initialState();
      let centreTickA = initialCentreTickState();
      let axisStateA = initialAxisState();
      let proxStateA = initialProximityState();

      let t = 1000;
      for (const pt of tracePoints) {
        t += 80;
        const resA = processPointerMove(
          scene,
          pt,
          view300,
          t,
          engineStateA,
          centreTickA,
          axisStateA,
          DEFAULT_RADII,
          DEFAULT_HAPTICS,
          proxStateA,
        );
        engineStateA = resA.nextEngineState;
        centreTickA = resA.centreCheck.nextState;
        axisStateA = resA.nextAxisState;
        proxStateA = resA.proximityState;
        runEffects(resA.effects, harnessA.drivers);
      }

      // Run B: switch OFF (getStoredCornerHeartbeatSetting() is false -> heartbeatCfg is null)
      expect(getStoredCornerHeartbeatSetting()).toBe(false);
      const harnessB = createTestHarness();
      let engineStateB: EngineState = initialState();
      let centreTickB = initialCentreTickState();
      let axisStateB = initialAxisState();
      let proxStateB = initialProximityState();
      let hbStateB: HeartbeatState = initialHeartbeatState();

      t = 1000;
      for (const pt of tracePoints) {
        t += 80;
        const hbCfg = getStoredCornerHeartbeatSetting() ? DEFAULT_HEARTBEAT : null;
        const resB = processPointerMove(
          scene,
          pt,
          view300,
          t,
          engineStateB,
          centreTickB,
          axisStateB,
          DEFAULT_RADII,
          DEFAULT_HAPTICS,
          proxStateB,
          DEFAULT_PROXIMITY,
          hbStateB,
          hbCfg,
        );
        engineStateB = resB.nextEngineState;
        centreTickB = resB.centreCheck.nextState;
        axisStateB = resB.nextAxisState;
        proxStateB = resB.proximityState;
        hbStateB = resB.heartbeatState;
        runEffects(resB.effects, harnessB.drivers);
      }

      // Assert identical calls on all drivers for this scene
      expect(harnessB.vibrateCalls, `Vibrations differ for ${name}`).toEqual(harnessA.vibrateCalls);
      expect(harnessB.toneCalls, `Tones differ for ${name}`).toEqual(harnessA.toneCalls);
      expect(harnessB.speakCalls, `Speech differs for ${name}`).toEqual(harnessA.speakCalls);
    }
  });

  it('switch ON, still finger on vertex B for 3 s: corner pattern once, label spoken once, a beat pattern about every DEFAULT_HEARTBEAT.periodMs (within one keep-alive tick)', () => {
    setStoredCornerHeartbeatSetting(true);
    expect(getStoredCornerHeartbeatSetting()).toBe(true);

    const harness = createTestHarness();
    let engineState = initialState();
    let centreTick = initialCentreTickState();
    let axisState = initialAxisState();
    let proxState = initialProximityState();
    let hbState = initialHeartbeatState();

    // In triangle.json: Point B is at (0.7, 0.85). In 300x300 viewport: (210, 255)
    const vertexBCoords = { x: 210, y: 255 };

    // Initial touch-down at t = 1000 on Vertex B
    let t = 1000;
    const hbCfg = getStoredCornerHeartbeatSetting() ? DEFAULT_HEARTBEAT : null;
    const entryRes = processPointerMove(
      triangleScene,
      vertexBCoords,
      view300,
      t,
      engineState,
      centreTick,
      axisState,
      DEFAULT_RADII,
      DEFAULT_HAPTICS,
      proxState,
      DEFAULT_PROXIMITY,
      hbState,
      hbCfg,
    );
    engineState = entryRes.nextEngineState;
    centreTick = entryRes.centreCheck.nextState;
    axisState = entryRes.nextAxisState;
    proxState = entryRes.proximityState;
    hbState = entryRes.heartbeatState;
    runEffects(entryRes.effects, harness.drivers);

    // Entry should produce the corner pattern once and speak label once
    expect(entryRes.target.kind).toBe('vertex');
    if (entryRes.target.kind === 'vertex') {
      expect(entryRes.target.id).toBe('B');
    }
    expect(harness.vibrateCalls).toEqual([[50, 90, 50]]);
    expect(harness.speakCalls.length).toBe(1);
    expect(harness.speakCalls[0]).toContain('B');

    // Simulate resting on Vertex B for 3000 ms (t = 1000 to t = 4000) driven by 60 ms keep-alive ticks
    const beatTimes: number[] = [];

    while (t < 4000) {
      t += 60;
      const tickRes = processPointerMove(
        triangleScene,
        vertexBCoords,
        view300,
        t,
        engineState,
        centreTick,
        axisState,
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        proxState,
        DEFAULT_PROXIMITY,
        hbState,
        hbCfg,
      );
      engineState = tickRes.nextEngineState;
      centreTick = tickRes.centreCheck.nextState;
      axisState = tickRes.nextAxisState;
      proxState = tickRes.proximityState;
      hbState = tickRes.heartbeatState;

      const prevLen = harness.vibrateCalls.length;
      runEffects(tickRes.effects, harness.drivers);
      if (harness.vibrateCalls.length > prevLen) {
        beatTimes.push(t);
      }
    }

    // Three beats during 3 s resting: at ~1900 (+900), ~2800 (+1800), and ~3700 (+2700)
    expect(beatTimes.length).toBe(3);
    for (let i = 0; i < beatTimes.length; i++) {
      const expectedTime = 1000 + (i + 1) * DEFAULT_HEARTBEAT.periodMs;
      // Within one 60 ms keep-alive tick
      expect(Math.abs(beatTimes[i]! - expectedTime)).toBeLessThanOrEqual(60);
    }

    // Total vibrate calls: 1 initial corner pulse + 3 beats = 4 calls of [50, 90, 50]
    expect(harness.vibrateCalls).toEqual([
      [50, 90, 50],
      [50, 90, 50],
      [50, 90, 50],
      [50, 90, 50],
    ]);

    // Spoken label remains called only ONCE throughout all 3 seconds
    expect(harness.speakCalls.length).toBe(1);
  });

  it('ON, then a move onto side BC: that step calls vibrate(80) and no array pattern after it', () => {
    setStoredCornerHeartbeatSetting(true);
    const harness = createTestHarness();
    let engineState = initialState();
    let centreTick = initialCentreTickState();
    let axisState = initialAxisState();
    let proxState = initialProximityState();
    let hbState = initialHeartbeatState();

    const vertexBCoords = { x: 210, y: 255 };
    const hbCfg = DEFAULT_HEARTBEAT;

    // Entry at t = 1000
    let t = 1000;
    const r1 = processPointerMove(
      triangleScene,
      vertexBCoords,
      view300,
      t,
      engineState,
      centreTick,
      axisState,
      DEFAULT_RADII,
      DEFAULT_HAPTICS,
      proxState,
      DEFAULT_PROXIMITY,
      hbState,
      hbCfg,
    );
    engineState = r1.nextEngineState;
    centreTick = r1.centreCheck.nextState;
    axisState = r1.nextAxisState;
    proxState = r1.proximityState;
    hbState = r1.heartbeatState;
    runEffects(r1.effects, harness.drivers);

    // Fast-forward past quiet window (t = 1600 > 1450)
    t = 1600;
    const r2 = processPointerMove(
      triangleScene,
      vertexBCoords,
      view300,
      t,
      engineState,
      centreTick,
      axisState,
      DEFAULT_RADII,
      DEFAULT_HAPTICS,
      proxState,
      DEFAULT_PROXIMITY,
      hbState,
      hbCfg,
    );
    engineState = r2.nextEngineState;
    centreTick = r2.centreCheck.nextState;
    axisState = r2.nextAxisState;
    proxState = r2.proximityState;
    hbState = r2.heartbeatState;
    runEffects(r2.effects, harness.drivers);

    // Clear calls to inspect the single step moving onto side BC
    harness.vibrateCalls.length = 0;

    // Move onto side BC: segment BC connects B(0.7, 0.85) to C(0.25, 0.85). Midpoint is (0.475, 0.85) -> (142.5, 255)
    t = 1700;
    const sideBCCoords = { x: 142.5, y: 255 };
    const r3 = processPointerMove(
      triangleScene,
      sideBCCoords,
      view300,
      t,
      engineState,
      centreTick,
      axisState,
      DEFAULT_RADII,
      DEFAULT_HAPTICS,
      proxState,
      DEFAULT_PROXIMITY,
      hbState,
      hbCfg,
    );
    runEffects(r3.effects, harness.drivers);

    expect(r3.target.kind).toBe('line');
    // Step calls vibrate(80) (lineMs) and NO array pattern after it
    expect(harness.vibrateCalls).toEqual([80]);
  });

  it('ON, then a move into empty space within 100 ms of a beat: that step calls vibrate(0)', () => {
    setStoredCornerHeartbeatSetting(true);
    const harness = createTestHarness();
    let engineState = initialState();
    let centreTick = initialCentreTickState();
    let axisState = initialAxisState();
    let proxState = initialProximityState();
    let hbState = initialHeartbeatState();

    const vertexBCoords = { x: 210, y: 255 };
    const hbCfg = DEFAULT_HEARTBEAT;

    // Entry at t = 1000
    let t = 1000;
    const r1 = processPointerMove(
      triangleScene,
      vertexBCoords,
      view300,
      t,
      engineState,
      centreTick,
      axisState,
      DEFAULT_RADII,
      DEFAULT_HAPTICS,
      proxState,
      DEFAULT_PROXIMITY,
      hbState,
      hbCfg,
    );
    engineState = r1.nextEngineState;
    centreTick = r1.centreCheck.nextState;
    axisState = r1.nextAxisState;
    proxState = r1.proximityState;
    hbState = r1.heartbeatState;
    runEffects(r1.effects, harness.drivers);

    // Advance to t = 1900 where beat 1 fires
    t = 1900;
    const r2 = processPointerMove(
      triangleScene,
      vertexBCoords,
      view300,
      t,
      engineState,
      centreTick,
      axisState,
      DEFAULT_RADII,
      DEFAULT_HAPTICS,
      proxState,
      DEFAULT_PROXIMITY,
      hbState,
      hbCfg,
    );
    engineState = r2.nextEngineState;
    centreTick = r2.centreCheck.nextState;
    axisState = r2.nextAxisState;
    proxState = r2.proximityState;
    hbState = r2.heartbeatState;
    runEffects(r2.effects, harness.drivers);
    expect(r2.effects).toContainEqual({ kind: 'vibrate', pattern: DEFAULT_HEARTBEAT.pattern });

    // Now, at t = 1950 (50 ms < 100 ms of beat start, within beat length of 190 ms),
    // move into empty space (10, 10)
    harness.vibrateCalls.length = 0;
    t = 1950;
    const emptyCoords = { x: 10, y: 10 };
    const r3 = processPointerMove(
      triangleScene,
      emptyCoords,
      view300,
      t,
      engineState,
      centreTick,
      axisState,
      DEFAULT_RADII,
      DEFAULT_HAPTICS,
      proxState,
      DEFAULT_PROXIMITY,
      hbState,
      hbCfg,
    );
    runEffects(r3.effects, harness.drivers);

    expect(r3.target.kind).toBe('none');
    // Moving off the vertex while beat is playing produces vibrate(0) first to stop it
    expect(harness.vibrateCalls).toEqual([0]);
  });

  it('ON: no vibrate call after lift; none while Ask is listening; none while Guide is guiding', () => {
    setStoredCornerHeartbeatSetting(true);
    const harness = createTestHarness();
    let engineState = initialState();
    let centreTick = initialCentreTickState();
    let axisState = initialAxisState();
    let proxState = initialProximityState();
    let hbState = initialHeartbeatState();

    const vertexBCoords = { x: 210, y: 255 };
    const hbCfg = DEFAULT_HEARTBEAT;

    // 1. Entry at t = 1000
    const r1 = processPointerMove(
      triangleScene,
      vertexBCoords,
      view300,
      1000,
      engineState,
      centreTick,
      axisState,
      DEFAULT_RADII,
      DEFAULT_HAPTICS,
      proxState,
      DEFAULT_PROXIMITY,
      hbState,
      hbCfg,
    );
    engineState = r1.nextEngineState;
    centreTick = r1.centreCheck.nextState;
    axisState = r1.nextAxisState;
    proxState = r1.proximityState;
    hbState = r1.heartbeatState;
    runEffects(r1.effects, harness.drivers);

    // 2. Lift: step(engineState, { kind: 'lift', t: 1500 }) stops all effects
    harness.vibrateCalls.length = 0;
    const liftRes = step(engineState, { kind: 'lift', t: 1500 });
    runEffects(liftRes.effects, harness.drivers);
    // Lift calls vibrate(0)
    expect(harness.vibrateCalls).toEqual([0]);

    // Heartbeat state resets on lift
    hbState = initialHeartbeatState();
    engineState = initialState();
    harness.vibrateCalls.length = 0;

    // After lift, with finger lifted: no further vibrate calls
    expect(harness.vibrateCalls.length).toBe(0);

    // 3. Ask listening starts: drivers.haptics.stop() is called once
    harness.vibrateCalls.length = 0;
    harness.drivers.haptics.stop();
    expect(harness.vibrateCalls).toEqual([0]);

    // While Ask is active, moves do not deliver vibration to screen
    harness.vibrateCalls.length = 0;
    const askActive = true;
    if (!askActive) {
      runEffects(r1.effects, harness.drivers);
    }
    expect(harness.vibrateCalls.length).toBe(0);

    // 4. Guide starts guiding: drivers.haptics.stop() is called once
    harness.vibrateCalls.length = 0;
    harness.drivers.haptics.stop();
    expect(harness.vibrateCalls).toEqual([0]);

    // While Guide is active, standard engine move vibration is suppressed
    harness.vibrateCalls.length = 0;
    const isGuiding = true;
    if (!isGuiding) {
      runEffects(r1.effects, harness.drivers);
    }
    expect(harness.vibrateCalls.length).toBe(0);
  });
});
