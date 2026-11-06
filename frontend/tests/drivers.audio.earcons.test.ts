import { describe, expect, it, vi, type Mock } from 'vitest';
import {
  getEarconSteps,
  WebAudioDriver,
  type AudioContextLike,
  type EarconKind,
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
  };
  return ctx;
}

describe('getEarconSteps (pure definitions)', () => {
  const kinds: EarconKind[] = ['start', 'success', 'error', 'listening', 'back'];

  for (const kind of kinds) {
    it(`provides valid steps for earcon: ${kind}`, () => {
      const steps = getEarconSteps(kind);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expect(step.hz).toBeGreaterThan(100);
        expect(step.durationMs).toBeGreaterThan(0);
        expect(step.delayMs).toBeGreaterThanOrEqual(0);
      }
    });
  }

  it('success earcon has ascending triad structure', () => {
    const steps = getEarconSteps('success');
    expect(steps.length).toBe(3);
    expect(steps[1]!.hz).toBeGreaterThan(steps[0]!.hz);
    expect(steps[2]!.hz).toBeGreaterThan(steps[1]!.hz);
  });

  it('error earcon has descending alert structure', () => {
    const steps = getEarconSteps('error');
    expect(steps.length).toBe(2);
    expect(steps[1]!.hz).toBeLessThan(steps[0]!.hz);
  });

  it('locks earcon frequencies, durations, delays and gains (regression lock)', () => {
    expect(getEarconSteps('start')).toEqual([
      { hz: 440, durationMs: 120, delayMs: 0, gain: 0.08 },
      { hz: 660, durationMs: 160, delayMs: 130, gain: 0.09 },
    ]);
    expect(getEarconSteps('success')).toEqual([
      { hz: 523, durationMs: 80, delayMs: 0, gain: 0.07 },
      { hz: 659, durationMs: 80, delayMs: 90, gain: 0.07 },
      { hz: 784, durationMs: 140, delayMs: 180, gain: 0.08 },
    ]);
    expect(getEarconSteps('error')).toEqual([
      { hz: 320, durationMs: 140, delayMs: 0, gain: 0.09 },
      { hz: 220, durationMs: 180, delayMs: 150, gain: 0.09 },
    ]);
    expect(getEarconSteps('listening')).toEqual([
      { hz: 660, durationMs: 150, delayMs: 0, gain: 0.08 },
    ]);
    expect(getEarconSteps('back')).toEqual([
      { hz: 660, durationMs: 100, delayMs: 0, gain: 0.07 },
      { hz: 440, durationMs: 140, delayMs: 110, gain: 0.07 },
    ]);
  });
});

describe('WebAudioDriver.playEarcon', () => {
  it('is a safe no-op before unlock', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    expect(() => driver.playEarcon('start')).not.toThrow();
    expect(ctx.oscillators).toHaveLength(0);
  });

  it('creates oscillators for each step when unlocked', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    // 1 theremin oscillator created on unlock
    expect(ctx.oscillators).toHaveLength(1);

    driver.playEarcon('success');
    // Success has 3 steps -> 1 theremin + 3 cue oscillators = 4 total
    expect(ctx.oscillators).toHaveLength(4);

    expect(ctx.oscillators[1]?.frequency.value).toBe(523);
    expect(ctx.oscillators[2]?.frequency.value).toBe(659);
    expect(ctx.oscillators[3]?.frequency.value).toBe(784);

    expect(ctx.oscillators[1]?.start).toHaveBeenCalled();
    expect(ctx.oscillators[2]?.start).toHaveBeenCalled();
    expect(ctx.oscillators[3]?.start).toHaveBeenCalled();
  });

  it('ducks the theremin tone during earcon playback and restores it after', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    const thereminGain = ctx.gains[0]!.gain;

    // Start theremin tone at 440 Hz
    driver.setTone(440);
    expect(thereminGain.setTargetAtTime).toHaveBeenCalledWith(0.15, 1.0, 0.02);
    thereminGain.setTargetAtTime.mockClear();

    // Play listening earcon (150 ms)
    driver.playEarcon('listening');

    // Verify theremin gain is ducked to 0
    expect(thereminGain.setTargetAtTime).toHaveBeenCalledWith(0, 1.0, 0.03);

    // Verify theremin gain is scheduled to restore to 0.15 after earcon completes
    expect(thereminGain.setTargetAtTime.mock.calls).toHaveLength(2);
    const restoreCall = thereminGain.setTargetAtTime.mock.calls[1];
    expect(restoreCall?.[0]).toBe(0.15);
    expect(restoreCall?.[1]).toBeGreaterThan(1.15);
    expect(restoreCall?.[2]).toBe(0.02);
  });

  it('does not restore theremin tone if setTone was set to null', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    const thereminGain = ctx.gains[0]!.gain;
    driver.setTone(null);
    thereminGain.setTargetAtTime.mockClear();

    driver.playEarcon('back');
    // When tone is inactive, no ducking or restoring calls happen on theremin gain
    expect(thereminGain.setTargetAtTime).not.toHaveBeenCalledWith(0.15, expect.any(Number), expect.any(Number));
  });

  it('cancels scheduled restoration when finger is lifted (setTone(null)) during earcon playback (Finding 1)', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    const thereminGain = ctx.gains[0]!.gain;
    const thereminOsc = ctx.oscillators[0]!.frequency;

    // 1. User is touching: 440 Hz tone playing
    driver.setTone(440);
    expect(thereminGain.setTargetAtTime).toHaveBeenCalledWith(0.15, 1.0, 0.02);
    thereminGain.setTargetAtTime.mockClear();

    // 2. Earcon fires and ducks tone, scheduling restore
    driver.playEarcon('listening');
    expect(thereminGain.setTargetAtTime).toHaveBeenCalledWith(0, 1.0, 0.03);
    expect(thereminGain.cancelScheduledValues).toHaveBeenCalledWith(1.0);

    // 3. User lifts finger while earcon is still playing (t = 1.05)
    ctx.currentTime = 1.05;
    thereminGain.setTargetAtTime.mockClear();
    thereminGain.cancelScheduledValues.mockClear();
    thereminOsc.cancelScheduledValues.mockClear();

    driver.setTone(null);

    // setTone(null) must cancel scheduled restore values and fade to 0
    expect(thereminGain.cancelScheduledValues).toHaveBeenCalledWith(1.05);
    expect(thereminOsc.cancelScheduledValues).toHaveBeenCalledWith(1.05);
    expect(thereminGain.setTargetAtTime).toHaveBeenCalledWith(0, 1.05, 0.03);

    // Verify no subsequent restore call was made
    expect(thereminGain.setTargetAtTime).not.toHaveBeenCalledWith(0.15, expect.any(Number), expect.any(Number));
  });

  it('reschedules restoration to new pitch when setTone(newHz) is called during earcon (Finding 1)', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    const thereminGain = ctx.gains[0]!.gain;
    const thereminOsc = ctx.oscillators[0]!.frequency;

    driver.setTone(440);
    driver.playEarcon('listening'); // restoreAt = 1.0 + 0.15 + 0.05 = 1.20

    ctx.currentTime = 1.05;
    thereminGain.setTargetAtTime.mockClear();
    thereminOsc.setTargetAtTime.mockClear();

    // Finger moves to new pitch while earcon is playing
    driver.setTone(550);

    // Tone must stay ducked at now (1.05) and restore to 550 at 1.20
    expect(thereminGain.cancelScheduledValues).toHaveBeenCalledWith(1.05);
    expect(thereminOsc.cancelScheduledValues).toHaveBeenCalledWith(1.05);
    expect(thereminGain.setTargetAtTime).toHaveBeenCalledWith(0, 1.05, 0.03);
    expect(thereminOsc.setTargetAtTime).toHaveBeenCalledWith(550, 1.2, 0.02);
    expect(thereminGain.setTargetAtTime).toHaveBeenCalledWith(0.15, 1.2, 0.02);
  });

  it('disconnects earcon oscillators and gains when each step ends (Finding 13)', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    driver.playEarcon('start'); // 2 steps -> oscillators[1] and oscillators[2]
    expect(ctx.oscillators).toHaveLength(3);
    expect(ctx.gains).toHaveLength(3);

    const step1Osc = ctx.oscillators[1]!;
    const step1Gain = ctx.gains[1]!;
    const step2Osc = ctx.oscillators[2]!;
    const step2Gain = ctx.gains[2]!;

    expect(step1Osc.onended).toBeDefined();
    expect(step2Osc.onended).toBeDefined();

    // Trigger onended for step 1
    step1Osc.onended?.(new Event('ended'));
    expect(step1Osc.disconnect).toHaveBeenCalled();
    expect(step1Gain.disconnect).toHaveBeenCalled();

    // Trigger onended for step 2
    step2Osc.onended?.(new Event('ended'));
    expect(step2Osc.disconnect).toHaveBeenCalled();
    expect(step2Gain.disconnect).toHaveBeenCalled();

    // Theremin oscillator and gain must not be disconnected
    expect(ctx.oscillators[0]!.disconnect).not.toHaveBeenCalled();
    expect(ctx.gains[0]!.disconnect).not.toHaveBeenCalled();
  });
});
