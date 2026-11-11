/**
 * K4 (Kiro): CORE-A5 in core/correct.ts.
 * A5: Requirement 9.10 (movePoint ignores non-finite input; clamp01(Infinity) === 1).
 */
import { describe, expect, it } from 'vitest';
import {
  clamp01,
  movePoint,
} from '../src/core/correct';
import type { DiagramScene } from '../src/core/scene';

const scene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  points: [
    { id: 'A', x: 0.2, y: 0.3, label: 'A' },
    { id: 'B', x: 0.8, y: 0.3, label: 'B' },
  ],
  segments: [{ id: 'AB', a: 'A', b: 'B' }],
};

describe('CORE-A5: movePoint with non-finite input', () => {
  const bad = [Number.NaN, Infinity, -Infinity];
  for (const v of bad) {
    it(`x = ${v} returns the same scene`, () => {
      expect(movePoint(scene, 'A', v, 0.5)).toBe(scene);
    });
    it(`y = ${v} returns the same scene`, () => {
      expect(movePoint(scene, 'A', 0.5, v)).toBe(scene);
    });
  }
  it('finite input still moves and clamps', () => {
    const next = movePoint(scene, 'A', 5, -5);
    expect(next.points?.[0]).toMatchObject({ x: 1, y: 0 });
  });
  it('clamp01 maps +Infinity to 1, -Infinity to 0, NaN to 0', () => {
    expect(clamp01(Infinity)).toBe(1);
    expect(clamp01(-Infinity)).toBe(0);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});
