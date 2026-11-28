/**
 * P188-P191, P197 (code half) and P198: Ghost Host policy (Requirement 53, task 92.3).
 * Oracles are written here, independent of the module: a reference flow machine for P189 and
 * explicit banned items for P191.
 *
 * Mutants checked by hand against core/hostPolicy.ts (each made a property fail, then reverted):
 *   M1 mayJoke ignores category (P188)         M2 mayJoke allows other languages (P188)
 *   M3 failures >= 2 changed to > 2 (P189)     M4 same-joke check removed (P189)
 *   M5 JOKE_GAP_LINES 3 -> 2 (P189)            M6 success does not reset failures (P189)
 *   M7 composeErrorLine returns the joke first (P190)
 *   M8 composeErrorLine returns joke when plain empty (P190)
 *   M9 lint drops the em dash from BANNED_CHARS (P191)
 *   M10 sentence limit 25 -> 26 (P191)         M11 'sorry' count check removed (P191)
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HAPTICS } from '../src/core/hapticEngine';
import { DEFAULT_RADII } from '../src/core/hitTest';
import {
  composeErrorLine,
  INITIAL_HOST_FLOW,
  lintHostLine,
  mayJoke,
  nextFlowState,
  type HostCategory,
  type HostEvent,
  type HostFlowState,
} from '../src/core/hostPolicy';
import { DEFAULT_PROXIMITY } from '../src/core/proximity';
import hostSource from '../src/core/hostPolicy.ts?raw';

const RUNS = { numRuns: 250 };
const CATEGORIES: HostCategory[] = [
  'greeting',
  'nextStep',
  'error',
  'permission',
  'confirm',
  'fact',
  'crash',
];
const PROTECTED: HostCategory[] = ['permission', 'confirm', 'fact', 'crash'];

const arbFlow = fc.record({
  failures: fc.integer({ min: 0, max: 6 }),
  lastJoke: fc.option(fc.constantFrom('a', 'b', 'c'), { nil: null }),
  linesSinceJoke: fc.integer({ min: 0, max: 8 }),
});
const arbJoke = fc.constantFrom('a', 'b', 'c', 'd');
const arbLang = fc.oneof(fc.constantFrom('en', 'hi', 'gu', 'fr', ''), fc.string());
const arbEvent: fc.Arbitrary<HostEvent> = fc.oneof(
  fc.constantFrom<HostEvent>({ kind: 'failure' }, { kind: 'success' }, { kind: 'leave' }),
  fc.constant<HostEvent>({ kind: 'line' }),
  arbJoke.map<HostEvent>((jokeId) => ({ kind: 'line', jokeId })),
);

describe('P188 jokes never in protected lines', () => {
  it('protected categories never joke', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PROTECTED),
        arbFlow,
        arbJoke,
        fc.constantFrom('en', 'hi'),
        (c, flow, id, lang) => {
          expect(mayJoke(c, flow, id, lang)).toBe(false);
        },
      ),
      RUNS,
    );
  });
  it('other languages never joke', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CATEGORIES),
        arbFlow,
        arbJoke,
        arbLang.filter((l) => l !== 'en'),
        (c, flow, id, lang) => {
          expect(mayJoke(c, flow, id, lang)).toBe(false);
        },
      ),
      RUNS,
    );
  });
  it('an unused joke leaves the plain part exactly', () => {
    fc.assert(
      fc.property(fc.string(), fc.option(fc.string()), (plain, joke) => {
        expect(composeErrorLine({ plain, joke: joke ?? undefined }, false)).toBe(plain);
      }),
      RUNS,
    );
  });
  it('a fresh English flow allows a joke on an error line', () => {
    expect(mayJoke('error', INITIAL_HOST_FLOW, 'a', 'en')).toBe(true);
  });
});

interface Ref {
  failures: number;
  last: string | null;
  since: number;
}

describe('P189 second failure is plain, a joke never repeats', () => {
  it('matches an independent reference machine', () => {
    fc.assert(
      fc.property(
        fc.array(arbEvent, { maxLength: 40 }),
        fc.constantFrom<HostCategory>('error', 'nextStep', 'greeting'),
        arbJoke,
        (events, cat, probe) => {
          let s: HostFlowState = INITIAL_HOST_FLOW;
          const r: Ref = { failures: 0, last: null, since: 0 };
          for (const e of events) {
            s = nextFlowState(s, e);
            if (e.kind === 'failure') r.failures += 1;
            else if (e.kind === 'success' || e.kind === 'leave') r.failures = 0;
            else if (e.kind === 'line' && e.jokeId !== undefined) {
              r.last = e.jokeId;
              r.since = 0;
            } else r.since += 1;
            expect(s.failures).toBe(r.failures);
            if (e.kind === 'success' || e.kind === 'leave') expect(s.failures).toBe(0);
            const expected =
              r.failures < 2 && (r.last === null || (probe !== r.last && r.since >= 3));
            expect(mayJoke(cat, s, probe, 'en')).toBe(expected);
            if (r.failures >= 2) expect(mayJoke(cat, s, probe, 'en')).toBe(false);
            if (r.last !== null) {
              expect(mayJoke(cat, s, r.last, 'en')).toBe(false);
              if (r.since < 3) expect(mayJoke(cat, s, probe, 'en')).toBe(false);
            }
          }
        },
      ),
      RUNS,
    );
  });
});

describe('P190 an error line is useful without its joke', () => {
  const word = fc.constantFrom('Try', 'again', 'later', 'type', 'it', 'my', 'brain', 'is', 'slow');
  const sentence = fc.array(word, { minLength: 1, maxLength: 8 }).map((w) => `${w.join(' ')}.`);
  it('plain first, joke after, once', () => {
    fc.assert(
      fc.property(
        sentence,
        fc.option(sentence, { nil: undefined }),
        fc.constantFrom('', '   ', '\n'),
        (plain, joke, blank) => {
          const out = composeErrorLine({ plain, joke }, true);
          expect(out.startsWith(plain)).toBe(true);
          if (joke === undefined) expect(out).toBe(plain);
          else {
            expect(out).toBe(`${plain} ${joke}`);
            expect(out.slice(plain.length).trim()).toBe(joke);
          }
          expect(composeErrorLine({ plain, joke: blank }, true)).toBe(plain);
        },
      ),
      RUNS,
    );
  });
  it('never the joke alone', () => {
    fc.assert(
      fc.property(sentence, (joke) => {
        expect(composeErrorLine({ plain: '', joke }, true)).toBe('');
      }),
      RUNS,
    );
  });
});

describe('P191 lint is exact on speakable text', () => {
  const safe = ['touch', 'photo', 'try', 'again', 'sample', 'open', 'the', 'page', 'later', 'Wait'];
  const safeLine = fc
    .array(fc.constantFrom(...safe), { minLength: 1, maxLength: 12 })
    .map((w) => `${w.join(' ')}.`);
  const banned = [
    '\u2014',
    '\u2013',
    '[',
    ']',
    '(',
    ')',
    '/',
    '=',
    '~',
    '*',
    '_',
    '#',
    '\u{1F600}',
    'verified',
    'correct',
    'approved',
    'checked',
    'just',
    'simply',
    'obviously',
    'sorry sorry',
    'server',
    'timed out',
    'request',
    'network',
    'error',
    'validation',
    'permission denied',
  ];
  it('safe lines pass', () => {
    fc.assert(
      fc.property(safeLine, (l) => {
        expect(lintHostLine(l, 'en').ok).toBe(true);
        expect(lintHostLine('Try ' + l, 'en', 'error').ok).toBe(true);
      }),
      RUNS,
    );
  });
  it.each(banned)('rejects %s', (item) => {
    const r = lintHostLine(`Try again ${item} later.`, 'en');
    expect(r.ok).toBe(false);
    expect(r.problems.length).toBeGreaterThan(0);
  });
  it('rejects any random banned insertion', () => {
    fc.assert(
      fc.property(safeLine, fc.constantFrom(...banned), fc.nat(5), (l, item, pos) => {
        const words = l.slice(0, -1).split(' ');
        words.splice(Math.min(pos, words.length), 0, item);
        expect(lintHostLine(`${words.join(' ')}.`, 'en').ok).toBe(false);
      }),
      RUNS,
    );
  });
  it('a single sorry is fine, a 26 word sentence is not, 25 is', () => {
    expect(lintHostLine('Sorry, try again.', 'en').ok).toBe(true);
    expect(lintHostLine(`${Array(26).fill('touch').join(' ')}.`, 'en').ok).toBe(false);
    expect(lintHostLine(`${Array(25).fill('touch').join(' ')}.`, 'en').ok).toBe(true);
  });
  it('an error line without an action word is not ok', () => {
    const r = lintHostLine('The page is blank.', 'en', 'error');
    expect(r.ok).toBe(false);
    expect(lintHostLine('The page is blank.', 'en', 'nextStep').ok).toBe(true);
  });
});

describe('P197 nothing else moves', () => {
  it('tuned values are unchanged', () => {
    fc.assert(
      fc.property(fc.constant(0), () => {
        expect(DEFAULT_HAPTICS.lineMs).toBe(80);
        expect(DEFAULT_HAPTICS.retriggerMs).toBe(70);
        expect(DEFAULT_HAPTICS.cornerPattern).toEqual([50, 90, 50]);
        expect(DEFAULT_HAPTICS.quietMs).toBe(450);
        expect(DEFAULT_RADII).toEqual({ vertex: 22, line: 14 });
        expect(DEFAULT_PROXIMITY.lineRadiusPx).toBe(14);
      }),
      { numRuns: 100 },
    );
  });
  it('hostPolicy.ts has no imports and no effect kinds', () => {
    const src = hostSource;
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/from\s+['"]/);
    expect(src).not.toMatch(/kind:\s*'(vibrate|tone|speak)'/);
  });
});

describe('P198 total and pure', () => {
  const junk = fc.anything({ withNullPrototype: false });
  const lone = fc.oneof(
    fc.string(),
    fc.constant('\uD800'),
    fc.constant('a\uDC00b'),
    fc.string({ minLength: 5000, maxLength: 20000 }),
  );
  it('never throws on junk and never mutates', () => {
    fc.assert(
      fc.property(junk, junk, junk, lone, (a, b, c, s) => {
        const frozen = JSON.stringify([a, b, c]);
        const any = (v: unknown) => v as never;
        expect(() => mayJoke(any(a), any(b), any(c), any(s))).not.toThrow();
        expect(() => composeErrorLine(any(a), any(b))).not.toThrow();
        expect(() => nextFlowState(any(a), any(b))).not.toThrow();
        expect(() => lintHostLine(any(c), any(s), any(a))).not.toThrow();
        expect(() => lintHostLine(s, 'en', 'error')).not.toThrow();
        expect(() => lintHostLine(s, s)).not.toThrow();
        expect(JSON.stringify([a, b, c])).toBe(frozen);
      }),
      { numRuns: 300 },
    );
  });
  it('named junk values', () => {
    const any = (v: unknown) => v as never;
    for (const v of [undefined, null, NaN, Infinity, {}, []]) {
      expect(() => mayJoke(any(v), any(v), any(v), any(v))).not.toThrow();
      expect(nextFlowState(any(v), any(v))).toEqual(INITIAL_HOST_FLOW);
      expect(typeof composeErrorLine(any(v), any(v))).toBe('string');
      expect(lintHostLine(any(v), 'en').ok).toBe(false);
    }
    const f = Object.freeze({ ...INITIAL_HOST_FLOW });
    expect(nextFlowState(f, { kind: 'failure' }).failures).toBe(1);
  });
});
