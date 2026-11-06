/**
 * Backend warm-up client: `GET /api/v1/health`.
 *
 * Cold start on Render's free tier can take ~32 s to answer its first
 * request after idling. Firing a background health check on page load wakes
 * the server up early so that the user's first photo upload succeeds.
 *
 * Runs once per page load (module-level guard), swallows every error,
 * has a 60 s abort timeout, and does not run when offline.
 */
import { defaultBaseUrl } from './scene';

/** Cold start warm-up timeout: 60 seconds. */
export const WARM_TIMEOUT_MS = 60_000;

export interface WarmBackendOptions {
  /** Base URL for the health check; defaults to same base URL logic as requestScene. */
  baseUrl?: string;
  /** Timeout in ms before aborting; defaults to 60_000 ms. */
  timeoutMs?: number;
  /** Injected fetch implementation (defaults to globalThis.fetch). */
  fetchImpl?: typeof fetch;
  /** Optional online-check callback; if it returns false, warm-up is skipped. */
  isOnline?: () => boolean;
}

let warmed = false;

/** Returns whether the warm-up has already fired during this page load. */
export function isBackendWarmed(): boolean {
  return warmed;
}

/** Reset the warm-up guard (for testing only). */
export function resetWarmGuardForTesting(): void {
  warmed = false;
}

/**
 * Fire-and-forget GET request to `{base}/api/v1/health`.
 * Swallows every error (network failure, timeout, non-200 HTTP response).
 * Guards against running more than once per page load.
 * Returns a promise so callers/tests can await completion.
 */
export async function warmBackend(options: WarmBackendOptions = {}): Promise<void> {
  if (warmed) {
    return;
  }

  if (options.isOnline && !options.isOnline()) {
    return;
  }

  warmed = true;

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
