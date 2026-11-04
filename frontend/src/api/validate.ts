/**
 * Backend client: `POST /api/v1/validate`.
 *
 * Validates a `DiagramScene` against backend schema and invariants.
 * Contract:
 *   Request:  { scene: DiagramScene }
 *   Response: { ok: boolean, scene: DiagramScene | null, errors: string[] }
 *
 * Errors match the style of `api/ask.ts` and `api/scene.ts`.
 */
import type { DiagramScene } from '../core/scene';

export interface ValidateResponse {
  ok: boolean;
  scene: DiagramScene | null;
  errors: string[];
}

/** Default validation timeout: 10 s. */
export const VALIDATE_TIMEOUT_MS = 10_000;

export type ValidateFailure = 'timeout' | 'network' | 'http' | 'bad-response' | 'aborted';

export class ValidateRequestError extends Error {
  constructor(readonly failure: ValidateFailure) {
    super(failure);
    this.name = 'ValidateRequestError';
  }
}

export interface ValidateRequestOptions {
  /** Defaults to `VITE_API_URL`, or same-origin when unset. */
  baseUrl?: string;
  timeoutMs?: number;
  /** Aborting this cancels the request. */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Shape check for `{ ok: boolean, scene: obj | null, errors: string[] }`. */
export function parseValidateResponse(data: unknown): ValidateResponse {
  if (!isRecord(data)) {
    throw new ValidateRequestError('bad-response');
  }

  const ok = data['ok'];
  const errors = data['errors'];
  const scene = data['scene'];

  if (typeof ok !== 'boolean') {
    throw new ValidateRequestError('bad-response');
  }

  if (!Array.isArray(errors) || !errors.every((e) => typeof e === 'string')) {
    throw new ValidateRequestError('bad-response');
  }

  if (scene !== null && scene !== undefined && !isRecord(scene)) {
    throw new ValidateRequestError('bad-response');
  }

  return {
    ok,
    errors,
    scene: (scene as DiagramScene | null) ?? null,
  };
}

function defaultBaseUrl(): string {
  const configured: unknown = import.meta.env?.['VITE_API_URL'];
  return typeof configured === 'string' ? configured.replace(/\/+$/, '') : '';
}

/**
 * Send a scene to be validated by the backend.
 * Always rejects with a `ValidateRequestError`.
 */
export async function requestValidate(
  scene: DiagramScene,
  options: ValidateRequestOptions = {},
): Promise<ValidateResponse> {
  const { baseUrl = defaultBaseUrl(), timeoutMs = VALIDATE_TIMEOUT_MS, signal, fetchImpl } = options;
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
    const response = await doFetch(`${baseUrl}/api/v1/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scene }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ValidateRequestError('http');
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ValidateRequestError('bad-response');
    }

    return parseValidateResponse(data);
  } catch (err: unknown) {
    if (err instanceof ValidateRequestError) throw err;
    if (controller.signal.aborted) {
      if (timedOut) throw new ValidateRequestError('timeout');
      throw new ValidateRequestError('aborted');
    }
    throw new ValidateRequestError('network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
