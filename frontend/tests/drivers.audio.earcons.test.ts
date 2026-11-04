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

function fakeParam(): ParamLike & { setTargetAtTime: Mock<ParamLike['setTargetAtTime']> } {
  return { value: 0, setTargetAtTime: vi.fn<ParamLike['setTargetAtTime']>() };
}

interface FakeContext extends AudioContextLike {
  oscillators: Array<OscillatorLike & { start: Mock<OscillatorLike['start']>; stop: Mock<OscillatorLike['stop']> }>;
  gains: Array<GainLike & { gain: ReturnType<typeof fakeParam> }>;
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
        start: vi.fn<OscillatorLike['start']>(),
        stop: vi.fn<OscillatorLike['stop']>(),
      };
      ctx.oscillators.push(osc);
      return osc;
    },
    createGain() {
      const gain = { gain: fakeParam(), connect: vi.fn() };
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
});
