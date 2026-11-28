/**
 * P192 and P193 oracles (Requirement 53, task 92.4). was `it.fails` until lane H-copy added the
 * `host.*` keys and replaces the error values; the lane removes `.fails`.
 * Key names the lane must use: `host.start.greeting`, `host.capture.next`, and one
 * `host.<screen>.next` per screen in SCREENS.
 */
import { describe, expect, it } from 'vitest';
import { lintHostLine } from '../src/core/hostPolicy';
import { tables, type Lang } from '../src/i18n';

const LANGS: Lang[] = ['en', 'hi', 'gu'];
const SCREENS = [
  'start',
  'capture',
  'explore',
  'ask',
  'correct',
  'teach',
  'build',
  'saved',
  'settings',
  'raw',
];
const REPLACED_ERRORS = [
  'ask.errorNoSpeech',
  'ask.errorDenied',
  'ask.errorTimeout',
  'ask.errorListenTimeout',
  'ask.errorServer',
  'ask.errorOffline',
  'ask.errorFailed',
  'ask.errorBusy',
  'ask.errorBadResponse',
  'ask.errorUnsupported',
  'ask.errorEmpty',
  'capture.error',
  'capture.errorServer',
  'capture.errorType',
  'capture.errorSize',
  'capture.errorPdfPassword',
  'capture.errorPdf',
  'capture.errorBusy',
  'capture.errorGateway',
  'capture.errorTimeout',
  'raw.reason.timeout',
  'raw.reason.provider',
  'crash.message',
];
const HOST_KEYS = Object.keys(tables.en).filter((k) => k.startsWith('host.'));
const placeholders = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();
const words = (s: string): number => s.split(/\s+/u).filter(Boolean).length;
const ACTION = /\b(try|type|choose|pick|check|allow|press|wait|tap|double)\b/i;

describe('P192 every shipped host string passes lint', () => {
  it('host keys exist and agree across languages', () => {
    expect(HOST_KEYS.length).toBeGreaterThan(0);
    for (const k of [...HOST_KEYS, ...REPLACED_ERRORS]) {
      const en = tables.en[k] ?? '';
      expect(en.trim(), k).not.toBe('');
      for (const lang of LANGS) {
        const v = tables[lang][k] ?? '';
        expect(v.trim(), `${lang} ${k}`).not.toBe('');
        expect(placeholders(v), `${lang} ${k}`).toEqual(placeholders(en));
        if (lang !== 'en') expect(v, `${lang} ${k}`).not.toBe(en);
        const lint = lintHostLine(v, lang, k.includes('error') ? 'error' : undefined);
        expect(lint.problems, `${lang} ${k}`).toEqual([]);
      }
    }
  });
});

describe('P193 greeting and next-step lines are present and bounded', () => {
  it('Start greeting and Capture line', () => {
    const g = tables.en['host.start.greeting'] ?? '';
    expect(g).toMatch(/Ghost Host/);
    expect(g).toMatch(/double-tap|double tap/i);
    expect(words(g)).toBeLessThanOrEqual(40);
    const c = tables.en['host.capture.next'] ?? '';
    expect(c).toMatch(/photo/i);
    expect(c).toMatch(/image/i);
    expect(c).toMatch(/sample/i);
    expect(c).toMatch(/internet/i);
  });
  it('one next-step key per screen, bounded', () => {
    for (const s of SCREENS) {
      const v = tables.en[`host.${s}.next`] ?? '';
      expect(words(v), s).toBeGreaterThan(0);
      expect(words(v), s).toBeLessThanOrEqual(25);
      expect(v, s).toMatch(ACTION);
    }
  });
});
