/**
 * Capture-screen behaviour: validate, shrink, upload, and the waiting tone.
 *
 * The component only wires buttons to these functions, so the rules (what is
 * rejected, what is said, when the progress tone stops) are unit tested with
 * fakes instead of a browser.
 */
import { requestScene, SceneRequestError, type SceneResponse } from '../api/scene';
import {
  isPdfFile,
  MAX_CAMERA_BYTES,
  MAX_IMAGE_SIDE,
  MAX_UPLOAD_BYTES,
  prepareImage,
  validateImageFile,
  type FileInfo,
  type FileRejection,
} from '../drivers/camera';
import {
  defaultPdfLoader,
  PdfError,
  renderFirstPage,
  type PdfErrorReason,
} from '../drivers/pdf';
import type { AudioDriver } from '../drivers';
import { t } from '../i18n';

/** Soft cue while the diagram is being read (Requirement 2.3). */
export const PROGRESS_INTERVAL_MS = 1500;
export const PROGRESS_BEEP_HZ = 440;
export const PROGRESS_BEEP_MS = 120;

const REJECTION_KEYS: Record<FileRejection, string> = {
  empty: 'capture.errorEmpty',
  pdf: 'capture.errorPdf',
  type: 'capture.errorType',
  size: 'capture.errorSize',
};

const PDF_ERROR_KEYS: Record<PdfErrorReason, string> = {
  password: 'capture.errorPdfPassword',
  invalid: 'capture.errorPdfInvalid',
  empty: 'capture.errorPdfEmpty',
  timeout: 'capture.errorPdfTimeout',
};

export function pdfErrorMessage(reason: PdfErrorReason): string {
  return t(PDF_ERROR_KEYS[reason]);
}

export function captureErrorMessage(error: unknown): string {
  if (error instanceof PdfError) {
    return pdfErrorMessage(error.reason);
  }
  if (error instanceof SceneRequestError && error.failure === 'busy') {
    return t('capture.errorBusy');
  }
  return t('capture.error');
}

/** Where the file came from decides the size limit: the camera's raw photo vs a chosen file. */
export type FileSource = 'camera' | 'file';

export function rejectionMessage(reason: FileRejection, source: FileSource = 'file'): string {
  return reason === 'size' && source === 'camera' ? t('capture.errorSizeCamera') : t(REJECTION_KEYS[reason]);
}

export function maxBytesFor(source: FileSource): number {
  return source === 'camera' ? MAX_CAMERA_BYTES : MAX_UPLOAD_BYTES;
}

/** Beep every 1.5 s until the returned function is called. */
export function startProgressTone(audio: AudioDriver): () => void {
  const timer = setInterval(() => audio.beep(PROGRESS_BEEP_HZ, PROGRESS_BEEP_MS), PROGRESS_INTERVAL_MS);
  return () => clearInterval(timer);
}

export interface CaptureDeps {
  audio: AudioDriver;
  /** Say it aloud and show it in the status line. */
  say: (text: string) => void;
  prepare?: (file: Blob, signal?: AbortSignal) => Promise<Blob>;
  renderPdf?: (file: Blob, signal?: AbortSignal) => Promise<Blob>;
  request?: (image: Blob, signal: AbortSignal) => Promise<SceneResponse>;
  signal: AbortSignal;
  /** Defaults to 'file' (10 MB limit). */
  source?: FileSource;
}

export type CaptureOutcome =
  | { kind: 'scene'; response: SceneResponse }
  | { kind: 'rejected' }
  | { kind: 'failed' }
  | { kind: 'cancelled' };

/**
 * Handle one chosen file. Speaks every state, always stops the progress tone,
 * and never leaves the user in silence on failure.
 */
export async function processImageFile(
  file: FileInfo & Blob,
  deps: CaptureDeps,
): Promise<CaptureOutcome> {
  const source = deps.source ?? 'file';
  const isPdf = isPdfFile(file);
  const rejection = validateImageFile(file, maxBytesFor(source), source === 'file');
  if (rejection !== null) {
    deps.say(rejectionMessage(rejection, source));
    return { kind: 'rejected' };
  }
  const prepare = isPdf
    ? (deps.renderPdf
      ? (f: Blob) => deps.renderPdf!(f, deps.signal)
      : (f: Blob) => renderFirstPage(f, MAX_IMAGE_SIDE, defaultPdfLoader, deps.signal))
    : (deps.prepare
      ? (f: Blob) => deps.prepare!(f, deps.signal)
      : (f: Blob) => prepareImage(f));
  const request = deps.request ?? ((image, signal) => requestScene(image, { signal }));

  const announcement = isPdf
    ? `${t('capture.firstPagePdf')} ${t('capture.reading')}`
    : t('capture.reading');
  deps.say(announcement);

  const stopTone = startProgressTone(deps.audio);
  try {
    const image = await prepare(file);
    const response = await request(image, deps.signal);
    return { kind: 'scene', response };
  } catch (err: unknown) {
    if (deps.signal.aborted) return { kind: 'cancelled' };
    deps.say(captureErrorMessage(err));
    return { kind: 'failed' };
  } finally {
    stopTone();
  }
}

/**
 * Manages raw photo object URL lifecycle to prevent memory leaks on mobile devices.
 * Revokes any previous photo blob URL when a new photo is set or on screen disposal,
 * while allowing the active photo URL to remain valid for Teacher Correct overlays.
 */
export interface PhotoUrlTracker {
  getCurrent(): string | null;
  update(newUrl: string | null): void;
  dispose(): void;
}

export function createPhotoUrlTracker(
  revoke: (url: string) => void = (url) => {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  },
): PhotoUrlTracker {
  let activeUrl: string | null = null;
  return {
    getCurrent: () => activeUrl,
    update: (newUrl: string | null) => {
      if (activeUrl !== null && activeUrl !== newUrl) {
        revoke(activeUrl);
      }
      activeUrl = newUrl;
    },
    dispose: () => {
      if (activeUrl !== null) {
        revoke(activeUrl);
        activeUrl = null;
      }
    },
  };
}
