/**
 * Unit tests for W3 Buzz Fallback (Audible buzz + visible pulse when vibration missing)
 *
 * Verifies:
 * - patternToBuzzes pure timing calculations
 * - FallbackHapticDriver behavior, fake timer cancellation via vibrate(0) and stop()
 * - createBrowserDrivers factory wiring (untouched WebHapticDriver vs FallbackHapticDriver)
 * - WebAudioDriver buzz voice (about 90 Hz, gain <= 0.12, 8 ms fade, no disturbance to theremin)
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createBrowserDrivers } from '../src/drivers';
import {
  WebAudioDriver,
  type AudioContextLike,
  type GainLike,
  type OscillatorLike,
  type ParamLike,
} from '../src/drivers/audio';
import {
  FallbackHapticDriver,
  patternToBuzzes,
  WebHapticDriver,
  type PulseKind,
} from '../src/drivers/haptics';

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

describe('patternToBuzzes (pure timing helper)', () => {
  it('converts [50, 90, 50] to two buzzes at 0 and 140 ms with duration 50 ms', () => {
    const buzzes = patternToBuzzes([50, 90, 50]);
    expect(buzzes).toEqual([
      { atMs: 0, durationMs: 50 },
      { atMs: 140, durationMs: 50 },
    ]);
  });

  it('converts a single number to exactly one buzz at offset 0', () => {
    expect(patternToBuzzes(80)).toEqual([{ atMs: 0, durationMs: 80 }]);
    expect(patternToBuzzes(25)).toEqual([{ atMs: 0, durationMs: 25 }]);
  });

  it('returns empty array for zero or negative numbers', () => {
    expect(patternToBuzzes(0)).toEqual([]);
    expect(patternToBuzzes(-10)).toEqual([]);
    expect(patternToBuzzes(NaN)).toEqual([]);
  });

  it('skips zero and negative entries in an array without retreating offset', () => {
    // Index 0: 0 (ON -> zero, skipped, offset stays 0)
    // Index 1: 50 (OFF -> offset becomes 50)
    // Index 2: 50 (ON -> buzz at 50, duration 50, offset becomes 100)
    const buzzes = patternToBuzzes([0, 50, 50]);
    expect(buzzes).toEqual([{ atMs: 50, durationMs: 50 }]);
  });

  it('ensures total buzz offsets never exceed the pattern length', () => {
    const pattern = [50, 90, 50];
    const totalPatternLength = 50 + 90 + 50;
    const buzzes = patternToBuzzes(pattern);
    for (const b of buzzes) {
      expect(b.atMs + b.durationMs).toBeLessThanOrEqual(totalPatternLength);
    }
  });

  it('returns empty array for empty or non-numeric inputs', () => {
    expect(patternToBuzzes([])).toEqual([]);
    expect(patternToBuzzes(null as unknown as number)).toEqual([]);
  });
});

describe('FallbackHapticDriver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports supported = false and initial lastResult = null', () => {
    const sink = { buzz: vi.fn() };
    const driver = new FallbackHapticDriver(sink);
    expect(driver.supported).toBe(false);
    expect(driver.lastResult).toBeNull();
  });

  it('plays single duration buzz immediately and tracks lastResult = true', () => {
    const sink = { buzz: vi.fn() };
    const onPulse = vi.fn();
    const driver = new FallbackHapticDriver(sink, onPulse);

    const res = driver.vibrate(80);
    expect(res).toBe(true);
    expect(driver.lastResult).toBe(true);
    expect(sink.buzz).toHaveBeenCalledTimes(1);
    expect(sink.buzz).toHaveBeenCalledWith(80);
    expect(onPulse).toHaveBeenCalledWith('pulse');
  });

  it('schedules multi-buzz pattern and calls onPulse with corner', () => {
    const sink = { buzz: vi.fn() };
    const pulses: PulseKind[] = [];
    const driver = new FallbackHapticDriver(sink, (k) => pulses.push(k));

    driver.vibrate([50, 90, 50]);
    expect(sink.buzz).toHaveBeenCalledTimes(1);
    expect(sink.buzz).toHaveBeenLastCalledWith(50);
    expect(pulses).toEqual(['corner']);

    // Advance 139 ms: second buzz has not fired yet
    vi.advanceTimersByTime(139);
    expect(sink.buzz).toHaveBeenCalledTimes(1);

    // Advance 1 ms (140 ms total): second buzz fires
    vi.advanceTimersByTime(1);
    expect(sink.buzz).toHaveBeenCalledTimes(2);
    expect(sink.buzz).toHaveBeenLastCalledWith(50);
    expect(pulses).toEqual(['corner', 'corner']);
  });

  it('vibrate(0) cancels pending buzzes and sets lastResult = false', () => {
    const sink = { buzz: vi.fn() };
    const driver = new FallbackHapticDriver(sink);

    driver.vibrate([50, 90, 50]);
    expect(sink.buzz).toHaveBeenCalledTimes(1);

    // Cancel before 140 ms
    const res = driver.vibrate(0);
    expect(res).toBe(false);
    expect(driver.lastResult).toBe(false);

    vi.advanceTimersByTime(300);
    expect(sink.buzz).toHaveBeenCalledTimes(1);
  });

  it('stop() cancels pending buzzes and sets lastResult = false', () => {
    const sink = { buzz: vi.fn() };
    const driver = new FallbackHapticDriver(sink);

    driver.vibrate([50, 90, 50]);
    expect(sink.buzz).toHaveBeenCalledTimes(1);

    driver.stop();
    expect(driver.lastResult).toBe(false);

    vi.advanceTimersByTime(300);
    expect(sink.buzz).toHaveBeenCalledTimes(1);
  });

  it('never throws even if sink.buzz or onPulse throws', () => {
    const sink = {
      buzz: vi.fn(() => {
        throw new Error('Audio sink failed');
      }),
    };
    const onPulse = vi.fn(() => {
      throw new Error('Pulse callback failed');
    });
    const driver = new FallbackHapticDriver(sink, onPulse);

    expect(() => driver.vibrate(80)).not.toThrow();
    expect(() => driver.vibrate([50, 90, 50])).not.toThrow();
    expect(() => driver.stop()).not.toThrow();
  });
});

describe('createBrowserDrivers factory wiring', () => {
  it('returns untouched WebHapticDriver when Vibration API is supported', () => {
    const fakeVibrateHost = { vibrate: vi.fn(() => true) };
    const drivers = createBrowserDrivers(undefined, fakeVibrateHost);

    expect(drivers.haptics.supported).toBe(true);
    expect(drivers.haptics).toBeInstanceOf(WebHapticDriver);
    expect(drivers.haptics).not.toBeInstanceOf(FallbackHapticDriver);
  });

  it('returns FallbackHapticDriver wired to audio.buzz when vibration is unsupported', () => {
    const fakeVibrateHost = { vibrate: undefined };
    const drivers = createBrowserDrivers(undefined, fakeVibrateHost);

    expect(drivers.haptics.supported).toBe(false);
    expect(drivers.haptics).toBeInstanceOf(FallbackHapticDriver);
  });
});

describe('WebAudioDriver.buzz', () => {
  it('is a safe no-op before unlock() and does not create oscillators', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);

    driver.buzz(50);
    expect(ctx.oscillators).toHaveLength(0);
  });

  it('creates a separate 90 Hz sawtooth voice with gain <= 0.12 and 8 ms fade', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    // unlock creates the theremin oscillator at index 0
    expect(ctx.oscillators).toHaveLength(1);
    expect(ctx.oscillators[0]?.type).toBe('sine');

    driver.buzz(80);

    // buzz creates a separate oscillator at index 1
    expect(ctx.oscillators).toHaveLength(2);
    const buzzOsc = ctx.oscillators[1];
    expect(buzzOsc?.type).toBe('sawtooth');
    expect(buzzOsc?.frequency.value).toBe(90);

    const buzzGain = ctx.gains[1];
    expect(buzzGain?.gain.setTargetAtTime).toHaveBeenCalledWith(0.12, 1, 0.008);
  });

  it('never touches or disturbs the theremin oscillator or setTone', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    driver.setTone(440);
    const thereminOsc = ctx.oscillators[0];
    const thereminGain = ctx.gains[0];

    // Play buzz
    driver.buzz(50);

    // Theremin oscillator frequency and gain are separate from buzz oscillator
    expect(thereminOsc?.type).toBe('sine');
    expect(thereminGain?.gain.value).toBe(0);
  });

  it('ignores zero or negative duration calls', () => {
    const ctx = fakeContext();
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    expect(ctx.oscillators).toHaveLength(1);
    driver.buzz(0);
    driver.buzz(-50);
    driver.buzz(NaN);
    expect(ctx.oscillators).toHaveLength(1);
  });
});
