/**
 * Touch Targets Verification Test
 *
 * Requirement 12.1: THE system SHALL give every control an accessible name
 * and a touch target of at least 48x48 CSS px.
 *
 * Scans styles/global.css for every interactive class and asserts both
 * min-width and min-height are at least 48px.
 */
import { describe, expect, it } from 'vitest';
import globalCss from '../src/styles/global.css?raw';

interface ParsedRule {
  selectors: string[];
  declarations: Record<string, string>;
}

/**
 * Strips comments and parses all CSS rules into selector lists and declaration maps.
 */
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

/**
 * Finds the declarations for a given selector class in the parsed stylesheet.
 */
function findDeclarations(rules: ParsedRule[], targetClass: string): Record<string, string> | null {
  for (const rule of rules) {
    if (rule.selectors.some((sel) => sel === targetClass || sel.startsWith(`${targetClass} `) || sel.startsWith(`${targetClass}:`))) {
      // Return the base rule (not pseudo-classes like :hover or :focus)
      if (rule.selectors.some((sel) => sel === targetClass || sel.split(/\s+/)[0] === targetClass)) {
        return rule.declarations;
      }
    }
  }
  return null;
}

/**
 * Evaluates a CSS dimension (px value or var(--gt-target)) to a number in px.
 */
function parseDimensionPx(val: string | undefined): number | null {
  if (!val) return null;
  if (val.includes('var(--gt-target)')) return 48;

  const pxMatch = val.match(/(\d+(?:\.\d+)?)\s*px/);
  const pxStr = pxMatch?.[1];
  if (pxStr) return parseFloat(pxStr);

  return null;
}

describe('touch targets (Requirement 12.1 & Task 2)', () => {
  const rules = parseCssRules(globalCss);

  const interactiveClasses = [
    { selector: '.gt-control', name: 'core control primitive' },
    { selector: '.gt-start-surface', name: 'full screen start surface' },
    { selector: '.gt-capture__button', name: 'capture action buttons' },
    { selector: '.gt-capture__sample-btn', name: 'sample diagram buttons' },
    { selector: '.gt-explore__ask', name: 'explore voice ask button' },
    { selector: '.gt-explore__back', name: 'explore back button' },
    { selector: '.gt-explore__send', name: 'explore text send button' },
    { selector: '.gt-explore__ask-input', name: 'explore question input' },
    { selector: '.gt-lang-selector__btn', name: 'language selector buttons' },
    { selector: '.gt-rate-selector__btn', name: 'speech rate selector buttons' },
  ];

  it('defines --gt-target as 48px', () => {
    expect(globalCss).toMatch(/--gt-target:\s*48px/);
  });

  for (const { selector, name } of interactiveClasses) {
    it(`${selector} (${name}) declares min-width >= 48px`, () => {
      const decls = findDeclarations(rules, selector);
      expect(decls, `Rules for ${selector} must exist`).not.toBeNull();

      const minWidthDecl = decls?.['min-width'];
      const px = parseDimensionPx(minWidthDecl);
      expect(px, `${selector} min-width parsed value`).not.toBeNull();
      expect(px!).toBeGreaterThanOrEqual(48);
    });

    it(`${selector} (${name}) declares min-height >= 48px`, () => {
      const decls = findDeclarations(rules, selector);
      expect(decls, `Rules for ${selector} must exist`).not.toBeNull();

      const minHeightDecl = decls?.['min-height'];
      const px = parseDimensionPx(minHeightDecl);
      expect(px, `${selector} min-height parsed value`).not.toBeNull();
      expect(px!).toBeGreaterThanOrEqual(48);
    });
  }
});
