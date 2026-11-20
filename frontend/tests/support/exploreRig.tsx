/**
 * Shared harness for the seven Explore bug oracles (task 67, requirements 37 to 42).
 *
 * Mounts the real `Explore` screen with fake drivers and fake timers on a 400 x 400 CSS px
 * canvas, and returns a small rig to drive it with pointer events. Same shape as the harness in
 * `explore.wiring.guards.test.tsx` (which is not edited); this one also exposes
 * `stopSpeaking`, `playEarcon` and a switch that makes the fake speech driver report "speaking".
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import { setStoredGuideSetting } from '../../src/config/features';
import type { DiagramScene } from '../../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../../src/drivers';
import {
  _resetCornerHeartbeatSettingForTesting,
  _resetDirectionsSettingForTesting,
  _resetFindingSoundSettingForTesting,
  setStoredCornerHeartbeatSetting,
  setStoredDirectionsSetting,
  setStoredFindingSoundSetting,
} from '../../src/drivers/storage';
import {
  _resetGraphScanSettingForTesting,
  _resetSpeechDetailSettingForTesting,
  setStoredGraphScanSetting,
  setStoredSpeechDetailSetting,
} from '../../src/flow/explore';
import { Explore } from '../../src/screens/Explore';

export const SIZE = 400;

export type Calls = unknown[][];

export interface RigSettings {
  scene: DiagramScene;
  guide?: boolean;
  /** Speech detail setting; default 'full'. */
  detail?: 'full' | 'short';
  graphScan?: boolean;
  /** When set, `fetch` answers every request with this Ask answer. */
  askAnswer?: string;
  /** Mount Explore with `isRaw` (a Raw Mode scene). Default false. */
  isRaw?: boolean;
}

export interface Rig {
  speak: ReturnType<typeof vi.fn>;
  stopSpeaking: ReturnType<typeof vi.fn>;
  playEarcon: ReturnType<typeof vi.fn>;
  vibrate: ReturnType<typeof vi.fn>;
  setTone: ReturnType<typeof vi.fn>;
  onBack: ReturnType<typeof vi.fn>;
  container: HTMLDivElement;
  down: (x: number, y: number, id?: number) => void;
  move: (x: number, y: number, id?: number) => void;
  up: (x: number, y: number, id?: number) => void;
  advance: (ms: number) => void;
  clearCalls: () => void;
  /** Make the fake speech driver report that an utterance is (or is not) playing. */
  setSpeaking: (speaking: boolean) => void;
  spoken: () => string[];
  vibrations: () => Calls;
  tones: () => Calls;
  earcons: () => string[];
  openAsk: () => void;
  resolveListen: (text: string) => Promise<void>;
  /** Let pending promises (the stubbed Ask fetch) settle. */
  flush: () => Promise<void>;
}

function fire(el: Element, type: string, x: number, y: number, pointerId: number): void {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.assign(event, { pointerId });
  act(() => {
    el.dispatchEvent(event);
  });
}

const restoreStack: Array<() => void> = [];

/** Call from `beforeEach`. */
export function setupRigEnv(): void {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // setImmediate stays real so async act() can flush.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
  });
  _resetDirectionsSettingForTesting();
  _resetFindingSoundSettingForTesting();
  _resetCornerHeartbeatSettingForTesting();
  _resetGraphScanSettingForTesting();
  _resetSpeechDetailSettingForTesting();

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
  restoreStack.push(() => {
    proto.getBoundingClientRect = origRect;
    proto.getContext = origContext;
  });
}

/** Call from `afterEach`. */
export function teardownRigEnv(): void {
  while (restoreStack.length > 0) restoreStack.pop()?.();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  _resetDirectionsSettingForTesting();
  _resetFindingSoundSettingForTesting();
  _resetCornerHeartbeatSettingForTesting();
  _resetGraphScanSettingForTesting();
  _resetSpeechDetailSettingForTesting();
  setStoredGuideSetting(false);
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
}

/** Mount the real Explore, run `body`, unmount. Settings are stored before the mount. */
export async function withExplore(
  settings: RigSettings,
  body: (rig: Rig) => Promise<void> | void,
): Promise<void> {
  setStoredDirectionsSetting(true);
  setStoredFindingSoundSetting(false); // keep the click cue out of these oracles
  setStoredCornerHeartbeatSetting(false);
  setStoredGraphScanSetting(settings.graphScan ?? true);
  setStoredGuideSetting(settings.guide ?? false);
  setStoredSpeechDetailSetting(settings.detail ?? 'full');
  if (settings.guide) vi.stubEnv('VITE_FEATURE_GUIDE', '1');
  if (settings.askAnswer !== undefined) {
    const answer = settings.askAnswer;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ answer, source: 'facts' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
  }

  let speaking = false;
  const speak = vi.fn();
  const stopSpeaking = vi.fn();
  const playEarcon = vi.fn();
  const vibrate = vi.fn(() => true);
  const setTone = vi.fn();
  const onBack = vi.fn();
  let resolveListenRaw: (text: string) => void = () => {};
  const listen = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        resolveListenRaw = resolve;
      }),
  );

  const drivers = {
    haptics: { supported: true, lastResult: null, vibrate, stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone,
      setGuideTone: vi.fn(),
      beep: vi.fn(),
      playEarcon,
      playClick: vi.fn(),
      state: 'running',
    },
    speech: {
      speak,
      listen,
      stopSpeaking,
      cancelListen: vi.fn(),
      isSpeaking: vi.fn(() => speaking),
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
        scene: settings.scene,
        announced: 'Diagram',
        drivers,
        onBack,
        ...(settings.isRaw === true ? { isRaw: true } : {}),
      }),
    );
  });
  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('Explore did not render a canvas');

  const rig: Rig = {
    speak,
    stopSpeaking,
    playEarcon,
    vibrate,
    setTone,
    onBack,
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
      stopSpeaking.mockClear();
      playEarcon.mockClear();
      vibrate.mockClear();
      setTone.mockClear();
    },
    setSpeaking: (value) => {
      speaking = value;
    },
    spoken: () => speak.mock.calls.map((c) => String(c[0])),
    vibrations: () => vibrate.mock.calls.map((c) => [...(c as unknown[])]),
    tones: () => setTone.mock.calls.map((c) => [...(c as unknown[])]),
    earcons: () => playEarcon.mock.calls.map((c) => String(c[0])),
    openAsk: () => {
      const ask = container.querySelector<HTMLButtonElement>('.gt-explore__ask');
      if (!ask) throw new Error('Ask button not found');
      act(() => ask.click());
    },
    resolveListen: async (text) => {
      await act(async () => {
        resolveListenRaw(text);
      });
    },
    flush: async () => {
      for (let i = 0; i < 5; i += 1) {
        await act(async () => {
          await Promise.resolve();
        });
      }
    },
  };

  try {
    await body(rig);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
}
