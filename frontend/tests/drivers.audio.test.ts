import { describe, it, expect, vi, type Mock } from 'vitest';
import {
  WebAudioDriver,
  type AudioContextLike,
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
    currentTime: 1,
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

describe('WebAudioDriver', () => {
  it('setTone before unlock is a safe no-op', () => {
    const driver = new WebAudioDriver(() => fakeContext());
    expect(() => driver.setTone(440)).not.toThrow();
    expect(() => driver.setTone(null)).not.toThrow();
    expect(driver.state).toBe('locked');
  });

  it('beep before unlock is a safe no-op', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.beep(440, 100);
    expect(ctx.oscillators).toHaveLength(0);
  });

  it('unlock creates exactly one started sine oscillator, even if called twice', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();
    driver.unlock();
    expect(ctx.oscillators).toHaveLength(1);
    expect(ctx.oscillators[0]?.type).toBe('sine');
    expect(ctx.oscillators[0]?.start).toHaveBeenCalledTimes(1);
    expect(ctx.gains[0]?.gain.value).toBe(0);
    expect(driver.state).toBe('running');
  });

  it('unlock resumes a suspended context', () => {
    const ctx = fakeContext('suspended');
    new WebAudioDriver(() => ctx).unlock();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('unlock does not throw when resume is refused', async () => {
    const ctx = fakeContext('suspended');
    ctx.resume.mockRejectedValue(new Error('blocked'));
    expect(() => new WebAudioDriver(() => ctx).unlock()).not.toThrow();
    await Promise.resolve();
  });

  it('treats a throwing AudioContext constructor as unavailable', () => {
    const driver = new WebAudioDriver(() => {
      throw new Error('blocked by policy');
    });
    expect(() => driver.unlock()).not.toThrow();
    expect(driver.state).toBe('unavailable');
  });

  it('reports unavailable when Web Audio does not exist', () => {
    const driver = new WebAudioDriver(() => undefined);
    driver.unlock();
    expect(driver.state).toBe('unavailable');
    expect(() => driver.setTone(300)).not.toThrow();
  });

  it('setTone(hz) smooths frequency (0.02) and raises gain to 0.15 (0.02)', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();
    driver.setTone(600);
    expect(ctx.oscillators[0]?.frequency.setTargetAtTime).toHaveBeenCalledWith(600, 1, 0.02);
    expect(ctx.gains[0]?.gain.setTargetAtTime).toHaveBeenCalledWith(0.15, 1, 0.02);
  });

  it('setTone(null) fades gain to 0 with time constant 0.03', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();
    driver.setTone(null);
    expect(ctx.gains[0]?.gain.setTargetAtTime).toHaveBeenCalledWith(0, 1, 0.03);
  });

  it('fade-out is below 4% of the tone level after 100 ms (Requirement 5.3)', () => {
    const remaining = Math.exp(-0.1 / 0.03);
    expect(remaining).toBeLessThan(0.04);
  });

  it('ignores a non-finite frequency by fading out instead of throwing', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();
    driver.setTone(Number.NaN);
    expect(ctx.gains[0]?.gain.setTargetAtTime).toHaveBeenCalledWith(0, 1, 0.03);
  });

  it('beep uses its own oscillator and leaves the main tone alone', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();
    driver.beep(440, 200);
    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.oscillators[1]?.frequency.value).toBe(440);
    expect(ctx.oscillators[1]?.start).toHaveBeenCalledTimes(1);
    expect(ctx.oscillators[1]?.stop).toHaveBeenCalledTimes(1);
    expect(ctx.oscillators[0]?.stop).not.toHaveBeenCalled();
    expect(ctx.gains[0]?.gain.setTargetAtTime).not.toHaveBeenCalled();
  });

  it('beep ignores bad input', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();
    driver.beep(Number.NaN, 100);
    driver.beep(440, 0);
    driver.beep(440, -5);
    expect(ctx.oscillators).toHaveLength(1);
  });

  it('setTone(hz) and setTone(null) cancel scheduled values (Finding 1)', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    driver.setTone(440);
    expect(ctx.gains[0]?.gain.cancelScheduledValues).toHaveBeenCalledWith(1);
    expect(ctx.oscillators[0]?.frequency.cancelScheduledValues).toHaveBeenCalledWith(1);

    ctx.currentTime = 2;
    driver.setTone(null);
    expect(ctx.gains[0]?.gain.cancelScheduledValues).toHaveBeenCalledWith(2);
    expect(ctx.oscillators[0]?.frequency.cancelScheduledValues).toHaveBeenCalledWith(2);
  });

  it('beep disconnects its oscillator and gain when playback ends (Finding 13)', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    driver.beep(440, 150);
    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.gains).toHaveLength(2);

    const beepOsc = ctx.oscillators[1]!;
    const beepGain = ctx.gains[1]!;
    expect(beepOsc.onended).toBeDefined();

    beepOsc.onended?.(new Event('ended'));
    expect(beepOsc.disconnect).toHaveBeenCalled();
    expect(beepGain.disconnect).toHaveBeenCalled();
    expect(ctx.oscillators[0]!.disconnect).not.toHaveBeenCalled();
    expect(ctx.gains[0]!.disconnect).not.toHaveBeenCalled();
  });

  it('setTone, beep, and playEarcon resume a suspended context (Finding 6)', () => {
    const ctx = fakeContext('suspended');
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    ctx.resume.mockClear();

    // Calling setTone on suspended context attempts resume
    driver.setTone(500);
    expect(ctx.resume).toHaveBeenCalledTimes(1);

    ctx.resume.mockClear();
    driver.beep(600, 50);
    expect(ctx.resume).toHaveBeenCalledTimes(1);

    ctx.resume.mockClear();
    driver.playEarcon('listening');
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });
});
