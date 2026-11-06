/**
 * SpecimenPreview Component Verification Tests
 *
 * Requirements (docs/briefs/lab-spec.md & docs/briefs/agy-lab-specimen.md):
 * - Takes `{ id: SampleId; className?: string }`.
 * - Inline `<svg viewBox="0 0 100 100">` with diagram's lines in life green on charcoal.
 * - Thin strokes, rounded caps, vertex dots.
 * - Decorative only: `aria-hidden="true"`, `focusable="false"`, no `<title>`.
 * - While loading or on failure show a neutral static glyph (never an error message, never spoken text).
 * - Colours only from CSS variables with standard fallbacks:
 *   `var(--gt-copper, var(--gt-green-dim))`, `var(--gt-green)`, `var(--gt-bg)`.
 * - Size: few hundred bytes of SVG, no images.
 * - No animation; under reduced motion nothing changes.
 */

// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSampleCache,
  getCachedSample,
  setCachedSample,
  SpecimenPreview,
} from '../src/components/SpecimenPreview';
import type { DiagramScene } from '../src/types/scene.gen';

function loadSample(name: string): DiagramScene {
  const url = new URL(`../public/samples/${name}.json`, import.meta.url);
  const raw = fs.readFileSync(url, 'utf-8') as string;
  return JSON.parse(raw) as DiagramScene;
}

const triangleScene = loadSample('triangle');
const sineScene = loadSample('sine');
const barchartScene = loadSample('barchart');

describe('SpecimenPreview component (Requirement 1 & 3)', () => {
  beforeEach(() => {
    clearSampleCache();
  });

  it('renders an inline SVG with viewBox="0 0 100 100", aria-hidden="true", focusable="false"', () => {
    const html = renderToStaticMarkup(
      createElement(SpecimenPreview, { id: 'triangle', scene: triangleScene }),
    );
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 100 100"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
  });

  it('contains NO <title> tags so the parent button accessible name is preserved', () => {
    for (const [id, scene] of [
      ['triangle', triangleScene],
      ['sine', sineScene],
      ['barchart', barchartScene],
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(SpecimenPreview, { id, scene }),
      );
      expect(html).not.toContain('<title');
      expect(html).not.toContain('</title>');
    }
  });

  it('contains NO readable text nodes (<text>, <tspan>) or error messages', () => {
    for (const [id, scene] of [
      ['triangle', triangleScene],
      ['sine', sineScene],
      ['barchart', barchartScene],
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(SpecimenPreview, { id, scene }),
      );
      expect(html).not.toContain('<text');
      expect(html).not.toContain('<tspan');
      // Stripping all tags should leave zero readable text
      const stripped = html.replace(/<[^>]+>/g, '').trim();
      expect(stripped).toBe('');
    }
  });

  it('includes proper CSS classes for specimen jar cards and supports custom className', () => {
    const html = renderToStaticMarkup(
      createElement(SpecimenPreview, {
        id: 'triangle',
        className: 'custom-card-preview',
        scene: triangleScene,
      }),
    );
    expect(html).toContain('class="gt-specimen gt-specimen--triangle custom-card-preview"');
  });

  it('renders the base charcoal plate in all previews', () => {
    const html = renderToStaticMarkup(
      createElement(SpecimenPreview, { id: 'triangle', scene: triangleScene }),
    );
    expect(html).toContain('class="gt-specimen__bg"');
    expect(html).toContain('width="100"');
    expect(html).toContain('height="100"');
  });

  it('renders triangle diagram with green segments and 3 vertex dots', () => {
    const html = renderToStaticMarkup(
      createElement(SpecimenPreview, { id: 'triangle', scene: triangleScene }),
    );
    expect(html).toContain('class="gt-specimen__line gt-specimen__line--segment"');
    // 3 vertex dot circles
    const dotMatches = html.match(/class="gt-specimen__dot"/g);
    expect(dotMatches).toHaveLength(3);
  });

  it('renders sine diagram with coordinate axes and down-sampled polyline', () => {
    const html = renderToStaticMarkup(
      createElement(SpecimenPreview, { id: 'sine', scene: sineScene }),
    );
    expect(html).toContain('class="gt-specimen__axis"');
    expect(html).toContain('class="gt-specimen__line gt-specimen__line--polyline"');
    expect(html).not.toContain('class="gt-specimen__dot"');
  });

  it('renders bar chart diagram with coordinate axes and stroked bar paths', () => {
    const html = renderToStaticMarkup(
      createElement(SpecimenPreview, { id: 'barchart', scene: barchartScene }),
    );
    expect(html).toContain('class="gt-specimen__axis"');
    expect(html).toContain('class="gt-specimen__line gt-specimen__line--bar"');
    expect(html).not.toContain('class="gt-specimen__dot"');
  });

  it('is under a lightweight byte size budget (few hundred bytes, <= 2 KB)', () => {
    for (const [id, scene] of [
      ['triangle', triangleScene],
      ['sine', sineScene],
      ['barchart', barchartScene],
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(SpecimenPreview, { id, scene }),
      );
      const byteSize = new TextEncoder().encode(html).length;
      expect(byteSize).toBeGreaterThan(200);
      expect(byteSize).toBeLessThan(2048); // << 30 KB budget
    }
  });
});

describe('loading, caching and fallback behavior (Requirement 1)', () => {
  beforeEach(() => {
    clearSampleCache();
  });

  it('shows neutral static specimen jar glyph when scene is not yet loaded', () => {
    // When no scene prop and cache is empty
    const html = renderToStaticMarkup(
      createElement(SpecimenPreview, { id: 'triangle' }),
    );
    expect(html).toContain('class="gt-specimen__placeholder"');
    expect(html).not.toContain('class="gt-specimen__content"');
    expect(html).not.toContain('error');
    expect(html).not.toContain('failed');
  });

  it('uses cached scene immediately on subsequent renders without fetch', () => {
    setCachedSample('triangle', triangleScene);
    expect(getCachedSample('triangle')).toBe(triangleScene);

    const html = renderToStaticMarkup(
      createElement(SpecimenPreview, { id: 'triangle' }),
    );
    expect(html).toContain('class="gt-specimen__content"');
    expect(html).toContain('class="gt-specimen__line gt-specimen__line--segment"');
    expect(html).not.toContain('class="gt-specimen__placeholder"');
  });

  it('cache can be cleared cleanly', () => {
    setCachedSample('sine', sineScene);
    expect(getCachedSample('sine')).toBe(sineScene);
    clearSampleCache();
    expect(getCachedSample('sine')).toBeUndefined();
  });
});

describe('specimen.css stylesheet rules (Requirement 4)', () => {
  const cssUrl = new URL('../src/styles/specimen.css', import.meta.url);
  const css = fs.readFileSync(cssUrl, 'utf-8') as string;

  it('uses only CSS variables with fallbacks for all colours', () => {
    expect(css).toContain('var(--gt-bg, #0b0e0c)');
    expect(css).toContain('var(--gt-green, #39ff88)');
    expect(css).toContain('var(--gt-copper, var(--gt-green-dim, #2ea363))');
  });

  it('contains zero animations or transitions outside reduced-motion overrides', () => {
    const mainCss = css.split('@media')[0] ?? '';
    expect(css).not.toContain('@keyframes');
    expect(mainCss).not.toContain('animation:');
    expect(mainCss).not.toContain('transition:');
  });

  it('includes prefers-reduced-motion media query ensuring no motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none !important');
    expect(css).toContain('transition: none !important');
  });
});
