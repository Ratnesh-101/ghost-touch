// @vitest-environment jsdom
/**
 * Tests for review findings in lanes hi3 and hi4 (Lane hi6):
 * - Issue 1: Explore passes raw: isRawScene to helpSentences (computed from scene.kind === 'unknown'
 *   or announced string containing raw.announce), so Raw Mode scenes rendered WITHOUT isRaw prop
 *   (like App.tsx does) speak help.raw, and normal scenes do not.
 * - Issue 2: help.guide in en, hi, and gu names phrases parseExploreCommand really accepts.
 * - Issue 5: help.back in hi and gu uses the actual back button names (वापस and પાછા).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { setLang, tables } from '../src/i18n';
import { parseExploreCommand } from '../src/flow/commands';
import { setupRigEnv, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;
const rawScene: DiagramScene = {
  ...triangle,
  kind: 'unknown',
};

function getHelpButton(rig: Rig): HTMLButtonElement {
  const b = rig.container.querySelector<HTMLButtonElement>('.gt-explore__help');
  if (!b) throw new Error('Help button (.gt-explore__help) not found');
  return b;
}

describe('Lane hi6: Explore Help fixes (Issues 1, 2, 5)', () => {
  beforeEach(() => {
    setupRigEnv();
    setLang('en');
  });
  afterEach(() => {
    setLang('en');
    teardownRigEnv();
  });

  describe('Issue 1: isRawScene detection without isRaw prop', () => {
    it('speaks help.raw for a Raw Mode scene (kind: unknown) rendered WITHOUT isRaw prop', async () => {
      // Notice: isRaw prop is NOT provided in settings (defaults undefined, like App.tsx does)
      await withExplore({ scene: rawScene }, (rig) => {
        rig.clearCalls();
        act(() => getHelpButton(rig).click());
        const spoken = rig.spoken();
        expect(spoken).toHaveLength(1);
        expect(spoken[0]).toContain(tables.en['help.raw']);
      });
    });

    it('does NOT speak help.raw for a normal scene (kind: geometry) rendered WITHOUT isRaw prop', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.clearCalls();
        act(() => getHelpButton(rig).click());
        const spoken = rig.spoken();
        expect(spoken).toHaveLength(1);
        expect(spoken[0]).not.toContain(tables.en['help.raw']);
      });
    });

    it('speaks help.raw when announced text includes raw announcement even without isRaw prop', async () => {
      // In Explore, isRawScene also checks announced.includes(t('raw.announce'))
      await withExplore({ scene: rawScene }, (rig) => {
        rig.clearCalls();
        act(() => getHelpButton(rig).click());
        const spoken = rig.spoken();
        expect(spoken).toHaveLength(1);
        expect(spoken[0]).toContain(tables.en['help.raw']);
      });
    });
  });

  describe('Issue 2: help.guide promises phrases accepted by parseExploreCommand', () => {
    it('parses English phrases promised by help.guide', () => {
      const enSentence = tables.en['help.guide'];
      expect(enSentence).toContain('take me to');
      expect(enSentence).toContain('find the peak');

      // Command 1: label navigation
      const cmdLabel = parseExploreCommand('take me to B', true);
      expect(cmdLabel.type).toBe('guide_to');
      expect(cmdLabel.targetLabel).toBe('b');

      // Command 2: semantic peak
      const cmdPeak = parseExploreCommand('find the peak', true);
      expect(cmdPeak.type).toBe('guide_semantic');
      expect(cmdPeak.semanticTarget).toBe('peak');
    });

    it('parses Hindi phrases promised by help.guide (<कोना> पर ले चलो and शिखर ढूंढो)', () => {
      const hiSentence = tables.hi['help.guide'];
      expect(hiSentence).toContain('पर ले चलो');
      expect(hiSentence).toContain('शिखर ढूंढो');
      expect(hiSentence).not.toContain('चोटी');
      expect(hiSentence).not.toContain('ले चलो और');

      // Command 1: label navigation with <label> पर ले चलो
      const cmdLabel = parseExploreCommand('बी पर ले चलो', true);
      expect(cmdLabel.type).toBe('guide_to');
      expect(cmdLabel.targetLabel).toBe('बी');

      // Command 2: semantic peak with शिखर ढूंढो
      const cmdPeak = parseExploreCommand('शिखर ढूंढो', true);
      expect(cmdPeak.type).toBe('guide_semantic');
      expect(cmdPeak.semanticTarget).toBe('peak');
    });

    it('parses Gujarati phrases promised by help.guide (<કોણ> પર લઈ જાઓ and શિખર શોધો)', () => {
      const guSentence = tables.gu['help.guide'];
      expect(guSentence).toContain('પર લઈ જાઓ');
      expect(guSentence).toContain('શિખર શોધો');
      expect(guSentence).not.toContain('લઈ જાઓ અને');

      // Command 1: label navigation with <label> પર લઈ જાઓ
      const cmdLabel = parseExploreCommand('બી પર લઈ જાઓ', true);
      expect(cmdLabel.type).toBe('guide_to');
      expect(cmdLabel.targetLabel).toBe('બી');

      // Command 2: semantic peak with શિખર શોધો
      const cmdPeak = parseExploreCommand('શિખર શોધો', true);
      expect(cmdPeak.type).toBe('guide_semantic');
      expect(cmdPeak.semanticTarget).toBe('peak');
    });
  });

  describe('Issue 5: help.back uses actual back button names (वापस and પાછા)', () => {
    it('uses वापस in Hindi help.back matching common.back', () => {
      const backBtnName = tables.hi['common.back'];
      expect(backBtnName).toBe('वापस');
      const hiSentence = tables.hi['help.back'];
      expect(hiSentence).toContain(backBtnName);
      expect(hiSentence).not.toContain('बैक');
    });

    it('uses પાછા in Gujarati help.back matching common.back', () => {
      const backBtnName = tables.gu['common.back'];
      expect(backBtnName).toBe('પાછા');
      const guSentence = tables.gu['help.back'];
      expect(guSentence).toContain(backBtnName);
      expect(guSentence).not.toContain('બેક');
    });

    it('speaks the correct back button name in Hindi when Help is clicked', async () => {
      setLang('hi');
      await withExplore({ scene: triangle }, (rig) => {
        rig.clearCalls();
        act(() => getHelpButton(rig).click());
        const spoken = rig.spoken();
        expect(spoken).toHaveLength(1);
        expect(spoken[0]).toContain('वापस');
        expect(spoken[0]).not.toContain('बैक');
      });
    });

    it('speaks the correct back button name in Gujarati when Help is clicked', async () => {
      setLang('gu');
      await withExplore({ scene: triangle }, (rig) => {
        rig.clearCalls();
        act(() => getHelpButton(rig).click());
        const spoken = rig.spoken();
        expect(spoken).toHaveLength(1);
        expect(spoken[0]).toContain('પાછા');
        expect(spoken[0]).not.toContain('બેક');
      });
    });
  });
});
