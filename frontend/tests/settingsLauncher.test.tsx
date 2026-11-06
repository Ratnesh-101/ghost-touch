/**
 * Unit tests for SettingsLauncher component (Lane lab-explore4)
 *
 * Verifies:
 * - Renders accessible launcher button displaying describeSettings(lang, rate)
 * - Has aria-haspopup="dialog" and aria-expanded state
 * - Reuses existing language and speech-rate selectors
 * - Conforms to >= 48x48 touch target requirement
 * - Updates button label when language changes (English, Hindi, Gujarati)
 * - Updates button label when speech rate changes (slow, normal, fast)
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsLauncher } from '../src/components/SettingsLauncher';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { setLang } from '../src/i18n';

describe('SettingsLauncher component', () => {
  let rate: SpeechRateSetting = 'normal';
  let drivers: Drivers;
  const speakMock = vi.fn();

  beforeEach(() => {
    rate = 'normal';
    setLang('en');
    drivers = {
      haptics: { supported: false, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
      speech: {
        speak: vi.fn(),
        listen: vi.fn(),
        canSpeak: true,
        canListen: true,
        getRate: () => rate,
        setRate: (r: SpeechRateSetting) => {
          rate = r;
        },
      },
      diagramStore: new MemoryDiagramStore(),
    };
    speakMock.mockClear();
  });

  it('renders button with describeSettings text and aria attributes', () => {
    const html = renderToStaticMarkup(createElement(SettingsLauncher, { drivers, speak: speakMock }));
    expect(html).toContain('Settings: English, 1.0×');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('declares touch target and control classes for >= 48px sizing', () => {
    const html = renderToStaticMarkup(createElement(SettingsLauncher, { drivers, speak: speakMock }));
    expect(html).toContain('gt-control');
    expect(html).toContain('gt-settings-launcher__button');
    expect(html).toContain('gt-capture__button--settings');
  });

  it('renders button with custom className when provided', () => {
    const html = renderToStaticMarkup(
      createElement(SettingsLauncher, { drivers, speak: speakMock, className: 'my-custom-class' }),
    );
    expect(html).toContain('my-custom-class');
    expect(html).toContain('gt-control');
  });

  it('updates button label when language changes', () => {
    setLang('en');
    const htmlEn = renderToStaticMarkup(createElement(SettingsLauncher, { drivers, speak: speakMock }));
    expect(htmlEn).toContain('Settings: English, 1.0×');

    setLang('hi');
    const htmlHi = renderToStaticMarkup(createElement(SettingsLauncher, { drivers, speak: speakMock }));
    expect(htmlHi).toContain('सेटिंग्स: हिन्दी, 1.0×');

    setLang('gu');
    const htmlGu = renderToStaticMarkup(createElement(SettingsLauncher, { drivers, speak: speakMock }));
    expect(htmlGu).toContain('સેટિંગ્સ: ગુજરાતી, 1.0×');
  });

  it('updates button label when speech rate changes via drivers.speech.getRate', () => {
    rate = 'slow';
    const htmlSlow = renderToStaticMarkup(createElement(SettingsLauncher, { drivers, speak: speakMock }));
    expect(htmlSlow).toContain('Settings: English, 0.8×');

    rate = 'fast';
    const htmlFast = renderToStaticMarkup(createElement(SettingsLauncher, { drivers, speak: speakMock }));
    expect(htmlFast).toContain('Settings: English, 1.25×');
  });
});
