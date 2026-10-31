import { describe, expect, it, vi } from 'vitest';
import { PdfError, renderFirstPage, type PdfLib } from '../src/drivers/pdf';

describe('renderFirstPage', () => {
  it('maps PasswordException to PdfError with reason "password"', async () => {
    class PasswordException extends Error {
      constructor() {
        super('password required');
        this.name = 'PasswordException';
      }
    }
    const fakePdfLib = {
      PasswordException,
      InvalidPDFException: class InvalidPDFException extends Error {},
      getDocument: () => ({
        promise: Promise.reject(new PasswordException()),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as PdfLib;

    const fakeBlob = new Blob(['%PDF-fake'], { type: 'application/pdf' });
    await expect(renderFirstPage(fakeBlob, 1600, () => Promise.resolve(fakePdfLib))).rejects.toSatisfy(
      (err: unknown) => err instanceof PdfError && err.reason === 'password',
    );
  });

  it('maps InvalidPDFException to PdfError with reason "invalid"', async () => {
    class InvalidPDFException extends Error {
      constructor() {
        super('corrupt pdf');
        this.name = 'InvalidPDFException';
      }
    }
    const fakePdfLib = {
      PasswordException: class PasswordException extends Error {},
      InvalidPDFException,
      getDocument: () => ({
        promise: Promise.reject(new InvalidPDFException()),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as PdfLib;

    const fakeBlob = new Blob(['%PDF-corrupt'], { type: 'application/pdf' });
    await expect(renderFirstPage(fakeBlob, 1600, () => Promise.resolve(fakePdfLib))).rejects.toSatisfy(
      (err: unknown) => err instanceof PdfError && err.reason === 'invalid',
    );
  });

  it('maps zero pages to PdfError with reason "empty"', async () => {
    const fakeDoc = {
      numPages: 0,
      getPage: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    const fakePdfLib = {
      PasswordException: class PasswordException extends Error {},
      InvalidPDFException: class InvalidPDFException extends Error {},
      getDocument: () => ({
        promise: Promise.resolve(fakeDoc),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as PdfLib;

    const fakeBlob = new Blob(['%PDF-empty'], { type: 'application/pdf' });
    await expect(renderFirstPage(fakeBlob, 1600, () => Promise.resolve(fakePdfLib))).rejects.toSatisfy(
      (err: unknown) => err instanceof PdfError && err.reason === 'empty',
    );
    expect(fakeDoc.destroy).toHaveBeenCalled();
  });

  it('renders page 1 to JPEG blob and cleans up loading task and document', async () => {
    const fakePage = {
      getViewport: vi.fn().mockReturnValue({ width: 800, height: 600 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    };
    const fakeDoc = {
      numPages: 3,
      getPage: vi.fn().mockResolvedValue(fakePage),
      cleanup: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    const destroyTask = vi.fn().mockResolvedValue(undefined);
    const fakePdfLib = {
      PasswordException: class PasswordException extends Error {},
      InvalidPDFException: class InvalidPDFException extends Error {},
      getDocument: () => ({
        promise: Promise.resolve(fakeDoc),
        destroy: destroyTask,
      }),
    } as unknown as PdfLib;

    const mockContext = {
      fillStyle: '',
      fillRect: vi.fn(),
    };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
      toBlob: vi.fn().mockImplementation((cb: (b: Blob) => void) => {
        cb(new Blob(['fake-jpeg-data'], { type: 'image/jpeg' }));
      }),
    };

    const prevDocument = (globalThis as unknown as Record<string, unknown>).document;
    (globalThis as unknown as Record<string, unknown>).document = {
      createElement: (tag: string) => (tag === 'canvas' ? fakeCanvas : null),
    };

    try {
      const fakeBlob = new Blob(['%PDF-valid'], { type: 'application/pdf' });
      const result = await renderFirstPage(fakeBlob, 1600, () => Promise.resolve(fakePdfLib));

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/jpeg');
      expect(fakeDoc.getPage).toHaveBeenCalledWith(1);
      expect(fakePage.render).toHaveBeenCalled();
      expect(fakeDoc.cleanup).toHaveBeenCalled();
      expect(fakeDoc.destroy).toHaveBeenCalled();
      expect(destroyTask).toHaveBeenCalled();
    } finally {
      (globalThis as unknown as Record<string, unknown>).document = prevDocument;
    }
  });

  it('destroys document and loadingTask even if render fails', async () => {
    const fakePage = {
      getViewport: vi.fn().mockReturnValue({ width: 800, height: 600 }),
      render: vi.fn().mockReturnValue({ promise: Promise.reject(new Error('render failed')) }),
    };
    const fakeDoc = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue(fakePage),
      cleanup: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    const destroyTask = vi.fn().mockResolvedValue(undefined);
    const fakePdfLib = {
      PasswordException: class PasswordException extends Error {},
      InvalidPDFException: class InvalidPDFException extends Error {},
      getDocument: () => ({
        promise: Promise.resolve(fakeDoc),
        destroy: destroyTask,
      }),
    } as unknown as PdfLib;

    const mockContext = {
      fillStyle: '',
      fillRect: vi.fn(),
    };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
    };

    const prevDocument = (globalThis as unknown as Record<string, unknown>).document;
    (globalThis as unknown as Record<string, unknown>).document = {
      createElement: (tag: string) => (tag === 'canvas' ? fakeCanvas : null),
    };

    try {
      const fakeBlob = new Blob(['%PDF-valid'], { type: 'application/pdf' });
      await expect(renderFirstPage(fakeBlob, 1600, () => Promise.resolve(fakePdfLib))).rejects.toSatisfy(
        (err: unknown) => err instanceof PdfError && err.reason === 'invalid',
      );
      expect(fakeDoc.cleanup).toHaveBeenCalled();
      expect(fakeDoc.destroy).toHaveBeenCalled();
      expect(destroyTask).toHaveBeenCalled();
    } finally {
      (globalThis as unknown as Record<string, unknown>).document = prevDocument;
    }
  });
});
