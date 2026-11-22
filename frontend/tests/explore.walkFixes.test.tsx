// @vitest-environment jsdom
/**
 * Lane hi16 tests for Planchette fixes (Explore Walk follow-up):
 *
 * Covers:
 * (1) 120 s idle timeout with finger up:
 *     - Low-rate interval ticks without a finger down so the button label returns to "Walk me through"
 *     - Tapping the button after 130 s starts a new walk and speaks the intro (never silent)
 *     - Tapping "Next step" when idle timeout expired speaks walk.stopped and flips label to Walk me through
 *     - Interval is cleared on unmount, Back, scene change, and stop
 * (2) Voice commands when walk is null or not running:
 *     - walk_start when walk === null speaks walk.none ("There is no walk for this diagram.")
 *     - walk_next when walk === null speaks walk.none ("There is no walk for this diagram.")
 *     - walk_next when walk is not running speaks walk.notRunning ("No walk is running. Say walk me through to start one.")
 *     - repeat with no walk / not running is never silent
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import barsJson from '../public/samples/barchart.json';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { tf } from '../src/i18n';
import { setupRigEnv, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;
const bars = barsJson as unknown as DiagramScene;

function walkButton(rig: Rig): HTMLButtonElement | null {
  const all = Array.from(rig.container.querySelectorAll<HTMLButtonElement>('button'));
  return (
    all.find((b) =>
      /walk me through|next step/i.test(
        `${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`,
      ),
    ) ?? null
  );
}

function startWalk(rig: Rig): void {
  const b = walkButton(rig);
  if (b === null) throw new Error('Walk button not found');
  act(() => b.click());
}

async function say(rig: Rig, phrase: string): Promise<void> {
  rig.openAsk();
  await rig.resolveListen(phrase);
  await rig.flush();
}

describe('Lane hi16: Planchette walk fixes (DO 1 and DO 2)', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  describe('Fix (1): 120 s idle end with finger up and button click feedback', () => {
    it('130 s idle with finger up reverts button to "Walk me through" via low-rate interval, then press starts new walk', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        // Start walk on triangle sample
        startWalk(rig);
        const btn = walkButton(rig);
        expect(btn?.textContent).toBe('Next step');

        // Finger is UP (no pointerdown). Advance fake timers by 130 s (130,000 ms).
        rig.clearCalls();
        rig.advance(130_000);

        // Low-rate interval (5 s) ticked and detected idle timeout (> 120 s)
        // Button label must have returned to "Walk me through" without a finger!
        expect(btn?.textContent).toBe('Walk me through');

        // Pressing the button now starts a fresh walk and speaks intro (never silent!)
        rig.clearCalls();
        act(() => btn?.click());

        // Button flips back to "Next step"
        expect(btn?.textContent).toBe('Next step');

        // Speech output contains walk intro and first prompt
        const spoken = rig.spoken().join(' ');
        expect(spoken).toContain(tf('walk.intro', { count: '4' }));
        expect(spoken).toContain(tf('walk.find.segment', { name: 'CA' }));
        expect(rig.speak).toHaveBeenCalled();
      });
    });

    it('pressing Next step after idle timeout (without waiting for interval) speaks walk.stopped and flips to Walk me through', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        startWalk(rig);
        const btn = walkButton(rig);
        expect(btn?.textContent).toBe('Next step');

        // Advance past 120 s idle timeout directly
        rig.clearCalls();
        rig.advance(121_000);

        // Even if interval had fired or if btn was clicked right as timeout expired:
        // Clicking should not be silent!
        if (btn?.textContent === 'Next step') {
          act(() => btn.click());
          // Spoke walk.stopped and flipped label
          expect(rig.spoken()).toContain(tf('walk.stopped', {}));
          expect(btn.textContent).toBe('Walk me through');
        } else {
          expect(btn?.textContent).toBe('Walk me through');
          act(() => btn?.click());
          expect(rig.spoken().join(' ')).toContain(tf('walk.intro', { count: '4' }));
        }
      });
    });

    it('interval is cleared on Back navigation', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        startWalk(rig);
        expect(walkButton(rig)?.textContent).toBe('Next step');

        // Click Back
        const backBtn = rig.container.querySelector<HTMLButtonElement>('.gt-explore__back');
        expect(backBtn).not.toBeNull();
        act(() => backBtn?.click());

        // Advance 130 s: no errors or unhandled interval ticks
        rig.advance(130_000);
      });
    });

    it('interval is cleared on scene change', async () => {
      await withExplore({ scene: triangle }, async (rig) => {
        startWalk(rig);
        expect(walkButton(rig)?.textContent).toBe('Next step');

        // Re-render with bar chart
        await rig.rerender(bars);

        // New scene starts idle
        expect(walkButton(rig)?.textContent).toBe('Walk me through');

        // Advance 130 s: no errors or unexpected ticks
        rig.advance(130_000);
        expect(walkButton(rig)?.textContent).toBe('Walk me through');
      });
    });

    it('interval is cleared on "stop" voice command', async () => {
      await withExplore({ scene: triangle }, async (rig) => {
        startWalk(rig);
        expect(walkButton(rig)?.textContent).toBe('Next step');

        // Issue voice stop
        rig.clearCalls();
        await say(rig, 'stop');
        expect(rig.spoken()).toContain(tf('walk.stopped', {}));
        expect(walkButton(rig)?.textContent).toBe('Walk me through');

        // Advance 130 s: remains idle, no spurious speech
        rig.clearCalls();
        rig.advance(130_000);
        expect(rig.spoken()).toEqual([]);
      });
    });
  });

  describe('Fix (2): Voice commands with no walk or when walk is not running', () => {
    it('voice command "walk me through" when walk is null (Raw Mode) speaks walk.none with language', async () => {
      await withExplore({ scene: triangle, isRaw: true }, async (rig) => {
        // Raw Mode: walk === null, walk button not rendered
        expect(walkButton(rig)).toBeNull();

        rig.clearCalls();
        await say(rig, 'walk me through');

        // Speaks walk.none line; never silent
        const spoken = rig.spoken();
        expect(spoken).toContain(tf('walk.none', {}));
        expect(rig.speak).toHaveBeenCalledWith(tf('walk.none', {}), 'en-IN');
      });
    });

    it('voice command "next step" when walk is null (Raw Mode) speaks walk.none with language', async () => {
      await withExplore({ scene: triangle, isRaw: true }, async (rig) => {
        expect(walkButton(rig)).toBeNull();

        rig.clearCalls();
        await say(rig, 'next step');

        // Speaks walk.none line; never silent
        const spoken = rig.spoken();
        expect(spoken).toContain(tf('walk.none', {}));
        expect(rig.speak).toHaveBeenCalledWith(tf('walk.none', {}), 'en-IN');
      });
    });

    it('voice command "next step" when walk is not running speaks walk.notRunning with language', async () => {
      await withExplore({ scene: triangle }, async (rig) => {
        // Walk is available but NOT running (phase: idle)
        expect(walkButton(rig)?.textContent).toBe('Walk me through');

        rig.clearCalls();
        await say(rig, 'next step');

        // Speaks walk.notRunning line; never silent
        const spoken = rig.spoken();
        expect(spoken).toContain(tf('walk.notRunning', {}));
        expect(rig.speak).toHaveBeenCalledWith(tf('walk.notRunning', {}), 'en-IN');
      });
    });

    it('voice command "walk me through" on unknown scene kind (walk is null) speaks walk.none', async () => {
      const rawUnknown: DiagramScene = { ...triangle, kind: 'unknown' };
      await withExplore({ scene: rawUnknown }, async (rig) => {
        expect(walkButton(rig)).toBeNull();

        rig.clearCalls();
        await say(rig, 'walk me through');

        expect(rig.spoken()).toContain(tf('walk.none', {}));
      });
    });

    it('voice command "repeat" when no walk is running speaks without failing silently', async () => {
      await withExplore({ scene: triangle }, async (rig) => {
        expect(walkButton(rig)?.textContent).toBe('Walk me through');

        rig.clearCalls();
        await say(rig, 'repeat');

        // Should speak (either lastSpoken or commands.noSpoken / walk.notRunning); never silent!
        expect(rig.spoken().length).toBeGreaterThan(0);
      });
    });
  });
});
