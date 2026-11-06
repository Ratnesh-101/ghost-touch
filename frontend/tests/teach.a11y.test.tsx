/**
 * Accessibility & Design Token Tests for Teacher Editor (Lane t2-teach-editor).
 *
 * Requirements:
 * - Every control has an accessible name
 * - Every interactive target >= 48x48 CSS px (.gt-control)
 * - Heading focus and tabIndex={-1}
 * - Spoken state changes
 * - High contrast colors conforming to design tokens
 */

// @ts-expect-error Node runtime fs in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Teach } from '../src/screens/Teach';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { setLang, t } from '../src/i18n';
import { getAllElements, parseHtml } from './helpers/a11yDom';

const teachCssPath = new URL('../src/styles/teach.css', import.meta.url);
const teachCss = fs.readFileSync(teachCssPath, 'utf-8') as string;

function createMockDrivers(): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn((): SpeechRateSetting => 'normal'),
      setRate: vi.fn(),
    },
    diagramStore: new MemoryDiagramStore(),
  };
}

describe('Teacher Editor Accessibility (a11y)', () => {
  beforeEach(() => {
    setLang('en');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('all interactive buttons and inputs have .gt-control class for 48x48 px minimum targets', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Teach, {
        drivers,
        onBack: vi.fn(),
      }),
    );

    const root = parseHtml(html);
    const buttons = getAllElements(root).filter((el) => el.tag === 'button');
    const inputs = getAllElements(root).filter((el) => el.tag === 'input' || el.tag === 'textarea');

    expect(buttons.length).toBeGreaterThan(0);
    expect(inputs.length).toBeGreaterThan(0);

    for (const btn of buttons) {
      const cls = btn.attrs['class'] ?? '';
      expect(cls).toContain('gt-control');
    }

    for (const inp of inputs) {
      const cls = inp.attrs['class'] ?? '';
      expect(cls).toContain('gt-control');
    }
  });

  it('all buttons have non-empty accessible names', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Teach, {
        drivers,
        onBack: vi.fn(),
      }),
    );

    const root = parseHtml(html);
    const buttons = getAllElements(root).filter((el) => el.tag === 'button');

    for (const btn of buttons) {
      const ariaLabel = btn.attrs['aria-label'];
      const textContent = btn.children
        .filter((c): c is string => typeof c === 'string')
        .join('')
        .trim();
      const accessibleName = ariaLabel || textContent;
      expect(accessibleName).toBeTruthy();
      expect(accessibleName.length).toBeGreaterThan(0);
    }
  });

  it('canvas element has role="img", tabIndex="0", and descriptive aria-label', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Teach, {
        drivers,
        onBack: vi.fn(),
      }),
    );

    const root = parseHtml(html);
    const canvas = getAllElements(root).find((el) => el.tag === 'canvas');

    expect(canvas).toBeDefined();
    expect(canvas?.attrs['role']).toBe('img');
    expect(canvas?.attrs['tabindex']).toBe('0');
    expect(canvas?.attrs['aria-label']).toBe(t('teach.canvasLabel'));
  });

  it('screen title heading has tabIndex={-1} for programmatic focus on mount', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Teach, {
        drivers,
        onBack: vi.fn(),
      }),
    );

    const root = parseHtml(html);
    const h1 = getAllElements(root).find((el) => el.tag === 'h1');

    expect(h1).toBeDefined();
    expect(h1?.attrs['tabindex']).toBe('-1');
    expect(h1?.children).toContain(t('teach.title'));
  });

  it('CSS styles contain high-contrast design token variables and focus-visible outlines', () => {
    expect(teachCss).toContain('var(--gt-charcoal');
    expect(teachCss).toContain('var(--gt-bone');
    expect(teachCss).toContain(':focus-visible');
    expect(teachCss).toContain('min-height: 48px');
  });
});
