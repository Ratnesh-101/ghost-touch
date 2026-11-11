/**
 * HapticDriver — the only place `navigator.vibrate` is called.
 *
 * Kept behind an interface so a Capacitor driver can replace it later
 * (tech.md: "this swap touches one file"). The driver executes patterns it is
 * given; it decides nothing. Pattern values come from the haptic engine.
 */

export interface HapticDriver {
  /** True when the Vibration API exists (Chrome on Android). */
  readonly supported: boolean;
  /** Last value returned by `navigator.vibrate`, for the debug page. */
  readonly lastResult: boolean | null;
  /** Vibrate with a duration or a pattern. Returns false if it did not fire. */
  vibrate(pattern: number | number[]): boolean;
  /** Cancel any vibration in progress (`vibrate(0)`). */
  stop(): void;
}

/** The slice of `navigator` this driver needs; lets tests pass a fake. */
export interface VibrateHost {
  vibrate?: (pattern: number | number[]) => boolean;
}

function defaultHost(): VibrateHost | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator;
}

/** Minimum single-pulse length that reliably spins up a phone motor. */
export const MIN_FALLBACK_PULSE_MS = 100;

/**
 * Single pulse standing in for an array pattern: the sum of the "on" entries
 * (even indexes), never shorter than MIN_FALLBACK_PULSE_MS.
 */
export function fallbackPulse(pattern: readonly number[]): number {
  const on = pattern.reduce(
    (sum, ms, i) => (i % 2 === 0 ? sum + Math.max(0, ms) : sum),
    0,
  );
  return Math.max(on, MIN_FALLBACK_PULSE_MS);
}

export class WebHapticDriver implements HapticDriver {
  readonly supported: boolean;
  private last: boolean | null = null;

  constructor(private readonly host: VibrateHost | undefined = defaultHost()) {
    this.supported = host !== undefined && typeof host.vibrate === 'function';
  }

  get lastResult(): boolean | null {
    return this.last;
  }

  vibrate(pattern: number | number[]): boolean {
    const host = this.host;
    if (!this.supported || host === undefined || host.vibrate === undefined) {
      this.last = false;
      return false;
    }
    let ok = this.tryVibrate(host, pattern);
    if (!ok && Array.isArray(pattern)) {
      // Some Android builds (Samsung/OnePlus) reject or silently drop array
      // patterns. Fall back to one solid pulse so corners are still felt.
      ok = this.tryVibrate(host, fallbackPulse(pattern));
    }
    this.last = ok;
    return ok;
  }

  private tryVibrate(host: VibrateHost, pattern: number | number[]): boolean {
    try {
      return host.vibrate?.(pattern) === true;
    } catch {
      // Some browsers throw if the page has no user activation yet. A failed
      // buzz must never break touch handling, so report it as "did not fire".
      return false;
    }
  }

  stop(): void {
    this.vibrate(0);
  }
}

export type PulseKind = 'pulse' | 'corner';

export interface BuzzItem {
  atMs: number;
  durationMs: number;
}

export interface BuzzSink {
  buzz(durationMs: number): void;
}

/**
 * Pure helper converting a vibration duration or pattern to an array of timed buzzes.
 * Numbers give one buzz at offset 0. Arrays [on, off, on, ...] yield a buzz for each
 * ON entry (even indices) with offset equal to the running sum of all prior entries.
 * Zero and negative entries produce no buzz and do not advance offset backwards.
 */
export function patternToBuzzes(
  pattern: number | number[],
): { atMs: number; durationMs: number }[] {
  if (typeof pattern === 'number') {
    if (Number.isFinite(pattern) && pattern > 0) {
      return [{ atMs: 0, durationMs: pattern }];
    }
    return [];
  }
  if (!Array.isArray(pattern)) {
    return [];
  }
  const result: { atMs: number; durationMs: number }[] = [];
  let runningOffset = 0;
  for (let i = 0; i < pattern.length; i++) {
    const raw = pattern[i];
    const duration = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    if (duration > 0) {
      if (i % 2 === 0) {
        result.push({ atMs: runningOffset, durationMs: duration });
      }
      runningOffset += duration;
    }
  }
  return result;
}

/**
 * Fallback haptic driver for devices without navigator.vibrate (e.g. laptops, iOS).
 * Routes vibration requests to an audible buzz sound via BuzzSink and triggers an
 * optional onPulse visual callback.
 */
export class FallbackHapticDriver implements HapticDriver {
  readonly supported = false;
  private last: boolean | null = null;
  private timerIds: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private readonly sink: BuzzSink,
    public onPulse?: (kind: PulseKind) => void,
  ) {}

  get lastResult(): boolean | null {
    return this.last;
  }

  private clearTimers(): void {
    for (const id of this.timerIds) {
      clearTimeout(id);
    }
    this.timerIds = [];
  }

  vibrate(pattern: number | number[]): boolean {
    this.clearTimers();
    const buzzes = patternToBuzzes(pattern);
    if (buzzes.length === 0) {
      this.last = false;
      return false;
    }

    const kind: PulseKind =
      Array.isArray(pattern) && pattern.length > 1 ? 'corner' : 'pulse';

    try {
      for (const buzz of buzzes) {
        if (buzz.atMs === 0) {
          try {
            this.sink.buzz(buzz.durationMs);
          } catch {
            // Never throws
          }
          try {
            this.onPulse?.(kind);
          } catch {
            // Never throws
          }
        } else {
          const timerId = setTimeout(() => {
            try {
              this.sink.buzz(buzz.durationMs);
            } catch {
              // Never throws
            }
            try {
              this.onPulse?.(kind);
            } catch {
              // Never throws
            }
          }, buzz.atMs);
          this.timerIds.push(timerId);
        }
      }
      this.last = true;
      return true;
    } catch {
      this.last = false;
      return false;
    }
  }

  stop(): void {
    this.vibrate(0);
  }
}

