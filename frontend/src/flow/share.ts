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
 * Strips leading checkmark spoofing symbols from a string.
 * Matches: ✓ (U+2713), ✔ (U+2714), ☑ (U+2611), √ (U+221A).
 */
const LEADING_CHECKMARKS = /^[✓✔☑√\s]+/u;

/**
 * Pattern matching leading badge words (verified, certified) and optional connector
 * (and, &, colon, dash, comma, or trailing whitespace).
 */
const LEADING_BADGE_WORDS =
  /^(?:verified|certified)(?:\s*(?:and|&)\s+|[:\s,.-]+|\s+|$)/i;

/**
 * Strips leading badge impersonation words and symbols from an input string.
 * If the input consists entirely of badge words, checkmarks, connectors, or punctuation,
 * returns an empty string.
 */
function stripLeadingBadge(text: string): string {
  let s = text.replace(LEADING_CHECKMARKS, '').trim();
  while (LEADING_BADGE_WORDS.test(s)) {
    s = s.replace(LEADING_BADGE_WORDS, '').trim();
  }
  s = s.replace(/^(?:(?:and|&)\s+|[:\s,.-]+)+/i, '').trim();
  if (/^(?:and|&)$/i.test(s)) {
    return '';
  }
  return s;
}

/**
 * Sanitizes a title from a shared diagram:
 * - Strips leading checkmarks
 * - Strips words "verified" and "certified" when leading
 * - Normalizes whitespace and strips orphaned leading delimiters
 */
export function sanitizeShareTitle(title: unknown): string {
  if (typeof title !== 'string') return '';
  return stripLeadingBadge(title);
}

/**
 * Sanitizes a teacher name from a shared diagram:
 * - Strips leading checkmarks
 * - Strips words "verified" and "certified" when leading
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
 */
export function honestSharedByLabel(name: unknown): string {
  const clean = sanitizeShareName(name);
  if (clean !== '') {
    return t('share.sharedBy').replace('{name}', clean);
  }
  return t('share.sharedUnnamed');
}

/**
 * Formats a scene announcement by prepending the fixed localized "Title: " prefix
 * to the diagram title so that a title cannot impersonate the verification badge.
 */
export function formatShareTitleAnnouncement(
  sceneAnnouncement: string,
  cleanTitle: string,
): string {
  const trimmedTitle = cleanTitle.trim();
  if (!trimmedTitle) return sceneAnnouncement;

  const prefix = t('share.titlePrefix').replace('{title}', trimmedTitle);
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
 * 3. Mandatory honesty disclaimer ("not cryptographic proof")
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
