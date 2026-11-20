// @vitest-environment jsdom
/**
 * Task 80.3 oracles for Requirement 50 (Explore Help button) on the real `Explore` screen.
 *
 * `it.fails` oracles are red-as-expected today. When lane 81.2 lands (button, strings, wiring),
 * vitest reports "expected to fail but passed" and the lane removes `.fails`. Tests without
 * `.fails` pass today (controls). The minimum 48 x 48 size is CSS and jsdom has no layout, so the
 * lane proves it with the existing e2e layout specs (Requirement 50.6).
 *
 * Expected text is built from the helper and the English table, so the oracle follows the lane's
 * wording and only fixes which keys are spoken, in which order, as one utterance.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import triangleJson from '../public/samples/triangle.json';
import { helpSentences, HELP_BUTTON_KEY, type HelpContext } from '../src/core/help';
import type { DiagramScene } from '../src/core/scene';
import { tables } from '../src/i18n';
import { setupRigEnv, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

vi.mock('../src/core/help', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/core/help')>();
  return { ...original, helpSentences: vi.fn(original.helpSentences) };
});

const triangle = triangleJson as unknown as DiagramScene;
const helpSpy = vi.mocked(helpSentences);

function helpButton(rig: Rig): HTMLButtonElement {
  const b = rig.container.querySelector<HTMLButtonElement>('.gt-explore__help');
  if (!b) throw new Error('Help button (.gt-explore__help) not found');
  return b;
}

function press(rig: Rig): void {
  const b = helpButton(rig);
  act(() => b.click());
}

/** The text the screen must speak for a context: the English sentences of the helper's keys. */
function expectedSentences(ctx: HelpContext): string[] {
  return helpSentences(ctx).map((k) => {
    const text = tables.en[k];
    if (typeof text !== 'string') throw new Error(`missing en string ${k}`);
    return text;
  });
}

/** Every sentence appears once, in order, inside the single utterance the screen spoke. */
function expectOneUtterance(rig: Rig, sentences: string[]): void {
  const spoken = rig.spoken();
  expect(spoken).toHaveLength(1);
  let from = 0;
  for (const s of sentences) {
    const at = (spoken[0] ?? '').indexOf(s, from);
    expect(at, `"${s}" in order`).toBeGreaterThanOrEqual(0);
    from = at + s.length;
  }
}

describe('task 80.3: Requirement 50 oracles (lane 81.2)', () => {
  beforeEach(() => {
    setupRigEnv();
    helpSpy.mockClear();
  });
  afterEach(teardownRigEnv);

  it('control: the footer already has the Ask button, so the rig finds the footer row', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      expect(rig.container.querySelector('.gt-explore__ask')).not.toBeNull();
    });
  });

  it('E1 a Help button is in the footer with a non-empty accessible name from explore.help (50.3)', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      const b = helpButton(rig);
      const name = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
      expect(name).not.toBe('');
      expect(name).toBe(tables.en[HELP_BUTTON_KEY]);
      expect(b.parentElement).toBe(rig.container.querySelector('.gt-explore__ask')?.parentElement);
    });
  });

  it('E2 pressing Help speaks the keys of helpSentences, in order, as one utterance (50.4)', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.clearCalls();
      press(rig);
      expect(helpSpy).toHaveBeenCalled();
      expectOneUtterance(rig, expectedSentences({ raw: false, guideOn: false, askOn: true }));
    });
  });

  it('E3 a Raw Mode scene adds the raw sentence, and the screen passes raw: true to the helper (50.1, 50.4)', async () => {
    await withExplore({ scene: triangle, isRaw: true }, (rig) => {
      rig.clearCalls();
      press(rig);
      expect(helpSpy).toHaveBeenCalledWith(expect.objectContaining({ raw: true }));
      expectOneUtterance(rig, expectedSentences({ raw: true, guideOn: false, askOn: true }));
    });
  });

  it('E4 with Guide switched on the guide and stop sentences are spoken; with it off they are not (50.1)', async () => {
    await withExplore({ scene: triangle, guide: true }, (rig) => {
      rig.clearCalls();
      press(rig);
      expect(helpSpy).toHaveBeenCalledWith(expect.objectContaining({ guideOn: true }));
      expectOneUtterance(rig, expectedSentences({ raw: false, guideOn: true, askOn: true }));
    });
    await withExplore({ scene: triangle, guide: false }, (rig) => {
      rig.clearCalls();
      press(rig);
      expect(helpSpy).toHaveBeenLastCalledWith(expect.objectContaining({ guideOn: false }));
      const text = rig.spoken().join(' ');
      expect(text).not.toContain(tables.en['help.guide'] ?? '\u0000');
    });
  });

  it('E5 Help is an explicit request: it speaks with a finger down and adds no vibration, tone or Guide (50.5, 50.6)', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.down(100, 340); // corner C
      rig.advance(600);
      rig.clearCalls();
      press(rig);
      expect(rig.spoken()).toHaveLength(1);
      expect(rig.vibrations()).toEqual([]);
      expect(rig.tones()).toEqual([]);
      expect(rig.container.querySelector('.gt-explore--guiding')).toBeNull();
    });
  });
});
