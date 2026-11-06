/**
 * OrganTiles and OrganIcons Verification Tests (Lane: lab-start)
 *
 * Requirements from docs/briefs/agy-lab-start.md:
 * 1. Three tiles render in order with the given strings.
 * 2. Icons are aria-hidden and focusable="false".
 * 3. No focusable elements inside (non-interactive, sits within whole-screen start button).
 * 4. Hand-written SVGs under 1.5 KB each.
 * 5. Text at least 7:1 contrast on the tile surface (WCAG AAA) using tokens.css values.
 * 6. CSS has zero hard-coded colour literals (regex check over start.css).
 * 7. Colours only from CSS variables with fallbacks.
 * 8. Stacked-layout rule for narrow widths exists (320px safe / 200% zoom).
 * 9. Text wraps rather than truncates (no nowrap, no ellipsis).
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  EyesIcon,
  NervesIcon,
  OrganIcon,
  VoiceIcon,
  type OrganId,
} from '../src/components/start/OrganIcons';
import {
  OrganTiles,
  type OrganTilesProps,
} from '../src/components/start/OrganTiles';
import { contrastRatio, parseColourTokens } from './a11y.contrast.test';

// In Vitest node environment, read CSS files directly from disk
const startCssPath = new URL('../src/styles/start.css', import.meta.url);
const startCss = fs.readFileSync(startCssPath, 'utf-8') as string;

const tokensPath = new URL('../src/styles/tokens.css', import.meta.url);
const tokensCss = fs.readFileSync(tokensPath, 'utf-8') as string;

describe('OrganTiles markup and rendering', () => {
  const sampleOrgans: OrganTilesProps['organs'] = [
    { id: 'nerves', title: 'Nerves', line: 'Haptic buzzer feel' },
    { id: 'eyes', title: 'Eyes', line: 'Vision AI perception' },
    { id: 'voice', title: 'Voice', line: 'Theremin synthesizer speech' },
  ];

  it('renders a plain list (ul and li) with three tiles in order', () => {
    const html = renderToStaticMarkup(createElement(OrganTiles, { organs: sampleOrgans }));

    // Container is an unordered list
    expect(html).toMatch(/^<ul\b/);
    expect(html).toContain('class="gt-organ-tiles"');

    // Exactly 3 list items
    const liMatches = html.match(/<li\b/g);
    expect(liMatches).not.toBeNull();
    expect(liMatches?.length).toBe(3);

    // Each tile has its corresponding id modifier class
    expect(html).toContain('gt-organ-tile--nerves');
    expect(html).toContain('gt-organ-tile--eyes');
    expect(html).toContain('gt-organ-tile--voice');

    // Order verification: Nerves before Eyes, Eyes before Voice
    const nervesIdx = html.indexOf('gt-organ-tile--nerves');
    const eyesIdx = html.indexOf('gt-organ-tile--eyes');
    const voiceIdx = html.indexOf('gt-organ-tile--voice');

    expect(nervesIdx).toBeGreaterThan(-1);
    expect(eyesIdx).toBeGreaterThan(nervesIdx);
    expect(voiceIdx).toBeGreaterThan(eyesIdx);
  });

  it('renders title and line strings for each organ', () => {
    const html = renderToStaticMarkup(createElement(OrganTiles, { organs: sampleOrgans }));

    for (const organ of sampleOrgans) {
      expect(html).toContain(organ.title);
      expect(html).toContain(organ.line);
    }

    // Verify content hierarchy within each tile
    expect(html).toContain('class="gt-organ-tile__title"');
    expect(html).toContain('class="gt-organ-tile__line"');
  });

  it('applies optional custom className to the ul container', () => {
    const html = renderToStaticMarkup(
      createElement(OrganTiles, { organs: sampleOrgans, className: 'lab-custom-hero' }),
    );
    expect(html).toContain('class="gt-organ-tiles lab-custom-hero"');
  });

  it('renders decorative rivets per tile', () => {
    const html = renderToStaticMarkup(createElement(OrganTiles, { organs: sampleOrgans }));
    const rivetMatches = html.match(/gt-organ-tile__rivet/g);
    expect(rivetMatches?.length).toBe(3);
  });
});

describe('OrganTiles accessibility and non-interactivity', () => {
  const sampleOrgans: OrganTilesProps['organs'] = [
    { id: 'nerves', title: 'Nerves', line: 'Haptic buzzer feel' },
    { id: 'eyes', title: 'Eyes', line: 'Vision AI perception' },
    { id: 'voice', title: 'Voice', line: 'Theremin synthesizer speech' },
  ];

  it('ensures all icons are aria-hidden and focusable="false"', () => {
    const html = renderToStaticMarkup(createElement(OrganTiles, { organs: sampleOrgans }));
    const svgMatches = html.match(/<svg[^>]*>/g) ?? [];
    expect(svgMatches.length).toBe(3);

    for (const svg of svgMatches) {
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('focusable="false"');
    }
  });

  it('ensures decorative elements (rivets and icon wrappers) are aria-hidden', () => {
    const html = renderToStaticMarkup(createElement(OrganTiles, { organs: sampleOrgans }));
    const rivetMatches = html.match(/class="gt-organ-tile__rivet"[^>]*aria-hidden="true"/g);
    expect(rivetMatches?.length).toBe(3);

    const iconWrapperMatches = html.match(/class="gt-organ-tile__icon-wrapper"[^>]*aria-hidden="true"/g);
    expect(iconWrapperMatches?.length).toBe(3);
  });

  it('contains NO focusable elements (no buttons, links, inputs, or tabindex)', () => {
    const html = renderToStaticMarkup(createElement(OrganTiles, { organs: sampleOrgans }));

    // Interactive elements forbidden inside the whole-screen start button
    expect(html).not.toMatch(/<button\b/i);
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/<input\b/i);
    expect(html).not.toMatch(/<select\b/i);
    expect(html).not.toMatch(/<textarea\b/i);

    // No non-negative tabindex
    expect(html).not.toMatch(/tabindex\s*=\s*["']?(?!-\b)\d+/i);
  });
});

describe('OrganIcons SVG implementation', () => {
  it.each<OrganId>(['nerves', 'eyes', 'voice'])(
    'icon %s renders an inline SVG under 1.5 KB (1536 bytes)',
    (id) => {
      const html = renderToStaticMarkup(createElement(OrganIcon, { id }));
      expect(html).toContain('<svg');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('focusable="false"');
      expect(html).toContain('viewBox="0 0 32 32"');

      // Hand-written SVG byte size check (< 1.5 KB)
      const byteLength = new TextEncoder().encode(html).length;
      expect(byteLength).toBeLessThan(1536);
    },
  );

  it('individual icon components render properly', () => {
    const nerves = renderToStaticMarkup(createElement(NervesIcon, { className: 'test-icon' }));
    const eyes = renderToStaticMarkup(createElement(EyesIcon, { className: 'test-icon' }));
    const voice = renderToStaticMarkup(createElement(VoiceIcon, { className: 'test-icon' }));

    expect(nerves).toContain('class="test-icon"');
    expect(eyes).toContain('class="test-icon"');
    expect(voice).toContain('class="test-icon"');
  });
});

describe('OrganTiles text contrast on tile surface (WCAG AAA >= 7:1)', () => {
  const tokens = parseColourTokens(tokensCss);

  it('verifies primary and standard text tokens exceed 7:1 contrast on tile surface', () => {
    const surfaceCard = tokens['--gt-surface-card'];
    const surface = tokens['--gt-surface'];
    const textPrimary = tokens['--gt-text-primary'];
    const text = tokens['--gt-text'];

    expect(surfaceCard).toBeDefined();
    expect(surface).toBeDefined();
    expect(textPrimary).toBeDefined();
    expect(text).toBeDefined();

    if (surfaceCard && textPrimary) {
      const ratio = contrastRatio(textPrimary, surfaceCard);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    }

    if (surfaceCard && text) {
      const ratio = contrastRatio(text, surfaceCard);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    }

    if (surface && textPrimary) {
      const ratio = contrastRatio(textPrimary, surface);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    }
  });

  it('verifies secondary bone text fallback exceeds 7:1 contrast on tile surface', () => {
    const surfaceCard = tokens['--gt-surface-card'];
    const surface = tokens['--gt-surface'];
    const textSecondary = tokens['--gt-text-secondary'];

    expect(surfaceCard).toBeDefined();
    expect(surface).toBeDefined();
    expect(textSecondary).toBeDefined();

    if (surfaceCard && textSecondary) {
      const ratioCard = contrastRatio(textSecondary, surfaceCard);
      expect(ratioCard).toBeGreaterThanOrEqual(7.0);
    }

    if (surface && textSecondary) {
      const ratioSurface = contrastRatio(textSecondary, surface);
      expect(ratioSurface).toBeGreaterThanOrEqual(7.0);
    }
  });
});

describe('start.css stylesheet rules and constraints', () => {
  // Strip CSS comments before analyzing declarations
  const cleanCss = startCss.replace(/\/\*[\s\S]*?\*\//g, '');

  it('contains ZERO hard-coded colour literals (no hex codes)', () => {
    const hexMatches = cleanCss.match(/#[0-9a-fA-F]{3,8}\b/g);
    expect(hexMatches).toBeNull();
  });

  it('contains ZERO rgb/rgba or hsl/hsla function calls', () => {
    expect(cleanCss).not.toMatch(/rgba?\s*\(/i);
    expect(cleanCss).not.toMatch(/hsla?\s*\(/i);
  });

  it('uses required CSS variable fallbacks for copper, cyan, and bone', () => {
    expect(startCss).toContain('var(--gt-copper, var(--gt-green-dim))');
    expect(startCss).toContain('var(--gt-cyan, var(--gt-green))');
    expect(startCss).toContain('var(--gt-bone, var(--gt-text-secondary))');
  });

  it('defines a stacked-layout rule for narrow widths (<= 640px)', () => {
    // Media query exists for narrow viewports
    expect(cleanCss).toMatch(/@media\s*\(\s*max-width:\s*\d+px\s*\)/);

    // Within media query or rule block, defines single column stacked layout
    expect(cleanCss).toMatch(/grid-template-columns:\s*1fr\b/);

    // Wide screen layout defines 3 columns
    expect(cleanCss).toMatch(/grid-template-columns:\s*repeat\(\s*3\s*,\s*1fr\s*\)/);
  });

  it('configures text wrapping without truncation', () => {
    expect(cleanCss).toMatch(/overflow-wrap:\s*break-word/);
    expect(cleanCss).toMatch(/white-space:\s*normal/);
    expect(cleanCss).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(cleanCss).not.toMatch(/white-space:\s*nowrap/);
  });

  it('includes stitched dashed border and rivet styling', () => {
    expect(cleanCss).toMatch(/border-style:\s*dashed/);
    expect(cleanCss).toContain('.gt-organ-tile__rivet');
  });
});
