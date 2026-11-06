/**
 * WCAG Contrast Ratio Tests for Ghost Touch Design Tokens
 *
 * Requirement 12.2: Dark theme with glowing green lines and contrast ratio
 * of at least 7:1 for text (WCAG AAA) and >= 4.5:1 for large text/UI components.
 *
 * Verifies that all actually used text/background pairs meet or exceed requirements,
 * preserving the glowing green #39ff88 brand identity.
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Converts a 3 or 6 hex color string to RGB channels [0..255].
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const chars = clean.split('');
    const c0 = chars[0] ?? '0';
    const c1 = chars[1] ?? '0';
    const c2 = chars[2] ?? '0';
    const r = parseInt(`${c0}${c0}`, 16);
    const g = parseInt(`${c1}${c1}`, 16);
    const b = parseInt(`${c2}${c2}`, 16);
    return [r, g, b];
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

/**
 * Computes relative luminance per WCAG 2.1 specs:
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(rgb: [number, number, number]): number {
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(rgb[0]);
  const g = toLinear(rgb[1]);
  const b = toLinear(rgb[2]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculates WCAG contrast ratio between two hex colors: (L1 + 0.05) / (L2 + 0.05)
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parses CSS custom properties from styles/tokens.css into a name->hex dictionary.
 */
export function parseColourTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const rawLine of css.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('--')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const name = line.slice(0, colonIdx).trim();
    const valuePart = line.slice(colonIdx + 1).trim();
    const hexMatch = valuePart.match(/^(#[0-9a-fA-F]{3,8})/);
    const hex = hexMatch?.[1];
    if (hex) {
      tokens[name] = hex.toLowerCase();
    }
  }
  return tokens;
}

describe('a11y contrast (Requirement 12.2)', () => {
  // Read tokens.css directly from disk in Vitest node environment
  const tokensPath = new URL('../src/styles/tokens.css', import.meta.url);
  const tokensCss = fs.readFileSync(tokensPath, 'utf-8') as string;
  const tokens = parseColourTokens(tokensCss);

  it('parses tokens from tokens.css', () => {
    expect(Object.keys(tokens).length).toBeGreaterThan(5);
  });

  it('preserves the glowing green #39ff88 brand identity', () => {
    expect(tokens['--gt-green']).toBe('#39ff88');
    expect(tokens['--gt-line']).toBe('#39ff88');
    expect(tokens['--gt-focus']).toBe('#39ff88');
  });

  describe('body text / background pairs actually used (>= 7:1, WCAG AAA)', () => {
    const bodyTextPairs: Array<{ text: string; bg: string; label: string }> = [
      // Primary body text (--gt-text) across surfaces
      { text: '--gt-text', bg: '--gt-bg', label: 'default body text on background' },
      { text: '--gt-text', bg: '--gt-bg-elevated', label: 'body text on elevated bg' },
      { text: '--gt-text', bg: '--gt-surface', label: 'control text on surface' },
      { text: '--gt-text', bg: '--gt-surface-card', label: 'card text on surface card' },
      { text: '--gt-text', bg: '--gt-surface-hover', label: 'button text on hover surface' },
      { text: '--gt-text', bg: '--gt-surface-active', label: 'button text on active surface' },

      // High-contrast primary text
      { text: '--gt-text-primary', bg: '--gt-bg', label: 'primary text on background' },
      { text: '--gt-text-primary', bg: '--gt-surface', label: 'primary text on surface' },

      // Secondary text
      { text: '--gt-text-secondary', bg: '--gt-bg', label: 'secondary text on background' },
      { text: '--gt-text-secondary', bg: '--gt-surface', label: 'secondary text on surface' },
      { text: '--gt-text-secondary', bg: '--gt-surface-card', label: 'secondary text on surface card' },

      // Muted text (subhints, taglines, labels)
      { text: '--gt-text-muted', bg: '--gt-bg', label: 'muted text on background' },
      { text: '--gt-text-muted', bg: '--gt-surface', label: 'muted text on surface' },
      { text: '--gt-text-muted', bg: '--gt-surface-card', label: 'muted text on surface card' },
      { text: '--gt-text-muted', bg: '--gt-surface-hover', label: 'muted text on hover surface' },
      { text: '--gt-text-muted', bg: '--gt-surface-active', label: 'muted text on active surface' },

      // Dark text on glowing green button surfaces
      { text: '--gt-text-dark', bg: '--gt-green', label: 'dark button text on green fill' },
      { text: '--gt-text-dark', bg: '--gt-line', label: 'dark button text on glowing line accent' },
    ];

    for (const { text, bg, label } of bodyTextPairs) {
      it(`${label} (${text} on ${bg}) is >= 7:1`, () => {
        const textHex = tokens[text];
        const bgHex = tokens[bg];
        expect(textHex, `Token ${text} exists`).toBeDefined();
        expect(bgHex, `Token ${bg} exists`).toBeDefined();

        if (textHex && bgHex) {
          const ratio = contrastRatio(textHex, bgHex);
          expect(ratio).toBeGreaterThanOrEqual(7.0);
        }
      });
    }
  });

  describe('large text / UI component pairs (>= 4.5:1)', () => {
    const uiPairs: Array<{ text: string; bg: string; label: string }> = [
      { text: '--gt-line', bg: '--gt-bg', label: 'glowing green titles/accents on dark background' },
      { text: '--gt-line', bg: '--gt-surface', label: 'glowing green text on surface' },
      { text: '--gt-line', bg: '--gt-surface-card', label: 'glowing green text on surface card' },
      { text: '--gt-focus', bg: '--gt-bg', label: 'focus ring indicator against background' },
      { text: '--gt-green-dim', bg: '--gt-bg', label: 'dim green UI element on background' },
      { text: '--gt-bg', bg: '--gt-copper', label: 'raw badge text on copper' },
    ];

    for (const { text, bg, label } of uiPairs) {
      it(`${label} (${text} on ${bg}) is >= 4.5:1`, () => {
        const textHex = tokens[text];
        const bgHex = tokens[bg];
        expect(textHex, `Token ${text} exists`).toBeDefined();
        expect(bgHex, `Token ${bg} exists`).toBeDefined();

        if (textHex && bgHex) {
          const ratio = contrastRatio(textHex, bgHex);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  });
});
