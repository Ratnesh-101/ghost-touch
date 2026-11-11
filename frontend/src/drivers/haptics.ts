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
  const on = pattern.reduce((sum, ms, i) => (i % 2 === 0 ? sum + Math.max(0, ms) : sum), 0);
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
