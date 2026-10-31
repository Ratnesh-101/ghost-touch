/**
 * AudioDriver — the theremin tone and short cue beeps (Web Audio API).
 *
 * One sine oscillator is created on `unlock()` (which must run inside a user
 * gesture) and never recreated; `setTone` only moves its frequency and gain.
 * Ported from prototypes/haptics-test.html, whose values were tuned by hand.
 */

export interface AudioDriver {
  /** Create/resume the AudioContext and the single oscillator. Call from a user gesture. */
  unlock(): void;
  /** Play a continuous tone at `hz`, or fade out with `null`. No-op before `unlock`. */
  setTone(hz: number | null): void;
  /** Short one-shot cue (progress / listening tones). Never disturbs the main tone. */
  beep(hz: number, ms: number): void;
  /** 'unavailable' (no Web Audio), 'locked' (not unlocked yet), or the context state. */
  readonly state: string;
}

// --- minimal Web Audio surface (so tests can pass fakes) --------------------
export interface ParamLike {
  value: number;
  setTargetAtTime(target: number, startTime: number, timeConstant: number): void;
}
export interface OscillatorLike {
  type: string;
  frequency: ParamLike;
  connect(destination: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface GainLike {
  gain: ParamLike;
  connect(destination: unknown): unknown;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  resume(): Promise<void>;
}
export type AudioContextFactory = () => AudioContextLike | undefined;

// --- tuned values (prototype) ----------------------------------------------
/** Tone loudness while on. */
const TONE_GAIN = 0.15;
/** Smoothing time constants, seconds. */
const FREQ_TIME_CONSTANT = 0.02;
const GAIN_ON_TIME_CONSTANT = 0.02;
/**
 * Fade-out time constant. Gain decays as e^(-t/τ), so after 100 ms with
 * τ = 0.03 it is e^(-3.33) ≈ 0.036 of the tone level: about -29 dB, inaudible
 * in practice. That meets Requirement 5.3 (tone gone within 100 ms).
 */
const GAIN_OFF_TIME_CONSTANT = 0.03;
/** Cue beeps are quieter than the tone and fade smoothly to avoid clicks. */
const BEEP_GAIN = 0.08;
const BEEP_FADE_TIME_CONSTANT = 0.02;
const BEEP_STOP_PADDING_S = 0.2;

function defaultFactory(): AudioContextLike | undefined {
  if (typeof window === 'undefined') return undefined;
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  return Ctor === undefined ? undefined : new Ctor();
}

export class WebAudioDriver implements AudioDriver {
  private ctx: AudioContextLike | undefined;
  private osc: OscillatorLike | undefined;
  private gain: GainLike | undefined;
  private unavailable = false;

  constructor(private readonly factory: AudioContextFactory = defaultFactory) {}

  get state(): string {
    if (this.unavailable) return 'unavailable';
    return this.ctx === undefined ? 'locked' : this.ctx.state;
  }

  unlock(): void {
    if (this.ctx !== undefined) {
      this.resumeIfSuspended(this.ctx);
      return;
    }
    let ctx: AudioContextLike | undefined;
    try {
      ctx = this.factory();
    } catch {
      // Some browsers refuse to create a context (policy, too many contexts).
      // Audio is optional, so treat it as unavailable instead of breaking the tap.
      ctx = undefined;
    }
    if (ctx === undefined) {
      this.unavailable = true;
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    this.ctx = ctx;
    this.osc = osc;
    this.gain = gain;
    this.resumeIfSuspended(ctx);
  }

  setTone(hz: number | null): void {
    const { ctx, osc, gain } = this;
    if (ctx === undefined || osc === undefined || gain === undefined) return;
    const now = ctx.currentTime;
    if (hz !== null && Number.isFinite(hz)) {
      osc.frequency.setTargetAtTime(hz, now, FREQ_TIME_CONSTANT);
      gain.gain.setTargetAtTime(TONE_GAIN, now, GAIN_ON_TIME_CONSTANT);
    } else {
      gain.gain.setTargetAtTime(0, now, GAIN_OFF_TIME_CONSTANT);
    }
  }

  beep(hz: number, ms: number): void {
    const ctx = this.ctx;
    if (ctx === undefined || !Number.isFinite(hz) || !(ms > 0)) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const end = now + ms / 1000;
    osc.type = 'sine';
    osc.frequency.value = hz;
    gain.gain.value = BEEP_GAIN;
    gain.gain.setTargetAtTime(0, end, BEEP_FADE_TIME_CONSTANT);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(end + BEEP_STOP_PADDING_S);
  }

  private resumeIfSuspended(ctx: AudioContextLike): void {
    if (ctx.state !== 'suspended') return;
    ctx.resume().catch(() => {
      // Resume can be refused outside a user gesture; the next gesture's
      // unlock() tries again, so there is nothing more to do here.
    });
  }
}
