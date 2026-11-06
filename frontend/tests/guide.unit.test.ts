import { describe, it, expect } from 'vitest';
import {
  initialGuideState,
  guideStep,
  resolveTarget,
  vectorTo,
  pulseIntervalMs,
  hasArrived,
} from '../src/guide';
import type { DiagramScene } from '../src/types/scene.gen';
import indexSrc from '../src/guide/index.ts?raw';
import configSrc from '../src/guide/config.ts?raw';
import geometrySrc from '../src/guide/geometry.ts?raw';
import machineSrc from '../src/guide/machine.ts?raw';

describe('Guide Unit Tests', () => {
  const sampleScene: DiagramScene = {
    kind: 'geometry',
    points: [
      { id: 'p1', label: 'Vertex A', x: 0.1, y: 0.2 },
      { id: 'p2', label: 'Vertex B', x: 0.7, y: 0.8 },
      { id: 'p_bad', label: 'Out of bounds', x: 1.5, y: -0.2 },
    ],
    segments: [
      { id: 'seg1', a: 'p1', b: 'p2', label: 'Hypotenuse' },
      { id: 'seg_orphan', a: 'p1', b: 'p_missing' },
      { id: 'seg_bad_pt', a: 'p1', b: 'p_bad' },
    ],
    polylines: [
      {
        id: 'curve1',
        label: 'Sine Wave',
        points: [
          [0.1, 0.5],
          [0.2, 0.8],
          [0.3, 0.5],
          [0.4, 0.2],
          [0.5, 0.5],
        ],
      },
      {
        id: 'empty_curve',
        label: 'Empty',
        points: [],
      },
    ],
    bars: [
      {
        id: 'bar1',
        label: 'Sales 2026',
        value: 100,
        x0: 0.2,
        x1: 0.4,
        y_base: 0.9,
        y_top: 0.3,
      },
    ],
  };

  describe('resolveTarget', () => {
    it('resolves a point target', () => {
      const res = resolveTarget(sampleScene, { kind: 'element', elementId: 'p1' });
      expect(res).toEqual({
        x: 0.1,
        y: 0.2,
        label: 'Vertex A',
      });
    });

    it('resolves a segment to its midpoint', () => {
      const res = resolveTarget(sampleScene, { kind: 'element', elementId: 'seg1' });
      expect(res).not.toBeNull();
      expect(res?.x).toBeCloseTo(0.4);
      expect(res?.y).toBeCloseTo(0.5);
      expect(res?.label).toBe('Hypotenuse');
    });

    it('resolves a bar to its centre', () => {
      const res = resolveTarget(sampleScene, { kind: 'element', elementId: 'bar1' });
      expect(res).not.toBeNull();
      expect(res?.x).toBeCloseTo(0.3);
      expect(res?.y).toBeCloseTo(0.6);
      expect(res?.label).toBe('Sales 2026');
    });

    it('resolves a polyline to the nearest-to-centroid point', () => {
      // Curve points: [0.1, 0.5], [0.2, 0.8], [0.3, 0.5], [0.4, 0.2], [0.5, 0.5]
      // Centroid = (0.3, 0.5)
      // Nearest point on polyline to (0.3, 0.5) is [0.3, 0.5] itself
      const res = resolveTarget(sampleScene, { kind: 'element', elementId: 'curve1' });
      expect(res).toEqual({
        x: 0.3,
        y: 0.5,
        label: 'Sine Wave',
      });
    });

    it('resolves a concrete point target', () => {
      const res = resolveTarget(sampleScene, { kind: 'point', x: 0.45, y: 0.65 });
      expect(res).toEqual({
        x: 0.45,
        y: 0.65,
        label: '(0.45, 0.65)',
      });
    });

    it('returns null for unknown element ID', () => {
      const res = resolveTarget(sampleScene, { kind: 'element', elementId: 'non_existent' });
      expect(res).toBeNull();
    });

    it('returns null for out-of-range point target coordinates', () => {
      expect(resolveTarget(sampleScene, { kind: 'point', x: -0.1, y: 0.5 })).toBeNull();
      expect(resolveTarget(sampleScene, { kind: 'point', x: 1.1, y: 0.5 })).toBeNull();
      expect(resolveTarget(sampleScene, { kind: 'point', x: 0.5, y: NaN })).toBeNull();
    });

    it('returns null for elements with out-of-range coordinates or missing dependencies', () => {
      expect(resolveTarget(sampleScene, { kind: 'element', elementId: 'p_bad' })).toBeNull();
      expect(resolveTarget(sampleScene, { kind: 'element', elementId: 'seg_orphan' })).toBeNull();
      expect(resolveTarget(sampleScene, { kind: 'element', elementId: 'seg_bad_pt' })).toBeNull();
      expect(resolveTarget(sampleScene, { kind: 'element', elementId: 'empty_curve' })).toBeNull();
    });
  });

  describe('Scripted Trace Test', () => {
    it('finger walks toward target: pulse interval shrinks and arrives', () => {
      const target = resolveTarget(sampleScene, { kind: 'element', elementId: 'p2' });
      expect(target).not.toBeNull();
      if (!target) return;

      const s0 = initialGuideState();
      expect(s0.phase).toBe('idle');

      let { state, effects } = guideStep(s0, {
        type: 'start',
        target,
        now: 1000,
      });

      expect(state.phase).toBe('guiding');
      expect(effects).toContainEqual({
        type: 'speak',
        key: 'guide.start',
        label: target.label,
      });

      // Finger starts at (0.1, 0.1) and walks diagonally toward (0.7, 0.8) in steps
      const waypoints = [
        { x: 0.1, y: 0.1, now: 1100 },
        { x: 0.25, y: 0.275, now: 1800 },
        { x: 0.4, y: 0.45, now: 2400 },
        { x: 0.55, y: 0.625, now: 2800 },
        { x: 0.69, y: 0.79, now: 3100 }, // within arriveRadius 0.05
      ];

      const observedIntervals: number[] = [];

      for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        if (!wp) continue;

        const res = guideStep(state, {
          type: 'move',
          finger: { x: wp.x, y: wp.y },
          now: wp.now,
        });

        state = res.state;
        effects = res.effects;

        const { dist } = vectorTo({ x: wp.x, y: wp.y }, target);

        if (i < waypoints.length - 1) {
          // Walking towards target
          expect(state.phase).toBe('guiding');
          const interval = pulseIntervalMs(dist);
          observedIntervals.push(interval);

          // Tone present on each move
          const tone = effects.find((e) => e.type === 'tone');
          expect(tone).toBeDefined();

          // Monotone interval check: interval should shrink as dist shrinks
          const prev = observedIntervals[observedIntervals.length - 2];
          if (prev !== undefined) {
            expect(interval).toBeLessThanOrEqual(prev);
          }
        } else {
          // Final waypoint lands within arriveRadius => arrives!
          expect(hasArrived(dist)).toBe(true);
          expect(state.phase).toBe('arrived');

          expect(effects).toContainEqual({ type: 'toneOff' });
          expect(effects).toContainEqual({ type: 'arrive', label: target.label });
          expect(effects).toContainEqual({
            type: 'speak',
            key: 'guide.arrived',
            label: target.label,
          });
        }
      }

      // Verification that no effects are emitted after arrived
      const postArrive = guideStep(state, {
        type: 'move',
        finger: { x: 0.7, y: 0.8 },
        now: 4000,
      });
      expect(postArrive.effects).toEqual([]);
      expect(postArrive.state.phase).toBe('arrived');
    });
  });

  describe('Pure module constraints', () => {
    it('does not import React, window, navigator, document or drivers', () => {
      const allFiles = [indexSrc, configSrc, geometrySrc, machineSrc];

      for (const content of allFiles) {
        expect(content).not.toMatch(/from\s+['"]react['"]/);
        expect(content).not.toMatch(/from\s+['"].*drivers.*['"]/);
        expect(content).not.toMatch(/\bwindow\b/);
        expect(content).not.toMatch(/\bnavigator\b/);
        expect(content).not.toMatch(/\bdocument\b/);
      }
    });
  });
});
