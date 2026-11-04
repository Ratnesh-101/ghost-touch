/**
 * Audio element driver — browser HTMLAudioElement factory.
 *
 * Architecture rule: browser APIs live only in frontend/src/drivers/.
 * Isolates `new Audio(src)` and browser timer globals so pure flow logic
 * remains free of browser globals.
 */

export interface AudioElementLike {
  src: string;
  currentTime: number;
  play(): Promise<void>;
  pause(): void;
  onended: ((ev: Event) => unknown) | null;
  onerror: ((ev: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => unknown) | null;
}

export type AudioElementFactory = (src: string) => AudioElementLike;

/**
 * Creates an Audio element instance using the browser's `new Audio(src)`.
 */
export function createAudioElement(src: string): AudioElementLike {
  return new Audio(src);
}

/**
 * Checks whether the browser Audio API is available in the current environment.
 */
export function isAudioSupported(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

export interface AudioHostDriver {
  createAudio?: (src: string) => AudioElementLike;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (id: unknown) => void;
}

/**
 * Default host factory for audio elements and timers.
 * Isolated in drivers/ so callers in flow/ do not reference browser globals.
 */
export function defaultAudioHost(): AudioHostDriver {
  if (typeof window === 'undefined') return {};
  return {
    createAudio: typeof Audio !== 'undefined' ? (src: string) => new Audio(src) : undefined,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  };
}
