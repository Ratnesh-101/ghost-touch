/**
 * Camera / file helpers: validate an image file, shrink it for upload.
 *
 * `validateImageFile` and `computeTargetSize` are pure and unit-tested.
 * `prepareImage` uses the canvas and `createImageBitmap`, so it lives here
 * with the other browser-facing code (tech.md: browser APIs only in drivers/).
 *
 * Screenshots and photos both arrive here as ordinary images. PDFs are
 * recognised and rejected with a clear reason: turning a PDF page into an
 * image needs a PDF renderer (a new dependency that needs the owner's OK).
 */

export const ACCEPTED_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
/** Requirement 2.2: "Choose image" accepts files up to 10 MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/**
 * "Take photo" files are shrunk to about a megabyte before upload, so only the
 * camera's raw size matters; a 50 MP phone photo can exceed 10 MB.
 */
export const MAX_CAMERA_BYTES = 50 * 1024 * 1024;
/** Longest side after downscaling (never upscaled). */
export const MAX_IMAGE_SIDE = 1600;
export const JPEG_QUALITY = 0.85;

export type FileRejection = 'empty' | 'pdf' | 'type' | 'size';

export interface FileInfo {
  type: string;
  size: number;
}

/** Returns why the file cannot be used, or null when it is fine. */
export function validateImageFile(
  file: FileInfo,
  maxBytes: number = MAX_UPLOAD_BYTES,
  allowPdf: boolean = true,
): FileRejection | null {
  if (file.size <= 0) return 'empty';
  const type = file.type.toLowerCase();
  if (type === 'application/pdf') {
    if (!allowPdf) return 'pdf';
    return file.size > maxBytes ? 'size' : null;
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(type)) return 'type';
  if (file.size > maxBytes) return 'size';
  return null;
}

export interface Size {
  width: number;
  height: number;
}

/** Scale so the longest side is at most `maxSide`. Never upscales; sides are at least 1. */
export function computeTargetSize(width: number, height: number, maxSide: number): Size {
  const longest = Math.max(width, height);
  if (!(longest > 0) || !(maxSide > 0)) return { width: 1, height: 1 };
  const scale = Math.min(1, maxSide / longest);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export class CameraError extends Error {
  constructor() {
    super('decode');
    this.name = 'CameraError';
  }
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

async function decodeWithBitmap(file: Blob): Promise<DecodedImage> {
  // 'from-image' applies the EXIF rotation, so portrait phone photos stand upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release: () => bitmap.close(),
  };
}

function decodeWithImageElement(file: Blob): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () =>
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new CameraError());
    };
    image.src = url;
  });
}

async function decode(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await decodeWithBitmap(file);
    } catch {
      // Some browsers reject the options or the format; fall back to <img>.
    }
  }
  return decodeWithImageElement(file);
}

/** Decode, fix orientation, downscale to `MAX_IMAGE_SIDE`, re-encode as JPEG. */
export async function prepareImage(file: Blob): Promise<Blob> {
  const decoded = await decode(file);
  try {
    const { width, height } = computeTargetSize(decoded.width, decoded.height, MAX_IMAGE_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) throw new CameraError();
    // JPEG has no transparency; paint white first so transparent screenshots stay readable.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (blob === null) throw new CameraError();
    return blob;
  } finally {
    decoded.release();
  }
}
