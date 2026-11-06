/**
 * Logo Component Verification Tests (Lane Lab-Brand)
 *
 * Requirements:
 * - Logo.tsx with props: `variant?: 'full' | 'mark'`, `decorative?: boolean`, `className?: string`, `height?: number`.
 * - Inline SVG (no external network dependencies).
 * - If `decorative`, aria-hidden="true" and focusable="false".
 * - If NOT `decorative`, role="img" with aria-label from t('app.name') and focusable="false".
 * - The visible page heading must stay real text: Logo is never the only content of an <h1>.
 * - Supports responsive sizing via `height` prop.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Logo } from '../src/components/Logo';
import { getLang, setLang } from '../src/i18n';

describe('Logo component (Logo.tsx & Lane Lab-Brand)', () => {
  it('renders default full logo with accessible role and aria-label', () => {
    const html = renderToStaticMarkup(createElement(Logo));
    expect(html).toContain('<svg');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Ghost Touch"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain('aria-hidden="true"');
    expect(html).toContain('data-testid="gt-logo-full"');
    expect(html).toContain('class="gt-logo gt-logo--full"');
  });

  it('renders full logo containing creature mark and wordmark', () => {
    const html = renderToStaticMarkup(createElement(Logo, { variant: 'full' }));
    // Wordmark text
    expect(html).toContain('Ghost');
    expect(html).toContain('Touch');
    // Thin suture line under Touch
    expect(html).toContain('stroke="#e8dfc8"');
    expect(html).toContain('stroke-dasharray="4 3"');
    // Creature phone mark parts
    expect(html).toContain('fill="#c9803a"'); // copper bolt
    expect(html).toContain('stroke="#39ff88"'); // life green phone chassis
    expect(html).toContain('<polygon'); // diagram triangle
  });

  it('renders mark variant without wordmark text', () => {
    const html = renderToStaticMarkup(createElement(Logo, { variant: 'mark' }));
    expect(html).toContain('data-testid="gt-logo-mark"');
    expect(html).toContain('class="gt-logo gt-logo--mark"');
    // Wordmark text elements must not exist in mark-only variant
    expect(html).not.toContain('<text');
    // Mark elements must exist
    expect(html).toContain('fill="#c9803a"'); // copper bolt
    expect(html).toContain('<polygon'); // diagram triangle
    expect(html).toContain('A 14 14 0 0 1'); // vibration arc
  });

  it('supports decorative mode with aria-hidden="true" and no role="img"', () => {
    const html = renderToStaticMarkup(createElement(Logo, { decorative: true }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain('aria-label=');
  });

  it('scales proportionally when height prop is provided', () => {
    const markHtml = renderToStaticMarkup(createElement(Logo, { variant: 'mark', height: 48 }));
    expect(markHtml).toContain('width="48"');
    expect(markHtml).toContain('height="48"');

    const fullHtml = renderToStaticMarkup(createElement(Logo, { variant: 'full', height: 40 }));
    expect(fullHtml).toContain('height="40"');
    expect(fullHtml).toContain('width="170"'); // 40 * (340 / 80) = 170
  });

  it('applies custom className alongside base classes', () => {
    const html = renderToStaticMarkup(
      createElement(Logo, { className: 'lab-header__logo' }),
    );
    expect(html).toContain('class="gt-logo gt-logo--full lab-header__logo"');
  });

  it('translates accessible aria-label according to active language', () => {
    const prevLang = getLang();
    try {
      setLang('hi');
      const hiHtml = renderToStaticMarkup(createElement(Logo));
      expect(hiHtml).toContain('aria-label="घोस्ट टच"');

      setLang('gu');
      const guHtml = renderToStaticMarkup(createElement(Logo));
      expect(guHtml).toContain('aria-label="ગોસ્ટ ટચ"');
    } finally {
      setLang(prevLang);
    }
  });

  it('is purely inline SVG with no external image tags or network requests', () => {
    const html = renderToStaticMarkup(createElement(Logo));
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<image');
    expect(html).not.toContain('href="http');
    expect(html).not.toContain('src="http');
  });
});
