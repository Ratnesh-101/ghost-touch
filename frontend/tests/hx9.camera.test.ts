import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decode,
  decodeWithBitmap,
  MAX_IMAGE_SIDE,
} from '../src/drivers/camera';

interface FakeBitmap {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: ReturnType<typeof vi.fn>;
}

function makeFakeBitmap(width: number, height: number): FakeBitmap {
  return {
    source: {} as CanvasImageSource,
    width,
    height,
    close: vi.fn(),
  };
}

describe('hx9 camera: decodeWithBitmap downscaling and fallbacks', () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalImage = globalThis.Image;
  const originalURL = globalThis.URL;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalCreateImageBitmap !== undefined) {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    } else {
      delete (globalThis as Record<string, unknown>).createImageBitmap;
    }
    if (originalImage !== undefined) {
      globalThis.Image = originalImage;
    } else {
      delete (globalThis as Record<string, unknown>).Image;
    }
    if (originalURL !== undefined) {
      globalThis.URL = originalURL;
    } else {
      delete (globalThis as Record<string, unknown>).URL;
    }
  });

  it('landscape input ends at most 1600 px on the long side', async () => {
    // Landscape 4000x3000 -> resizeWidth: 1600 scales proportionally to 1600x1200.
    const fakeBitmap = makeFakeBitmap(1600, 1200);
    const mockCreateImageBitmap = vi.fn().mockImplementation(
      async (_file: ImageBitmapSource, options?: ImageBitmapOptions) => {
        expect(options).toEqual({
          imageOrientation: 'from-image',
          resizeWidth: MAX_IMAGE_SIDE,
          resizeQuality: 'medium',
        });
        return fakeBitmap;
      },
    );
    globalThis.createImageBitmap = mockCreateImageBitmap as unknown as typeof createImageBitmap;

    const dummyBlob = new Blob(['dummy image data'], { type: 'image/jpeg' });
    const decoded = await decodeWithBitmap(dummyBlob);

    expect(mockCreateImageBitmap).toHaveBeenCalledTimes(1);
    expect(decoded.width).toBe(1600);
    expect(decoded.height).toBe(1200);
    expect(Math.max(decoded.width, decoded.height)).toBeLessThanOrEqual(MAX_IMAGE_SIDE);

    // Releasing closes the active bitmap
    expect(fakeBitmap.close).not.toHaveBeenCalled();
    decoded.release();
    expect(fakeBitmap.close).toHaveBeenCalledTimes(1);
  });

  it('portrait input ends at most 1600 px on the long side and discarded bitmap is closed', async () => {
    // Portrait 3000x4000.
    // 1st call with resizeWidth: 1600 yields 1600x2133 (height > 1600).
    // 2nd call with resizeHeight: 1600 yields 1200x1600.
    const firstBitmap = makeFakeBitmap(1600, 2133);
    const secondBitmap = makeFakeBitmap(1200, 1600);

    const callEvents: string[] = [];
    firstBitmap.close.mockImplementation(() => {
      callEvents.push('first-bitmap-closed');
    });

    const mockCreateImageBitmap = vi.fn().mockImplementation(
      async (_file: ImageBitmapSource, options?: ImageBitmapOptions) => {
        if (options && options.resizeWidth === MAX_IMAGE_SIDE) {
          callEvents.push('first-call-with-resize-width');
          return firstBitmap;
        }
        if (options && options.resizeHeight === MAX_IMAGE_SIDE) {
          callEvents.push('second-call-with-resize-height');
          return secondBitmap;
        }
        throw new Error(`Unexpected options: ${JSON.stringify(options)}`);
      },
    );
    globalThis.createImageBitmap = mockCreateImageBitmap as unknown as typeof createImageBitmap;

    const dummyBlob = new Blob(['portrait data'], { type: 'image/jpeg' });
    const decoded = await decodeWithBitmap(dummyBlob);

    expect(mockCreateImageBitmap).toHaveBeenCalledTimes(2);
    // Discarded bitmap is closed immediately before or during retry
    expect(firstBitmap.close).toHaveBeenCalledTimes(1);
    expect(callEvents).toEqual([
      'first-call-with-resize-width',
      'first-bitmap-closed',
      'second-call-with-resize-height',
    ]);

    expect(decoded.width).toBe(1200);
    expect(decoded.height).toBe(1600);
    expect(Math.max(decoded.width, decoded.height)).toBeLessThanOrEqual(MAX_IMAGE_SIDE);

    expect(secondBitmap.close).not.toHaveBeenCalled();
    decoded.release();
    expect(secondBitmap.close).toHaveBeenCalledTimes(1);
  });

  it('square input ends at most 1600 px on the long side without retry', async () => {
    // Square 3000x3000 -> resizeWidth: 1600 scales to 1600x1600. Height == 1600, not > 1600.
    const fakeBitmap = makeFakeBitmap(1600, 1600);
    const mockCreateImageBitmap = vi.fn().mockResolvedValue(fakeBitmap);
    globalThis.createImageBitmap = mockCreateImageBitmap as unknown as typeof createImageBitmap;

    const dummyBlob = new Blob(['square data'], { type: 'image/jpeg' });
    const decoded = await decodeWithBitmap(dummyBlob);

    expect(mockCreateImageBitmap).toHaveBeenCalledTimes(1);
    expect(decoded.width).toBe(1600);
    expect(decoded.height).toBe(1600);
    expect(Math.max(decoded.width, decoded.height)).toBe(1600);
    expect(fakeBitmap.close).not.toHaveBeenCalled();
  });

  it('small upscaled image is accepted without retry when height <= 1600', async () => {
    // 800x600 upscaled to 1600x1200
    const fakeBitmap = makeFakeBitmap(1600, 1200);
    const mockCreateImageBitmap = vi.fn().mockResolvedValue(fakeBitmap);
    globalThis.createImageBitmap = mockCreateImageBitmap as unknown as typeof createImageBitmap;

    const dummyBlob = new Blob(['small data'], { type: 'image/jpeg' });
    const decoded = await decodeWithBitmap(dummyBlob);

    expect(mockCreateImageBitmap).toHaveBeenCalledTimes(1);
    expect(decoded.width).toBe(1600);
    expect(decoded.height).toBe(1200);
  });

  it('a rejecting resize call falls back to today call (unresized)', async () => {
    const unresizedBitmap = makeFakeBitmap(4000, 3000);
    const mockCreateImageBitmap = vi.fn().mockImplementation(
      async (_file: ImageBitmapSource, options?: ImageBitmapOptions) => {
        // If resize options are passed, simulate browser rejecting options
        if (options && ('resizeWidth' in options || 'resizeHeight' in options)) {
          throw new Error('Unsupported resize option');
        }
        // Fallback call: today's call with { imageOrientation: 'from-image' }
        expect(options).toEqual({ imageOrientation: 'from-image' });
        return unresizedBitmap;
      },
    );
    globalThis.createImageBitmap = mockCreateImageBitmap as unknown as typeof createImageBitmap;

    const dummyBlob = new Blob(['unresized data'], { type: 'image/jpeg' });
    const decoded = await decodeWithBitmap(dummyBlob);

    expect(mockCreateImageBitmap).toHaveBeenCalledTimes(2);
    expect(decoded.width).toBe(4000);
    expect(decoded.height).toBe(3000);

    expect(unresizedBitmap.close).not.toHaveBeenCalled();
    decoded.release();
    expect(unresizedBitmap.close).toHaveBeenCalledTimes(1);
  });

  it('portrait retry rejecting falls back to today call and closes discarded first bitmap', async () => {
    const firstBitmap = makeFakeBitmap(1600, 2133);
    const fallbackBitmap = makeFakeBitmap(3000, 4000);

    const mockCreateImageBitmap = vi.fn().mockImplementation(
      async (_file: ImageBitmapSource, options?: ImageBitmapOptions) => {
        if (options && options.resizeWidth === MAX_IMAGE_SIDE) {
          return firstBitmap;
        }
        if (options && options.resizeHeight === MAX_IMAGE_SIDE) {
          throw new Error('Failed to resizeHeight');
        }
        if (options && options.imageOrientation === 'from-image') {
          return fallbackBitmap;
        }
        throw new Error('Unexpected options');
      },
    );
    globalThis.createImageBitmap = mockCreateImageBitmap as unknown as typeof createImageBitmap;

    const dummyBlob = new Blob(['portrait data'], { type: 'image/jpeg' });
    const decoded = await decodeWithBitmap(dummyBlob);

    // First bitmap must have been closed when discarded
    expect(firstBitmap.close).toHaveBeenCalledTimes(1);
    expect(decoded.width).toBe(3000);
    expect(decoded.height).toBe(4000);

    decoded.release();
    expect(fallbackBitmap.close).toHaveBeenCalledTimes(1);
  });

  it('falls back to the <img> path when createImageBitmap rejects completely', async () => {
    // Both resize and unresized calls fail
    const mockCreateImageBitmap = vi.fn().mockRejectedValue(new Error('createImageBitmap failed'));
    globalThis.createImageBitmap = mockCreateImageBitmap as unknown as typeof createImageBitmap;

    // Fake URL.createObjectURL and URL.revokeObjectURL
    const revokeMock = vi.fn();
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/fake-img');
    globalThis.URL = {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeMock,
    } as unknown as typeof URL;

    // Fake Image constructor
    class FakeImage {
      src = '';
      naturalWidth = 800;
      naturalHeight = 600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image;

    const dummyBlob = new Blob(['image data'], { type: 'image/jpeg' });
    const decoded = await decode(dummyBlob);

    expect(createObjectURLMock).toHaveBeenCalledWith(dummyBlob);
    expect(decoded.width).toBe(800);
    expect(decoded.height).toBe(600);

    expect(revokeMock).not.toHaveBeenCalled();
    decoded.release();
    expect(revokeMock).toHaveBeenCalledWith('blob:http://localhost/fake-img');
  });
});
