/**
 * Focus and Motion Accessibility Tests
 *
 * Requirements:
 * - Visible focus ring on every control (>= 3px, high contrast).
 * - Honour prefers-reduced-motion for every animation and glow pulse.
 * - Windows High Contrast / forced-colors active support.
 */
import { describe, expect, it } from 'vitest';
import globalCss from '../src/styles/global.css?raw';

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

describe('focus and motion accessibility (Task 3)', () => {
  describe('prefers-reduced-motion media query', () => {
    it('declares a @media (prefers-reduced-motion: reduce) block', () => {
      expect(globalCss).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{/);
    });

    it('disables animations universally with 0.001ms duration and paused state', () => {
      const content = extractMediaBlock(globalCss, 'prefers-reduced-motion: reduce');
      expect(content, 'Reduced motion block exists').not.toBeNull();

      expect(content!).toMatch(/animation-duration:\s*0\.001ms\s*!important/);
      expect(content!).toMatch(/animation-play-state:\s*paused\s*!important/);
      expect(content!).toMatch(/transition-duration:\s*0\.001ms\s*!important/);
    });

    it('explicitly removes animations from pulse and progress indicators', () => {
      const content = extractMediaBlock(globalCss, 'prefers-reduced-motion: reduce');
      expect(content).not.toBeNull();

      // Target classes for creature pulse and progress bar
      expect(content!).toContain('.gt-start__pulse-dot');
      expect(content!).toContain('.gt-capture__status-indicator');
      expect(content!).toContain('.gt-capture__progress-bar');
      expect(content!).toContain('.gt-mascot');
      expect(content!).toMatch(/animation:\s*none\s*!important/);
    });

    it('strips drop-shadow filters and transforms from SVGs under reduced motion', () => {
      const content = extractMediaBlock(globalCss, 'prefers-reduced-motion: reduce');
      expect(content).not.toBeNull();

      expect(content!).toMatch(/filter:\s*none\s*!important/);
      expect(content!).toMatch(/transform:\s*none\s*!important/);
    });
  });

  describe('visible focus rings (>= 3px, high contrast)', () => {
    it('.gt-control:focus-visible provides a >= 3px high-contrast outline and offset', () => {
      const match = /\.gt-control:focus-visible\s*\{([^}]+)\}/.exec(globalCss);
      expect(match, '.gt-control:focus-visible exists').not.toBeNull();
      const body = match?.[1] ?? '';

      // Outline >= 3px
      const outlineMatch = body.match(/outline:\s*(\d+)px\s+solid\s+var\(--gt-focus\)/);
      expect(outlineMatch, 'Outline is at least 3px with --gt-focus').not.toBeNull();
      const px = Number(outlineMatch?.[1]);
      expect(px).toBeGreaterThanOrEqual(3);

      // Contrast box-shadow ring
      expect(body).toMatch(/box-shadow:[^;]*0\s+0\s+0\s+(\d+)px\s+var\(--gt-focus\)/);
    });

    it('.gt-start-surface:focus-visible provides a >= 3px focus ring', () => {
      const match = /\.gt-start-surface:focus-visible\s*\{([^}]+)\}/.exec(globalCss);
      expect(match).not.toBeNull();
      const body = match?.[1] ?? '';

      const outlineMatch = body.match(/outline:\s*(\d+)px\s+solid\s+var\(--gt-focus\)/);
      expect(outlineMatch).not.toBeNull();
      const px = Number(outlineMatch?.[1]);
      expect(px).toBeGreaterThanOrEqual(3);
    });

    it('.gt-explore__canvas:focus-visible provides a >= 3px focus ring', () => {
      const match = /\.gt-explore__canvas:focus-visible\s*\{([^}]+)\}/.exec(globalCss);
      expect(match).not.toBeNull();
      const body = match?.[1] ?? '';

      const outlineMatch = body.match(/outline:\s*(\d+)px\s+solid\s+var\(--gt-focus\)/);
      expect(outlineMatch).not.toBeNull();
      const px = Number(outlineMatch?.[1]);
      expect(px).toBeGreaterThanOrEqual(3);
    });

    it('.gt-explore__ask-input:focus-visible provides a >= 3px focus ring', () => {
      const match = /\.gt-explore__ask-input:focus-visible\s*\{([^}]+)\}/.exec(globalCss);
      expect(match).not.toBeNull();
      const body = match?.[1] ?? '';

      const outlineMatch = body.match(/outline:\s*(\d+)px\s+solid\s+var\(--gt-focus\)/);
      expect(outlineMatch).not.toBeNull();
      const px = Number(outlineMatch?.[1]);
      expect(px).toBeGreaterThanOrEqual(3);
    });
  });

  describe('high-contrast / forced-colors mode support', () => {
    it('defines a forced-colors: active query with system Highlight outlines', () => {
      expect(globalCss).toMatch(/@media\s*\(\s*forced-colors:\s*active\s*\)/);
      expect(globalCss).toMatch(/outline:\s*3px\s+solid\s+Highlight\s*!important/);
      expect(globalCss).toMatch(/border:\s*2px\s+solid\s+ButtonText\s*!important/);
    });
  });
});
