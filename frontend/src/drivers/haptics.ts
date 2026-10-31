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
    try {
      this.last = host.vibrate(pattern);
    } catch {
      // Some browsers throw if the page has no user activation yet. A failed
      // buzz must never break touch handling, so report it as "did not fire".
      this.last = false;
    }
    return this.last;
  }

  stop(): void {
    this.vibrate(0);
  }
}
