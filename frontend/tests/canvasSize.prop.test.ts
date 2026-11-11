/**
 * P86 (Requirement 25, task 42): the Explore canvas box is stable under interaction.
 *
 * The harness models the Explore component's loop: every event may trigger a re-measure
 * (the ResizeObserver, the pointer-down refresh), and "bitmap resize" is what updateDimensions
 * does to canvas.width / canvas.height. The container size is a function of the viewport only
 * (that is the layout rule of 25.5); pointer events, status text and bitmap resizes cannot
 * change it. The property checks reconcileCanvasBox never moves the CSS box on its own, never
 * depends on the DPR, and reports `changed` exactly once per real viewport change.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  cappedDpr,
  measureBox,
  reconcileCanvasBox,
  type CanvasBox,
} from '../src/flow/canvasSize';

type Ev =
  | { kind: 'down' | 'move' | 'up' | 'cancel' | 'status' | 'debug' | 'bitmap' | 'remeasure' }
  | { kind: 'viewport'; w: number; h: number };

const evArb: fc.Arbitrary<Ev> = fc.oneof(
  { weight: 8, arbitrary: fc.constantFrom<Ev>(
    { kind: 'down' }, { kind: 'move' }, { kind: 'up' }, { kind: 'cancel' },
    { kind: 'status' }, { kind: 'debug' }, { kind: 'bitmap' }, { kind: 'remeasure' },
  ) },
  { weight: 1, arbitrary: fc.record({
    kind: fc.constant('viewport' as const),
    w: fc.integer({ min: 100, max: 2000 }),
    h: fc.integer({ min: 100, max: 4000 }),
  }) },
);

describe('P86 canvas box is stable under interaction', () => {
  it('only a real viewport change moves the CSS box, once, whatever the DPR and events', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 100, max: 4000 }),
        fc.double({ min: 1, max: 4, noNaN: true }),
        fc.array(evArb, { minLength: 1, maxLength: 60 }),
        (w0, h0, dpr, events) => {
          let viewport = { w: w0, h: h0 };
          // Layout rule 25.5: the container is a function of the viewport only.
          const container = (): { width: number; height: number } => ({
            width: viewport.w,
            height: viewport.h,
          });

          const first = reconcileCanvasBox(null, container(), dpr);
          expect(first.changed).toBe(true);
          let box: CanvasBox = first.box;
          const startCss = { w: box.cssWidth, h: box.cssHeight };
          expect([startCss.w, startCss.h]).toEqual([w0, h0]);

          for (const ev of events) {
            if (ev.kind === 'viewport') viewport = { w: ev.w, h: ev.h };
            // Every event may cause a re-measure (observer or pointer-down refresh).
            const r = reconcileCanvasBox(box, container(), dpr);
            const moved = r.box.cssWidth !== box.cssWidth || r.box.cssHeight !== box.cssHeight;
            expect(r.changed).toBe(moved);
            if (ev.kind === 'viewport') {
              expect([r.box.cssWidth, r.box.cssHeight]).toEqual([viewport.w, viewport.h]);
            } else {
              expect(r.changed).toBe(false);
              expect(r.box).toBe(box); // same object: callers can skip all work
            }
            box = r.box;
            // The observer firing a second time after a bitmap resize does nothing.
            const again = reconcileCanvasBox(box, container(), dpr);
            expect(again.changed).toBe(false);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('CSS size never depends on the DPR; the bitmap follows the capped DPR', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3000 }),
        fc.integer({ min: 1, max: 3000 }),
        fc.double({ min: -5, max: 8, noNaN: false }),
        fc.double({ min: -5, max: 8, noNaN: false }),
        (w, h, d1, d2) => {
          const a = reconcileCanvasBox(null, { width: w, height: h }, d1).box;
          const b = reconcileCanvasBox(null, { width: w, height: h }, d2).box;
          expect([a.cssWidth, a.cssHeight]).toEqual([b.cssWidth, b.cssHeight]);
          expect(a.dpr).toBeGreaterThan(0);
          expect(a.dpr).toBeLessThanOrEqual(2);
          expect(a.bitmapWidth).toBe(Math.round(w * a.dpr));
          expect(a.bitmapHeight).toBe(Math.round(h * a.dpr));
        },
      ),
      { numRuns: 300 },
    );
  });

  it('a feedback measurement (bitmap read back as container) would be caught', () => {
    // Documents the bug class: if the measured size were the canvas bitmap (CSS px x DPR),
    // every re-measure after a bitmap resize would report a change. The rule forbids it.
    let box = reconcileCanvasBox(null, { width: 300, height: 400 }, 3).box;
    const feedback = reconcileCanvasBox(box, { width: box.bitmapWidth, height: box.bitmapHeight }, 3);
    expect(feedback.changed).toBe(true);
    box = reconcileCanvasBox(null, { width: 300, height: 400 }, 3).box;
    const stable = reconcileCanvasBox(box, { width: 300, height: 400 }, 3);
    expect(stable.changed).toBe(false);
  });

  it('an unmeasurable (hidden) container keeps the previous box', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { width: 0, height: 0 },
          { width: NaN, height: 10 },
          { width: 10, height: Infinity },
          { width: -4, height: 20 },
        ),
        (hidden) => {
          const box = reconcileCanvasBox(null, { width: 320, height: 480 }, 2).box;
          const r = reconcileCanvasBox(box, hidden, 2);
          expect(r.box).toBe(box);
          expect(r.changed).toBe(false);
          expect(measureBox(hidden)).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('cappedDpr is finite, at least 1 for bad input, and never above the cap', () => {
    fc.assert(
      fc.property(fc.double(), (d) => {
        const v = cappedDpr(d);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(2);
      }),
      { numRuns: 200 },
    );
  });
});
