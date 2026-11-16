import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ASK_TIMEOUT_MS,
  AskRequestError,
  requestAsk,
} from '../src/api/ask';
import {
  WARM_INTERVAL_MS,
  isBackendWarmed,
  resetWarmGuardForTesting,
  warmBackend,
} from '../src/api/health';
import {
  AskManager,
  ASK_TOTAL_BUDGET_MS,
  type AskDeps,
} from '../src/flow/ask';
import type { DiagramScene } from '../src/core/scene';
import type { AudioDriver, SpeechDriver } from '../src/drivers';
import { t } from '../src/i18n';

const sampleScene: DiagramScene = {
  kind: 'geometry',
  title: 'Triangle ABC',
  facts: ['AB = 3 cm', 'BC = 4 cm', 'AC = 5 cm'],
};

/** A fetch implementation that never resolves on its own, but rejects on signal abort. */
function hangingFetch(): typeof fetch {
  return ((_url: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    })) as typeof fetch;
}

function createMockDeps(overrides: Partial<AskDeps> = {}): AskDeps {
  const audio: AudioDriver = {
    beep: vi.fn(),
    setTone: vi.fn(),
    unlock: vi.fn(),
    playEarcon: vi.fn(),
    state: 'running',
  };
  const speech: SpeechDriver = {
    speak: vi.fn(),
    listen: vi.fn(async () => 'How long is AC?'),
    cancelListen: vi.fn(),
    stopSpeaking: vi.fn(),
    canSpeak: true,
    canListen: true,
  };

  return {
    audio,
    speech,
    scene: sampleScene,
    lang: 'en-IN',
    say: vi.fn(),
    onStatusChange: vi.fn(),
    onFallbackNeeded: vi.fn(),
    ...overrides,
  };
}

describe('Lane hx5: api/health.ts timestamp warm-up guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetWarmGuardForTesting();
    vi.stubEnv('VITE_API_URL', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('exports WARM_INTERVAL_MS as 10 minutes (600_000 ms)', () => {
    expect(WARM_INTERVAL_MS).toBe(10 * 60 * 1000);
  });

  it('runs warmBackend when it has never run and updates isBackendWarmed', async () => {
    expect(isBackendWarmed()).toBe(false);

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await warmBackend({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(isBackendWarmed()).toBe(true);
  });

  it('throttles warmBackend within 10 minutes and runs again after 10 minutes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    // Initial run
    await warmBackend({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(isBackendWarmed()).toBe(true);

    // Immediate rerun is suppressed
    await warmBackend({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Advance 9 minutes (540 s): still within 10-minute cooldown
    await vi.advanceTimersByTimeAsync(9 * 60 * 1000);
    expect(isBackendWarmed()).toBe(true);
    await warmBackend({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Advance past 10 minutes (total 10 min 1 s): now older than 10 minutes
    await vi.advanceTimersByTimeAsync(61 * 1000);
    expect(isBackendWarmed()).toBe(false);

    // Runs again!
    await warmBackend({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(isBackendWarmed()).toBe(true);
  });

  it('supports an injectable clock option', async () => {
    let now = 1_000_000;
    const clock = () => now;
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await warmBackend({ fetchImpl, now: clock });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(isBackendWarmed(clock)).toBe(true);

    // Advance clock by 5 minutes: suppressed
    now += 5 * 60 * 1000;
    await warmBackend({ fetchImpl, now: clock });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Advance clock past 10 minutes (10m + 1ms): runs again
    now += 5 * 60 * 1000 + 1;
    expect(isBackendWarmed(clock)).toBe(false);
    await warmBackend({ fetchImpl, now: clock });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('resetWarmGuardForTesting clears the guard', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await warmBackend({ fetchImpl });
    expect(isBackendWarmed()).toBe(true);

    resetWarmGuardForTesting();
    expect(isBackendWarmed()).toBe(false);

    await warmBackend({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not run warmBackend when offline and leaves backend unwarmed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await warmBackend({ fetchImpl, isOnline: () => false });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(isBackendWarmed()).toBe(false);
  });
});

describe('Lane hx5: api/ask.ts 17s timeout and busy failure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports ASK_TIMEOUT_MS as 17000 ms', () => {
    expect(ASK_TIMEOUT_MS).toBe(17_000);
  });

  it('throws AskRequestError("busy", retryAfterSeconds) on 503 with Retry-After', async () => {
    const fakeFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: 'Busy' }), {
        status: 503,
        headers: { 'Retry-After': '5' },
      });
    });

    let caughtError: unknown;
    try {
      await requestAsk(sampleScene, 'What is AC?', 'en', {
        baseUrl: 'https://api.example.com',
        fetchImpl: fakeFetch,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AskRequestError);
    const askErr = caughtError as AskRequestError;
    expect(askErr.failure).toBe('busy');
    expect(askErr.retryAfterSeconds).toBe(5);
  });

  it('throws AskRequestError("busy", retryAfterSeconds) on 429 with Retry-After', async () => {
    const fakeFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: 'Rate limit' }), {
        status: 429,
        headers: { 'Retry-After': '2' },
      });
    });

    let caughtError: unknown;
    try {
      await requestAsk(sampleScene, 'What is AC?', 'en', {
        baseUrl: 'https://api.example.com',
        fetchImpl: fakeFetch,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AskRequestError);
    const askErr = caughtError as AskRequestError;
    expect(askErr.failure).toBe('busy');
    expect(askErr.retryAfterSeconds).toBe(2);
  });

  it('defaults retryAfterSeconds to 3 when Retry-After is absent or invalid', async () => {
    const fakeFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: 'Busy' }), {
        status: 503,
      });
    });

    let caughtError: unknown;
    try {
      await requestAsk(sampleScene, 'What is AC?', 'en', {
        baseUrl: 'https://api.example.com',
        fetchImpl: fakeFetch,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AskRequestError);
    const askErr = caughtError as AskRequestError;
    expect(askErr.failure).toBe('busy');
    expect(askErr.retryAfterSeconds).toBe(3);
  });
});

describe('Lane hx5: Ask resilience tests (required suite)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetWarmGuardForTesting();
    vi.stubEnv('VITE_API_URL', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('timeout then success speaks wakingUp once and returns the answer', async () => {
    let askCallCount = 0;
    const fakeFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/health')) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      askCallCount++;
      if (askCallCount === 1) {
        return hangingFetch()(input, init);
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ answer: 'AC is 5 cm.', source: 'facts' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });

    const spoken: string[] = [];
    const deps = createMockDeps({
      fetchImpl: fakeFetch,
      say: (text: string) => spoken.push(text),
    });

    const manager = new AskManager();
    const promise = manager.submitTextAsk('What is AC?', deps);

    // Advance 17 seconds to trigger the first request timeout
    await vi.advanceTimersByTimeAsync(ASK_TIMEOUT_MS);

    const outcome = await promise;

    expect(outcome).toEqual({
      kind: 'success',
      answer: 'AC is 5 cm.',
      source: 'facts',
      target: undefined,
    });
    expect(askCallCount).toBe(2);
    // speaks wakingUp once
    expect(spoken).toContain(t('ask.wakingUp'));
    expect(spoken.filter((s) => s === t('ask.wakingUp')).length).toBe(1);
    // returns and speaks answer
    expect(spoken[spoken.length - 1]).toBe('AC is 5 cm.');
  });

  it('two timeouts give the normal error', async () => {
    let askCallCount = 0;
    const fakeFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/health')) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      askCallCount++;
      return hangingFetch()(input, init);
    });

    const spoken: string[] = [];
    let fallbackNeeded = false;
    const deps = createMockDeps({
      fetchImpl: fakeFetch,
      say: (text: string) => spoken.push(text),
      onFallbackNeeded: () => {
        fallbackNeeded = true;
      },
    });

    const manager = new AskManager();
    const promise = manager.submitTextAsk('What is AC?', deps);

    // 1st request timeout
    await vi.advanceTimersByTimeAsync(ASK_TIMEOUT_MS);
    expect(spoken).toContain(t('ask.wakingUp'));
    expect(askCallCount).toBe(2);

    // 2nd request timeout
    await vi.advanceTimersByTimeAsync(ASK_TIMEOUT_MS);

    const outcome = await promise;

    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.message).toBe(t('ask.errorTimeout'));
    }
    expect(fallbackNeeded).toBe(true);
    expect(spoken.filter((s) => s === t('ask.wakingUp')).length).toBe(1);
    expect(spoken[spoken.length - 1]).toBe(t('ask.errorTimeout'));
    expect(deps.audio.playEarcon).toHaveBeenCalledWith('error');
  });

  it('503 with Retry-After: 2 waits 2 s then retries', async () => {
    let askCallCount = 0;
    const fakeFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/health')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      askCallCount++;
      if (askCallCount === 1) {
        return new Response(JSON.stringify({ detail: 'Service Unavailable' }), {
          status: 503,
          headers: { 'Retry-After': '2' },
        });
      }
      return new Response(
        JSON.stringify({ answer: 'AC is 5 cm.', source: 'facts' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const spoken: string[] = [];
    const deps = createMockDeps({
      fetchImpl: fakeFetch,
      say: (text: string) => spoken.push(text),
    });

    const manager = new AskManager();
    const promise = manager.submitTextAsk('What is AC?', deps);

    // Advance 1 second: 503 received, still in 2-second retry wait
    await vi.advanceTimersByTimeAsync(1_000);
    expect(askCallCount).toBe(1);

    // Advance another 1 second (total 2 seconds): wait completes and retry fires
    await vi.advanceTimersByTimeAsync(1_000);
    expect(askCallCount).toBe(2);

    const outcome = await promise;

    expect(outcome).toEqual({
      kind: 'success',
      answer: 'AC is 5 cm.',
      source: 'facts',
      target: undefined,
    });
    // On 503 busy, wakingUp is not spoken
    expect(spoken).not.toContain(t('ask.wakingUp'));
    expect(spoken[spoken.length - 1]).toBe('AC is 5 cm.');
  });

  it('abort during the wait resolves as cancelled with no further speech', async () => {
    const fakeFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/health')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ detail: 'Service Unavailable' }), {
        status: 503,
        headers: { 'Retry-After': '2' },
      });
    });

    const spoken: string[] = [];
    const deps = createMockDeps({
      fetchImpl: fakeFetch,
      say: (text: string) => spoken.push(text),
    });

    const manager = new AskManager();
    const promise = manager.submitTextAsk('What is AC?', deps);

    // Advance 500 ms so 503 is processed and the wait timer is running
    await vi.advanceTimersByTimeAsync(500);
    expect(manager.isBusy()).toBe(true);

    // Abort during the wait
    manager.abort();

    const outcome = await promise;

    expect(outcome).toEqual({ kind: 'cancelled' });
    // No error spoken, no speech beyond the initial thinking cue
    expect(spoken).toEqual([t('ask.thinking')]);
    expect(deps.audio.playEarcon).not.toHaveBeenCalledWith('error');
    expect(manager.isBusy()).toBe(false);
  });

  it('offline does not retry', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    let askCallCount = 0;
    const fakeFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/health')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      askCallCount++;
      throw new TypeError('Failed to fetch');
    });

    const spoken: string[] = [];
    let fallbackNeeded = false;
    const deps = createMockDeps({
      fetchImpl: fakeFetch,
      say: (text: string) => spoken.push(text),
      onFallbackNeeded: () => {
        fallbackNeeded = true;
      },
    });

    const manager = new AskManager();
    const outcome = await manager.submitTextAsk('What is AC?', deps);

    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.message).toBe(t('ask.errorOffline'));
    }
    // Only 1 attempt made when offline
    expect(askCallCount).toBe(1);
    expect(spoken).not.toContain(t('ask.wakingUp'));
    expect(spoken).toContain(t('ask.errorOffline'));
    expect(fallbackNeeded).toBe(true);
  });

  it('voice ask also retries on timeout, speaks wakingUp once, and succeeds', async () => {
    let askCallCount = 0;
    const fakeFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/health')) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      askCallCount++;
      if (askCallCount === 1) {
        return hangingFetch()(input, init);
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ answer: 'AC is 5 cm.', source: 'facts' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });

    const spoken: string[] = [];
    const deps = createMockDeps({
      fetchImpl: fakeFetch,
      say: (text: string) => spoken.push(text),
    });

    const manager = new AskManager();
    const promise = manager.startVoiceAsk(deps);

    // Flush speech.listen
    await vi.advanceTimersByTimeAsync(0);

    // Timeout first request
    await vi.advanceTimersByTimeAsync(ASK_TIMEOUT_MS);

    const outcome = await promise;

    expect(outcome.kind).toBe('success');
    expect(askCallCount).toBe(2);
    expect(spoken.filter((s) => s === t('ask.wakingUp')).length).toBe(1);
    expect(spoken[spoken.length - 1]).toBe('AC is 5 cm.');
  });

  it('calls warmBackend when an Ask starts (fire and forget)', async () => {
    let healthCalled = false;
    const fakeFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/health')) {
        healthCalled = true;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ answer: 'AC is 5 cm.', source: 'facts' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const deps = createMockDeps({
      fetchImpl: fakeFetch,
    });

    const manager = new AskManager();
    await manager.submitTextAsk('What is AC?', deps);

    expect(healthCalled).toBe(true);
    expect(isBackendWarmed()).toBe(true);
  });

  it('enforces total budget of 45 seconds', async () => {
    expect(ASK_TOTAL_BUDGET_MS).toBe(45_000);

    const fakeFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/health')) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      return hangingFetch()(input, init);
    });

    const spoken: string[] = [];
    const deps = createMockDeps({
      fetchImpl: fakeFetch,
      say: (text: string) => spoken.push(text),
    });

    const manager = new AskManager();
    const promise = manager.submitTextAsk('What is AC?', deps);

    // Advance 45 s to exceed budget
    await vi.advanceTimersByTimeAsync(ASK_TOTAL_BUDGET_MS);

    const outcome = await promise;
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.message).toBe(t('ask.errorTimeout'));
    }
  });
});
