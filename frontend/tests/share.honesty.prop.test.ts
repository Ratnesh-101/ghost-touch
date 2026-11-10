/**
 * Honesty of the share strings (Requirement 22.12). Properties P77-P78 (Kiro, task 38).
 *
 * A shared link is not checked by anyone, so no `share.` string may claim otherwise (audit R5-02,
 * rule R1: "Never say Verified for link content"). The rule is stricter than the audit's own
 * suggested wording: a negation such as "has not verified it" or "सत्यापित नहीं" also fails.
 * The only wording the rule leaves is the existing "not checked" strings, which use other words,
 * so no exemption list is needed. P78 pins that those strings stay.
 *
 * Written while lane p3 was believed unmerged; it had already merged (main at 2d108ca) when this
 * first ran, and P77 still fails (docs/reviews/kiro-round5.md). Do not skip or weaken it.
 *
 * Every (language, key) pair is also passed as an explicit example, so the check is exhaustive and
 * does not depend on the random draw reaching a pair.
 */
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { tables, type Lang } from '../src/i18n';

const LANGS: readonly Lang[] = ['en', 'hi', 'gu'];

const SHARE_KEYS: readonly string[] = [
  ...new Set(
    LANGS.flatMap((lang) => Object.keys(tables[lang]).filter((key) => key.startsWith('share.'))),
  ),
].sort();

const PAIRS = LANGS.flatMap((lang) => SHARE_KEYS.map((key) => [lang, key] as const));

/** What `t()` would return: the language's string, else the English one. */
function effective(lang: Lang, key: string): string {
  return tables[lang][key] ?? tables.en[key] ?? '';
}

const BANNED = /verified|सत्यापित|પ્રમાણિત/i;

describe('share strings are honest (Requirement 22.12)', () => {
  it('P77: no share. string contains "verified", "सत्यापित" or "પ્રમાણિત"', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PAIRS), ([lang, key]) => {
        const text = effective(lang, key);
        const hit = BANNED.exec(text);
        if (hit !== null) {
          throw new Error(`[${lang}] ${key} = ${JSON.stringify(text)} contains ${JSON.stringify(hit[0])}`);
        }
      }),
      { numRuns: 300, examples: PAIRS.map((pair): [typeof pair] => [pair]) },
    );
  });

  it('P78: share.sharedBy and share.sharedUnnamed still say "not checked" in every language', () => {
    const NOT_CHECKED: Record<Lang, RegExp> = {
      en: /not checked/i,
      hi: /जाँचा नहीं गया/,
      gu: /ચકાસાયેલ નથી/,
    };
    const keys = ['share.sharedBy', 'share.sharedUnnamed'] as const;
    const pairs = LANGS.flatMap((lang) => keys.map((key) => [lang, key] as const));
    fc.assert(
      fc.property(fc.constantFrom(...pairs), ([lang, key]) => {
        const text = tables[lang][key];
        if (text === undefined) {
          throw new Error(`[${lang}] ${key} is missing`);
        }
        if (!NOT_CHECKED[lang].test(text)) {
          throw new Error(`[${lang}] ${key} = ${JSON.stringify(text)} no longer says "not checked"`);
        }
        if (key === 'share.sharedBy' && !text.includes('{name}')) {
          throw new Error(`[${lang}] ${key} = ${JSON.stringify(text)} lost its {name} placeholder`);
        }
      }),
      { numRuns: 200, examples: pairs.map((pair): [typeof pair] => [pair]) },
    );
  });
});
