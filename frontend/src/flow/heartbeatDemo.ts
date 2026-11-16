// PROPOSED test values, not tuned, not used by Explore
/**
 * Heartbeat corner candidates for phone evaluation.
 * Pure data and pure helpers; no browser APIs.
 */

export interface HeartbeatCandidate {
  readonly id: string;
  readonly nameKey: string;
  readonly pattern: number[];
  readonly periodMs: number;
}

export const HEARTBEAT_CANDIDATES: readonly HeartbeatCandidate[] = [
  { id: 'H1', nameKey: 'debug.hbH1', pattern: [50, 90, 50], periodMs: 900 },
  { id: 'H2', nameKey: 'debug.hbH2', pattern: [40, 60, 40], periodMs: 800 },
  { id: 'H3', nameKey: 'debug.hbH3', pattern: [30, 70, 60], periodMs: 900 },
  { id: 'H4', nameKey: 'debug.hbH4', pattern: [60, 80, 40], periodMs: 1000 },
  { id: 'H5', nameKey: 'debug.hbH5', pattern: [40, 120, 80], periodMs: 1000 },
  { id: 'H6', nameKey: 'debug.hbH6', pattern: [70, 110, 70], periodMs: 1100 },
] as const;

export const DEMO_PERIODS_MS: readonly number[] = [700, 900, 1100] as const;

export const DEMO_REPEAT_MAX_MS = 10000;

/**
 * Returns the sum of entries in a vibration pattern.
 */
export function patternDurationMs(pattern: readonly number[]): number {
  return pattern.reduce((sum, entry) => sum + entry, 0);
}
