/**
 * Requirement 23.4 (Kiro, task 39.2): the core has no point cap; the Ghostwriter caller caps.
 * This fails when its caps stop being the smaller of the share limit and the backend limit.
 */
import { describe, expect, it } from 'vitest';
import validatePy from '../../backend/app/validate.py?raw';
import { addPoint } from '../src/core/correct';
import type { DiagramScene } from '../src/core/scene';
import { GHOSTWRITER_POINT_CAP, GHOSTWRITER_SEGMENT_CAP } from '../src/flow/ghostwriter';
import { LIMITS } from '../src/share/limits';

/** Reads `NAME = <int>` from backend/app/validate.py, the backend's own constants. */
function backendConstant(name: string): number {
  const match = validatePy.match(new RegExp(`^${name}\\s*=\\s*([\\d_]+)\\s*$`, 'm'));
  if (!match) throw new Error(`${name} not found in backend/app/validate.py`);
  return Number(match[1]!.replace(/_/g, ''));
}

describe('23.4: the caps agree', () => {
  it('the Ghostwriter point cap is min(share limit, backend MAX_SCENE_POINTS)', () => {
    const backend = backendConstant('MAX_SCENE_POINTS');
    expect(backend).toBe(500);
    expect(GHOSTWRITER_POINT_CAP).toBe(Math.min(LIMITS.maxPoints, backend));
  });

  it('the Ghostwriter segment cap is min(share limit, backend MAX_SCENE_SEGMENTS)', () => {
    const backend = backendConstant('MAX_SCENE_SEGMENTS');
    expect(backend).toBe(1000);
    expect(GHOSTWRITER_SEGMENT_CAP).toBe(Math.min(LIMITS.maxSegments, backend));
  });

  it('the core itself does not cap: a scene at the cap still gets a point from addPoint', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: Array.from({ length: GHOSTWRITER_POINT_CAP }, (_, i) => ({ id: `q${i}`, x: (i % 20) / 20, y: Math.floor(i / 20) / 20 })),
    };
    expect(addPoint(scene, 0.99, 0.99).points).toHaveLength(GHOSTWRITER_POINT_CAP + 1);
  });
});
