// @vitest-environment jsdom
/**
 * EX-05: Call speech.cancelListen() on system-Back path and unmount cleanup.
 *
 * When a voice listening session is pending and the user navigates Back via the
 * system / hardware back gesture (popstate) or Explore unmounts, speech.cancelListen()
 * must be invoked to shut down the microphone and recogniser.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { Explore } from '../src/screens/Explore';

const SIZE = 400;

const sampleScene: DiagramScene = {
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

describe('EX-05: speech.cancelListen() on system Back and unmount cleanup', () => {
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
    act(() => {
      try {
        root.unmount();
      } catch {
        // already unmounted in test
      }
    });
    container.remove();
    restoreProto();
    globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  it('calls speech.cancelListen() on system Back (popstate)', async () => {
    const cancelListen = vi.fn();
    const listenPromise = new Promise<string>(() => {}); // pending promise

    const drivers: Drivers = {
      haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        state: 'running',
      },
      speech: {
        speak: vi.fn(),
        listen: vi.fn(() => listenPromise),
        cancelListen,
        canSpeak: true,
        canListen: true,
        getRate: () => 'normal',
      },
      diagramStore: new MemoryDiagramStore(),
    };

    await act(async () => {
      root.render(
        createElement(Explore, {
          scene: sampleScene,
          announced: 'Triangle ABC ready',
          drivers,
          onBack: vi.fn(),
        }),
      );
    });

    // Start voice ask
    const askButton = container.querySelector<HTMLButtonElement>('.gt-explore__ask');
    expect(askButton).toBeTruthy();

    act(() => {
      askButton?.click();
    });

    expect(drivers.speech.listen).toHaveBeenCalled();
    expect(cancelListen).not.toHaveBeenCalled();

    // Trigger system Back via popstate
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });

    expect(cancelListen).toHaveBeenCalled();
  });

  it('calls speech.cancelListen() on unmount cleanup', async () => {
    const cancelListen = vi.fn();
    const listenPromise = new Promise<string>(() => {}); // pending promise

    const drivers: Drivers = {
      haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        state: 'running',
      },
      speech: {
        speak: vi.fn(),
        listen: vi.fn(() => listenPromise),
        cancelListen,
        canSpeak: true,
        canListen: true,
        getRate: () => 'normal',
      },
      diagramStore: new MemoryDiagramStore(),
    };

    await act(async () => {
      root.render(
        createElement(Explore, {
          scene: sampleScene,
          announced: 'Triangle ABC ready',
          drivers,
          onBack: vi.fn(),
        }),
      );
    });

    // Start voice ask
    const askButton = container.querySelector<HTMLButtonElement>('.gt-explore__ask');
    expect(askButton).toBeTruthy();

    act(() => {
      askButton?.click();
    });

    expect(cancelListen).not.toHaveBeenCalled();

    // Unmount the component
    act(() => {
      root.unmount();
    });

    expect(cancelListen).toHaveBeenCalled();
  });
});
