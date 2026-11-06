import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { LanguageSelector } from '../src/components/LanguageSelector';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { getLang, setLang, subscribeLang, t, type Lang } from '../src/i18n';

const createMockDrivers = (): Drivers => ({
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
  diagramStore: new MemoryDiagramStore(),
});

describe('Finding 10: language change screen re-render', () => {
  beforeEach(() => {
    setLang('en');
  });

  afterEach(() => {
    setLang('en');
  });

  it('subscribeLang notifies registered listeners on setLang', () => {
    const received: Lang[] = [];
    const unsubscribe = subscribeLang((lang) => {
      received.push(lang);
    });

    setLang('hi');
    setLang('gu');
    setLang('en');

    expect(received).toEqual(['hi', 'gu', 'en']);
    unsubscribe();

    setLang('hi');
    expect(received).toEqual(['hi', 'gu', 'en']);
  });

  it('App screen labels update when language is changed to Hindi', () => {
    // Initial English
    expect(getLang()).toBe('en');
    let html = renderToStaticMarkup(createElement(App));
    expect(html).toContain(t('start.intro'));
    expect(html).toContain('gt-start-surface');

    // Switch to Hindi
    setLang('hi');
    expect(getLang()).toBe('hi');
    html = renderToStaticMarkup(createElement(App));
    expect(html).toContain(t('start.intro'));
    expect(html).toContain('घोस्ट टच');

    // Switch to Gujarati
    setLang('gu');
    expect(getLang()).toBe('gu');
    html = renderToStaticMarkup(createElement(App));
    expect(html).toContain(t('start.intro'));
    expect(html).toContain('ગોસ્ટ ટચ');
  });

  it('LanguageSelector renders current active language and speaks confirmation', () => {
    const drivers = createMockDrivers();
    setLang('en');

    const htmlEn = renderToStaticMarkup(createElement(LanguageSelector, { drivers }));
    // English button should be marked active
    expect(htmlEn).toContain('aria-pressed="true"');
    expect(htmlEn).toContain('English');

    // Change to Hindi
    setLang('hi');
    const htmlHi = renderToStaticMarkup(createElement(LanguageSelector, { drivers }));
    expect(htmlHi).toContain('हिन्दी');
    expect(htmlHi).toContain('aria-pressed="true"');
  });
});
