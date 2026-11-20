// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { setLang, tables } from '../src/i18n';
import { setupRigEnv, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;

function getHelpButton(rig: Rig): HTMLButtonElement {
  const b = rig.container.querySelector<HTMLButtonElement>('.gt-explore__help');
  if (!b) throw new Error('Help button (.gt-explore__help) not found');
  return b;
}

describe('Requirement 50: Explore Help Button unit tests (Lane hi4)', () => {
  beforeEach(() => {
    setupRigEnv();
    setLang('en');
  });
  afterEach(() => {
    setLang('en');
    teardownRigEnv();
  });

  it('renders Help button with accessible name and touch target styling', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      const b = getHelpButton(rig);
      expect(b.classList.contains('gt-control')).toBe(true);
      expect(b.classList.contains('gt-explore__help')).toBe(true);
      expect(b.getAttribute('aria-label')).toBe('Help');
      expect(b.textContent?.trim()).toBe('Help');
      expect(b.style.minWidth).toBe('48px');
      expect(b.style.minHeight).toBe('48px');
    });
  });

  it('reflects active language in accessible name and spoken output (Hindi)', async () => {
    setLang('hi');
    await withExplore({ scene: triangle }, (rig) => {
      const b = getHelpButton(rig);
      expect(b.getAttribute('aria-label')).toBe(tables.hi['explore.help']);
      rig.clearCalls();
      act(() => b.click());
      const spoken = rig.spoken();
      expect(spoken).toHaveLength(1);
      expect(spoken[0]).toContain(tables.hi['help.touch']);
      expect(spoken[0]).toContain(tables.hi['help.back']);
      expect(spoken[0]).toContain(tables.hi['help.ask']);
    });
  });

  it('reflects active language in accessible name and spoken output (Gujarati)', async () => {
    setLang('gu');
    await withExplore({ scene: triangle }, (rig) => {
      const b = getHelpButton(rig);
      expect(b.getAttribute('aria-label')).toBe(tables.gu['explore.help']);
      rig.clearCalls();
      act(() => b.click());
      const spoken = rig.spoken();
      expect(spoken).toHaveLength(1);
      expect(spoken[0]).toContain(tables.gu['help.touch']);
      expect(spoken[0]).toContain(tables.gu['help.back']);
      expect(spoken[0]).toContain(tables.gu['help.ask']);
    });
  });

  it('Help button is always visible whether Guide is on or off', async () => {
    await withExplore({ scene: triangle, guide: true }, (rig) => {
      expect(getHelpButton(rig)).not.toBeNull();
    });
    await withExplore({ scene: triangle, guide: false }, (rig) => {
      expect(getHelpButton(rig)).not.toBeNull();
    });
  });

  it('includes guide and stop sentences only when Guide is active', async () => {
    await withExplore({ scene: triangle, guide: true }, (rig) => {
      rig.clearCalls();
      act(() => getHelpButton(rig).click());
      const text = rig.spoken()[0] ?? '';
      expect(text).toContain(tables.en['help.guide']);
      expect(text).toContain(tables.en['help.stop']);
    });

    await withExplore({ scene: triangle, guide: false }, (rig) => {
      rig.clearCalls();
      act(() => getHelpButton(rig).click());
      const text = rig.spoken()[0] ?? '';
      expect(text).not.toContain(tables.en['help.guide']);
      expect(text).not.toContain(tables.en['help.stop']);
    });
  });

  it('includes raw sentence when isRaw is true', async () => {
    await withExplore({ scene: triangle, isRaw: true }, (rig) => {
      rig.clearCalls();
      act(() => getHelpButton(rig).click());
      const text = rig.spoken()[0] ?? '';
      expect(text).toContain(tables.en['help.raw']);
    });
  });

  it('works with a finger down without vibrations or tones', async () => {
    await withExplore({ scene: triangle }, (rig) => {
      rig.down(100, 340);
      rig.advance(300);
      rig.clearCalls();
      act(() => getHelpButton(rig).click());
      expect(rig.spoken()).toHaveLength(1);
      expect(rig.vibrations()).toEqual([]);
      expect(rig.tones()).toEqual([]);
    });
  });
});
