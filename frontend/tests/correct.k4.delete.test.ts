/**
 * K4 (Kiro): CORE-A7 — deletePoint / deleteSegment on an unknown id return the same scene,
 * so applyEdit pushes no no-op history entry (as deletePolyline and deleteBar already do).
 */
import { describe, expect, it } from 'vitest';
import { applyEdit, createHistory, deletePoint, deleteSegment } from '../src/core/correct';
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
describe('CORE-A7: deleting an unknown id changes nothing', () => {
  it('deletePoint returns the same scene', () => {
    expect(deletePoint(scene, 'nope')).toBe(scene);
  });
  it('deleteSegment returns the same scene', () => {
    expect(deleteSegment(scene, 'nope')).toBe(scene);
  });
  it('a scene without a segments array is not given one', () => {
    const bare: DiagramScene = { version: 1, kind: 'geometry', points: [] };
    expect(deleteSegment(bare, 'x')).toBe(bare);
  });
  it('an unknown delete leaves the history unchanged', () => {
    const h = createHistory(scene);
    expect(applyEdit(h, deletePoint(scene, 'nope'))).toBe(h);
    expect(applyEdit(h, deleteSegment(scene, 'nope'))).toBe(h);
  });
  it('known ids still delete', () => {
    expect(deletePoint(scene, 'A').points).toHaveLength(1);
    expect(deletePoint(scene, 'A').segments).toHaveLength(0);
    expect(deleteSegment(scene, 'AB').segments).toHaveLength(0);
  });
});
