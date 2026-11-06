/**
 * LabLoading Component and Loading CSS Tests
 *
 * Requirements (agy-lab-loading brief & lab-spec):
 * - Renders title and hint strings arrived via props.
 * - Charge meter is aria-hidden="true".
 * - No live region (aria-live), role="status", role="alert", or role="progressbar".
 * - loading.css includes prefers-reduced-motion: reduce block disabling animation
 *   and showing a static half-filled state.
 * - loading.css animation cycles are >= 0.34 s (WCAG 2.3.1 - max 3 flashes/second).
 * - Colours use CSS variable tokens with fallbacks.
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LabLoading } from '../src/components/loading/LabLoading';

/**
 * Extracts the contents of a media query block by balancing curly braces.
 */
function extractMediaBlock(css: string, mediaFeature: string): string | null {
  const startIdx = css.indexOf(mediaFeature);
  if (startIdx === -1) return null;
  const braceStart = css.indexOf('{', startIdx);
  if (braceStart === -1) return null;
  let depth = 1;
  let i = braceStart + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(braceStart + 1, i - 1);
}

/**
 * Strips all @media blocks from CSS to isolate normal-motion rules.
 */
function stripMediaBlocks(css: string): string {
  let result = '';
  let i = 0;
  while (i < css.length) {
    const mediaIdx = css.indexOf('@media', i);
    if (mediaIdx === -1) {
      result += css.slice(i);
      break;
    }
    result += css.slice(i, mediaIdx);
    const braceStart = css.indexOf('{', mediaIdx);
    if (braceStart === -1) break;
    let depth = 1;
    let j = braceStart + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    i = j;
  }
  return result;
}

describe('LabLoading component markup & accessibility', () => {
  it('renders both title as a paragraph and hint as text', () => {
    const html = renderToStaticMarkup(
      createElement(LabLoading, {
        title: 'Reading your diagram…',
        hint: 'Powering up the lab sensors',
      }),
    );

    expect(html).toContain('Reading your diagram…');
    expect(html).toContain('Powering up the lab sensors');
    expect(html).toContain('<p class="gt-lab-loading__title">Reading your diagram…</p>');
    expect(html).toContain('<p class="gt-lab-loading__hint">Powering up the lab sensors</p>');
  });

  it('ensures charge meter is strictly aria-hidden="true"', () => {
    const html = renderToStaticMarkup(
      createElement(LabLoading, {
        title: 'Reading your diagram…',
        hint: 'Waking the creature',
      }),
    );

    // Meter container is aria-hidden
    expect(html).toMatch(/<div class="gt-lab-loading__meter"\s+aria-hidden="true">/);
    // Spark SVG is also aria-hidden
    expect(html).toContain('class="gt-lab-loading__spark"');
  });

  it('does NOT contain live regions or progressbar roles (avoids speech duplication)', () => {
    const html = renderToStaticMarkup(
      createElement(LabLoading, {
        title: 'Reading your diagram…',
        hint: 'Preparing touch nerves',
      }),
    );

    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-valuenow');
    expect(html).not.toContain('aria-valuemin');
    expect(html).not.toContain('aria-valuemax');
  });

  it('renders segmented meter track with 8 cells and spark glyph', () => {
    const html = renderToStaticMarkup(
      createElement(LabLoading, {
        title: 'Charging',
        hint: 'Connecting circuits',
      }),
    );

    expect(html).toContain('class="gt-lab-loading__track"');
    const cellMatches = html.match(/gt-lab-loading__cell--\d/g);
    expect(cellMatches).toHaveLength(8);
    expect(html).toContain('gt-lab-loading__spark');
  });

  it('accepts custom className and combines it with base class', () => {
    const html = renderToStaticMarkup(
      createElement(LabLoading, {
        title: 'Charging',
        hint: 'Ready',
        className: 'gt-custom-modifier',
      }),
    );

    expect(html).toContain('class="gt-lab-loading gt-custom-modifier"');
  });
});

describe('loading.css styles and motion safety', () => {
  const cssPath = new URL('../src/styles/loading.css', import.meta.url);
  const cssContent = fs.readFileSync(cssPath, 'utf-8') as string;

  it('includes prefers-reduced-motion block that disables animation and shows static half-filled state', () => {
    const reducedMotion = extractMediaBlock(cssContent, 'prefers-reduced-motion: reduce');
    expect(reducedMotion, 'prefers-reduced-motion block must exist in loading.css').not.toBeNull();

    // Disables animations
    expect(reducedMotion!).toMatch(/animation:\s*none\s*!important/);

    // Static half-filled state: first half of cells (1-4) statically filled, second half (5-8) unfilled
    expect(reducedMotion!).toContain(':nth-child(-n+4)');
    expect(reducedMotion!).toContain(':nth-child(n+5)');
    expect(reducedMotion!).toMatch(/opacity:\s*1\s*!important/);
  });

  it('has no flashing keyframe cycle shorter than 0.34 s (WCAG 2.3.1)', () => {
    const normalCss = stripMediaBlocks(cssContent);
    const animationPropRegex = /(?:animation|animation-duration):\s*([^;]+);/g;

    const durationsSec: number[] = [];
    let match: RegExpExecArray | null;

    while ((match = animationPropRegex.exec(normalCss)) !== null) {
      const decl = match[1];
      if (!decl) continue;
      // In CSS animation shorthand, duration is the first time token
      const timeMatches = decl.match(/(\d+(?:\.\d+)?)(s|ms)\b/g);
      if (timeMatches && timeMatches.length > 0) {
        const firstTime = timeMatches[0];
        const unit = firstTime.endsWith('ms') ? 'ms' : 's';
        const num = parseFloat(firstTime.slice(0, -unit.length));
        const inSec = unit === 'ms' ? num / 1000 : num;
        durationsSec.push(inSec);
      }
    }

    expect(durationsSec.length).toBeGreaterThan(0);
    for (const duration of durationsSec) {
      // Must be at least 0.34 seconds (< 3 flashes per second)
      expect(duration).toBeGreaterThanOrEqual(0.34);
    }
  });

  it('uses design tokens with fallbacks for copper, green, and bone', () => {
    expect(cssContent).toContain('var(--gt-copper, var(--gt-green-dim))');
    expect(cssContent).toContain('var(--gt-green)');
    expect(cssContent).toContain('var(--gt-bone,');
  });
});
