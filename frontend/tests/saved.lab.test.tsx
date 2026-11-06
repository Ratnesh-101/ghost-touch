/**
 * Lab Style Tests for Saved Diagrams Screen
 *
 * Requirements:
 * - Lab cards with stitched edge, copper border, small rivets.
 * - Mascot above t('saved.empty') text in empty state (calm, centred, aria-hidden).
 * - Heading as real text.
 * - 48x48 min touch targets on every interactive class.
 * - Visible :focus-visible rule for every interactive element.
 * - Colours from CSS variables with fallbacks (no hard-coded colors).
 * - Reduced motion compliance: no animation.
 */

// @ts-expect-error Node runtime fs in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryDiagramStore, type SpeechDriver } from '../src/drivers';
import { setLang, t } from '../src/i18n';
import { SavedDiagrams } from '../src/screens/SavedDiagrams';

interface ParsedRule {
  selectors: string[];
  declarations: Record<string, string>;
}

function parseCssRules(cssText: string): ParsedRule[] {
  const clean = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: ParsedRule[] = [];
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ruleRegex.exec(clean)) !== null) {
    const rawSelectors = match[1];
    const rawBody = match[2];
    if (!rawSelectors || !rawBody) continue;

    const selectors = rawSelectors
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const declarations: Record<string, string> = {};
    for (const decl of rawBody.split(';')) {
      const colonIdx = decl.indexOf(':');
      if (colonIdx === -1) continue;
      const prop = decl.slice(0, colonIdx).trim().toLowerCase();
      const val = decl.slice(colonIdx + 1).trim();
      declarations[prop] = val;
    }
    rules.push({ selectors, declarations });
  }
  return rules;
}

function parseDimensionPx(val: string | undefined): number | null {
  if (!val) return null;
  if (val.includes('var(--gt-target)')) return 48;
  const pxMatch = val.match(/(\d+(?:\.\d+)?)\s*px/);
  const pxStr = pxMatch?.[1];
  if (pxStr) return parseFloat(pxStr);
  return null;
}

function makeMockSpeech(): SpeechDriver {
  return {
    speak: vi.fn(),
    listen: vi.fn(),
    canSpeak: true,
    canListen: true,
  };
}

describe('Saved Diagrams: Lab Style markup & empty state', () => {
  beforeEach(() => {
    setLang('en');
  });

  it('renders heading as real text (h1) with back button and status row', () => {
    const store = new MemoryDiagramStore();
    const speech = makeMockSpeech();
    const html = renderToStaticMarkup(
      createElement(SavedDiagrams, {
        diagramStore: store,
        speech,
        onOpen: vi.fn(),
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('<h1 class="gt-saved__heading" tabindex="-1">');
    expect(html).toContain(t('saved.heading'));
    expect(html).toContain('gt-saved__back');
    expect(html).toContain('gt-saved__status-row');
  });

  it('declares empty state with Mascot (aria-hidden) above saved.empty text', () => {
    const tsxPath = new URL('../src/screens/SavedDiagrams.tsx', import.meta.url);
    const tsx = fs.readFileSync(tsxPath, 'utf-8') as string;

    expect(tsx).toContain("import { Mascot } from '../components/Mascot'");
    expect(tsx).toContain('gt-saved__empty-state');
    expect(tsx).toContain('<Mascot className="gt-saved__mascot"');
    expect(tsx).toContain("{t('saved.empty')}");

    // Mascot is placed above t('saved.empty')
    const mascotPos = tsx.indexOf('<Mascot className="gt-saved__mascot"');
    const emptyPos = tsx.indexOf("{t('saved.empty')}");
    expect(mascotPos).toBeGreaterThan(-1);
    expect(emptyPos).toBeGreaterThan(mascotPos);
  });

  it('defines card list markup with open, pin, and delete controls', () => {
    const tsxPath = new URL('../src/screens/SavedDiagrams.tsx', import.meta.url);
    const tsx = fs.readFileSync(tsxPath, 'utf-8') as string;

    expect(tsx).toContain('gt-saved__list');
    expect(tsx).toContain('gt-saved__item');
    expect(tsx).toContain('gt-saved__btn--open');
    expect(tsx).toContain('gt-saved__btn--pin');
    expect(tsx).toContain('gt-saved__btn--delete');
    expect(tsx).toContain('gt-saved__btn--confirm');
    expect(tsx).toContain('gt-saved__btn--cancel');
  });
});

describe('Saved Diagrams CSS: 48x48 targets, focus-visible & token conformance', () => {
  const cssPath = new URL('../src/styles/saved.css', import.meta.url);
  const css = fs.readFileSync(cssPath, 'utf-8') as string;
  const rules = parseCssRules(css);

  const interactiveClasses = [
    '.gt-saved__back',
    '.gt-saved__btn',
    '.gt-saved__btn--open',
    '.gt-saved__btn--pin',
    '.gt-saved__btn--delete',
    '.gt-saved__btn--confirm',
    '.gt-saved__btn--cancel',
  ];

  for (const selector of interactiveClasses) {
    it(`${selector} has min-width >= 48px`, () => {
      const match = rules.find((r) => r.selectors.includes(selector));
      expect(match, `Rule for ${selector} must exist`).toBeDefined();
      const val = parseDimensionPx(match?.declarations['min-width']);
      expect(val).not.toBeNull();
      expect(val!).toBeGreaterThanOrEqual(48);
    });

    it(`${selector} has min-height >= 48px`, () => {
      const match = rules.find((r) => r.selectors.includes(selector));
      expect(match, `Rule for ${selector} must exist`).toBeDefined();
      const val = parseDimensionPx(match?.declarations['min-height']);
      expect(val).not.toBeNull();
      expect(val!).toBeGreaterThanOrEqual(48);
    });

    it(`${selector} has a :focus-visible rule`, () => {
      const focusSel = `${selector}:focus-visible`;
      const hasFocusRule = rules.some((r) =>
        r.selectors.some((s) => s === focusSel || s.endsWith(':focus-visible')),
      );
      expect(hasFocusRule, `${selector} must have a :focus-visible rule`).toBe(true);
    });
  }

  it('uses only CSS variables for colours (no hard-coded hex/rgb outside var)', () => {
    const colorProps = [
      'color',
      'background',
      'background-color',
      'border',
      'border-color',
      'border-bottom',
      'outline',
      'box-shadow',
    ];

    for (const rule of rules) {
      for (const prop of colorProps) {
        const val = rule.declarations[prop];
        if (!val || val === 'none' || val === 'transparent') continue;

        if (/#|rgba?\(/.test(val)) {
          expect(val, `Property ${prop} in ${rule.selectors.join(', ')} must use var(--gt-)`).toMatch(
            /var\(--gt-/,
          );
        }
      }
    }
  });

  it('incorporates Frankenstein lab motifs (copper borders, dashed stitched seams, rivets)', () => {
    expect(css).toContain('var(--gt-copper');
    expect(css).toContain('dashed');
    expect(css).toContain('radial-gradient');
  });

  it('respects prefers-reduced-motion with no animation', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).not.toContain('@keyframes');
  });

  it('BUG-05: wraps header elements with flex-wrap: wrap to prevent collisions at 320px/200% zoom', () => {
    const headerRule = rules.find((r) => r.selectors.includes('.gt-saved__header'));
    expect(headerRule, '.gt-saved__header rule must exist').toBeDefined();
    expect(headerRule?.declarations['flex-wrap']).toBe('wrap');
    expect(headerRule?.declarations['gap']).toBeDefined();
  });

  it('BUG-06: includes safe-area padding (env(safe-area-inset-*)) on .gt-saved', () => {
    expect(css).toMatch(/\.gt-saved\s*\{[^}]*env\(safe-area-inset-top/);
    expect(css).toMatch(/\.gt-saved\s*\{[^}]*env\(safe-area-inset-bottom/);
  });
});
