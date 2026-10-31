// TEMP-STUB: replaced by core/pitch.ts (Task 4, Kiro). Do not extend.

/**
 * Maps normalized y coordinate (0 = top, 1 = bottom) to frequency in Hz.
 * Higher on screen = higher pitch (1000 Hz at top, 200 Hz at bottom).
 */
export function pitchForY(yNorm: number): number {
  return Math.min(1000, Math.max(200, 1000 - yNorm * 800));
}

/**
 * Maps a numeric value to frequency in Hz, linear from 200 to 1000.
 * Guards against non-positive max.
 */
export function pitchForValue(v: number, max: number): number {
  if (max <= 0) return 200;
  return Math.min(1000, Math.max(200, 200 + (v / max) * 800));
}
