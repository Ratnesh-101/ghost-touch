// @vitest-environment jsdom
/**
 * EX-01: Explore.tsx handleVoiceAsk early return resets askActive gate.
 *
 * When speech.canListen is false, pressing Ask must not leave askActive permanently true.
 * After pressing Ask, pointerdown on a vertex must still vibrate and speak.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { Explore } from '../src/screens/Explore';

const SIZE = 400;

const triangleScene: DiagramScene = {
  kind: 'geometry',
  title: 'Triangle ABC',
  points: [
    { id: 'A', x: 0.25, y: 0.25, label: 'A' },
    { id: 'B', x: 0.75, y: 0.75, label: 'B' },
    { id: 'C', x: 0.25, y: 0.75, label: 'C' },
  ],
  segments: [
    { id: 'AB', a: 'A', b: 'B', label: 'AB' },
    { id: 'BC', a: 'B', b: 'C', label: 'BC' },
    { id: 'CA', a: 'C', b: 'A', label: 'CA' },
  ],
};

function dispatchPointer(
  el: HTMLElement,
  type: string,
  clientX: number,
  clientY: number,
  pointerId = 1,
): void {
  const event = new MouseEvent(type, {
    clientX,
    clientY,
    bubbles: true,
    cancelable: true,
  });
  Object.assign(event, { pointerId });
  el.dispatchEvent(event);
}

describe('EX-01: askActive gate reset on unsupported voice ask', () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreProto: () => void;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const proto = HTMLCanvasElement.prototype;
    const origRect = proto.getBoundingClientRect;
    const origContext = proto.getContext;

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

    restoreProto = () => {
      proto.getBoundingClientRect = origRect;
      proto.getContext = origContext;
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    restoreProto();
    globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  it('resets askActive gate when speech.canListen is false so touch vibrates and speaks', async () => {
    const vibrate = vi.fn();
    const speak = vi.fn();
    const setTone = vi.fn();

    const drivers: Drivers = {
      haptics: { supported: true, lastResult: null, vibrate, stop: vi.fn() },
      audio: {
        unlock: vi.fn(),
        setTone,
        beep: vi.fn(),
        playEarcon: vi.fn(),
        state: 'running',
      },
      speech: {
        speak,
        listen: vi.fn(),
        canSpeak: true,
        canListen: false, // Speech recognition unsupported
        getRate: () => 'normal',
      },
      diagramStore: new MemoryDiagramStore(),
    };

    await act(async () => {
      root.render(
        createElement(Explore, {
          scene: triangleScene,
          announced: 'Triangle ABC ready',
          drivers,
          onBack: vi.fn(),
        }),
      );
    });

    // Locate Ask button and click it
    const askButton = container.querySelector<HTMLButtonElement>('.gt-explore__ask');
    expect(askButton).toBeTruthy();

    await act(async () => {
      askButton?.click();
    });

    // Clear calls from initial speech/button interactions
    vibrate.mockClear();
    speak.mockClear();

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();

    // Fire pointerdown on Vertex A (x=0.25, y=0.25 -> screen px (100, 100))
    await act(async () => {
      dispatchPointer(canvas!, 'pointerdown', 100, 100, 1);
    });

    // Vertex A must vibrate with corner pattern [50, 90, 50] and speak 'A'
    expect(vibrate).toHaveBeenCalledWith([50, 90, 50]);
    expect(speak).toHaveBeenCalledWith('A', expect.any(String));
  });
});
