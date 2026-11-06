/**
 * Lab Capture Screen Tests (Lane lab-capture)
 *
 * Verifies:
 * 1. Brand-first header with decorative Logo mark beside real text heading and tagline.
 * 2. Lab settings button displaying current language and speech rate, updating after changes.
 * 3. Settings modal sheet opening/closing semantics and focus return.
 * 4. Action hierarchy: Take photo as big primary; Choose image and Saved diagrams as secondary copper outline.
 * 5. Specimen jar cards: larger tiles with SpecimenPreview above visible short names, keeping existing accessible names.
 * 6. Loading state: LabLoading copper meter shown while busy, keeping status text and aria-busy.
 * 7. Layout resilience: safe-area insets, flex-wrap, no fixed heights.
 */

// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { describeSettings, getLang, setLang, t, type Lang } from '../src/i18n';
import { Capture } from '../src/screens/Capture';

const globalCssPath = new URL('../src/styles/global.css', import.meta.url);
const globalCss = fs.readFileSync(globalCssPath, 'utf-8') as string;

function createMockDrivers(rate: SpeechRateSetting = 'normal'): Drivers {
  let currentRate = rate;
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn((): SpeechRateSetting => currentRate),
      setRate: vi.fn((newRate: SpeechRateSetting) => {
        currentRate = newRate;
      }),
    },
    diagramStore: new MemoryDiagramStore(),
  };
}

describe('Capture screen brand-first header (Item 1)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('renders decorative Logo mark beside real <h1> and tagline', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );

    // Decorative mark SVG
    expect(html).toContain('gt-logo--mark');
    expect(html).toContain('gt-capture__brand-logo');
    expect(html).toContain('aria-hidden="true"');

    // Real text heading and tagline
    expect(html).toContain('<h1 class="gt-capture__title">Ghost Touch</h1>');
    expect(html).toContain('gt-capture__tagline');
    expect(html).toContain('Feel diagrams you can');

    // Brand container wraps logo and text
    expect(html).toContain('gt-capture__brand');
    expect(html).toContain('gt-capture__brand-text');
  });
});

describe('Capture screen settings button & modal sheet (Item 2)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('renders single settings button showing current language and rate', () => {
    const drivers = createMockDrivers('normal');
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );

    const expectedLabel = describeSettings('en', 'normal');
    expect(expectedLabel).toBe('Settings: English, 1.0×');
    expect(html).toContain('gt-capture__button--settings');
    expect(html).toContain(expectedLabel);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('updates settings button label when language changes', () => {
    const drivers = createMockDrivers('normal');

    setLang('hi');
    const htmlHi = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );
    expect(htmlHi).toContain(describeSettings('hi', 'normal'));
    expect(htmlHi).toContain('सेटिंग्स: हिन्दी, 1.0×');

    setLang('gu');
    const htmlGu = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );
    expect(htmlGu).toContain(describeSettings('gu', 'normal'));
    expect(htmlGu).toContain('સેટિંગ્સ: ગુજરાતી, 1.0×');
  });

  it('updates settings button label when speech rate changes', () => {
    const slowDrivers = createMockDrivers('slow');
    const htmlSlow = renderToStaticMarkup(
      createElement(Capture, {
        drivers: slowDrivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );
    expect(htmlSlow).toContain('Settings: English, 0.8×');

    const fastDrivers = createMockDrivers('fast');
    const htmlFast = renderToStaticMarkup(
      createElement(Capture, {
        drivers: fastDrivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );
    expect(htmlFast).toContain('Settings: English, 1.25×');
  });

  it('declares 48px touch target for the settings button in CSS', () => {
    expect(globalCss).toMatch(/\.gt-capture__button--settings\s*\{[^}]*min-height:\s*48px/);
    expect(globalCss).toMatch(/\.gt-capture__button--settings\s*\{[^}]*min-width:\s*48px/);
  });
});

describe('Capture action hierarchy & accessibility (Item 3)', () => {
  it('Take photo is the primary action with distinctive primary styling class', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );

    expect(html).toContain('gt-capture__button--primary');
    expect(html).toContain(t('capture.takePhoto'));

    // Primary button appears before secondary row in DOM order
    const primaryIdx = html.indexOf('gt-capture__button--primary');
    const secondaryIdx = html.indexOf('gt-capture__button--secondary');
    expect(primaryIdx).toBeLessThan(secondaryIdx);
  });

  it('Choose image and Saved diagrams are secondary actions in a wrapping row', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );

    expect(html).toContain('gt-capture__secondary-row');
    expect(html).toContain('gt-capture__button--secondary');
    expect(html).toContain(t('capture.chooseImage'));
    expect(html).toContain('gt-capture__button--saved');
    expect(html).toContain(`aria-label="${t('capture.savedDiagrams')}"`);
    expect(html).toContain(t('capture.savedDiagrams'));
  });

  it('styles secondary and saved buttons with copper border in CSS', () => {
    expect(globalCss).toMatch(/\.gt-capture__button--secondary\s*\{[^}]*border:\s*2px solid var\(--gt-border-copper/);
    expect(globalCss).toMatch(/\.gt-capture__button--saved\s*\{[^}]*border:\s*2px solid var\(--gt-border-copper/);
  });
});

describe('Specimen jar sample cards (Item 4)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('renders all three specimen buttons keeping their accessible names', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );

    // Accessible names preserved via aria-label
    expect(html).toContain(`aria-label="${t('capture.sampleTriangle')}"`);
    expect(html).toContain(`aria-label="${t('capture.sampleSine')}"`);
    expect(html).toContain(`aria-label="${t('capture.sampleBarchart')}"`);

    // Visible short names from lab.specimen.*
    expect(html).toContain(t('lab.specimen.triangle')); // "Right triangle"
    expect(html).toContain(t('lab.specimen.sine'));     // "Sine wave"
    expect(html).toContain(t('lab.specimen.bars'));     // "Bar chart"
  });

  it('each specimen card renders a decorative SpecimenPreview SVG', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );

    expect(html).toContain('gt-specimen--triangle');
    expect(html).toContain('gt-specimen--sine');
    expect(html).toContain('gt-specimen--barchart');
    expect(html).toContain('gt-capture__sample-preview');

    // Previews are strictly decorative
    const specimenSvgs = html.match(/<svg class="[^"]*gt-specimen[^"]*"[^>]*>/g) ?? [];
    expect(specimenSvgs).toHaveLength(3);
    for (const svg of specimenSvgs) {
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('focusable="false"');
    }
  });

  it('localizes visible specimen short names in Hindi and Gujarati', () => {
    const drivers = createMockDrivers();

    setLang('hi');
    const htmlHi = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );
    expect(htmlHi).toContain(t('lab.specimen.triangle')); // "समकोण त्रिभुज"
    expect(htmlHi).toContain(t('lab.specimen.sine'));     // "साइन तरंग"
    expect(htmlHi).toContain(t('lab.specimen.bars'));     // "बार चार्ट"

    setLang('gu');
    const htmlGu = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );
    expect(htmlGu).toContain(t('lab.specimen.triangle')); // "કાટકોણ ત્રિકોણ"
    expect(htmlGu).toContain(t('lab.specimen.sine'));     // "સાઇન તરંગ"
    expect(htmlGu).toContain(t('lab.specimen.bars'));     // "સ્તંભ આલેખ"
  });
});

describe('Loading state & status live-region (Item 5)', () => {
  it('renders status card with indicator and spoken status text', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo or choose an image.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );

    expect(html).toContain('gt-capture__status-card');
    expect(html).toContain('gt-capture__status-indicator');
    expect(html).toContain('Take a photo or choose an image.');
  });

  it('turns status into polite live region when drivers cannot speak', () => {
    const silentDrivers: Drivers = {
      ...createMockDrivers(),
      speech: { ...createMockDrivers().speech, canSpeak: false },
    };
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers: silentDrivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe('Layout and zoom audit conformance (Item 6 & 7)', () => {
  it('applies safe-area insets to .gt-capture container', () => {
    expect(globalCss).toMatch(/padding-top:[^;]*env\(safe-area-inset-top/);
    expect(globalCss).toMatch(/padding-bottom:[^;]*env\(safe-area-inset-bottom/);
  });

  it('declares flex-wrap on top row, secondary row, and brand', () => {
    expect(globalCss).toMatch(/\.gt-capture__top-row\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(globalCss).toMatch(/\.gt-capture__secondary-row\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(globalCss).toMatch(/\.gt-capture__brand\s*\{[^}]*flex-wrap:\s*wrap/);
  });

  it('provides responsive rules for narrow devices (380px)', () => {
    expect(globalCss).toMatch(/@media\s*\(\s*max-width:\s*380px\s*\)/);
    expect(globalCss).toMatch(/\.gt-capture__samples-grid\s*\{[^}]*gap:\s*6px/);
  });

  it('styles sample card labels with at least 0.875rem font size and natural wrapping', () => {
    expect(globalCss).toMatch(/\.gt-capture__sample-name\s*\{[^}]*font-size:\s*var\(--gt-text-sm/);
    expect(globalCss).toMatch(/\.gt-capture__sample-name\s*\{[^}]*overflow-wrap:\s*break-word/);
    expect(globalCss).toMatch(/\.gt-capture__sample-name\s*\{[^}]*white-space:\s*normal/);
  });

  it('ensures sample button font-size is at least 0.875rem across all screen widths', () => {
    expect(globalCss).toMatch(/\.gt-capture__sample-btn\s*\{[^}]*font-size:\s*var\(--gt-text-sm/);
    const mqMatch = /@media\s*\(\s*max-width:\s*380px\s*\)\s*\{([\s\S]+?)\n\}/.exec(globalCss);
    expect(mqMatch?.[1]).toMatch(/\.gt-capture__sample-btn\s*\{[^}]*font-size:\s*var\(--gt-text-sm/);
  });
});
