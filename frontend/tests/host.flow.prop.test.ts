/**
 * P199 (Requirement 53.6, 53.15c, task 93): the per-flow failure tracker in `flow/host.ts` follows
 * the policy at runtime. Whatever sequence of failures, successes and leaves a flow sees:
 * - from the second failure in a row the line is the plain part only;
 * - a joke is never used on a protected (jokeless) line, and never outside English;
 * - two jokes are at least `JOKE_GAP_LINES` error lines apart and the same joke never repeats
 *   back to back;
 * - every line starts with its plain wording and the joke, when present, comes last.
 */
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { JOKE_GAP_LINES, lintHostLine } from '../src/core/hostPolicy';
import { createHostFlow, hostFlows, resetHostFlows } from '../src/flow/host';
import { englishOnly, getLang, setLang, t, tables, type Lang } from '../src/i18n';

const JOKE_KEYS = [
  'ask.errorNoSpeech',
  'ask.errorTimeout',
  'ask.errorBusy',
  'ask.errorServer',
  'ask.errorBadResponse',
  'capture.error',
  'capture.errorBusy',
  'capture.errorGateway',
  'capture.errorTimeout',
  'capture.errorServer',
];
const JOKELESS_KEYS = ['ask.errorDenied', 'ask.errorUnsupported'];

type Op =
  | { readonly op: 'fail'; readonly key: string; readonly jokeless: boolean }
  | { readonly op: 'success' }
  | { readonly op: 'leave' };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 6, arbitrary: fc
      .tuple(fc.constantFrom(...JOKE_KEYS), fc.boolean())
      .map(([key, jokeless]): Op => ({ op: 'fail', key, jokeless })) },
  { weight: 1, arbitrary: fc.constantFrom(...JOKELESS_KEYS).map((key): Op => ({ op: 'fail', key, jokeless: true })) },
  { weight: 1, arbitrary: fc.constant<Op>({ op: 'success' }) },
  { weight: 1, arbitrary: fc.constant<Op>({ op: 'leave' }) },
);

const startLang = getLang();
afterEach(() => {
  setLang(startLang);
  resetHostFlows();
});

describe('P199 the host flow tracker follows the policy at runtime', () => {
  it('holds the joke rules for any sequence of failures, successes and leaves (en)', () => {
    setLang('en');
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 1, maxLength: 40 }), (ops) => {
        const flow = createHostFlow();
        let consecutive = 0;
        let calls = 0;
        let lastJokeCall = -Infinity;
        let lastJoke: string | null = null;
        for (const o of ops) {
          if (o.op === 'success') {
            flow.success();
            consecutive = 0;
            continue;
          }
          if (o.op === 'leave') {
            flow.leave();
            consecutive = 0;
            continue;
          }
          calls += 1;
          consecutive += 1;
          const line = flow.errorLine(o.key, { jokeless: o.jokeless });
          const plain = t(o.key);
          expect(line.startsWith(plain)).toBe(true);
          const joke = englishOnly(`${o.key}.joke`);
          const hasJoke = line !== plain;
          if (hasJoke) {
            expect(joke).not.toBeNull();
            expect(line).toBe(`${plain} ${joke}`);
            expect(o.jokeless).toBe(false);
            expect(consecutive).toBeLessThan(2);
            expect(calls - lastJokeCall).toBeGreaterThan(JOKE_GAP_LINES - 1);
            expect(`${o.key}.joke`).not.toBe(lastJoke);
            lastJokeCall = calls;
            lastJoke = `${o.key}.joke`;
          }
        }
      }),
      { numRuns: 250 },
    );
  });

  it('never carries a joke in Hindi or Gujarati', () => {
    for (const lang of ['hi', 'gu'] as const satisfies readonly Lang[]) {
      setLang(lang);
      fc.assert(
        fc.property(fc.constantFrom(...JOKE_KEYS), (key) => {
          expect(createHostFlow().errorLine(key)).toBe(t(key));
        }),
        { numRuns: 200 },
      );
    }
  });

  it('the first failure of a fresh flow has its joke and the second does not', () => {
    setLang('en');
    const flow = createHostFlow();
    const first = flow.errorLine('ask.errorTimeout');
    const second = flow.errorLine('ask.errorTimeout');
    expect(first).toBe(`${t('ask.errorTimeout')} ${englishOnly('ask.errorTimeout.joke')}`);
    expect(second).toBe(t('ask.errorTimeout'));
  });

  it.each(['success', 'leave'] as const)(
    'a %s resets the count, so a later failure may joke again once the gap has passed',
    (how) => {
      setLang('en');
      const flow = createHostFlow();
      for (let i = 0; i < 4; i += 1) flow.errorLine('ask.errorTimeout');
      flow[how]();
      expect(flow.snapshot().failures).toBe(0);
      expect(flow.errorLine('ask.errorBusy')).toBe(
        `${t('ask.errorBusy')} ${englishOnly('ask.errorBusy.joke')}`,
      );
    },
  );
  it('never jokes on a line marked jokeless, even with a joke key on file', () => {
    setLang('en');
    expect(createHostFlow().errorLine('ask.errorTimeout', { jokeless: true })).toBe(t('ask.errorTimeout'));
  });

  it('keeps the three flows apart and resets them all', () => {
    setLang('en');
    hostFlows.capture.errorLine('capture.error');
    hostFlows.capture.errorLine('capture.error');
    expect(hostFlows.capture.snapshot().failures).toBe(2);
    expect(hostFlows.ask.snapshot().failures).toBe(0);
    resetHostFlows();
    expect(hostFlows.capture.snapshot().failures).toBe(0);
  });
});

describe('P199b every shipped joke clause obeys the policy', () => {
  // The English-only lines are not in the language tables, so they are read through englishOnly().
  const keys = [
    ...JOKE_KEYS,
    'ask.errorListenTimeout',
    'ask.errorOffline',
    'ask.errorFailed',
    'capture.errorOffline',
  ];

  it('each joke exists, is short, creature-only, lint-clean and has a plain key in all languages', () => {
    for (const key of keys) {
      const joke = englishOnly(`${key}.joke`);
      expect(joke, key).not.toBeNull();
      const text = joke ?? '';
      expect(text.trim().split(/\s+/u).length, key).toBeLessThanOrEqual(8);
      expect(text, key).not.toMatch(/\b(you|your|yours)\b/i);
      expect(lintHostLine(text, 'en').problems, key).toEqual([]);
      for (const lang of ['en', 'hi', 'gu'] as const) {
        expect(tables[lang][key], `${lang} ${key}`).toBeTruthy();
        expect(tables[lang][`${key}.joke`], `${lang} ${key}.joke is not in the tables`).toBeUndefined();
      }
    }
  });

  it('protected lines have no joke key', () => {
    for (const key of ['ask.errorDenied', 'ask.errorUnsupported', 'ask.errorEmpty']) {
      expect(englishOnly(`${key}.joke`), key).toBeNull();
    }
  });
});
