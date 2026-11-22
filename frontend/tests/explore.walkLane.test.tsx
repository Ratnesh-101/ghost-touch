// @vitest-environment jsdom
/**
 * Lane hi11 tests for Planchette ("Walk me through", Requirement 51) on Explore.
 *
 * Covers:
 * - Template walk offer and gate (raw mode, grid fact guard)
 * - Walk button rendering and label switching (Walk me through / Next step)
 * - Walk touch feed and one utterance merge
 * - Ask-active feed gate (touching during Ask listening does not advance walk)
 * - Lift guard extension (isAskAnswerSpeaking protects walk speech on lift)
 * - Voice commands: walk_start, walk_next, repeat, stop
 * - Idle timeout (120 s)
 * - Second start replacing first silently
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import barsJson from '../public/samples/barchart.json';
import sineJson from '../public/samples/sine.json';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { tf } from '../src/i18n';
import { setupRigEnv, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;
const bars = barsJson as unknown as DiagramScene;
const sine = sineJson as unknown as DiagramScene;

const CA = { x: 100, y: 220 };
const VERTEX_A = { x: 100, y: 100 };

function walkButton(rig: Rig): HTMLButtonElement | null {
  const all = Array.from(rig.container.querySelectorAll<HTMLButtonElement>('button'));
  return (
    all.find((b) =>
      /walk me through|next step/i.test(`${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`),
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

function tap(rig: Rig, p: { x: number; y: number }): void {
  rig.down(p.x, p.y);
  rig.advance(100);
  rig.up(p.x, p.y);
  rig.advance(600);
}

describe('Lane hi11: Planchette in Explore (Requirement 51)', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  describe('Guard 1 & 2: templateWalk is the only gate', () => {
    it('shows button on supported scenes (triangle, bar chart, sine)', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        expect(walkButton(rig)?.textContent).toContain('Walk me through');
      });
      await withExplore({ scene: bars }, (rig) => {
        expect(walkButton(rig)?.textContent).toContain('Walk me through');
      });
      await withExplore({ scene: sine }, (rig) => {
        expect(walkButton(rig)?.textContent).toContain('Walk me through');
      });
    });

    it('guard: raw mode suppresses the walk button', async () => {
      await withExplore({ scene: triangle, isRaw: true }, (rig) => {
        expect(walkButton(rig)).toBeNull();
      });
      const rawUnknown: DiagramScene = { ...triangle, kind: 'unknown' };
      await withExplore({ scene: rawUnknown }, (rig) => {
        expect(walkButton(rig)).toBeNull();
      });
    });

    it('guard: Ghost Hand grid fact line suppresses the walk button', async () => {
      const gridScene: DiagramScene = {
        ...triangle,
        facts: [...(triangle.facts ?? []), 'Grid: x 0-6, y 0-8'],
      };
      await withExplore({ scene: gridScene }, (rig) => {
        expect(walkButton(rig)).toBeNull();
      });
    });
  });

  describe('Guard 3: Ask-active feed gate', () => {
    it('touching the anchor while Ask is listening does not advance walk', async () => {
      await withExplore({ scene: triangle }, async (rig) => {
        startWalk(rig);
        expect(rig.spoken().join(' ')).toContain(tf('walk.find.segment', { name: 'CA' }));

        // Open Ask to activate listening
        rig.openAsk();
        rig.clearCalls();

        // Touch the anchor while Ask listening is active
        rig.down(CA.x, CA.y);
        rig.advance(100);
        // During Ask listening, engine and walk must be silent
        expect(rig.spoken()).toEqual([]);

        rig.up(CA.x, CA.y);
        rig.advance(400);

        // Cancel / resolve Ask
        await rig.resolveListen('something unrelated');
        await rig.flush();

        // Walk should still be looking for CA (did not advance during Ask listening)
        rig.clearCalls();
        rig.down(CA.x, CA.y);
        rig.advance(50);
        const spoken = rig.spoken();
        expect(spoken).toHaveLength(1);
        expect(spoken[0]).toContain('CA');
        expect(spoken[0]).toMatch(/\b4\b/);
      });
    });
  });

  describe('Guard 4: Lift guard extension', () => {
    it('protects walk step speech from being cut by pointer lift', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        startWalk(rig);
        rig.down(CA.x, CA.y);
        rig.advance(50);
        expect(rig.spoken().join(' ')).toContain('CA');

        // Simulate speech driver currently speaking the step
        rig.setSpeaking(true);
        rig.clearCalls();

        rig.up(CA.x, CA.y);
        rig.advance(400);
        expect(rig.stopSpeaking).not.toHaveBeenCalled();
      });
    });

    it('control: exploration speech without walk is still cut on lift', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.down(VERTEX_A.x, VERTEX_A.y);
        rig.setSpeaking(true);
        rig.clearCalls();

        rig.up(VERTEX_A.x, VERTEX_A.y);
        rig.advance(400);
        expect(rig.stopSpeaking).toHaveBeenCalled();
      });
    });
  });

  describe('Button label progression and repeat/stop voice commands', () => {
    it('toggles label between Walk me through and Next step, and advances via button', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        const btn = walkButton(rig);
        expect(btn?.textContent).toBe('Walk me through');

        // Tap to start
        act(() => btn?.click());
        expect(btn?.textContent).toBe('Next step');

        // Touch anchor for step 1 (CA)
        tap(rig, CA);

        // Tap Next step button to advance to step 2
        rig.clearCalls();
        act(() => btn?.click());
        expect(rig.spoken().join(' ')).toContain(tf('walk.find.segment', { name: 'BC' }));
      });
    });

    it('repeat voice command repeats current prompt while walk is active', async () => {
      await withExplore({ scene: triangle }, async (rig) => {
        startWalk(rig);
        rig.clearCalls();
        await say(rig, 'repeat');
        expect(rig.spoken().join(' ')).toContain(tf('walk.find.segment', { name: 'CA' }));
      });
    });

    it('starting a second walk replaces the first silently', async () => {
      await withExplore({ scene: triangle }, async (rig) => {
        startWalk(rig);
        tap(rig, CA);
        await say(rig, 'next step');
        expect(rig.spoken().join(' ')).toContain(tf('walk.find.segment', { name: 'BC' }));

        // Start walk again via voice command
        rig.clearCalls();
        await say(rig, 'walk me through');
        const text = rig.spoken().join(' ');
        expect(text).toContain(tf('walk.intro', { count: '4' }));
        expect(text).toContain(tf('walk.find.segment', { name: 'CA' }));
      });
    });

    it('120 s idle timeout resets walk silently', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        startWalk(rig);
        const btn = walkButton(rig);
        expect(btn?.textContent).toBe('Next step');

        // Advance fake time past 120,000 ms with a keep-alive tick
        rig.down(50, 50); // touch away from elements
        rig.advance(125_000);
        rig.up(50, 50);
        rig.advance(100);

        // Button should revert to Walk me through
        expect(btn?.textContent).toBe('Walk me through');
      });
    });
  });
});
