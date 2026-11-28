/**
 * Explore screen speech pacing wiring test (Requirement M2).
 *
 * Mounts Explore with fake drivers in a simulated DOM environment and verifies that:
 * 1. In short mode, rapid sweeps across bars pass through the pacing guard,
 *    reducing subsequent bars to labels only ("Q2" instead of "Q2, 25").
 * 2. Rapid axis crossings pass through the pacing guard, debouncing repeats
 *    within 2000 ms.
 *
 * These assertions prove that the speech pacing guard is wired in Explore.tsx
 * and fail if the wiring is removed.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error jsdom has no @types/jsdom declaration file in devDependencies
import { JSDOM } from 'jsdom';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import {
  setStoredSpeechDetailSetting,
  _resetSpeechDetailSettingForTesting,
} from '../src/flow/explore';
import { Explore } from '../src/screens/Explore';
import barchartJson from '../public/samples/barchart.json';
import sineJson from '../public/samples/sine.json';

const barScene = barchartJson as unknown as DiagramScene;
const sineScene = sineJson as unknown as DiagramScene;

// Set up DOM globals if running in node environment
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
});

if (typeof window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: dom.window,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    value: dom.window.document,
    configurable: true,
    writable: true,
  });
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: dom.window.navigator,
      configurable: true,
      writable: true,
    });
  } catch {
    // navigator in some runtimes cannot be overridden; keep existing navigator
  }
  Object.defineProperty(globalThis, 'HTMLElement', {
    value: dom.window.HTMLElement,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'HTMLCanvasElement', {
    value: dom.window.HTMLCanvasElement,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'DOMRect', {
    value: dom.window.DOMRect,
    configurable: true,
    writable: true,
  });
  if (dom.window.MouseEvent) {
    Object.defineProperty(globalThis, 'MouseEvent', {
      value: dom.window.MouseEvent,
      configurable: true,
      writable: true,
    });
  }
}

if (!window.matchMedia) {
  window.matchMedia = (() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!HTMLCanvasElement.prototype.setPointerCapture) {
  HTMLCanvasElement.prototype.setPointerCapture = () => {};
}
if (!HTMLCanvasElement.prototype.releasePointerCapture) {
  HTMLCanvasElement.prototype.releasePointerCapture = () => {};
}

if (!HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = (() => ({
    clearRect: () => {},
    drawImage: () => {},
    setTransform: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    fillText: () => {},
    strokeRect: () => {},
    fillRect: () => {},
    moveTo: () => {},
    lineTo: () => {},
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

if (typeof PointerEvent === 'undefined') {
  const EventBase = (typeof MouseEvent !== 'undefined' ? MouseEvent : dom.window.MouseEvent) as {
    new (type: string, eventInitDict?: MouseEventInit): MouseEvent;
  };
  Object.defineProperty(globalThis, 'PointerEvent', {
    value: class PointerEvent extends EventBase {
      pointerId: number;
      pointerType: string;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 1;
        this.pointerType = params.pointerType ?? 'touch';
      }
    },
    configurable: true,
    writable: true,
  });
}

function createFakeDrivers(): {
  drivers: Drivers;
  speak: ReturnType<typeof vi.fn>;
  vibrate: ReturnType<typeof vi.fn>;
  setTone: ReturnType<typeof vi.fn>;
} {
  const speak = vi.fn();
  const vibrate = vi.fn().mockReturnValue(true);
  const setTone = vi.fn();
  const drivers: Drivers = {
    haptics: { supported: true, lastResult: null, vibrate, stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone, beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
    speech: {
      speak,
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn((): SpeechRateSetting => 'normal'),
      setRate: vi.fn(),
    },
    diagramStore: new MemoryDiagramStore(),
  };
  return { drivers, speak, vibrate, setTone };
}

describe('Explore Screen — Speech Pacing Wiring (Requirement M2)', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    _resetSpeechDetailSettingForTesting();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    _resetSpeechDetailSettingForTesting();
  });

  it('proves pacing guard is wired in short mode: rapid sweep over bars speaks short label, not full text', async () => {
    setStoredSpeechDetailSetting('short');
    const { drivers, speak } = createFakeDrivers();

    root = createRoot(container);
    await act(async () => {
      root?.render(
        <Explore
          scene={barScene}
          announced="Bar chart"
          drivers={drivers}
          onBack={() => {}}
        />,
      );
    });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    if (!canvas) return;

    // Simulate canvas layout dimensions (400 x 400)
    canvas.getBoundingClientRect = () =>
      ({
        width: 448,
        height: 448,
        left: 0,
        top: 0,
        right: 448,
        bottom: 448,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect;

    if (canvas.parentElement) {
      Object.defineProperty(canvas.parentElement, 'clientWidth', { value: 448, configurable: true });
      Object.defineProperty(canvas.parentElement, 'clientHeight', { value: 448, configurable: true });
    }

    // Touch down on Bar 1 (Q1 at x = 80, y = 300)
    await act(async () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          clientX: 80 + 24,
          clientY: 300 + 24,
          pointerId: 1,
        }),
      );
    });

    // Bar 1 speaks full text because it doesn't follow another bar
    expect(speak).toHaveBeenCalledWith('Q1, 10', expect.any(String));
    speak.mockClear();

    // Rapidly move to Bar 2 (Q2 at x = 160, y = 300) within 700 ms (< BAR_SHORT_FOLLOW_INTERVAL_MS)
    await act(async () => {
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 160 + 24,
          clientY: 300 + 24,
          pointerId: 1,
        }),
      );
    });

    // Pacing guard reduces Bar 2 to label "Q2" only!
    // If the pacing guard were removed from Explore.tsx, this assertion would fail
    // because "Q2, 25" would be spoken instead.
    expect(speak).toHaveBeenCalledWith('Q2', expect.any(String));
    expect(speak).not.toHaveBeenCalledWith('Q2, 25', expect.any(String));
  });

  it('proves pacing guard is wired in full mode: rapid axis crossings debounce repeated axis announcements', async () => {
    setStoredSpeechDetailSetting('full');
    const { drivers, speak } = createFakeDrivers();

    root = createRoot(container);
    await act(async () => {
      root?.render(
        <Explore
          scene={sineScene}
          announced="Sine wave"
          drivers={drivers}
          onBack={() => {}}
        />,
      );
    });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    if (!canvas) return;

    canvas.getBoundingClientRect = () =>
      ({
        width: 400,
        height: 400,
        left: 0,
        top: 0,
        right: 400,
        bottom: 400,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect;

    if (canvas.parentElement) {
      Object.defineProperty(canvas.parentElement, 'clientWidth', { value: 400, configurable: true });
      Object.defineProperty(canvas.parentElement, 'clientHeight', { value: 400, configurable: true });
    }

    // Touch down near the axis at y = 180 (x_axis_y = 0.5 -> y = 200 in 400x400 view)
    await act(async () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          clientX: 100,
          clientY: 180,
          pointerId: 1,
        }),
      );
    });

    speak.mockClear();

    // Cross the x-axis to y = 220
    await act(async () => {
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 100,
          clientY: 220,
          pointerId: 1,
        }),
      );
    });

    // First crossing speaks "x-axis"
    const axisSpokenCalls = speak.mock.calls.filter((call: unknown[]) => {
      const firstArg = call[0];
      return typeof firstArg === 'string' && firstArg.toLowerCase().includes('axis');
    });
    expect(axisSpokenCalls.length).toBe(1);
    speak.mockClear();

    // Immediately cross back to y = 180 (< 2000 ms debounce window)
    await act(async () => {
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 100,
          clientY: 180,
          pointerId: 1,
        }),
      );
    });

    // Repeated axis crossing is suppressed by pacing guard!
    // If the pacing guard were removed from Explore.tsx, this assertion would fail.
    const debouncedCalls = speak.mock.calls.filter((call: unknown[]) => {
      const firstArg = call[0];
      return typeof firstArg === 'string' && firstArg.toLowerCase().includes('axis');
    });
    expect(debouncedCalls.length).toBe(0);
  });
});
