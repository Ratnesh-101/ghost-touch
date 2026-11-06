import { describe, expect, it, vi, type Mock } from 'vitest';
import {
  WebAudioDriver,
  type AudioContextLike,
  type AudioHost,
  type GainLike,
  type OscillatorLike,
  type ParamLike,
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
  resume: Mock<AudioContextLike['resume']>;
  state: string;
}

function fakeContext(state = 'running'): FakeContext {
  const ctx: FakeContext = {
    currentTime: 1.0,
    state,
    destination: {},
    oscillators: [],
    gains: [],
    resume: vi.fn<AudioContextLike['resume']>().mockImplementation(async () => {
      ctx.state = 'running';
    }),
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
  };
  return ctx;
}

interface FakeHostFixture {
  host: AudioHost;
  windowListeners: Map<string, (ev: unknown) => void>;
  documentListeners: Map<string, (ev: unknown) => void>;
  setDocumentVisibility: (state: 'visible' | 'hidden') => void;
  triggerWindow: (type: string, ev?: unknown) => void;
  triggerDocument: (type: string, ev?: unknown) => void;
}

function createFakeHost(initialVisibility: 'visible' | 'hidden' = 'visible'): FakeHostFixture {
  const windowListeners = new Map<string, (ev: unknown) => void>();
  const documentListeners = new Map<string, (ev: unknown) => void>();
  let visibilityState = initialVisibility;
  let hidden = initialVisibility === 'hidden';

  const doc = {
    addEventListener: (type: string, listener: (ev: unknown) => void) => {
      documentListeners.set(type, listener);
    },
    removeEventListener: (type: string) => {
      documentListeners.delete(type);
    },
    get hidden() {
      return hidden;
    },
    get visibilityState() {
      return visibilityState;
    },
  };

  const win = {
    addEventListener: (type: string, listener: (ev: unknown) => void) => {
      windowListeners.set(type, listener);
    },
    removeEventListener: (type: string) => {
      windowListeners.delete(type);
    },
  };

  return {
    host: { window: win, document: doc },
    windowListeners,
    documentListeners,
    setDocumentVisibility(state) {
      visibilityState = state;
      hidden = state === 'hidden';
      documentListeners.get('visibilitychange')?.({});
    },
    triggerWindow(type, ev = {}) {
      windowListeners.get(type)?.(ev);
    },
    triggerDocument(type, ev = {}) {
      documentListeners.get(type)?.(ev);
    },
  };
}

describe('WebAudioDriver lifecycle and recovery (Finding 6)', () => {
  it('resumes suspended context when app becomes visible after camera switch without creating a second context', () => {
    const fixture = createFakeHost('visible');
    const factoryCalls: FakeContext[] = [];
    const factory = (): FakeContext => {
      const c = fakeContext('running');
      factoryCalls.push(c);
      return c;
    };

    const driver = new WebAudioDriver(factory, fixture.host);
    driver.unlock();

    expect(factoryCalls).toHaveLength(1);
    const ctx = factoryCalls[0]!;
    expect(ctx.state).toBe('running');

    // User switches to native camera app: Chrome suspends AudioContext
    ctx.state = 'suspended';
    expect(driver.state).toBe('suspended');

    // User returns from camera: tab becomes visible
    fixture.setDocumentVisibility('visible');

    // Context must be resumed
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    // Crucially, NO second context created
    expect(factoryCalls).toHaveLength(1);
  });

  it('does not produce any tone by itself when resuming a suspended context while idle (Finding 6)', () => {
    const fixture = createFakeHost('visible');
    const ctx = fakeContext('running');
    const driver = new WebAudioDriver(() => ctx, fixture.host);
    driver.unlock();

    // While no tone is requested (idle exploration, no finger on canvas)
    const thereminGain = ctx.gains[0]!.gain;
    expect(thereminGain.value).toBe(0);

    // AudioContext suspended during camera usage
    ctx.state = 'suspended';
    thereminGain.setTargetAtTime.mockClear();

    // Visibility restored
    fixture.setDocumentVisibility('visible');

    // Resume was requested, but gain was not raised
    expect(ctx.resume).toHaveBeenCalled();
    expect(thereminGain.setTargetAtTime).not.toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('resumes suspended context on next user gesture (pointerdown, touchstart, keydown)', () => {
    const gestures = ['pointerdown', 'touchstart', 'keydown'] as const;

    for (const gesture of gestures) {
      const fixture = createFakeHost('visible');
      const ctx = fakeContext('running');
      const driver = new WebAudioDriver(() => ctx, fixture.host);
      driver.unlock();

      // Backgrounded camera switches context to suspended
      ctx.state = 'suspended';
      ctx.resume.mockClear();

      fixture.triggerWindow(gesture);
      expect(ctx.resume).toHaveBeenCalledTimes(1);
    }
  });

  it('resumes suspended context when setTone is called on touch in Explore screen', () => {
    const ctx = fakeContext('running');
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    // OS suspends context during camera capture
    ctx.state = 'suspended';
    ctx.resume.mockClear();

    driver.setTone(440);

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.oscillators[0]?.frequency.setTargetAtTime).toHaveBeenCalledWith(440, 1.0, 0.02);
  });

  it('does not attach resume listeners or resume context before unlock() is called', () => {
    const fixture = createFakeHost('visible');
    let factoryCalled = false;
    const factory = (): FakeContext => {
      factoryCalled = true;
      return fakeContext('suspended');
    };

    const driver = new WebAudioDriver(factory, fixture.host);
    expect(driver.state).toBe('locked');

    // Visibility changes or gestures before unlock must not trigger context creation
    fixture.setDocumentVisibility('visible');
    fixture.triggerWindow('pointerdown');

    expect(factoryCalled).toBe(false);
    expect(driver.state).toBe('locked');
  });

  it('ignores visibilitychange when document transitions to hidden', () => {
    const fixture = createFakeHost('visible');
    const ctx = fakeContext('suspended');
    const driver = new WebAudioDriver(() => ctx, fixture.host);
    driver.unlock();

    ctx.resume.mockClear();
    fixture.setDocumentVisibility('hidden');

    expect(ctx.resume).not.toHaveBeenCalled();
  });
});

describe('WebAudioDriver ducking and tone restoration race (Finding 1)', () => {
  it('ducking cancels scheduled automations and does not leave stuck drone on finger lift', () => {
    const ctx = fakeContext('running');
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    const thereminGain = ctx.gains[0]!.gain;
    const thereminOsc = ctx.oscillators[0]!.frequency;

    // 1. User touches canvas: continuous tone at 500 Hz
    driver.setTone(500);
    expect(thereminGain.setTargetAtTime).toHaveBeenCalledWith(0.15, 1.0, 0.02);
    thereminGain.setTargetAtTime.mockClear();

    // 2. Earcon fires (e.g. listening cue): ducks tone and schedules restore
    driver.playEarcon('listening');
    expect(thereminGain.setTargetAtTime).toHaveBeenCalledWith(0, 1.0, 0.03);

    // 3. User lifts finger while earcon is playing
    ctx.currentTime = 1.05;
    thereminGain.setTargetAtTime.mockClear();
    thereminGain.cancelScheduledValues.mockClear();
    thereminOsc.cancelScheduledValues.mockClear();

    driver.setTone(null);

    // Automation was cancelled at 1.05 and gain was faded to 0
    expect(thereminGain.cancelScheduledValues).toHaveBeenCalledWith(1.05);
    expect(thereminOsc.cancelScheduledValues).toHaveBeenCalledWith(1.05);
    expect(thereminGain.setTargetAtTime).toHaveBeenCalledWith(0, 1.05, 0.03);

    // At no point in the future does the tone restore to 0.15
    expect(thereminGain.setTargetAtTime).not.toHaveBeenCalledWith(
      0.15,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('rapid successive earcons cancel previous restore schedule without overlapping', () => {
    const ctx = fakeContext('running');
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    const thereminGain = ctx.gains[0]!.gain;
    driver.setTone(440);

    // Earcon 1
    driver.playEarcon('start');
    expect(thereminGain.cancelScheduledValues).toHaveBeenCalledWith(1.0);

    // Earcon 2 fired rapidly before earcon 1 completes (t = 1.1)
    ctx.currentTime = 1.1;
    thereminGain.cancelScheduledValues.mockClear();
    driver.playEarcon('listening');

    expect(thereminGain.cancelScheduledValues).toHaveBeenCalledWith(1.1);
  });
});

describe('WebAudioDriver node cleanup and disconnection (Finding 13)', () => {
  it('disconnects all earcon oscillators and gain nodes upon onended completion', () => {
    const ctx = fakeContext('running');
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    // Success earcon has 3 steps
    driver.playEarcon('success');
    expect(ctx.oscillators).toHaveLength(4); // 1 theremin + 3 cue oscs
    expect(ctx.gains).toHaveLength(4); // 1 theremin + 3 cue gains

    for (let i = 1; i <= 3; i++) {
      const cueOsc = ctx.oscillators[i]!;
      const cueGain = ctx.gains[i]!;
      expect(cueOsc.onended).toBeTypeOf('function');

      cueOsc.onended?.(new Event('ended'));
      expect(cueOsc.disconnect).toHaveBeenCalled();
      expect(cueGain.disconnect).toHaveBeenCalled();
    }

    // Theremin oscillator and gain must remain connected
    expect(ctx.oscillators[0]!.disconnect).not.toHaveBeenCalled();
    expect(ctx.gains[0]!.disconnect).not.toHaveBeenCalled();
  });
});
