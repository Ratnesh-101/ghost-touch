import { describe, expect, it, vi, type Mock } from 'vitest';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  DEFAULT_PROXIMITY,
  _resetFindingSoundSettingForTesting,
  getStoredFindingSoundSetting,
  initialAxisState,
  initialCentreTickState,
  initialProximityState,
  initialState,
  processPointerMove,
  proximityStep,
  setStoredFindingSoundSetting,
  type MovePipelineResult,
} from '../src/flow/explore';
import {
  WebAudioDriver,
  runProximityEffects,
  type Drivers,
  type MemoryDiagramStore,
} from '../src/drivers';
import type {
  AudioContextLike,
  GainLike,
  OscillatorLike,
  ParamLike,
  StereoPannerLike,
} from '../src/drivers/audio';

function fakeParam(): ParamLike & {
  setTargetAtTime: Mock<ParamLike['setTargetAtTime']>;
  cancelScheduledValues: Mock<NonNullable<ParamLike['cancelScheduledValues']>>;
} {
  return {
    value: 0,
    setTargetAtTime: vi.fn<ParamLike['setTargetAtTime']>(),
    cancelScheduledValues: vi.fn(),
  };
}

interface FakeContext extends AudioContextLike {
  currentTime: number;
  oscillators: Array<
    OscillatorLike & {
      frequency: ReturnType<typeof fakeParam>;
      start: Mock<OscillatorLike['start']>;
      stop: Mock<OscillatorLike['stop']>;
      disconnect: Mock<NonNullable<OscillatorLike['disconnect']>>;
    }
  >;
  gains: Array<
    GainLike & {
      gain: ReturnType<typeof fakeParam>;
      disconnect: Mock<NonNullable<GainLike['disconnect']>>;
    }
  >;
  panners: Array<
    StereoPannerLike & {
      pan: ReturnType<typeof fakeParam>;
      disconnect: Mock<NonNullable<StereoPannerLike['disconnect']>>;
    }
  >;
  resume: Mock<AudioContextLike['resume']>;
  state: string;
}

function createFakeContext(state = 'running', withPanner = true): FakeContext {
  const ctx: FakeContext = {
    currentTime: 1,
    state,
    destination: {},
    oscillators: [],
    gains: [],
    panners: [],
    resume: vi.fn<AudioContextLike['resume']>().mockResolvedValue(undefined),
    createOscillator() {
      const osc = {
        type: '',
        frequency: fakeParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn<OscillatorLike['start']>(),
        stop: vi.fn<OscillatorLike['stop']>(),
        onended: null as OscillatorLike['onended'],
      };
      ctx.oscillators.push(osc);
      return osc;
    },
    createGain() {
      const gain = {
        gain: fakeParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      ctx.gains.push(gain);
      return gain;
    },
    createStereoPanner: withPanner
      ? () => {
          const panner = {
            pan: fakeParam(),
            connect: vi.fn(),
            disconnect: vi.fn(),
          };
          ctx.panners.push(panner);
          return panner;
        }
      : undefined,
  };
  return ctx;
}

describe('AudioDriver playClick (fake audio context)', () => {
  it('playClick before unlock is a safe no-op and does not throw', () => {
    const ctx = createFakeContext();
    const driver = new WebAudioDriver(() => ctx);
    expect(() => driver.playClick(600, 0, 0.4)).not.toThrow();
    expect(ctx.oscillators).toHaveLength(0);
    expect(ctx.gains).toHaveLength(0);
  });

  it('playClick does not touch the theremin nodes', () => {
    const ctx = createFakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    // Theremin tone active
    driver.setTone(440);
    expect(ctx.oscillators).toHaveLength(1);
    expect(ctx.gains).toHaveLength(1);

    const thereminOsc = ctx.oscillators[0]!;
    const thereminGain = ctx.gains[0]!;

    thereminOsc.start.mockClear();
    thereminOsc.stop.mockClear();
    thereminOsc.frequency.setTargetAtTime.mockClear();
    thereminOsc.frequency.cancelScheduledValues.mockClear();
    thereminGain.gain.setTargetAtTime.mockClear();
    thereminGain.gain.cancelScheduledValues.mockClear();

    // Fire near-line click
    driver.playClick(850, 0.25, 0.45);

    // Theremin oscillator and gain are completely untouched
    expect(thereminOsc.stop).not.toHaveBeenCalled();
    expect(thereminOsc.frequency.setTargetAtTime).not.toHaveBeenCalled();
    expect(thereminOsc.frequency.cancelScheduledValues).not.toHaveBeenCalled();
    expect(thereminGain.gain.setTargetAtTime).not.toHaveBeenCalled();
    expect(thereminGain.gain.cancelScheduledValues).not.toHaveBeenCalled();

    // A separate oscillator was created for the click
    expect(ctx.oscillators).toHaveLength(2);
    const clickOsc = ctx.oscillators[1]!;
    expect(clickOsc.type).toBe('sine');
    expect(clickOsc.frequency.value).toBe(850);
    expect(clickOsc.start).toHaveBeenCalledWith(ctx.currentTime);
    // Enveloped blip duration <= 30 ms (stops at now + 0.025 s)
    expect(clickOsc.stop).toHaveBeenCalledWith(ctx.currentTime + 0.025);

    // Click gain was configured
    expect(ctx.gains).toHaveLength(2);
    const clickGain = ctx.gains[1]!;
    expect(clickGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.45, ctx.currentTime, 0.002);

    // Stereo panner received pan
    expect(ctx.panners).toHaveLength(1);
    expect(ctx.panners[0]!.pan.value).toBe(0.25);
  });

  it('playClick does not touch the guide tone oscillator or gain', () => {
    const ctx = createFakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    driver.setGuideTone(600, -0.5);
    const guideOsc = ctx.oscillators[1]!;
    const guideGain = ctx.gains[1]!;
    guideOsc.stop.mockClear();
    guideGain.gain.setTargetAtTime.mockClear();

    driver.playClick(1000, 0, 0.5);

    expect(guideOsc.stop).not.toHaveBeenCalled();
    expect(guideGain.gain.setTargetAtTime).not.toHaveBeenCalled();
    // Click oscillator created as oscillator index 2
    expect(ctx.oscillators).toHaveLength(3);
  });

  it('playClick works in mono when createStereoPanner is absent', () => {
    const ctx = createFakeContext('running', false); // no createStereoPanner
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    expect(() => driver.playClick(700, 0.5, 0.3)).not.toThrow();
    expect(ctx.panners).toHaveLength(0);
    // Connects click gain directly to destination
    expect(ctx.gains[1]!.connect).toHaveBeenCalledWith(ctx.destination);
  });

  it('playClick disconnects nodes onended', () => {
    const ctx = createFakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    driver.playClick(650, 0.1, 0.3);
    const clickOsc = ctx.oscillators[1]!;
    const clickGain = ctx.gains[1]!;
    const clickPanner = ctx.panners[0]!;

    expect(clickOsc.onended).toBeDefined();
    clickOsc.onended?.(new Event('ended'));

    expect(clickOsc.disconnect).toHaveBeenCalled();
    expect(clickGain.disconnect).toHaveBeenCalled();
    expect(clickPanner.disconnect).toHaveBeenCalled();
  });

  it('playClick handles invalid frequencies safely without throwing', () => {
    const ctx = createFakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    expect(() => driver.playClick(Number.NaN, 0, 0.3)).not.toThrow();
    expect(() => driver.playClick(-50, 0, 0.3)).not.toThrow();
    expect(() => driver.playClick(0, 0, 0.3)).not.toThrow();
    // No click oscillator created
    expect(ctx.oscillators).toHaveLength(1);
  });
});

describe('Near-line click cue trace (shrinking gaps from 45 px to 15 px off side CA)', () => {
  // Vertical line CA from (200, 80) to (200, 320)
  const scene: DiagramScene = {
    kind: 'geometry',
    title: 'Segment CA',
    points: [
      { id: 'C', x: 0.5, y: 0.2, label: 'Point C' },
      { id: 'A', x: 0.5, y: 0.8, label: 'Point A' },
    ],
    segments: [{ id: 'CA', a: 'C', b: 'A' }],
  };
  const view = makeViewport(400, 400);

  it('emits clicks with shrinking gaps as finger moves from 45 px to 15 px off side CA', () => {
    let proxState = initialProximityState();
    let engState = initialState();
    const centreState = initialCentreTickState();
    const axState = initialAxisState();

    // Finger moves horizontally towards line CA (x=200):
    // 45 px off CA -> (245, 200)
    // 35 px off CA -> (235, 200)
    // 25 px off CA -> (225, 200)
    // 15 px off CA -> (215, 200)

    const recordedClicks: Array<{ t: number; hz: number; gain: number; pan: number; gap?: number }> = [];

    // Step 1: at t=0, finger touches down at 45 px off CA
    const r1 = processPointerMove(
      scene,
      { x: 245, y: 200 },
      view,
      0,
      engState,
      centreState,
      axState,
      undefined,
      undefined,
      proxState,
    );
    expect(r1.nearest?.id).toBe('CA');
    expect(r1.nearest?.distPx).toBeCloseTo(45);
    expect(r1.target.kind).toBe('none'); // outside 14 px line radius
    expect(r1.proximityEffects).toHaveLength(1);
    const c1 = r1.proximityEffects[0]!;
    expect(c1.kind).toBe('click');
    expect(c1.hz).toBeCloseTo(561.8, 0); // low pitch (~562 Hz)
    expect(c1.gain).toBeCloseTo(0.326, 2); // far gain (~0.33)
    expect(c1.pan).toBeLessThan(0); // panned left towards line
    recordedClicks.push({ t: 0, hz: c1.hz, gain: c1.gain, pan: c1.pan });
    proxState = r1.proximityState;
    engState = r1.nextEngineState;

    // Intermediate move at t=150 at 42 px: not due yet (interval at 45 px is ~373 ms)
    const rMid1 = processPointerMove(
      scene,
      { x: 242, y: 200 },
      view,
      150,
      engState,
      centreState,
      axState,
      undefined,
      undefined,
      proxState,
    );
    expect(rMid1.proximityEffects).toHaveLength(0);
    proxState = rMid1.proximityState;

    // Step 2: at t=380 ms (gap = 380 ms >= 373 ms), finger at 35 px off CA
    const r2 = processPointerMove(
      scene,
      { x: 235, y: 200 },
      view,
      380,
      engState,
      centreState,
      axState,
      undefined,
      undefined,
      proxState,
    );
    expect(r2.nearest?.distPx).toBeCloseTo(35);
    expect(r2.proximityEffects).toHaveLength(1);
    const c2 = r2.proximityEffects[0]!;
    expect(c2.hz).toBeGreaterThan(c1.hz); // pitch rises
    expect(c2.gain).toBeGreaterThan(c1.gain); // gain rises
    recordedClicks.push({ t: 380, hz: c2.hz, gain: c2.gain, pan: c2.pan, gap: 380 });
    proxState = r2.proximityState;

    // Step 3: at t=670 ms (gap = 290 ms >= interval(25 px) which is ~190 ms), finger at 25 px off CA
    const r3 = processPointerMove(
      scene,
      { x: 225, y: 200 },
      view,
      670,
      engState,
      centreState,
      axState,
      undefined,
      undefined,
      proxState,
    );
    expect(r3.nearest?.distPx).toBeCloseTo(25);
    expect(r3.proximityEffects).toHaveLength(1);
    const c3 = r3.proximityEffects[0]!;
    expect(c3.hz).toBeGreaterThan(c2.hz);
    expect(c3.gain).toBeGreaterThan(c2.gain);
    recordedClicks.push({ t: 670, hz: c3.hz, gain: c3.gain, pan: c3.pan, gap: 290 });
    proxState = r3.proximityState;

    // Step 4: at t=820 ms (gap = 150 ms >= interval(15 px) which is ~99 ms), finger at 15 px off CA
    const r4 = processPointerMove(
      scene,
      { x: 215, y: 200 },
      view,
      820,
      engState,
      centreState,
      axState,
      undefined,
      undefined,
      proxState,
    );
    expect(r4.nearest?.distPx).toBeCloseTo(15);
    expect(r4.proximityEffects).toHaveLength(1);
    const c4 = r4.proximityEffects[0]!;
    expect(c4.hz).toBeGreaterThan(c3.hz);
    expect(c4.gain).toBeGreaterThan(c3.gain);
    recordedClicks.push({ t: 820, hz: c4.hz, gain: c4.gain, pan: c4.pan, gap: 150 });

    // Verify shrinking gaps between successive clicks
    const gaps = recordedClicks.map((c) => c.gap).filter((g): g is number => g !== undefined);
    expect(gaps).toEqual([380, 290, 150]);
    expect(gaps[0]!).toBeGreaterThan(gaps[1]!);
    expect(gaps[1]!).toBeGreaterThan(gaps[2]!);

    // Verify rising pitches
    expect(recordedClicks[0]!.hz).toBeLessThan(recordedClicks[1]!.hz);
    expect(recordedClicks[1]!.hz).toBeLessThan(recordedClicks[2]!.hz);
    expect(recordedClicks[2]!.hz).toBeLessThan(recordedClicks[3]!.hz);
  });
});

describe('Negative cases: no clicks under forbidden conditions', () => {
  const scene: DiagramScene = {
    kind: 'geometry',
    title: 'Test Line',
    points: [
      { id: 'C', x: 0.5, y: 0.2 },
      { id: 'A', x: 0.5, y: 0.8 },
    ],
    segments: [{ id: 'CA', a: 'C', b: 'A' }],
  };
  const view = makeViewport(400, 400);

  it('no clicks beyond 48 px (radiusPx)', () => {
    // 50 px off line (x = 250, line x = 200)
    const res = processPointerMove(
      scene,
      { x: 250, y: 200 },
      view,
      100,
      initialState(),
      initialCentreTickState(),
      initialAxisState(),
    );
    expect(res.proximityEffects).toEqual([]);
  });

  it('no clicks on a line outside the quiet window', () => {
    // Directly on line (x = 200, y = 200), quietUntil = -Infinity
    const state = { ...initialState(), quietUntil: 0 };
    const res = processPointerMove(
      scene,
      { x: 200, y: 200 },
      view,
      500, // 500 > quietUntil (outside quiet window)
      state,
      initialCentreTickState(),
      initialAxisState(),
    );
    expect(res.target.kind).toBe('line');
    expect(res.proximityEffects).toEqual([]);
    // Line buzz is emitted instead
    expect(res.effects).toContainEqual({ kind: 'vibrate', pattern: 80 });
  });

  it('emits clicks on a line INSIDE the quiet window', () => {
    // Directly on line (x = 200, y = 200), quietUntil = 1000
    const state = { ...initialState(), quietUntil: 1000 };
    const res = processPointerMove(
      scene,
      { x: 200, y: 200 },
      view,
      500, // 500 < 1000 (inside quiet window)
      state,
      initialCentreTickState(),
      initialAxisState(),
    );
    expect(res.target.kind).toBe('line');
    // Emits click at closest setting
    expect(res.proximityEffects).toHaveLength(1);
    expect(res.proximityEffects[0]!.hz).toBe(DEFAULT_PROXIMITY.hiHz);
    expect(res.proximityEffects[0]!.gain).toBeCloseTo(0.6);
  });

  it('no clicks after lift', () => {
    const s0 = initialProximityState();
    const liftRes = proximityStep(s0, { kind: 'lift', t: 200 });
    expect(liftRes.effects).toEqual([]);
  });

  it('no clicks dispatched with the toggle off', () => {
    _resetFindingSoundSettingForTesting();
    setStoredFindingSoundSetting(false);
    expect(getStoredFindingSoundSetting()).toBe(false);

    const playClickMock = vi.fn();
    const mockDrivers: Drivers = {
      haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        playClick: playClickMock,
        state: 'running',
      },
      speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
      diagramStore: {} as unknown as MemoryDiagramStore,
    };

    // Finger is at 25 px off line (where clicks would normally fire)
    const res = processPointerMove(
      scene,
      { x: 225, y: 200 },
      view,
      100,
      initialState(),
      initialCentreTickState(),
      initialAxisState(),
    );
    expect(res.proximityEffects).toHaveLength(1);

    // Simulated Explore driver dispatch guarded by getStoredFindingSoundSetting()
    if (getStoredFindingSoundSetting()) {
      runProximityEffects(res.proximityEffects, mockDrivers);
    }
    expect(playClickMock).not.toHaveBeenCalled();

    _resetFindingSoundSettingForTesting();
  });
});

describe('Haptics invariance: vibrate calls of a fixed trace are identical with toggle on and off', () => {
  const triangleScene: DiagramScene = {
    kind: 'geometry',
    title: 'Triangle',
    points: [
      { id: 'A', x: 0.5, y: 0.15, label: 'Point A' },
      { id: 'B', x: 0.15, y: 0.85, label: 'Point B' },
      { id: 'C', x: 0.85, y: 0.85, label: 'Point C' },
    ],
    segments: [
      { id: 's1', a: 'A', b: 'B' },
      { id: 's2', a: 'B', b: 'C' },
      { id: 's3', a: 'C', b: 'A' },
    ],
  };
  const view = makeViewport(400, 400);

  // Scripted trace:
  // 1. Off-line at (245, 200)
  // 2. Cross onto segment s3 at (270, 200)
  // 3. Move along segment to vertex A at (200, 60)
  // 4. Move away from vertex during quiet window at (220, 90)
  // 5. Move off line at (150, 150)
  const trace = [
    { x: 245, y: 200, t: 0 },
    { x: 270, y: 200, t: 100 },
    { x: 200, y: 60, t: 250 },
    { x: 220, y: 90, t: 400 },
    { x: 150, y: 150, t: 800 },
  ];

  function runTrace(findingSoundOn: boolean): number[][] {
    setStoredFindingSoundSetting(findingSoundOn);

    const vibrateCalls: number[][] = [];
    const mockHaptics = {
      supported: true,
      lastResult: null,
      vibrate: vi.fn((pattern: number | number[]) => {
        const arr = Array.isArray(pattern) ? pattern : [pattern];
        vibrateCalls.push(arr);
        return true;
      }),
      stop: vi.fn(),
    };
    const mockAudio = {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      playClick: vi.fn(),
      state: 'running' as const,
    };
    const mockDrivers: Drivers = {
      haptics: mockHaptics,
      audio: mockAudio,
      speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
      diagramStore: {} as unknown as MemoryDiagramStore,
    };

    let engState = initialState();
    let centreState = initialCentreTickState();
    let axState = initialAxisState();
    let proxState = initialProximityState();

    for (const step of trace) {
      const res: MovePipelineResult = processPointerMove(
        triangleScene,
        { x: step.x, y: step.y },
        view,
        step.t,
        engState,
        centreState,
        axState,
        undefined,
        undefined,
        proxState,
      );
      engState = res.nextEngineState;
      centreState = res.centreCheck.nextState;
      axState = res.nextAxisState;
      proxState = res.proximityState;

      // Dispatch haptic effects
      for (const eff of res.effects) {
        if (eff.kind === 'vibrate') {
          mockDrivers.haptics.vibrate(eff.pattern);
        }
      }

      // Proximity effects dispatched if toggle on
      if (getStoredFindingSoundSetting()) {
        runProximityEffects(res.proximityEffects, mockDrivers);
      }
    }

    return vibrateCalls;
  }

  it('produces identical vibrate calls whether finding sound toggle is on or off', () => {
    _resetFindingSoundSettingForTesting();

    const vibrateCallsToggleOn = runTrace(true);
    const vibrateCallsToggleOff = runTrace(false);

    expect(vibrateCallsToggleOn.length).toBeGreaterThan(0);
    expect(vibrateCallsToggleOn).toEqual(vibrateCallsToggleOff);

    _resetFindingSoundSettingForTesting();
  });

  it('never calls haptics.vibrate from runProximityEffects', () => {
    const vibrateMock = vi.fn();
    const mockDrivers: Drivers = {
      haptics: { supported: true, lastResult: null, vibrate: vibrateMock, stop: vi.fn() },
      audio: {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        playClick: vi.fn(),
        state: 'running',
      },
      speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
      diagramStore: {} as unknown as MemoryDiagramStore,
    };

    runProximityEffects(
      [
        { kind: 'click', hz: 800, pan: 0.2, gain: 0.4 },
        { kind: 'click', hz: 1200, pan: -0.5, gain: 0.6 },
      ],
      mockDrivers,
    );

    expect(vibrateMock).not.toHaveBeenCalled();
    expect(mockDrivers.audio.playClick).toHaveBeenCalledTimes(2);
  });
});
