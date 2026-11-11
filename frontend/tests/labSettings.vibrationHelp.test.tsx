// @vitest-environment jsdom
/**
 * Device vibration help section in LabSettings.
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
// @ts-expect-error Node.js runtime path module in Vitest node environment
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LabSettings } from '../src/components/LabSettings';
import { getLang, setLang, t, type Lang } from '../src/i18n';

declare const __dirname: string | undefined;

function readStyleFile(fileName: string): string {
  if (typeof __dirname !== 'undefined') {
    const p = path.resolve(__dirname, '../src/styles', fileName);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  }
  const frontendPath = path.resolve('frontend/src/styles', fileName);
  if (fs.existsSync(frontendPath)) return fs.readFileSync(frontendPath, 'utf-8');
  const srcPath = path.resolve('src/styles', fileName);
  if (fs.existsSync(srcPath)) return fs.readFileSync(srcPath, 'utf-8');
  return fs.readFileSync(
    path.resolve(__dirname ?? '.', '../src/styles', fileName),
    'utf-8',
  );
}

const css = readStyleFile('settings.css');

const KEYS = [
  'lab.settings.vibrationHelpTitle',
  'lab.settings.vibrationHelpIntro',
  'lab.settings.vibrationHelpSamsung',
  'lab.settings.vibrationHelpStock',
  'lab.settings.vibrationHelpOnePlus',
  'lab.settings.vibrationHelpXiaomi',
  'lab.settings.vibrationHelpNote',
] as const;

function render(): { html: string; container: HTMLDivElement } {
  const html = renderToStaticMarkup(
    createElement(LabSettings, { open: true, onClose: vi.fn() }),
  );
  const container = document.createElement('div');
  container.innerHTML = html;
  return { html, container };
}

describe('LabSettings vibration help', () => {
  let prev: Lang;
  beforeEach(() => {
    prev = getLang();
    setLang('en');
  });
  afterEach(() => setLang(prev));

  it('renders all instruction strings in English', () => {
    const { container } = render();
    const text = container.textContent ?? '';
    for (const key of KEYS) {
      const realStr = t(key);
      expect(realStr).not.toBe(key);
      expect(text).toContain(realStr);
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
    const { html, container } = render();
    expect(html).toContain('aria-labelledby="lab-settings-section-vibration"');
    expect(html).toMatch(
      /<h3 id="lab-settings-section-vibration"[^>]*>Device Vibration Settings<\/h3>/,
    );
    expect(html).toContain('id="lab-settings-vibration-intro"');
    expect(html).toContain('aria-describedby="lab-settings-vibration-intro"');
    expect((html.match(/<li>/g) ?? []).length).toBeGreaterThanOrEqual(4);

    const section = container.querySelector('section.gt-lab-settings__vibration-help');
    expect(section?.getAttribute('aria-labelledby')).toBe('lab-settings-section-vibration');
    const heading = container.querySelector('#lab-settings-section-vibration');
    expect(heading?.textContent).toBe('Device Vibration Settings');
  });

  it('uses unique ids', () => {
    const { html } = render();
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(['hi', 'gu'] as const)('translates into %s', (lang) => {
    setLang('en');
    const en = KEYS.map((k) => t(k));
    setLang(lang);
    const { container } = render();
    const text = container.textContent ?? '';
    KEYS.forEach((key, i) => {
      const v = t(key);
      expect(v).not.toBe(key);
      expect(v).not.toBe(en[i]);
      expect(text).toContain(v);
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
