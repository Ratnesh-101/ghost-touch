/**
 * CORE-A6 (Kiro, K4, Requirement 16.12 extended): a zero-size (or unmeasurable) viewport has
 * nowhere for the finger to be, so hitTest answers none instead of treating every finger as the
 * top-left corner of the diagram.
 */
import { describe, expect, it } from 'vitest';
import { makeViewport } from '../src/core/geometry';
import { hitTest } from '../src/core/hitTest';
import type { DiagramScene } from '../src/core/scene';

const scene: DiagramScene = {
  version: 1,
  kind: 'bar_chart',
  points: [{ id: 'O', x: 0, y: 0, label: 'O' }],
  segments: [],
  bars: [{ id: 'b1', x0: 0, x1: 0.3, y_top: 0, y_base: 1, label: 'Jan', value: 5 }],
};

describe('CORE-A6: zero-scale viewport', () => {
  it('makeViewport(0, 0) gives none, not the bar or the origin vertex', () => {
    expect(hitTest(scene, { x: 0, y: 0 }, makeViewport(0, 0))).toEqual({ kind: 'none' });
    expect(hitTest(scene, { x: 10, y: 10 }, makeViewport(0, 0))).toEqual({ kind: 'none' });
  });
  it('a zero width or height alone also gives none', () => {
    expect(hitTest(scene, { x: 0, y: 0 }, makeViewport(300, 0))).toEqual({ kind: 'none' });
    expect(hitTest(scene, { x: 0, y: 0 }, makeViewport(0, 300))).toEqual({ kind: 'none' });
  });
  it('a NaN scale gives none', () => {
    const v = { ...makeViewport(300, 300), scale: Number.NaN };
    expect(hitTest(scene, { x: 0, y: 0 }, v)).toEqual({ kind: 'none' });
  });
  it('a normal viewport still hits the origin vertex', () => {
    expect(hitTest(scene, { x: 0, y: 0 }, makeViewport(300, 300))).toMatchObject({ kind: 'vertex', id: 'O' });
  });
});
