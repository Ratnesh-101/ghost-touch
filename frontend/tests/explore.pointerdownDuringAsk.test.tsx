// @vitest-environment jsdom
/**
 * EX-02: Gate pointerdown during active voice listening.
 *
 * While speech.listen() is pending (microphone open), pointerdown on a vertex
 * must produce NO tone, vibration, or speech.
 * When not listening, pointerdown functions normally.
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

describe('EX-02: pointerdown gated while voice listening is active', () => {
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

  it('silences tone, vibration, and speech on pointerdown while microphone is listening', async () => {
    const vibrate = vi.fn();
    const speak = vi.fn();
    const setTone = vi.fn();
    let resolveListen!: (value: string) => void;
    const listenPromise = new Promise<string>((resolve) => {
      resolveListen = resolve;
    });

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
        listen: vi.fn(() => listenPromise),
        canSpeak: true,
        canListen: true,
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

    const askButton = container.querySelector<HTMLButtonElement>('.gt-explore__ask');
    expect(askButton).toBeTruthy();

    // Trigger voice ask so listen() becomes pending and askActive is true
    act(() => {
      askButton?.click();
    });

    // Clear any calls from entering ask mode (e.g. earcon/beep)
    vibrate.mockClear();
    speak.mockClear();
    setTone.mockClear();

    const canvas = container.querySelector('canvas')!;
    expect(canvas).toBeTruthy();

    // Touch vertex A (100, 100) while listening is active
    await act(async () => {
      dispatchPointer(canvas, 'pointerdown', 100, 100, 1);
    });

    // Must be completely silent: no tone, vibration, or speech while mic is open
    expect(vibrate).not.toHaveBeenCalled();
    expect(setTone).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();

    // Lift pointer
    await act(async () => {
      dispatchPointer(canvas, 'pointerup', 100, 100, 1);
    });

    // Conclude the voice listening session
    await act(async () => {
      resolveListen('How many corners?');
    });

    vibrate.mockClear();
    speak.mockClear();
    setTone.mockClear();

    // Now that listening is over, touching vertex A must vibrate and speak normally
    await act(async () => {
      dispatchPointer(canvas, 'pointerdown', 100, 100, 2);
    });

    expect(vibrate).toHaveBeenCalledWith([50, 90, 50]);
    expect(speak).toHaveBeenCalledWith('A', expect.any(String));
  });
});
