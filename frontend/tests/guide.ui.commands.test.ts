import { describe, expect, it } from 'vitest';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  executeExploreCommand,
  findElementByLabelOrId,
  parseExploreCommand,
  type ExploreCommandContext,
} from '../src/flow/commands';

const testScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right-Angled Triangle ABC',
  points: [
    { id: 'p1', label: 'A', x: 0.2, y: 0.2 },
    { id: 'p2', label: 'B', x: 0.8, y: 0.8 },
    { id: 'p3', label: 'C', x: 0.2, y: 0.8 },
  ],
  segments: [
    { id: 's1', a: 'p1', b: 'p2', label: 'hypotenuse' },
    { id: 's2', a: 'p2', b: 'p3', label: 'base' },
    { id: 's3', a: 'p3', b: 'p1', label: 'height' },
  ],
  bars: [
    { id: 'b1', label: 'Math', value: 10, x0: 0.1, x1: 0.3, y_base: 0.9, y_top: 0.3 },
  ],
  polylines: [
    { id: 'pl1', label: 'Wave', points: [[0.1, 0.5], [0.5, 0.2], [0.9, 0.5]] },
  ],
  facts: ['AB = 10 cm', 'BC = 8 cm', 'AC = 6 cm'],
};

const defaultContext: ExploreCommandContext = {
  scene: testScene,
  view: makeViewport(300, 300),
  cursorNorm: { x: 0.2, y: 0.2 },
  lastSpoken: 'Point A',
  currentCornerIndex: 0,
  currentRate: 'normal',
  isGuiding: false,
  isGuideActive: false,
};

describe('Guide Voice Commands (en/hi/gu) and Flags', () => {
  describe('Flag off (isGuideActive = false) -> falls through to existing behaviour', () => {
    it('"take me to A" falls through to unknown when guide is inactive', () => {
      const parsed = parseExploreCommand('take me to A', false);
      expect(parsed.type).toBe('unknown');
    });

    it('"find A" falls through to unknown when guide is inactive', () => {
      const parsed = parseExploreCommand('find A', false);
      expect(parsed.type).toBe('unknown');
    });

    it('"stop" falls through to unknown when guide is inactive', () => {
      const parsed = parseExploreCommand('stop', false);
      expect(parsed.type).toBe('unknown');
    });

    it('"next corner" maintains original explore behaviour when guide is inactive', () => {
      const parsed = parseExploreCommand('next corner', false);
      expect(parsed.type).toBe('next_corner');
      const res = executeExploreCommand(parsed, defaultContext);
      expect(res.guideTarget).toBeUndefined();
      expect(res.nextCornerIndex).toBe(1);
      expect(res.speech).toContain('Corner 2 of 3');
      expect(res.speech).toContain('Point B');
    });
  });

  describe('Flag on (isGuideActive = true) -> parses guide commands in en, hi, gu', () => {
    describe('English commands', () => {
      it('parses "take me to <label>" and "find <label>"', () => {
        expect(parseExploreCommand('take me to A', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'a',
          raw: 'take me to A',
        });
        expect(parseExploreCommand('take me to point B', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'b',
          raw: 'take me to point B',
        });
        expect(parseExploreCommand('find C', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'c',
          raw: 'find C',
        });
        expect(parseExploreCommand('find hypotenuse', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'hypotenuse',
          raw: 'find hypotenuse',
        });
        expect(parseExploreCommand('guide me to A', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'a',
          raw: 'guide me to A',
        });
      });

      it('parses "stop"', () => {
        expect(parseExploreCommand('stop', true)).toEqual({
          type: 'stop',
          raw: 'stop',
        });
        expect(parseExploreCommand('stop guide', true)).toEqual({
          type: 'stop',
          raw: 'stop guide',
        });
        expect(parseExploreCommand('cancel guide', true)).toEqual({
          type: 'stop',
          raw: 'cancel guide',
        });
      });
    });

    describe('Hindi commands', () => {
      it('parses "मुझे A पर ले चलो" / "ले जाओ"', () => {
        expect(parseExploreCommand('मुझे A पर ले चलो', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'a',
          raw: 'मुझे A पर ले चलो',
        });
        expect(parseExploreCommand('मुझे बिंदु B पर ले जाओ', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'b',
          raw: 'मुझे बिंदु B पर ले जाओ',
        });
      });

      it('parses "A खोजें" / "ढूंढें"', () => {
        expect(parseExploreCommand('A खोजें', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'a',
          raw: 'A खोजें',
        });
        expect(parseExploreCommand('C ढूंढें', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'c',
          raw: 'C ढूंढें',
        });
      });

      it('parses "रुकें" / "रोको" / "गाइड रोको"', () => {
        expect(parseExploreCommand('रुकें', true)).toEqual({
          type: 'stop',
          raw: 'रुकें',
        });
        expect(parseExploreCommand('रोको', true)).toEqual({
          type: 'stop',
          raw: 'रोको',
        });
        expect(parseExploreCommand('गाइड रोको', true)).toEqual({
          type: 'stop',
          raw: 'गाइड रोको',
        });
      });
    });

    describe('Gujarati commands', () => {
      it('parses "મને A પર લઈ જાઓ"', () => {
        expect(parseExploreCommand('મને A પર લઈ જાઓ', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'a',
          raw: 'મને A પર લઈ જાઓ',
        });
        expect(parseExploreCommand('મને બિંદુ B પર લઈ જાઓ', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'b',
          raw: 'મને બિંદુ B પર લઈ જાઓ',
        });
      });

      it('parses "A શોધો"', () => {
        expect(parseExploreCommand('A શોધો', true)).toEqual({
          type: 'guide_to',
          targetLabel: 'a',
          raw: 'A શોધો',
        });
      });

      it('parses "ઊભા રહો" / "રોકો" / "ગાઇડ બંધ કરો"', () => {
        expect(parseExploreCommand('ઊભા રહો', true)).toEqual({
          type: 'stop',
          raw: 'ઊભા રહો',
        });
        expect(parseExploreCommand('રોકો', true)).toEqual({
          type: 'stop',
          raw: 'રોકો',
        });
        expect(parseExploreCommand('ગાઇડ બંધ કરો', true)).toEqual({
          type: 'stop',
          raw: 'ગાઇડ બંધ કરો',
        });
      });
    });
  });

  describe('executeExploreCommand with guide targets', () => {
    const guideActiveContext: ExploreCommandContext = {
      ...defaultContext,
      isGuideActive: true,
      isGuiding: false,
    };

    it('resolves point target and starts guide', () => {
      const cmd = parseExploreCommand('take me to A', true);
      const res = executeExploreCommand(cmd, guideActiveContext);
      expect(res.guideTarget).toBeDefined();
      expect(res.guideTarget?.label).toBe('A');
      expect(res.guideTarget?.x).toBe(0.2);
      expect(res.guideTarget?.y).toBe(0.2);
      expect(res.speech).toContain('A');
      expect(res.earcon).toBe('success');
    });

    it('resolves segment target midpoint and starts guide', () => {
      const cmd = parseExploreCommand('find hypotenuse', true);
      const res = executeExploreCommand(cmd, guideActiveContext);
      expect(res.guideTarget).toBeDefined();
      expect(res.guideTarget?.label).toBe('hypotenuse');
      expect(res.guideTarget?.x).toBeCloseTo((0.2 + 0.8) / 2);
      expect(res.guideTarget?.y).toBeCloseTo((0.2 + 0.8) / 2);
    });

    it('resolves bar centre target and starts guide', () => {
      const cmd = parseExploreCommand('find Math', true);
      const res = executeExploreCommand(cmd, guideActiveContext);
      expect(res.guideTarget).toBeDefined();
      expect(res.guideTarget?.label).toBe('Math');
      expect(res.guideTarget?.x).toBeCloseTo((0.1 + 0.3) / 2);
      expect(res.guideTarget?.y).toBeCloseTo((0.9 + 0.3) / 2);
    });

    it('speaks error when target label is not found', () => {
      const cmd = parseExploreCommand('find Nonexistent', true);
      const res = executeExploreCommand(cmd, guideActiveContext);
      expect(res.guideTarget).toBeUndefined();
      expect(res.speech.toLowerCase()).toContain('nonexistent');
      expect(res.earcon).toBe('error');
    });

    it('"next corner" when guide is active starts guide to next corner', () => {
      const cmd = parseExploreCommand('next corner', true);
      const res = executeExploreCommand(cmd, guideActiveContext);
      expect(res.guideTarget).toBeDefined();
      expect(res.guideTarget?.label).toBe('B');
      expect(res.nextCornerIndex).toBe(1);
      expect(res.earcon).toBe('success');
    });

    it('"stop" when guiding requests stop', () => {
      const guidingContext: ExploreCommandContext = {
        ...guideActiveContext,
        isGuiding: true,
      };
      const cmd = parseExploreCommand('stop', true);
      const res = executeExploreCommand(cmd, guidingContext);
      expect(res.stopGuide).toBe(true);
      expect(res.speech).toBe('Guide stopped.');
      expect(res.earcon).toBe('back');
    });

    it('"stop" when not guiding indicates not guiding', () => {
      const cmd = parseExploreCommand('stop', true);
      const res = executeExploreCommand(cmd, guideActiveContext);
      expect(res.stopGuide).toBeUndefined();
      expect(res.speech).toBe('Not currently guiding.');
    });
  });

  describe('findElementByLabelOrId', () => {
    it('finds element by exact or case-insensitive label or id', () => {
      expect(findElementByLabelOrId(testScene, 'A')?.id).toBe('p1');
      expect(findElementByLabelOrId(testScene, 'point a')?.id).toBe('p1');
      expect(findElementByLabelOrId(testScene, 'p2')?.id).toBe('p2');
      expect(findElementByLabelOrId(testScene, 'hypotenuse')?.id).toBe('s1');
      expect(findElementByLabelOrId(testScene, 'Math')?.id).toBe('b1');
      expect(findElementByLabelOrId(testScene, 'Wave')?.id).toBe('pl1');
      expect(findElementByLabelOrId(testScene, 'Z')).toBeNull();
    });
  });
});
