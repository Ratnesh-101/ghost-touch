/**
 * Pure pitch mapping - converts normalized y-coordinate and bar values to
 * theremin frequencies.
 *
 * Per architecture rule 1 (tech.md): this module is pure (no DOM, React, or
 * browser API access). The AudioDriver consumes the resulting Hz values.
 */

/**
 * Maps normalized y coordinate (0 = top, 1 = bottom) to frequency in Hz.
 * Higher on screen = higher pitch: 0 -> 1000 Hz, 1 -> 200 Hz.
 * Values outside [0, 1] are clamped to the range.
 *
 * Requirement 5.1: graph curve tone, 200-1000 Hz, higher on screen = higher pitch.
 */
export function pitchForY(yNorm: number): number {
  return Math.min(1000, Math.max(200, 1000 - yNorm * 800));
}

/**
 * Maps a numeric value to frequency in Hz, linear from 200 to 1000.
 * Guards against non-positive or non-finite max.
 *
 * Requirement 5.2: bar pitch (used by P11 bar pitch order).
 */
export function pitchForValue(v: number, max: number): number {
  if (max <= 0 || !Number.isFinite(max)) return 200;
  if (!Number.isFinite(v) || v <= 0) return 200;
  return Math.min(1000, Math.max(200, 200 + (v / max) * 800));
}
