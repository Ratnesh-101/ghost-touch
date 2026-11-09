/**
 * Regression test suite for Lane m1-a11y-fixes
 *
 * Verifies all findings addressed in Lane m1-a11y-fixes:
 * - A11Y-01: Explore canvas accessible name persistently exposed (role="img",
 *   aria-label matching canvasAriaLabel in en/hi/gu, never suppressed when speech active).
 * - A11Y-04: document.documentElement.lang synchronized on initial load and on every
 *   language change to matching BCP-47 tags (en, hi, gu).
 * - A11Y-02: Language and speech rate selector buttons have zero dual-voice speech collision
 *   on focus (no onFocus speech handlers); selecting an option produces exactly ONE spoken confirmation.
 * - A11Y-03: Honesty banner interactive control is an AccessibleButton (real button, >= 48x48 CSS px,
 *   aria-label from share.honesty, no "verified" added to new strings).
 * - A11Y-08: Error text contrast uses --gt-danger-text (#ff7b72) meeting WCAG AAA (>= 7.0:1) on dark bg.
 * - A11Y-09: LanguageSelector uses <div role="group"> instead of conflicting <nav> inside dialogs.
 * - A11Y-10: Decorative Logo SVGs (decorative=true) omit the internal <title> element to prevent SR leakage.
 */

// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement, type JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { canvasAriaLabel } from '../src/flow/navigation';
import {
  DOC_LANG_TAGS,
  getLang,
  setDocumentLang,
  setLang,
  t,
  updateDocumentLang,
  type Lang,
} from '../src/i18n';
import { LanguageSelector } from '../src/components/LanguageSelector';
import { RateSelector } from '../src/components/RateSelector';
import { VerifiedBanner } from '../src/components/VerifiedBanner';
import { Logo } from '../src/components/Logo';
import {
  Explore,
} from '../src/screens/Explore';
import { contrastRatio, parseColourTokens } from './a11y.contrast.test';

function createMockDrivers(overrides?: Partial<Drivers>): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'locked',
    },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn((): SpeechRateSetting => 'normal'),
      setRate: vi.fn(),
    },
    diagramStore: new MemoryDiagramStore(),
    ...overrides,
  };
}

describe('A11Y-01: Explore canvas accessible name', () => {
  let prevLang: Lang;
  const triangleScene: DiagramScene = {
    kind: 'geometry',
    title: 'Right Triangle ABC',
    points: [
      { id: 'p1', x: 0.2, y: 0.8, label: 'A' },
      { id: 'p2', x: 0.8, y: 0.8, label: 'B' },
      { id: 'p3', x: 0.2, y: 0.2, label: 'C' },
    ],
  };

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('renders canvas with role="img" and persistent aria-label with active speech', () => {
    const drivers = createMockDrivers({
      speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
    });
    const prompt = 'Right Triangle ABC. Double-tap and hold, then drag to feel the diagram.';

    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: triangleScene,
        announced: prompt,
        drivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('<canvas');
    expect(html).toContain('role="img"');
    expect(html).toContain(`aria-label="${canvasAriaLabel(triangleScene)}"`);
    expect(html).toContain('Right Triangle ABC');
    expect(html).toContain(t('explore.gestureHint'));
  });

  it('renders localized canvas aria-label in Hindi', () => {
    setLang('hi');
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: triangleScene,
        announced: 'Prompt',
        drivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('role="img"');
    expect(html).toContain('डबल-टैप करके दबाए रखें');
    expect(html).toContain(t('explore.gestureHint'));
  });

  it('renders localized canvas aria-label in Gujarati', () => {
    setLang('gu');
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: triangleScene,
        announced: 'Prompt',
        drivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('role="img"');
    expect(html).toContain('ડબલ-ટેપ કરીને દબાવી રાખો');
    expect(html).toContain(t('explore.gestureHint'));
  });

  it('renders canvas element with component real aria-label matching canvasAriaLabel', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: triangleScene,
        announced: 'Prompt',
        drivers,
        onBack: vi.fn(),
      }),
    );
    expect(html).toContain(`aria-label="${canvasAriaLabel(triangleScene)}"`);
  });
});

describe('A11Y-04: document.documentElement.lang synchronization', () => {
  let prevLang: Lang;
  let originalDoc: typeof globalThis.document;

  beforeEach(() => {
    prevLang = getLang();
    originalDoc = globalThis.document;
    // Mock minimal document in Node environment
    globalThis.document = {
      documentElement: { lang: 'en' },
    } as unknown as Document;
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
    globalThis.document = originalDoc;
  });

  it('defines BCP-47 root document tags for all supported languages', () => {
    expect(DOC_LANG_TAGS.en).toBe('en');
    expect(DOC_LANG_TAGS.hi).toBe('hi');
    expect(DOC_LANG_TAGS.gu).toBe('gu');
  });

  it('updates document.documentElement.lang when setLang is called', () => {
    setLang('hi');
    expect(document.documentElement.lang).toBe('hi');

    setLang('gu');
    expect(document.documentElement.lang).toBe('gu');

    setLang('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('updateDocumentLang sets document.documentElement.lang directly', () => {
    const resHi = updateDocumentLang('hi');
    expect(resHi).toBe('hi');
    expect(document.documentElement.lang).toBe('hi');

    const resGu = setDocumentLang('gu');
    expect(resGu).toBe('gu');
    expect(document.documentElement.lang).toBe('gu');
  });

  it('updateDocumentLang handles missing document gracefully in SSR/Node', () => {
    // @ts-expect-error simulate non-DOM environment
    globalThis.document = undefined;
    expect(() => updateDocumentLang('hi')).not.toThrow();
    expect(updateDocumentLang('hi')).toBe('hi');
  });
});

interface CapturedOptionButton {
  key: string;
  props: {
    'aria-pressed'?: boolean;
    'aria-label'?: string;
    className?: string;
    onClick?: () => void;
    onFocus?: () => void;
  };
}

function renderAndCaptureLanguageSelector(
  drivers: Drivers,
  className = '',
): { html: string; buttons: CapturedOptionButton[] } {
  let captured: JSX.Element | null = null;
  function Harness(): JSX.Element {
    captured = LanguageSelector({ drivers, className });
    return captured;
  }
  const html = renderToStaticMarkup(createElement(Harness));
  const rawChildren =
    (captured as unknown as { props: { children: CapturedOptionButton[] } })
      ?.props?.children ?? [];
  return { html, buttons: Array.isArray(rawChildren) ? rawChildren : [] };
}

function renderAndCaptureRateSelector(
  drivers: Drivers,
  className = '',
): { html: string; buttons: CapturedOptionButton[] } {
  let captured: JSX.Element | null = null;
  function Harness(): JSX.Element {
    captured = RateSelector({ drivers, className });
    return captured;
  }
  const html = renderToStaticMarkup(createElement(Harness));
  const rawChildren =
    (captured as unknown as { props: { children: CapturedOptionButton[] } })
      ?.props?.children ?? [];
  return { html, buttons: Array.isArray(rawChildren) ? rawChildren : [] };
}

interface CapturedHonestyButton {
  props: {
    className?: string;
    'aria-label'?: string;
    onClick?: () => void;
  };
}

function renderAndCaptureVerifiedBanner(props: {
  by: string;
  note?: string;
  onSpeak?: (text: string) => void;
}): { html: string; honestyButton?: CapturedHonestyButton } {
  let captured: JSX.Element | null = null;
  function Harness(): JSX.Element {
    captured = VerifiedBanner(props);
    return captured;
  }
  const html = renderToStaticMarkup(createElement(Harness));
  const rawChildren =
    (captured as unknown as { props: { children: CapturedHonestyButton[] } })
      ?.props?.children ?? [];
  const honestyButton = Array.isArray(rawChildren) ? rawChildren[1] : undefined;
  return { html, honestyButton };
}

describe('A11Y-02: Settings selectors single spoken confirmation', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('LanguageSelector buttons do not attach onFocus speech handlers', () => {
    const drivers = createMockDrivers();
    const { buttons } = renderAndCaptureLanguageSelector(drivers);

    expect(buttons.length).toBe(3);
    for (const btn of buttons) {
      expect(btn.props.onFocus).toBeUndefined();
    }
  });

  it('LanguageSelector clicking language fires speech.speak once', () => {
    const drivers = createMockDrivers();
    const { buttons } = renderAndCaptureLanguageSelector(drivers);

    // Trigger second button (Hindi)
    const hiBtn = buttons[1]!;
    hiBtn.props.onClick!();

    expect(drivers.speech.speak).toHaveBeenCalledTimes(1);
    expect(drivers.speech.speak).toHaveBeenCalledWith(t('lang.changedHi'), 'hi-IN');
    expect(getLang()).toBe('hi');
  });

  it('LanguageSelector uses <div role="group"> instead of <nav> (A11Y-09)', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(createElement(LanguageSelector, { drivers }));

    expect(html).toContain('<div class="gt-lang-selector');
    expect(html).toContain('role="group"');
    expect(html).not.toContain('<nav');
  });

  it('RateSelector buttons do not attach onFocus speech handlers', () => {
    const drivers = createMockDrivers();
    const { buttons } = renderAndCaptureRateSelector(drivers);

    expect(buttons.length).toBe(3);
    for (const btn of buttons) {
      expect(btn.props.onFocus).toBeUndefined();
    }
  });

  it('RateSelector clicking a rate option fires speech.speak once', () => {
    const drivers = createMockDrivers();
    const { buttons } = renderAndCaptureRateSelector(drivers);

    // Trigger fast rate button (index 2)
    const fastBtn = buttons[2]!;
    fastBtn.props.onClick!();

    expect(drivers.speech.speak).toHaveBeenCalledTimes(1);
    expect(drivers.speech.setRate).toHaveBeenCalledWith('fast');
    expect(drivers.speech.speak).toHaveBeenCalledWith(t('rate.setFast'), 'en-IN');
  });
});

describe('A11Y-03: Honesty / Verified banner interactive control', () => {
  const exploreCssPath = new URL('../src/styles/explore.css', import.meta.url);
  const exploreCss = fs.readFileSync(exploreCssPath, 'utf-8') as string;

  it('renders honesty notice as an AccessibleButton, not a <p role="note">', () => {
    const onSpeak = vi.fn();
    const html = renderToStaticMarkup(
      createElement(VerifiedBanner, {
        by: 'Teacher Sarah',
        note: 'Important diagram note',
        onSpeak,
      }),
    );

    // Must be a button
    expect(html).toMatch(/<button[^>]*class="[^"]*gt-verified-banner__honesty/);
    expect(html).toContain('gt-control');
    expect(html).toContain(`aria-label="${t('share.honesty')}"`);
    expect(html).not.toMatch(/<p[^>]*class="[^"]*gt-verified-banner__honesty/);
    expect(html).not.toContain('role="note"');
  });

  it('honesty button activates on click and calls onSpeak with share.honesty', () => {
    const onSpeak = vi.fn();
    const { honestyButton } = renderAndCaptureVerifiedBanner({
      by: 'Teacher Sarah',
      onSpeak,
    });

    // The honesty button is the second child in VerifiedBanner aside element
    expect(honestyButton).toBeDefined();
    expect(honestyButton?.props['aria-label']).toBe(t('share.honesty'));

    honestyButton?.props.onClick?.();
    expect(onSpeak).toHaveBeenCalledTimes(1);
    expect(onSpeak).toHaveBeenCalledWith(t('share.honesty'));
  });

  it('defines touch target min-height >= 48px on .gt-verified-banner__honesty', () => {
    const pattern = /\.gt-verified-banner__honesty\s*\{[^}]*min-height:\s*var\(--gt-target,\s*48px\)/s;
    expect(exploreCss).toMatch(pattern);
  });

  it('retains unverified meaning without adding "verified" to new strings', () => {
    const text = t('share.honesty');
    expect(text.toLowerCase()).toContain('not verified');
    expect(text.toLowerCase()).not.toContain('person reviewed');
  });
});

describe('A11Y-08 & A11Y-10: Contrast tokens and decorative Logo SVGs', () => {
  const tokensPath = new URL('../src/styles/tokens.css', import.meta.url);
  const tokensCss = fs.readFileSync(tokensPath, 'utf-8') as string;
  const tokens = parseColourTokens(tokensCss);

  const correctCssPath = new URL('../src/styles/correct.css', import.meta.url);
  const correctCss = fs.readFileSync(correctCssPath, 'utf-8') as string;

  it('defines --gt-danger-text meeting WCAG AAA (>= 7.0:1) on background', () => {
    expect(tokens['--gt-danger-text']).toBeDefined();
    expect(tokens['--gt-danger-text']).toBe('#ff7b72');

    const dangerText = tokens['--gt-danger-text']!;
    const bg = tokens['--gt-bg']!;
    const ratio = contrastRatio(dangerText, bg);

    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it('uses --gt-danger-text on .gt-correct__status--error in correct.css', () => {
    const pattern = /\.gt-correct__status--error\s*\{[^}]*color:\s*var\(--gt-danger-text/s;
    expect(correctCss).toMatch(pattern);
  });

  it('Logo component omits internal <title> when decorative=true (A11Y-10)', () => {
    const markHtml = renderToStaticMarkup(
      createElement(Logo, { variant: 'mark', decorative: true }),
    );
    expect(markHtml).toContain('aria-hidden="true"');
    expect(markHtml).not.toContain('<title');

    const fullHtml = renderToStaticMarkup(
      createElement(Logo, { variant: 'full', decorative: true }),
    );
    expect(fullHtml).toContain('aria-hidden="true"');
    expect(fullHtml).not.toContain('<title');
  });

  it('Logo component preserves internal <title> when decorative=false', () => {
    const html = renderToStaticMarkup(
      createElement(Logo, { variant: 'mark', decorative: false }),
    );
    expect(html).toContain('<title>Ghost Touch</title>');
  });
});
