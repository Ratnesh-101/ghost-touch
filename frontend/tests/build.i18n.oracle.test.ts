/**
 * P181 - the Build strings are complete and honest (Requirement 52.14, 52.15, task 86). Kiro.
 *
 * `it.fails` until lane C-wire adds the `build.*` keys; that lane removes `.fails`. The control
 * below passes today: the list of keys names the work-summary keys the core already emits.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BUILD_WORK_KEYS } from '../src/core/pegboard';
import { tables, tf } from '../src/i18n';
import { BUILD_I18N_KEYS } from './support/buildKeys';
import { runs } from './support/runs';

const LANGS = ['en', 'hi', 'gu'] as const;
type Lang = (typeof LANGS)[number];

const BANNED = /verified|correct|approved|सत्यापित|પ્રમાણિત/i;
const NOT_CHECKED: Record<Lang, string> = { en: 'not checked', hi: 'जाँचा नहीं गया', gu: 'ચકાસાયેલ નથી' };

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();
}

function check(lang: Lang, key: string): void {
  const value = tables[lang][key];
  expect(typeof value, `${lang} ${key} exists`).toBe('string');
  const text = value ?? '';
  expect(text.trim(), `${lang} ${key} not blank`).not.toBe('');
  if (lang !== 'en') expect(text, `${lang} ${key} differs from English`).not.toBe(tables.en[key]);
  expect(placeholders(text), `${lang} ${key} placeholders`).toEqual(placeholders(tables.en[key] ?? ''));
  expect(BANNED.test(text), `${lang} ${key} claims a check`).toBe(false);
  if (key.startsWith('build.handin.') && (key.endsWith('madeBy') || key.endsWith('notChecked'))) {
    expect(text.toLowerCase(), `${lang} ${key} says not checked`).toContain(NOT_CHECKED[lang].toLowerCase());
  } else {
    expect(/checked|जाँचा|ચકાસા/i.test(text), `${lang} ${key} mentions checking outside the hand-in`).toBe(false);
  }
  expect(tf(key, {}).length).toBeGreaterThan(0);
}

describe('P181 control: the key list covers what the core emits', () => {
  it('every work-summary key from core/pegboard.ts is in the list', () => {
    for (const k of BUILD_WORK_KEYS) expect(BUILD_I18N_KEYS).toContain(k);
    expect(new Set(BUILD_I18N_KEYS).size).toBe(BUILD_I18N_KEYS.length);
    for (const k of BUILD_I18N_KEYS) expect(k.startsWith('build.')).toBe(true);
  });
});

describe('P181 the Build strings are complete and honest (it.fails until lane C-wire)', () => {
  it('every key exists in en, hi and gu, differs from English, keeps its placeholders, makes no claim of checking', () => {
    for (const lang of LANGS) for (const key of BUILD_I18N_KEYS) check(lang, key);
    fc.assert(
      fc.property(fc.constantFrom(...LANGS), fc.constantFrom(...BUILD_I18N_KEYS), (lang, key) => {
        check(lang, key);
      }),
      { numRuns: runs(200) },
    );
  });
});
