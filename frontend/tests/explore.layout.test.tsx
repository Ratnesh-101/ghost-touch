/**
 * Layout, toolbar, title wrapping, canvas fill, and status height tests (Lane lab-explore4)
 *
 * Verifies:
 * 1. Explore toolbar uses SettingsLauncher instead of old selectors; Ask, Back, Correct retain roles and accessible names.
 * 2. Title wraps to two lines with white-space: normal, not nowrap, and DIAGRAM badge has flex-shrink: 0.
 * 3. Explore and Correct canvas containers are flexible with min-height, canvas fills 100% width and height.
 * 4. Canvas and container backgrounds match the same color token (var(--gt-bg, #0b0e0c)).
 * 5. Correct status element has a reserved min-height to prevent layout jump during drag/edits.
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { Correct } from '../src/screens/Correct';
import { Explore } from '../src/screens/Explore';

const exploreCssPath = new URL('../src/styles/explore.css', import.meta.url);
const exploreCss = fs.readFileSync(exploreCssPath, 'utf-8') as string;

const correctCssPath = new URL('../src/styles/correct.css', import.meta.url);
const correctCss = fs.readFileSync(correctCssPath, 'utf-8') as string;

const globalCssPath = new URL('../src/styles/global.css', import.meta.url);
const globalCss = fs.readFileSync(globalCssPath, 'utf-8') as string;

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

function findRule(rules: ParsedRule[], selector: string): ParsedRule | undefined {
  return rules.find((r) => r.selectors.includes(selector));
}

const testDrivers: Drivers = {
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true, getRate: () => 'normal' },
  diagramStore: new MemoryDiagramStore(),
};

const sampleScene: DiagramScene = {
  kind: 'geometry',
  title: 'Right Triangle ABC Long Specimen Title',
  points: [
    { id: 'A', x: 0.1, y: 0.9, label: 'A' },
    { id: 'B', x: 0.9, y: 0.9, label: 'B' },
    { id: 'C', x: 0.1, y: 0.1, label: 'C' },
  ],
  segments: [
    { id: 's1', a: 'A', b: 'B' },
    { id: 's2', a: 'A', b: 'C' },
    { id: 's3', a: 'C', b: 'B' },
  ],
};

describe('Explore toolbar & SettingsLauncher (Item 1)', () => {
  it('renders SettingsLauncher button instead of individual language/rate buttons in Explore toolbar', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: sampleScene,
        announced: 'Right Triangle.',
        drivers: testDrivers,
        onBack: vi.fn(),
        onCorrect: vi.fn(),
      }),
    );

    // Old individual language/rate buttons are not rendered in the main toolbar
    expect(html).not.toContain('gt-lang-selector__btn');
    expect(html).not.toContain('gt-rate-selector__btn');

    // Single consolidated SettingsLauncher button is rendered
    expect(html).toContain('gt-settings-launcher__button');
    expect(html).toContain('Settings: English, 1.0×');
    expect(html).toContain('aria-haspopup="dialog"');

    // Retains other controls: Ask, Back, Correct
    expect(html).toContain('gt-explore__ask');
    expect(html).toContain('gt-explore__back');
    expect(html).toContain('gt-explore__correct');
    expect(html).toContain('Ask');
    expect(html).toContain('Back');
    expect(html).toContain('Correct');
  });
});

describe('Explore title wrapping & Diagram badge (Item 2)', () => {
  const exploreRules = parseCssRules(exploreCss);
  const globalRules = parseCssRules(globalCss);

  it('allows title to wrap onto two lines and forbids nowrap', () => {
    for (const rules of [exploreRules, globalRules]) {
      const titleRule = findRule(rules, '.gt-explore__title');
      expect(titleRule).toBeDefined();
      expect(titleRule?.declarations['white-space']).toBe('normal');
      expect(titleRule?.declarations['white-space']).not.toBe('nowrap');
      expect(titleRule?.declarations['-webkit-line-clamp']).toBe('2');
      expect(titleRule?.declarations['flex']).toMatch(/1\s+1\s+auto/);
    }
  });

  it('diagram badge has flex-shrink: 0 to prevent squeezing title', () => {
    const badgeRule = findRule(exploreRules, '.gt-lab-badge');
    expect(badgeRule).toBeDefined();
    expect(badgeRule?.declarations['flex-shrink']).toBe('0');

    const globalBadgeRule = findRule(globalRules, '.gt-explore__badge');
    expect(globalBadgeRule).toBeDefined();
    expect(globalBadgeRule?.declarations['flex-shrink']).toBe('0');
  });

  it('title row lays out title and badge across full width', () => {
    const rowRule = findRule(exploreRules, '.gt-explore__title-row');
    expect(rowRule).toBeDefined();
    expect(rowRule?.declarations['display']).toBe('flex');
    expect(rowRule?.declarations['width']).toBe('100%');
  });
});

describe('Canvas fill and background matching (Item 3)', () => {
  const exploreRules = parseCssRules(exploreCss);
  const correctRules = parseCssRules(correctCss);
  const globalRules = parseCssRules(globalCss);

  it('Explore canvas container is a flex child with sensible clamp min-height', () => {
    const tableRule = findRule(exploreRules, '.gt-lab-specimen-table');
    expect(tableRule).toBeDefined();
    expect(tableRule?.declarations['flex']).toMatch(/1\s+1\s+auto/);
    expect(tableRule?.declarations['min-height']).toMatch(/clamp\(220px,\s*55dvh,\s*100%\)/);

    const containerRule = findRule(globalRules, '.gt-explore__canvas-container');
    expect(containerRule).toBeDefined();
    expect(containerRule?.declarations['flex']).toMatch(/1\s+1\s+auto/);
    expect(containerRule?.declarations['min-height']).toMatch(/clamp\(220px,\s*55dvh,\s*100%\)/);
  });

  it('Explore canvas fills 100% of container and has matching background token', () => {
    const canvasRule = findRule(exploreRules, '.gt-explore__canvas');
    expect(canvasRule).toBeDefined();
    expect(canvasRule?.declarations['width']).toBe('100%');
    expect(canvasRule?.declarations['height']).toBe('100%');
    expect(canvasRule?.declarations['flex']).toMatch(/1\s+1\s+auto/);
    expect(canvasRule?.declarations['background-color']).toContain('var(--gt-bg');

    const tableRule = findRule(exploreRules, '.gt-lab-specimen-table');
    expect(tableRule?.declarations['background']).toContain('var(--gt-bg');
  });

  it('Correct canvas fills 100% of container and has matching background token', () => {
    const canvasRule = findRule(correctRules, '.gt-correct__canvas');
    expect(canvasRule).toBeDefined();
    expect(canvasRule?.declarations['width']).toBe('100%');
    expect(canvasRule?.declarations['height']).toBe('100%');
    expect(canvasRule?.declarations['flex']).toMatch(/1\s+1\s+auto/);
    expect(canvasRule?.declarations['background-color']).toContain('var(--gt-bg');

    const containerRule = findRule(correctRules, '.gt-correct__canvas-container');
    expect(containerRule?.declarations['display']).toBe('flex');
    expect(containerRule?.declarations['flex-direction']).toBe('column');
    expect(containerRule?.declarations['background']).toContain('var(--gt-bg');
  });
});

describe('Correct status area height reservation (Item 4)', () => {
  const correctRules = parseCssRules(correctCss);

  it('Correct status element reserves height with a min-height to prevent layout jump', () => {
    const cardRule = findRule(correctRules, '.gt-correct__status-card');
    expect(cardRule).toBeDefined();
    expect(cardRule?.declarations['min-height']).toBeDefined();
    expect(cardRule?.declarations['min-height']).toMatch(/4\.5rem|72px/);

    const statusRule = findRule(correctRules, '.gt-correct__status');
    expect(statusRule).toBeDefined();
    expect(statusRule?.declarations['min-height']).toBeDefined();
    expect(statusRule?.declarations['min-height']).toMatch(/3rem|48px/);
  });

  it('renders status card with status message in Correct mode', () => {
    const html = renderToStaticMarkup(
      createElement(Correct, {
        scene: sampleScene,
        photoUrl: null,
        drivers: testDrivers,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(html).toContain('gt-correct__status-card');
    expect(html).toContain('gt-correct__status');
  });
});
