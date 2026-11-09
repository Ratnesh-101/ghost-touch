/**
 * M4-10 (Kiro, task 35, Requirement 18.2): a disputed angle is named in the active language.
 * English keeps "angle C"; Hindi and Gujarati use their own word, on scene entry and in Ask.
 */
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { localizedFindingTarget, verifyScene, type VerifyFinding } from '../src/core/verify';
import { caveatForQuestion } from '../src/flow/ask';
import { spokenAngleName, verifyCaveatForScene } from '../src/flow/navigation';
import { getLang, setLang, type Lang } from '../src/i18n';

const startLang: Lang = getLang();
afterEach(() => setLang(startLang));

/** Right triangle at C, drawn honestly, except the printed angle at C says 45 degrees. */
const forgedAngle: DiagramScene = {
  version: 1,
  kind: 'geometry',
  points: [
    { id: 'A', x: 0.25, y: 0.25, label: 'A' },
    { id: 'B', x: 0.7, y: 0.85, label: 'B' },
    { id: 'C', x: 0.25, y: 0.85, label: 'C' },
  ],
  segments: [
    { id: 'CA', a: 'C', b: 'A' },
    { id: 'AB', a: 'A', b: 'B' },
    { id: 'BC', a: 'B', b: 'C' },
  ],
  facts: ['angle C = 45 degrees', 'AC = 4 cm', 'BC = 3 cm', 'AB = 5 cm'],
};

const EXPECTED: Record<Lang, string> = {
  en: "Facts and drawing disagree on angle C. I can't tell which is right.",
  hi: 'तथ्य और चित्र कोण C पर असहमत हैं। मैं नहीं बता सकता कि कौन सा सही है।',
  gu: 'તથ્યો અને આકૃતિ ખૂણા C પર અસંમત છે. હું કહી શકતો નથી કે કયું સાચું છે.',
};

describe('M4-10: the angle word follows the language', () => {
  for (const lang of ['en', 'hi', 'gu'] as const) {
    it(`entry caveat and Ask caveat in ${lang}`, () => {
      setLang(lang);
      expect(verifyCaveatForScene(forgedAngle, 'ai')).toBe(EXPECTED[lang]);
      const { findings } = verifyScene(forgedAngle, { mode: 'ai' });
      for (const q of ['What is angle C?', 'कोण C कितना है?', 'ખૂણો C કેટલો છે?', 'C?']) {
        expect(caveatForQuestion(findings, q)).toBe(EXPECTED[lang]);
      }
      if (lang !== 'en') expect(EXPECTED[lang]).not.toMatch(/angle/i);
    });
  }

  it('length findings are named exactly as before in every language', () => {
    const finding: VerifyFinding = {
      segmentId: 'CA',
      message: "Facts and drawing disagree on AC. I can't tell which is right.",
    };
    for (const lang of ['en', 'hi', 'gu'] as const) {
      setLang(lang);
      expect(localizedFindingTarget(finding, spokenAngleName)).toBe('AC');
    }
  });

  it('any vertex name is passed through unchanged and the English word never leaks (200 runs)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9]{1,3}$/),
        fc.constantFrom<Lang>('en', 'hi', 'gu'),
        (vertex, lang) => {
          setLang(lang);
          const finding: VerifyFinding = {
            message: `Facts and drawing disagree on angle ${vertex}. I can't tell which is right.`,
            angleVertex: vertex,
          };
          const name = localizedFindingTarget(finding, spokenAngleName);
          expect(name.endsWith(` ${vertex}`)).toBe(true);
          if (lang === 'en') expect(name).toBe(`angle ${vertex}`);
          else expect(name.slice(0, -vertex.length - 1)).not.toMatch(/angle/i);
        },
      ),
      { numRuns: 200 },
    );
  });
});
