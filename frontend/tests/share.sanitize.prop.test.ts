/**
 * Share-name sanitising (Requirement 22.1-22.5). Properties P66-P70 (Kiro, task 38) for
 * `sanitizeShareName` and `sanitizeShareTitle` in `flow/share.ts`.
 *
 * Written while lane p3 was believed unmerged; it had already merged (main at 2d108ca) when these
 * first ran, so a failure here is a gap the fix left. The failing properties and their shrunk
 * counterexamples are in docs/reviews/kiro-round5.md. Do not skip, weaken or `.fails`-mark them
 * to get a green run.
 *
 * The oracle never reuses the sanitiser's own regular expressions: "begins with" is checked on
 * the output with expressions written here from the definitions in Requirement 22.
 */
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { sanitizeShareName, sanitizeShareTitle } from '../src/flow/share';

const RUNS = { numRuns: 300 };

const FUNCTIONS: ReadonlyArray<readonly [string, (value: unknown) => string]> = [
  ['sanitizeShareName', sanitizeShareName],
  ['sanitizeShareTitle', sanitizeShareTitle],
];

// ---------------------------------------------------------------------------------------------
// Oracle
// ---------------------------------------------------------------------------------------------

/** A badge word counts only when the next character is not a letter, a mark or a number. */
const BADGE_WORD_START = /^(?:verified|certified|सत्यापित|પ્રમાણિત)(?![\p{L}\p{M}\p{N}])/iu;
const CHECK_START = /^[\u2713\u2714\u2611\u221A\u2705\u{1F5F9}]/u;
const INVISIBLE_START =
  /^[\s\p{M}\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\uFE00-\uFE0F]/u;
/** "and" as a word, or an ampersand. */
const LEFTOVER_CONNECTOR = /&|(?<![\p{L}\p{M}\p{N}])and(?![\p{L}\p{M}\p{N}])/iu;

function badStart(text: string): string | null {
  if (BADGE_WORD_START.test(text)) return 'a badge word';
  if (CHECK_START.test(text)) return 'a check mark';
  if (INVISIBLE_START.test(text)) return 'an invisible mark or whitespace';
  return null;
}

/** Escape what cannot be seen, so a counterexample can be read. */
const NEEDS_ESCAPE = /[\p{M}\p{Cf}\p{Cc}\p{Z}\uFE00-\uFE0F\u2713\u2714\u2611\u221A\u2705\u{1F5F9}]/u;
function show(text: string): string {
  const body = Array.from(text, (c) => {
    if (c !== ' ' && NEEDS_ESCAPE.test(c)) return `\\u{${(c.codePointAt(0) ?? 0).toString(16)}}`;
    return c;
  }).join('');
  return `"${body}"`;
}

// ---------------------------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------------------------

/**
 * One piece of an input. Two `word` pieces are always joined by `gap`, so the generator never
 * glues "verified" and "certified" into one unreadable word and then calls it two badges. A
 * `combining` piece after a word is also separated, because "verified" + a combining accent is
 * a different word. Every other adjacency is allowed: "Verified✅" and "✅Verified" are the
 * spoofs these properties exist for.
 */
interface Item {
  readonly text: string;
  readonly word: boolean;
  readonly combining: boolean;
  readonly gap: string;
}

const gapArb = fc.constantFrom(' ', '  ', '\t', '\u00A0', ':', ',', '.', '-', ': ', ', ', ' - ');

function item(text: fc.Arbitrary<string>, kind: 'word' | 'mark' | 'combining'): fc.Arbitrary<Item> {
  return fc.record({
    text,
    word: fc.constant(kind === 'word'),
    combining: fc.constant(kind === 'combining'),
    gap: gapArb,
  });
}

function render(items: readonly Item[]): string {
  let out = '';
  let previousWasWord = false;
  for (const it of items) {
    if (previousWasWord && (it.word || it.combining)) out += it.gap;
    out += it.text;
    previousWasWord = it.word;
  }
  return out;
}

const badgeWordItem = item(
  fc.constantFrom(
    'verified',
    'Verified',
    'VERIFIED',
    'vErIfIeD',
    'certified',
    'Certified',
    'CERTIFIED',
    'सत्यापित',
    'પ્રમાણિત',
  ),
  'word',
);

const checkMarkItem = item(
  fc
    .tuple(
      fc.constantFrom('\u2713', '\u2714', '\u2611', '\u221A', '\u2705', '\u{1F5F9}'),
      fc.constantFrom('', '\uFE0F'),
    )
    .map(([mark, selector]) => mark + selector),
  'mark',
);

const invisibleItem = item(
  fc.constantFrom(
    '\u200B',
    '\u200C',
    '\u200D',
    '\u200E',
    '\u200F',
    '\u202A',
    '\u202B',
    '\u202C',
    '\u202D',
    '\u202E',
    '\u2060',
    '\u2066',
    '\u2067',
    '\u2068',
    '\u2069',
    '\uFEFF',
  ),
  'mark',
);

const combiningItem = item(fc.constantFrom('\u0300', '\u0301', '\u0308', '\u20DD'), 'combining');
const spaceItem = item(fc.constantFrom(' ', '  ', '\t', '\u00A0'), 'mark');
const andItem = item(fc.constantFrom('and', 'And', 'AND', 'AnD'), 'word');
const ampersandItem = item(fc.constant('&'), 'mark');

/** Names that look like badges or connectors without being them (checked unchanged by P70). */
const ORDINARY_NO_AND = [
  'Alice',
  'Mrs Sharma',
  'NCERT',
  'Priya Patel',
  'Prof. Rao',
  'Jean-Luc',
  '\u00D1and\u00FA',
  'Class 9B',
  'Andrew',
  'Anderson',
  'Vera',
  'Verity',
  'Verifiedcity',
  'Certifiedx',
  'Certify Labs',
  'रमेश शर्मा',
  'શિક્ષક',
];
const ORDINARY = [...ORDINARY_NO_AND, 'Tom and Jerry'];

const textItem = (words: readonly string[]): fc.Arbitrary<Item> =>
  item(fc.constantFrom(...words), 'word');

/** Everything that is not a badge: marks, spaces, connectors. */
const markFillerArb = fc.oneof(
  checkMarkItem,
  invisibleItem,
  combiningItem,
  spaceItem,
  ampersandItem,
);
/** Anything a badge-only input may contain besides its required badge. */
const fillerArb = fc.oneof(badgeWordItem, andItem, markFillerArb);

/** A random mix of everything, ordinary text included. */
const mixArb = fc.array(
  fc.oneof(
    badgeWordItem,
    checkMarkItem,
    invisibleItem,
    combiningItem,
    spaceItem,
    andItem,
    ampersandItem,
    textItem(ORDINARY),
  ),
  { maxLength: 8 },
);

/** At least one badge (a badge word or a check mark), and only badge material around it. */
const badgePrefixArb = fc.tuple(
  fc.array(fillerArb, { maxLength: 4 }),
  fc.oneof(badgeWordItem, checkMarkItem),
  fc.array(fillerArb, { maxLength: 4 }),
);

// ---------------------------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------------------------

describe('share-name sanitising (Requirement 22.1-22.5)', () => {
  it('P66: the result never begins with a badge word, a check mark, an invisible mark or whitespace', () => {
    fc.assert(
      fc.property(mixArb, (items) => {
        const input = render(items);
        for (const [name, f] of FUNCTIONS) {
          const out = f(input);
          const why = badStart(out);
          if (why !== null) {
            throw new Error(`${name}(${show(input)}) = ${show(out)} begins with ${why}`);
          }
        }
      }),
      RUNS,
    );
  });

  it('P67: an input of only badges sanitises to the empty string', () => {
    fc.assert(
      fc.property(badgePrefixArb, ([before, badge, after]) => {
        const input = render([...before, badge, ...after]);
        for (const [name, f] of FUNCTIONS) {
          const out = f(input);
          if (out !== '') {
            throw new Error(`${name}(${show(input)}) = ${show(out)}, expected the empty string`);
          }
        }
      }),
      RUNS,
    );
  });

  it('P68: sanitising twice gives the same result as sanitising once', () => {
    fc.assert(
      fc.property(mixArb, (items) => {
        const input = render(items);
        for (const [name, f] of FUNCTIONS) {
          const once = f(input);
          const twice = f(once);
          if (twice !== once) {
            throw new Error(
              `${name}(${show(input)}) = ${show(once)}, but sanitising that again gives ${show(twice)}`,
            );
          }
        }
      }),
      RUNS,
    );
  });

  it('P69: no "and" or "&" is left over from stripping, and the name is kept', () => {
    const arb = fc
      .tuple(badgePrefixArb, textItem(ORDINARY_NO_AND))
      .map(([[before, badge, after], text]) => ({
        input: render([...before, badge, ...after, text]),
        text: text.text,
      }));
    fc.assert(
      fc.property(arb, ({ input, text }) => {
        for (const [name, f] of FUNCTIONS) {
          const out = f(input);
          if (!out.endsWith(text)) {
            throw new Error(
              `${name}(${show(input)}) = ${show(out)} does not end with the name ${show(text)}`,
            );
          }
          if (LEFTOVER_CONNECTOR.test(out)) {
            throw new Error(
              `${name}(${show(input)}) = ${show(out)} still contains "and" or "&" from the badge prefix`,
            );
          }
        }
      }),
      RUNS,
    );
  });

  it('P70: ordinary text, including names that start like a badge or a connector, is not changed', () => {
    const arb = fc
      .array(fc.constantFrom(...ORDINARY), { minLength: 1, maxLength: 4 })
      .map((words) => words.join(' '));
    fc.assert(
      fc.property(arb, (input) => {
        for (const [name, f] of FUNCTIONS) {
          const out = f(input);
          if (out !== input) {
            throw new Error(`${name}(${show(input)}) = ${show(out)}, expected it unchanged`);
          }
        }
      }),
      RUNS,
    );
  });
});
