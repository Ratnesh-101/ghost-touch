import { describe, expect, it } from 'vitest';
import { WALK_KEYS, type WalkLine } from '../src/core/walk';
import { parseExploreCommand } from '../src/flow/commands';
import { walkLineText, walkPhrases } from '../src/flow/walk';
import { setLang, tables } from '../src/i18n';

const FORBIDDEN = /verified|correct|checked|approved/i;

const placeholders = (s: string): string =>
  [...s.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',');

describe('Planchette flow and i18n (task 85, lane hi10)', () => {
  describe('WALK_KEYS completeness, honesty and translations across en, hi, gu', () => {
    it('every WALK_KEYS key resolves in all three languages with the same placeholders', () => {
      const problems: string[] = [];
      for (const key of WALK_KEYS) {
        const enVal = tables.en[key];
        if (typeof enVal !== 'string' || enVal.trim() === '') {
          problems.push(`${key}: missing or blank in en`);
          continue;
        }
        for (const lang of ['hi', 'gu'] as const) {
          const langVal = tables[lang][key];
          if (typeof langVal !== 'string' || langVal.trim() === '') {
            problems.push(`${key}: missing or blank in ${lang}`);
          } else {
            const langPlaceholders = placeholders(langVal);
            const enPlaceholders = placeholders(enVal);
            if (langPlaceholders !== enPlaceholders) {
              problems.push(
                `${key}: placeholders in ${lang} (${langPlaceholders}) differ from en (${enPlaceholders})`,
              );
            }
          }
        }
      }
      expect(problems).toEqual([]);
    });

    it('hi and gu translations differ from English', () => {
      const problems: string[] = [];
      for (const key of WALK_KEYS) {
        const enVal = tables.en[key];
        for (const lang of ['hi', 'gu'] as const) {
          const langVal = tables[lang][key];
          if (langVal === enVal) {
            problems.push(`${key}: ${lang} equals English`);
          }
        }
      }
      expect(problems).toEqual([]);
    });

    it('none contains banned verification/correctness words', () => {
      const problems: string[] = [];
      for (const key of WALK_KEYS) {
        for (const lang of ['en', 'hi', 'gu'] as const) {
          const val = tables[lang][key];
          if (typeof val === 'string' && FORBIDDEN.test(val)) {
            problems.push(`${key}: ${lang} contains forbidden word (${val})`);
          }
        }
      }
      expect(problems).toEqual([]);
    });
  });

  describe('walkLineText formatting', () => {
    it('walkLineText for a Pythagoras and a bar line gives the expected English sentence', () => {
      setLang('en');

      // Pythagoras leg with unit
      const legLine: WalkLine = {
        key: 'walk.pyth.leg',
        params: { name: 'CA', value: 3, unit: 'cm' },
      };
      expect(walkLineText(legLine)).toBe('Side CA is 3 centimetres.');

      // Pythagoras leg without unit
      const legNoUnit: WalkLine = {
        key: 'walk.pyth.leg',
        params: { name: 'CA', value: 3, unit: '' },
      };
      expect(walkLineText(legNoUnit)).toBe('Side CA is 3.');

      // Pythagoras right angle from facts
      const rightFactLine: WalkLine = {
        key: 'walk.pyth.rightFact',
        params: { name: 'C' },
      };
      expect(walkLineText(rightFactLine)).toBe('Corner C is a right angle, as the facts say.');

      // Pythagoras right angle from drawing
      const rightDrawnLine: WalkLine = {
        key: 'walk.pyth.rightDrawn',
        params: { name: 'C' },
      };
      expect(walkLineText(rightDrawnLine)).toBe('Corner C looks like a right angle in the drawing.');

      // Pythagoras hypotenuse
      const hypLine: WalkLine = {
        key: 'walk.pyth.hyp',
        params: {
          name: 'AB',
          aName: 'CA',
          bName: 'BC',
          a: 3,
          b: 4,
          aSq: 9,
          bSq: 16,
          sum: 25,
          c: 5,
          unit: 'cm',
        },
      };
      expect(walkLineText(hypLine)).toBe(
        'Side AB is across from the right angle. 3 squared is 9. 4 squared is 16. Together that is 25, and the square root of 25 is 5. So side AB is 5 centimetres.',
      );

      // Bar high
      const barHighLine: WalkLine = {
        key: 'walk.bar.high',
        params: { label: 'Q4', value: 22 },
      };
      expect(walkLineText(barHighLine)).toBe('Q4 is 22.');

      // Bar difference
      const barDiffLine: WalkLine = {
        key: 'walk.bar.diff',
        params: {
          high: 'Q4',
          low: 'Q1',
          highValue: 22,
          lowValue: 10,
          diff: 12,
        },
      };
      expect(walkLineText(barDiffLine)).toBe(
        'Q1 is 10. 22 minus 10 is 12. So Q4 is 12 more than Q1.',
      );
    });

    it('walkPhrases returns non-empty start and next lists with phrases at most 3 words', () => {
      const phrases = walkPhrases();
      expect(phrases.start.length).toBeGreaterThan(0);
      expect(phrases.next.length).toBeGreaterThan(0);
      expect(phrases.start).toContain('Walk me through');
      expect(phrases.next).toContain('Next step');

      for (const p of [...phrases.start, ...phrases.next]) {
        expect(p.trim().split(/\s+/).length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('parseExploreCommand walk integrations', () => {
    it('"walk me through" starts a walk', () => {
      expect(parseExploreCommand('walk me through').type).toBe('walk_start');
      expect(parseExploreCommand('Walk me through.').type).toBe('walk_start');
      expect(parseExploreCommand('  WALK  ME  THROUGH! ').type).toBe('walk_start');
      expect(parseExploreCommand('मुझे समझाएं').type).toBe('walk_start');
      expect(parseExploreCommand('મને સમજાવો').type).toBe('walk_start');
    });

    it('"next step" is walk_next', () => {
      expect(parseExploreCommand('next step').type).toBe('walk_next');
      expect(parseExploreCommand('Next step.').type).toBe('walk_next');
      expect(parseExploreCommand('NEXT STEP!').type).toBe('walk_next');
      expect(parseExploreCommand('अगला कदम').type).toBe('walk_next');
      expect(parseExploreCommand('આગળનું પગલું').type).toBe('walk_next');
    });

    it('"next" alone is still next_corner', () => {
      expect(parseExploreCommand('next').type).toBe('next_corner');
      expect(parseExploreCommand('next corner').type).toBe('next_corner');
    });

    it('a 6-word sentence containing "walk me through" is NOT a command', () => {
      const sentence = 'can you walk me through this';
      expect(sentence.split(' ').length).toBe(6);
      expect(parseExploreCommand(sentence).type).not.toBe('walk_start');
      expect(parseExploreCommand(sentence).type).not.toBe('walk_next');
      expect(parseExploreCommand(sentence).type).toBe('unknown');
    });

    it('stop ends an active walk', () => {
      // With walk active: stop commands end the walk
      expect(parseExploreCommand('stop', { isWalkActive: true }).type).toBe('stop');
      expect(parseExploreCommand('रुकें', { isWalkActive: true }).type).toBe('stop');
      expect(parseExploreCommand('રોકો', { isWalkActive: true }).type).toBe('stop');
      expect(parseExploreCommand('stop guide', { isWalkActive: true }).type).toBe('stop');

      // Without walk active and without guide: "stop" is unknown
      expect(parseExploreCommand('stop', { isWalkActive: false }).type).toBe('unknown');
      expect(parseExploreCommand('stop', false).type).toBe('unknown');
      expect(parseExploreCommand('stop').type).toBe('unknown');

      // With guide active: "stop" is still stop
      expect(parseExploreCommand('stop', true).type).toBe('stop');
      expect(parseExploreCommand('stop', { isGuideActive: true }).type).toBe('stop');
    });
  });
});
