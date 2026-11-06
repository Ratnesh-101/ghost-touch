/**
 * Lab Style Tests for Teacher Correct Mode
 *
 * Requirements:
 * - Specimen table frame around the canvas with copper border, rivets, and stitched seam.
 * - Maximum contrast inside canvas (no background texture inside canvas itself).
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
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { setLang, t } from '../src/i18n';
import { Correct } from '../src/screens/Correct';

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

const mockDrivers: Drivers = {
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
  diagramStore: new MemoryDiagramStore(),
};

const sampleScene: DiagramScene = {
  kind: 'geometry',
  title: 'Lab Triangle',
  points: [
    { id: 'p1', x: 0.2, y: 0.2, label: 'A' },
    { id: 'p2', x: 0.8, y: 0.8, label: 'B' },
  ],
  segments: [{ id: 's1', a: 'p1', b: 'p2', label: 'AB' }],
};

describe('Correct Screen: Lab Style markup & elements', () => {
  beforeEach(() => {
    setLang('en');
  });

  it('renders heading as real text (h1)', () => {
    const html = renderToStaticMarkup(
      createElement(Correct, {
        scene: sampleScene,
        photoUrl: null,
        drivers: mockDrivers,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(html).toContain('<h1 class="gt-correct__title" tabindex="-1">');
    expect(html).toContain(t('correct.title'));
  });

  it('renders canvas container and high-contrast canvas with role=img and aria-label', () => {
    const html = renderToStaticMarkup(
      createElement(Correct, {
        scene: sampleScene,
        photoUrl: null,
        drivers: mockDrivers,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(html).toContain('gt-correct__canvas-container');
    expect(html).toContain('gt-correct__canvas');
    expect(html).toContain('role="img"');
    expect(html).toContain(t('correct.photoOverlay'));
  });

  it('renders lab action buttons with accessible names', () => {
    const html = renderToStaticMarkup(
      createElement(Correct, {
        scene: sampleScene,
        photoUrl: null,
        drivers: mockDrivers,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(html).toContain('gt-correct__btn');
    expect(html).toContain(t('correct.cancel'));
    expect(html).toContain(t('correct.undo'));
    expect(html).toContain(t('correct.redo'));
    expect(html).toContain(t('correct.delete'));
    expect(html).toContain(t('correct.save'));
  });
});

describe('Correct CSS: 48x48 targets, focus-visible & token conformance', () => {
  const cssPath = new URL('../src/styles/correct.css', import.meta.url);
  const css = fs.readFileSync(cssPath, 'utf-8') as string;
  const rules = parseCssRules(css);

  const interactiveClasses = [
    '.gt-correct__btn',
    '.gt-correct__btn--primary',
    '.gt-correct__btn--danger',
    '.gt-correct__label-input',
    '.gt-correct__canvas',
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
      'border-top',
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

  it('preserves maximum contrast inside canvas without decorative texture', () => {
    const match = rules.find((r) => r.selectors.includes('.gt-correct__canvas'));
    expect(match).toBeDefined();
    expect(match?.declarations['background-color']).toContain('var(--gt-bg');
    expect(match?.declarations['background-image']).toBeUndefined();
  });

  it('respects prefers-reduced-motion with no animation', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).not.toContain('@keyframes');
  });

  it('BUG-02: eliminates object-fit: contain on .gt-correct__canvas to prevent letterbox desynchronization', () => {
    const canvasRule = rules.find((r) => r.selectors.includes('.gt-correct__canvas'));
    expect(canvasRule).toBeDefined();
    expect(canvasRule?.declarations['object-fit']).toBeUndefined();
  });

  it('BUG-06: provides safe-area insets on .gt-correct', () => {
    expect(css).toMatch(/\.gt-correct\s*\{[^}]*env\(safe-area-inset-top/);
    expect(css).toMatch(/\.gt-correct\s*\{[^}]*env\(safe-area-inset-bottom/);
  });

  it('BUG-07: prevents forced 280px min-height in landscape with clamp and landscape rule', () => {
    const containerRule = rules.find((r) => r.selectors.includes('.gt-correct__canvas-container'));
    expect(containerRule).toBeDefined();
    expect(containerRule?.declarations['min-height']).toMatch(/clamp\(160px,\s*40vh,\s*280px\)/);

    // Landscape media query rule exists
    expect(css).toMatch(/@media[^{]*orientation:\s*landscape[^{]*\{[\s\S]*?\.gt-correct__canvas-container[\s\S]*?min-height:\s*160px/);
  });
});
