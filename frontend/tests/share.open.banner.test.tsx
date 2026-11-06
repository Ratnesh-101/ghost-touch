/**
 * VerifiedBanner Component Tests
 *
 * Requirements:
 * - Rendered with role="status".
 * - "Verified by <name>" displayed.
 * - Note hidden initially, revealed via "Read note" button.
 * - Teacher name, note, and labels render as React text only (XSS protection).
 * - Minimum 48x48 px touch target via .gt-control.
 * - Full localization across en, hi, gu.
 */

// @ts-expect-error Node runtime fs in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { VerifiedBanner } from '../src/components/VerifiedBanner';
import { setLang } from '../src/i18n';
import { getAllElements, parseHtml } from './helpers/a11yDom';

const globalCssPath = new URL('../src/styles/global.css', import.meta.url);
const globalCss = fs.readFileSync(globalCssPath, 'utf-8') as string;
const exploreCssPath = new URL('../src/styles/explore.css', import.meta.url);
const exploreCss = fs.readFileSync(exploreCssPath, 'utf-8') as string;

describe('VerifiedBanner Component', () => {
  afterEach(() => {
    setLang('en');
  });

  it('renders with role="status" and displays "Verified by <name>"', () => {
    const html = renderToStaticMarkup(
      createElement(VerifiedBanner, {
        by: 'Mrs. Sharma',
        note: 'Check the angles carefully.',
      }),
    );
    const root = parseHtml(html);
    const banner = getAllElements(root).filter((el) => el.attrs['role'] === 'status');

    expect(banner.length).toBe(1);
    expect(html).toContain('Verified by Mrs. Sharma');
  });

  it('initially hides the note and renders "Read note" button', () => {
    const html = renderToStaticMarkup(
      createElement(VerifiedBanner, {
        by: 'Mr. Patel',
        note: 'Secret teacher note here.',
      }),
    );

    // Button should be rendered with label "Read note"
    expect(html).toContain('Read note');
    // Note text itself should NOT be rendered in initial collapsed state
    expect(html).not.toContain('Secret teacher note here.');
  });

  it('does not render "Read note" button if note is empty or whitespace', () => {
    const html = renderToStaticMarkup(
      createElement(VerifiedBanner, {
        by: 'Mr. Patel',
        note: '   ',
      }),
    );

    expect(html).not.toContain('Read note');
  });

  it('XSS prevention: renders <img onerror> name as literal text and creates no <img> element', () => {
    const maliciousName = '<img src=x onerror=alert(1)>';
    const html = renderToStaticMarkup(
      createElement(VerifiedBanner, {
        by: maliciousName,
        note: '<script>alert(2)</script>',
      }),
    );
    const root = parseHtml(html);

    // No img tags or script tags must exist in the parsed tree
    const imgElements = getAllElements(root).filter((el) => el.tag === 'img');
    const scriptElements = getAllElements(root).filter((el) => el.tag === 'script');
    expect(imgElements.length).toBe(0);
    expect(scriptElements.length).toBe(0);

    // HTML entity escaping must ensure it renders as safe inert text
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('enforces 48x48 px minimum touch target via .gt-control class', () => {
    const html = renderToStaticMarkup(
      createElement(VerifiedBanner, {
        by: 'Teacher',
        note: 'Some note',
      }),
    );
    const root = parseHtml(html);

    const buttons = getAllElements(root).filter((el) => el.tag === 'button');
    expect(buttons.length).toBe(1);
    expect(buttons[0]!.attrs['class']).toContain('gt-control');
    expect(buttons[0]!.attrs['class']).toContain('gt-verified-banner__note-btn');

    // Verify CSS enforcement
    expect(globalCss).toMatch(/\.gt-control\s*\{[^}]*min-height:\s*var\(--gt-target\)/);
    expect(globalCss).toMatch(/--gt-target:\s*48px/);
    expect(exploreCss).toContain('min-width: 48px');
    expect(exploreCss).toContain('min-height: 48px');
  });

  it('localizes correctly in Hindi and Gujarati', () => {
    setLang('hi');
    const htmlHi = renderToStaticMarkup(
      createElement(VerifiedBanner, {
        by: 'शर्मा जी',
        note: 'कोनों को ध्यान से देखें।',
      }),
    );
    expect(htmlHi).toContain('शर्मा जी द्वारा सत्यापित');
    expect(htmlHi).toContain('नोट पढ़ें');

    setLang('gu');
    const htmlGu = renderToStaticMarkup(
      createElement(VerifiedBanner, {
        by: 'પટેલ સાહેબ',
        note: 'ખૂણાઓ ધ્યાનથી જુઓ.',
      }),
    );
    expect(htmlGu).toContain('પટેલ સાહેબ દ્વારા પ્રમાણિત');
    expect(htmlGu).toContain('નોંધ વાંચો');
  });
});
