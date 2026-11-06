/**
 * Start Screen Lab Redesign Verification Tests (Lane: lab-startscreen)
 *
 * Requirements (docs/briefs/agy-lab-startscreen.md & docs/briefs/lab-spec.md):
 * 1. Single full-screen button with aria-label={t('start.intro')}
 * 2. Entire hero inside button is aria-hidden="true"
 * 3. Hero contains:
 *    - Logo (full variant, decorative copy)
 *    - Mascot emblem (Frankenstein phone creature)
 *    - Tagline t('app.tagline')
 *    - Lab seam divider
 *    - Three organ tiles (Nerves, Eyes, Voice) with title & descriptive line via OrganTiles
 *    - Huge "Wake the creature" call to action badge with idle pulse dot
 *    - Accessible subhint ("TalkBack & touch ready")
 * 4. All visible strings route through t() — zero hard-coded English strings in Start.tsx
 * 5. In hi and gu, no English organ strings appear
 * 6. Audit BUG-03 fix: top-origin scrolling at 200% zoom with safe-area insets
 * 7. Focus-visible outline >= 3px
 * 8. Reduced-motion suppresses animations
 */

// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { setLang, t } from '../src/i18n';
import { Start } from '../src/screens/Start';
import globalCss from '../src/styles/global.css?raw';

const startCssPath = new URL('../src/styles/start.css', import.meta.url);
const startCss = fs.readFileSync(startCssPath, 'utf-8') as string;

function makeMockDrivers(): {
  drivers: Drivers;
  calls: string[];
  spoken: string[];
} {
  const calls: string[] = [];
  const spoken: string[] = [];
  const drivers: Drivers = {
    haptics: {
      supported: true,
      lastResult: null,
      vibrate: vi.fn((pattern) => {
        calls.push(`vibrate:${String(pattern)}`);
        return true;
      }),
      stop: vi.fn(),
    },
    audio: {
      unlock: vi.fn(() => void calls.push('audio:unlock')),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'locked',
    },
    speech: {
      speak: vi.fn((text) => {
        calls.push(`speak:${text}`);
        spoken.push(text);
      }),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  };
  return { drivers, calls, spoken };
}

describe('Start screen (Frankenstein Lab redesign)', () => {
  afterEach(() => {
    setLang('en');
  });

  describe('Markup & Accessibility Contracts', () => {
    it('maintains exactly one full-screen button with aria-label matching start.intro', () => {
      const { drivers } = makeMockDrivers();
      const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));

      expect(html.match(/<button/g)).toHaveLength(1);
      expect(html).toContain('class="gt-start-surface"');
      expect(html).toContain(`aria-label="${t('start.intro')}"`);
    });

    it('encloses all visible hero content in aria-hidden="true" so screen readers hear only the button label', () => {
      const { drivers } = makeMockDrivers();
      const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));

      expect(html).toMatch(/<span class="gt-start__hero"[^>]*aria-hidden="true"/);
    });

    it('renders the brand Logo (full variant, decorative)', () => {
      const { drivers } = makeMockDrivers();
      const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));

      expect(html).toContain('gt-logo');
      expect(html).toContain('gt-logo--full');
      expect(html).toContain('gt-start__logo');
    });

    it('renders the stitched creature Mascot emblem', () => {
      const { drivers } = makeMockDrivers();
      const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));

      expect(html).toContain('gt-start__creature-emblem');
      expect(html).toContain('gt-mascot');
      expect(html).toContain('data-testid="gt-creature-mascot"');
    });

    it('renders the brand tagline', () => {
      const { drivers } = makeMockDrivers();
      const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));

      expect(html).toContain('gt-start__tagline');
      // renderToStaticMarkup escapes apostrophe as &#x27;
      expect(html.replace(/&#x27;/g, "'")).toContain(t('app.tagline'));
    });

    it('renders decorative stitched suture seam divider', () => {
      const { drivers } = makeMockDrivers();
      const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));

      expect(html).toContain('gt-start__seam');
      expect(html).toContain('gt-seam');
    });

    it('renders three organ tiles (Nerves, Eyes, Voice) with titles, descriptions, rivets, and icons', () => {
      const { drivers } = makeMockDrivers();
      const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));

      expect(html).toContain('gt-start__triad');
      expect(html).toContain('gt-organ-tiles');
      expect(html).toContain('gt-organ-tile--nerves');
      expect(html).toContain('gt-organ-tile--eyes');
      expect(html).toContain('gt-organ-tile--voice');

      // Titles and descriptive lines
      expect(html).toContain(t('lab.organ.nerves.title'));
      expect(html).toContain(t('lab.organ.nerves.line'));
      expect(html).toContain(t('lab.organ.eyes.title'));
      expect(html).toContain(t('lab.organ.eyes.line'));
      expect(html).toContain(t('lab.organ.voice.title'));
      expect(html).toContain(t('lab.organ.voice.line'));

      // Hardware rivets and icons
      expect(html).toContain('gt-organ-tile__rivet');
      expect(html).toContain('gt-organ-tile__icon-wrapper');
    });

    it('renders the huge "Wake the creature" action badge with idle pulse dot', () => {
      const { drivers } = makeMockDrivers();
      const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));

      expect(html).toContain('gt-start__action-badge');
      expect(html).toContain('gt-start__pulse-dot');
      expect(html).toContain(t('lab.start.wake'));
      expect(html).toContain('gt-start__subhint');
      expect(html.replace(/&amp;/g, '&')).toContain(t('lab.start.subhint'));
    });
  });

  describe('i18n & Zero Hard-Coded English Strings', () => {
    it('in Hindi (hi), translates all organ strings and renders zero English organ text', () => {
      setLang('hi');
      const { drivers } = makeMockDrivers();
      const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));

      // Button accessible name in Hindi
      expect(html).toContain('aria-label="घोस्ट टच। शुरू करने के लिए कहीं भी टैप करें।"');

      // Tagline in Hindi
      expect(html).toContain('वे चित्र महसूस करें जो आप देख नहीं सकते।');

      // Hindi organ titles and lines
      expect(html).toContain('तंत्रिकाएं');
      expect(html).toContain('रेखाओं और कोनों को कंपन के रूप में महसूस करें');
      expect(html).toContain('आंखें');
      expect(html).toContain('एआई आपके चित्र को पढ़ता है');
      expect(html).toContain('आवाज़');
      expect(html).toContain('टोन और आवाज़ आपको अधिक बताते हैं');

      // CTA and subhint in Hindi
      expect(html).toContain('जीव को जगाएं');
      expect(html).toContain('टॉकबैक और स्पर्श तैयार');

      // STRICT CHECK: English organ strings must NOT be present
      expect(html).not.toContain('Feel lines and corners as vibration');
      expect(html).not.toContain('AI reads your diagram');
      expect(html).not.toContain('Tones and speech tell you more');
      expect(html).not.toContain('Wake the creature');
      expect(html).not.toContain('TalkBack &amp; touch ready');
      expect(html).not.toContain('TalkBack & touch ready');
    });

    it('in Gujarati (gu), translates all organ strings and renders zero English organ text', () => {
      setLang('gu');
      const { drivers } = makeMockDrivers();
      const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));

      // Button accessible name in Gujarati
      expect(html).toContain('aria-label="ગોસ્ટ ટચ. શરૂ કરવા માટે ગમે ત્યાં ટેપ કરો."');

      // Tagline in Gujarati
      expect(html).toContain('જે આકૃતિઓ તમે જોઈ શકતા નથી તેને સ્પર્શથી અનુભવો.');

      // Gujarati organ titles and lines
      expect(html).toContain('ચેતાઓ');
      expect(html).toContain('રેખાઓ અને ખૂણાઓને વાઇબ્રેશન તરીકે અનુભવો');
      expect(html).toContain('આંખો');
      expect(html).toContain('AI તમારી આકૃતિ વાંચે છે');
      expect(html).toContain('અવાજ');
      expect(html).toContain('ટોન અને વાણી તમને વધુ વિગત જણાવે છે');

      // CTA and subhint in Gujarati
      expect(html).toContain('પ્રાણીને જગાડો');
      expect(html).toContain('ટોકબેક અને સ્પર્શ તૈયાર');

      // STRICT CHECK: English organ strings must NOT be present
      expect(html).not.toContain('Feel lines and corners as vibration');
      expect(html).not.toContain('AI reads your diagram');
      expect(html).not.toContain('Tones and speech tell you more');
      expect(html).not.toContain('Wake the creature');
      expect(html).not.toContain('TalkBack &amp; touch ready');
      expect(html).not.toContain('TalkBack & touch ready');
    });
  });

  describe('CSS & Layout Robustness (BUG-03, Targets, Motion)', () => {
    it('.gt-start-surface satisfies touch target requirement >= 48px', () => {
      expect(globalCss).toMatch(/\.gt-start-surface\s*\{[^}]*min-width:\s*var\(--gt-target\)/);
      expect(globalCss).toMatch(/\.gt-start-surface\s*\{[^}]*min-height:\s*var\(--gt-target\)/);
    });

    it('.gt-start-surface:focus-visible has >= 3px focus ring with var(--gt-focus)', () => {
      const match = /\.gt-start-surface:focus-visible\s*\{([^}]+)\}/.exec(globalCss);
      expect(match).not.toBeNull();
      const body = match?.[1] ?? '';
      const outline = /outline:\s*(\d+)px\s+solid\s+var\(--gt-focus\)/.exec(body);
      expect(outline).not.toBeNull();
      expect(Number(outline?.[1])).toBeGreaterThanOrEqual(3);
    });

    it('fixes BUG-03: scrolls from top origin (0, 0) without flexbox negative scroll clipping', () => {
      // .gt-start-surface must not use rigid justify-content: center that clips top overflow
      const matchSurface = /\.gt-start-surface\s*\{([^}]+)\}/.exec(globalCss);
      expect(matchSurface).not.toBeNull();
      const surfaceBody = matchSurface?.[1] ?? '';

      expect(surfaceBody).toContain('overflow-y: auto');
      expect(surfaceBody).toMatch(/justify-content:\s*(?:flex-start|safe center)/);

      // .gt-start__hero must use margin: 0 auto (not margin: auto 0 which clips top)
      const matchHero = /\.gt-start__hero\s*\{([^}]+)\}/.exec(globalCss);
      expect(matchHero).not.toBeNull();
      const heroBody = matchHero?.[1] ?? '';

      expect(heroBody).toContain('margin: 0 auto');
      expect(heroBody).toContain('min-height: 100%');
    });

    it('includes safe-area inset padding for hardware notches', () => {
      const matchSurface = /\.gt-start-surface\s*\{([^}]+)\}/.exec(globalCss);
      expect(matchSurface).not.toBeNull();
      const body = matchSurface?.[1] ?? '';

      expect(body).toContain('env(safe-area-inset-top');
      expect(body).toContain('env(safe-area-inset-bottom');
      expect(body).toContain('env(safe-area-inset-left');
      expect(body).toContain('env(safe-area-inset-right');
    });

    it('suppresses Start animations under prefers-reduced-motion', () => {
      expect(globalCss).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[^}]*animation-duration:\s*0\.001ms/s);
      // Both pulse dot and action badge idle glow must be suppressed
      const matchQuery = /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{([\s\S]*?)\n\}/.exec(globalCss);
      expect(matchQuery).not.toBeNull();
      const mediaBlock = matchQuery?.[1] ?? '';

      expect(mediaBlock).toContain('.gt-start__pulse-dot');
      expect(mediaBlock).toContain('.gt-start__action-badge');
      expect(mediaBlock).toContain('.gt-start__logo');
    });

    it('ensures text elements have no white-space: nowrap or fixed heights for Indian scripts', () => {
      const matchHero = /\.gt-start__hero\s*\{([^}]+)\}/.exec(globalCss);
      expect(matchHero?.[1]).not.toContain('white-space: nowrap');

      const matchTagline = /\.gt-start__tagline\s*\{([^}]+)\}/.exec(globalCss);
      expect(matchTagline?.[1]).toContain('white-space: normal');
      expect(matchTagline?.[1]).not.toMatch(/(?<!line-)height:\s*\d+/);

      const matchAction = /\.gt-start__action-badge\s*\{([^}]+)\}/.exec(globalCss);
      expect(matchAction?.[1]).not.toContain('white-space: nowrap');

      const matchSubhint = /\.gt-start__subhint\s*\{([^}]+)\}/.exec(globalCss);
      expect(matchSubhint?.[1]).toContain('white-space: normal');
      expect(matchSubhint?.[1]).not.toMatch(/(?<!line-)height:\s*\d+/);
    });

    it('prevents Start Logo flexbox collapse on narrow screens via flex-shrink: 0 and aspect-ratio', () => {
      const matchLogo = /\.gt-start__logo\s*\{([^}]+)\}/.exec(globalCss);
      expect(matchLogo).not.toBeNull();
      const logoBody = matchLogo?.[1] ?? '';

      expect(logoBody).toMatch(/flex-shrink:\s*0/);
      expect(logoBody).toMatch(/aspect-ratio:\s*340\s*\/\s*80/);
    });

    it('provides compact horizontal row layout for organ tiles on narrow screens in start.css', () => {
      const mqIdx = startCss.search(/@media\s*\(\s*max-width:\s*640px\s*\)/);
      const baseIdx = startCss.search(/\.gt-organ-tile\s*\{/);
      expect(mqIdx).toBeGreaterThan(-1);
      expect(baseIdx).toBeGreaterThan(-1);
      expect(mqIdx).toBeGreaterThan(baseIdx);

      expect(startCss).toMatch(/\.gt-organ-tile\s*\{[^}]*flex-direction:\s*row/);
      expect(startCss).toMatch(/\.gt-organ-tile\s*\{[^}]*min-height:\s*64px/);
    });

    it('compacts hero elements under @media (max-width: 640px) so the Start screen fits 390x844 without scrolling', () => {
      const mqMatch = /@media\s*\(\s*max-width:\s*640px\s*\)\s*\{([\s\S]+?)\n\}/.exec(globalCss);
      expect(mqMatch).not.toBeNull();
      const mqBody = mqMatch?.[1] ?? '';

      expect(mqBody).toMatch(/\.gt-start__creature-emblem\s*\{[^}]*width:\s*68px/);
      expect(mqBody).toMatch(/\.gt-start__hero\s*\{[^}]*gap:\s*var\(--gt-space-xs/);
    });
  });
});
