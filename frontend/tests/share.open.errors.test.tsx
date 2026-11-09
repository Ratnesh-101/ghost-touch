/**
 * ShareError Screen Tests
 *
 * Requirements:
 * - Friendly error messages for each ShareErrorCode (too-large, bad-format, bad-version, bad-scene, empty).
 * - "Go to start" button to return to the Start screen and clear hash.
 * - Never shows stack traces or raw payload data.
 * - Touch targets >= 48x48 px via .gt-control.
 * - Full localization across en, hi, gu.
 */

// @ts-expect-error Node runtime fs in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareError, shareErrorMessage } from '../src/screens/ShareError';
import type { ShareErrorCode } from '../src/share';
import { setLang } from '../src/i18n';
import { getAllElements, parseHtml } from './helpers/a11yDom';

const globalCssPath = new URL('../src/styles/global.css', import.meta.url);
const globalCss = fs.readFileSync(globalCssPath, 'utf-8') as string;
const exploreCssPath = new URL('../src/styles/explore.css', import.meta.url);
const exploreCss = fs.readFileSync(exploreCssPath, 'utf-8') as string;

describe('ShareError Screen and error messages', () => {
  afterEach(() => {
    setLang('en');
  });

  const errorCodes: ShareErrorCode[] = [
    'too-large',
    'bad-format',
    'bad-version',
    'bad-scene',
    'empty',
  ];

  it('provides distinct, friendly error message for every error code without stack or raw payload', () => {
    for (const code of errorCodes) {
      const msg = shareErrorMessage(code);
      expect(msg).toBeTruthy();
      expect(msg).not.toContain('Error:');
      expect(msg).not.toContain('at ');
      expect(msg).not.toContain('stack');
      expect(msg).not.toContain('undefined');
    }

    expect(shareErrorMessage('too-large')).toBe('This shared link is too large to open.');
    expect(shareErrorMessage('bad-format')).toBe('This shared link is corrupted or incomplete.');
    expect(shareErrorMessage('bad-version')).toBe(
      'This shared link was created by an incompatible version.',
    );
    expect(shareErrorMessage('bad-scene')).toBe('This shared diagram could not be read.');
    expect(shareErrorMessage('empty')).toBe('This shared link has no diagram.');
  });

  it('renders ShareError screen with role="alert" when speech cannot speak, and without role="alert" when it can', () => {
    for (const code of errorCodes) {
      // With a speech driver that canSpeak: NO role="alert" and message text is still rendered
      const htmlSpoken = renderToStaticMarkup(
        createElement(ShareError, {
          code,
          onGoToStart: vi.fn(),
          canSpeak: true,
        }),
      );
      const rootSpoken = parseHtml(htmlSpoken);
      const alertsSpoken = getAllElements(rootSpoken).filter(
        (el) => el.attrs['role'] === 'alert',
      );
      expect(alertsSpoken.length).toBe(0);
      expect(htmlSpoken).not.toContain('role="alert"');
      expect(htmlSpoken).toContain(shareErrorMessage(code));
      expect(htmlSpoken).toContain('Go to start');

      // With a driver that cannot speak: role="alert" is present exactly once and message text is rendered
      const htmlMuted = renderToStaticMarkup(
        createElement(ShareError, {
          code,
          onGoToStart: vi.fn(),
          canSpeak: false,
        }),
      );
      const rootMuted = parseHtml(htmlMuted);
      const alertsMuted = getAllElements(rootMuted).filter(
        (el) => el.attrs['role'] === 'alert',
      );
      expect(alertsMuted.length).toBe(1);
      expect(htmlMuted).toContain(shareErrorMessage(code));
      expect(htmlMuted).toContain('Go to start');
      expect(htmlMuted).not.toContain('trace');
      expect(htmlMuted).not.toContain('stack');
    }
  });

  it('enforces 48x48 px minimum touch target on "Go to start" button via .gt-control', () => {
    const html = renderToStaticMarkup(
      createElement(ShareError, {
        code: 'bad-format',
        onGoToStart: vi.fn(),
      }),
    );
    const root = parseHtml(html);
    const buttons = getAllElements(root).filter((el) => el.tag === 'button');

    expect(buttons.length).toBe(1);
    expect(buttons[0]!.attrs['class']).toContain('gt-control');
    expect(buttons[0]!.attrs['class']).toContain('gt-share-error__start-btn');

    expect(globalCss).toMatch(/\.gt-control\s*\{[^}]*min-height:\s*var\(--gt-target\)/);
    expect(globalCss).toMatch(/--gt-target:\s*48px/);
    expect(exploreCss).toContain('min-height: 48px');
  });

  it('localizes all error messages into Hindi and Gujarati', () => {
    setLang('hi');
    expect(shareErrorMessage('too-large')).toBe('यह साझा किया गया लिंक खोलने के लिए बहुत बड़ा है।');
    expect(shareErrorMessage('bad-format')).toBe('यह साझा किया गया लिंक दूषित या अधूरा है।');
    expect(shareErrorMessage('bad-version')).toBe(
      'यह साझा किया गया लिंक एक असंगत संस्करण द्वारा बनाया गया था।',
    );
    expect(shareErrorMessage('bad-scene')).toBe('यह साझा किया गया आरेख पढ़ा नहीं जा सका।');
    expect(shareErrorMessage('empty')).toBe('इस साझा किए गए लिंक में कोई आरेख नहीं है।');

    const htmlHi = renderToStaticMarkup(
      createElement(ShareError, {
        code: 'bad-format',
        onGoToStart: vi.fn(),
      }),
    );
    expect(htmlHi).toContain('यह साझा किया गया लिंक दूषित या अधूरा है।');
    expect(htmlHi).toContain('शुरुआत पर जाएं');

    setLang('gu');
    expect(shareErrorMessage('too-large')).toBe('આ શેર કરેલી લિંક ખોલવા માટે ખૂબ મોટી છે.');
    expect(shareErrorMessage('bad-format')).toBe('આ શેર કરેલી લિંક ખરાબ થયેલી અથવા અધૂરી છે.');
    expect(shareErrorMessage('bad-version')).toBe(
      'આ શેર કરેલી લિંક અસંગત સંસ્કરણ દ્વારા બનાવવામાં આવી હતી.',
    );
    expect(shareErrorMessage('bad-scene')).toBe('આ શેર કરેલી આકૃતિ વાંચી શકાઈ નથી.');
    expect(shareErrorMessage('empty')).toBe('આ શેર કરેલી લિંકમાં કોઈ આકૃતિ નથી.');

    const htmlGu = renderToStaticMarkup(
      createElement(ShareError, {
        code: 'bad-format',
        onGoToStart: vi.fn(),
      }),
    );
    expect(htmlGu).toContain('આ શેર કરેલી લિંક ખરાબ થયેલી અથવા અધૂરી છે.');
    expect(htmlGu).toContain('શરૂઆત પર જાઓ');
  });
});
