import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WARM_TIMEOUT_MS,
  isBackendWarmed,
  resetWarmGuardForTesting,
  warmBackend,
} from '../src/api/health';
import { SCENE_TIMEOUT_MS } from '../src/api/scene';

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

describe('warmBackend', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', '');
    resetWarmGuardForTesting();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('calls GET /api/v1/health using default base URL (same-origin)', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    await warmBackend({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/health');
    expect(init.method).toBe('GET');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(isBackendWarmed()).toBe(true);
  });

  it('uses VITE_API_URL from environment when baseUrl option is omitted (stripping trailing slashes)', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test/');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    await warmBackend({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.test/api/v1/health');
    expect(init.method).toBe('GET');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(isBackendWarmed()).toBe(true);
  });

  it('uses the configured base URL when provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    await warmBackend({ baseUrl: 'https://backend.example.com', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://backend.example.com/api/v1/health');
  });

  it('prefers explicit baseUrl option over VITE_API_URL environment variable', async () => {
    vi.stubEnv('VITE_API_URL', 'https://env.example.test');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    await warmBackend({ baseUrl: 'https://backend.example.com', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://backend.example.com/api/v1/health');
  });

  it('calls the health URL exactly once even if invoked twice', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    // Invoke twice concurrently
    await Promise.all([warmBackend({ fetchImpl }), warmBackend({ fetchImpl })]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Invoke again sequentially
    await warmBackend({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('swallows network errors without throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Network failure'));
    await expect(warmBackend({ fetchImpl })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('swallows non-200 HTTP responses without throwing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'fail' }, { ok: false, status: 500 }));
    await expect(warmBackend({ fetchImpl })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not run when isOnline returns false', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    await warmBackend({ isOnline: () => false, fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(isBackendWarmed()).toBe(false);

    // When connection is back online, it should run
    await warmBackend({ isOnline: () => true, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(isBackendWarmed()).toBe(true);
  });

  it('times out and aborts after 60 seconds, leaving no timer behind', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = hangingFetch();
      const pending = warmBackend({ fetchImpl });

      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(WARM_TIMEOUT_MS);
      await pending;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('exports WARM_TIMEOUT_MS as 60 seconds', () => {
    expect(WARM_TIMEOUT_MS).toBe(60_000);
  });

  it('verifies SCENE_TIMEOUT_MS is 45 seconds', () => {
    expect(SCENE_TIMEOUT_MS).toBe(45_000);
  });
});
