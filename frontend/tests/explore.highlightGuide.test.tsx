// @vitest-environment jsdom
/**
 * Tests for review finding Issue 4 (lane hi6 / task 81.1 follow-up):
 * - Clear highlight and redraw in startGuide and in the guide branch of the lift handler.
 * - Stop applying a highlight while guiding.
 * - Test: a finger on a line, guide starts, highlight is none and data-highlight is none.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { setupRigEnv, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;

function canvasOf(rig: Rig): HTMLCanvasElement {
  const c = rig.container.querySelector('canvas');
  if (!c) throw new Error('no canvas');
  return c;
}

const highlightAttr = (rig: Rig): string | null => canvasOf(rig).getAttribute('data-highlight');

describe('Issue 4: Highlight cleared and suppressed during Guide (Lane hi6)', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  it('clears highlight and sets data-highlight to none when guide starts with finger on a line', async () => {
    await withExplore({ scene: triangle, guide: true }, async (rig) => {
      // 1. Put finger on segment AB at (190, 220)
      rig.down(100, 100);
      rig.advance(600);
      rig.move(190, 220);
      expect(highlightAttr(rig)).toBe('segment:AB');

      // 2. Guide starts (via voice command)
      rig.openAsk();
      await rig.resolveListen('take me to B');
      await rig.flush();

      // 3. Highlight must be cleared immediately upon startGuide
      expect(highlightAttr(rig)).toBe('none');

      // 4. Lifting finger during guide keeps highlight at none
      rig.up(190, 220);
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  it('clears highlight when guide starts while touching a vertex', async () => {
    await withExplore({ scene: triangle, guide: true }, async (rig) => {
      // Finger on corner A
      rig.down(100, 100);
      expect(highlightAttr(rig)).toBe('vertex:A');

      // Guide starts
      rig.openAsk();
      await rig.resolveListen('take me to B');
      await rig.flush();

      // Highlight cleared
      expect(highlightAttr(rig)).toBe('none');

      // Finger lift preserves none
      rig.up(100, 100);
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  it('stops applying highlights to moving fingers while guide is active', async () => {
    await withExplore({ scene: triangle, guide: true }, async (rig) => {
      // Start guiding first
      rig.openAsk();
      await rig.resolveListen('take me to B');
      await rig.flush();
      expect(highlightAttr(rig)).toBe('none');

      // Touch down on vertex A while guiding
      rig.down(100, 100);
      expect(highlightAttr(rig)).toBe('none');

      // Drag across segment AB while guiding
      rig.move(190, 220);
      expect(highlightAttr(rig)).toBe('none');

      // Move to corner B
      rig.move(280, 340);
      expect(highlightAttr(rig)).toBe('none');

      // Lift finger
      rig.up(280, 340);
      expect(highlightAttr(rig)).toBe('none');
    });
  });

  it('clears highlight in the guide branch of the lift handler if a finger was on an element', async () => {
    await withExplore({ scene: triangle, guide: true }, async (rig) => {
      // Finger on side BC
      rig.down(100, 100);
      rig.advance(600);
      rig.move(190, 340);
      expect(highlightAttr(rig)).toBe('segment:BC');

      // Guide starts
      rig.openAsk();
      await rig.resolveListen('take me to A');
      await rig.flush();
      expect(highlightAttr(rig)).toBe('none');

      // Lift
      rig.up(190, 340);
      expect(highlightAttr(rig)).toBe('none');
    });
  });
});
