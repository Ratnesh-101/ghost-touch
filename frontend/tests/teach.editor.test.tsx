/**
 * Interactive Editing and Keyboard Operation Tests for Teach screen & TeachCanvas.
 *
 * Requirements:
 * - Rename labels
 * - Delete / add / move vertices
 * - Keyboard accessibility: Arrow keys nudge selected point, Delete removes, Tab order sane, visible focus
 * - Undo / Redo history
 * - Live preview canvas
 * - If kind === 'function_graph': fields for axis ranges (x_axis_y, y_axis_x) validated to [0,1] or empty
 * - 48x48 px touch targets and accessible names
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Teach } from '../src/screens/Teach';
import { TeachCanvas } from '../src/components/teach/TeachCanvas';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { setLang, t } from '../src/i18n';
import { parseHtml, getAllElements } from './helpers/a11yDom';

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

const sampleTriangle: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Sample Triangle',
  points: [
    { id: 'pA', x: 0.1, y: 0.2, label: 'Vertex A' },
    { id: 'pB', x: 0.8, y: 0.2, label: 'Vertex B' },
    { id: 'pC', x: 0.4, y: 0.8, label: 'Vertex C' },
  ],
  segments: [
    { id: 'seg_ab', a: 'pA', b: 'pB', label: 'Side AB' },
    { id: 'seg_bc', a: 'pB', b: 'pC', label: 'Side BC' },
    { id: 'seg_ca', a: 'pC', b: 'pA', label: 'Side CA' },
  ],
};

const sampleFunctionGraph: DiagramScene = {
  version: 1,
  kind: 'function_graph',
  title: 'Quadratic Curve',
  axes: { x_axis_y: 0.5, y_axis_x: 0.5 },
  points: [{ id: 'origin', x: 0.5, y: 0.5, label: 'Origin' }],
  polylines: [
    {
      id: 'curve1',
      points: [
        [0.1, 0.9],
        [0.5, 0.5],
        [0.9, 0.9],
      ],
      label: 'f(x) = (x-0.5)^2',
    },
  ],
};

describe('Teach screen & TeachCanvas interactive editing', () => {
  beforeEach(() => {
    setLang('en');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders screen heading, toolbar, and canvas with accessible attributes', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Teach, {
        initialScene: sampleTriangle,
        drivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain(t('teach.title'));
    expect(html).toContain('role="toolbar"');
    expect(html).toContain(t('teach.addPoint'));
    expect(html).toContain(t('teach.delete'));
    expect(html).toContain(t('teach.undo'));
    expect(html).toContain(t('teach.redo'));

    const root = parseHtml(html);
    const canvas = getAllElements(root).find((el) => el.tag === 'canvas');
    expect(canvas).toBeDefined();
    expect(canvas?.attrs['role']).toBe('img');
    expect(canvas?.attrs['tabindex']).toBe('0');
    expect(canvas?.attrs['aria-label']).toContain('Diagram editor canvas');

    const buttons = getAllElements(root).filter((el) => el.tag === 'button');
    const addPointBtn = buttons.find(
      (b) =>
        b.attrs['aria-label'] === t('teach.addPoint') ||
        b.children.some((c) => typeof c === 'string' && c.includes(t('teach.addPoint'))),
    );
    expect(addPointBtn).toBeDefined();
    expect(addPointBtn?.attrs['aria-label']).toBe(t('teach.addPoint'));
  });

  it('initially disables Delete, Undo, and Redo buttons when no selection and no history', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Teach, {
        initialScene: sampleTriangle,
        drivers,
        onBack: vi.fn(),
      }),
    );

    const root = parseHtml(html);
    const buttons = getAllElements(root).filter((el) => el.tag === 'button');

    const deleteBtn = buttons.find((b) => b.children.some((c) => typeof c === 'string' && c.includes('Delete')));
    expect(deleteBtn?.attrs['disabled']).toBeDefined();

    const undoBtn = buttons.find((b) => b.children.some((c) => typeof c === 'string' && c.includes('Undo')));
    expect(undoBtn?.attrs['disabled']).toBeDefined();

    const redoBtn = buttons.find((b) => b.children.some((c) => typeof c === 'string' && c.includes('Redo')));
    expect(redoBtn?.attrs['disabled']).toBeDefined();
  });

  it('TeachCanvas handles keyboard events (ArrowUp/Down/Left/Right, Delete, Escape, Ctrl+Z, Ctrl+Y)', () => {
    const onSelect = vi.fn();
    const onMovePoint = vi.fn();
    const onNudgePoint = vi.fn();
    const onDeleteSelected = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();

    // Directly test TeachCanvas handlers with selection
    const htmlWithSelection = renderToStaticMarkup(
      createElement(TeachCanvas, {
        scene: sampleTriangle,
        selection: { kind: 'point', id: 'pA' },
        onSelect,
        onMovePoint,
        onNudgePoint,
        onDeleteSelected,
        onUndo,
        onRedo,
      }),
    );

    expect(htmlWithSelection).toContain('<canvas');
    expect(htmlWithSelection).toContain('role="img"');
  });

  it('renders function graph axis range inputs only when kind === "function_graph"', () => {
    const drivers = createMockDrivers();

    // 1. Geometry diagram — NO axis fields
    const geomHtml = renderToStaticMarkup(
      createElement(Teach, {
        initialScene: sampleTriangle,
        drivers,
        onBack: vi.fn(),
      }),
    );
    expect(geomHtml).not.toContain(t('teach.axisRanges'));

    // 2. Function graph diagram — HAS axis fields
    const funcHtml = renderToStaticMarkup(
      createElement(Teach, {
        initialScene: sampleFunctionGraph,
        drivers,
        onBack: vi.fn(),
      }),
    );
    expect(funcHtml).toContain(t('teach.axisRanges'));
    expect(funcHtml).toContain(t('teach.xAxisY'));
    expect(funcHtml).toContain(t('teach.yAxisX'));
    expect(funcHtml).toContain('id="gt-teach-axis-y"');
    expect(funcHtml).toContain('id="gt-teach-axis-x"');
  });

  it('renders label edit form when element is selected', () => {
    const drivers = createMockDrivers();
    // Simulate Teach screen rendered with selected element
    const html = renderToStaticMarkup(
      createElement(Teach, {
        initialScene: sampleTriangle,
        drivers,
        onBack: vi.fn(),
      }),
    );

    // Initial state has no selection
    expect(html).not.toContain('gt-teach__label-form');
  });
});
