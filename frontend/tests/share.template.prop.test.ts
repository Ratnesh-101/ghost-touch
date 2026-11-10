/**
 * Template safety of the share announcements (Requirement 22.6). Property P71 (Kiro, task 38).
 *
 * `String.prototype.replace(target, text)` treats `$&`, `$'`, `` $` ``, `$1` and `$$` in `text`
 * specially, so an author name or a title that contains one corrupts a sentence built with it
 * (audit R5-06). The announcements must contain the name or the title exactly once and must never
 * leave a literal `{name}` or `{title}`, in every language.
 *
 * Written while lane p3 was believed unmerged; it had already merged (main at 2d108ca) when this
 * first ran, and P71 passes against it (docs/reviews/kiro-round5.md). Do not skip or weaken it:
 * it is the regression guard for R5-06.
 */
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { exploreAnnouncement } from '../src/flow/navigation';
import {
  buildHonestShareAnnouncement,
  formatShareTitleAnnouncement,
  honestSharedByLabel,
} from '../src/flow/share';
import type { DiagramScene } from '../src/core/scene';
import { getLang, setLang, type Lang } from '../src/i18n';

const RUNS = { numRuns: 300 };
const HINT = 'Double tap and hold to explore.';

/** The patterns `replace` treats specially, as listed in the brief, plus `$$`. */
const PATTERNS = ['$', '$&', "$'", '$`', '$1', '$$'] as const;
const wordArb = fc.constantFrom(
  'Prof',
  'Sharma',
  'Rao',
  'Budget',
  '\u00D1and\u00FA',
  'रमेश',
  'શિક્ષક',
  'Class9B',
  'A',
);

/**
 * `<marker> <word><patterns><word>`. The two markers differ, so a name is never a substring of a
 * title and the other way round; no brace is ever generated, so a literal `{name}` can only come
 * from a failed substitution.
 */
function patterned(marker: string): fc.Arbitrary<string> {
  return fc
    .tuple(
      wordArb,
      fc.array(fc.constantFrom(...PATTERNS), { minLength: 1, maxLength: 3 }),
      wordArb,
      fc.constantFrom('', ' '),
    )
    .map(([a, patterns, b, sep]) => `${marker} ${a}${sep}${patterns.join('')}${sep}${b}`);
}

const nameArb = patterned('Mr');
const titleArb = patterned('Fig');
const langArb = fc.constantFrom<Lang>('en', 'hi', 'gu');

const PLACEHOLDER = /\{(?:name|title)\}/;

/** Escape what cannot be read, so a counterexample can be understood. */
function show(text: string): string {
  return `"${text.replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => `\\u{${c.charCodeAt(0).toString(16)}}`)}"`;
}

function timesIn(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function verify(
  builder: string,
  lang: Lang,
  out: string,
  mustAppearOnce: readonly string[],
): void {
  for (const needle of mustAppearOnce) {
    const n = timesIn(out, needle);
    if (n !== 1) {
      throw new Error(
        `[${lang}] ${builder} = ${show(out)} contains ${show(needle)} ${n} times, expected exactly once`,
      );
    }
  }
  if (PLACEHOLDER.test(out)) {
    throw new Error(`[${lang}] ${builder} = ${show(out)} left a literal {name} or {title}`);
  }
}

/** Run `fn` in `lang` and put the language back, even when it throws. */
function inLang(lang: Lang, fn: () => void): void {
  const original = getLang();
  setLang(lang);
  try {
    fn();
  } finally {
    setLang(original);
  }
}

describe('share announcement templates (Requirement 22.6)', () => {
  it('P71: a name or title containing $ patterns appears exactly once and leaves no placeholder', () => {
    fc.assert(
      fc.property(langArb, nameArb, titleArb, (lang, name, title) => {
        inLang(lang, () => {
          verify('honestSharedByLabel', lang, honestSharedByLabel(name), [name]);

          // The product shape: the scene announcement already starts with the title.
          verify(
            'formatShareTitleAnnouncement (announcement starts with the title)',
            lang,
            formatShareTitleAnnouncement(`${title}. ${HINT}`, title),
            [title],
          );
          verify(
            'formatShareTitleAnnouncement (title not in the announcement)',
            lang,
            formatShareTitleAnnouncement(`Figure. ${HINT}`, title),
            [title],
          );

          const scene = { kind: 'unknown', title } as DiagramScene;
          verify(
            'exploreAnnouncement (shared, honestTitle)',
            lang,
            exploreAnnouncement(scene, 'shared', undefined, { honestTitle: true }),
            [title],
          );

          verify(
            'buildHonestShareAnnouncement',
            lang,
            buildHonestShareAnnouncement({
              sceneAnnouncement: `${title}. ${HINT}`,
              verifiedBy: name,
              cleanTitle: title,
            }),
            [name, title],
          );
        });
      }),
      RUNS,
    );
  });
});
