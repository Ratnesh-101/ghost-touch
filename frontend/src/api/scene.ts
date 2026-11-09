/**
 * Backend client: `POST /api/v1/scene` and the bundled sample diagrams.
 *
 * The sample loader only reads files shipped with the app (`/samples/*.json`),
 * so samples work with no backend and no network (Requirement 2.4).
 * Types come from `core/scene.ts`, which re-exports the generated schema
 * types; no second copy is defined here.
 */
import type { DiagramScene } from '../core/scene';
import { t } from '../i18n';

export type SceneMode = 'ai' | 'raw';

export interface SceneResponse {
  scene: DiagramScene;
  mode: SceneMode;
  reason?: string;
}

export const SAMPLE_IDS = ['triangle', 'sine', 'barchart'] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

/**
 * Cold backend start on Render can take 30 to 60 s; allow 65 s so the first
 * scene request succeeds without timing out (Requirement B4-06).
 */
export const SCENE_TIMEOUT_MS = 65_000;

export const DEFAULT_RETRY_AFTER_SECONDS = 3;
export const MIN_RETRY_AFTER_SECONDS = 1;
export const MAX_RETRY_AFTER_SECONDS = 10;

export type SceneFailure =
  | 'timeout'
  | 'network'
  | 'http'
  | 'bad-response'
  | 'aborted'
  | 'busy'
  | 'gateway';

export class SceneRequestError extends Error {
  constructor(
    readonly failure: SceneFailure,
    readonly retryAfterSeconds?: number,
  ) {
    super(failure);
    this.name = 'SceneRequestError';
  }
}

/**
 * Parse Retry-After header value in seconds.
 * Ignores HTTP-date and invalid values (returning default 3 s).
 * Clamps valid values to 1..10 seconds.
 */
export function parseRetryAfter(headerValue: string | null | undefined): number {
  if (headerValue === null || headerValue === undefined) {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }
  const trimmed = headerValue.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }
  const seconds = Math.round(parseFloat(trimmed));
  if (!Number.isFinite(seconds)) {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }
  return Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(MIN_RETRY_AFTER_SECONDS, seconds));
}

function isBusyStatus(status: number): boolean {
  return status === 503 || status === 429;
}

function isGatewayStatus(status: number): boolean {
  return status === 502 || status === 504;
}

function getHeader(response: Response, name: string): string | null | undefined {
  if (!response.headers) return undefined;
  if (typeof (response.headers as Headers).get === 'function') {
    return (response.headers as Headers).get(name);
  }
  const record = response.headers as unknown as Record<string, string>;
  return record[name] ?? record[name.toLowerCase()] ?? record[name.toUpperCase()];
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export interface SceneRequestOptions {
  /** Defaults to `VITE_API_URL`, or same-origin when unset. */
  baseUrl?: string;
  timeoutMs?: number;
  /** Aborting this (for example on unmount) cancels the request. */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Spoken / status notification callback during retry (e.g. server waking up). */
  onRetry?: (message: string) => void;
  say?: (message: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asScene(value: unknown): DiagramScene | undefined {
  return isRecord(value) && typeof value['kind'] === 'string'
    ? (value as unknown as DiagramScene)
    : undefined;
}

/** Shape check only; the backend has already validated against the schema. */
export function parseSceneResponse(data: unknown): SceneResponse {
  if (!isRecord(data)) throw new SceneRequestError('bad-response');
  const scene = asScene(data['scene']);
  const mode = data['mode'];
  if (scene === undefined || (mode !== 'ai' && mode !== 'raw')) {
    throw new SceneRequestError('bad-response');
  }
  const reason = data['reason'];
  return typeof reason === 'string' ? { scene, mode, reason } : { scene, mode };
}

export function defaultBaseUrl(): string {
  const configured: unknown = import.meta.env['VITE_API_URL'];
  return typeof configured === 'string' ? configured.replace(/\/+$/, '') : '';
}

/** Upload one image and return the scene. Always rejects with a `SceneRequestError`. */
export async function requestScene(
  image: Blob,
  options: SceneRequestOptions = {},
): Promise<SceneResponse> {
  const { baseUrl = defaultBaseUrl(), timeoutMs = SCENE_TIMEOUT_MS, signal, fetchImpl } = options;
  const doFetch = fetchImpl ?? fetch;
  const controller = new AbortController();
  const startTime = Date.now();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = (): void => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  const createBody = (): FormData => {
    const body = new FormData();
    body.append('image', image, 'diagram.jpg');
    return body;
  };

  try {
    let response = await doFetch(`${baseUrl}/api/v1/scene`, {
      method: 'POST',
      body: createBody(),
      signal: controller.signal,
    });

    const isGateway = isGatewayStatus(response.status);
    const isBusy = isBusyStatus(response.status);

    if (isGateway || isBusy) {
      if (isGateway) {
        const announce = options.onRetry ?? options.say;
        announce?.(t('capture.wakingUp'));
      }

      const retryAfterSec = parseRetryAfter(getHeader(response, 'retry-after'));
      const waitMs = retryAfterSec * 1000;
      const elapsedMs = Date.now() - startTime;
      const remainingMs = timeoutMs - elapsedMs;

      if (remainingMs <= waitMs || controller.signal.aborted) {
        if (isGateway) throw new SceneRequestError('gateway');
        throw new SceneRequestError('busy', retryAfterSec);
      }

      await sleep(waitMs, controller.signal);

      response = await doFetch(`${baseUrl}/api/v1/scene`, {
        method: 'POST',
        body: createBody(),
        signal: controller.signal,
      });

      if (isGatewayStatus(response.status)) {
        throw new SceneRequestError('gateway');
      }

      if (isBusyStatus(response.status)) {
        const secondRetryAfter = parseRetryAfter(getHeader(response, 'retry-after'));
        throw new SceneRequestError('busy', secondRetryAfter);
      }
    }

    if (!response.ok) {
      if (isGatewayStatus(response.status)) {
        throw new SceneRequestError('gateway');
      }
      throw new SceneRequestError('http');
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new SceneRequestError('bad-response');
    }
    return parseSceneResponse(data);
  } catch (error) {
    if (error instanceof SceneRequestError) throw error;
    if (timedOut) throw new SceneRequestError('timeout');
    if (controller.signal.aborted) throw new SceneRequestError('aborted');
    throw new SceneRequestError('network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Load a bundled sample. No backend involved. */
export async function loadSample(
  id: SampleId,
  fetchImpl: typeof fetch = fetch,
): Promise<DiagramScene> {
  const response = await fetchImpl(`/samples/${id}.json`);
  if (!response.ok) throw new SceneRequestError('http');
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new SceneRequestError('bad-response');
  }
  const scene = asScene(data);
  if (scene === undefined) throw new SceneRequestError('bad-response');
  return scene;
}
