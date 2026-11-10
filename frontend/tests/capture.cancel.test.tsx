// @vitest-environment jsdom
import { vi } from 'vitest';

vi.mock('../src/drivers/pdf', () => ({
  defaultPdfLoader: vi.fn(),
  renderFirstPage: vi.fn(),
  PdfError: class PdfError extends Error {
    readonly reason: string;
    constructor(reason: string, message?: string) {
      super(message ?? `PDF error: ${reason}`);
      this.name = 'PdfError';
      this.reason = reason;
    }
  },
}));

/**
 * Regression tests for Lane y1-w3-fixes-a:
 * Camera dialog dismissal / camera permission denial cancellation handling in Capture.tsx.
 *
 * Verifies:
 * - Cancelling the camera input speaks t('capture.cancelled') and displays it in status.
 * - The cancel path speaks EXACTLY ONCE even if both cancel and empty change events fire.
 * - Focus is restored to the "Take photo" button after cancellation.
 * - Localized speech in Hindi and Gujarati.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { getLang, setLang, t, type Lang } from '../src/i18n';
import { Capture } from '../src/screens/Capture';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let container: HTMLDivElement;
let testRoot: Root;

function createMockDrivers(overrides?: Partial<Drivers>): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'locked',
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
    ...overrides,
  };
}

describe('Capture cancel path (Lane y1-w3-fixes-a)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    testRoot = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      testRoot.unmount();
    });
    container.remove();
    setLang(prevLang);
    vi.restoreAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  it('speaks and displays calm next-step message when camera input fires cancel', () => {
    const drivers = createMockDrivers();
    const onScene = vi.fn();

    act(() => {
      testRoot.render(
        createElement(Capture, {
          drivers,
          initialStatus: t('capture.prompt'),
          onScene,
        }),
      );
    });

    const photoInput = container.querySelector(
      'input[type="file"][capture="environment"]',
    ) as HTMLInputElement | null;
    expect(photoInput).not.toBeNull();

    act(() => {
      photoInput!.dispatchEvent(new Event('cancel', { bubbles: true }));
    });

    expect(drivers.speech.speak).toHaveBeenCalledTimes(1);
    expect(drivers.speech.speak).toHaveBeenCalledWith(
      'No photo was taken. Choose Take photo, Choose image, or a sample.',
      'en-IN',
    );

    const statusEl = container.querySelector('.gt-capture__status');
    expect(statusEl?.textContent).toBe(
      'No photo was taken. Choose Take photo, Choose image, or a sample.',
    );
  });

  it('speaks exactly once when both cancel and empty change events fire in quick succession', () => {
    const drivers = createMockDrivers();
    const onScene = vi.fn();

    act(() => {
      testRoot.render(
        createElement(Capture, {
          drivers,
          initialStatus: t('capture.prompt'),
          onScene,
        }),
      );
    });

    const photoInput = container.querySelector(
      'input[type="file"][capture="environment"]',
    ) as HTMLInputElement | null;
    expect(photoInput).not.toBeNull();

    act(() => {
      // Browser fires cancel event on dismissal
      photoInput!.dispatchEvent(new Event('cancel', { bubbles: true }));
      // And in some engines also an empty change event
      photoInput!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(drivers.speech.speak).toHaveBeenCalledTimes(1);
    expect(drivers.speech.speak).toHaveBeenCalledWith(t('capture.cancelled'), 'en-IN');
  });

  it('speaks exactly once when file picker is cancelled', () => {
    const drivers = createMockDrivers();
    const onScene = vi.fn();

    act(() => {
      testRoot.render(
        createElement(Capture, {
          drivers,
          initialStatus: t('capture.prompt'),
          onScene,
        }),
      );
    });

    const fileInputs = container.querySelectorAll('input[type="file"]');
    const filePicker = fileInputs[1] as HTMLInputElement | undefined;
    expect(filePicker).toBeDefined();

    act(() => {
      filePicker!.dispatchEvent(new Event('cancel', { bubbles: true }));
    });

    expect(drivers.speech.speak).toHaveBeenCalledTimes(1);
    expect(drivers.speech.speak).toHaveBeenCalledWith(t('capture.cancelled'), 'en-IN');
  });

  it('speaks localized cancel message in Hindi', () => {
    setLang('hi');
    const drivers = createMockDrivers();
    const onScene = vi.fn();

    act(() => {
      testRoot.render(
        createElement(Capture, {
          drivers,
          initialStatus: t('capture.prompt'),
          onScene,
        }),
      );
    });

    const photoInput = container.querySelector(
      'input[type="file"][capture="environment"]',
    ) as HTMLInputElement | null;
    expect(photoInput).not.toBeNull();

    act(() => {
      photoInput!.dispatchEvent(new Event('cancel', { bubbles: true }));
    });

    expect(drivers.speech.speak).toHaveBeenCalledTimes(1);
    expect(drivers.speech.speak).toHaveBeenCalledWith(
      'कोई फोटो नहीं ली गई। फोटो लें, छवि चुनें, या कोई नमूना चुनें।',
      'hi-IN',
    );
  });

  it('speaks localized cancel message in Gujarati', () => {
    setLang('gu');
    const drivers = createMockDrivers();
    const onScene = vi.fn();

    act(() => {
      testRoot.render(
        createElement(Capture, {
          drivers,
          initialStatus: t('capture.prompt'),
          onScene,
        }),
      );
    });

    const photoInput = container.querySelector(
      'input[type="file"][capture="environment"]',
    ) as HTMLInputElement | null;
    expect(photoInput).not.toBeNull();

    act(() => {
      photoInput!.dispatchEvent(new Event('cancel', { bubbles: true }));
    });

    expect(drivers.speech.speak).toHaveBeenCalledTimes(1);
    expect(drivers.speech.speak).toHaveBeenCalledWith(
      'કોઈ ફોટો લેવામાં આવ્યો નથી. ફોટો લો, ઇમેજ પસંદ કરો, અથવા નમૂનો પસંદ કરો.',
      'gu-IN',
    );
  });

  it('refocuses the Take photo button on cancel', () => {
    const drivers = createMockDrivers();
    const onScene = vi.fn();

    act(() => {
      testRoot.render(
        createElement(Capture, {
          drivers,
          initialStatus: t('capture.prompt'),
          onScene,
        }),
      );
    });

    const takeButton = container.querySelector(
      '.gt-capture__button--primary',
    ) as HTMLButtonElement | null;
    expect(takeButton).not.toBeNull();

    const photoInput = container.querySelector(
      'input[type="file"][capture="environment"]',
    ) as HTMLInputElement | null;
    expect(photoInput).not.toBeNull();

    act(() => {
      photoInput!.dispatchEvent(new Event('cancel', { bubbles: true }));
    });

    expect(document.activeElement).toBe(takeButton);
  });
});
