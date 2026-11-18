// @vitest-environment jsdom
/**
 * Test for Requirement 28.7:
 * WHILE Ask is listening, promoting a finger onto corner A must not speak the corner exits.
 *
 * If the guard `!askActive.current` in the promotion branch of Explore.tsx is removed,
 * the test 'Ask listening: promoting a finger onto corner A speaks no exits (28.7)' fails.
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import triangleJson from '../public/samples/triangle.json';
import {
  _resetGuideSettingForTesting,
  setStoredGuideSetting,
} from '../src/config/features';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import {
  _resetCornerHeartbeatSettingForTesting,
  _resetDirectionsSettingForTesting,
  _resetFindingSoundSettingForTesting,
  setStoredCornerHeartbeatSetting,
  setStoredDirectionsSetting,
  setStoredFindingSoundSetting,
} from '../src/drivers/storage';
import {
  _resetGraphScanSettingForTesting,
  setStoredGraphScanSetting,
} from '../src/flow/explore';
import { Explore } from '../src/screens/Explore';

const SIZE = 400;
const triangle = triangleJson as unknown as DiagramScene;

/** A compass clause ("Down-right to B.") or a line name ("Side CA. ..."). */
const COMPASS_OR_LINE_NAME = /\bto [ABC]\b|\bSide [A-C]{2}\b/;

interface Rig {
  speak: ReturnType<typeof vi.fn>;
  container: HTMLDivElement;
  down: (x: number, y: number, id?: number) => void;
  move: (x: number, y: number, id?: number) => void;
  up: (x: number, y: number, id?: number) => void;
  advance: (ms: number) => void;
  clearCalls: () => void;
  spoken: () => string[];
}

function fire(el: Element, type: string, x: number, y: number, pointerId: number): void {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.assign(event, { pointerId });
  act(() => {
    el.dispatchEvent(event);
  });
}

async function withExplore(body: (rig: Rig) => Promise<void> | void): Promise<void> {
  setStoredDirectionsSetting(true);
  setStoredFindingSoundSetting(true);
  setStoredCornerHeartbeatSetting(false);
  setStoredGraphScanSetting(true);
  setStoredGuideSetting(false);

  const speak = vi.fn();
  const listen = vi.fn(
    () =>
      new Promise<string>(() => {
        // Keeps listening active indefinitely until test finishes
      }),
  );

  const drivers = {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(() => true), stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      setGuideTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      playClick: vi.fn(),
      state: 'running',
    },
    speech: {
      speak,
      listen,
      stopSpeaking: vi.fn(),
      cancelListen: vi.fn(),
      isSpeaking: vi.fn(() => false),
      getRate: () => 'normal',
      canSpeak: true,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  } as unknown as Drivers;

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(Explore, {
        scene: triangle,
        announced: 'Diagram',
        drivers,
        onBack: vi.fn(),
      }),
    );
  });
  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('Explore did not render a canvas');

  const rig: Rig = {
    speak,
    container,
    down: (x, y, id = 1) => fire(canvas, 'pointerdown', x, y, id),
    move: (x, y, id = 1) => fire(canvas, 'pointermove', x, y, id),
    up: (x, y, id = 1) => fire(canvas, 'pointerup', x, y, id),
    advance: (ms) => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    },
    clearCalls: () => {
      speak.mockClear();
    },
    spoken: () => speak.mock.calls.map((c) => String(c[0])),
  };

  try {
    await body(rig);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
}

function openAsk(rig: Rig): void {
  const ask = rig.container.querySelector<HTMLButtonElement>('.gt-explore__ask');
  if (!ask) throw new Error('Ask button not found');
  act(() => ask.click());
}

describe('Requirement 28.7: Ask listening guards corner compass on pointer promotion', () => {
  const protoRestore: Array<() => void> = [];

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
    });
    _resetDirectionsSettingForTesting();
    _resetFindingSoundSettingForTesting();
    _resetCornerHeartbeatSettingForTesting();
    _resetGraphScanSettingForTesting();
    _resetGuideSettingForTesting();

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
    protoRestore.push(() => {
      proto.getBoundingClientRect = origRect;
      proto.getContext = origContext;
    });
  });

  afterEach(() => {
    while (protoRestore.length > 0) protoRestore.pop()?.();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    _resetDirectionsSettingForTesting();
    _resetFindingSoundSettingForTesting();
    _resetCornerHeartbeatSettingForTesting();
    _resetGraphScanSettingForTesting();
    _resetGuideSettingForTesting();
    globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  it('Ask listening: promoting a finger onto corner A speaks no exits (28.7)', async () => {
    await withExplore((rig) => {
      openAsk(rig);
      // Finger 1 down off line in click zone
      rig.down(130, 220, 1);
      // Finger 2 down on corner A (100, 100)
      rig.down(100, 100, 2);
      rig.advance(100);
      rig.clearCalls();
      // Lifting finger 1 promotes finger 2 to primary on corner A
      rig.up(130, 220, 1);

      // Must not speak any exits (e.g. "Down to C. Down-right to B.")
      expect(rig.spoken().filter((s) => COMPASS_OR_LINE_NAME.test(s))).toEqual([]);
      expect(rig.spoken().some((s) => /\bto [BC]\b/.test(s))).toBe(false);
    });
  });

  it('control: without Ask listening, promoting a finger onto corner A speaks exits', async () => {
    await withExplore((rig) => {
      // Finger 1 down off line
      rig.down(130, 220, 1);
      // Finger 2 down on corner A (100, 100)
      rig.down(100, 100, 2);
      rig.advance(100);
      rig.clearCalls();
      // Lifting finger 1 promotes finger 2 to primary on corner A
      rig.up(130, 220, 1);

      // Corner exits are spoken when Ask is not listening
      expect(rig.spoken().filter((s) => COMPASS_OR_LINE_NAME.test(s)).length).toBeGreaterThan(0);
      expect(rig.spoken().some((s) => /\bto B\b/.test(s))).toBe(true);
      expect(rig.spoken().some((s) => /\bto C\b/.test(s))).toBe(true);
    });
  });
});
