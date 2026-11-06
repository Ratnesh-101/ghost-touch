/**
 * Backend client: `POST /api/v1/ask`.
 *
 * Sends a question about a `DiagramScene` and returns the backend's
 * short answer and its provenance (`source`).
 *
 * Timeout is 12 s (Task 9.2). Errors match the style of `api/scene.ts`.
 */
import type { DiagramScene } from '../core/scene';

export type AskSource = 'ai' | 'facts' | 'unknown';

export type GuideTarget =
  | { kind: 'element'; elementId: string }
  | { kind: 'point'; x: number; y: number };

export interface AskResponse {
  answer: string;
  source: AskSource;
  target?: GuideTarget;
}

/** Server Ask limit is 10 s; allow 12 s client budget (Requirement 7.2). */
export const ASK_TIMEOUT_MS = 12_000;

export type AskFailure = 'timeout' | 'network' | 'http' | 'bad-response' | 'aborted';

export class AskRequestError extends Error {
  constructor(readonly failure: AskFailure) {
    super(failure);
    this.name = 'AskRequestError';
  }
}

export interface AskRequestOptions {
  /** Defaults to `VITE_API_URL`, or same-origin when unset. */
  baseUrl?: string;
  timeoutMs?: number;
  /** Aborting this cancels the request (e.g. on unmount or screen leave). */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Tolerant parser for optional target in Ask response.
 *
 * Maps `{ elementId: string }` -> `{ kind: 'element', elementId }`.
 * Maps `{ x: number, y: number }` with coordinates in [0, 1] -> `{ kind: 'point', x, y }`.
 * Returns undefined for missing or malformed targets; never throws.
 */
export function parseTarget(raw: unknown): GuideTarget | undefined {
  if (!isRecord(raw)) return undefined;

  // 1. Element target
  if (typeof raw['elementId'] === 'string') {
    const elementId = raw['elementId'].trim();
    if (elementId.length > 0) {
      return { kind: 'element', elementId };
    }
    return undefined;
  }

  // 2. Point target (scene coordinates normalized to [0, 1])
  const rawX = raw['x'];
  const rawY = raw['y'];
  if (
    typeof rawX === 'number' &&
    typeof rawY === 'number' &&
    Number.isFinite(rawX) &&
    Number.isFinite(rawY) &&
    rawX >= 0 &&
    rawX <= 1 &&
    rawY >= 0 &&
    rawY <= 1
  ) {
    return { kind: 'point', x: rawX, y: rawY };
  }

  return undefined;
}

/** Shape check for `{ answer: string, source: "ai" | "facts" | "unknown", target?: GuideTarget }`. */
export function parseAskResponse(data: unknown): AskResponse {
  if (!isRecord(data)) throw new AskRequestError('bad-response');
  const answer = data['answer'];
  const source = data['source'];
  if (
    typeof answer !== 'string' ||
    (source !== 'ai' && source !== 'facts' && source !== 'unknown')
  ) {
    throw new AskRequestError('bad-response');
  }
  const target = parseTarget(data['target']);
  return target !== undefined ? { answer, source, target } : { answer, source };
}

function defaultBaseUrl(): string {
  const configured: unknown = import.meta.env['VITE_API_URL'];
  return typeof configured === 'string' ? configured.replace(/\/+$/, '') : '';
}

/** Send one question about the scene. Always rejects with an `AskRequestError`. */
export async function requestAsk(
  scene: DiagramScene,
  question: string,
  lang: string = 'en',
  options: AskRequestOptions = {},
): Promise<AskResponse> {
  const { baseUrl = defaultBaseUrl(), timeoutMs = ASK_TIMEOUT_MS, signal, fetchImpl } = options;
  const doFetch = fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = (): void => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await doFetch(`${baseUrl}/api/v1/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scene,
        question: question.trim(),
        lang,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new AskRequestError('http');
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AskRequestError('bad-response');
    }
    return parseAskResponse(data);
  } catch (error) {
    if (error instanceof AskRequestError) throw error;
    if (timedOut) throw new AskRequestError('timeout');
    if (controller.signal.aborted) throw new AskRequestError('aborted');
    throw new AskRequestError('network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
