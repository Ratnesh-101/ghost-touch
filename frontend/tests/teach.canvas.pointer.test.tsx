// @vitest-environment jsdom
/**
 * CORE-09 — a revoked pointer capture ends the Teacher drag (Task 30, Requirement 17.5).
 *
 * Written by Kiro. This is the only test file that runs in jsdom (per-file environment above);
 * every other test keeps the Node environment.
 *
 * Audit scenario (a7 CORE-09): a teacher is dragging a point when an Android notification or a
 * system gesture takes the pointer away. The browser fires `lostpointercapture`. If the canvas
 * ignores it, the drag stays "on", and wherever the finger next moves and lifts, the point jumps
 * there. The canvas must instead end the drag where it was when capture was lost, like a cancel.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeachCanvas } from '../src/components/teach/TeachCanvas';
import type { DiagramScene } from '../src/core/scene';

declare global {
  // React reads this flag to know `act` is in use.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const SIZE = 400; // canvas CSS size in px; the scene's unit square maps onto it exactly

const scene: DiagramScene = {
  kind: 'geometry',
  points: [
    { id: 'A', x: 0.25, y: 0.25, label: 'A' },
    { id: 'B', x: 0.75, y: 0.75, label: 'B' },
  ],
  segments: [{ id: 'AB', a: 'A', b: 'B', label: null }],
};

let container: HTMLDivElement;
let root: Root;
let restoreRect: () => void;
let restoreContext: () => void;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  // jsdom does no layout: give the canvas a real size so the viewport is SIZE x SIZE.
  const proto = HTMLCanvasElement.prototype;
  const originalRect = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function rect(): DOMRect {
    return { x: 0, y: 0, left: 0, top: 0, right: SIZE, bottom: SIZE, width: SIZE, height: SIZE, toJSON: () => ({}) } as DOMRect;
  };
  restoreRect = () => {
    proto.getBoundingClientRect = originalRect;
  };

  // jsdom has no 2D context and logs "not implemented"; the canvas already copes with null.
  const originalContext = proto.getContext;
  proto.getContext = (() => null) as typeof proto.getContext;
  restoreContext = () => {
    proto.getContext = originalContext;
  };

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  restoreRect();
  restoreContext();
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
});

function mount(onMovePoint: (id: string, x: number, y: number) => void): HTMLCanvasElement {
  act(() => {
    root.render(
      createElement(TeachCanvas, {
        scene,
        selection: null,
        onSelect: vi.fn(),
        onMovePoint,
        onNudgePoint: vi.fn(),
        onDeleteSelected: vi.fn(),
      }),
    );
  });
  const canvas = container.querySelector('canvas');
  expect(canvas).not.toBeNull();
  return canvas as HTMLCanvasElement;
}

function fire(canvas: HTMLCanvasElement, type: string, x: number, y: number): void {
  act(() => {
    canvas.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1 }),
    );
  });
}

describe('CORE-09 — TeachCanvas and a revoked pointer capture', () => {
  it('ends the drag where it was when capture was lost; a later move and lift change nothing', () => {
    const onMovePoint = vi.fn();
    const canvas = mount(onMovePoint);

    fire(canvas, 'pointerdown', 0.25 * SIZE, 0.25 * SIZE); // grab point A
    fire(canvas, 'pointermove', 0.5 * SIZE, 0.3 * SIZE); // drag it
    fire(canvas, 'lostpointercapture', 0.5 * SIZE, 0.3 * SIZE); // the system takes the pointer
    fire(canvas, 'pointermove', 0.9 * SIZE, 0.9 * SIZE); // the finger keeps moving
    fire(canvas, 'pointerup', 0.9 * SIZE, 0.9 * SIZE); // and lifts somewhere else

    // Committed once, at the place the drag was when capture was lost.
    expect(onMovePoint).toHaveBeenCalledTimes(1);
    const [id, x, y] = onMovePoint.mock.calls[0] as [string, number, number];
    expect(id).toBe('A');
    expect(x).toBeCloseTo(0.5, 6);
    expect(y).toBeCloseTo(0.3, 6);
  });

  it('a normal drag still commits on lift (no regression)', () => {
    const onMovePoint = vi.fn();
    const canvas = mount(onMovePoint);

    fire(canvas, 'pointerdown', 0.75 * SIZE, 0.75 * SIZE); // grab point B
    fire(canvas, 'pointermove', 0.6 * SIZE, 0.4 * SIZE);
    fire(canvas, 'pointerup', 0.6 * SIZE, 0.4 * SIZE);

    expect(onMovePoint).toHaveBeenCalledTimes(1);
    const [id, x, y] = onMovePoint.mock.calls[0] as [string, number, number];
    expect(id).toBe('B');
    expect(x).toBeCloseTo(0.6, 6);
    expect(y).toBeCloseTo(0.4, 6);
  });

  it('a lost capture that arrives after the lift does not commit twice', () => {
    const onMovePoint = vi.fn();
    const canvas = mount(onMovePoint);

    fire(canvas, 'pointerdown', 0.25 * SIZE, 0.25 * SIZE);
    fire(canvas, 'pointermove', 0.4 * SIZE, 0.4 * SIZE);
    fire(canvas, 'pointerup', 0.4 * SIZE, 0.4 * SIZE);
    fire(canvas, 'lostpointercapture', 0.4 * SIZE, 0.4 * SIZE); // browsers send this after an up too

    expect(onMovePoint).toHaveBeenCalledTimes(1);
  });
});
