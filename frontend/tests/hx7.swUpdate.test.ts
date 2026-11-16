// @vitest-environment jsdom
import { act, createElement, type FC } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, type AppProps } from '../src/App';
import {
  createUpdateWatcher,
  RELOADED_STORAGE_KEY,
  type ServiceWorkerContainerLike,
  type StorageLike,
  type UpdateWatcher,
} from '../src/drivers/swUpdate';
import {
  defaultPdfLoader,
  PdfError,
  renderFirstPage,
} from '../src/drivers/pdf';
import {
  captureErrorMessage,
  pdfErrorMessage,
  processImageFile,
} from '../src/flow/capture';
import { setLang, t } from '../src/i18n';

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: 'mock-worker-url',
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs', () => ({
  default: 'mock-worker-url',
}));

const { mockTriangleScene } = vi.hoisted(() => ({
  mockTriangleScene: {
    version: 1 as const,
    kind: 'geometry' as const,
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
    polylines: [],
    bars: [],
    axes: null,
    facts: [
      'angle C = 90 degrees',
      'AC = 4 cm',
      'BC = 3 cm',
      'AB = 5 cm',
    ],
  },
}));

vi.mock('../src/api/scene', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/scene')>();
  return {
    ...actual,
    loadSample: vi.fn().mockImplementation(async () => mockTriangleScene),
  };
});

class MockUtterance {
  text: string;
  lang = '';
  constructor(text: string) {
    this.text = text;
  }
}

describe('LANE hx7: Service Worker Update & Safe Reload', () => {
  beforeEach(() => {
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    vi.stubGlobal('speechSynthesis', {
      speak: vi.fn(),
      cancel: vi.fn(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => mockTriangleScene,
      })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // TEST 1: first controller is ignored
  describe('1. first controller is ignored', () => {
    it('ignores the very first controller of a fresh install (sw.controller initially null)', () => {
      class FakeSWContainer extends EventTarget implements ServiceWorkerContainerLike {
        controller = null;
      }

      const fakeSw = new FakeSWContainer();
      const reload = vi.fn();
      const storage: StorageLike = {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
      };

      const watcher = createUpdateWatcher({ sw: fakeSw, reload, storage });
      const onUpdateListener = vi.fn();
      watcher.onUpdate(onUpdateListener);

      // Fire first controllerchange event (the fresh install activating and claiming clients)
      fakeSw.dispatchEvent(new Event('controllerchange'));
      expect(onUpdateListener).not.toHaveBeenCalled();

      // Fire second controllerchange event (an actual subsequent update)
      fakeSw.dispatchEvent(new Event('controllerchange'));
      expect(onUpdateListener).toHaveBeenCalledTimes(1);
    });

    it('does not ignore controllerchange when a controller was already present on load', () => {
      class FakeSWContainer extends EventTarget implements ServiceWorkerContainerLike {
        controller = { state: 'activated' };
      }

      const fakeSw = new FakeSWContainer();
      const reload = vi.fn();
      const storage: StorageLike = {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
      };

      const watcher = createUpdateWatcher({ sw: fakeSw, reload, storage });
      const onUpdateListener = vi.fn();
      watcher.onUpdate(onUpdateListener);

      // Fire first controllerchange on an already-controlled client (this is an update)
      fakeSw.dispatchEvent(new Event('controllerchange'));
      expect(onUpdateListener).toHaveBeenCalledTimes(1);
    });
  });

  // TEST 2: update on Capture reloads once
  describe('2. update on Capture reloads once', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      vi.useFakeTimers();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => {
        root.unmount();
      });
      container.remove();
      vi.useRealTimers();
    });

    it('speaks updatedReloading and calls reloadOnce after 2.5 s when update arrives on Capture', async () => {
      let updateCallback: (() => void) | null = null;
      const reloadMock = vi.fn();
      const fakeWatcher: UpdateWatcher = {
        onUpdate: (cb) => {
          updateCallback = cb;
          return () => {
            updateCallback = null;
          };
        },
        reloadOnce: reloadMock,
      };

      await act(async () => {
        root.render(createElement<AppProps>(App as FC<AppProps>, { watcher: fakeWatcher }));
      });

      // Initially on Start screen: click to navigate to Capture screen
      const startButton = container.querySelector<HTMLButtonElement>('.gt-start-surface');
      expect(startButton).not.toBeNull();
      await act(async () => {
        startButton?.click();
      });

      // Verify we are on Capture screen
      expect(container.querySelector('.gt-capture')).not.toBeNull();

      // Service worker update arrives
      expect(updateCallback).not.toBeNull();
      await act(async () => {
        updateCallback!();
      });

      // Must not reload immediately
      expect(reloadMock).not.toHaveBeenCalled();

      // Advance by 2.4 s (still waiting)
      await act(async () => {
        vi.advanceTimersByTime(2400);
      });
      expect(reloadMock).not.toHaveBeenCalled();

      // Advance past 2.5 s (total 2500 ms)
      await act(async () => {
        vi.advanceTimersByTime(150);
      });
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(reloadMock).toHaveBeenCalledWith('sw-update');
    });
  });

  // TEST 3: update in Explore does not reload until Capture is shown
  describe('3. update in Explore does not reload until Capture is shown', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      vi.useFakeTimers();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => {
        root.unmount();
      });
      container.remove();
      vi.useRealTimers();
    });

    it('does not reload while exploring, then reloads 2.5 s after user returns to Capture', async () => {
      let updateCallback: (() => void) | null = null;
      const reloadMock = vi.fn();
      const fakeWatcher: UpdateWatcher = {
        onUpdate: (cb) => {
          updateCallback = cb;
          return () => {
            updateCallback = null;
          };
        },
        reloadOnce: reloadMock,
      };

      await act(async () => {
        root.render(createElement<AppProps>(App as FC<AppProps>, { watcher: fakeWatcher }));
      });

      // Navigate to Capture screen
      const startButton = container.querySelector<HTMLButtonElement>('.gt-start-surface');
      await act(async () => {
        startButton?.click();
      });
      expect(container.querySelector('.gt-capture')).not.toBeNull();

      // Open Explore via sample diagram
      const sampleBtn = container.querySelector<HTMLButtonElement>(
        '.gt-capture__sample-btn--triangle',
      );
      expect(sampleBtn).not.toBeNull();
      await act(async () => {
        sampleBtn?.click();
        await Promise.resolve();
      });
      await act(async () => {});

      // Verify we are on Explore screen
      expect(container.querySelector('.gt-explore')).not.toBeNull();

      // Update arrives while user is in Explore!
      expect(updateCallback).not.toBeNull();
      await act(async () => {
        updateCallback!();
      });

      // Advance timers by 5 s, 10 s while on Explore
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      // MUST NEVER reload while user has finger on the screen exploring
      expect(reloadMock).not.toHaveBeenCalled();

      // User presses Back to return to Capture
      const backBtn = container.querySelector<HTMLButtonElement>('.gt-explore__back');
      expect(backBtn).not.toBeNull();
      await act(async () => {
        backBtn?.click();
      });

      // Verify we are back on Capture screen
      expect(container.querySelector('.gt-capture')).not.toBeNull();

      // At 2.0 s after returning, not yet reloaded
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(reloadMock).not.toHaveBeenCalled();

      // At 2.5 s+ after returning, reload is triggered!
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(reloadMock).toHaveBeenCalledWith('sw-update');
    });
  });

  // TEST 4: a second update in the same session does not reload again
  describe('4. a second update in the same session does not reload again', () => {
    it('reloadOnce reloads on the first call, but does not reload again once gt_reloaded is set', () => {
      const store = new Map<string, string>();
      const fakeStorage: StorageLike = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, val) => {
          store.set(key, val);
        },
      };
      const reloadMock = vi.fn();
      const watcher = createUpdateWatcher({
        reload: reloadMock,
        storage: fakeStorage,
        sw: null,
      });

      // First reload: storage key not set -> reloads once and sets key
      const reloaded1 = watcher.reloadOnce('first-update');
      expect(reloaded1).toBe(true);
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(store.get(RELOADED_STORAGE_KEY)).toBe('first-update');

      // Second reload in same session: storage key is set -> does not reload again
      const reloaded2 = watcher.reloadOnce('second-update');
      expect(reloaded2).toBe(false);
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });

  // TEST 5: import failure maps to 'stale'
  describe('5. import failure maps to stale', () => {
    it('defaultPdfLoader throws PdfError with reason "stale" when dynamic import rejects', async () => {
      const failingImport = () =>
        Promise.reject(new TypeError('Failed to fetch dynamically imported module'));

      await expect(defaultPdfLoader(failingImport)).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof PdfError &&
          err.reason === 'stale' &&
          err.name === 'PdfError',
      );
    });

    it('renderFirstPage propagates PdfError with reason "stale"', async () => {
      const failingLoader = () =>
        Promise.reject(new PdfError('stale', 'Chunk load error'));
      const fakeBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

      await expect(renderFirstPage(fakeBlob, 1600, failingLoader)).rejects.toSatisfy(
        (err: unknown) => err instanceof PdfError && err.reason === 'stale',
      );
    });

    it('maps "stale" to t("app.updatedReloading")', () => {
      expect(pdfErrorMessage('stale')).toBe(t('app.updatedReloading'));

      const staleError = new PdfError('stale');
      expect(captureErrorMessage(staleError)).toBe(t('app.updatedReloading'));
    });

    it('processImageFile speaks app.updatedReloading and calls reloadOnce after 2.5 s', async () => {
      vi.useFakeTimers();
      try {
        const audio = {
          unlock: vi.fn(),
          setTone: vi.fn(),
          beep: vi.fn(),
          playEarcon: vi.fn(),
          state: 'running' as const,
        };
        const said: string[] = [];
        const reloadMock = vi.fn();
        const controller = new AbortController();

        const fakePdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
        const outcome = await processImageFile(fakePdf, {
          audio,
          say: (text) => {
            said.push(text);
          },
          renderPdf: () => Promise.reject(new PdfError('stale')),
          signal: controller.signal,
          source: 'file',
          reloadOnce: reloadMock,
        });

        expect(outcome.kind).toBe('failed');
        expect(said).toContain(t('app.updatedReloading'));
        expect(reloadMock).not.toHaveBeenCalled();

        // Advance 2.4 s -> still waiting
        vi.advanceTimersByTime(2400);
        expect(reloadMock).not.toHaveBeenCalled();

        // Advance past 2.5 s -> reloadOnce called
        vi.advanceTimersByTime(150);
        expect(reloadMock).toHaveBeenCalledTimes(1);
        expect(reloadMock).toHaveBeenCalledWith('stale');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // Translations test: en, hi, gu
  describe('i18n: app.updatedReloading translations in en, hi, gu', () => {
    it('provides distinct translations for all three supported languages', () => {
      setLang('en');
      expect(t('app.updatedReloading')).toBe('App updated. Reloading…');

      setLang('hi');
      expect(t('app.updatedReloading')).toBe('ऐप अपडेट हो गया है। पुनः लोड हो रहा है…');

      setLang('gu');
      expect(t('app.updatedReloading')).toBe('એપ અપડેટ થઈ ગઈ છે. ફરી લોડ થઈ રહ્યું છે…');

      setLang('en');
    });
  });
});
