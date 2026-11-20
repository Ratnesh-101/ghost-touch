// @vitest-environment jsdom
/**
 * Task 80.3 oracles for Requirement 49 ("show me" highlight) on the real `Explore` screen.
 *
 * The rig has no canvas context, so drawing itself cannot be seen. What can be seen, and what
 * Requirement 49.11 therefore asks for, is `data-highlight` on the canvas (`none` or
 * `<kind>:<id>`) and the call to `highlightFor` with the target the engine gets.
 *
 * `it.fails` oracles go red-as-expected today. When lane 81.1 lands, vitest reports "expected to
 * fail but passed"; the lane (or the orchestrator) removes `.fails`. Tests without `.fails` pass
 * today: controls, and the draw-only guard (49.6) that must stay green after the lane.
 *
 * Canvas 400 x 400 CSS px. Triangle: A (100,100), B (280,340), C (100,340); side AB runs A to B.
 * The status-line height of Requirement 25 is covered by the existing Playwright canvas-stable
 * spec (jsdom has no layout) and is not repeated here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { highlightFor } from '../src/core/highlight';
import { setupRigEnv, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

vi.mock('../src/core/highlight', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/core/highlight')>();
  return { ...original, highlightFor: vi.fn(original.highlightFor) };
});

const triangle = triangleJson as unknown as DiagramScene;
const spy = vi.mocked(highlightFor);

function canvasOf(rig: Rig): HTMLCanvasElement {
  const c = rig.container.querySelector('canvas');
  if (!c) throw new Error('no canvas');
  return c;
}

const highlightAttr = (rig: Rig): string | null => canvasOf(rig).getAttribute('data-highlight');

describe('task 80.3: Requirement 49 oracles (lane 81.1)', () => {
  beforeEach(() => {
    setupRigEnv();
    spy.mockClear();
  });
  afterEach(teardownRigEnv);

  it('control: a touch on corner A gives the corner pattern, so the rig really reaches the vertex', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.down(100, 100);
      expect(rig.vibrations().some((c) => Array.isArray(c[0]))).toBe(true);
    });
  });

  it('H1 a finger on corner A: the screen asks highlightFor about vertex A and marks the canvas vertex:A (49.1, 49.11; today the screen never calls it)', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.down(100, 100);
      const hits = spy.mock.calls.map((c) => c[0]);
      expect(hits).toContainEqual(expect.objectContaining({ kind: 'vertex', id: 'A' }));
      expect(highlightAttr(rig)).toBe('vertex:A');
    });
  });

  it('H2 a finger on side AB (away from the corners) marks the canvas segment:AB (49.1, 49.11)', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.down(100, 100);
      rig.advance(600); // past the corner quiet window
      rig.move(190, 220);
      expect(highlightAttr(rig)).toBe('segment:AB');
    });
  });

  it('H3 the highlight clears on lift and is redrawn without it (49.5, 49.11)', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.down(100, 100);
      expect(highlightAttr(rig)).toBe('vertex:A'); // meaningful only if it was set first
      rig.up(100, 100);
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  it('H4 moving to empty space makes it none while the finger stays down (49.5)', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.down(100, 100);
      expect(highlightAttr(rig)).toBe('vertex:A');
      rig.advance(600);
      rig.move(300, 60); // nothing there
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  it('H5 draw-only: the vibrate, tone, speak, stop and earcon calls of a fixed trace are pinned (49.6)', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.down(100, 100);
      const trace: Array<[number, number]> = [[130, 140], [160, 180], [190, 220], [220, 260], [250, 300], [280, 340], [300, 380]];
      for (const [x, y] of trace) {
        rig.advance(60);
        rig.move(x, y);
      }
      rig.advance(60);
      rig.up(300, 380);
      rig.advance(500);
      // `stopSpeaking` is deliberately not pinned: lane ux1 (Requirement 37) adds one on lift.
      expect({
        vibrate: rig.vibrations(),
        tone: rig.tones(),
        speak: rig.spoken(),
        earcons: rig.earcons(),
      }).toMatchInlineSnapshot(`
        {
          "earcons": [],
          "speak": [
            "A. Down to C. Down-right to B.",
            "B. Left to C.",
          ],
          "tone": [
            [
              null,
            ],
            [
              null,
            ],
            [
              null,
            ],
            [
              null,
            ],
            [
              null,
            ],
            [
              null,
            ],
            [
              null,
            ],
            [
              null,
            ],
            [
              null,
            ],
            [
              null,
            ],
            [
              null,
            ],
            [
              null,
            ],
            [
              null,
            ],
          ],
          "vibrate": [
            [
              [
                50,
                90,
                50,
              ],
            ],
            [
              [
                50,
                90,
                50,
              ],
            ],
            [
              0,
            ],
          ],
        }
      `);
    });
  });
});
