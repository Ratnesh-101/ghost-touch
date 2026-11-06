// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import globalCss from '../src/styles/global.css?raw';
import viteConfigContent from '../vite.config.ts?raw';

describe('Lab typography and offline fonts (docs/briefs/agy-lab-foundation.md)', () => {
  const fontsUrl = new URL('../src/assets/fonts', import.meta.url);

  it('proves the woff2 font files exist in src/assets/fonts/', () => {
    const files = fs.readdirSync(fontsUrl);
    expect(files).toContain('atkinson-hyperlegible-latin-400-normal.woff2');
    expect(files).toContain('atkinson-hyperlegible-latin-700-normal.woff2');
    expect(files).toContain('OFL-LICENSE.txt');
  });

  it('proves vite.config.ts precaches woff2 files in workbox globPatterns', () => {
    expect(viteConfigContent).toMatch(/globPatterns:\s*\[.*woff2.*\]/);
  });

  it('declares @font-face for Atkinson Hyperlegible 400 and 700 with font-display: swap', () => {
    expect(globalCss).toContain("font-family: 'Atkinson Hyperlegible'");
    expect(globalCss).toMatch(/font-weight:\s*400/);
    expect(globalCss).toMatch(/font-weight:\s*700/);
    expect(globalCss).toMatch(/font-display:\s*swap/);
    expect(globalCss).toContain('atkinson-hyperlegible-latin-400-normal.woff2');
    expect(globalCss).toContain('atkinson-hyperlegible-latin-700-normal.woff2');
  });

  it('provides system font fallback stack covering Devanagari and Gujarati', () => {
    const tokensPath = new URL('../src/styles/tokens.css', import.meta.url);
    const tokensContent = fs.readFileSync(tokensPath, 'utf-8') as string;
    expect(tokensContent).toContain('Atkinson Hyperlegible');
    expect(tokensContent).toContain('Nirmala UI');
    expect(tokensContent).toContain('Noto Sans Devanagari');
    expect(tokensContent).toContain('Noto Sans Gujarati');
  });
});
