import { describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { buildA11yFeatures, MAX_A11Y_FEATURES } from '../src/flow/a11yFeatures';

describe('CORE-A2: buildA11yFeatures share allocation per kind', () => {
  it('includes all kinds for a scene with 80 points, 1 segment, 1 polyline, and 1 axis', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: Array.from({ length: 80 }, (_, i) => ({
        id: `p${i}`,
        x: (i % 10) / 10,
        y: Math.floor(i / 10) / 10,
        label: `P${i}`,
      })),
      segments: [{ id: 's1', a: 'p0', b: 'p1', label: 'Side 1' }],
      polylines: [{ id: 'poly1', label: 'Curve 1', points: [[0.1, 0.1], [0.9, 0.9]] }],
      axes: { x_axis_y: 0.5 },
    };

    const features = buildA11yFeatures(scene);
    const kinds = new Set(features.map((f) => f.kind));

    // Every kind present must be reachable
    expect(kinds.has('point')).toBe(true);
    expect(kinds.has('segment')).toBe(true);
    expect(kinds.has('polyline')).toBe(true);
    expect(kinds.has('axis')).toBe(true);

    // Points share is capped so other kinds get their share
    const pointsCount = features.filter((f) => f.kind === 'point').length;
    expect(pointsCount).toBeLessThanOrEqual(30);

    // Total cap of 60 is respected
    expect(features.length).toBeLessThanOrEqual(MAX_A11Y_FEATURES);
  });

  it('allows points to use full cap of 60 when no other kinds are present', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: Array.from({ length: 80 }, (_, i) => ({
        id: `p${i}`,
        x: i / 100,
        y: i / 100,
        label: `P${i}`,
      })),
    };

    const features = buildA11yFeatures(scene);
    expect(features).toHaveLength(60);
    expect(features.every((f) => f.kind === 'point')).toBe(true);
  });

  it('fairly shares quota among multiple non-point categories without starvation', () => {
    const scene: DiagramScene = {
      kind: 'function_graph',
      points: Array.from({ length: 40 }, (_, i) => ({
        id: `p${i}`,
        x: (i % 5) / 5,
        y: Math.floor(i / 5) / 10,
        label: `P${i}`,
      })),
      segments: Array.from({ length: 30 }, (_, i) => ({
        id: `s${i}`,
        a: `p${i % 20}`,
        b: `p${(i + 1) % 20}`,
        label: `S${i}`,
      })),
      polylines: Array.from({ length: 30 }, (_, i) => ({
        id: `c${i}`,
        label: `Curve${i}`,
        points: [[0, 0], [0.5, 0.5], [1, 1]],
      })),
      axes: { x_axis_y: 0.5, y_axis_x: 0.5 },
    };

    const features = buildA11yFeatures(scene);
    expect(features.length).toBeLessThanOrEqual(MAX_A11Y_FEATURES);

    const points = features.filter((f) => f.kind === 'point');
    const segments = features.filter((f) => f.kind === 'segment');
    const polylines = features.filter((f) => f.kind === 'polyline');
    const axes = features.filter((f) => f.kind === 'axis');

    expect(points.length).toBeGreaterThan(0);
    expect(segments.length).toBeGreaterThan(0);
    expect(polylines.length).toBeGreaterThan(0);
    expect(axes.length).toBeGreaterThan(0);
  });
});

describe('CORE-A3: buildA11yFeatures skips non-finite bar values', () => {
  it('skips bars with NaN or Infinity and never puts NaN into label or target', () => {
    const scene: DiagramScene = {
      kind: 'bar_chart',
      bars: [
        {
          id: 'b_valid',
          label: 'ValidBar',
          value: 75,
          x0: 0.1,
          x1: 0.3,
          y_base: 0.9,
          y_top: 0.2,
        },
        {
          id: 'b_nan',
          label: 'NaNBar',
          value: NaN,
          x0: 0.4,
          x1: 0.6,
          y_base: 0.9,
          y_top: 0.2,
        },
        {
          id: 'b_inf',
          label: 'InfBar',
          value: Infinity,
          x0: 0.7,
          x1: 0.9,
          y_base: 0.9,
          y_top: 0.2,
        },
      ],
    };

    const features = buildA11yFeatures(scene);
    expect(features).toHaveLength(1);
    expect(features[0]?.key).toBe('bar-b_valid');

    // Neither label nor target must contain "NaN"
    for (const f of features) {
      expect(f.label).not.toContain('NaN');
      expect(JSON.stringify(f.target)).not.toContain('NaN');
      if (f.target.kind === 'bar') {
        expect(Number.isFinite(f.target.value)).toBe(true);
        expect(Number.isFinite(f.target.maxValue)).toBe(true);
        expect(f.target.maxValue).toBe(75);
      }
    }
  });
});
