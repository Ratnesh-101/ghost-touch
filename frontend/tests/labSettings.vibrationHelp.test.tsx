/**
 * Device vibration help section in LabSettings.
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LabSettings } from '../src/components/LabSettings';
import { getLang, setLang, t, type Lang } from '../src/i18n';

const css = fs.readFileSync(
  new URL('../src/styles/settings.css', import.meta.url),
  'utf-8',
) as string;

const KEYS = [
  'lab.settings.vibrationHelpTitle',
  'lab.settings.vibrationHelpIntro',
  'lab.settings.vibrationHelpSamsung',
  'lab.settings.vibrationHelpStock',
  'lab.settings.vibrationHelpOnePlus',
  'lab.settings.vibrationHelpXiaomi',
  'lab.settings.vibrationHelpNote',
] as const;

function render(): string {
  return renderToStaticMarkup(createElement(LabSettings, { open: true, onClose: vi.fn() }));
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/</g, '&lt;');
}

describe('LabSettings vibration help', () => {
  let prev: Lang;
  beforeEach(() => {
    prev = getLang();
    setLang('en');
  });
  afterEach(() => setLang(prev));

  it('renders all instruction strings in English', () => {
    const html = render();
    for (const key of KEYS) {
      expect(t(key)).not.toBe(key);
      expect(html).toContain(escape(t(key)));
    }
    expect(t('lab.settings.vibrationHelpTitle')).toBe('Device Vibration Settings');
  });

  it('mentions the required settings paths', () => {
    expect(t('lab.settings.vibrationHelpSamsung')).toMatch(/Vibration intensity/);
    expect(t('lab.settings.vibrationHelpSamsung')).toMatch(/Touch feedback/);
    expect(t('lab.settings.vibrationHelpSamsung')).toMatch(/Power Saving/);
    expect(t('lab.settings.vibrationHelpStock')).toMatch(/Vibration & haptics/);
    expect(t('lab.settings.vibrationHelpOnePlus')).toMatch(/Haptics/);
    expect(t('lab.settings.vibrationHelpXiaomi')).toMatch(/HyperOS/);
  });

  it('has an accessible heading-labelled section with a list', () => {
    const html = render();
    expect(html).toContain('aria-labelledby="lab-settings-section-vibration"');
    expect(html).toMatch(/<h3 id="lab-settings-section-vibration"[^>]*>Device Vibration Settings<\/h3>/);
    expect(html).toContain('id="lab-settings-vibration-intro"');
    expect(html).toContain('aria-describedby="lab-settings-vibration-intro"');
    expect((html.match(/<li>/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('uses unique ids', () => {
    const ids = [...render().matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(['hi', 'gu'] as const)('translates into %s', (lang) => {
    setLang('en');
    const en = KEYS.map((k) => t(k));
    setLang(lang);
    const html = render();
    KEYS.forEach((key, i) => {
      const v = t(key);
      expect(v).not.toBe(key);
      expect(v).not.toBe(en[i]);
      expect(html).toContain(escape(v));
    });
  });

  it('styles the section with lab theme tokens', () => {
    expect(css).toContain('.gt-lab-settings__vibration-help');
    const block = css.slice(css.indexOf('/* Device vibration help */'));
    expect(block).toContain('--gt-copper');
    expect(block).toContain('--gt-green');
    expect(block).toContain('--gt-card-bg');
  });
});
