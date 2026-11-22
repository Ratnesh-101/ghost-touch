/**
 * Planchette: glue between core walk logic and i18n/voice commands.
 *
 * Provides:
 * - walkLineText(line): formats a WalkLine into user-facing text with tf() and unit resolution.
 * - walkPhrases(): returns start and next voice command phrases across languages from i18n tables.
 *
 * Pure flow module: no React, no browser APIs.
 */

import type { WalkLine, WalkPhrases } from '../core/walk';
import { SUPPORTED_LANGS, t, tables, tf } from '../i18n';

/**
 * Format a core WalkLine (key + params) into user-facing text.
 * Resolves unit code (e.g. 'cm') to word from walk.unit.<code> with a leading space (empty for none),
 * stringifies numbers, and replaces placeholders through the i18n tf helper.
 */
export function walkLineText(line: WalkLine): string {
  if (!line || typeof line.key !== 'string') return '';
  const stringParams: Record<string, string> = {};
  if (line.params && typeof line.params === 'object') {
    for (const [key, value] of Object.entries(line.params)) {
      if (key === 'unit') {
        const u = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
        if (u !== '') {
          stringParams[key] = ` ${t(`walk.unit.${u}`)}`;
        } else {
          stringParams[key] = '';
        }
      } else if (value !== undefined && value !== null) {
        stringParams[key] = String(value);
      } else {
        stringParams[key] = '';
      }
    }
  }
  return tf(line.key, stringParams);
}

/**
 * Voice command phrases for starting and advancing a walk across all supported languages (en, hi, gu).
 * Read directly from i18n tables; each phrase is at most 3 words.
 */
export function walkPhrases(): WalkPhrases {
  const start: string[] = [];
  const next: string[] = [];

  for (const lang of SUPPORTED_LANGS) {
    const s = tables[lang]?.['walk.start'];
    if (s) {
      for (const phrase of s.split(',')) {
        const trimmed = phrase.trim();
        if (trimmed && trimmed.split(/\s+/).length <= 3) {
          start.push(trimmed);
        }
      }
    }
    const n = tables[lang]?.['walk.next'];
    if (n) {
      for (const phrase of n.split(',')) {
        const trimmed = phrase.trim();
        if (trimmed && trimmed.split(/\s+/).length <= 3) {
          next.push(trimmed);
        }
      }
    }
  }

  return { start, next };
}
