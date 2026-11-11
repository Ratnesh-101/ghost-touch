// @vitest-environment jsdom
/**
 * Issue B — TalkBack exploration of shapes, graphs and bar charts.
 *
 * With TalkBack on, single-finger touch on the canvas is swallowed by Android, so the Explore
 * screen also exposes an accessible overlay (buttons for corners, sides, bars, curves, axes).
 * Focusing one runs the same haptic/speech/tone rules a finger on that feature would.
 */
// @ts-expect-error Node.js runtime fs module
import fs from 'node:fs';
// @ts-expect-error Node.js runtime path module
import path from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HAPTICS } from '../src/core/hapticEngine';
import { pitchForValue } from '../src/core/pitch';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import {
  buildA11yFeatures,
  Explore,
  MAX_A11Y_FEATURES,
} from '../src/screens/Explore';

declare const __dirname: string | undefined;

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

function readStyleFile(fileName: string): string {
  if (typeof __dirname !== 'undefined') {
    const p = path.resolve(__dirname, '../src/styles', fileName);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  }
  const frontendPath = path.resolve('frontend/src/styles', fileName);
  if (fs.existsSync(frontendPath)) return fs.readFileSync(frontendPath, 'utf-8');
  const srcPath = path.resolve('src/styles', fileName);
  if (fs.existsSync(srcPath)) return fs.readFileSync(srcPath, 'utf-8');
  return fs.readFileSync(path.resolve(__dirname ?? '.', '../src/styles', fileName), 'utf-8');
}

const exploreCss = readStyleFile('explore.css');

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

const SIZE = 400;

const triangle: DiagramScene = {
  kind: 'geometry',
  title: 'Triangle ABC',
  points: [
    { id: 'A', x: 0.1, y: 0.9, label: 'A' },
    { id: 'B', x: 0.9, y: 0.9, label: 'B' },
    { id: 'C', x: 0.1, y: 0.1, label: 'C' },
  ],
  segments: [
    { id: 'AB', a: 'A', b: 'B', label: null },
    { id: 'BC', a: 'B', b: 'C', label: null },
    { id: 'CA', a: 'C', b: 'A', label: null },
  ],
};

const barChart: DiagramScene = {
  kind: 'bar_chart',
  title: 'Marks',
  axes: { x_axis_y: 0.9, y_axis_x: 0.1 },
  bars: [
    { id: 'b1', label: 'Maths', value: 40, x0: 0.15, x1: 0.35, y_base: 0.9, y_top: 0.5 },
    { id: 'b2', label: 'Science', value: 80, x0: 0.45, x1: 0.65, y_base: 0.9, y_top: 0.1 },
  ],
};

const graph: DiagramScene = {
  kind: 'function_graph',
  axes: { x_axis_y: 0.5, y_axis_x: 0.5 },
  polylines: [{ id: 'f', label: 'Parabola', points: [[0.1, 0.9], [0.5, 0.1], [0.9, 0.9]] }],
};

function makeDrivers() {
  const vibrate = vi.fn();
  const speak = vi.fn();
  const setTone = vi.fn();
  const drivers: Drivers = {
    haptics: { supported: true, lastResult: null, vibrate, stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone, beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
    speech: { speak, listen: vi.fn(), canSpeak: true, canListen: true, getRate: () => 'normal' },
    diagramStore: new MemoryDiagramStore(),
  };
  return { drivers, vibrate, speak, setTone };
}

let container: HTMLDivElement;
let root: Root;
let restore: () => void;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const proto = HTMLCanvasElement.prototype;
  const originalRect = proto.getBoundingClientRect;
  const originalContext = proto.getContext;
  proto.getBoundingClientRect = function rect(): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: SIZE,
      bottom: SIZE,
      width: SIZE,
      height: SIZE,
      toJSON: () => ({}),
    } as DOMRect;
  };
  proto.getContext = (() => null) as typeof proto.getContext;
  restore = () => {
    proto.getBoundingClientRect = originalRect;
    proto.getContext = originalContext;
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  restore();
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
});

function mount(scene: DiagramScene, drivers: Drivers): void {
  act(() => {
    root.render(createElement(Explore, { scene, announced: 'Ready', drivers, onBack: vi.fn() }));
  });
}

function items(kind: string): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>(`[data-a11y-kind="${kind}"]`));
}

function focusItem(el: HTMLElement): void {
  act(() => {
    el.focus();
  });
}

describe('accessible overlay structure', () => {
  it('exposes all 3 triangle corners and 3 sides with names', () => {
    const { drivers } = makeDrivers();
    mount(triangle, drivers);
    const corners = items('point').map((b) => b.getAttribute('aria-label'));
    expect(corners).toEqual(['Corner A', 'Corner B', 'Corner C']);
    const sides = items('segment').map((b) => b.getAttribute('aria-label'));
    expect(sides).toEqual(['Side AB', 'Side BC', 'Side CA']);
  });

  it('exposes every bar with its category and value, plus both axes', () => {
    const { drivers } = makeDrivers();
    mount(barChart, drivers);
    expect(items('bar').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Maths, value 40',
      'Science, value 80',
    ]);
    expect(items('axis')).toHaveLength(2);
  });

  it('exposes a labelled curve for a graph', () => {
    const { drivers } = makeDrivers();
    mount(graph, drivers);
    expect(items('polyline').map((b) => b.getAttribute('aria-label'))).toEqual(['Curve Parabola']);
  });

  it('is a labelled group and every item is a real button', () => {
    const { drivers } = makeDrivers();
    mount(triangle, drivers);
    const tree = container.querySelector('[data-testid="explore-a11y-tree"]');
    expect(tree?.getAttribute('role')).toBe('group');
    expect(tree?.getAttribute('aria-label')).toBeTruthy();
    for (const b of container.querySelectorAll('.gt-explore__a11y-item')) {
      expect(b.tagName).toBe('BUTTON');
    }
  });

  it('buildA11yFeatures skips segments with missing endpoints', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [{ id: 'A', x: 0.1, y: 0.1, label: 'A' }],
      segments: [{ id: 'AZ', a: 'A', b: 'Z', label: null }],
    };
    expect(buildA11yFeatures(scene).map((f) => f.kind)).toEqual(['point']);
  });

  it('caps features so complex scenes cannot make an enormous tree', () => {
    const busyScene: DiagramScene = {
      kind: 'geometry',
      points: Array.from({ length: 80 }, (_, i) => ({
        id: `p${i}`,
        x: i / 100,
        y: i / 100,
        label: `P${i}`,
      })),
    };
    expect(MAX_A11Y_FEATURES).toBe(60);
    const featuresDefault = buildA11yFeatures(busyScene);
    expect(featuresDefault).toHaveLength(60);

    const featuresCapped = buildA11yFeatures(busyScene, 10);
    expect(featuresCapped).toHaveLength(10);
  });
});

describe('focus triggers feedback through the drivers', () => {
  it('focusing a corner pulses the corner pattern and speaks its label', () => {
    const { drivers, vibrate, speak } = makeDrivers();
    mount(triangle, drivers);
    const cornerB = items('point')[1];
    expect(cornerB).toBeDefined();
    focusItem(cornerB as HTMLElement);
    expect(vibrate).toHaveBeenCalledWith(DEFAULT_HAPTICS.cornerPattern);
    expect(speak).toHaveBeenCalledWith('B', expect.any(String));
  });

  it('focusing a side buzzes the line pattern', () => {
    const { drivers, vibrate } = makeDrivers();
    mount(triangle, drivers);
    focusItem(items('segment')[0] as HTMLElement);
    expect(vibrate).toHaveBeenCalledWith(DEFAULT_HAPTICS.lineMs);
  });

  it('focusing a bar speaks label and value and plays its pitch', () => {
    const { drivers, speak, setTone } = makeDrivers();
    mount(barChart, drivers);
    focusItem(items('bar')[1] as HTMLElement);
    expect(speak).toHaveBeenCalledWith('Science, 80', expect.any(String));
    expect(setTone).toHaveBeenCalledWith(pitchForValue(80, 80));
  });

  it('focusing a curve plays a theremin tone', () => {
    const { drivers, setTone } = makeDrivers();
    mount(graph, drivers);
    focusItem(items('polyline')[0] as HTMLElement);
    expect(setTone.mock.calls.some(([hz]) => typeof hz === 'number')).toBe(true);
  });

  it('blurring silences vibration and tone', () => {
    const { drivers, vibrate, setTone } = makeDrivers();
    mount(graph, drivers);
    const curve = items('polyline')[0] as HTMLElement;
    focusItem(curve);
    vibrate.mockClear();
    setTone.mockClear();
    act(() => {
      curve.blur();
    });
    expect(vibrate).toHaveBeenCalledWith(0);
    expect(setTone).toHaveBeenLastCalledWith(null);
  });

  it('activating an item announces its details', () => {
    const { drivers, speak } = makeDrivers();
    mount(barChart, drivers);
    act(() => {
      (items('bar')[0] as HTMLElement).click();
    });
    expect(speak).toHaveBeenCalledWith('Maths, value 40', expect.any(String));
  });
});

describe('direct canvas touch still works', () => {
  it('overlay never intercepts pointers (CSS) and the canvas keeps its handlers', () => {
    const treeCss = /\.gt-explore__a11y-tree\s*\{([^}]*)\}/.exec(exploreCss)?.[1] ?? '';
    const item = /\.gt-explore__a11y-item\s*\{([^}]*)\}/.exec(exploreCss)?.[1] ?? '';
    expect(treeCss).toMatch(/pointer-events:\s*none/);
    expect(item).toMatch(/pointer-events:\s*none/);

    const rules = parseCssRules(exploreCss);
    const treeRule = findRule(rules, '.gt-explore__a11y-tree');
    expect(treeRule?.declarations['pointer-events']).toBe('none');
    const itemRule = findRule(rules, '.gt-explore__a11y-item');
    expect(itemRule?.declarations['pointer-events']).toBe('none');

    const { drivers } = makeDrivers();
    mount(triangle, drivers);
    const tree = container.querySelector('.gt-explore__a11y-tree');
    expect(tree).not.toBeNull();
    expect(container.querySelector('canvas.gt-explore__canvas')).not.toBeNull();
  });

  it('a pointer on a corner of the canvas still triggers the corner pulse', () => {
    const { drivers, vibrate, speak } = makeDrivers();
    mount(triangle, drivers);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    const Ctor = (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
    act(() => {
      canvas.dispatchEvent(
        new Ctor('pointerdown', { bubbles: true, clientX: 0.1 * SIZE, clientY: 0.9 * SIZE }),
      );
    });
    expect(vibrate).toHaveBeenCalledWith(DEFAULT_HAPTICS.cornerPattern);
    expect(speak).toHaveBeenCalledWith('A', expect.any(String));
  });

  it('overlay is position: absolute and adds no element to normal flow of canvas container', () => {
    const treeCss = /\.gt-explore__a11y-tree\s*\{([^}]*)\}/.exec(exploreCss)?.[1] ?? '';
    expect(treeCss).toMatch(/position:\s*absolute/);
    expect(treeCss).toMatch(/inset:\s*0/);

    const rules = parseCssRules(exploreCss);
    const treeRule = findRule(rules, '.gt-explore__a11y-tree');
    expect(treeRule?.declarations['position']).toBe('absolute');
    expect(treeRule?.declarations['inset']).toBe('0');

    const { drivers } = makeDrivers();
    mount(triangle, drivers);
    const tree = container.querySelector('.gt-explore__a11y-tree') as HTMLElement;
    expect(tree).not.toBeNull();
    expect(tree.parentElement?.classList.contains('gt-explore__canvas-container')).toBe(true);
  });
});
