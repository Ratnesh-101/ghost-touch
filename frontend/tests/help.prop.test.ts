/**
 * P155-P158 (Requirement 50, task 80.2): `helpSentences` and the Help strings.
 * P158 is `it.fails` until the string lane (task 81.2) adds the keys; that lane removes `.fails`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  HELP_BUTTON_KEY,
  HELP_I18N_KEYS,
  HELP_KEYS,
  helpSentences,
  type HelpContext,
  type HelpKey,
} from '../src/core/help';
import { tables, tf } from '../src/i18n';
import { runs } from './support/runs';

const ctxArb: fc.Arbitrary<HelpContext> = fc.record({ raw: fc.boolean(), guideOn: fc.boolean(), askOn: fc.boolean() });
const junkField = fc.oneof(fc.boolean(), fc.constant(undefined), fc.constant(null), fc.constant('true'), fc.constant(1), fc.constant({}), fc.constant([true]));
const junkCtx = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.string(),
  fc.record({ raw: junkField, guideOn: junkField, askOn: junkField }, { requiredKeys: [] }),
  fc.anything(),
);

const asCtx = (v: unknown): HelpContext => v as HelpContext;
const set = (keys: readonly string[]): Set<string> => new Set(keys);

describe('P155 keys come only from the declared list, in order, never empty', () => {
  it('holds for any context, junk included', () => {
    fc.assert(
      fc.property(fc.oneof(ctxArb, junkCtx), (ctx) => {
        const r = helpSentences(asCtx(ctx));
        expect(new Set(r).size).toBe(r.length);
        expect(r.length).toBeGreaterThan(0);
        expect(r.slice(0, 2)).toEqual(['help.touch', 'help.back']);
        expect(r.every((k) => (HELP_KEYS as readonly string[]).includes(k))).toBe(true);
        expect(r).toEqual(HELP_KEYS.filter((k) => r.includes(k)));
      }),
      { numRuns: runs(300) },
    );
  });
});

describe('P156 each flag adds exactly its keys', () => {
  const owned: Record<keyof HelpContext, HelpKey[]> = {
    raw: ['help.raw'],
    guideOn: ['help.guide', 'help.stop'],
    askOn: ['help.ask'],
  };
  for (const flag of ['raw', 'guideOn', 'askOn'] as const) {
    it(`flipping ${flag} changes only ${owned[flag].join(' and ')}`, () => {
      fc.assert(
        fc.property(ctxArb, (ctx) => {
          const a = set(helpSentences({ ...ctx, [flag]: false }));
          const b = set(helpSentences({ ...ctx, [flag]: true }));
          expect([...b].filter((k) => !a.has(k)).sort()).toEqual([...owned[flag]].sort());
          expect([...a].filter((k) => !b.has(k))).toEqual([]);
        }),
        { numRuns: runs(300) },
      );
    });
  }

  it('examples: nothing on, and everything on', () => {
    expect(helpSentences({ raw: false, guideOn: false, askOn: false })).toEqual(['help.touch', 'help.back']);
    expect(helpSentences({ raw: true, guideOn: true, askOn: true })).toEqual([...HELP_KEYS]);
  });
});

describe('P157 pure, stable and total', () => {
  it('gives equal fresh arrays, does not mutate a frozen context, and reads junk as off', () => {
    fc.assert(
      fc.property(ctxArb, (ctx) => {
        const frozen = Object.freeze({ ...ctx });
        const a = helpSentences(frozen);
        const b = helpSentences(frozen);
        expect(a).toEqual(b);
        expect(a).not.toBe(b);
        expect(frozen).toEqual(ctx);
      }),
      { numRuns: runs(300) },
    );
    fc.assert(
      fc.property(junkCtx, (ctx) => {
        const r = helpSentences(asCtx(ctx));
        const o = ctx as Record<string, unknown> | null;
        const isOn = (f: string): boolean =>
          typeof o === 'object' && o !== null && !Array.isArray(o) && o[f] === true;
        expect(r.includes('help.raw')).toBe(isOn('raw'));
        expect(r.includes('help.ask')).toBe(isOn('askOn'));
        expect(r.includes('help.guide')).toBe(isOn('guideOn'));
        expect(r.includes('help.stop')).toBe(isOn('guideOn'));
      }),
      { numRuns: runs(300) },
    );
  });

  it("the string 'true' and the number 1 are off", () => {
    expect(helpSentences(asCtx({ raw: 'true', guideOn: 1, askOn: 'yes' }))).toEqual(['help.touch', 'help.back']);
  });
});

describe('P158 the Help strings are complete and honest (it.fails until task 81.2)', () => {
  const LANGS = ['en', 'hi', 'gu'] as const;
  const BANNED = /verified|correct|checked|approved/i;

  function check(lang: (typeof LANGS)[number], key: string): void {
    const value = tables[lang][key];
    expect(typeof value, `${lang} ${key} exists`).toBe('string');
    expect((value ?? '').trim(), `${lang} ${key} not blank`).not.toBe('');
    if (lang !== 'en') expect(value, `${lang} ${key} differs from English`).not.toBe(tables.en[key]);
    expect(BANNED.test(value ?? ''), `${lang} ${key} claims a check`).toBe(false);
    expect(tf(key, {}).length).toBeGreaterThan(0);
  }

  it('every key exists in en, hi and gu, is not blank, differs from English, makes no claim of checking', () => {
    expect(HELP_I18N_KEYS).toContain(HELP_BUTTON_KEY);
    for (const lang of LANGS) for (const key of HELP_I18N_KEYS) check(lang, key);
    fc.assert(
      fc.property(fc.constantFrom(...LANGS), fc.constantFrom(...HELP_I18N_KEYS), (lang, key) => {
        check(lang, key);
      }),
      { numRuns: runs(200) },
    );
  });
});
