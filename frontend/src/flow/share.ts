/**
 * Pure flow helpers for shared diagram links and honesty enforcement.
 *
 * Requirements:
 * - R1: Never say "Verified" for link content; say "Shared by <name>, not checked" style wording.
 *   Disclaimer ("not cryptographic proof") part of entry announcement in one utterance.
 * - R3: Strip leading checkmarks and words "verified"/"certified" from displayed name and title.
 *   Speak fixed "Title:" prefix before title so a title cannot impersonate the badge.
 * - Wire format stays unchanged.
 */

import { joinAnnouncements } from './explore';
import { t } from '../i18n';

/**
 * Strips leading checkmarks and invisible / directional formatting characters.
 * Matches:
 * - Directional marks: U+200E (LRM), U+200F (RLM), U+202A-U+202E, U+2066-U+2069
 * - Zero-width characters: U+200B-U+200D (ZWSP/ZWNJ/ZWJ), U+2060 (WJ), U+FEFF (BOM)
 * - Combining marks / variation selectors: \p{M}, U+FE00-U+FE0F
 * - Invisible operators / separators: U+2061-U+2064
 * - Checkmarks: ✓ (U+2713), ✔ (U+2714), ☑ (U+2611), √ (U+221A), ✅ (U+2705), 🗹 (U+1F5F9)
 * - Whitespace: \s
 */
const INVISIBLE_TOKEN =
  /^[\s\p{M}\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\uFE00-\uFE0F]+/u;

const CHECK_MARK_TOKEN = /^[\u2713\u2714\u2611\u221A\u2705\u{1F5F9}]\uFE0F?/u;

/**
 * Pattern matching leading badge words in English, Hindi, and Gujarati:
 * - English: verified, certified
 * - Hindi: सत्यापित
 * - Gujarati: પ્રમાણિત
 * Followed by negative lookahead preventing partial matches inside ordinary words.
 */
const BADGE_WORD_TOKEN =
  /^(?:verified|certified|सत्यापित|પ્રમાણિત)(?![\p{L}\p{M}\p{N}])/iu;

const CONNECTOR_TOKEN = /^(?:&|and(?![\p{L}\p{M}\p{N}])|[:.,-])/iu;

const ALL_CONNECTORS_OR_SPACES = new RegExp(
  '^(?:&|and|[:.,\\s\\p{M}\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064' +
    '\\u2066-\\u2069\\uFEFF\\uFE00-\\uFE0F-])*$',
  'iu',
);

/**
 * Strips leading badge impersonation words and symbols from an input string (Req 22.1-22.5).
 * Iteratively removes prefix tokens: whitespace, invisible marks, checkmarks with optional
 * U+FE0F, badge words not followed by letter/mark/number, and connectors "and"/"&"/[: , . -]
 * ONLY while a badge or checkmark has been seen in the prefix.
 * If the input consists entirely of badge words, checkmarks, connectors, or punctuation,
 * returns an empty string.
 */
function stripLeadingBadge(text: string): string {
  if (!text || ALL_CONNECTORS_OR_SPACES.test(text)) {
    return '';
  }

  let s = text;

  // Always strip leading invisible marks and whitespace (P66)
  const initialInvisible = s.match(INVISIBLE_TOKEN);
  if (initialInvisible) {
    s = s.slice(initialInvisible[0].length);
  }

  if (!s || ALL_CONNECTORS_OR_SPACES.test(s)) {
    return '';
  }

  // Iteratively strip badge prefixes until nothing changes (Req 22.1-22.5, P68)
  let changed = true;
  while (changed) {
    changed = false;

    let offset = 0;
    let hasBadge = false;

    while (offset < s.length) {
      const rest = s.slice(offset);

      const badgeMatch = rest.match(BADGE_WORD_TOKEN);
      if (badgeMatch) {
        hasBadge = true;
        offset += badgeMatch[0].length;
        continue;
      }

      const checkMatch = rest.match(CHECK_MARK_TOKEN);
      if (checkMatch) {
        hasBadge = true;
        offset += checkMatch[0].length;
        continue;
      }

      const invisibleMatch = rest.match(INVISIBLE_TOKEN);
      if (invisibleMatch) {
        offset += invisibleMatch[0].length;
        continue;
      }

      const connectorMatch = rest.match(CONNECTOR_TOKEN);
      if (connectorMatch) {
        offset += connectorMatch[0].length;
        continue;
      }

      break;
    }

    // Connectors stripped ONLY when a badge/checkmark has been seen in this prefix (22.5)
    if (hasBadge && offset > 0) {
      s = s.slice(offset);
      const postInvisible = s.match(INVISIBLE_TOKEN);
      if (postInvisible) {
        s = s.slice(postInvisible[0].length);
      }
      changed = true;
    }
  }

  if (ALL_CONNECTORS_OR_SPACES.test(s)) {
    return '';
  }

  return s.trimEnd();
}

/**
 * Sanitizes a title from a shared diagram:
 * - Strips leading checkmarks (including U+2705, U+1F5F9)
 * - Strips variation selectors, directional marks, zero-width chars, and combining marks
 * - Strips words "verified", "certified", "सत्यापित", and "પ્રમાણિત" when leading
 * - Normalizes whitespace and strips orphaned leading delimiters
 */
export function sanitizeShareTitle(title: unknown): string {
  if (typeof title !== 'string') return '';
  return stripLeadingBadge(title);
}

/**
 * Sanitizes a teacher name from a shared diagram:
 * - Strips leading checkmarks (including U+2705, U+1F5F9)
 * - Strips variation selectors, directional marks, zero-width chars, and combining marks
 * - Strips words "verified", "certified", "सत्यापित", and "પ્રમાણિત" when leading
 * - Normalizes whitespace and strips orphaned leading delimiters
 */
export function sanitizeShareName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return stripLeadingBadge(name);
}

/**
 * Returns the honest visible/spoken label for a shared diagram creator:
 * "Shared by <name>, not checked" or "Shared diagram, not checked".
 * NEVER contains the word "Verified" for link content.
 * Safe against special replacement patterns ($&, $', $1) in author names.
 */
export function honestSharedByLabel(name: unknown): string {
  const clean = sanitizeShareName(name);
  if (clean !== '') {
    return t('share.sharedBy').replace('{name}', () => clean);
  }
  return t('share.sharedUnnamed');
}

/**
 * Formats a scene announcement by prepending the fixed localized "Title: " prefix
 * to the diagram title so that a title cannot impersonate the verification badge.
 * Safe against special replacement patterns ($&, $', $1) in titles.
 */
export function formatShareTitleAnnouncement(
  sceneAnnouncement: string,
  cleanTitle: string,
): string {
  const trimmedTitle = cleanTitle.trim();
  if (!trimmedTitle) return sceneAnnouncement;

  const prefix = t('share.titlePrefix').replace('{title}', () => trimmedTitle);
  if (sceneAnnouncement.startsWith(prefix)) {
    return sceneAnnouncement;
  }
  if (sceneAnnouncement.startsWith(trimmedTitle)) {
    return prefix + sceneAnnouncement.slice(trimmedTitle.length);
  }
  return `${prefix}. ${sceneAnnouncement}`;
}

export interface HonestShareAnnouncementOptions {
  sceneAnnouncement: string;
  verifiedBy?: string;
  cleanTitle?: string;
}

/**
 * Builds the complete honest entry announcement for a shared diagram:
 * 1. Scene announcement with "Title:" prefix
 * 2. Honest "Shared by <name>, not checked" label
 * 3. Mandatory honesty disclaimer
 *
 * All joined into ONE single spoken utterance (R1/R3).
 */
export function buildHonestShareAnnouncement({
  sceneAnnouncement,
  verifiedBy,
  cleanTitle,
}: HonestShareAnnouncementOptions): string {
  const titleFormattedAnnouncement = cleanTitle
    ? formatShareTitleAnnouncement(sceneAnnouncement, cleanTitle)
    : sceneAnnouncement;
  const sharedLabel = honestSharedByLabel(verifiedBy);
  const honestyDisclaimer = t('share.honesty');

  return joinAnnouncements([
    titleFormattedAnnouncement,
    sharedLabel,
    honestyDisclaimer,
  ]);
}
