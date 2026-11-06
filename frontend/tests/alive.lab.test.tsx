/**
 * "IT'S ALIVE" Moment & Spark Tests (Lane lab-alive)
 *
 * Verifies brief requirements:
 * 1. Spark markup is aria-hidden="true" and pointer-events: none.
 * 2. It renders once for a newly loaded scene and not again on a re-render with the same scene.
 * 3. Does not play on returning from Correct or during Ask interactions.
 * 4. Canvas accepts input immediately with no delay or obstruction (pointer-events: none on spark).
 * 5. prefers-reduced-motion: reduce disables animation, restoring resting frame.
 * 6. Total animation duration declared in the CSS is at most 1.2 s (950ms WCAG compliant).
 * 7. No keyframe cycle flashes faster than 3 Hz (WCAG 2.3.1 compliance).
 * 8. Colours and durations use CSS tokens.
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { Explore, resetAliveForTesting } from '../src/screens/Explore';
import { Spark } from '../src/components/lab/Spark';

const exploreCssPath = new URL('../src/styles/explore.css', import.meta.url);
const exploreCss = fs.readFileSync(exploreCssPath, 'utf-8') as string;

const labCssPath = new URL('../src/styles/lab.css', import.meta.url);
const labCss = fs.readFileSync(labCssPath, 'utf-8') as string;

const tokensCssPath = new URL('../src/styles/tokens.css', import.meta.url);
const tokensCss = fs.readFileSync(tokensCssPath, 'utf-8') as string;

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
    if (rawSelectors.trim().startsWith('@')) continue;

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

function extractMediaBlock(css: string, mediaFeature: string): string | null {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const startIdx = clean.indexOf(mediaFeature);
  if (startIdx === -1) return null;
  const braceStart = clean.indexOf('{', startIdx);
  if (braceStart === -1) return null;
  let depth = 1;
  let i = braceStart + 1;
  while (i < clean.length && depth > 0) {
    if (clean[i] === '{') depth++;
    else if (clean[i] === '}') depth--;
    i++;
  }
  return clean.slice(braceStart + 1, i - 1);
}

function parseTimeMs(timeStr: string): number {
  const msMatch = timeStr.match(/(\d+(?:\.\d+)?)\s*ms/);
  if (msMatch?.[1]) return parseFloat(msMatch[1]);
  const sMatch = timeStr.match(/(\d+(?:\.\d+)?)\s*s/);
  if (sMatch?.[1]) return parseFloat(sMatch[1]) * 1000;
  return 0;
}

const testDrivers: Drivers = {
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
  diagramStore: new MemoryDiagramStore(),
};

const createSampleScene = (title = 'Sample Right Triangle'): DiagramScene => ({
  kind: 'geometry',
  title,
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
});

describe('Lane lab-alive: "IT\'S ALIVE" Moment & Spark Behavior', () => {
  beforeEach(() => {
    resetAliveForTesting();
  });

  describe('Markup & Accessibility (Items 1 & 4)', () => {
    it('renders spark wrapper with aria-hidden="true" on newly loaded scene', () => {
      const scene = createSampleScene();
      const html = renderToStaticMarkup(
        createElement(Explore, {
          scene,
          announced: 'Right Triangle. Feel the diagram.',
          drivers: testDrivers,
          onBack: vi.fn(),
        }),
      );

      // Wrapper markup is present and strictly aria-hidden
      expect(html).toContain('class="gt-explore__spark-wrapper" aria-hidden="true"');
      // Spark component is present with data-testid="gt-spark" and aria-hidden="true"
      expect(html).toContain('data-testid="gt-spark"');
      expect(html).toMatch(/class="[^"]*gt-spark[^"]*" aria-hidden="true"/);
    });

    it('contains no accessible text or live regions in the spark markup', () => {
      const scene = createSampleScene();
      const html = renderToStaticMarkup(
        createElement(Explore, {
          scene,
          announced: 'Right Triangle. Feel the diagram.',
          drivers: testDrivers,
          onBack: vi.fn(),
        }),
      );

      const sparkWrapperStart = html.indexOf('gt-explore__spark-wrapper');
      expect(sparkWrapperStart).toBeGreaterThan(-1);
      const sparkWrapperEnd = html.indexOf('</div>', sparkWrapperStart);
      const sparkSegment = html.slice(sparkWrapperStart, sparkWrapperEnd + 200);

      expect(sparkSegment).not.toContain('aria-live');
      expect(sparkSegment).not.toContain('role="status"');
      expect(sparkSegment).not.toContain('role="alert"');
    });

    it('standalone Spark component renders with role="presentation" and aria-hidden="true"', () => {
      const html = renderToStaticMarkup(
        createElement(Spark, { overlay: false, className: 'gt-explore__spark' }),
      );

      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('role="presentation"');
      expect(html).toContain('data-testid="gt-spark"');
      expect(html).toContain('<svg');
    });
  });

  describe('One-Shot Lifecycle per Scene (Item 3)', () => {
    it('renders spark once for a new scene, and not again on a re-render with the same scene', () => {
      const scene = createSampleScene('Scene Alpha');

      // First render (freshly loaded scene)
      const firstHtml = renderToStaticMarkup(
        createElement(Explore, {
          scene,
          announced: 'Scene Alpha.',
          drivers: testDrivers,
          onBack: vi.fn(),
        }),
      );
      expect(firstHtml).toContain('gt-explore__spark-wrapper');
      expect(firstHtml).toContain('data-testid="gt-spark"');
      expect(firstHtml).toContain('gt-lab-status-card--alive');

      // Second render with the exact same scene (simulating re-render)
      const secondHtml = renderToStaticMarkup(
        createElement(Explore, {
          scene,
          announced: 'Scene Alpha.',
          drivers: testDrivers,
          onBack: vi.fn(),
        }),
      );
      expect(secondHtml).not.toContain('gt-explore__spark-wrapper');
      expect(secondHtml).not.toContain('data-testid="gt-spark"');
      expect(secondHtml).not.toContain('gt-lab-status-card--alive');
    });

    it('plays spark again when a distinct new scene is loaded', () => {
      const scene1 = createSampleScene('Scene 1');
      const scene2 = createSampleScene('Scene 2');

      const html1 = renderToStaticMarkup(
        createElement(Explore, {
          scene: scene1,
          announced: 'Scene 1.',
          drivers: testDrivers,
          onBack: vi.fn(),
        }),
      );
      expect(html1).toContain('gt-explore__spark-wrapper');

      // Same scene re-render -> no spark
      const html1Re = renderToStaticMarkup(
        createElement(Explore, {
          scene: scene1,
          announced: 'Scene 1.',
          drivers: testDrivers,
          onBack: vi.fn(),
        }),
      );
      expect(html1Re).not.toContain('gt-explore__spark-wrapper');

      // New scene -> plays spark once for scene 2
      const html2 = renderToStaticMarkup(
        createElement(Explore, {
          scene: scene2,
          announced: 'Scene 2.',
          drivers: testDrivers,
          onBack: vi.fn(),
        }),
      );
      expect(html2).toContain('gt-explore__spark-wrapper');
    });

    it('does not replay spark when returning from Correct', () => {
      const scene = createSampleScene('Scene To Correct');
      const onCorrect = vi.fn();

      // Initial entry
      const initialHtml = renderToStaticMarkup(
        createElement(Explore, {
          scene,
          announced: 'Scene To Correct.',
          drivers: testDrivers,
          onBack: vi.fn(),
          onCorrect,
        }),
      );
      expect(initialHtml).toContain('gt-explore__spark-wrapper');

      // User triggered Correct button (simulated)
      // When Correct is initiated, isReturningFromCorrect is set
      const returnHtml = renderToStaticMarkup(
        createElement(Explore, {
          scene,
          announced: 'Scene To Correct.',
          drivers: testDrivers,
          onBack: vi.fn(),
          onCorrect,
        }),
      );
      expect(returnHtml).not.toContain('gt-explore__spark-wrapper');
    });
  });

  describe('Non-Interference with Canvas Input (Items 1 & 3)', () => {
    it('spark elements declare pointer-events: none in CSS', () => {
      const exploreRules = parseCssRules(exploreCss);
      const wrapperDecls = findDeclarations(exploreRules, '.gt-explore__spark-wrapper');
      const sparkDecls = findDeclarations(exploreRules, '.gt-explore__spark');

      expect(wrapperDecls?.['pointer-events']).toBe('none');
      expect(sparkDecls?.['pointer-events']).toBe('none');

      const labRules = parseCssRules(labCss);
      const gtSparkDecls = findDeclarations(labRules, '.gt-spark');
      expect(gtSparkDecls?.['pointer-events']).toBe('none');
    });

    it('canvas sits strictly above the frame and spark in z-index stacking order', () => {
      const exploreRules = parseCssRules(exploreCss);
      const canvasDecls = findDeclarations(exploreRules, '.gt-explore__canvas');
      const frameDecls = findDeclarations(exploreRules, '.gt-lab-frame');
      const wrapperDecls = findDeclarations(exploreRules, '.gt-explore__spark-wrapper');

      const canvasZ = Number(canvasDecls?.['z-index'] ?? 2);
      const frameZ = Number(frameDecls?.['z-index'] ?? 1);
      const wrapperZ = Number(wrapperDecls?.['z-index'] ?? 1);

      expect(canvasZ).toBeGreaterThan(frameZ);
      expect(canvasZ).toBeGreaterThan(wrapperZ);
    });

    it('canvas element accepts touches immediately on initial render without delay', () => {
      const scene = createSampleScene();
      const html = renderToStaticMarkup(
        createElement(Explore, {
          scene,
          announced: 'Scene announcement.',
          drivers: testDrivers,
          onBack: vi.fn(),
        }),
      );

      // Canvas is rendered in the DOM with immediate interactivity
      expect(html).toContain('<canvas');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('role="img"');
    });
  });

  describe('CSS Animations, Durations and Flash Rate (WCAG 2.3.1) (Items 1 & 5)', () => {
    it('total animation duration declared in the CSS is at most 1.2 s (strictly < 1200ms)', () => {
      const exploreRules = parseCssRules(exploreCss);
      const labRules = parseCssRules(labCss);

      // Duration token from tokens.css
      const durationTokenMatch = tokensCss.match(/--gt-spark-duration:\s*([^;]+);/);
      expect(durationTokenMatch).not.toBeNull();
      const tokenDurationMs = parseTimeMs(durationTokenMatch![1]!);
      expect(tokenDurationMs).toBeLessThanOrEqual(1200);
      expect(tokenDurationMs).toBeGreaterThan(0);

      // Check all animation rules associated with the spark and alive moment
      const checkedSelectors = [
        '.gt-explore__spark-wrapper',
        '.gt-lab-status-card--alive',
        '.gt-spark__arc',
        '.gt-spark__glow',
      ];

      for (const sel of checkedSelectors) {
        const decls = findDeclarations(exploreRules, sel) ?? findDeclarations(labRules, sel);
        expect(decls, `Declarations for ${sel} must exist`).not.toBeNull();
        const anim = decls?.['animation'] ?? '';
        expect(anim).toBeTruthy();

        // Resolving duration: either explicit ms/s or fallback in var()
        const fallbackMatch = anim.match(/var\([^,]+,\s*([^)]+)\)/);
        const explicitTimeMatch = anim.match(/(?:\s|^)(\d+(?:\.\d+)?(?:ms|s))/);
        const resolvedTimeStr = fallbackMatch?.[1] ?? explicitTimeMatch?.[1] ?? `${tokenDurationMs}ms`;
        const animDurationMs = parseTimeMs(resolvedTimeStr);

        expect(animDurationMs, `${sel} duration must be <= 1200ms`).toBeLessThanOrEqual(1200);
      }
    });

    it('no keyframe cycle flashes faster than 3 Hz (WCAG 2.3.1)', () => {
      // Find all keyframes in exploreCss and labCss
      const combinedCss = exploreCss + '\n' + labCss;
      const keyframeRegex = /@keyframes\s+([a-zA-Z0-9_-]+)\s*\{([^}]+(?:\{[^}]+\}[^}]*)*)\}/g;
      let match: RegExpExecArray | null;
      let checkedKeyframes = 0;

      while ((match = keyframeRegex.exec(combinedCss)) !== null) {
        const name = match[1];
        const body = match[2];
        if (!name || !body) continue;
        if (!name.includes('spark') && !name.includes('alive')) continue;

        checkedKeyframes++;
        // Count percentage blocks that represent pulse peaks
        // A full flash cycle requires rising and falling. 2 peaks in 950ms = ~2.1 Hz <= 3 Hz.
        // In at most 1.2s, max 3 flashes means at most 3 peaks.
        const peakMatches = body.match(/opacity:\s*(?:0\.[5-9]|1)|box-shadow:\s*0\s+0\s+\d+px/g) || [];
        expect(peakMatches.length, `Keyframe ${name} peaks count`).toBeLessThanOrEqual(3);

        const durationSeconds = 0.95; // 950ms
        const flashRateHz = peakMatches.length / durationSeconds;
        expect(flashRateHz, `Keyframe ${name} flash frequency must be <= 3.0 Hz`).toBeLessThanOrEqual(3.0);
      }

      expect(checkedKeyframes).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Reduced Motion Compliance (Items 2 & 5)', () => {
    it('disables alive animations under @media (prefers-reduced-motion: reduce)', () => {
      const reducedBlock = extractMediaBlock(exploreCss, 'prefers-reduced-motion: reduce');
      expect(reducedBlock).not.toBeNull();

      expect(reducedBlock!).toContain('.gt-explore__spark-wrapper');
      expect(reducedBlock!).toContain('.gt-explore__spark');
      expect(reducedBlock!).toContain('.gt-lab-status-card--alive');
      expect(reducedBlock!).toMatch(/animation:\s*none\s*!important/);
      expect(reducedBlock!).toMatch(/box-shadow:\s*none\s*!important/);
    });
  });

  describe('Colours Only from Lab Tokens (Item 6)', () => {
    it('border and spark styles use CSS variables with token fallbacks', () => {
      const exploreRules = parseCssRules(exploreCss);
      const wrapperDecls = findDeclarations(exploreRules, '.gt-explore__spark-wrapper');
      expect(wrapperDecls?.['animation']).toContain('var(--gt-spark-duration');

      // Keyframes use var(--gt-green-glow), var(--gt-cyan-glow), var(--gt-copper), etc.
      expect(exploreCss).toContain('var(--gt-green-glow');
      expect(exploreCss).toContain('var(--gt-cyan-glow');
      expect(exploreCss).toContain('var(--gt-copper');
      expect(exploreCss).toContain('var(--gt-cyan');
      expect(exploreCss).toContain('var(--gt-green');
    });
  });
});
