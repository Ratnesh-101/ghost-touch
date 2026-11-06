/**
 * Tests for Teacher Correct canvas coordinate conversion (BUG-02 / finding 7).
 *
 * Verifies:
 * - Corner and edge pointer positions map to exact scene coordinates [0, 1]
 * - Wide and tall letterboxed canvas boxes
 * - DPR values from 1 to 3
 * - Points on the border and outside in the letterbox margins (clamped)
 * - Drawing and hit-testing use the same Viewport object
 */
import { describe, expect, it } from 'vitest';
import { makeViewport, toScreen, type NormPoint } from '../src/core/geometry';
import type { Point } from '../src/core/scene';
import { hitTestPoint } from '../src/flow/correct';
import {
  isPdfSource,
  pointerToHitTestCoords,
  pointerToScene,
  type CanvasBitmapSize,
  type CanvasBoundingRect,
} from '../src/flow/correctCanvas';

describe('correctCanvas: pointerToScene pure coordinate conversion', () => {
  const dprValues = [1, 1.5, 2, 3];

  describe('Square canvas (aspect 1:1, no letterbox margins)', () => {
    const width = 400;
    const height = 400;
    const rect: CanvasBoundingRect = { left: 100, top: 50, width, height };
    const view = makeViewport(width, height);

    for (const dpr of dprValues) {
      const bitmapSize: CanvasBitmapSize = {
        width: Math.round(width * dpr),
        height: Math.round(height * dpr),
      };

      it(`maps all 4 corners and center accurately with dpr=${dpr}`, () => {
        // Top-left: (0, 0)
        expect(pointerToScene(100, 50, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 0 });
        // Top-right: (1, 0)
        expect(pointerToScene(500, 50, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 0 });
        // Bottom-left: (0, 1)
        expect(pointerToScene(100, 450, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 1 });
        // Bottom-right: (1, 1)
        expect(pointerToScene(500, 450, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 1 });
        // Center: (0.5, 0.5)
        expect(pointerToScene(300, 250, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 0.5 });
      });

      it(`maps edges at dpr=${dpr}`, () => {
        // Top edge midpoint
        expect(pointerToScene(300, 50, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 0 });
        // Bottom edge midpoint
        expect(pointerToScene(300, 450, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 1 });
        // Left edge midpoint
        expect(pointerToScene(100, 250, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 0.5 });
        // Right edge midpoint
        expect(pointerToScene(500, 250, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 0.5 });
      });
    }
  });

  describe('Wide letterboxed canvas (aspect 2:1, horizontal margins)', () => {
    const width = 800;
    const height = 400;
    // Scale = 400, offsetX = 200, offsetY = 0
    const rect: CanvasBoundingRect = { left: 50, top: 100, width, height };
    const view = makeViewport(width, height);

    for (const dpr of dprValues) {
      const bitmapSize: CanvasBitmapSize = {
        width: Math.round(width * dpr),
        height: Math.round(height * dpr),
      };

      it(`maps diagram corners accurately despite horizontal letterboxing with dpr=${dpr}`, () => {
        // The drawn diagram occupies x in [50 + 200, 50 + 200 + 400] = [250, 650]
        // y in [100 + 0, 100 + 400] = [100, 500]

        // Top-left: (0, 0)
        expect(pointerToScene(250, 100, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 0 });
        // Top-right: (1, 0)
        expect(pointerToScene(650, 100, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 0 });
        // Bottom-left: (0, 1)
        expect(pointerToScene(250, 500, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 1 });
        // Bottom-right: (1, 1)
        expect(pointerToScene(650, 500, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 1 });
        // Center: (0.5, 0.5)
        expect(pointerToScene(450, 300, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 0.5 });
      });

      it(`maps diagram edge midpoints accurately with dpr=${dpr}`, () => {
        // Top edge midpoint: (0.5, 0)
        expect(pointerToScene(450, 100, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 0 });
        // Bottom edge midpoint: (0.5, 1)
        expect(pointerToScene(450, 500, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 1 });
        // Left edge midpoint: (0, 0.5)
        expect(pointerToScene(250, 300, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 0.5 });
        // Right edge midpoint: (1, 0.5)
        expect(pointerToScene(650, 300, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 0.5 });
      });

      it(`clamps points in the left and right letterbox margins with dpr=${dpr}`, () => {
        // Far left letterbox margin (x < 250): clamps x to 0
        expect(pointerToScene(100, 300, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 0.5 });
        expect(pointerToScene(50, 100, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 0 });

        // Far right letterbox margin (x > 650): clamps x to 1
        expect(pointerToScene(750, 300, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 0.5 });
        expect(pointerToScene(850, 500, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 1 });
      });
    }
  });

  describe('Tall letterboxed canvas (aspect 1:2, vertical margins, mobile portrait)', () => {
    const width = 360;
    const height = 720;
    // Scale = 360, offsetX = 0, offsetY = 180
    const rect: CanvasBoundingRect = { left: 0, top: 0, width, height };
    const view = makeViewport(width, height);

    for (const dpr of dprValues) {
      const bitmapSize: CanvasBitmapSize = {
        width: Math.round(width * dpr),
        height: Math.round(height * dpr),
      };

      it(`maps diagram corners accurately despite vertical letterboxing with dpr=${dpr}`, () => {
        // The drawn diagram occupies x in [0, 360]
        // y in [180, 540]

        // Top-left: (0, 0)
        expect(pointerToScene(0, 180, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 0 });
        // Top-right: (1, 0)
        expect(pointerToScene(360, 180, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 0 });
        // Bottom-left: (0, 1)
        expect(pointerToScene(0, 540, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 1 });
        // Bottom-right: (1, 1)
        expect(pointerToScene(360, 540, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 1 });
        // Center: (0.5, 0.5)
        expect(pointerToScene(180, 360, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 0.5 });
      });

      it(`maps diagram edge midpoints accurately with dpr=${dpr}`, () => {
        // Top edge midpoint: (0.5, 0)
        expect(pointerToScene(180, 180, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 0 });
        // Bottom edge midpoint: (0.5, 1)
        expect(pointerToScene(180, 540, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 1 });
        // Left edge midpoint: (0, 0.5)
        expect(pointerToScene(0, 360, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 0.5 });
        // Right edge midpoint: (1, 0.5)
        expect(pointerToScene(360, 360, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 0.5 });
      });

      it(`clamps points in the top and bottom letterbox margins with dpr=${dpr}`, () => {
        // Top letterbox margin (y < 180): clamps y to 0
        expect(pointerToScene(180, 50, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 0 });
        expect(pointerToScene(0, 10, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 0 });

        // Bottom letterbox margin (y > 540): clamps y to 1
        expect(pointerToScene(180, 650, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 1 });
        expect(pointerToScene(360, 700, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 1 });
      });
    }
  });

  describe('Mobile phone screen aspect ratio (320x280 from BUG-02 audit)', () => {
    const width = 320;
    const height = 280;
    // Scale = 280, offsetX = (320 - 280) / 2 = 20, offsetY = 0
    const rect: CanvasBoundingRect = { left: 10, top: 20, width, height };
    const view = makeViewport(width, height);
    const bitmapSize: CanvasBitmapSize = { width: 320 * 2, height: 280 * 2 };
    const dpr = 2;

    it('maps corners and edges on small phone display without drift', () => {
      // Diagram bounds: x in [10 + 20, 10 + 20 + 280] = [30, 310]
      // y in [20, 20 + 280] = [20, 300]

      expect(pointerToScene(30, 20, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 0 });
      expect(pointerToScene(310, 20, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 0 });
      expect(pointerToScene(30, 300, rect, bitmapSize, dpr, view)).toEqual({ x: 0, y: 1 });
      expect(pointerToScene(310, 300, rect, bitmapSize, dpr, view)).toEqual({ x: 1, y: 1 });
      expect(pointerToScene(170, 160, rect, bitmapSize, dpr, view)).toEqual({ x: 0.5, y: 0.5 });
    });
  });

  describe('Object params call signature', () => {
    it('accepts single options object matching PointerToSceneParams', () => {
      const rect = { left: 0, top: 0, width: 200, height: 200 };
      const view = makeViewport(200, 200);
      const pt = pointerToScene({
        clientX: 100,
        clientY: 100,
        rect,
        bitmapSize: { width: 400, height: 400 },
        dpr: 2,
        viewport: view,
      });
      expect(pt).toEqual({ x: 0.5, y: 0.5 });
    });
  });
});

describe('Drawing and Hit-Testing use the SAME Viewport object', () => {
  const boxShapes = [
    { name: 'square', w: 400, h: 400 },
    { name: 'wide', w: 600, h: 300 },
    { name: 'tall', w: 320, h: 500 },
    { name: 'phone', w: 320, h: 280 },
  ];

  for (const { name, w, h } of boxShapes) {
    it(`guarantees exact mathematical inverse between toScreen and pointerToScene on ${name} (${w}x${h})`, () => {
      const rect: CanvasBoundingRect = { left: 40, top: 60, width: w, height: h };
      const view = makeViewport(w, h);
      const bitmapSize: CanvasBitmapSize = { width: w * 2, height: h * 2 };
      const dpr = 2;

      const testNormPoints: NormPoint[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 0.5, y: 0.5 },
        { x: 0.25, y: 0.75 },
        { x: 0.82, y: 0.18 },
      ];

      for (const normPt of testNormPoints) {
        // 1. Where drawing places the point in screen CSS pixels
        const drawnScreen = toScreen(normPt, view);

        // 2. Client coordinate of the pointer touching that exact drawn pixel
        const clientX = rect.left + drawnScreen.x;
        const clientY = rect.top + drawnScreen.y;

        // 3. Convert client coordinates back using pointerToScene with the same Viewport
        const recovered = pointerToScene(clientX, clientY, rect, bitmapSize, dpr, view);

        expect(recovered.x).toBeCloseTo(normPt.x, 5);
        expect(recovered.y).toBeCloseTo(normPt.y, 5);
      }
    });

    it(`hitTestPoint finds drawn points with 0 distance when using pointerToHitTestCoords on ${name} (${w}x${h})`, () => {
      const rect: CanvasBoundingRect = { left: 30, top: 50, width: w, height: h };
      const view = makeViewport(w, h);

      const scenePoints: Point[] = [
        { id: 'top-left', x: 0, y: 0 },
        { id: 'top-right', x: 1, y: 0 },
        { id: 'bottom-left', x: 0, y: 1 },
        { id: 'bottom-right', x: 1, y: 1 },
        { id: 'center', x: 0.5, y: 0.5 },
      ];

      for (const pt of scenePoints) {
        // Position where toScreen drew the point
        const drawn = toScreen(pt, view);
        const clientX = rect.left + drawn.x;
        const clientY = rect.top + drawn.y;

        // Coordinate transformation for hit-testing
        const { px, py } = pointerToHitTestCoords(clientX, clientY, rect, view);

        // Run hitTestPoint using view.scale as both width and height
        const hit = hitTestPoint(scenePoints, px, py, view.scale, view.scale, 24);

        expect(hit, `Point ${pt.id} should be hit when touched`).not.toBeNull();
        expect(hit?.id).toBe(pt.id);
      }
    });
  }
});

describe('isPdfSource helper (Finding 17)', () => {
  it('identifies pdf data URLs and extensions', () => {
    expect(isPdfSource('data:application/pdf;base64,JVBERi0xLjQ=')).toBe(true);
    expect(isPdfSource('https://example.com/diagram.pdf')).toBe(true);
    expect(isPdfSource('blob:http://localhost:5173/test.pdf')).toBe(true);
    expect(isPdfSource('https://example.com/diagram.pdf?token=123')).toBe(true);
  });

  it('permits image URLs and null/empty', () => {
    expect(isPdfSource('data:image/png;base64,iVBORw0KGgo=')).toBe(false);
    expect(isPdfSource('https://example.com/photo.jpg')).toBe(false);
    expect(isPdfSource('blob:http://localhost:5173/4a1c6e')).toBe(false);
    expect(isPdfSource('')).toBe(false);
    expect(isPdfSource(null)).toBe(false);
    expect(isPdfSource(undefined)).toBe(false);
  });
});
