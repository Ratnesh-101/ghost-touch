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
 * - Combining marks / variation selectors: \p{M}, U+FE0F
 * - Checkmarks: ✓ (U+2713), ✔ (U+2714), ☑ (U+2611), √ (U+221A), ✅ (U+2705), 🗹 (U+1F5F9)
 * - Whitespace: \s
 */
const INVISIBLES =
  '\\s\\u200B-\\u200F\\u202A-\\u202E\\u2060\\u2066-\\u2069\\uFEFF\\uFE0F\\p{M}';
const CHECKS = '✓✔☑√\\u2705\\u{1F5F9}';
const LEADING_STRIP_CHARS = new RegExp(`^[${INVISIBLES}${CHECKS}]+`, 'u');

/**
 * Pattern matching leading badge words in English, Hindi, and Gujarati:
 * - English: verified, certified
 * - Hindi: सत्यापित
 * - Gujarati: પ્રમાણિત
 * Followed by an optional connector (and, &, colon, dash, comma, whitespace) or end of string.
 */
const BADGES = 'verified|certified|सत्यापित|પ્રમાણિત';
const LEADING_BADGE_WORDS = new RegExp(
  `^(?:${BADGES})(?:[${INVISIBLES}]*(?:and|&)|[:\\s,.-]+|[${INVISIBLES}]+|$)`,
  'iu',
);

const LEADING_CONNECTORS = new RegExp(
  `^(?:(?:and|&)(?:[${INVISIBLES}]+|$)|[:\\s,.-]+)+`,
  'iu',
);

/**
 * Strips leading badge impersonation words and symbols from an input string.
 * If the input consists entirely of badge words, checkmarks, connectors, or punctuation,
 * returns an empty string.
 */
function stripLeadingBadge(text: string): string {
  let s = text;
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(LEADING_STRIP_CHARS, '');
    if (LEADING_BADGE_WORDS.test(s)) {
      s = s.replace(LEADING_BADGE_WORDS, '');
    }
    s = s.replace(LEADING_CONNECTORS, '');
  }
  s = s.replace(LEADING_STRIP_CHARS, '');
  const trimmed = s.trim();
  if (/^(?:and|&)$/i.test(trimmed)) {
    return '';
  }
  return trimmed;
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
