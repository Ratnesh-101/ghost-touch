/**
 * RateSelector Component Tests
 *
 * Speech-rate controls (slow / normal / fast: 0.8x / 1.0x / 1.25x).
 *
 * Covers:
 * - WAI-ARIA group semantics, role="group", aria-label, aria-pressed on options
 * - 48x48 CSS px touch targets (Requirement 12.1) via .gt-control and .gt-rate-selector__btn
 * - Initial state resolution from drivers.speech.getRate() and default fallback
 * - Keyboard / click selection handling (handleSelect) and setRate invocation
 * - Spoken confirmation on selection and spoken label on focus for eyes-closed navigation
 * - Graceful behavior when drivers.speech.setRate is undefined
 * - Full localization across English (en), Hindi (hi), and Gujarati (gu)
 * - Container className propagation
 */

// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement, type JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateSelector } from '../src/components/RateSelector';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { getLang, LANG_BCP47, setLang, t, type Lang } from '../src/i18n';
import {
  getAccessibleName,
  getAllElements,
  parseHtml,
  type ParsedElement,
} from './helpers/a11yDom';

const globalCssPath = new URL('../src/styles/global.css', import.meta.url);
const globalCss = fs.readFileSync(globalCssPath, 'utf-8') as string;

function createMockDrivers(rateSetting: SpeechRateSetting = 'normal', options: { withoutSetRate?: boolean; withoutGetRate?: boolean } = {}): {
  drivers: Drivers;
  speakMock: ReturnType<typeof vi.fn>;
  setRateMock: ReturnType<typeof vi.fn>;
  getRateMock: ReturnType<typeof vi.fn>;
} {
  const speakMock = vi.fn();
  const setRateMock = vi.fn();
  const getRateMock = vi.fn((): SpeechRateSetting => rateSetting);

  const drivers: Drivers = {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
    speech: {
      speak: speakMock,
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      ...(options.withoutGetRate ? {} : { getRate: getRateMock }),
      ...(options.withoutSetRate ? {} : { setRate: setRateMock }),
    },
    diagramStore: new MemoryDiagramStore(),
  };

  return { drivers, speakMock, setRateMock, getRateMock };
}

interface CapturedButton {
  key: string;
  props: {
    'aria-pressed'?: boolean;
    'aria-label'?: string;
    className?: string;
    onClick?: () => void;
    onFocus?: () => void;
  };
}

function renderAndCaptureTree(drivers: Drivers, className = ''): { html: string; buttons: CapturedButton[] } {
  let captured: JSX.Element | null = null;
  function Harness(): JSX.Element {
    captured = RateSelector({ drivers, className });
    return captured;
  }
  const html = renderToStaticMarkup(createElement(Harness));
  const rawChildren = (captured as unknown as { props: { children: CapturedButton[] } })?.props?.children ?? [];
  return { html, buttons: Array.isArray(rawChildren) ? rawChildren : [] };
}

describe('RateSelector: ARIA Group Semantics & Accessible Names', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('renders a group container with role="group" and localized speech rate label', () => {
    const { drivers } = createMockDrivers('normal');
    const { html } = renderAndCaptureTree(drivers);

    expect(html).toContain('role="group"');
    expect(html).toContain(`aria-label="${t('rate.label')}"`);
    expect(html).toContain('Speech rate');

    const root = parseHtml(html);
    const groupEl = getAllElements(root).find((el) => el.attrs.role === 'group');
    expect(groupEl).toBeDefined();
    expect(groupEl?.attrs['aria-label']).toBe('Speech rate');
  });

  it('renders exactly three rate buttons for slow, normal, and fast', () => {
    const { drivers } = createMockDrivers('normal');
    const { html } = renderAndCaptureTree(drivers);

    const root = parseHtml(html);
    const buttons = getAllElements(root).filter((el) => el.tag === 'button');
    expect(buttons).toHaveLength(3);

    expect(html).toContain('0.8x');
    expect(html).toContain('1.0x');
    expect(html).toContain('1.25x');
  });

  it('provides descriptive accessible names on all rate options via aria-label', () => {
    const { drivers } = createMockDrivers('normal');
    const { html } = renderAndCaptureTree(drivers);

    const root = parseHtml(html);
    const buttons = getAllElements(root).filter((el) => el.tag === 'button');
    const idMap = new Map<string, ParsedElement>();
    const labelForMap = new Map<string, ParsedElement>();

    const names = buttons.map((btn) => getAccessibleName(btn, idMap, labelForMap));
    expect(names).toEqual([
      'Slow speech (0.8x)',
      'Normal speech (1.0x)',
      'Fast speech (1.25x)',
    ]);
  });
});

describe('RateSelector: 48×48 px Touch Targets & CSS (Requirement 12.1)', () => {
  it('assigns .gt-control and .gt-rate-selector__btn to all buttons', () => {
    const { drivers } = createMockDrivers('normal');
    const { html } = renderAndCaptureTree(drivers);

    const root = parseHtml(html);
    const buttons = getAllElements(root).filter((el) => el.tag === 'button');
    for (const btn of buttons) {
      expect(btn.attrs.class).toContain('gt-control');
      expect(btn.attrs.class).toContain('gt-rate-selector__btn');
    }
  });

  it('defines 48px minimum height and width in CSS for .gt-rate-selector__btn', () => {
    const match = /\.gt-rate-selector__btn\s*\{([^}]+)\}/s.exec(globalCss);
    expect(match).not.toBeNull();
    const rules = match?.[1] ?? '';
    expect(rules).toMatch(/min-width:\s*48px/);
    expect(rules).toMatch(/min-height:\s*48px/);
    expect(rules).toMatch(/min-width:\s*var\(--gt-target\)/);
  });

  it('applies custom className to the container when provided', () => {
    const { drivers } = createMockDrivers('normal');
    const { html } = renderAndCaptureTree(drivers, 'gt-settings__section-rate');

    expect(html).toContain('gt-rate-selector');
    expect(html).toContain('gt-settings__section-rate');
  });
});

describe('RateSelector: State Resolution & aria-pressed', () => {
  it('initializes with "normal" selected by default when drivers return normal', () => {
    const { drivers } = createMockDrivers('normal');
    const { buttons, html } = renderAndCaptureTree(drivers);

    expect(buttons[0]?.props['aria-pressed']).toBe(false);
    expect(buttons[1]?.props['aria-pressed']).toBe(true);
    expect(buttons[2]?.props['aria-pressed']).toBe(false);

    expect(buttons[1]?.props.className).toContain('gt-rate-selector__btn--active');
    expect(buttons[0]?.props.className).not.toContain('gt-rate-selector__btn--active');

    expect(html).toContain('aria-pressed="true"');
  });

  it('initializes with "slow" selected when driver reports slow', () => {
    const { drivers } = createMockDrivers('slow');
    const { buttons } = renderAndCaptureTree(drivers);

    expect(buttons[0]?.props['aria-pressed']).toBe(true);
    expect(buttons[1]?.props['aria-pressed']).toBe(false);
    expect(buttons[2]?.props['aria-pressed']).toBe(false);

    expect(buttons[0]?.props.className).toContain('gt-rate-selector__btn--active');
    expect(buttons[1]?.props.className).not.toContain('gt-rate-selector__btn--active');
  });

  it('initializes with "fast" selected when driver reports fast', () => {
    const { drivers } = createMockDrivers('fast');
    const { buttons } = renderAndCaptureTree(drivers);

    expect(buttons[0]?.props['aria-pressed']).toBe(false);
    expect(buttons[1]?.props['aria-pressed']).toBe(false);
    expect(buttons[2]?.props['aria-pressed']).toBe(true);

    expect(buttons[2]?.props.className).toContain('gt-rate-selector__btn--active');
  });

  it('falls back to "normal" when drivers.speech.getRate is undefined', () => {
    const { drivers } = createMockDrivers('normal', { withoutGetRate: true });
    const { buttons } = renderAndCaptureTree(drivers);

    expect(buttons[1]?.props['aria-pressed']).toBe(true);
  });
});

describe('RateSelector: Click & Selection Handling (handleSelect)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('clicking slow updates rate, invokes drivers.speech.setRate("slow"), and speaks confirmation', () => {
    const { drivers, setRateMock, speakMock } = createMockDrivers('normal');
    const { buttons } = renderAndCaptureTree(drivers);

    buttons[0]?.props.onClick?.();

    expect(setRateMock).toHaveBeenCalledTimes(1);
    expect(setRateMock).toHaveBeenCalledWith('slow');

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Speech rate set to slow.', LANG_BCP47['en']);
  });

  it('clicking normal invokes setRate("normal") and speaks confirmation', () => {
    const { drivers, setRateMock, speakMock } = createMockDrivers('slow');
    const { buttons } = renderAndCaptureTree(drivers);

    buttons[1]?.props.onClick?.();

    expect(setRateMock).toHaveBeenCalledTimes(1);
    expect(setRateMock).toHaveBeenCalledWith('normal');

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Speech rate set to normal.', LANG_BCP47['en']);
  });

  it('clicking fast invokes setRate("fast") and speaks confirmation', () => {
    const { drivers, setRateMock, speakMock } = createMockDrivers('normal');
    const { buttons } = renderAndCaptureTree(drivers);

    buttons[2]?.props.onClick?.();

    expect(setRateMock).toHaveBeenCalledTimes(1);
    expect(setRateMock).toHaveBeenCalledWith('fast');

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Speech rate set to fast.', LANG_BCP47['en']);
  });

  it('safely handles selection when drivers.speech.setRate is undefined', () => {
    const { drivers, speakMock } = createMockDrivers('normal', { withoutSetRate: true });
    const { buttons } = renderAndCaptureTree(drivers);

    expect(() => buttons[0]?.props.onClick?.()).not.toThrow();
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Speech rate set to slow.', LANG_BCP47['en']);
  });
});

describe('RateSelector: Eyes-Closed Navigation Focus & Click Handling (A11Y-02)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('focusing slow button does not speak; click speaks once with current BCP47 language', () => {
    const { drivers, speakMock } = createMockDrivers('normal');
    const { buttons } = renderAndCaptureTree(drivers);

    buttons[0]?.props.onFocus?.();
    expect(speakMock).not.toHaveBeenCalled();

    buttons[0]?.props.onClick?.();
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Speech rate set to slow.', LANG_BCP47['en']);
  });

  it('focusing normal button does not speak; click speaks once', () => {
    const { drivers, speakMock } = createMockDrivers('slow');
    const { buttons } = renderAndCaptureTree(drivers);

    buttons[1]?.props.onFocus?.();
    expect(speakMock).not.toHaveBeenCalled();

    buttons[1]?.props.onClick?.();
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Speech rate set to normal.', LANG_BCP47['en']);
  });

  it('focusing fast button does not speak; click speaks once', () => {
    const { drivers, speakMock } = createMockDrivers('normal');
    const { buttons } = renderAndCaptureTree(drivers);

    buttons[2]?.props.onFocus?.();
    expect(speakMock).not.toHaveBeenCalled();

    buttons[2]?.props.onClick?.();
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Speech rate set to fast.', LANG_BCP47['en']);
  });
});

describe('RateSelector: Multilingual Support (Hindi & Gujarati)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('renders and speaks correctly in Hindi (hi)', () => {
    setLang('hi');
    const { drivers, speakMock, setRateMock } = createMockDrivers('normal');
    const { html, buttons } = renderAndCaptureTree(drivers);

    expect(html).toContain('बोलने की गति');
    expect(html).toContain('धीमी गति');
    expect(html).toContain('सामान्य गति');
    expect(html).toContain('तेज़ गति');

    // Test selection in Hindi
    buttons[0]?.props.onClick?.();
    expect(setRateMock).toHaveBeenCalledWith('slow');
    expect(speakMock).toHaveBeenCalledWith('बोलने की गति धीमी कर दी गई है।', 'hi-IN');

    // Test focus does not speak in Hindi; click speaks once with Hindi confirmation
    buttons[2]?.props.onFocus?.();
    expect(speakMock).toHaveBeenCalledTimes(1);

    buttons[2]?.props.onClick?.();
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(speakMock).toHaveBeenLastCalledWith('बोलने की गति तेज़ कर दी गई है।', 'hi-IN');
  });

  it('renders and speaks correctly in Gujarati (gu)', () => {
    setLang('gu');
    const { drivers, speakMock, setRateMock } = createMockDrivers('normal');
    const { html, buttons } = renderAndCaptureTree(drivers);

    expect(html).toContain('વાણી ગતિ');
    expect(html).toContain('ધીમી વાણી');
    expect(html).toContain('સામાન્ય વાણી');
    expect(html).toContain('ઝડપી વાણી');

    // Test selection in Gujarati
    buttons[2]?.props.onClick?.();
    expect(setRateMock).toHaveBeenCalledWith('fast');
    expect(speakMock).toHaveBeenCalledWith('વાણી ગતિ ઝડપી કરી દેવામાં આવી છે.', 'gu-IN');

    // Test focus does not speak in Gujarati; click speaks once with Gujarati confirmation
    buttons[1]?.props.onFocus?.();
    expect(speakMock).toHaveBeenCalledTimes(1);

    buttons[1]?.props.onClick?.();
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(speakMock).toHaveBeenLastCalledWith('વાણી ગતિ સામાન્ય કરી દેવામાં આવી છે.', 'gu-IN');
  });
});
