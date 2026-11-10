/**
 * Task 39.3 (Kiro). P80: the angle wording does not depend on `angleVertex` (Requirement 23.5).
 * P81: facts in Hindi or Gujarati are ignored, never guessed (Requirement 18.10, a stated non-goal).
 */
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { localizedFindingTarget, verifyScene, type VerifyFinding } from '../src/core/verify';
import { spokenAngleName } from '../src/flow/navigation';
import { getLang, setLang, type Lang } from '../src/i18n';

const startLang: Lang = getLang();
afterEach(() => setLang(startLang));

/** The angle word per language, written out here so the test does not read the table it checks. */
const ANGLE_WORD: Record<Lang, string> = { en: 'angle', hi: 'कोण', gu: 'ખૂણા' };

describe('P80: a disputed angle is worded the same with or without angleVertex (23.5)', () => {
  it('for any vertex and language (250 runs)', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z][A-Z0-9]{0,2}$/), fc.constantFrom<Lang>('en', 'hi', 'gu'), fc.constantFrom('angle', 'Angle', 'ANGLE'), (vertex, lang, word) => {
        setLang(lang);
        const message = `Facts and drawing disagree on ${word} ${vertex}. I can't tell which is right.`;
        const withVertex: VerifyFinding = { message, angleVertex: vertex };
        const without: VerifyFinding = { message };
        const a = localizedFindingTarget(withVertex, spokenAngleName);
        const b = localizedFindingTarget(without, spokenAngleName);
        expect(b).toBe(a);
        expect(a).toBe(`${ANGLE_WORD[lang]} ${vertex}`);
        if (lang !== 'en') expect(b).not.toMatch(/angle/i);
      }),
      { numRuns: 250 },
    );
  });

  it('a side is still named as written', () => {
    const f: VerifyFinding = { segmentId: 'CA', message: "Facts and drawing disagree on AC. I can't tell which is right." };
    expect(localizedFindingTarget(f, spokenAngleName)).toBe('AC');
  });
});

/** A 3-4-5 right triangle drawn honestly; the facts below are what change. */
function triangle(facts: string[]): DiagramScene {
  return {
    version: 1,
    kind: 'geometry',
    points: [
      { id: 'A', x: 0.2, y: 0.2 },
      { id: 'B', x: 0.2, y: 0.8 },
      { id: 'C', x: 1.0, y: 0.8 },
    ],
    segments: [
      { id: 'AB', a: 'A', b: 'B' },
      { id: 'BC', a: 'B', b: 'C' },
      { id: 'CA', a: 'C', b: 'A' },
    ],
    facts,
  };
}

const HI = [
  (s: string, n: number) => `भुजा ${s} की लंबाई ${n} सेमी है`,
  (s: string, n: number) => `${s} की लंबाई ${n} सेंटीमीटर`,
  (v: string, n: number) => `कोण ${v[0]} ${n} अंश है`,
];
const GU = [
  (s: string, n: number) => `બાજુ ${s} ની લંબાઈ ${n} સેમી છે`,
  (s: string, n: number) => `${s} ની લંબાઈ ${n} સેન્ટીમીટર`,
  (v: string, n: number) => `ખૂણો ${v[0]} ${n} અંશ છે`,
];

describe('P81: Hindi and Gujarati facts are silent, never a disagreement (18.10)', () => {
  it('wildly wrong measurements written in hi or gu give silent (250 runs)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.constantFrom(...HI, ...GU), fc.constantFrom('AB', 'BC', 'CA'), fc.integer({ min: 1, max: 999 })),
          { minLength: 2, maxLength: 6 },
        ),
        fc.constantFrom('ai', 'sample', 'shared' as const),
        (facts, mode) => {
          const res = verifyScene(triangle(facts.map(([f, s, n]) => f(s, n))), { mode });
          expect(res.status).toBe('silent');
          expect(res.findings).toEqual([]);
        },
      ),
      { numRuns: 250 },
    );
  });

  it('the same wrong lengths in English are flagged, so the silence above is not a broken check', () => {
    const res = verifyScene(triangle(['AB = 3 cm', 'BC = 4 cm', 'CA = 50 cm']), { mode: 'ai' });
    expect(res.status).toBe('disagree');
  });
});
