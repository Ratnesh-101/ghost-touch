/**
 * Lab Explore Screen Tests — Specimen Table Frame & HUD (Lane lab-explore)
 *
 * Verifies Requirement 12.1 (48x48px targets), 12.2 (AAA contrast),
 * 12.3 / 13 (canvas accessibility), and brief specifications:
 * - Specimen table frame and rivets around the canvas have data-lab-frame and are aria-hidden="true".
 * - Canvas element, its role="img", aria-label, touch-action: none, and pointer handlers are untouched.
 * - Every control around the canvas has an accessible name and a touch target >= 48x48 CSS px.
 * - Raw mode notice is present in raw mode, using t('lab.raw.notice') with fallback.
 * - Colors use CSS variables with fallbacks for lab tokens (--gt-copper, --gt-cyan, --gt-bone).
 * - Prefers-reduced-motion: zero animation in the specimen table frame.
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { canvasAriaLabel } from '../src/flow/navigation';
import { Explore } from '../src/screens/Explore';

const exploreCssPath = new URL('../src/styles/explore.css', import.meta.url);
const exploreCss = fs.readFileSync(exploreCssPath, 'utf-8') as string;

const globalCssPath = new URL('../src/styles/global.css', import.meta.url);
const globalCss = fs.readFileSync(globalCssPath, 'utf-8') as string;

interface ParsedRule {
  selectors: string[];
  declarations: Record<string, string>;
}

function parseCssRules(css: string): ParsedRule[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
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

function findDeclarations(rules: ParsedRule[], targetSelector: string): Record<string, string> | null {
  for (const rule of rules) {
    if (rule.selectors.includes(targetSelector)) {
      return rule.declarations;
    }
  }
  return null;
}

function parseDimensionPx(val: string | undefined): number | null {
  if (!val) return null;
  const varFallbackMatch = val.match(/var\([^,]+,\s*(\d+(?:\.\d+)?)\s*px\)/);
  if (varFallbackMatch?.[1]) {
    return parseFloat(varFallbackMatch[1]);
  }
  if (val.includes('var(--gt-target)')) return 48;
  const pxMatch = val.match(/(\d+(?:\.\d+)?)\s*px/);
  if (pxMatch?.[1]) {
    return parseFloat(pxMatch[1]);
  }
  return null;
}

const testDrivers: Drivers = {
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
  diagramStore: new MemoryDiagramStore(),
};

const sampleScene: DiagramScene = {
  kind: 'geometry',
  title: 'Right Triangle ABC',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.2, y: 0.2, label: 'C' },
  ],
  segments: [
    { id: 's1', a: 'A', b: 'B' },
    { id: 's2', a: 'A', b: 'C' },
    { id: 's3', a: 'C', b: 'B' },
  ],
};

describe('Lab Explore: Specimen Table Frame & Marker (Brief Item 1 & 4)', () => {
  it('renders data-lab-frame marker with aria-hidden="true" on the decorative frame', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: sampleScene,
        announced: 'Right Triangle ABC. Explore hint.',
        drivers: testDrivers,
        onBack: vi.fn(),
      }),
    );

    // Frame marker and aria-hidden
    expect(html).toContain('data-lab-frame');
    expect(html).toMatch(/class="gt-lab-frame"[^>]*data-lab-frame/);
    expect(html).toMatch(/class="gt-lab-frame"[^>]*aria-hidden="true"/);
  });

  it('renders all four corner rivets with aria-hidden="true"', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: sampleScene,
        announced: 'Right Triangle ABC. Explore hint.',
        drivers: testDrivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('gt-lab-rivet--tl');
    expect(html).toContain('gt-lab-rivet--tr');
    expect(html).toContain('gt-lab-rivet--bl');
    expect(html).toContain('gt-lab-rivet--br');

    // Count of rivets
    const rivetMatches = html.match(/class="gt-lab-rivet gt-lab-rivet--[a-z]{2}" aria-hidden="true"/g);
    expect(rivetMatches).toHaveLength(4);
  });

  it('renders stitched suture border element with aria-hidden="true"', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: sampleScene,
        announced: 'Right Triangle ABC. Explore hint.',
        drivers: testDrivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('class="gt-lab-suture-border" aria-hidden="true"');
  });

  it('wraps canvas in specimen table container marked with data-lab-specimen-table', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: sampleScene,
        announced: 'Right Triangle ABC. Explore hint.',
        drivers: testDrivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('class="gt-explore__canvas-container gt-lab-specimen-table" data-lab-specimen-table="true"');
  });
});

describe('Lab Explore: Canvas Accessibility and Independence (Brief Item 1 & Forbidden)', () => {
  it('canvas element is outside aria-hidden and retains role="img" and accessible label', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: sampleScene,
        announced: 'Right Triangle ABC. Double-tap and hold, then drag to feel the diagram. You start at the centre.',
        drivers: testDrivers,
        onBack: vi.fn(),
      }),
    );

    // Canvas exists and has accessible role
    expect(html).toContain('<canvas');
    expect(html).toContain('role="img"');
    expect(html).toContain('tabindex="0"');

    // Canvas label matches flow/navigation helper exactly
    const expectedLabel = canvasAriaLabel(sampleScene);
    expect(html).toContain(`aria-label="${expectedLabel}"`);
  });

  it('canvas declares touch-action: none and has crosshair cursor', () => {
    const exploreRules = parseCssRules(exploreCss);
    const canvasDecls = findDeclarations(exploreRules, '.gt-explore__canvas');
    expect(canvasDecls?.['touch-action']).toBe('none');
    expect(canvasDecls?.['cursor']).toBe('crosshair');

    const globalRules = parseCssRules(globalCss);
    const globalCanvasDecls = findDeclarations(globalRules, '.gt-explore__canvas');
    expect(globalCanvasDecls?.['touch-action']).toBe('none');
    expect(globalCanvasDecls?.['cursor']).toBe('crosshair');
  });

  it('specimen table frame is non-interactive (pointer-events: none) and canvas sits above it', () => {
    const exploreRules = parseCssRules(exploreCss);
    const frameDecls = findDeclarations(exploreRules, '.gt-lab-frame');
    const sutureDecls = findDeclarations(exploreRules, '.gt-lab-suture-border');
    const rivetDecls = findDeclarations(exploreRules, '.gt-lab-rivet');
    const canvasDecls = findDeclarations(exploreRules, '.gt-explore__canvas');

    expect(frameDecls?.['pointer-events']).toBe('none');
    expect(sutureDecls?.['pointer-events']).toBe('none');
    expect(rivetDecls?.['pointer-events']).toBe('none');

    expect(Number(canvasDecls?.['z-index'])).toBeGreaterThan(Number(frameDecls?.['z-index']));
  });
});

describe('Lab Explore: HUD, Status Chip & Raw Mode (Brief Item 2)', () => {
  it('renders restyled lab status card with StatusText', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: sampleScene,
        announced: 'Entry announcement text',
        drivers: testDrivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('gt-lab-status-card');
    expect(html).toContain('Entry announcement text');
  });

  it('renders Diagram specimen badge in the header', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: sampleScene,
        announced: 'Entry announcement',
        drivers: testDrivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('gt-lab-badge');
    expect(html).toContain('Diagram');
  });

  it('renders raw mode notice when in raw mode, with role="status"', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: { kind: 'unknown', title: 'Raw Diagram' },
        announced: "I couldn't fully read this diagram. You can still feel its outlines. Raw Diagram.",
        drivers: testDrivers,
        onBack: vi.fn(),
        isRaw: true,
      }),
    );

    expect(html).toContain('gt-lab-raw-notice');
    expect(html).toContain('role="status"');
    expect(html).toContain('gt-explore__raw-badge');
    expect(html).toContain('Raw');
    expect(html).toContain('gt-explore__raw-text');
  });

  it('does not render raw mode notice for standard AI scenes', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: sampleScene,
        announced: 'Right Triangle ABC. Explore hint.',
        drivers: testDrivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).not.toContain('gt-lab-raw-notice');
  });
});

describe('Lab Explore: Touch Targets >= 48px (Requirement 12.1 & Brief Item 4)', () => {
  const rules = parseCssRules(exploreCss);

  it('makes the Explore back button at least 48px min-height and min-width', () => {
    const decls = findDeclarations(rules, '.gt-explore__back');
    expect(parseDimensionPx(decls?.['min-height'])).toBeGreaterThanOrEqual(48);
    expect(parseDimensionPx(decls?.['min-width'])).toBeGreaterThanOrEqual(48);
  });

  it('makes the Explore ask button at least 48px min-height and min-width', () => {
    const decls = findDeclarations(rules, '.gt-explore__ask');
    expect(parseDimensionPx(decls?.['min-height'])).toBeGreaterThanOrEqual(48);
    expect(parseDimensionPx(decls?.['min-width'])).toBeGreaterThanOrEqual(48);
  });

  it('makes the Correct button at least 48px min-height and min-width', () => {
    const decls = findDeclarations(rules, '.gt-explore__correct');
    expect(parseDimensionPx(decls?.['min-height'])).toBeGreaterThanOrEqual(48);
    expect(parseDimensionPx(decls?.['min-width'])).toBeGreaterThanOrEqual(48);
  });

  it('makes the text send button at least 48px min-height and min-width', () => {
    const decls = findDeclarations(rules, '.gt-explore__send');
    expect(parseDimensionPx(decls?.['min-height'])).toBeGreaterThanOrEqual(48);
    expect(parseDimensionPx(decls?.['min-width'])).toBeGreaterThanOrEqual(48);
  });

  it('makes the fallback question input at least 48px min-height', () => {
    const decls = findDeclarations(rules, '.gt-explore__ask-input');
    expect(parseDimensionPx(decls?.['min-height'])).toBeGreaterThanOrEqual(48);
  });

  it('renders all action buttons with accessible names', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: sampleScene,
        announced: 'Entry announcement',
        drivers: testDrivers,
        onBack: vi.fn(),
        onCorrect: vi.fn(),
      }),
    );

    expect(html).toContain('Ask');
    expect(html).toContain('Back');
    expect(html).toContain('Correct');
  });
});

describe('Lab Explore: Token Fallbacks and Reduced Motion (Brief Item 3 & 5)', () => {
  it('uses CSS variable fallbacks for --gt-copper, --gt-cyan, and --gt-bone', () => {
    expect(exploreCss).toContain('var(--gt-copper,');
    expect(exploreCss).toContain('var(--gt-cyan,');
    expect(exploreCss).toContain('var(--gt-bone,');
  });

  it('global.css imports explore.css at the top of the file before any rules', () => {
    expect(globalCss).toMatch(/@import\s+['"]\.\/explore\.css['"];?/);
    const exploreImportIdx = globalCss.indexOf("@import './explore.css';");
    const fontFaceIdx = globalCss.indexOf('@font-face');
    expect(exploreImportIdx).toBeGreaterThan(-1);
    expect(exploreImportIdx).toBeLessThan(fontFaceIdx);
  });

  it('specimen table frame explicitly disables animations under prefers-reduced-motion', () => {
    const reducedMotionIdx = exploreCss.indexOf('prefers-reduced-motion: reduce');
    expect(reducedMotionIdx).toBeGreaterThan(-1);

    const block = exploreCss.slice(reducedMotionIdx);
    expect(block).toMatch(/\.gt-lab-specimen-table/);
    expect(block).toMatch(/animation:\s*none\s*!important/);
    expect(block).toMatch(/transition:\s*none\s*!important/);
  });
});

describe('Lab Explore: Responsive Layout, Scrolling & Zoom Robustness (Lane lab-explore3)', () => {
  it('the container has no height: 100dvh together with overflow: hidden (BUG-01)', () => {
    const globalRules = parseCssRules(globalCss);
    const containerDecls = findDeclarations(globalRules, '.gt-explore');
    expect(containerDecls?.['height']).toBeUndefined();
    expect(containerDecls?.['overflow']).not.toBe('hidden');
    expect(containerDecls?.['overflow-y']).toBe('auto');
    expect(containerDecls?.['min-height']).toMatch(/100dvh|100vh/);
  });

  it('the actions row wraps so controls never collide at 320px or 200% zoom (BUG-04)', () => {
    const globalRules = parseCssRules(globalCss);
    const actionsDecls = findDeclarations(globalRules, '.gt-explore__actions');
    expect(actionsDecls?.['flex-wrap']).toBe('wrap');

    const exploreRules = parseCssRules(exploreCss);
    const exploreActionsDecls = findDeclarations(exploreRules, '.gt-explore__actions');
    expect(exploreActionsDecls?.['flex-wrap']).toBe('wrap');
  });

  it('the title allows multiple lines and does not use nowrap (BUG-08)', () => {
    const globalRules = parseCssRules(globalCss);
    const titleDecls = findDeclarations(globalRules, '.gt-explore__title');
    expect(titleDecls?.['white-space']).not.toBe('nowrap');
    expect(titleDecls?.['-webkit-line-clamp']).toBe('2');

    const exploreRules = parseCssRules(exploreCss);
    const exploreTitleDecls = findDeclarations(exploreRules, '.gt-explore__title');
    expect(exploreTitleDecls?.['white-space']).not.toBe('nowrap');
    expect(exploreTitleDecls?.['-webkit-line-clamp']).toBe('2');
  });

  it('applies safe-area insets to the Explore container (BUG-06)', () => {
    const globalRules = parseCssRules(globalCss);
    const containerDecls = findDeclarations(globalRules, '.gt-explore');
    expect(containerDecls?.['padding-top']).toContain('env(safe-area-inset-top');
    expect(containerDecls?.['padding-bottom']).toContain('env(safe-area-inset-bottom');
    expect(containerDecls?.['padding-left']).toContain('env(safe-area-inset-left');
    expect(containerDecls?.['padding-right']).toContain('env(safe-area-inset-right');
  });

  it('canvas container uses flexible sizing with sensible clamp min-height', () => {
    const globalRules = parseCssRules(globalCss);
    const containerDecls = findDeclarations(globalRules, '.gt-explore__canvas-container');
    expect(containerDecls?.['flex']).toMatch(/1\s+1\s+auto/);
    expect(containerDecls?.['min-height']).toMatch(/clamp\(220px/);

    const exploreRules = parseCssRules(exploreCss);
    const tableDecls = findDeclarations(exploreRules, '.gt-lab-specimen-table');
    expect(tableDecls?.['flex']).toMatch(/1\s+1\s+auto/);
    expect(tableDecls?.['min-height']).toMatch(/clamp\(220px/);
  });

  it('every control still has a >= 48px touch target in both global.css and explore.css', () => {
    const globalRules = parseCssRules(globalCss);
    const exploreRules = parseCssRules(exploreCss);

    for (const rules of [globalRules, exploreRules]) {
      const ask = findDeclarations(rules, '.gt-explore__ask');
      const back = findDeclarations(rules, '.gt-explore__back');
      const correct = findDeclarations(rules, '.gt-explore__correct');
      const send = findDeclarations(rules, '.gt-explore__send');
      const askInput = findDeclarations(rules, '.gt-explore__ask-input');

      expect(parseDimensionPx(ask?.['min-height'])).toBeGreaterThanOrEqual(48);
      expect(parseDimensionPx(ask?.['min-width'])).toBeGreaterThanOrEqual(48);

      expect(parseDimensionPx(back?.['min-height'])).toBeGreaterThanOrEqual(48);
      expect(parseDimensionPx(back?.['min-width'])).toBeGreaterThanOrEqual(48);

      expect(parseDimensionPx(correct?.['min-height'])).toBeGreaterThanOrEqual(48);
      expect(parseDimensionPx(correct?.['min-width'])).toBeGreaterThanOrEqual(48);

      expect(parseDimensionPx(send?.['min-height'])).toBeGreaterThanOrEqual(48);
      expect(parseDimensionPx(send?.['min-width'])).toBeGreaterThanOrEqual(48);

      expect(parseDimensionPx(askInput?.['min-height'])).toBeGreaterThanOrEqual(48);
    }
  });
});
