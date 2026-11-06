// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColourTokens } from './a11y.contrast.test';

describe('Lab foundation design tokens (docs/briefs/agy-lab-foundation.md)', () => {
  const tokensPath = new URL('../src/styles/tokens.css', import.meta.url);
  const tokensCss = fs.readFileSync(tokensPath, 'utf-8') as string;
  const tokens = parseColourTokens(tokensCss);

  describe('required token presence', () => {
    it('defines the lab charcoal background and surface steps', () => {
      expect(tokens['--gt-bg']).toBe('#0b0e0c');
      expect(tokens['--gt-bg-elevated']).toBe('#111713');
      expect(tokens['--gt-surface']).toBe('#141c17');
      expect(tokens['--gt-surface-hover']).toBe('#1b261f');
      expect(tokens['--gt-surface-active']).toBe('#223028');
      expect(tokens['--gt-surface-card']).toBe('#121814');
      expect(tokens['--gt-surface-raised']).toBe('#13271f');
      expect(tokens['--gt-surface-sunken']).toBe('#0d1a15');
    });

    it('preserves creature life green #39ff88', () => {
      expect(tokens['--gt-green']).toBe('#39ff88');
      expect(tokens['--gt-green-bright']).toBe('#4dff95');
      expect(tokens['--gt-line']).toBe('#39ff88');
      expect(tokens['--gt-focus']).toBe('#39ff88');
    });

    it('defines voltage cyan for electric sparks and arcs', () => {
      expect(tokens['--gt-cyan']).toBe('#00f0ff');
      expect(tokens['--gt-voltage-cyan']).toBe('#00f0ff');
    });

    it('defines aged copper and brass for lab hardware and borders', () => {
      expect(tokens['--gt-copper']).toBe('#c88a4b');
      expect(tokens['--gt-copper-bright']).toBe('#e0a96d');
      expect(tokens['--gt-copper-highlight']).toBe('#e0a370');
      expect(tokens['--gt-copper-shadow']).toBe('#4a2810');
      expect(tokens['--gt-brass']).toBe('#d4a359');
      expect(tokens['--gt-hardware']).toBe('#c88a4b');
      expect(tokens['--gt-border-copper']).toBe('#c88a4b');
    });

    it('defines bone / parchment for stitches and secondary text', () => {
      expect(tokens['--gt-bone']).toBe('#ded6c4');
      expect(tokens['--gt-parchment']).toBe('#ded6c4');
      expect(tokens['--gt-stitch']).toBe('#ded6c4');
      expect(tokens['--gt-text-secondary']).toBe('#ded6c4');
    });

    it('defines minimum 48px target', () => {
      expect(tokensCss).toMatch(/--gt-target:\s*48px/);
    });

    it('declares Atkinson Hyperlegible with Indian language system fallbacks', () => {
      expect(tokensCss).toContain('Atkinson Hyperlegible');
      expect(tokensCss).toContain('Noto Sans Devanagari');
      expect(tokensCss).toContain('Noto Sans Gujarati');
    });
  });

  describe('WCAG AAA text contrast (>= 7:1 across surfaces)', () => {
    const surfaces = [
      '--gt-bg',
      '--gt-bg-elevated',
      '--gt-surface',
      '--gt-surface-card',
      '--gt-surface-hover',
      '--gt-surface-active',
    ];

    const textTokens = [
      { name: '--gt-text', label: 'default body text' },
      { name: '--gt-text-primary', label: 'primary high-contrast text' },
      { name: '--gt-text-secondary', label: 'secondary bone/parchment text' },
      { name: '--gt-text-muted', label: 'muted readable text' },
      { name: '--gt-bone', label: 'bone label text' },
    ];

    for (const surface of surfaces) {
      for (const text of textTokens) {
        it(`${text.label} (${text.name} on ${surface}) meets >= 7:1`, () => {
          const textHex = tokens[text.name];
          const bgHex = tokens[surface];
          expect(textHex).toBeDefined();
          expect(bgHex).toBeDefined();
          const ratio = contrastRatio(textHex!, bgHex!);
          expect(ratio).toBeGreaterThanOrEqual(7.0);
        });
      }
    }

    it('dark text on creature green is >= 7:1', () => {
      const ratio = contrastRatio(tokens['--gt-text-dark']!, tokens['--gt-green']!);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });

    it('dark text on voltage cyan is >= 7:1', () => {
      const ratio = contrastRatio(tokens['--gt-text-dark']!, tokens['--gt-cyan']!);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });

    it('dark text on bright copper is >= 7:1', () => {
      const ratio = contrastRatio(tokens['--gt-text-dark']!, tokens['--gt-copper-bright']!);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });
  });

  describe('UI component & border contrast (>= 4.5:1 across surfaces)', () => {
    const surfaces = [
      '--gt-bg',
      '--gt-surface',
      '--gt-surface-card',
      '--gt-surface-active',
    ];

    const uiTokens = [
      { name: '--gt-copper', label: 'copper hardware / button border' },
      { name: '--gt-border-copper', label: 'border copper' },
      { name: '--gt-copper-bright', label: 'bright copper' },
      { name: '--gt-cyan', label: 'voltage cyan sparks' },
      { name: '--gt-green', label: 'creature life green' },
      { name: '--gt-stitch', label: 'bone suture stitches' },
      { name: '--gt-focus', label: 'focus indicator' },
    ];

    for (const surface of surfaces) {
      for (const ui of uiTokens) {
        it(`${ui.label} (${ui.name} against ${surface}) meets >= 4.5:1`, () => {
          const uiHex = tokens[ui.name];
          const bgHex = tokens[surface];
          expect(uiHex).toBeDefined();
          expect(bgHex).toBeDefined();
          const ratio = contrastRatio(uiHex!, bgHex!);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  });
});
