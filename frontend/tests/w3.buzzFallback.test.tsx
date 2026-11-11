/**
 * @vitest-environment jsdom
 */

/**
 * Screen & Component tests for W3 Buzz Fallback (Audible buzz + visible pulse when vibration missing)
 *
 * Verifies:
 * - Explore shows the note and speaks it once when fallback is active (supported = false)
 * - Explore does NOT show the note and does NOT speak it when vibration is supported (supported = true)
 * - Visual pulse ring element is rendered with aria-hidden="true" and pointer-events: none
 * - Visual pulse ring renders two rings for corner pattern
 * - Visual pulse ring disappears after 120 ms
 */

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  FallbackHapticDriver,
  MemoryDiagramStore,
  type Drivers,
  type SpeechRateSetting,
} from '../src/drivers';
import { getLang, setLang, t, type Lang } from '../src/i18n';
import { Explore } from '../src/screens/Explore';

const testScene: DiagramScene = {
  kind: 'geometry',
  title: 'Right Triangle',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.8, y: 0.2, label: 'C' },
  ],
  segments: [
    { id: 's1', a: 'A', b: 'B' },
    { id: 's2', a: 'B', b: 'C' },
    { id: 's3', a: 'C', b: 'A' },
  ],
};

function createMockDrivers(supported = false): Drivers {
  const sink = { buzz: vi.fn() };
  const haptics = supported
    ? {
        supported: true,
        lastResult: null,
        vibrate: vi.fn(() => true),
        stop: vi.fn(),
      }
    : new FallbackHapticDriver(sink);

  return {
    haptics,
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      buzz: vi.fn(),
      state: 'running',
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

describe('Explore w3-buzz-fallback UI and speech announcements', () => {
  let prevLang: Lang;
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    setLang(prevLang);
    vi.restoreAllMocks();
  });

  it('renders visible note when vibration is missing (fallback active)', () => {
    const drivers = createMockDrivers(false);
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: testScene,
        announced: 'Right Triangle',
        drivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('gt-explore__no-vibration');
    expect(html).toContain(
      'No vibration on this device. You will hear a buzz instead. Use Chrome on Android to feel it.',
    );
  });

  it('does NOT render note when vibration is supported', () => {
    const drivers = createMockDrivers(true);
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: testScene,
        announced: 'Right Triangle',
        drivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).not.toContain('gt-explore__no-vibration');
    expect(html).not.toContain('No vibration on this device');
  });

  it('speaks the noVibration message once on entry when fallback is active', () => {
    const drivers = createMockDrivers(false);
    root = createRoot(container!);

    act(() => {
      root?.render(
        createElement(Explore, {
          scene: testScene,
          announced: 'Right Triangle',
          drivers,
          onBack: vi.fn(),
        }),
      );
    });

    expect(drivers.speech.speak).toHaveBeenCalledWith(
      t('explore.noVibration'),
      'en-IN',
    );
  });

  it('does NOT speak the noVibration message when vibration is supported', () => {
    const drivers = createMockDrivers(true);
    root = createRoot(container!);

    act(() => {
      root?.render(
        createElement(Explore, {
          scene: testScene,
          announced: 'Right Triangle',
          drivers,
          onBack: vi.fn(),
        }),
      );
    });

    const speakCalls = vi.mocked(drivers.speech.speak).mock.calls;
    const spokenTexts = speakCalls.map((call) => call[0]);
    expect(spokenTexts).not.toContain(t('explore.noVibration'));
  });

  it('renders aria-hidden pulse ring on pulse and two rings on corner pattern', () => {
    vi.useFakeTimers();
    try {
      const drivers = createMockDrivers(false);
      root = createRoot(container!);

      act(() => {
        root?.render(
          createElement(Explore, {
            scene: testScene,
            announced: 'Right Triangle',
            drivers,
            onBack: vi.fn(),
          }),
        );
      });

      const fallbackDriver = drivers.haptics as FallbackHapticDriver;
      expect(typeof fallbackDriver.onPulse).toBe('function');

      // Trigger standard pulse
      act(() => {
        fallbackDriver.onPulse?.('pulse');
      });

      let ringElement = container!.querySelector('[data-testid="explore-pulse-ring"]');
      expect(ringElement).not.toBeNull();
      expect(ringElement?.getAttribute('aria-hidden')).toBe('true');
      expect(ringElement?.getAttribute('style')).toContain('pointer-events: none');
      expect(ringElement?.querySelectorAll('.gt-explore__ring--outer')).toHaveLength(1);
      expect(ringElement?.querySelectorAll('.gt-explore__ring--inner')).toHaveLength(0);

      // Trigger corner pulse (two rings)
      act(() => {
        fallbackDriver.onPulse?.('corner');
      });

      ringElement = container!.querySelector('[data-testid="explore-pulse-ring"]');
      expect(ringElement).not.toBeNull();
      expect(ringElement?.getAttribute('aria-hidden')).toBe('true');
      expect(ringElement?.classList.contains('gt-explore__pulse-ring--corner')).toBe(true);
      expect(ringElement?.querySelectorAll('.gt-explore__ring--outer')).toHaveLength(1);
      expect(ringElement?.querySelectorAll('.gt-explore__ring--inner')).toHaveLength(1);

      // Advances 120 ms: ring element disappears
      act(() => {
        vi.advanceTimersByTime(120);
      });

      ringElement = container!.querySelector('[data-testid="explore-pulse-ring"]');
      expect(ringElement).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
