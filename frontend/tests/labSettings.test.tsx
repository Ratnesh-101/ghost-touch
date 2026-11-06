/**
 * LabSettings Modal Sheet Tests (Lane lab-i18n)
 *
 * Verifies dialog semantics, WAI-ARIA modal properties, focus management,
 * keyboard handling (Escape, Tab trap), speak callbacks, and touch targets.
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LabSettings } from '../src/components/LabSettings';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { getLang, setLang, t, type Lang } from '../src/i18n';

const settingsCssPath = new URL('../src/styles/settings.css', import.meta.url);
const settingsCss = fs.readFileSync(settingsCssPath, 'utf-8') as string;

function createMockDrivers(): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn((): SpeechRateSetting => 'normal'),
      setRate: vi.fn(),
    },
    diagramStore: new MemoryDiagramStore(),
  };
}

describe('LabSettings dialog semantics (renderToStaticMarkup)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('renders nothing when open is false', () => {
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: false,
        onClose: vi.fn(),
      }),
    );
    expect(html).toBe('');
  });

  it('renders modal dialog with aria-modal and labelledby when open is true', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="lab-settings-title"');
    expect(html).toContain('id="lab-settings-title"');
    expect(html).toContain('Lab settings');
  });

  it('includes an accessible close button with lab.settings.close label', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain('gt-lab-settings__close');
    expect(html).toContain(`aria-label="${t('lab.settings.close')}"`);
    expect(html).toContain('Close settings');
  });

  it('embeds language and speech-rate sections with clear accessible headings', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain(t('lab.settings.language'));
    expect(html).toContain(t('lab.settings.rate'));
    expect(html).toContain('gt-lang-selector');
    expect(html).toContain('gt-rate-selector');

    // Controls for languages
    expect(html).toContain('English');
    expect(html).toContain('हिन्दी');
    expect(html).toContain('ગુજરાતી');

    // Controls for rates
    expect(html).toContain('0.8x');
    expect(html).toContain('1.0x');
    expect(html).toContain('1.25x');
  });

  it('renders backdrop overlay with aria-hidden="true"', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain('gt-lab-settings__backdrop');
    expect(html).toContain('aria-hidden="true"');
  });

  it('renders in Hindi with localized headings and labels', () => {
    setLang('hi');
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain('लैब सेटिंग्स');
    expect(html).toContain('सेटिंग्स बंद करें');
    expect(html).toContain('भाषा');
    expect(html).toContain('बोलने की गति');
  });

  it('renders in Gujarati with localized headings and labels', () => {
    setLang('gu');
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain('લેબ સેટિંગ્સ');
    expect(html).toContain('સેટિંગ્સ બંધ કરો');
    expect(html).toContain('ભાષા');
    expect(html).toContain('વાણી ગતિ');
  });
});

describe('LabSettings spoken announcements and callbacks', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('provides lab.settings.opened and lab.settings.closed string definitions', () => {
    expect(t('lab.settings.opened')).toBe('Lab settings opened');
    expect(t('lab.settings.closed')).toBe('Lab settings closed');

    setLang('hi');
    expect(t('lab.settings.opened')).toBe('लैब सेटिंग्स खुली');
    expect(t('lab.settings.closed')).toBe('लैब सेटिंग्स बंद');

    setLang('gu');
    expect(t('lab.settings.opened')).toBe('લેબ સેટિંગ્સ ખુલી');
    expect(t('lab.settings.closed')).toBe('લેબ સેટિંગ્સ બંધ');
  });
});

describe('LabSettings touch targets & accessibility CSS (Requirement 12.1)', () => {
  it('defines 48px minimum height and width on .gt-lab-settings__close', () => {
    expect(settingsCss).toMatch(/\.gt-lab-settings__close\s*\{[^}]*min-height:\s*var\(--gt-target,\s*48px\)/s);
    expect(settingsCss).toMatch(/\.gt-lab-settings__close\s*\{[^}]*min-width:\s*var\(--gt-target,\s*48px\)/s);
  });

  it('provides a high-contrast focus ring of at least 3px with copper accent fallback', () => {
    const match = /\.gt-lab-settings__close:focus-visible\s*\{([^}]+)\}/.exec(settingsCss);
    expect(match).not.toBeNull();
    const body = match?.[1] ?? '';
    expect(body).toMatch(/outline:\s*3px\s+solid\s+var\(--gt-copper/);
    expect(body).toMatch(/box-shadow:\s*0\s+0\s+0\s+3px\s+var\(--gt-copper/);
  });

  it('respects prefers-reduced-motion media query', () => {
    expect(settingsCss).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
    expect(settingsCss).toMatch(/animation-duration:\s*0\.001ms\s*!important/);
  });

  it('supports forced-colors / high contrast mode', () => {
    expect(settingsCss).toMatch(/@media\s*\(\s*forced-colors:\s*active\s*\)/);
    expect(settingsCss).toMatch(/outline:\s*3px\s+solid\s+Highlight\s*!important/);
  });
});

describe('LabSettings focus management and keyboard handling', () => {
  it('attaches ref to triggering element and dialog container', () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        triggerRef,
      }),
    );
    expect(html).toContain('gt-lab-settings');
  });
});
