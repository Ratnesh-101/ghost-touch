/**
 * Backend warm-up client: `GET /api/v1/health`.
 *
 * Cold start on Render's free tier can take ~32 s to answer its first
 * request after idling. Firing a background health check on page load or
 * when an Ask starts wakes the server up early so that user requests succeed.
 *
 * Runs when it has never run or the last attempt is older than 10 minutes,
 * swallows every error, has a 60 s abort timeout, and does not run when offline.
 */
import { defaultBaseUrl } from './scene';

/** Cold start warm-up timeout: 60 seconds. */
export const WARM_TIMEOUT_MS = 60_000;

/** Warm-up cooldown interval: 10 minutes (600,000 ms). */
export const WARM_INTERVAL_MS = 10 * 60 * 1000;

export interface WarmBackendOptions {
  /** Base URL for the health check; defaults to same base URL logic as requestScene. */
  baseUrl?: string;
  /** Timeout in ms before aborting; defaults to 60_000 ms. */
  timeoutMs?: number;
  /** Injected fetch implementation (defaults to globalThis.fetch). */
  fetchImpl?: typeof fetch;
  /** Optional online-check callback; if it returns false, warm-up is skipped. */
  isOnline?: () => boolean;
  /** Injectable clock returning epoch ms (defaults to Date.now). */
  now?: () => number;
  clock?: () => number;
}

let lastWarmAttemptAt: number | null = null;
let activeClock: () => number = () => Date.now();

/** Returns whether the warm-up has already fired during this page load and is still within 10 minutes. */
export function isBackendWarmed(now: () => number = activeClock): boolean {
  if (lastWarmAttemptAt === null) {
    return false;
  }
  const currentTime = now();
  return currentTime >= lastWarmAttemptAt && currentTime - lastWarmAttemptAt < WARM_INTERVAL_MS;
}

/** sessionStorage key: set once the load-time warm-up has fired in this browser session. */
export const WARM_SESSION_KEY = 'gt_warm_session_done';

/** Reset the warm-up guard (for testing only). */
export function resetWarmGuardForTesting(): void {
  lastWarmAttemptAt = null;
  activeClock = () => Date.now();
  try {
    globalThis.sessionStorage?.removeItem(WARM_SESSION_KEY);
  } catch {
    // storage unavailable: nothing to reset
  }
}

/**
 * Load-time warm-up: fires on the first load of a browser session only, so reloads
 * do not wake the backend again. If sessionStorage is unavailable it still fires
 * (the in-memory 10-minute guard in `warmBackend` applies).
 */
export async function warmBackendOncePerSession(options: WarmBackendOptions = {}): Promise<void> {
  try {
    const store = globalThis.sessionStorage;
    if (store) {
      if (store.getItem(WARM_SESSION_KEY) === '1') return;
      store.setItem(WARM_SESSION_KEY, '1');
    }
  } catch {
    // storage blocked: fall through and warm
  }
  await warmBackend(options);
}

/**
 * Fire-and-forget GET request to `{base}/api/v1/health`.
 * Swallows every error (network failure, timeout, non-200 HTTP response).
 * Guards against running when it has run within the last 10 minutes.
 * Returns a promise so callers/tests can await completion.
 */
export async function warmBackend(options: WarmBackendOptions = {}): Promise<void> {
  const clock = options.now ?? options.clock ?? activeClock;
  activeClock = clock;
  const currentTime = clock();

  if (
    lastWarmAttemptAt !== null &&
    currentTime >= lastWarmAttemptAt &&
    currentTime - lastWarmAttemptAt < WARM_INTERVAL_MS
  ) {
    return;
  }

  const isOnlineFn =
    options.isOnline ??
    (() => (typeof navigator !== 'undefined' ? navigator.onLine !== false : true));

  if (!isOnlineFn()) {
    return;
  }

  lastWarmAttemptAt = currentTime;

  const {
    baseUrl = defaultBaseUrl(),
    timeoutMs = WARM_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
  } = options;

  if (typeof fetchImpl !== 'function') {
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    await fetchImpl(`${baseUrl}/api/v1/health`, {
      method: 'GET',
      signal: controller.signal,
    });
  } catch {
    // Swallowing every error (never throws, never logs with console, never speaks)
  } finally {
    clearTimeout(timer);
  }
}
