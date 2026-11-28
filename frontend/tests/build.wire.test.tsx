// @vitest-environment jsdom
/**
 * Wire tests for Ghost Hand Build navigation & App wiring (Requirement 52.9, 52.18, Task 86).
 *
 * Verifies:
 * - Pure navigation formula: leaveByBack('build', ctx) stays on build in Feel mode without confirmation,
 *   otherwise navigates to capture, confirming only when buildDirty is true.
 * - Spoken keys resolve non-empty in en, hi, gu.
 * - Integration with App:
 *   - Start -> Capture -> Make my own graph -> Build screen
 *   - Pin points and verify buildDirty flag triggers confirmation on Back
 *   - Cancel confirmation keeps Build; accept confirmation navigates to Capture
 *   - Feel mode triggers onFeelChange, and Back from Feel mode returns to form without confirmation
 */
import { act, createElement, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: 'pdf.worker.min.mjs',
}));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
}));

import { App } from '../src/App';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { leaveByBack, SCREEN_NAMES, type BackContext, type ScreenName } from '../src/flow/navigation';
import { getLang, setLang, t } from '../src/i18n';
import { setupRigEnv, teardownRigEnv } from './support/exploreRig';

function createMockDrivers(): {
  drivers: Drivers;
  speak: ReturnType<typeof vi.fn>;
  vibrate: ReturnType<typeof vi.fn>;
} {
  const speak = vi.fn();
  const vibrate = vi.fn(() => true);
  const drivers = {
    haptics: { supported: true, lastResult: null, vibrate, stop: vi.fn() },
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
      listen: vi.fn(() => new Promise<string>(() => {})),
      stopSpeaking: vi.fn(),
      cancelListen: vi.fn(),
      isSpeaking: vi.fn(() => false),
      getRate: () => 'normal',
      canSpeak: true,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  } as unknown as Drivers;
  return { drivers, speak, vibrate };
}

function setSliderValue(input: HTMLInputElement, value: number): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('LANE hi13: Build Navigation Formula (Requirement 52.9)', () => {
  it('includes "build" in SCREEN_NAMES', () => {
    expect((SCREEN_NAMES as readonly string[]).includes('build')).toBe(true);
  });

  it('stays on build without confirmation when buildFeel is true', () => {
    const ctx: BackContext = { dirty: false, fromShare: false, buildFeel: true, buildDirty: true };
    const step = leaveByBack('build', ctx);
    expect(step).toEqual({
      next: 'build',
      announceKey: 'build.backToForm',
      needsConfirm: false,
    });
  });

  it('goes to capture with confirmation when buildFeel is false and buildDirty is true', () => {
    const ctx: BackContext = { dirty: false, fromShare: false, buildFeel: false, buildDirty: true };
    const step = leaveByBack('build', ctx);
    expect(step).toEqual({
      next: 'capture',
      announceKey: 'host.capture.next',
      needsConfirm: true,
    });
  });

  it('goes to capture without confirmation when buildFeel is false and buildDirty is false', () => {
    const ctx: BackContext = { dirty: false, fromShare: false, buildFeel: false, buildDirty: false };
    const step = leaveByBack('build', ctx);
    expect(step).toEqual({
      next: 'capture',
      announceKey: 'host.capture.next',
      needsConfirm: false,
    });
  });

  it('satisfies the property for all flag combinations', () => {
    fc.assert(
      fc.property(
        fc.record({
          dirty: fc.boolean(),
          correctDirty: fc.boolean(),
          fromShare: fc.boolean(),
          buildDirty: fc.boolean(),
          buildFeel: fc.boolean(),
        }),
        (flags) => {
          const step = leaveByBack('build' as ScreenName, flags as BackContext);
          if (flags.buildFeel) {
            expect(step).toEqual({
              next: 'build',
              announceKey: 'build.backToForm',
              needsConfirm: false,
            });
          } else {
            expect(step).toEqual({
              next: 'capture',
              announceKey: 'host.capture.next',
              needsConfirm: flags.buildDirty,
            });
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('every announcement key resolves to non-empty text in en, hi, and gu', () => {
    const keys = ['build.backToForm', 'capture.prompt', 'build.leaveConfirm', 'build.prompt', 'build.open'];
    const origLang = getLang();
    try {
      for (const lang of ['en', 'hi', 'gu'] as const) {
        setLang(lang);
        for (const key of keys) {
          const text = t(key);
          expect(text.trim().length, `${key} in ${lang}`).toBeGreaterThan(0);
          expect(text, `${key} in ${lang}`).not.toBe(key);
        }
      }
    } finally {
      setLang(origLang);
    }
  });
});

describe('LANE hi13: App Screen Wiring for Build (Requirement 52.9, 52.18)', () => {
  let container: HTMLDivElement;
  let reactRoot: ReturnType<typeof createRoot>;
  let mockDrivers: ReturnType<typeof createMockDrivers>;
  let origConfirm: typeof window.confirm;

  beforeEach(() => {
    setupRigEnv();
    origConfirm = window.confirm;
    container = document.createElement('div');
    document.body.appendChild(container);
    reactRoot = createRoot(container);
    mockDrivers = createMockDrivers();
  });

  afterEach(() => {
    window.confirm = origConfirm;
    act(() => {
      reactRoot.unmount();
    });
    container.remove();
    teardownRigEnv();
  });

  it('navigates from Start -> Capture -> Build -> Back confirming dirty pins', async () => {
    await act(async () => {
      reactRoot.render(createElement(App as unknown as ComponentType<{ drivers: unknown }>, { drivers: mockDrivers.drivers }));
    });

    // 1. Start screen
    const startBtn = container.querySelector<HTMLButtonElement>('.gt-start-surface');
    expect(startBtn).not.toBeNull();
    act(() => {
      startBtn?.click();
    });

    // 2. Capture screen: "Make my own graph" button
    const openBuildBtn = container.querySelector<HTMLButtonElement>('.gt-capture__button--build');
    expect(openBuildBtn).not.toBeNull();
    expect(openBuildBtn?.getAttribute('aria-label')).toBe(t('build.open'));

    // 3. Click "Make my own graph"
    act(() => {
      openBuildBtn?.click();
    });

    // Verify Build screen rendered
    const buildRoot = container.querySelector<HTMLElement>('[data-testid="build-root"]');
    expect(buildRoot).not.toBeNull();
    expect(buildRoot?.getAttribute('data-mode')).toBe('form');
    expect(buildRoot?.getAttribute('data-pins')).toBe('0');

    // Verify build.prompt spoken
    expect(mockDrivers.speak).toHaveBeenCalledWith(
      expect.stringContaining(t('build.prompt')),
      expect.any(String),
    );

    // 4. Locate sliders and pin a point
    const sliders = container.querySelectorAll<HTMLInputElement>('input[type="range"]');
    expect(sliders).toHaveLength(2);
    const [xSlider, ySlider] = [sliders[0]!, sliders[1]!];
    expect(xSlider.getAttribute('aria-valuetext')).toBe('x 0');
    expect(ySlider.getAttribute('aria-valuetext')).toBe('y 0');

    setSliderValue(xSlider, 1);
    setSliderValue(ySlider, 1);
    expect(xSlider.getAttribute('aria-valuetext')).toBe('x 1');
    expect(ySlider.getAttribute('aria-valuetext')).toBe('y 1');

    const pinBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === t('build.pin'),
    );
    expect(pinBtn).not.toBeUndefined();
    act(() => {
      pinBtn?.click();
    });

    // Pins should now be 1 (buildDirty is true)
    expect(buildRoot?.getAttribute('data-pins')).toBe('1');

    // 5. Back from form with pins: test cancel first
    const backBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === t('common.back'),
    );
    expect(backBtn).not.toBeUndefined();

    const confirmSpy = vi.fn(() => false);
    window.confirm = confirmSpy;

    act(() => {
      backBtn?.click();
    });

    expect(confirmSpy).toHaveBeenCalledWith(t('build.leaveConfirm'));
    // User cancelled: still on Build screen
    expect(container.querySelector('[data-testid="build-root"]')).not.toBeNull();

    // 6. Back from form with pins: accept confirm
    confirmSpy.mockReturnValue(true);
    act(() => {
      backBtn?.click();
    });

    // Returned to Capture screen
    expect(container.querySelector('[data-testid="build-root"]')).toBeNull();
    expect(container.querySelector('.gt-capture')).not.toBeNull();
    expect(mockDrivers.speak).toHaveBeenCalledWith(t('host.capture.next'), expect.any(String));
  });

  it('Feel mode Back returns to form and speaks build.backToForm without confirmation', async () => {
    await act(async () => {
      reactRoot.render(createElement(App as unknown as ComponentType<{ drivers: unknown }>, { drivers: mockDrivers.drivers }));
    });

    // Start -> Capture -> Build
    const startBtn = container.querySelector<HTMLButtonElement>('.gt-start-surface');
    act(() => startBtn?.click());

    const openBuildBtn = container.querySelector<HTMLButtonElement>('.gt-capture__button--build');
    act(() => openBuildBtn?.click());

    const buildRoot = container.querySelector<HTMLElement>('[data-testid="build-root"]');
    expect(buildRoot).not.toBeNull();

    // Pin a point
    const pinBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === t('build.pin'),
    );
    act(() => pinBtn?.click());
    expect(buildRoot?.getAttribute('data-pins')).toBe('1');

    // Enter Feel mode
    const feelBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === t('build.feel'),
    );
    expect(feelBtn).not.toBeUndefined();
    act(() => feelBtn?.click());

    expect(buildRoot?.getAttribute('data-mode')).toBe('feel');

    // Explore is mounted. Find Explore's Back button
    const exploreBackBtn = container.querySelector<HTMLButtonElement>('.gt-explore__back');
    expect(exploreBackBtn).not.toBeNull();

    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;

    act(() => {
      exploreBackBtn?.click();
    });

    // Mode returns to form without confirmation
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(buildRoot?.getAttribute('data-mode')).toBe('form');
    expect(buildRoot?.getAttribute('data-pins')).toBe('1');
    expect(mockDrivers.speak).toHaveBeenCalledWith(t('build.backToForm'), expect.any(String));
  });
});
