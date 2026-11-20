// @vitest-environment jsdom
/**
 * Test suite for Requirement 49 ("show me" highlight of the touched element).
 *
 * Covers:
 * - data-highlight attribute on the canvas element (none, vertex:<id>, segment:<id>, polyline:<id>, bar:<id>, axis:<id>)
 * - Initial state (none)
 * - Transitions between vertices, segments, and empty space
 * - Clearing on lift, window blur, visibilitychange (page hidden)
 * - Promotion of secondary pointer following its target
 * - Drawing function renderHighlightElement unit tests for all element types
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import triangleJson from '../public/samples/triangle.json';
import barchartJson from '../public/samples/barchart.json';
import sineJson from '../public/samples/sine.json';
import type { DiagramScene } from '../src/core/scene';
import { makeViewport, type Viewport } from '../src/core/geometry';
import { renderHighlightElement } from '../src/screens/Explore';
import { setupRigEnv, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;
const barchart = barchartJson as unknown as DiagramScene;
const sine = sineJson as unknown as DiagramScene;

function canvasOf(rig: Rig): HTMLCanvasElement {
  const c = rig.container.querySelector('canvas');
  if (!c) throw new Error('no canvas');
  return c;
}

const highlightAttr = (rig: Rig): string | null => canvasOf(rig).getAttribute('data-highlight');

describe('Requirement 49: "Show me" highlight (Lane hi3)', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  it('initial canvas carries data-highlight="none" before any touch', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  it('marks vertex A, B, and C when touched directly', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      // Corner A: (100, 100)
      rig.down(100, 100);
      expect(highlightAttr(rig)).toBe('vertex:A');
      rig.up(100, 100);
      expect(highlightAttr(rig)).toBe('none');

      // Corner B: (280, 340)
      rig.down(280, 340);
      expect(highlightAttr(rig)).toBe('vertex:B');
      rig.up(280, 340);
      expect(highlightAttr(rig)).toBe('none');

      // Corner C: (100, 340)
      rig.down(100, 340);
      expect(highlightAttr(rig)).toBe('vertex:C');
      rig.up(100, 340);
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  it('marks segments when dragging along edges of the triangle', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.down(100, 100); // Corner A
      expect(highlightAttr(rig)).toBe('vertex:A');
      rig.advance(600);

      // Move along AB to midpoint (190, 220)
      rig.move(190, 220);
      expect(highlightAttr(rig)).toBe('segment:AB');

      // Move along BC to midpoint (190, 340)
      rig.move(190, 340);
      expect(highlightAttr(rig)).toBe('segment:BC');

      // Move along CA to midpoint (100, 220)
      rig.move(100, 220);
      expect(highlightAttr(rig)).toBe('segment:CA');

      // Move to empty space
      rig.move(350, 50);
      expect(highlightAttr(rig)).toBe('none');

      // Lift finger
      rig.up(350, 50);
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  it('clears highlight on window blur event', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.down(100, 100);
      expect(highlightAttr(rig)).toBe('vertex:A');

      window.dispatchEvent(new Event('blur'));
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  it('clears highlight when document visibility changes to hidden', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.down(100, 100);
      expect(highlightAttr(rig)).toBe('vertex:A');

      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(highlightAttr(rig)).toBe('none');

      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    });
  });

  it('promotes secondary pointer to primary and follows its target', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      // Pointer 1 down at corner A (100, 100) with id 1
      rig.down(100, 100, 1);
      expect(highlightAttr(rig)).toBe('vertex:A');

      // Pointer 2 down at corner B (280, 340) with id 2
      rig.down(280, 340, 2);
      // Pointer 1 is still primary
      expect(highlightAttr(rig)).toBe('vertex:A');

      // Pointer 1 lifts: Pointer 2 is promoted to primary
      rig.up(100, 100, 1);
      expect(highlightAttr(rig)).toBe('vertex:B');

      // Pointer 2 lifts: all fingers lifted, clears to none
      rig.up(280, 340, 2);
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  it('highlights bars and axes in bar chart scene', async () => {
    await withExplore({ scene: barchart }, (rig) => {
      // Bar Q1 is at x: 0.12..0.27 (48..108 px), y: 0.69..0.85 (276..340 px)
      rig.down(78, 308);
      expect(highlightAttr(rig)).toBe('bar:q1');

      // Move to Bar Q2: x: 0.32..0.47 (128..188 px), y: 0.44..0.85 (176..340 px)
      rig.advance(300);
      rig.move(158, 258);
      expect(highlightAttr(rig)).toBe('bar:q2');

      // Move to x-axis: y = 0.85 * 400 = 340 px, at x = 20 px (outside bars)
      rig.move(20, 340);
      expect(highlightAttr(rig)).toBe('axis:x-axis');

      // Move to y-axis: x = 0.1 * 400 = 40 px, at y = 100 px (outside bars)
      rig.move(40, 100);
      expect(highlightAttr(rig)).toBe('axis:y-axis');

      rig.up(40, 100);
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  it('highlights polyline in function graph scene', async () => {
    await withExplore({ scene: sine }, (rig) => {
      // Polyline sine_curve: first point at (0.1, 0.5) -> (40, 200)
      rig.down(40, 200);
      expect(highlightAttr(rig)).toBe('polyline:sine_curve');

      rig.up(40, 200);
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  describe('renderHighlightElement unit tests', () => {
    const view: Viewport = makeViewport(400, 400);

    function createMockCtx(): {
      ctx: CanvasRenderingContext2D;
      calls: Array<{
        method: string;
        args: unknown[];
        strokeStyle?: string;
        fillStyle?: string;
        lineWidth?: number;
        shadowBlur?: number;
        shadowColor?: string;
      }>;
    } {
      const calls: Array<{
        method: string;
        args: unknown[];
        strokeStyle?: string;
        fillStyle?: string;
        lineWidth?: number;
        shadowBlur?: number;
        shadowColor?: string;
      }> = [];
      const record = (method: string, args: unknown[] = []): void => {
        calls.push({
          method,
          args,
          strokeStyle: String(ctx.strokeStyle),
          fillStyle: String(ctx.fillStyle),
          lineWidth: ctx.lineWidth,
          shadowBlur: ctx.shadowBlur,
          shadowColor: ctx.shadowColor,
        });
      };
      // Note: save and restore are intentionally omitted to verify mock compatibility with explore.outlines / explore.bu9
      const ctx = {
        beginPath: vi.fn(() => record('beginPath')),
        moveTo: vi.fn((...args: unknown[]) => record('moveTo', args)),
        lineTo: vi.fn((...args: unknown[]) => record('lineTo', args)),
        stroke: vi.fn(() => record('stroke')),
        arc: vi.fn((...args: unknown[]) => record('arc', args)),
        fill: vi.fn(() => record('fill')),
        fillText: vi.fn((...args: unknown[]) => record('fillText', args)),
        strokeRect: vi.fn((...args: unknown[]) => record('strokeRect', args)),
        strokeStyle: '#000000',
        fillStyle: '#000000',
        lineWidth: 1,
        shadowColor: '#000000',
        shadowBlur: 0,
        font: '10px sans-serif',
      } as unknown as CanvasRenderingContext2D;
      return { ctx, calls };
    }

    it('renders vertex with enlarged dot and dark outline ring', () => {
      const { ctx, calls } = createMockCtx();
      renderHighlightElement(ctx, view, triangle, { kind: 'vertex', id: 'A' });

      // Should draw dark outline ring and bright fill arc with radius 10
      const arcCalls = calls.filter((c) => c.method === 'arc');
      expect(arcCalls.length).toBeGreaterThanOrEqual(2);
      expect(arcCalls[0]?.args[2]).toBe(10); // radius 10

      const darkStroke = calls.find((c) => c.method === 'stroke');
      expect(darkStroke?.lineWidth).toBe(3);
      expect(darkStroke?.shadowBlur).toBe(0);

      const fillCall = calls.find((c) => c.method === 'fill');
      expect(fillCall?.fillStyle).toBe('#ffffff');
      expect(fillCall?.shadowBlur).toBe(12);

      expect(ctx.fillText).toHaveBeenCalledWith('A', expect.any(Number), expect.any(Number));

      // Hand reset afterwards
      expect(ctx.shadowBlur).toBe(0);
      expect(ctx.lineWidth).toBe(1);
    });

    it('renders segment with at least 2x line width and lighter tint', () => {
      const { ctx, calls } = createMockCtx();
      renderHighlightElement(ctx, view, triangle, { kind: 'segment', id: 'AB' });

      const strokeCall = calls.find((c) => c.method === 'stroke');
      expect(strokeCall?.lineWidth).toBeGreaterThanOrEqual(8);
      expect(strokeCall?.strokeStyle).toBe('#a6ffcc');
      expect(strokeCall?.shadowBlur).toBe(16);
      expect(calls.some((c) => c.method === 'moveTo')).toBe(true);
      expect(calls.some((c) => c.method === 'lineTo')).toBe(true);
      expect(ctx.stroke).toHaveBeenCalled();

      // Hand reset afterwards
      expect(ctx.shadowBlur).toBe(0);
      expect(ctx.lineWidth).toBe(1);
      expect(ctx.strokeStyle).toBe('#000000');
    });

    it('renders polyline with at least 2x line width and lighter tint', () => {
      const { ctx, calls } = createMockCtx();
      renderHighlightElement(ctx, view, sine, { kind: 'polyline', id: 'sine_curve' });

      const strokeCall = calls.find((c) => c.method === 'stroke');
      expect(strokeCall?.lineWidth).toBeGreaterThanOrEqual(8);
      expect(strokeCall?.strokeStyle).toBe('#a6ffcc');
      expect(strokeCall?.shadowBlur).toBe(16);
      expect(calls.some((c) => c.method === 'moveTo')).toBe(true);
      expect(calls.some((c) => c.method === 'lineTo')).toBe(true);
      expect(ctx.stroke).toHaveBeenCalled();

      // Hand reset afterwards
      expect(ctx.shadowBlur).toBe(0);
      expect(ctx.lineWidth).toBe(1);
      expect(ctx.strokeStyle).toBe('#000000');
    });

    it('renders bar outline with at least 2x line width and lighter tint', () => {
      const { ctx, calls } = createMockCtx();
      renderHighlightElement(ctx, view, barchart, { kind: 'bar', id: 'q1' });

      const rectCall = calls.find((c) => c.method === 'strokeRect');
      expect(rectCall?.lineWidth).toBeGreaterThanOrEqual(8);
      expect(rectCall?.strokeStyle).toBe('#a6ffcc');
      expect(rectCall?.shadowBlur).toBe(16);
      expect(ctx.strokeRect).toHaveBeenCalled();

      // Hand reset afterwards
      expect(ctx.shadowBlur).toBe(0);
      expect(ctx.lineWidth).toBe(1);
      expect(ctx.strokeStyle).toBe('#000000');
    });

    it('renders axis with at least 2x line width and lighter tint', () => {
      const { ctx, calls } = createMockCtx();
      renderHighlightElement(ctx, view, barchart, { kind: 'axis', id: 'x-axis' });

      const strokeCall = calls.find((c) => c.method === 'stroke');
      expect(strokeCall?.lineWidth).toBeGreaterThanOrEqual(8);
      expect(strokeCall?.strokeStyle).toBe('#a6ffcc');
      expect(strokeCall?.shadowBlur).toBe(16);
      expect(calls.some((c) => c.method === 'moveTo')).toBe(true);
      expect(calls.some((c) => c.method === 'lineTo')).toBe(true);
      expect(ctx.stroke).toHaveBeenCalled();

      // Hand reset afterwards
      expect(ctx.shadowBlur).toBe(0);
      expect(ctx.lineWidth).toBe(1);
      expect(ctx.strokeStyle).toBe('#000000');
    });

    it('does nothing when highlight is none', () => {
      const { ctx, calls } = createMockCtx();
      renderHighlightElement(ctx, view, triangle, { kind: 'none', id: null });

      expect(calls.length).toBe(0);
    });
  });
});
