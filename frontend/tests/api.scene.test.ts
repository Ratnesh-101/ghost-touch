import { describe, expect, it, vi } from 'vitest';
import {
  SceneRequestError,
  loadSample,
  parseSceneResponse,
  requestScene,
} from '../src/api/scene';

const okBody = { scene: { kind: 'geometry', title: 'Triangle' }, mode: 'ai' };

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
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

  it('times out and aborts the request, leaving no timer behind', async () => {
    vi.useFakeTimers();
    try {
      const pending = failureOf(
        requestScene(new Blob(['x']), {
          baseUrl: '',
          timeoutMs: 20_000,
          fetchImpl: hangingFetch(),
        }),
      );
      await vi.advanceTimersByTimeAsync(20_000);
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
