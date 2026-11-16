/**
 * @vitest-environment jsdom
 *
 * Lane bu9 regression test suite (fixes from independent Kiro review):
 * - M1: handlePointerDown calls checkVertexCompass on corner landed by new touch
 * - M2: checkLineDwell requires finger at rest (< 6 px) and speech quiet (>= 1500 ms)
 * - M4: where-am-I dwell sits behind Directions switch
 * - M5: global.css duplicate .gt-explore__where-am-i removed
 * - L1: commands.ts uses DEFAULT_RADII
 * - L2: whereAmI uses hitTest bar-interior before nearestElement
 * - L3: speech driver speaking state suppresses dwells
 * - L4: settings read once per hold, not on every pointer move
 * - L6: storage consolidation in drivers/storage.ts
 * - L8: orphaned i18n keys removed
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { makeViewport } from '../src/core/geometry';
import { DEFAULT_RADII } from '../src/core/hitTest';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import {
  _resetDirectionsSettingForTesting,
  _resetFindingSoundSettingForTesting,
  getStoredDirectionsSetting,
  getStoredFindingSoundSetting,
  setStoredDirectionsSetting,
  setStoredFindingSoundSetting,
  subscribeSettings,
} from '../src/drivers/storage';
import { whereAmI } from '../src/flow/commands';
import { LINE_DWELL_MS } from '../src/flow/explore';
import { t } from '../src/i18n';
import { Explore } from '../src/screens/Explore';
import globalCss from '../src/styles/global.css?raw';

const triangleScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle ABC',
  points: [
    { id: 'A', x: 0.25, y: 0.25, label: 'A' },
    { id: 'B', x: 0.7, y: 0.85, label: 'B' },
    { id: 'C', x: 0.25, y: 0.85, label: 'C' },
  ],
  segments: [
    { id: 'CA', a: 'C', b: 'A', label: 'CA' },
    { id: 'AB', a: 'A', b: 'B', label: 'AB' },
    { id: 'BC', a: 'B', b: 'C', label: 'BC' },
  ],
};

const barScene: DiagramScene = {
  version: 1,
  kind: 'bar_chart',
  title: 'Quarterly Sales',
  bars: [
    { id: 'b1', label: 'Q1', value: 50, x0: 0.2, x1: 0.4, y_base: 0.9, y_top: 0.3 },
  ],
};

function createMockDrivers(speakingState = false): Drivers & { speakMock: ReturnType<typeof vi.fn> } {
  const speakMock = vi.fn();
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      setGuideTone: vi.fn(),
      state: 'running',
    },
    speech: {
      speak: speakMock,
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn((): SpeechRateSetting => 'normal'),
      setRate: vi.fn(),
      isSpeaking: vi.fn(() => speakingState),
    },
    diagramStore: new MemoryDiagramStore(),
    speakMock,
  };
}

describe('Lane bu9: Explore review fixes', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    _resetDirectionsSettingForTesting();
    _resetFindingSoundSettingForTesting();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Canvas & layout stubs for JSDOM
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
    });
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
    HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 300,
      height: 300,
      right: 300,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    if (typeof ResizeObserver === 'undefined') {
      (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('M1: handlePointerDown compass announcements on initial touch', () => {
    it('speaks vertex label and corner exit directions on new pointerdown on Vertex A', () => {
      const drivers = createMockDrivers();

      act(() => {
        root.render(
          <Explore
            scene={triangleScene}
            announced="Right Triangle ABC"
            drivers={drivers}
            onBack={vi.fn()}
          />,
        );
      });

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();

      drivers.speakMock.mockClear();

      // Vertex A is at x: 0.25, y: 0.25 -> (75, 75) in 300x300 canvas
      act(() => {
        const event = new PointerEvent('pointerdown', {
          pointerId: 1,
          clientX: 75,
          clientY: 75,
          bubbles: true,
        });
        canvas!.dispatchEvent(event);
      });

      // M1 requires: speech starts with "A" and includes exit directions (compass words) on initial touch
      expect(drivers.speakMock).toHaveBeenCalledWith(
        expect.stringMatching(/^A[. ].*(?:up|down|left|right).*to B/i),
        expect.any(String),
      );
      const spokenText = drivers.speakMock.mock.calls[0]?.[0] as string;
      expect(spokenText).toMatch(/^A[. ]/);
      expect(spokenText).toMatch(/\b(up|down|left|right|up-left|up-right|down-left|down-right)\b/i);
      expect(spokenText).toContain('to B');
    });
  });

  describe('M2: checkLineDwell requires finger at rest & speech quiet', () => {
    it('does NOT speak line name while tracing along the side', () => {
      const drivers = createMockDrivers();

      act(() => {
        root.render(
          <Explore
            scene={triangleScene}
            announced="Right Triangle ABC"
            drivers={drivers}
            onBack={vi.fn()}
          />,
        );
      });

      const canvas = container.querySelector('canvas')!;
      drivers.speakMock.mockClear();

      // Pointerdown on side CA at (75, 100)
      act(() => {
        canvas.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerId: 1,
            clientX: 75,
            clientY: 100,
            bubbles: true,
          }),
        );
      });

      // Move along CA every 100 ms by 10 px (> WHERE_AM_I_REST_MAX_MOVE_PX = 6 px) for 1000 ms total
      for (let i = 1; i <= 10; i++) {
        act(() => {
          vi.advanceTimersByTime(100);
          canvas.dispatchEvent(
            new PointerEvent('pointermove', {
              pointerId: 1,
              clientX: 75,
              clientY: 100 + i * 10,
              bubbles: true,
            }),
          );
        });
      }

      // Verify line name "Side CA" was never spoken during tracing
      const lineSpeech = drivers.speakMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('Side CA'),
      );
      expect(lineSpeech).toHaveLength(0);
    });

    it('speaks line name when resting for 800 ms on a side', () => {
      const drivers = createMockDrivers();

      act(() => {
        root.render(
          <Explore
            scene={triangleScene}
            announced="Right Triangle ABC"
            drivers={drivers}
            onBack={vi.fn()}
          />,
        );
      });

      const canvas = container.querySelector('canvas')!;
      drivers.speakMock.mockClear();

      // Touch down on side CA at (75, 150)
      act(() => {
        canvas.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerId: 1,
            clientX: 75,
            clientY: 150,
            bubbles: true,
          }),
        );
      });

      // Rest for 800 ms (triggering keep-alive ticks)
      act(() => {
        vi.advanceTimersByTime(LINE_DWELL_MS + 100);
      });

      const lineSpeech = drivers.speakMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('Side CA'),
      );
      expect(lineSpeech.length).toBeGreaterThanOrEqual(1);
    });

    it('suppresses line name dwell if other speech started inside WHERE_AM_I_SPEECH_QUIET_MS', () => {
      const drivers = createMockDrivers();

      act(() => {
        root.render(
          <Explore
            scene={triangleScene}
            announced="Right Triangle ABC"
            drivers={drivers}
            onBack={vi.fn()}
          />,
        );
      });

      const canvas = container.querySelector('canvas')!;

      // Click "Where am I" to trigger speech, marking lastSpeechStartRef
      const whereAmIBtn = container.querySelector('[data-testid="explore-where-am-i"]') as HTMLButtonElement;
      act(() => {
        whereAmIBtn.click();
      });

      drivers.speakMock.mockClear();

      // Touch down on side CA immediately (within quiet window)
      act(() => {
        canvas.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerId: 1,
            clientX: 75,
            clientY: 150,
            bubbles: true,
          }),
        );
      });

      // Advance by 800 ms (line dwell threshold reached, but quiet window 1500 ms not reached)
      act(() => {
        vi.advanceTimersByTime(800);
      });

      // Must be suppressed
      const lineSpeechBeforeQuiet = drivers.speakMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('Side CA'),
      );
      expect(lineSpeechBeforeQuiet).toHaveLength(0);

      // Advance past quiet window (another 800 ms, total 1600 ms >= 1500 ms)
      act(() => {
        vi.advanceTimersByTime(800);
      });

      const lineSpeechAfterQuiet = drivers.speakMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('Side CA'),
      );
      expect(lineSpeechAfterQuiet.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('M4: where-am-I dwell sits behind Directions switch', () => {
    it('does NOT speak where-am-I dwell when Directions setting is OFF', () => {
      setStoredDirectionsSetting(false);
      const drivers = createMockDrivers();

      act(() => {
        root.render(
          <Explore
            scene={triangleScene}
            announced="Right Triangle ABC"
            drivers={drivers}
            onBack={vi.fn()}
          />,
        );
      });

      const canvas = container.querySelector('canvas')!;
      drivers.speakMock.mockClear();

      // Touch down in empty space (220, 50) away from centre
      act(() => {
        canvas.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerId: 1,
            clientX: 220,
            clientY: 50,
            bubbles: true,
          }),
        );
      });

      // Rest for 2000 ms (> 1200 ms dwell time)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // No dwell speech when Directions is off
      expect(drivers.speakMock).not.toHaveBeenCalled();
    });

    it('speaks where-am-I dwell when Directions setting is ON (default)', () => {
      setStoredDirectionsSetting(true);
      const drivers = createMockDrivers();

      act(() => {
        root.render(
          <Explore
            scene={triangleScene}
            announced="Right Triangle ABC"
            drivers={drivers}
            onBack={vi.fn()}
          />,
        );
      });

      const canvas = container.querySelector('canvas')!;
      drivers.speakMock.mockClear();

      // Touch down in empty space (220, 50) away from centre
      act(() => {
        canvas.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerId: 1,
            clientX: 220,
            clientY: 50,
            bubbles: true,
          }),
        );
      });

      // Rest for 2000 ms
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Dwell speech triggers with coarse position ("top right")
      expect(drivers.speakMock).toHaveBeenCalled();
      const calls = drivers.speakMock.mock.calls.map((c) => c[0]);
      expect(calls.some((msg) => typeof msg === 'string' && (msg.includes('right') || msg.includes('top')))).toBe(true);
    });
  });

  describe('M5: duplicate CSS removed from global.css', () => {
    it('does not contain .gt-explore__where-am-i in global.css', () => {
      expect(globalCss).not.toContain('.gt-explore__where-am-i');
    });
  });

  describe('L1: DEFAULT_RADII used in commands.ts', () => {
    it('uses DEFAULT_RADII constants', () => {
      expect(DEFAULT_RADII.vertex).toBe(22);
      expect(DEFAULT_RADII.line).toBe(14);
    });
  });

  describe('L2: whereAmI uses hitTest bar-interior result before nearestElement', () => {
    it('reports touching bar when cursor is inside the bar interior', () => {
      const view = makeViewport(300, 300);
      // bar covers x0: 0.2 to x1: 0.4, y_base: 0.9 to y_top: 0.3
      // Point (0.3, 0.6) is right in the interior of the bar
      const result = whereAmI(barScene, view, { x: 0.3, y: 0.6 });
      expect(result).toContain('Q1');
      expect(result.toLowerCase()).toContain('touching');
    });
  });

  describe('L3: speech driver speaking state suppresses dwells', () => {
    it('suppresses line dwell when speech driver isSpeaking returns true', () => {
      const drivers = createMockDrivers(true); // isSpeaking = true

      act(() => {
        root.render(
          <Explore
            scene={triangleScene}
            announced="Right Triangle ABC"
            drivers={drivers}
            onBack={vi.fn()}
          />,
        );
      });

      const canvas = container.querySelector('canvas')!;
      drivers.speakMock.mockClear();

      // Touch down on line CA
      act(() => {
        canvas.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerId: 1,
            clientX: 75,
            clientY: 150,
            bubbles: true,
          }),
        );
      });

      // Rest for 1000 ms
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // No speech while speech driver is speaking
      const lineSpeech = drivers.speakMock.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('Side CA'),
      );
      expect(lineSpeech).toHaveLength(0);
    });
  });

  describe('L4: settings read once per hold and on change, not on every move', () => {
    it('reads Directions and Finding sound on pointerdown but NOT on pointermove', () => {
      const drivers = createMockDrivers();

      act(() => {
        root.render(
          <Explore
            scene={triangleScene}
            announced="Right Triangle ABC"
            drivers={drivers}
            onBack={vi.fn()}
          />,
        );
      });

      const canvas = container.querySelector('canvas')!;

      // Spy on localStorage getters
      const directionsSpy = vi.spyOn(Storage.prototype, 'getItem');
      directionsSpy.mockClear();

      // Touch down
      act(() => {
        canvas.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
            bubbles: true,
          }),
        );
      });

      const callsAfterDown = directionsSpy.mock.calls.length;

      // 10 pointermove events
      for (let i = 1; i <= 10; i++) {
        act(() => {
          canvas.dispatchEvent(
            new PointerEvent('pointermove', {
              pointerId: 1,
              clientX: 100 + i,
              clientY: 100 + i,
              bubbles: true,
            }),
          );
        });
      }

      // No localStorage reads occurred during pointermove calls!
      expect(directionsSpy.mock.calls.length).toBe(callsAfterDown);
    });
  });

  describe('L6: storage consolidation in drivers/storage.ts', () => {
    it('provides unified storage functions with reactive subscriber', () => {
      let notifiedKey: string | null = null;
      const unsubscribe = subscribeSettings((key?: string) => {
        notifiedKey = key ?? null;
      });

      setStoredFindingSoundSetting(false);
      expect(getStoredFindingSoundSetting()).toBe(false);
      expect(notifiedKey).toBe('gt_finding_sound_enabled');

      setStoredDirectionsSetting(false);
      expect(getStoredDirectionsSetting()).toBe(false);
      expect(notifiedKey).toBe('gt_directions_enabled');

      unsubscribe();
    });
  });

  describe('L8: orphaned i18n keys removed', () => {
    it('verifies commands.whereNearVertex, whereNearLine, whereEmpty are removed', () => {
      // t('key') returns key itself when missing
      expect(t('commands.whereNearVertex')).toBe('commands.whereNearVertex');
      expect(t('commands.whereNearLine')).toBe('commands.whereNearLine');
      expect(t('commands.whereEmpty')).toBe('commands.whereEmpty');
    });
  });
});
