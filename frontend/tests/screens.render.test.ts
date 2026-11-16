// @ts-expect-error Node.js runtime fs module
import fs from 'node:fs';
// @ts-expect-error Node.js runtime path module
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { Capture } from '../src/screens/Capture';
import { Explore } from '../src/screens/Explore';
import { SavedDiagrams } from '../src/screens/SavedDiagrams';
import { Start } from '../src/screens/Start';
import css from '../src/styles/global.css?raw';
import exploreCss from '../src/styles/explore.css?raw';

declare const __dirname: string | undefined;

function readStyleFile(fileName: string): string {
  try {
    if (typeof __dirname !== 'undefined') {
      const p = path.resolve(__dirname, '../src/styles', fileName);
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
    }
    const frontendPath = path.resolve('frontend/src/styles', fileName);
    if (fs.existsSync(frontendPath)) return fs.readFileSync(frontendPath, 'utf-8');
    const srcPath = path.resolve('src/styles', fileName);
    if (fs.existsSync(srcPath)) return fs.readFileSync(srcPath, 'utf-8');
  } catch {
    // fallback
  }
  return '';
}

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

function parseLengthToPx(rawVal: string | undefined, allCss: string): number | null {
  if (!rawVal) return null;
  const val = rawVal.trim();

  // px: e.g. "52px", "48px"
  const pxMatch = /^([\d.]+)px$/i.exec(val);
  if (pxMatch && pxMatch[1]) {
    const n = parseFloat(pxMatch[1]);
    return Number.isFinite(n) ? n : null;
  }

  // rem: e.g. "3rem", "3.25rem" (1 rem = 16 px)
  const remMatch = /^([\d.]+)rem$/i.exec(val);
  if (remMatch && remMatch[1]) {
    const n = parseFloat(remMatch[1]);
    return Number.isFinite(n) ? n * 16 : null;
  }

  // var with fallback: e.g. "var(--gt-target, 48px)" or "var(--gt-target, 3rem)"
  const varWithFallback = /^var\([^,]+,\s*([^)]+)\)$/i.exec(val);
  if (varWithFallback && varWithFallback[1]) {
    const fallbackParsed = parseLengthToPx(varWithFallback[1], allCss);
    if (fallbackParsed !== null) return fallbackParsed;
  }

  // var without fallback: e.g. "var(--gt-target)"
  const varNoFallback = /^var\((--[\w-]+)\)$/i.exec(val);
  if (varNoFallback && varNoFallback[1]) {
    const varName = varNoFallback[1];
    const defRegex = new RegExp(`${varName}\\s*:\\s*([^;]+);`, 'i');
    const defMatch = defRegex.exec(allCss);
    if (defMatch && defMatch[1]) {
      return parseLengthToPx(defMatch[1], allCss);
    }
  }

  return null;
}

function findEffectiveDimension(
  rules: ParsedRule[],
  prop: 'min-height' | 'min-width',
  allCss: string,
): number | null {
  const candidateSelectors = [
    '.gt-explore__where-am-i',
    '.gt-explore__actions button',
    '.gt-explore__actions .gt-control',
    '.gt-explore__actions .gt-btn',
    '.gt-control',
    '.gt-btn',
  ];

  for (const selector of candidateSelectors) {
    const rule = rules.find((r) => r.selectors.some((s) => s === selector || s.includes(selector)));
    if (rule && rule.declarations[prop]) {
      const px = parseLengthToPx(rule.declarations[prop], allCss);
      if (px !== null && !Number.isNaN(px)) {
        return px;
      }
    }
  }

  return null;
}

const drivers: Drivers = {
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
  diagramStore: new MemoryDiagramStore(),
};

describe('screen markup (server render)', () => {
  it('Start is one full-screen button named by the intro line', () => {
    const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));
    expect(html).toContain('class="gt-start-surface"');
    expect(html).toContain('aria-label="Ghost Touch. Tap anywhere to begin."');
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it('Capture has every control, a live status, and the rear-camera input', () => {
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );
    for (const label of [
      'Take photo',
      'Choose image',
      'Saved diagrams',
      'Sample: triangle',
      'Sample: sine graph',
      'Sample: bar chart',
    ]) {
      expect(html).toContain(label);
    }
    // The app speaks the status itself: no live region (that is what makes a screen
    // reader read it twice), and the text stays readable so a missed message can be re-read.
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('role="status"');
    expect(html).not.toMatch(/<button[^>]*aria-hidden="true"/);
    expect(html).toContain('Take a photo.');
    expect(html).toContain('capture="environment"');
    expect(html).toContain('accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"');
  });

  it('Capture turns the status into a live region only when the app cannot speak', () => {
    const silent: Drivers = { ...drivers, speech: { ...drivers.speech, canSpeak: false } };
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers: silent,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('Explore markup has the canvas with aria-label, a Back button outside it, and the status text', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: { kind: 'geometry', title: 'Triangle' },
        announced:
          'Triangle. Double-tap and hold, then drag to feel the diagram. Press Back to leave.',
        drivers,
        onBack: vi.fn(),
      }),
    );
    expect(html).toContain('<canvas');
    expect(html).toContain('role="img"');
    expect(
      html,
    ).toContain(
      'aria-label="Triangle. Double-tap and hold, then drag to feel the diagram."',
    );
    expect(html).toContain('Back');
    expect(html).toContain('gt-explore__back');
    expect(html).toContain('Where am I');
    expect(html).toContain('gt-explore__where-am-i');
    expect(html).toContain('Ask');
    expect(html).toContain('gt-explore__ask');
    // When drivers can speak, StatusText contains no aria-live
    expect(html).not.toContain('aria-live');
  });

  it('Explore renders text fallback box and Send button when speech recognition is unavailable', () => {
    const noListen: Drivers = { ...drivers, speech: { ...drivers.speech, canListen: false } };
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: { kind: 'geometry', title: 'Triangle' },
        announced: 'Triangle announcement',
        drivers: noListen,
        onBack: vi.fn(),
      }),
    );
    expect(html).toContain('gt-explore__ask-form');
    expect(html).toContain('gt-explore__ask-input');
    expect(html).toContain('Send');
    expect(html).toContain('gt-explore__send');
  });

  it('Explore turns status text into polite live region when drivers cannot speak', () => {
    const silent: Drivers = { ...drivers, speech: { ...drivers.speech, canSpeak: false } };
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: { kind: 'geometry', title: 'Triangle' },
        announced: 'Triangle announcement',
        drivers: silent,
        onBack: vi.fn(),
      }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('SavedDiagrams markup renders heading, back button, and status text', () => {
    const html = renderToStaticMarkup(
      createElement(SavedDiagrams, {
        diagramStore: drivers.diagramStore,
        speech: drivers.speech,
        onOpen: vi.fn(),
        onBack: vi.fn(),
      }),
    );
    expect(html).toContain('gt-saved');
    expect(html).toContain('Saved diagrams');
    expect(html).toContain('Back to Capture');
    expect(html).toContain('gt-saved__back');
  });

  it('App opens on the Start screen', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('gt-start-surface');
  });
});

describe('touch targets (Requirement 12.1)', () => {
  it('defines a 48px minimum target used by every control', () => {
    expect(css).toMatch(/--gt-target:\s*48px/);
    expect(css).toMatch(/\.gt-control\s*{[^}]*min-height:\s*var\(--gt-target\)/s);
    expect(css).toMatch(/\.gt-control\s*{[^}]*min-width:\s*var\(--gt-target\)/s);
  });

  it('makes the Capture buttons at least 48px tall', () => {
    const match = /\.gt-capture__button\s*{[^}]*min-height:\s*(\d+)px/s.exec(css);
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(48);
  });

  it('makes the Explore back button at least 48px tall', () => {
    const match = /\.gt-explore__back\s*{[^}]*min-height:\s*(\d+)px/s.exec(css);
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(48);
  });

  it('makes the Explore ask and send buttons at least 48px tall', () => {
    const matchAsk = /\.gt-explore__ask\s*{[^}]*min-height:\s*(\d+)px/s.exec(css);
    expect(Number(matchAsk?.[1])).toBeGreaterThanOrEqual(48);

    const matchSend = /\.gt-explore__send\s*{[^}]*min-height:\s*(\d+)px/s.exec(css);
    expect(Number(matchSend?.[1])).toBeGreaterThanOrEqual(48);
  });

  it('makes the Explore where-am-i button at least 48px tall and wide', () => {
    const fileExploreCss = readStyleFile('explore.css');
    const sourceCss = fileExploreCss || (typeof exploreCss === 'string' ? exploreCss : '');
    const combined = `${sourceCss}\n${css}`;
    const parsedRules = [...parseCssRules(sourceCss), ...parseCssRules(css)];

    const minHeight = findEffectiveDimension(parsedRules, 'min-height', combined);
    const minWidth = findEffectiveDimension(parsedRules, 'min-width', combined);

    expect(minHeight).not.toBeNull();
    expect(typeof minHeight).toBe('number');
    expect(Number.isNaN(minHeight)).toBe(false);
    expect(minHeight!).toBeGreaterThanOrEqual(48);

    expect(minWidth).not.toBeNull();
    expect(typeof minWidth).toBe('number');
    expect(Number.isNaN(minWidth)).toBe(false);
    expect(minWidth!).toBeGreaterThanOrEqual(48);
  });
});
