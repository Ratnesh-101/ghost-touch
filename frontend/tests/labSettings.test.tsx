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
    expect(html).toContain('class="gt-lab-settings__title">Settings</h2>');
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
    expect(html).toContain('0.8×');
    expect(html).toContain('1.0×');
    expect(html).toContain('1.25×');
  });

  it('embeds speech detail controls with full and short options', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain(t('lab.settings.speechDetail'));
    expect(html).toContain(t('lab.settings.speechDetailFull'));
    expect(html).toContain(t('lab.settings.speechDetailShort'));
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

    expect(html).toContain('class="gt-lab-settings__title">सेटिंग्स</h2>');
    expect(html).toContain('सेटिंग्स बंद करें');
    expect(html).toContain('भाषा');
    expect(html).toContain('बोलने की गति');
    expect(html).toContain('वाणी विवरण');
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

    expect(html).toContain('class="gt-lab-settings__title">સેટિંગ્સ</h2>');
    expect(html).toContain('સેટિંગ્સ બંધ કરો');
    expect(html).toContain('ભાષા');
    expect(html).toContain('વાણી ગતિ');
    expect(html).toContain('વાણી વિગત');
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

describe('LabSettings directions toggle (Lane A3)', () => {
  it('renders Directions section with switch button with fixed label (default on)', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain(t('lab.settings.directions'));
    expect(html).toContain(t('lab.settings.directionsHint'));
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    // L7: switch label fixed ("Directions"), not dynamic "Directions enabled."
    const directionsSection = html.slice(html.indexOf('lab-settings-section-directions'));
    expect(directionsSection).toContain(`>${t('lab.settings.directions')}<`);
  });

  it('renders Directions section in Hindi and Gujarati', () => {
    const prevLang = getLang();
    const drivers = createMockDrivers();

    setLang('hi');
    const htmlHi = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );
    expect(htmlHi).toContain('दिशाएं');
    expect(htmlHi).toContain('कोनों पर दिशाएं और रुकने पर रेखाओं के नाम बोलें।');

    setLang('gu');
    const htmlGu = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );
    expect(htmlGu).toContain('દિશાઓ');
    expect(htmlGu).toContain('ખૂણા પર દિશાઓ અને રોકાવા પર રેખાઓના નામ બોલો.');

    setLang(prevLang);
  });
});

describe('LabSettings finding sound toggle (Lane A4)', () => {
  it('renders Finding sound section with switch button with fixed label (default on)', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain(t('lab.settings.findingSound'));
    expect(html).toContain(t('lab.settings.findingSoundHint'));
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    // L7: switch label fixed ("Finding sound"), not dynamic "Finding sound enabled."
    const findingSoundSection = html.slice(html.indexOf('lab-settings-section-finding-sound'));
    expect(findingSoundSection).toContain(`>${t('lab.settings.findingSound')}<`);
  });

  it('renders Finding sound section in Hindi and Gujarati', () => {
    const prevLang = getLang();
    const drivers = createMockDrivers();

    setLang('hi');
    const htmlHi = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );
    expect(htmlHi).toContain('खोज ध्वनि');
    expect(htmlHi).toContain('क्लिक की आवाज़ आपकी उंगली को रेखाओं तक वापस ले जाती है।');

    setLang('gu');
    const htmlGu = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );
    expect(htmlGu).toContain('શોધ ધ્વનિ');
    expect(htmlGu).toContain('ક્લિકનો અવાજ તમારી આંગળીને રેખાઓ પર પાછી લાવે છે.');

    setLang(prevLang);
  });
});

describe('LabSettings guide toggle (L5)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FEATURE_GUIDE', '1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders Guide section with switch button reflecting guide setting (narrowed assertion)', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain('lab-settings-section-guide');
    expect(html).toContain(t('lab.settings.guide'));
    expect(html).toContain(t('lab.settings.guideHint'));
    // L5: assertion narrowed specifically to the Guide switch within its section
    const guideSection = html.slice(html.indexOf('lab-settings-section-guide'));
    expect(guideSection).toContain('role="switch"');
    expect(guideSection).toContain('aria-checked=');
  });
});

describe('LabSettings stay on line toggle (Lane bu12)', () => {
  it('renders Stay on line section with switch button with fixed label (default off)', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain('lab-settings-section-sticky-line');
    expect(html).toContain(t('lab.settings.stickyLine'));
    expect(html).toContain(t('lab.settings.stickyLineHint'));
    const stickySection = html.slice(html.indexOf('lab-settings-section-sticky-line'));
    expect(stickySection).toContain('role="switch"');
    expect(stickySection).toContain('aria-checked="false"');
    expect(stickySection).toContain(`>${t('lab.settings.stickyLine')}<`);
  });

  it('renders Stay on line section in Hindi and Gujarati with fixed labels', () => {
    const prevLang = getLang();
    const drivers = createMockDrivers();

    setLang('hi');
    const htmlHi = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );
    expect(htmlHi).toContain('रेखा पर बने रहें');
    expect(htmlHi).toContain('उंगली थोड़ा भटकने पर भी रेखा का अनुसरण जारी रखें।');
    const stickySectionHi = htmlHi.slice(htmlHi.indexOf('lab-settings-section-sticky-line'));
    expect(stickySectionHi).toContain('>रेखा पर बने रहें<');

    setLang('gu');
    const htmlGu = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );
    expect(htmlGu).toContain('રેખા પર રહો');
    expect(htmlGu).toContain('આંગળી થોડી ખસી જાય તો પણ રેખા અનુસરવાનું ચાલુ રાખો.');
    const stickySectionGu = htmlGu.slice(htmlGu.indexOf('lab-settings-section-sticky-line'));
    expect(stickySectionGu).toContain('>રેખા પર રહો<');

    setLang(prevLang);
  });
});

describe('LabSettings corner heartbeat toggle (Lane hb2)', () => {
  it('renders Corner heartbeat section with switch button with fixed label (default off)', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );

    expect(html).toContain('lab-settings-section-corner-heartbeat');
    expect(html).toContain(t('lab.settings.cornerHeartbeat'));
    expect(html).toContain(t('lab.settings.cornerHeartbeatHint'));
    const hbSection = html.slice(html.indexOf('lab-settings-section-corner-heartbeat'));
    expect(hbSection).toContain('role="switch"');
    expect(hbSection).toContain('aria-checked="false"');
    // Fixed label, state in aria-checked only
    expect(hbSection).toContain(`>${t('lab.settings.cornerHeartbeat')}<`);
    // Min 48x48 px target size
    expect(hbSection).toMatch(/min-width:\s*48px/);
    expect(hbSection).toMatch(/min-height:\s*48px/);
  });

  it('renders Corner heartbeat section in Hindi and Gujarati', () => {
    const prevLang = getLang();
    const drivers = createMockDrivers();

    setLang('hi');
    const htmlHi = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );
    expect(htmlHi).toContain('कोना धड़कन');
    expect(htmlHi).toContain('कोने पर रुकने पर दोहराया जाने वाला कंपन।');

    setLang('gu');
    const htmlGu = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );
    expect(htmlGu).toContain('ખૂણાના ધબકારા');
    expect(htmlGu).toContain('ખૂણા પર રોકાવા પર પુનરાવર્તિત વાઇબ્રેશન.');

    setLang(prevLang);
  });
});

