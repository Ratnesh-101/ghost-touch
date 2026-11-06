/**
 * Visual Polish Verification Tests (Lane: lab-polish)
 *
 * Verifies fixes for:
 * 1. Logo visibility on Start at narrow widths (320px, 360px, 390px, 430px):
 *    - Logo markup present in Start hero before the mascot.
 *    - CSS contains no rule hiding or collapsing the logo.
 *    - Logo declares flex-shrink: 0 and aspect-ratio: 340 / 80 to prevent flexbox collapse.
 * 2. Organ tiles compact horizontal row layout on narrow screens (<= 640px):
 *    - Laid out horizontally with flex-direction: row and text-align: left.
 *    - Compact row height (min-height: 64px, target range 64 to 72 px).
 *    - Responsive media query in start.css placed after base rules to preserve cascade.
 *    - Text wrapping preserved (white-space: normal, overflow-wrap: break-word).
 * 3. Capture sample card labels:
 *    - Font-size is at least 0.875rem (14px) with comfortable line height.
 *    - Preserves >= 48px minimum touch targets and multiline wrapping.
 * 4. All interactive controls satisfy >= 48px touch targets.
 * 5. All colours derived strictly from CSS variables / tokens.
 */

// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { Start } from '../src/screens/Start';

const globalCssPath = new URL('../src/styles/global.css', import.meta.url);
const globalCss = fs.readFileSync(globalCssPath, 'utf-8') as string;

const startCssPath = new URL('../src/styles/start.css', import.meta.url);
const startCss = fs.readFileSync(startCssPath, 'utf-8') as string;

function makeMockDrivers(): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
    speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
    diagramStore: new MemoryDiagramStore(),
  };
}

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

describe('Lane lab-polish: Visual Fixes Verification', () => {
  describe('Problem 1: Start Logo visibility & anti-collapse', () => {
    it('renders the Logo markup inside the Start hero before the mascot emblem', () => {
      const drivers = makeMockDrivers();
      const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));

      expect(html).toContain('gt-start__logo');
      expect(html).toContain('gt-logo--full');
      expect(html).toContain('gt-start__creature-emblem');

      // The logo must precede the creature mascot emblem in DOM order
      const logoIdx = html.indexOf('gt-start__logo');
      const emblemIdx = html.indexOf('gt-start__creature-emblem');
      expect(logoIdx).toBeGreaterThan(-1);
      expect(emblemIdx).toBeGreaterThan(-1);
      expect(logoIdx).toBeLessThan(emblemIdx);
    });

    it('.gt-start__logo declares flex-shrink: 0 and aspect-ratio to prevent flexbox shrink collapse', () => {
      const match = /\.gt-start__logo\s*\{([^}]+)\}/.exec(globalCss);
      expect(match, '.gt-start__logo rule exists in global.css').not.toBeNull();
      const body = match?.[1] ?? '';

      // flex-shrink: 0 guarantees flex container does not collapse it when organ cards stack
      expect(body).toMatch(/flex-shrink:\s*0/);

      // aspect-ratio preserves intrinsic proportions at 320, 360, 390, 430px
      expect(body).toMatch(/aspect-ratio:\s*340\s*\/\s*80/);

      // Width is responsive
      expect(body).toMatch(/width:\s*min\(/);
      expect(body).toMatch(/height:\s*auto/);
    });

    it('neither global.css nor start.css has any rule that hides or collapses the logo at narrow widths', () => {
      const combinedCss = `${globalCss}\n${startCss}`;

      // Check all media queries in both files
      const mediaQueryRegex = /@media[^{]+\{([\s\S]+?\n\})/g;
      let mqMatch: RegExpExecArray | null;

      while ((mqMatch = mediaQueryRegex.exec(combinedCss)) !== null) {
        const mqBody = mqMatch[1];
        if (!mqBody) continue;
        if (mqBody.includes('.gt-start__logo') || mqBody.includes('.gt-logo')) {
          // If logo is mentioned in a media query, verify it is NEVER hidden or collapsed
          expect(mqBody).not.toMatch(/\.gt-start__logo[^{]*\{[^}]*display:\s*none/);
          expect(mqBody).not.toMatch(/\.gt-start__logo[^{]*\{[^}]*visibility:\s*hidden/);
          expect(mqBody).not.toMatch(/\.gt-start__logo[^{]*\{[^}]*(?:max-)?height:\s*0/);
          expect(mqBody).not.toMatch(/\.gt-start__logo[^{]*\{[^}]*(?:max-)?width:\s*0/);
          expect(mqBody).not.toMatch(/\.gt-logo[^{]*\{[^}]*display:\s*none/);
        }
      }
    });
  });

  describe('Problem 2: Organ tiles horizontal compact row layout on narrow screens', () => {
    it('start.css defines a narrow-screen @media (max-width: 640px) rule laying tiles out in a row', () => {
      const mqBody = extractMediaBlock(startCss, 'max-width: 640px');
      expect(mqBody, '@media (max-width: 640px) exists in start.css').not.toBeNull();

      // Organ tiles container stacks in single column
      expect(mqBody!).toMatch(/\.gt-organ-tiles\s*\{[^}]*grid-template-columns:\s*1fr/);

      // Each individual tile lays out horizontally in a row with left text alignment
      expect(mqBody!).toMatch(/\.gt-organ-tile\s*\{[^}]*flex-direction:\s*row/);
      expect(mqBody!).toMatch(/\.gt-organ-tile\s*\{[^}]*text-align:\s*left/);
      expect(mqBody!).toMatch(/\.gt-organ-tile\s*\{[^}]*align-items:\s*center/);
    });

    it('start.css places the @media (max-width: 640px) block AFTER the base .gt-organ-tile rule for correct cascade', () => {
      const baseTileIdx = startCss.indexOf('.gt-organ-tile {');
      const mqIdx = startCss.indexOf('@media (max-width: 640px)');

      expect(baseTileIdx).toBeGreaterThan(-1);
      expect(mqIdx).toBeGreaterThan(-1);
      // The media query MUST come after the base rule so row layout is not overridden by column layout
      expect(mqIdx).toBeGreaterThan(baseTileIdx);
    });

    it('organ tile specifies compact min-height in 64 to 72 px range with wrapping for Indian scripts', () => {
      const mqBody = extractMediaBlock(startCss, 'max-width: 640px');
      expect(mqBody).not.toBeNull();

      const minHeightMatch = /\.gt-organ-tile\s*\{[^}]*min-height:\s*(\d+)px/.exec(mqBody!);
      expect(minHeightMatch, 'min-height is defined on .gt-organ-tile in narrow viewports').not.toBeNull();
      const minHeight = Number(minHeightMatch?.[1]);
      expect(minHeight).toBeGreaterThanOrEqual(64);
      expect(minHeight).toBeLessThanOrEqual(72);

      // Must NOT have a fixed height (which would clip multiline Hindi / Gujarati text)
      expect(mqBody!).not.toMatch(/\.gt-organ-tile\s*\{[^}]*(?<!min-)height:\s*\d+px/);

      // Base tile preserves wrapping
      expect(startCss).toMatch(/\.gt-organ-tile\s*\{[^}]*overflow-wrap:\s*break-word/);
      expect(startCss).toMatch(/\.gt-organ-tile\s*\{[^}]*white-space:\s*normal/);
    });

    it('maintains 3-column layout on wide screens', () => {
      expect(startCss).toMatch(/\.gt-organ-tiles\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/);
      expect(startCss).toMatch(/\.gt-organ-tile\s*\{[^}]*flex-direction:\s*column/);
    });
  });

  describe('Problem 3: Capture sample card labels font-size & touch targets', () => {
    it('.gt-capture__sample-name font-size is at least 0.875rem (14px) with comfortable line height', () => {
      const match = /\.gt-capture__sample-name\s*\{([^}]+)\}/.exec(globalCss);
      expect(match, '.gt-capture__sample-name exists').not.toBeNull();
      const body = match?.[1] ?? '';

      // Font size must be at least 0.875rem
      expect(body).toMatch(/font-size:\s*(?:var\(--gt-text-sm(?:,\s*0\.875rem)?\)|0\.875rem)/);
      expect(body).toMatch(/line-height:\s*(?:var\(--gt-line-height-normal(?:,\s*1\.4)?\)|1\.4)/);

      // Allows multiline wrapping for longer Hindi/Gujarati names
      expect(body).toContain('overflow-wrap: break-word');
      expect(body).toContain('white-space: normal');
    });

    it('.gt-capture__sample-btn font-size is at least 0.875rem and does not shrink on <= 380px screens', () => {
      const matchBase = /\.gt-capture__sample-btn\s*\{([^}]+)\}/.exec(globalCss);
      expect(matchBase).not.toBeNull();
      const baseBody = matchBase?.[1] ?? '';
      expect(baseBody).toMatch(/font-size:\s*(?:var\(--gt-text-sm(?:,\s*0\.875rem)?\)|0\.875rem)/);

      // Check narrow device media query (<= 380px)
      const mqMatch = /@media\s*\(\s*max-width:\s*380px\s*\)\s*\{([\s\S]+?)\n\}/.exec(globalCss);
      expect(mqMatch).not.toBeNull();
      const mqBody = mqMatch?.[1] ?? '';

      // The old 0.72rem font size must NOT be present
      expect(mqBody).not.toContain('0.72rem');
      expect(mqBody).toMatch(/\.gt-capture__sample-btn\s*\{[^}]*font-size:\s*var\(--gt-text-sm/);
    });

    it('sample cards maintain minimum 48px touch targets', () => {
      const match = /\.gt-capture__sample-btn\s*\{([^}]+)\}/.exec(globalCss);
      expect(match).not.toBeNull();
      const body = match?.[1] ?? '';

      const minHeightMatch = body.match(/min-height:\s*(\d+)px/);
      expect(Number(minHeightMatch?.[1])).toBeGreaterThanOrEqual(48);

      expect(body).toMatch(/min-width:\s*var\(--gt-target\)/);
    });
  });

  describe('Design Tokens & Accessibility Integrity', () => {
    it('start.css contains zero hardcoded hex or rgb colors', () => {
      // Remove comments first
      const cleanCss = startCss.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(cleanCss).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(cleanCss).not.toMatch(/\brgb\s*\(/);
      expect(cleanCss).not.toMatch(/\brgba\s*\(/);
    });

    it('all interactive controls maintain >= 48px touch targets (Requirement 12.1)', () => {
      // Start surface
      expect(globalCss).toMatch(/\.gt-start-surface\s*\{[^}]*min-width:\s*var\(--gt-target\)/);
      expect(globalCss).toMatch(/\.gt-start-surface\s*\{[^}]*min-height:\s*var\(--gt-target\)/);

      // Capture button
      const btnMatch = /\.gt-capture__button\s*\{[^}]*min-height:\s*(\d+)px/.exec(globalCss);
      expect(Number(btnMatch?.[1])).toBeGreaterThanOrEqual(48);

      // Sample button
      const sampleMatch = /\.gt-capture__sample-btn\s*\{[^}]*min-height:\s*(\d+)px/.exec(globalCss);
      expect(Number(sampleMatch?.[1])).toBeGreaterThanOrEqual(48);
    });
  });
});
