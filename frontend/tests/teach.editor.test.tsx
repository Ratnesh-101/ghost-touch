// @vitest-environment jsdom
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

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Teach } from '../src/screens/Teach';
import { TeachCanvas } from '../src/components/teach/TeachCanvas';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { setLang, t } from '../src/i18n';
import { parseHtml, getAllElements } from './helpers/a11yDom';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const CANVAS_SIZE = 400;

let container: HTMLDivElement;
let testRoot: Root;
let restoreRect: () => void;
let restoreContext: () => void;

function createMockDrivers(): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'locked',
    },
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
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;

    const proto = HTMLCanvasElement.prototype;
    const originalRect = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function rect(): DOMRect {
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: CANVAS_SIZE,
        bottom: CANVAS_SIZE,
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        toJSON: () => ({}),
      } as DOMRect;
    };
    restoreRect = () => {
      proto.getBoundingClientRect = originalRect;
    };

    const originalContext = proto.getContext;
    proto.getContext = (() => null) as typeof proto.getContext;
    restoreContext = () => {
      proto.getContext = originalContext;
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    testRoot = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      testRoot.unmount();
    });
    container.remove();
    restoreRect();
    restoreContext();
    vi.restoreAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
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

    const parsedRoot = parseHtml(html);
    const canvas = getAllElements(parsedRoot).find((el) => el.tag === 'canvas');
    expect(canvas).toBeDefined();
    expect(canvas?.attrs['role']).toBe('img');
    expect(canvas?.attrs['tabindex']).toBe('0');
    expect(canvas?.attrs['aria-label']).toContain('Diagram editor canvas');

    const buttons = getAllElements(parsedRoot).filter((el) => el.tag === 'button');
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

    const parsedRoot = parseHtml(html);
    const buttons = getAllElements(parsedRoot).filter((el) => el.tag === 'button');

    const deleteBtn = buttons.find((b) =>
      b.children.some((c) => typeof c === 'string' && c.includes('Delete')),
    );
    expect(deleteBtn?.attrs['disabled']).toBeDefined();

    const undoBtn = buttons.find((b) =>
      b.children.some((c) => typeof c === 'string' && c.includes('Undo')),
    );
    expect(undoBtn?.attrs['disabled']).toBeDefined();

    const redoBtn = buttons.find((b) =>
      b.children.some((c) => typeof c === 'string' && c.includes('Redo')),
    );
    expect(redoBtn?.attrs['disabled']).toBeDefined();
  });

  it('TeachCanvas handles keyboard events (ArrowUp/Down/Left/Right, Delete, Escape, Ctrl+Z, Ctrl+Y)', () => {
    const onSelect = vi.fn();
    const onMovePoint = vi.fn();
    const onNudgePoint = vi.fn();
    const onDeleteSelected = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();

    act(() => {
      testRoot.render(
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
    });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('role')).toBe('img');

    // Arrow keys nudge selected point (STEP = 0.02)
    act(() => {
      canvas!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
      );
    });
    expect(onNudgePoint).toHaveBeenCalledWith('pA', 0, -0.02);

    act(() => {
      canvas!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
    });
    expect(onNudgePoint).toHaveBeenCalledWith('pA', 0, 0.02);

    act(() => {
      canvas!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
      );
    });
    expect(onNudgePoint).toHaveBeenCalledWith('pA', -0.02, 0);

    act(() => {
      canvas!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );
    });
    expect(onNudgePoint).toHaveBeenCalledWith('pA', 0.02, 0);

    // Delete / Backspace removes selected element
    act(() => {
      canvas!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }),
      );
    });
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);

    act(() => {
      canvas!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
      );
    });
    expect(onDeleteSelected).toHaveBeenCalledTimes(2);

    // Escape clears selection
    act(() => {
      canvas!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });
    expect(onSelect).toHaveBeenCalledWith(null);

    // Ctrl+Z triggers undo
    act(() => {
      canvas!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(onUndo).toHaveBeenCalledTimes(1);

    // Ctrl+Y triggers redo
    act(() => {
      canvas!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'y',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(onRedo).toHaveBeenCalledTimes(1);

    // Ctrl+Shift+Z triggers redo
    act(() => {
      canvas!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(onRedo).toHaveBeenCalledTimes(2);
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

  it('renders label edit form on selection and removes element on Delete with spoken confirmation', () => {
    const spoken: string[] = [];
    const drivers = createMockDrivers();
    drivers.speech.speak = vi.fn((text: string) => {
      spoken.push(text);
    });

    act(() => {
      testRoot.render(
        createElement(Teach, {
          initialScene: sampleTriangle,
          drivers,
          onBack: vi.fn(),
        }),
      );
    });

    // 1. Initial state has no selection: form is not present, Delete is disabled
    expect(container.querySelector('.gt-teach__label-form')).toBeNull();

    const buttons = Array.from(container.querySelectorAll('button'));
    const deleteBtn = buttons.find((b) => b.textContent?.trim() === t('teach.delete'));
    expect(deleteBtn).toBeDefined();
    expect(deleteBtn?.disabled).toBe(true);

    // 2. Select vertex pA (located at norm x: 0.1, y: 0.2 -> screen 40, 80 on 400x400 canvas)
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    act(() => {
      canvas!.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 40,
          clientY: 80,
          bubbles: true,
          cancelable: true,
          pointerId: 1,
        }),
      );
    });

    // Form appears with vertex label
    expect(container.querySelector('.gt-teach__label-form')).not.toBeNull();
    const input = container.querySelector('#gt-teach-label-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('Vertex A');
    expect(deleteBtn?.disabled).toBe(false);

    // 3. Activate Delete button: vertex is deleted, form disappears, confirmation is last spoken
    spoken.length = 0;
    act(() => {
      deleteBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    // Form disappears after deletion
    expect(container.querySelector('.gt-teach__label-form')).toBeNull();

    // Spoken confirmation is emitted and is the last thing spoken (not canceled by focus)
    const expectedConfirmation = `${t('teach.delete')}: pA`;
    expect(spoken).toContain(expectedConfirmation);
    expect(spoken[spoken.length - 1]).toBe(expectedConfirmation);
  });
});
