// @vitest-environment jsdom
/**
 * Lane ux1 tests: three hold-lifecycle bugs.
 * 1. createHoldKeepAliveTimer: update(coords, now) restarts interval when timer === null.
 * 2. where-am-I dwell: commit dwellResult.nextState only when spoken; keep armed while speech is running.
 * 3. pointerdown guiding branch seeds axisState and resets pageEdgeState; all-fingers-up resets axisState.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sineJson from '../public/samples/sine.json';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import {
  createHoldKeepAliveTimer,
  KEEP_ALIVE_INTERVAL_MS,
} from '../src/flow/explore';
import { setupRigEnv, SIZE, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;
const sine = sineJson as unknown as DiagramScene;

function sinePeak(): { x: number; y: number } {
  const points = sine.polylines?.[0]?.points ?? [];
  let best = points[0];
  for (const p of points) {
    if (best === undefined || p[1] < best[1]) best = p;
  }
  if (best === undefined) throw new Error('sine sample has no curve');
  return { x: best[0] * SIZE, y: best[1] * SIZE };
}

function isGuiding(rig: Rig): boolean {
  return rig.container.querySelector('.gt-explore--guiding') !== null;
}

async function startGuide(rig: Rig, phrase: string): Promise<void> {
  rig.openAsk();
  await rig.resolveListen(phrase);
  expect(isGuiding(rig)).toBe(true);
}

describe('Lane ux1: hold-lifecycle bug fixes', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  describe('Bug 1: createHoldKeepAliveTimer update restarts when timer === null', () => {
    it('update restarts interval when timer === null and fires onTick on stillness', () => {
      const onTick = vi.fn();
      let shouldRun = true;
      const timer = createHoldKeepAliveTimer({
        intervalMs: KEEP_ALIVE_INTERVAL_MS,
        shouldRun: () => shouldRun,
        onTick,
      });

      expect(timer.isActive()).toBe(false);

      // Advance to simulated start time (1000 ms)
      vi.advanceTimersByTime(1000);
      timer.start({ x: 50, y: 50 }, 1000);
      expect(timer.isActive()).toBe(true);

      // Stop timer
      timer.stop();
      expect(timer.isActive()).toBe(false);

      // Advance time before update (to 1100 ms)
      vi.advanceTimersByTime(100);
      // Update when timer === null should restart the interval
      timer.update({ x: 100, y: 100 }, 1100);
      expect(timer.isActive()).toBe(true);

      // Advancing time should trigger onTick
      vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
      expect(onTick).toHaveBeenCalledWith({ x: 100, y: 100 }, expect.any(Number));
      timer.stop();
    });

    it('guide arrival then 1 s still gives a line buzz', async () => {
      await withExplore({ scene: sine, guide: true }, async (rig) => {
        await startGuide(rig, 'find the peak');
        const peak = sinePeak();
        rig.down(300, 300); // away from the peak, while guiding
        rig.advance(100);
        rig.move(peak.x, peak.y); // arrival at peak
        expect(isGuiding(rig)).toBe(false);
        rig.clearCalls();
        rig.advance(1000); // no pointer event: hold keep-alive ticks
        expect(rig.vibrate).toHaveBeenCalledWith(80);
      });
    });
  });

  describe('Bug 2: where-am-I dwell during ongoing speech', () => {
    it('a dwell during a 3 s utterance speaks after it ends, once', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.setSpeaking(true); // ongoing 3 s utterance
        rig.clearCalls();
        rig.down(330, 60); // finger in empty space (where-am-I target)
        rig.advance(3000); // 3 seconds pass while speaking
        expect(rig.spoken()).toEqual([]); // nothing talks over ongoing speech

        rig.setSpeaking(false); // speech ends
        rig.advance(1500); // dwell fires once speech ends
        expect(rig.spoken().length).toBe(1);

        // Advancing further with stationary finger does not repeat
        rig.advance(3000);
        expect(rig.spoken().length).toBe(1);
      });
    });
  });

  describe('Bug 3: axis tracking during guide and across holds', () => {
    it('no "y-axis" on arrival after a guide across the axis', async () => {
      await withExplore({ scene: sine, guide: true }, async (rig) => {
        rig.down(10, 300); // first hold, left of the y-axis (x = 32)
        rig.up(10, 300);
        await startGuide(rig, 'find the peak');
        const peak = sinePeak();
        rig.down(300, 300); // new hold during Guide, right of the axis
        rig.advance(100);
        rig.move(peak.x, peak.y); // arrival on the right
        expect(isGuiding(rig)).toBe(false);
        rig.clearCalls();
        rig.advance(100);
        rig.move(peak.x + 1, peak.y);
        expect(rig.spoken().filter((s) => /y-axis/.test(s))).toEqual([]);
      });
    });

    it('all-fingers-up resets axisState so subsequent touch is cleanly seeded', async () => {
      await withExplore({ scene: sine }, (rig) => {
        // Touch on left of y-axis (x = 10, y-axis at x = 32)
        rig.down(10, 300);
        rig.advance(100);
        rig.up(10, 300); // All fingers up: resets axisState

        rig.clearCalls();
        // New hold on right of y-axis (x = 300)
        rig.down(300, 300);
        rig.advance(100);
        rig.move(305, 300); // Move right without crossing
        expect(rig.spoken().filter((s) => /y-axis/.test(s))).toEqual([]);
      });
    });
  });
});
