import { describe, it, expect, vi, type Mock } from 'vitest';
import {
  WebAudioDriver,
  type AudioContextLike,
  type GainLike,
  type OscillatorLike,
  type ParamLike,
  type StereoPannerLike,
} from '../src/drivers/audio';
import {
  runGuideEffects,
  type DiagramStore,
  type Drivers,
  type HapticDriver,
  type SpeechDriver,
} from '../src/drivers';
import type { GuideEffect } from '../src/guide';

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

function createFakeContext(options: { hasStereoPanner?: boolean } = {}): FakeContext {
  const { hasStereoPanner = true } = options;
  const ctx: FakeContext = {
    currentTime: 1,
    state: 'running',
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
    ...(hasStereoPanner
      ? {
          createStereoPanner() {
            const panner = {
              pan: fakeParam(),
              connect: vi.fn(),
              disconnect: vi.fn(),
            };
            ctx.panners.push(panner);
            return panner;
          },
        }
      : {}),
  };
  return ctx;
}

describe('Guide Audio Tone & StereoPanner Fallback', () => {
  it('plays guide tone with StereoPanner when supported', () => {
    const ctx = createFakeContext({ hasStereoPanner: true });
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    // Theremin oscillator is created on unlock
    expect(ctx.oscillators).toHaveLength(1);

    // Guide tone creates guide oscillator, gain, and panner lazily
    driver.setGuideTone?.(550, -0.6);
    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.gains).toHaveLength(2);
    expect(ctx.panners).toHaveLength(1);

    const guideOsc = ctx.oscillators[1]!;
    const guideGain = ctx.gains[1]!;
    const guidePanner = ctx.panners[0]!;

    expect(guideOsc.type).toBe('sine');
    expect(guideOsc.frequency.setTargetAtTime).toHaveBeenCalledWith(550, 1, 0.02);
    expect(guideGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.15, 1, 0.02);
    expect(guidePanner.pan.setTargetAtTime).toHaveBeenCalledWith(-0.6, 1, 0.02);
  });

  it('safely falls back without throwing when StereoPanner is unsupported (phone mono)', () => {
    // hasStereoPanner = false: createStereoPanner is undefined on AudioContext
    const ctx = createFakeContext({ hasStereoPanner: false });
    expect(ctx.createStereoPanner).toBeUndefined();

    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();

    expect(() => driver.setGuideTone?.(400, 0.8)).not.toThrow();
    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.gains).toHaveLength(2);
    expect(ctx.panners).toHaveLength(0);

    const guideOsc = ctx.oscillators[1]!;
    const guideGain = ctx.gains[1]!;
    expect(guideOsc.frequency.setTargetAtTime).toHaveBeenCalledWith(400, 1, 0.02);
    expect(guideGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.15, 1, 0.02);
  });

  it('fades out guide tone when setGuideTone(null) is called', () => {
    const ctx = createFakeContext({ hasStereoPanner: true });
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();
    driver.setGuideTone?.(500, 0);

    ctx.currentTime = 2;
    driver.setGuideTone?.(null);
    expect(ctx.gains[1]?.gain.setTargetAtTime).toHaveBeenCalledWith(0, 2, 0.03);
  });

  it('SPOKEN HINT FALLBACK IS MANDATORY: hints are spoken via speech driver even when StereoPanner is unavailable', () => {
    // When StereoPanner is unavailable:
    const ctx = createFakeContext({ hasStereoPanner: false });
    const audioDriver = new WebAudioDriver(() => ctx);
    audioDriver.unlock();

    const spokenLines: string[] = [];
    const mockSpeech = {
      speak: vi.fn((text: string) => spokenLines.push(text)),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    };
    const mockHaptics = {
      supported: true,
      lastResult: true,
      vibrate: vi.fn(),
      stop: vi.fn(),
    };
    const drivers: Drivers = {
      audio: audioDriver,
      speech: mockSpeech as unknown as SpeechDriver,
      haptics: mockHaptics as unknown as HapticDriver,
      diagramStore: {} as unknown as DiagramStore,
    };

    const guideEffects: GuideEffect[] = [
      { type: 'tone', hz: 450, pan: -0.7 },
      { type: 'pulse', ms: 25 },
      { type: 'speak', key: 'guide.hint.left', hint: 'left' },
    ];

    expect(() => runGuideEffects(guideEffects, drivers, 'en-IN')).not.toThrow();

    // Spoken hint is delivered to speech driver
    expect(mockSpeech.speak).toHaveBeenCalledWith('Move left', 'en-IN');
    expect(spokenLines).toContain('Move left');
    // Haptic pulse is delivered
    expect(mockHaptics.vibrate).toHaveBeenCalledWith(25);
    // Guide tone is delivered (without crashing despite no panner)
    expect(ctx.oscillators[1]?.frequency.setTargetAtTime).toHaveBeenCalledWith(450, 1, 0.02);
  });

  it('ducks and restores guide tone when playEarcon runs', () => {
    const ctx = createFakeContext({ hasStereoPanner: true });
    const driver = new WebAudioDriver(() => ctx);
    driver.unlock();
    driver.setGuideTone?.(600, 0.5);

    // Active guide tone is ducked when earcon plays
    driver.playEarcon('success');
    expect(ctx.gains[1]?.gain.setTargetAtTime).toHaveBeenCalledWith(0, 1, 0.03);

    // And scheduled to be restored after earcon finishes
    expect(ctx.gains[1]?.gain.setTargetAtTime).toHaveBeenCalledWith(0.15, expect.any(Number), 0.02);
  });
});
