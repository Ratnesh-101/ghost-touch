// @vitest-environment jsdom
/**
 * Task 89 tests: wire held touch into Explore for stationary fingers during Walk me through (51.6, 51.13).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { t, tf } from '../src/i18n';
import { setupRigEnv, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;

const CA = { x: 100, y: 220 };
const BC = { x: 190, y: 340 };
const AB = { x: 190, y: 220 };
const VERTEX_C = { x: 100, y: 340 };

function walkButton(rig: Rig): HTMLButtonElement | null {
  const all = Array.from(rig.container.querySelectorAll<HTMLButtonElement>('button'));
  return (
    all.find((b) =>
      /walk me through/i.test(`${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`),
    ) ?? null
  );
}

function startWalk(rig: Rig): void {
  const b = walkButton(rig);
  if (b === null) throw new Error('Walk me through button not found');
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

async function toYourTurn(rig: Rig): Promise<void> {
  startWalk(rig);
  tap(rig, CA);
  await say(rig, 'next step');
  tap(rig, BC);
  await say(rig, 'next step');
  tap(rig, VERTEX_C);
  await say(rig, 'next step');
  tap(rig, AB);
  await say(rig, 'next step');
}

describe('task 89: held touch in Explore (51.6, 51.13)', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  it('still finger on a wrong part twice then the answer is spoken once (with move to second part)', async () => {
    await withExplore({ scene: triangle }, async (rig) => {
      await toYourTurn(rig);
      rig.clearCalls();
      const answer = tf('walk.turn.answer', { name: 'AB' });

      // First wrong rest on CA: zero pointer moves after down
      rig.down(CA.x, CA.y);
      rig.advance(1400);
      expect(rig.spoken().join(' ')).not.toContain(answer);

      // Second wrong rest on BC: pointer moves to BC once, then rests still with zero pointer moves
      rig.move(BC.x, BC.y);
      rig.advance(1400);
      expect(rig.spoken().filter((s) => s.includes(answer))).toHaveLength(1);

      // Remaining still does not repeat the answer
      rig.advance(3000);
      expect(rig.spoken().filter((s) => s.includes(answer))).toHaveLength(1);
    });
  });

  it('still finger on a wrong part twice then the answer is spoken once (with lift and touch)', async () => {
    await withExplore({ scene: triangle }, async (rig) => {
      await toYourTurn(rig);
      rig.clearCalls();
      const answer = tf('walk.turn.answer', { name: 'AB' });

      // First wrong rest on CA: touch down, rest still
      rig.down(CA.x, CA.y);
      rig.advance(1400);
      expect(rig.spoken().join(' ')).not.toContain(answer);

      // Lift and touch down on BC: rest still (zero pointer moves after touch)
      rig.up(CA.x, CA.y);
      rig.advance(150);
      rig.down(BC.x, BC.y);
      rig.advance(1400);
      expect(rig.spoken().filter((s) => s.includes(answer))).toHaveLength(1);

      // Answer is spoken once, not repeatedly
      rig.advance(3000);
      expect(rig.spoken().filter((s) => s.includes(answer))).toHaveLength(1);
    });
  });

  it('a still finger on the right anchor speaks the step once not repeatedly', async () => {
    await withExplore({ scene: triangle }, async (rig) => {
      startWalk(rig);
      rig.clearCalls();

      // Side CA is the right anchor for step 1 of triangle pythagoras walk
      rig.down(CA.x, CA.y);
      // Wait for multiple keep-alive ticks (e.g. 2000 ms = >30 ticks)
      rig.advance(2000);

      // Step explanation is spoken once on reaching the anchor
      const spokenSteps = rig.spoken().filter((s) => /Side CA is 4/i.test(s));
      expect(spokenSteps).toHaveLength(1);

      // Advancing further while keeping the finger resting still does not repeat the speech
      rig.advance(5000);
      const spokenStepsAfter = rig.spoken().filter((s) => /Side CA is 4/i.test(s));
      expect(spokenStepsAfter).toHaveLength(1);
    });
  });

  it('the idle end still fires after 120 s even with a finger resting', async () => {
    await withExplore({ scene: triangle }, async (rig) => {
      startWalk(rig);
      const button = rig.container.querySelector('.gt-explore__walk') as HTMLButtonElement;
      expect(button.textContent).toContain(t('walk.next'));

      // Rest still on the canvas (keep-alive running with held: true)
      rig.down(CA.x, CA.y);
      rig.advance(121_000);

      // Idle timeout fires: walk state resets to idle, button returns to walk.start
      expect(button.textContent).toContain(t('walk.start'));
    });
  });
});
