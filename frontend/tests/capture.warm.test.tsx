// @vitest-environment jsdom
/**
 * Capture screen & scene API cold-start and warm-up tests (Lane ux5).
 *
 * Requirements:
 * - Mount warms once: calls warmBackend() on Capture mount (without awaiting).
 * - Pick warms: selecting/taking a photo triggers warmBackend().
 * - Timeout then success yields a scene and one 'waking' announcement.
 * - Timeout twice yields the existing timeout error.
 * - Sample path makes zero fetch calls.
 * - Jitter: 0 to 30 percent random jitter added to Retry-After wait.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetWarmGuardForTesting } from '../src/api/health';
import {
  computeRetryWaitMs,
  loadSample,
  requestScene,
  SceneRequestError,
} from '../src/api/scene';
import { Capture } from '../src/screens/Capture';
import { processImageFile } from '../src/flow/capture';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { getLang, setLang, t, type Lang } from '../src/i18n';

vi.mock('../src/drivers/pdf', () => {
  class MockPdfError extends Error {
    readonly reason: string;
    constructor(reason: string, message?: string) {
      super(message ?? `PDF error: ${reason}`);
      this.name = 'PdfError';
      this.reason = reason;
    }
  }
  return {
    PdfError: MockPdfError,
    defaultPdfLoader: vi.fn(),
    renderFirstPage: vi.fn(),
  };
});

function createMockDrivers(): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running' as const,
    },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn(() => 'normal' as const),
      setRate: vi.fn(),
    },
    diagramStore: new MemoryDiagramStore(),
  };
}

describe('Capture warm-up and cold-start resilience (Lane ux5)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    resetWarmGuardForTesting();
    originalFetch = globalThis.fetch;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
    globalThis.fetch = originalFetch;
    resetWarmGuardForTesting();
    vi.restoreAllMocks();
  });

  it('mount warms once: mounting Capture screen calls health endpoint once without awaiting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;

    const drivers = createMockDrivers();

    await act(async () => {
      root!.render(
        createElement(Capture, {
          drivers,
          initialStatus: 'Take a photo.',
          onScene: vi.fn(),
        }),
      );
    });

    // Capture mount fires warmBackend() exactly once
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/api\/v1\/health$/);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('pick warms: selecting a photo triggers warmBackend', async () => {
    const okScene = {
      kind: 'geometry' as const,
      title: 'Triangle',
      points: [],
      segments: [],
      polylines: [],
      bars: [],
    };
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/health')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ scene: okScene, mode: 'ai' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock;

    const drivers = createMockDrivers();

    await act(async () => {
      root!.render(
        createElement(Capture, {
          drivers,
          initialStatus: 'Take a photo.',
          onScene: vi.fn(),
        }),
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Reset warm guard to permit the next warm check on photo pick
    resetWarmGuardForTesting();

    const photoInput = container!.querySelector(
      'input[capture="environment"]',
    ) as HTMLInputElement;
    expect(photoInput).not.toBeNull();

    const fakeFile = new File(['fake photo content'], 'sample.jpg', {
      type: 'image/jpeg',
    });
    Object.defineProperty(photoInput, 'files', {
      value: [fakeFile],
      configurable: true,
    });

    await act(async () => {
      photoInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Photo selection triggered warmBackend()
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(/\/api\/v1\/health$/);
  });

  it('timeout then success yields a scene and one waking announcement', async () => {
    vi.useFakeTimers();
    try {
      const okScene = {
        kind: 'geometry' as const,
        title: 'Right Triangle',
        points: [],
        segments: [],
        polylines: [],
        bars: [],
      };

      let attempt = 0;
      const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        attempt++;
        if (attempt === 1) {
          // Attempt 1 hangs until aborted by timeout
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        }
        // Attempt 2 succeeds
        return Promise.resolve(
          new Response(JSON.stringify({ scene: okScene, mode: 'ai' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const announcements: string[] = [];
      const onRetry = vi.fn((msg: string) => {
        announcements.push(msg);
      });

      const pending = requestScene(new Blob(['test'], { type: 'image/jpeg' }), {
        baseUrl: 'https://api.test',
        firstAttemptTimeoutMs: 1000,
        timeoutMs: 3000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        onRetry,
      });

      // Advance through first attempt timeout (1000 ms)
      await vi.advanceTimersByTimeAsync(1000);

      // Attempt 2 completes
      const result = await pending;

      expect(result.scene.title).toBe('Right Triangle');
      expect(result.mode).toBe('ai');
      // Exactly one 'waking' announcement
      expect(announcements).toHaveLength(1);
      expect(announcements[0]).toBe(t('capture.waking'));
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('timeout twice yields the existing timeout error', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        // Both attempts hang until aborted
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });

      const announcements: string[] = [];
      const onRetry = vi.fn((msg: string) => {
        announcements.push(msg);
      });

      let caughtError: unknown = null;
      const pending = requestScene(new Blob(['test'], { type: 'image/jpeg' }), {
        baseUrl: 'https://api.test',
        firstAttemptTimeoutMs: 1000,
        timeoutMs: 2000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        onRetry,
      }).catch((err: unknown) => {
        caughtError = err;
      });

      // Advance through first attempt (1000 ms)
      await vi.advanceTimersByTimeAsync(1000);
      expect(announcements).toEqual([t('capture.waking')]);

      // Advance through second attempt (1000 ms)
      await vi.advanceTimersByTimeAsync(1000);
      await pending;

      expect(caughtError).toBeInstanceOf(SceneRequestError);
      expect((caughtError as SceneRequestError).failure).toBe('timeout');
      // No second waking announcement
      expect(announcements).toEqual([t('capture.waking')]);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('processImageFile flow: timeout then success speaks waking and returns scene', async () => {
    vi.useFakeTimers();
    try {
      const okScene = {
        kind: 'geometry' as const,
        title: 'Right Triangle',
        points: [],
        segments: [],
        polylines: [],
        bars: [],
      };

      let attempt = 0;
      const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        attempt++;
        if (attempt === 1) {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify({ scene: okScene, mode: 'ai' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const audio = {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        state: 'running' as const,
      };
      const said: string[] = [];
      const controller = new AbortController();

      const outcomePromise = processImageFile(
        new Blob(['fake image content'], { type: 'image/jpeg' }) as Blob & {
          type: string;
          size: number;
        },
        {
          audio,
          say: (text: string) => void said.push(text),
          request: (image, signal) =>
            requestScene(image, {
              signal,
              onRetry: (msg) => void said.push(msg),
              firstAttemptTimeoutMs: 1000,
              timeoutMs: 3000,
              fetchImpl: fetchImpl as unknown as typeof fetch,
            }),
          signal: controller.signal,
          source: 'file',
          prepare: (file) => Promise.resolve(file),
        },
      );

      // Advance through first attempt timeout (1000 ms)
      await vi.advanceTimersByTimeAsync(1000);

      const outcome = await outcomePromise;
      expect(outcome.kind).toBe('scene');
      expect(said).toContain(t('capture.waking'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('processImageFile flow: timeout twice speaks waking then timeout error', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });

      const audio = {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        state: 'running' as const,
      };
      const said: string[] = [];
      const controller = new AbortController();

      const outcomePromise = processImageFile(
        new Blob(['fake image content'], { type: 'image/jpeg' }) as Blob & {
          type: string;
          size: number;
        },
        {
          audio,
          say: (text: string) => void said.push(text),
          request: (image, signal) =>
            requestScene(image, {
              signal,
              onRetry: (msg) => void said.push(msg),
              firstAttemptTimeoutMs: 1000,
              timeoutMs: 2000,
              fetchImpl: fetchImpl as unknown as typeof fetch,
            }),
          signal: controller.signal,
          source: 'file',
          prepare: (file) => Promise.resolve(file),
        },
      );

      // Advance through first attempt (1000 ms) and second attempt (1000 ms)
      await vi.advanceTimersByTimeAsync(1000);
      expect(said).toContain(t('capture.waking'));

      await vi.advanceTimersByTimeAsync(1000);
      const outcome = await outcomePromise;

      expect(outcome.kind).toBe('failed');
      expect(said).toContain(t('capture.waking'));
      expect(said).toContain(t('capture.errorTimeout'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('sample path makes zero calls: picking a sample does not make any fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    globalThis.fetch = fetchMock;

    const onScene = vi.fn();
    const drivers = createMockDrivers();

    await act(async () => {
      root!.render(
        createElement(Capture, {
          drivers,
          initialStatus: 'Take a photo.',
          onScene,
        }),
      );
    });

    // Clear mount health call history to isolate sample picking
    fetchMock.mockClear();

    const sampleTriangleBtn = container!.querySelector(
      '.gt-capture__sample-btn--triangle',
    ) as HTMLButtonElement;
    expect(sampleTriangleBtn).not.toBeNull();

    await act(async () => {
      sampleTriangleBtn.click();
    });

    // onScene received the bundled sample diagram
    expect(onScene).toHaveBeenCalledTimes(1);
    expect(onScene.mock.calls[0]?.[0]?.kind).toBe('geometry');
    expect(onScene.mock.calls[0]?.[3]).toBe('sample');

    // Sample path makes zero calls to fetch!
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('direct loadSample without fetchImpl makes zero network calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock;

    const triangle = await loadSample('triangle');
    const sine = await loadSample('sine');
    const barchart = await loadSample('barchart');

    expect(triangle.kind).toBe('geometry');
    expect(sine.kind).toBe('function_graph');
    expect(barchart.kind).toBe('bar_chart');

    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('adds 0 to 30 percent random jitter to Retry-After wait', () => {
    // 0% jitter
    expect(computeRetryWaitMs(2, 0)).toBe(2000);
    // 15% jitter
    expect(computeRetryWaitMs(2, 0.15)).toBe(2300);
    // 30% jitter
    expect(computeRetryWaitMs(2, 0.30)).toBe(2600);
    // Clamped at 30% maximum
    expect(computeRetryWaitMs(2, 0.50)).toBe(2600);
    // Injected random function
    expect(computeRetryWaitMs(3, undefined, () => 0.5)).toBe(3450); // 3000 * (1 + 0.15)
  });

  it('defines capture.waking key in en, hi, and gu', () => {
    const prevLang: Lang = getLang();
    try {
      setLang('en');
      expect(t('capture.waking')).toBe('The server is waking up. One moment.');

      setLang('hi');
      expect(t('capture.waking')).toBe('सर्वर चालू हो रहा है। एक क्षण।');

      setLang('gu');
      expect(t('capture.waking')).toBe('સર્વર શરૂ થઈ રહ્યું છે. એક ક્ષણ.');
    } finally {
      setLang(prevLang);
    }
  });
});
