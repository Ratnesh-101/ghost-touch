import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RETRY_AFTER_SECONDS,
  MAX_RETRY_AFTER_SECONDS,
  MIN_RETRY_AFTER_SECONDS,
  SCENE_TIMEOUT_MS,
  SceneRequestError,
  loadSample,
  parseRetryAfter,
  parseSceneResponse,
  requestScene,
} from '../src/api/scene';

const okBody = { scene: { kind: 'geometry', title: 'Triangle' }, mode: 'ai' };

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; headers?: Record<string, string> | Headers } = {},
): Response {
  const headers =
    init.headers instanceof Headers
      ? init.headers
      : new Headers(init.headers);
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** A fetch that never answers but rejects when its signal aborts, like the real one. */
function hangingFetch(): typeof fetch {
  return ((_url: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError')),
      );
    })) as typeof fetch;
}

async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof SceneRequestError ? error.failure : 'other';
  }
  return 'none';
}

describe('requestScene', () => {
  it('posts the image as multipart field "image" to /api/v1/scene', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(okBody));
    const result = await requestScene(new Blob(['x'], { type: 'image/jpeg' }), {
      baseUrl: 'https://api.example',
      fetchImpl,
    });
    expect(result).toEqual({ scene: okBody.scene, mode: 'ai' });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example/api/v1/scene');
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('image')).toBeInstanceOf(Blob);
  });

  it('keeps a raw-mode reason', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...okBody, mode: 'raw', reason: 'timeout' }));
    const result = await requestScene(new Blob(['x']), { baseUrl: '', fetchImpl });
    expect(result.mode).toBe('raw');
    expect(result.reason).toBe('timeout');
  });

  it('fails with "http" on a non-2xx status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));
    expect(await failureOf(requestScene(new Blob(['x']), { baseUrl: '', fetchImpl }))).toBe('http');
  });

  it('fails with "network" when fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await failureOf(requestScene(new Blob(['x']), { baseUrl: '', fetchImpl }))).toBe(
      'network',
    );
  });

  it('fails with "bad-response" on invalid JSON or the wrong shape', async () => {
    const badJson = {
      ok: true,
      json: () => Promise.reject(new SyntaxError('bad json')),
    } as unknown as Response;
    const withBadJson = requestScene(new Blob(['x']), {
      baseUrl: '',
      fetchImpl: vi.fn().mockResolvedValue(badJson),
    });
    expect(await failureOf(withBadJson)).toBe('bad-response');
    const wrongShape = vi.fn().mockResolvedValue(jsonResponse({ scene: {}, mode: 'ai' }));
    expect(
      await failureOf(requestScene(new Blob(['x']), { baseUrl: '', fetchImpl: wrongShape })),
    ).toBe('bad-response');
  });

  it('defines SCENE_TIMEOUT_MS as 45 seconds for cold backend start', () => {
    expect(SCENE_TIMEOUT_MS).toBe(45_000);
  });

  it('times out and aborts the request, leaving no timer behind', async () => {
    vi.useFakeTimers();
    try {
      const pending = failureOf(
        requestScene(new Blob(['x']), {
          baseUrl: '',
          timeoutMs: SCENE_TIMEOUT_MS,
          fetchImpl: hangingFetch(),
        }),
      );
      await vi.advanceTimersByTimeAsync(SCENE_TIMEOUT_MS);
      expect(await pending).toBe('timeout');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts when the caller aborts, and leaves no timer behind', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const pending = failureOf(
        requestScene(new Blob(['x']), {
          baseUrl: '',
          signal: controller.signal,
          fetchImpl: hangingFetch(),
        }),
      );
      controller.abort();
      expect(await pending).toBe('aborted');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries once on HTTP 503 with Retry-After header and succeeds on the second attempt', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({}, { ok: false, status: 503, headers: { 'Retry-After': '2' } }),
        )
        .mockResolvedValueOnce(jsonResponse(okBody));

      const pending = requestScene(new Blob(['x']), { baseUrl: '', fetchImpl });
      await vi.advanceTimersByTimeAsync(1900);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      const result = await pending;
      expect(result).toEqual({ scene: okBody.scene, mode: 'ai' });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries once on HTTP 503 and surfaces "busy" error if second attempt is also 503', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({}, { ok: false, status: 503, headers: { 'Retry-After': '2' } }),
        )
        .mockResolvedValueOnce(
          jsonResponse({}, { ok: false, status: 503, headers: { 'Retry-After': '4' } }),
        );

      const pending = failureOf(requestScene(new Blob(['x']), { baseUrl: '', fetchImpl }));
      await vi.advanceTimersByTimeAsync(2000);
      expect(await pending).toBe('busy');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries once on HTTP 429 with Retry-After header and succeeds', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({}, { ok: false, status: 429, headers: { 'Retry-After': '1' } }),
        )
        .mockResolvedValueOnce(jsonResponse(okBody));

      const pending = requestScene(new Blob(['x']), { baseUrl: '', fetchImpl });
      await vi.advanceTimersByTimeAsync(1000);
      const result = await pending;
      expect(result).toEqual({ scene: okBody.scene, mode: 'ai' });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces "busy" error if second attempt on 429 is also busy', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({}, { ok: false, status: 429, headers: { 'Retry-After': '1' } }),
        )
        .mockResolvedValueOnce(
          jsonResponse({}, { ok: false, status: 429, headers: { 'Retry-After': '1' } }),
        );

      const pending = failureOf(requestScene(new Blob(['x']), { baseUrl: '', fetchImpl }));
      await vi.advanceTimersByTimeAsync(1000);
      expect(await pending).toBe('busy');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses default 3s retry wait when Retry-After is invalid or HTTP-date', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            {},
            {
              ok: false,
              status: 503,
              headers: { 'Retry-After': 'Wed, 21 Oct 2015 07:28:00 GMT' },
            },
          ),
        )
        .mockResolvedValueOnce(jsonResponse(okBody));

      const pending = requestScene(new Blob(['x']), { baseUrl: '', fetchImpl });
      await vi.advanceTimersByTimeAsync(2000);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      const result = await pending;
      expect(result).toEqual({ scene: okBody.scene, mode: 'ai' });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clamps Retry-After values to 1..10 seconds', async () => {
    vi.useFakeTimers();
    try {
      // 0 clamped to 1s
      const fetch0 = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({}, { ok: false, status: 503, headers: { 'Retry-After': '0' } }),
        )
        .mockResolvedValueOnce(jsonResponse(okBody));

      const pending0 = requestScene(new Blob(['x']), { baseUrl: '', fetchImpl: fetch0 });
      await vi.advanceTimersByTimeAsync(1000);
      await pending0;
      expect(fetch0).toHaveBeenCalledTimes(2);

      // 30 clamped to 10s
      const fetch30 = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({}, { ok: false, status: 503, headers: { 'Retry-After': '30' } }),
        )
        .mockResolvedValueOnce(jsonResponse(okBody));

      const pending30 = requestScene(new Blob(['x']), { baseUrl: '', fetchImpl: fetch30 });
      await vi.advanceTimersByTimeAsync(9000);
      expect(fetch30).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      await pending30;
      expect(fetch30).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does NOT retry non-busy HTTP errors (e.g. 500, 400)', async () => {
    const fetch500 = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));
    expect(await failureOf(requestScene(new Blob(['x']), { baseUrl: '', fetchImpl: fetch500 }))).toBe('http');
    expect(fetch500).toHaveBeenCalledTimes(1);

    const fetch404 = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 404 }));
    expect(await failureOf(requestScene(new Blob(['x']), { baseUrl: '', fetchImpl: fetch404 }))).toBe('http');
    expect(fetch404).toHaveBeenCalledTimes(1);
  });

  it('skips retry and surfaces "busy" error if remaining time is too short for the wait', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({}, { ok: false, status: 503, headers: { 'Retry-After': '5' } }),
        );

      const pending = failureOf(
        requestScene(new Blob(['x']), { baseUrl: '', timeoutMs: 2000, fetchImpl }),
      );
      expect(await pending).toBe('busy');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts cleanly during retry wait when caller cancels signal', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({}, { ok: false, status: 503, headers: { 'Retry-After': '5' } }),
        )
        .mockResolvedValueOnce(jsonResponse(okBody));

      const pending = failureOf(
        requestScene(new Blob(['x']), {
          baseUrl: '',
          signal: controller.signal,
          fetchImpl,
        }),
      );
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      controller.abort();
      expect(await pending).toBe('aborted');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('parseRetryAfter', () => {
  it('defaults to 3 seconds for missing, empty, or non-numeric values', () => {
    expect(parseRetryAfter(undefined)).toBe(DEFAULT_RETRY_AFTER_SECONDS);
    expect(parseRetryAfter(null)).toBe(DEFAULT_RETRY_AFTER_SECONDS);
    expect(parseRetryAfter('')).toBe(DEFAULT_RETRY_AFTER_SECONDS);
    expect(parseRetryAfter('   ')).toBe(DEFAULT_RETRY_AFTER_SECONDS);
    expect(parseRetryAfter('invalid')).toBe(DEFAULT_RETRY_AFTER_SECONDS);
    expect(parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT')).toBe(DEFAULT_RETRY_AFTER_SECONDS);
    expect(parseRetryAfter('-5')).toBe(DEFAULT_RETRY_AFTER_SECONDS);
  });

  it('parses valid integer seconds and clamps to 1..10 range', () => {
    expect(parseRetryAfter('5')).toBe(5);
    expect(parseRetryAfter('1')).toBe(1);
    expect(parseRetryAfter('10')).toBe(10);
    expect(parseRetryAfter('0')).toBe(MIN_RETRY_AFTER_SECONDS);
    expect(parseRetryAfter('60')).toBe(MAX_RETRY_AFTER_SECONDS);
  });
});

describe('parseSceneResponse', () => {
  it('rejects non-objects and unknown modes', () => {
    expect(() => parseSceneResponse(null)).toThrow(SceneRequestError);
    expect(() => parseSceneResponse([])).toThrow(SceneRequestError);
    expect(() => parseSceneResponse({ scene: { kind: 'geometry' }, mode: 'maybe' })).toThrow(
      SceneRequestError,
    );
  });
});

describe('loadSample', () => {
  it('reads only the bundled file and returns the scene (no backend call)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ kind: 'geometry', title: 'Triangle' }));
    const scene = await loadSample('triangle', fetchImpl);
    expect(scene.kind).toBe('geometry');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('/samples/triangle.json');
  });

  it('rejects a file that is not a scene', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ nope: true }));
    expect(await failureOf(loadSample('sine', fetchImpl))).toBe('bad-response');
  });

  it('rejects when the file is missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 404 }));
    expect(await failureOf(loadSample('barchart', fetchImpl))).toBe('http');
  });
});
