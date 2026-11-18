/**
 * Backend client: `POST /api/v1/scene` and the bundled sample diagrams.
 *
 * The sample loader only reads files shipped with the app (`/samples/*.json`),
 * so samples work with no backend and no network (Requirement 2.4).
 * Types come from `core/scene.ts`, which re-exports the generated schema
 * types; no second copy is defined here.
 */
import type { DiagramScene } from '../core/scene';
import { isRenderableScene } from '../core/sceneGuard';
import { t } from '../i18n';

export type SceneMode = 'ai' | 'raw';

export interface SceneResponse {
  scene: DiagramScene;
  mode: SceneMode;
  reason?: string;
}

export const SAMPLE_IDS = ['triangle', 'sine', 'barchart'] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

export const SAMPLE_TRIANGLE: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle ABC',
  points: [
    { id: 'A', x: 0.25, y: 0.25, label: 'A' },
    { id: 'B', x: 0.7, y: 0.85, label: 'B' },
    { id: 'C', x: 0.25, y: 0.85, label: 'C' },
  ],
  segments: [
    { id: 'CA', a: 'C', b: 'A', label: 'CA' },
    { id: 'AB', a: 'A', b: 'B', label: 'AB' },
    { id: 'BC', a: 'B', b: 'C', label: 'BC' },
  ],
  polylines: [],
  bars: [],
  axes: null,
  facts: [
    'angle C = 90 degrees',
    'AC = 4 cm',
    'BC = 3 cm',
    'AB = 5 cm',
  ],
  aspect: 1.0,
};

export const SAMPLE_BARCHART: DiagramScene = {
  version: 1,
  kind: 'bar_chart',
  title: 'Sales by quarter',
  points: [],
  segments: [],
  polylines: [],
  bars: [
    { id: 'q1', x0: 0.12, x1: 0.27, y_top: 0.69, y_base: 0.85, label: 'Q1', value: 10.0 },
    { id: 'q2', x0: 0.32, x1: 0.47, y_top: 0.44, y_base: 0.85, label: 'Q2', value: 25.0 },
    { id: 'q3', x0: 0.52, x1: 0.67, y_top: 0.56, y_base: 0.85, label: 'Q3', value: 18.0 },
    { id: 'q4', x0: 0.72, x1: 0.87, y_top: 0.33, y_base: 0.85, label: 'Q4', value: 32.0 },
  ],
  axes: {
    x_axis_y: 0.85,
    y_axis_x: 0.1,
  },
  facts: [
    'values are in thousands of units',
    'Q4 was the highest quarter',
    'Q1 was the lowest quarter',
  ],
  aspect: 1.0,
};

export const SAMPLE_SINE: DiagramScene = {
  version: 1,
  kind: 'function_graph',
  title: 'y = sin(x)',
  points: [],
  segments: [],
  polylines: [
    {
      id: 'sine_curve',
      points: [
        [0.1, 0.5], [0.1081, 0.481], [0.1162, 0.462], [0.1242, 0.4432], [0.1323, 0.4247],
        [0.1404, 0.4064], [0.1485, 0.3885], [0.1566, 0.3711], [0.1646, 0.3541], [0.1727, 0.3378],
        [0.1808, 0.3221], [0.1889, 0.3072], [0.197, 0.293], [0.2051, 0.2796], [0.2131, 0.2672],
        [0.2212, 0.2556], [0.2293, 0.2451], [0.2374, 0.2356], [0.2455, 0.2271], [0.2535, 0.2198],
        [0.2616, 0.2135], [0.2697, 0.2085], [0.2778, 0.2046], [0.2859, 0.2018], [0.2939, 0.2003],
        [0.302, 0.2], [0.3101, 0.2009], [0.3182, 0.2031], [0.3263, 0.2064], [0.3343, 0.2108],
        [0.3424, 0.2165], [0.3505, 0.2233], [0.3586, 0.2312], [0.3667, 0.2402], [0.3747, 0.2502],
        [0.3828, 0.2613], [0.3909, 0.2733], [0.399, 0.2862], [0.4071, 0.3], [0.4152, 0.3146],
        [0.4232, 0.3299], [0.4313, 0.3459], [0.4394, 0.3625], [0.4475, 0.3797], [0.4556, 0.3974],
        [0.4636, 0.4155], [0.4717, 0.4339], [0.4798, 0.4526], [0.4879, 0.4715], [0.496, 0.4905],
        [0.504, 0.5095], [0.5121, 0.5285], [0.5202, 0.5474], [0.5283, 0.5661], [0.5364, 0.5845],
        [0.5444, 0.6026], [0.5525, 0.6203], [0.5606, 0.6375], [0.5687, 0.6541], [0.5768, 0.6701],
        [0.5848, 0.6854], [0.5929, 0.7], [0.601, 0.7138], [0.6091, 0.7267], [0.6172, 0.7387],
        [0.6253, 0.7498], [0.6333, 0.7598], [0.6414, 0.7688], [0.6495, 0.7767], [0.6576, 0.7835],
        [0.6657, 0.7892], [0.6737, 0.7936], [0.6818, 0.7969], [0.6899, 0.7991], [0.698, 0.8],
        [0.7061, 0.7997], [0.7141, 0.7982], [0.7222, 0.7954], [0.7303, 0.7915], [0.7384, 0.7865],
        [0.7465, 0.7802], [0.7545, 0.7729], [0.7626, 0.7644], [0.7707, 0.7549], [0.7788, 0.7444],
        [0.7869, 0.7328], [0.7949, 0.7204], [0.803, 0.707], [0.8111, 0.6928], [0.8192, 0.6779],
        [0.8273, 0.6622], [0.8354, 0.6459], [0.8434, 0.6289], [0.8515, 0.6115], [0.8596, 0.5936],
        [0.8677, 0.5753], [0.8758, 0.5568], [0.8838, 0.538], [0.8919, 0.519], [0.9, 0.5],
      ],
      label: 'sin(x)',
    },
  ],
  bars: [],
  axes: {
    x_axis_y: 0.5,
    y_axis_x: 0.08,
  },
  facts: [
    'amplitude = 1',
    'period = 2 pi',
    'one full period is shown',
  ],
  aspect: 1.0,
};

export const BUNDLED_SAMPLES: Record<SampleId, DiagramScene> = {
  triangle: SAMPLE_TRIANGLE,
  sine: SAMPLE_SINE,
  barchart: SAMPLE_BARCHART,
};

/**
 * Cold backend start on Render can take 30 to 60 s; allow 65 s so the first
 * scene request succeeds without timing out (Requirement B4-06).
 */
export const SCENE_TIMEOUT_MS = 65_000;

/** Total wait budget across timeout retries (120 s). */
export const SCENE_TOTAL_TIMEOUT_MS = 120_000;

/** First attempt timeout budget before waking retry (60 s). */
export const SCENE_FIRST_ATTEMPT_TIMEOUT_MS = 60_000;

export const DEFAULT_RETRY_AFTER_SECONDS = 3;
export const MIN_RETRY_AFTER_SECONDS = 1;
export const MAX_RETRY_AFTER_SECONDS = 10;

/**
 * Compute retry wait time in ms with 0 to 30 percent random jitter.
 */
export function computeRetryWaitMs(
  retryAfterSec: number,
  jitter?: number | boolean,
  random: () => number = Math.random,
): number {
  const baseMs = retryAfterSec * 1000;
  if (jitter === false) return baseMs;
  let ratio: number;
  if (typeof jitter === 'number') {
    ratio = jitter;
  } else {
    ratio = random() * 0.3;
  }
  const clampedRatio = Math.max(0, Math.min(0.3, ratio));
  return Math.round(baseMs * (1 + clampedRatio));
}

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
  return status === 502;
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
  firstAttemptTimeoutMs?: number;
  /** Aborting this (for example on unmount) cancels the request. */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Spoken / status notification callback during retry (e.g. server waking up). */
  onRetry?: (message: string) => void;
  say?: (message: string) => void;
  /** Fixed jitter ratio (0..0.3) or boolean flag. */
  jitter?: number | boolean;
  /** Injectable random generator for jitter testing. */
  random?: () => number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asScene(value: unknown): DiagramScene | undefined {
  return isRenderableScene(value) ? value : undefined;
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
  const {
    baseUrl = defaultBaseUrl(),
    timeoutMs,
    firstAttemptTimeoutMs: customFirstTimeout,
    signal,
    fetchImpl,
    jitter,
    random,
  } = options;
  const doFetch = fetchImpl ?? fetch;

  const totalTimeoutMs = Math.min(
    SCENE_TOTAL_TIMEOUT_MS,
    timeoutMs ?? SCENE_TOTAL_TIMEOUT_MS,
  );

  const firstAttemptTimeoutMs =
    customFirstTimeout ??
    (totalTimeoutMs <= 60_000
      ? Math.max(1, Math.floor(totalTimeoutMs / 2))
      : SCENE_FIRST_ATTEMPT_TIMEOUT_MS);

  const startTime = Date.now();

  const createBody = (): FormData => {
    const body = new FormData();
    body.append('image', image, 'diagram.jpg');
    return body;
  };

  const announce = options.onRetry ?? options.say;

  const runAttempt = async (
    attemptTimeoutMs: number,
  ): Promise<
    | { kind: 'response'; response: Response }
    | { kind: 'timeout' }
    | { kind: 'aborted' }
    | { kind: 'network'; error: unknown }
  > => {
    if (signal?.aborted) return { kind: 'aborted' };
    const attemptController = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      attemptController.abort();
    }, attemptTimeoutMs);

    const onExternalAbort = (): void => attemptController.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });

    try {
      const response = await doFetch(`${baseUrl}/api/v1/scene`, {
        method: 'POST',
        body: createBody(),
        signal: attemptController.signal,
      });
      return { kind: 'response', response };
    } catch (err: unknown) {
      if (signal?.aborted) return { kind: 'aborted' };
      if (timedOut) return { kind: 'timeout' };
      return { kind: 'network', error: err };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  };

  let attemptResult = await runAttempt(firstAttemptTimeoutMs);

  if (attemptResult.kind === 'aborted') {
    throw new SceneRequestError('aborted');
  }

  if (attemptResult.kind === 'timeout') {
    announce?.(t('capture.waking'));

    const elapsed = Date.now() - startTime;
    const remainingMs = totalTimeoutMs - elapsed;

    if (remainingMs <= 0 || signal?.aborted) {
      if (signal?.aborted) throw new SceneRequestError('aborted');
      throw new SceneRequestError('timeout');
    }

    attemptResult = await runAttempt(remainingMs);

    if (attemptResult.kind === 'aborted') {
      throw new SceneRequestError('aborted');
    }
    if (attemptResult.kind === 'timeout') {
      throw new SceneRequestError('timeout');
    }
  }

  if (attemptResult.kind === 'network') {
    throw new SceneRequestError('network');
  }

  let response = attemptResult.response;

  const isGateway = isGatewayStatus(response.status);
  const isBusy = isBusyStatus(response.status);

  if (isGateway || isBusy) {
    if (isGateway) {
      announce?.(t('capture.wakingUp'));
    }

    const retryAfterSec = parseRetryAfter(getHeader(response, 'retry-after'));
    const useJitter =
      jitter ??
      (random !== undefined || options.onRetry !== undefined || options.say !== undefined);
    const waitMs = useJitter
      ? computeRetryWaitMs(
          retryAfterSec,
          typeof jitter === 'number' ? jitter : undefined,
          random,
        )
      : retryAfterSec * 1000;

    const elapsedMs = Date.now() - startTime;
    const remainingMs = totalTimeoutMs - elapsedMs;

    if (remainingMs <= waitMs || signal?.aborted) {
      if (signal?.aborted) throw new SceneRequestError('aborted');
      if (isGateway) throw new SceneRequestError('gateway');
      throw new SceneRequestError('busy', retryAfterSec);
    }

    try {
      await sleep(waitMs, signal ?? new AbortController().signal);
    } catch {
      if (signal?.aborted) throw new SceneRequestError('aborted');
      throw new SceneRequestError('network');
    }

    const retryElapsedMs = Date.now() - startTime;
    const retryRemainingMs = totalTimeoutMs - retryElapsedMs;

    if (retryRemainingMs <= 0 || signal?.aborted) {
      if (signal?.aborted) throw new SceneRequestError('aborted');
      if (isGateway) throw new SceneRequestError('gateway');
      throw new SceneRequestError('busy', retryAfterSec);
    }

    const retryAttempt = await runAttempt(retryRemainingMs);
    if (retryAttempt.kind === 'aborted') throw new SceneRequestError('aborted');
    if (retryAttempt.kind === 'timeout') throw new SceneRequestError('timeout');
    if (retryAttempt.kind === 'network') throw new SceneRequestError('network');

    response = retryAttempt.response;

    if (response.status === 504) {
      throw new SceneRequestError('timeout');
    }
    if (isGatewayStatus(response.status)) {
      throw new SceneRequestError('gateway');
    }
    if (isBusyStatus(response.status)) {
      const secondRetryAfter = parseRetryAfter(getHeader(response, 'retry-after'));
      throw new SceneRequestError('busy', secondRetryAfter);
    }
  }

  if (!response.ok) {
    if (response.status === 504) {
      throw new SceneRequestError('timeout');
    }
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
}

/** Load a bundled sample. No backend involved. When fetchImpl is omitted, returns directly from bundled data with zero network calls. */
export async function loadSample(
  id: SampleId,
  fetchImpl?: typeof fetch,
): Promise<DiagramScene> {
  if (fetchImpl) {
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
  const sample = BUNDLED_SAMPLES[id];
  if (sample) return sample;
  throw new SceneRequestError('bad-response');
}
