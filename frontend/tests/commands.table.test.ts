/**
 * Task 71 (Requirement 45, P147): a voice command matches a whole phrase, never a word inside a
 * question.
 *
 * `parseExploreCommand` uses `includes` / `startsWith` for help, describe, repeat, next corner,
 * faster and slower, so a real question that contains one of those words is run as a command.
 * The question table and the sentence property are `it.fails` until the agy lane in
 * `flow/commands.ts` implements Requirement 45.1; that lane removes `.fails`. The bare-command
 * test passes today and must keep passing after the fix.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseExploreCommand } from '../src/flow/commands';
import { runs } from './support/runs';

type Lang = 'en' | 'hi' | 'gu';

/** Twenty real questions. Each contains a command word or phrase and is not a command. */
const QUESTIONS: ReadonlyArray<{ lang: Lang; text: string; word: string }> = [
  { lang: 'en', word: 'faster', text: 'Which bar grows faster?' },
  { lang: 'en', word: 'help', text: 'Can you help me find AB?' },
  // Three words, so this row depends on Requirement 45.5 (all words must be command words).
  { lang: 'en', word: 'describe', text: 'Describe angle B' },
  { lang: 'en', word: 'slower', text: 'Is the curve rising slower after the peak?' },
  { lang: 'en', word: 'next corner', text: 'Which side is the next corner after B?' },
  { lang: 'en', word: 'repeat', text: 'Repeat the length of AC please' },
  { lang: 'en', word: 'faster', text: 'Does the temperature rise faster than the pressure?' },
  { lang: 'en', word: 'slower', text: 'Why does the second bar grow slower than the first?' },
  { lang: 'en', word: 'describe', text: 'Describe the angle at vertex C' },
  { lang: 'en', word: 'help', text: 'Please help me understand the sine curve' },
  { lang: 'en', word: 'help', text: 'Will this triangle help me find the hypotenuse?' },
  { lang: 'en', word: 'slower', text: 'Does the line go slower near the top?' },
  { lang: 'en', word: 'next corner', text: 'What is the next corner after A going clockwise?' },
  { lang: 'en', word: 'describe', text: 'Describe the bars from tallest to shortest' },
  { lang: 'hi', word: 'मदद', text: 'क्या आप मुझे AB खोजने में मदद कर सकते हैं' },
  { lang: 'hi', word: 'वर्णन', text: 'त्रिभुज ABC का वर्णन करो' },
  { lang: 'hi', word: 'अगला कोना', text: 'इस आकृति में अगला कोना कौन सा है' },
  { lang: 'gu', word: 'મદદ', text: 'શું તમે મને AB શોધવામાં મદદ કરી શકો' },
  { lang: 'gu', word: 'વર્ણન', text: 'ત્રિકોણ ABC નું વર્ણન કરો' },
  { lang: 'gu', word: 'આગળનો ખૂણો', text: 'આ આલેખમાં આગળનો ખૂણો કયો છે' },
];

const BARE: ReadonlyArray<{
  lang: Lang;
  text: string;
  type: string;
  rate?: 'fast' | 'slow';
}> = [
  { lang: 'en', text: 'help', type: 'help' },
  { lang: 'en', text: 'repeat', type: 'repeat' },
  { lang: 'en', text: 'next corner', type: 'next_corner' },
  { lang: 'en', text: 'describe', type: 'describe' },
  { lang: 'en', text: 'faster', type: 'set_rate', rate: 'fast' },
  { lang: 'en', text: 'slower', type: 'set_rate', rate: 'slow' },
  { lang: 'hi', text: 'मदद', type: 'help' },
  { lang: 'hi', text: 'दोहराएं', type: 'repeat' },
  { lang: 'hi', text: 'अगला कोना', type: 'next_corner' },
  { lang: 'hi', text: 'वर्णन करें', type: 'describe' },
  { lang: 'hi', text: 'तेज़', type: 'set_rate', rate: 'fast' },
  { lang: 'hi', text: 'धीमा', type: 'set_rate', rate: 'slow' },
  { lang: 'gu', text: 'મદદ', type: 'help' },
  { lang: 'gu', text: 'ફરી બોલો', type: 'repeat' },
  { lang: 'gu', text: 'આગળનો ખૂણો', type: 'next_corner' },
  { lang: 'gu', text: 'વર્ણન કરો', type: 'describe' },
  { lang: 'gu', text: 'ઝડપી', type: 'set_rate', rate: 'fast' },
  { lang: 'gu', text: 'ધીમું', type: 'set_rate', rate: 'slow' },
];

describe('P147 a voice command matches a whole phrase (Requirement 45, task 71)', () => {
  it('the table has 20 questions: 14 English, 3 Hindi, 3 Gujarati', () => {
    expect(QUESTIONS).toHaveLength(20);
    expect(QUESTIONS.filter((q) => q.lang === 'en')).toHaveLength(14);
    expect(QUESTIONS.filter((q) => q.lang === 'hi')).toHaveLength(3);
    expect(QUESTIONS.filter((q) => q.lang === 'gu')).toHaveLength(3);
  });

  it('control: the bare commands in en, hi and gu parse to the same command as before', () => {
    const wrong = BARE.flatMap((c) => {
      const parsed = parseExploreCommand(c.text);
      const ok = parsed.type === c.type && parsed.rateSetting === c.rate;
      return ok ? [] : [`${c.lang} "${c.text}" -> ${parsed.type}/${String(parsed.rateSetting)}`];
    });
    expect(wrong).toEqual([]);
  });

  // Red today: `includes` and `startsWith` match a command word anywhere in the sentence. The
  // single assertion lists every row that still matches, so the failure names them.
  it('twenty real questions parse as unknown, so they reach Ask', () => {
    const swallowed = QUESTIONS.flatMap((q) => {
      const parsed = parseExploreCommand(q.text);
      return parsed.type === 'unknown' ? [] : [`${q.lang} "${q.text}" -> ${parsed.type}`];
    });
    expect(swallowed).toEqual([]);
  });

  // Red today for the same reason. Filler words are none of the command words, and a sentence
  // of 4 or more words that is not itself a listed phrase can never be a command (45.1).
  it('any sentence of 4+ words with a command word inserted parses as unknown', () => {
    const filler = fc.constantFrom(
      'which', 'bar', 'grows', 'angle', 'side', 'the', 'of', 'ab', 'curve', 'how',
      'long', 'does', 'a', 'b', 'line', 'after', 'peak', 'than', 'triangle', 'value',
    );
    const keyword = fc.constantFrom('help', 'describe', 'repeat', 'next corner', 'faster', 'slower');
    fc.assert(
      fc.property(
        fc.array(filler, { minLength: 3, maxLength: 9 }),
        keyword,
        fc.nat(),
        (words, kw, at) => {
          const pos = at % (words.length + 1);
          const sentence = [...words.slice(0, pos), kw, ...words.slice(pos)].join(' ');
          return parseExploreCommand(sentence).type === 'unknown';
        },
      ),
      { numRuns: runs(250) },
    );
  });
});
