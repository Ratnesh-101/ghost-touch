/**
 * PDF helper: render the first page of a PDF document to an image Blob.
 *
 * Uses pdfjs-dist lazy-loaded in a separate chunk so the main bundle
 * does not grow.
 *
 * Browser APIs (canvas, blob, dynamic import) live in drivers/
 * per tech.md.
 */
import { computeTargetSize, JPEG_QUALITY, MAX_IMAGE_SIDE } from './camera';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export type PdfErrorReason = 'password' | 'invalid' | 'empty';

export class PdfError extends Error {
  readonly reason: PdfErrorReason;
  constructor(reason: PdfErrorReason, message?: string) {
    super(message ?? `PDF error: ${reason}`);
    this.name = 'PdfError';
    this.reason = reason;
  }
}

export type PdfLib = typeof import('pdfjs-dist');

let workerConfigured = false;

export async function defaultPdfLoader(): Promise<PdfLib> {
  const pdfjs = await import('pdfjs-dist');
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerConfigured = true;
  }
  return pdfjs;
}

export async function renderFirstPage(
  file: Blob,
  maxSide: number = MAX_IMAGE_SIDE,
  loadPdfJs: () => Promise<PdfLib> = defaultPdfLoader,
): Promise<Blob> {
  let pdfjs: PdfLib;
  try {
    pdfjs = await loadPdfJs();
  } catch {
    throw new PdfError('invalid');
  }

  let loadingTask: ReturnType<PdfLib['getDocument']> | null = null;
  let doc: Awaited<ReturnType<PdfLib['getDocument']>['promise']> | null = null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    doc = await loadingTask.promise;

    if (!doc.numPages || doc.numPages <= 0) {
      throw new PdfError('empty');
    }

    const page = await doc.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const { width: targetWidth } = computeTargetSize(
      unscaledViewport.width,
      unscaledViewport.height,
      maxSide,
    );
    const scale = unscaledViewport.width > 0 ? targetWidth / unscaledViewport.width : 1.0;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));

    const context = canvas.getContext('2d');
    if (context === null) {
      throw new PdfError('invalid');
    }

    // JPEG has no transparency; paint white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas: null,
      canvasContext: context,
      viewport,
    }).promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (blob === null) {
      throw new PdfError('invalid');
    }
    return blob;
  } catch (err: unknown) {
    if (err instanceof PdfError) {
      throw err;
    }
    const errObj = typeof err === 'object' && err !== null ? (err as { name?: string }) : null;
    if (
      err instanceof pdfjs.PasswordException ||
      errObj?.name === 'PasswordException'
    ) {
      throw new PdfError('password');
    }
    if (
      err instanceof pdfjs.InvalidPDFException ||
      errObj?.name === 'InvalidPDFException'
    ) {
      throw new PdfError('invalid');
    }
    throw new PdfError('invalid');
  } finally {
    if (doc !== null) {
      try {
        await doc.cleanup();
      } catch {
        // ignore cleanup error
      }
      const docRecord = doc as unknown as Record<string, unknown>;
      if ('destroy' in docRecord) {
        try {
          const destroyFn = docRecord.destroy;
          if (typeof destroyFn === 'function') {
            await destroyFn.call(doc);
          }
        } catch {
          // ignore cleanup error
        }
      }
    }
    if (loadingTask !== null) {
      try {
        await loadingTask.destroy();
      } catch {
        // ignore cleanup error
      }
    }
  }
}
