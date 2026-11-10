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

  // Tightened in task 39.4 (audit r5-kiro-glue LOW): the old version built the finding by hand, so
  // it never ran verifyScene. This one forges the printed angle at C, goes through the real check
  // and the real caveat, and compares with the sentences written out in EXPECTED above.
  it('a forged angle at C, in any wording and language, gives exactly the expected caveat (250 runs)', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: 0, max: 80 }), fc.integer({ min: 100, max: 180 })),
        fc.constantFrom(
          (v: number) => `angle C = ${v} degrees`,
          (v: number) => `angle at C is ${v}°`,
          (v: number) => `∠C = ${v}°`,
          (v: number) => `m∠C = ${v}°`,
        ),
        fc.constantFrom<Lang>('en', 'hi', 'gu'),
        (value, phrase, lang) => {
          setLang(lang);
          const scene: DiagramScene = { ...forgedAngle, facts: [phrase(value), 'AC = 4 cm', 'BC = 3 cm', 'AB = 5 cm'] };
          const { status, findings } = verifyScene(scene, { mode: 'ai' });
          expect(status).toBe('disagree');
          expect(findings.some((f) => f.angleVertex === 'C')).toBe(true);
          expect(verifyCaveatForScene(scene, 'ai')).toBe(EXPECTED[lang]);
        },
      ),
      { numRuns: 250 },
    );
  });
});
