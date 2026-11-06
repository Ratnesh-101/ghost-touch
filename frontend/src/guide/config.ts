/**
 * Pure guide configuration and defaults.
 *
 * Per architecture rules: own constants; do NOT touch core haptics.
 * No browser APIs, React, or drivers imported.
 */

export interface GuideConfig {
  /** Throttle interval (ms) for pulses when far from the target. */
  farMs: number;
  /** Throttle interval (ms) for pulses when near the target. */
  nearMs: number;
  /** Arrival radius in normalized scene units [0, 1]. */
  arriveRadius: number;
  /** Interval (ms) between repeating identical direction hints. */
  hintEveryMs: number;
  /** Maximum duration (ms) before guide times out automatically. */
  timeoutMs: number;
  /** Lowest guide tone frequency (Hz) when target is far below finger. */
  pitchLoHz: number;
  /** Highest guide tone frequency (Hz) when target is far above finger. */
  pitchHiHz: number;
}

export const DEFAULT_GUIDE: GuideConfig = {
  farMs: 600,
  nearMs: 120,
  arriveRadius: 0.05,
  hintEveryMs: 2500,
  timeoutMs: 20000,
  pitchLoHz: 200,
  pitchHiHz: 800,
};
