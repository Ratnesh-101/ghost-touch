/**
 * AudioDriver — the theremin tone and short cue beeps / earcons (Web Audio API).
 *
 * One sine oscillator is created on `unlock()` (which must run inside a user
 * gesture) and never recreated; `setTone` only moves its frequency and gain.
 * Ported from prototypes/haptics-test.html, whose values were tuned by hand.
 *
 * Earcons provide short WebAudio cues (start, success, error, listening, back)
 * that never overlap the theremin tone unexpectedly.
 */

export type EarconKind = 'start' | 'success' | 'error' | 'listening' | 'back';

export interface EarconToneStep {
  readonly hz: number;
  readonly durationMs: number;
  readonly delayMs: number;
  readonly gain?: number;
}

/** Pure definitions of earcon frequencies, durations and timings. */
export function getEarconSteps(kind: EarconKind): readonly EarconToneStep[] {
  switch (kind) {
    case 'start':
      // Ascending two-tone greeting: 440 Hz (A4) -> 660 Hz (E5)
      return [
        { hz: 440, durationMs: 120, delayMs: 0, gain: 0.08 },
        { hz: 660, durationMs: 160, delayMs: 130, gain: 0.09 },
      ];
    case 'success':
      // Bright major triad chime: 523 Hz (C5) -> 659 Hz (E5) -> 784 Hz (G5)
      return [
        { hz: 523, durationMs: 80, delayMs: 0, gain: 0.07 },
        { hz: 659, durationMs: 80, delayMs: 90, gain: 0.07 },
        { hz: 784, durationMs: 140, delayMs: 180, gain: 0.08 },
      ];
    case 'error':
      // Descending low alert: 320 Hz -> 220 Hz
      return [
        { hz: 320, durationMs: 140, delayMs: 0, gain: 0.09 },
        { hz: 220, durationMs: 180, delayMs: 150, gain: 0.09 },
      ];
    case 'listening':
      // Clean prompt tone: 660 Hz beep
      return [
        { hz: 660, durationMs: 150, delayMs: 0, gain: 0.08 },
      ];
    case 'back':
      // Gentle descending two-step: 660 Hz -> 440 Hz
      return [
        { hz: 660, durationMs: 100, delayMs: 0, gain: 0.07 },
        { hz: 440, durationMs: 140, delayMs: 110, gain: 0.07 },
      ];
  }
}

export interface AudioDriver {
  /** Create/resume the AudioContext and the single oscillator. Call from a user gesture. */
  unlock(): void;
  /** Play a continuous tone at `hz`, or fade out with `null`. No-op before `unlock`. */
  setTone(hz: number | null): void;
  /** Play a continuous guide tone at `hz` with stereo pan [-1, 1], or fade out with `null`. */
  setGuideTone?(hz: number | null, pan?: number): void;
  /** Short one-shot cue (progress / listening tones). Never disturbs the main tone. */
  beep(hz: number, ms: number): void;
  /** Play an earcon cue. Temporarily ducks the theremin tone so they never overlap. */
  playEarcon(kind: EarconKind): void;
  /** 'unavailable' (no Web Audio), 'locked' (not unlocked yet), or the context state. */
  readonly state: string;
}

// --- minimal Web Audio surface (so tests can pass fakes) --------------------
export interface ParamLike {
  value: number;
  setTargetAtTime(target: number, startTime: number, timeConstant: number): void;
  cancelScheduledValues?(startTime: number): void;
}
export interface OscillatorLike {
  type: string;
  frequency: ParamLike;
  connect(destination: unknown): unknown;
  disconnect?(destination?: unknown): void;
  start(when?: number): void;
  stop(when?: number): void;
  onended?: ((ev: Event) => unknown) | null;
}
export interface GainLike {
  gain: ParamLike;
  connect(destination: unknown): unknown;
  disconnect?(destination?: unknown): void;
}
export interface StereoPannerLike {
  pan: ParamLike;
  connect(destination: unknown): unknown;
  disconnect?(destination?: unknown): void;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createStereoPanner?(): StereoPannerLike;
  resume(): Promise<void>;
}
export type AudioContextFactory = () => AudioContextLike | undefined;

export interface AudioHost {
  window?: {
    addEventListener(type: string, listener: (ev: unknown) => void): void;
    removeEventListener(type: string, listener: (ev: unknown) => void): void;
  };
  document?: {
    addEventListener(type: string, listener: (ev: unknown) => void): void;
    removeEventListener(type: string, listener: (ev: unknown) => void): void;
    readonly hidden?: boolean;
    readonly visibilityState?: string;
  };
}

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
  private guideOsc: OscillatorLike | undefined;
  private guideGain: GainLike | undefined;
  private guidePanner: StereoPannerLike | undefined;
  private unavailable = false;
  private activeToneHz: number | null = null;
  private activeGuideHz: number | null = null;
  private activeGuidePan = 0;
  private earconRestoreAt: number | null = null;
  private listenersAttached = false;

  constructor(
    private readonly factory: AudioContextFactory = defaultFactory,
    private readonly host?: AudioHost,
  ) {}

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
    this.attachLifecycleListeners();
  }

  setTone(hz: number | null): void {
    this.activeToneHz = hz !== null && Number.isFinite(hz) ? hz : null;
    const { ctx, osc, gain } = this;
    if (ctx === undefined || osc === undefined || gain === undefined) return;
    if (ctx.state === 'suspended') {
      this.resumeIfSuspended(ctx);
    }
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues?.(now);
    osc.frequency.cancelScheduledValues?.(now);

    if (this.activeToneHz !== null) {
      if (this.earconRestoreAt !== null && now < this.earconRestoreAt) {
        // Earcon is currently playing: remain ducked until earcon finishes, then restore at earconRestoreAt
        gain.gain.setTargetAtTime(0, now, GAIN_OFF_TIME_CONSTANT);
        osc.frequency.setTargetAtTime(this.activeToneHz, this.earconRestoreAt, FREQ_TIME_CONSTANT);
        gain.gain.setTargetAtTime(TONE_GAIN, this.earconRestoreAt, GAIN_ON_TIME_CONSTANT);
      } else {
        this.earconRestoreAt = null;
        osc.frequency.setTargetAtTime(this.activeToneHz, now, FREQ_TIME_CONSTANT);
        gain.gain.setTargetAtTime(TONE_GAIN, now, GAIN_ON_TIME_CONSTANT);
      }
    } else {
      this.earconRestoreAt = null;
      gain.gain.setTargetAtTime(0, now, GAIN_OFF_TIME_CONSTANT);
    }
  }

  private ensureGuideOsc(): void {
    if (this.guideOsc !== undefined || this.ctx === undefined) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    gain.gain.value = 0;

    let panner: StereoPannerLike | undefined;
    if (typeof ctx.createStereoPanner === 'function') {
      try {
        panner = ctx.createStereoPanner();
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } catch {
        osc.connect(gain);
        gain.connect(ctx.destination);
        panner = undefined;
      }
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }
    osc.start();
    this.guideOsc = osc;
    this.guideGain = gain;
    this.guidePanner = panner;
  }

  setGuideTone(hz: number | null, pan = 0): void {
    this.activeGuideHz = hz !== null && Number.isFinite(hz) ? hz : null;
    this.activeGuidePan = Number.isFinite(pan) ? Math.max(-1, Math.min(1, pan)) : 0;
    if (this.activeGuideHz === null && this.guideOsc === undefined) {
      return;
    }
    if (this.ctx === undefined) return;
    if (this.ctx.state === 'suspended') {
      this.resumeIfSuspended(this.ctx);
    }
    this.ensureGuideOsc();
    const { ctx, guideOsc, guideGain, guidePanner } = this;
    if (ctx === undefined || guideOsc === undefined || guideGain === undefined) return;

    const now = ctx.currentTime;
    guideGain.gain.cancelScheduledValues?.(now);
    guideOsc.frequency.cancelScheduledValues?.(now);
    if (guidePanner?.pan?.cancelScheduledValues) {
      guidePanner.pan.cancelScheduledValues(now);
    }

    if (this.activeGuideHz !== null) {
      if (this.earconRestoreAt !== null && now < this.earconRestoreAt) {
        guideGain.gain.setTargetAtTime(0, now, GAIN_OFF_TIME_CONSTANT);
        guideOsc.frequency.setTargetAtTime(this.activeGuideHz, this.earconRestoreAt, FREQ_TIME_CONSTANT);
        guideGain.gain.setTargetAtTime(TONE_GAIN, this.earconRestoreAt, GAIN_ON_TIME_CONSTANT);
        if (guidePanner) {
          guidePanner.pan.setTargetAtTime(this.activeGuidePan, this.earconRestoreAt, FREQ_TIME_CONSTANT);
        }
      } else {
        guideOsc.frequency.setTargetAtTime(this.activeGuideHz, now, FREQ_TIME_CONSTANT);
        guideGain.gain.setTargetAtTime(TONE_GAIN, now, GAIN_ON_TIME_CONSTANT);
        if (guidePanner) {
          guidePanner.pan.setTargetAtTime(this.activeGuidePan, now, FREQ_TIME_CONSTANT);
        }
      }
    } else {
      guideGain.gain.setTargetAtTime(0, now, GAIN_OFF_TIME_CONSTANT);
    }
  }

  beep(hz: number, ms: number): void {
    const ctx = this.ctx;
    if (ctx === undefined || !Number.isFinite(hz) || !(ms > 0)) return;
    if (ctx.state === 'suspended') {
      this.resumeIfSuspended(ctx);
    }
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
    osc.onended = () => {
      try {
        osc.disconnect?.();
      } catch {
        // Ignore errors if already disconnected
      }
      try {
        gain.disconnect?.();
      } catch {
        // Ignore errors if already disconnected
      }
    };
    osc.start(now);
    osc.stop(end + BEEP_STOP_PADDING_S);
  }

  playEarcon(kind: EarconKind): void {
    const ctx = this.ctx;
    if (ctx === undefined) return;
    if (ctx.state === 'suspended') {
      this.resumeIfSuspended(ctx);
    }
    const steps = getEarconSteps(kind);
    if (steps.length === 0) return;

    const now = ctx.currentTime;
    let maxEnd = now;

    // Duck the continuous theremin and guide tones while an earcon plays so they never clash
    if (this.gain !== undefined) {
      this.gain.gain.cancelScheduledValues?.(now);
      if (this.activeToneHz !== null) {
        this.gain.gain.setTargetAtTime(0, now, GAIN_OFF_TIME_CONSTANT);
      }
    }
    if (this.guideGain !== undefined) {
      this.guideGain.gain.cancelScheduledValues?.(now);
      if (this.activeGuideHz !== null) {
        this.guideGain.gain.setTargetAtTime(0, now, GAIN_OFF_TIME_CONSTANT);
      }
    }
    if (this.osc !== undefined) {
      this.osc.frequency.cancelScheduledValues?.(now);
    }
    if (this.guideOsc !== undefined) {
      this.guideOsc.frequency.cancelScheduledValues?.(now);
    }

    for (const step of steps) {
      if (!Number.isFinite(step.hz) || !(step.durationMs > 0)) continue;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startAt = now + step.delayMs / 1000;
      const endAt = startAt + step.durationMs / 1000;
      if (endAt > maxEnd) maxEnd = endAt;

      osc.type = 'sine';
      osc.frequency.value = step.hz;
      gain.gain.value = step.gain ?? BEEP_GAIN;
      gain.gain.setTargetAtTime(0, endAt, BEEP_FADE_TIME_CONSTANT);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.onended = () => {
        try {
          osc.disconnect?.();
        } catch {
          // Ignore
        }
        try {
          gain.disconnect?.();
        } catch {
          // Ignore
        }
      };
      osc.start(startAt);
      osc.stop(endAt + BEEP_STOP_PADDING_S);
    }

    // Restore theremin tone after earcon completes if tone is still active
    const hasTheremin = this.activeToneHz !== null && this.gain !== undefined && this.osc !== undefined;
    const hasGuide = this.activeGuideHz !== null && this.guideGain !== undefined && this.guideOsc !== undefined;

    if (hasTheremin || hasGuide) {
      const restoreAt = maxEnd + 0.05;
      this.earconRestoreAt = restoreAt;
      if (hasTheremin && this.gain !== undefined && this.osc !== undefined && this.activeToneHz !== null) {
        this.osc.frequency.setTargetAtTime(this.activeToneHz, restoreAt, FREQ_TIME_CONSTANT);
        this.gain.gain.setTargetAtTime(TONE_GAIN, restoreAt, GAIN_ON_TIME_CONSTANT);
      }
      if (hasGuide && this.guideGain !== undefined && this.guideOsc !== undefined && this.activeGuideHz !== null) {
        this.guideOsc.frequency.setTargetAtTime(this.activeGuideHz, restoreAt, FREQ_TIME_CONSTANT);
        this.guideGain.gain.setTargetAtTime(TONE_GAIN, restoreAt, GAIN_ON_TIME_CONSTANT);
        if (this.guidePanner) {
          this.guidePanner.pan.setTargetAtTime(this.activeGuidePan, restoreAt, FREQ_TIME_CONSTANT);
        }
      }
    } else {
      this.earconRestoreAt = null;
    }
  }

  private resumeIfSuspended(ctx: AudioContextLike): void {
    if (ctx.state !== 'suspended') return;
    ctx.resume().catch(() => {
      // Resume can be refused outside a user gesture; the next gesture's
      // unlock() tries again, so there is nothing more to do here.
    });
  }

  private attachLifecycleListeners(): void {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    const win = this.host?.window ?? (typeof window !== 'undefined' ? window : undefined);
    const doc = this.host?.document ?? (typeof document !== 'undefined' ? document : undefined);

    const onVisible = (): void => {
      if (doc && (doc.visibilityState === 'visible' || doc.hidden === false)) {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.resumeIfSuspended(this.ctx);
        }
      } else if (doc && (doc.visibilityState === 'hidden' || doc.hidden === true)) {
        this.setTone(null);
        this.setGuideTone?.(null);
      }
    };

    const onGesture = (): void => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.resumeIfSuspended(this.ctx);
      }
    };

    doc?.addEventListener('visibilitychange', onVisible);
    win?.addEventListener('pointerdown', onGesture);
    win?.addEventListener('touchstart', onGesture);
    win?.addEventListener('keydown', onGesture);
  }
}
