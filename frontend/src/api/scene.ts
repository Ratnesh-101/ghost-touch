/**
 * Backend client: `POST /api/v1/scene` and the bundled sample diagrams.
 *
 * The sample loader only reads files shipped with the app (`/samples/*.json`),
 * so samples work with no backend and no network (Requirement 2.4).
 * Types come from `core/scene.ts`, which re-exports the generated schema
 * types; no second copy is defined here.
 */
import type { DiagramScene } from '../core/scene';

export type SceneMode = 'ai' | 'raw';

export interface SceneResponse {
  scene: DiagramScene;
  mode: SceneMode;
  reason?: string;
}

export const SAMPLE_IDS = ['triangle', 'sine', 'barchart'] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

/**
 * Cold backend start on Render can take ~32 s; allow 45 s so the first
 * scene request succeeds without timing out.
 */
export const SCENE_TIMEOUT_MS = 45_000;

export type SceneFailure = 'timeout' | 'network' | 'http' | 'bad-response' | 'aborted';

export class SceneRequestError extends Error {
  constructor(readonly failure: SceneFailure) {
    super(failure);
    this.name = 'SceneRequestError';
  }
}

export interface SceneRequestOptions {
  /** Defaults to `VITE_API_URL`, or same-origin when unset. */
  baseUrl?: string;
  timeoutMs?: number;
  /** Aborting this (for example on unmount) cancels the request. */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
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
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = (): void => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const body = new FormData();
    body.append('image', image, 'diagram.jpg');
    const response = await doFetch(`${baseUrl}/api/v1/scene`, {
      method: 'POST',
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new SceneRequestError('http');
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
