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

  it('renders page 1 to JPEG blob, cleans up page, loading task and document', async () => {
    const fakePage = {
      getViewport: vi.fn().mockReturnValue({ width: 800, height: 600 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      cleanup: vi.fn(),
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
      expect(fakePage.cleanup).toHaveBeenCalled();
      expect(fakeDoc.cleanup).toHaveBeenCalled();
      expect(fakeDoc.destroy).toHaveBeenCalled();
      expect(destroyTask).toHaveBeenCalled();
    } finally {
      (globalThis as unknown as Record<string, unknown>).document = prevDocument;
    }
  });

  it('renders A4 page at scale ~1.9 so longest side is 1600 px (not 72 dpi scale 1.0)', async () => {
    const getViewportMock = vi.fn().mockImplementation(({ scale }: { scale: number }) => {
      // 595 x 842 pt (A4 at 72 dpi)
      return { width: 595 * scale, height: 842 * scale };
    });
    const fakePage = {
      getViewport: getViewportMock,
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      cleanup: vi.fn(),
    };
    const fakeDoc = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue(fakePage),
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

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ fillStyle: '', fillRect: vi.fn() }),
      toBlob: vi.fn().mockImplementation((cb: (b: Blob) => void) => {
        cb(new Blob(['fake-jpeg'], { type: 'image/jpeg' }));
      }),
    };

    const prevDocument = (globalThis as unknown as Record<string, unknown>).document;
    (globalThis as unknown as Record<string, unknown>).document = {
      createElement: () => fakeCanvas,
    };

    try {
      const fakeBlob = new Blob(['%PDF-a4'], { type: 'application/pdf' });
      await renderFirstPage(fakeBlob, 1600, () => Promise.resolve(fakePdfLib));

      // First call was unscaled (scale: 1.0)
      expect(getViewportMock).toHaveBeenNthCalledWith(1, { scale: 1.0 });
      // Second call must scale up so longest side 842 pt becomes 1600 px: scale = 1600 / 842 ≈ 1.9002
      const secondCallArg = getViewportMock.mock.calls[1]?.[0] as { scale: number };
      expect(secondCallArg.scale).not.toBe(1.0);
      expect(secondCallArg.scale).toBeCloseTo(1600 / 842, 3);
      expect(fakeCanvas.height).toBe(1600);
    } finally {
      (globalThis as unknown as Record<string, unknown>).document = prevDocument;
    }
  });

  it('stops rendering and rejects when abort signal is aborted', async () => {
    const cancelMock = vi.fn();
    let onRenderStarted!: () => void;
    const renderStartedPromise = new Promise<void>((resolve) => {
      onRenderStarted = resolve;
    });

    const fakePage = {
      getViewport: vi.fn().mockReturnValue({ width: 800, height: 600 }),
      render: vi.fn().mockImplementation(() => {
        onRenderStarted();
        return {
          promise: new Promise((resolve) => setTimeout(resolve, 50)),
          cancel: cancelMock,
        };
      }),
      cleanup: vi.fn(),
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

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ fillStyle: '', fillRect: vi.fn() }),
      toBlob: vi.fn(),
    };

    const prevDocument = (globalThis as unknown as Record<string, unknown>).document;
    (globalThis as unknown as Record<string, unknown>).document = {
      createElement: () => fakeCanvas,
    };

    const controller = new AbortController();
    try {
      const fakeBlob = new Blob(['%PDF-abort'], { type: 'application/pdf' });
      const renderPromise = renderFirstPage(
        fakeBlob,
        1600,
        () => Promise.resolve(fakePdfLib),
        controller.signal,
      );

      // Wait until render starts, then abort
      await renderStartedPromise;
      controller.abort();

      await expect(renderPromise).rejects.toSatisfy((err: unknown) => {
        return err instanceof DOMException && err.name === 'AbortError';
      });
      expect(cancelMock).toHaveBeenCalled();
    } finally {
      (globalThis as unknown as Record<string, unknown>).document = prevDocument;
    }
  });

  it('rejects with PdfError("timeout") when rendering exceeds timeoutMs', async () => {
    const cancelMock = vi.fn();
    const fakePage = {
      getViewport: vi.fn().mockReturnValue({ width: 800, height: 600 }),
      render: vi.fn().mockReturnValue({
        promise: new Promise((resolve) => setTimeout(resolve, 50)),
        cancel: cancelMock,
      }),
      cleanup: vi.fn(),
    };
    const fakeDoc = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue(fakePage),
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

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ fillStyle: '', fillRect: vi.fn() }),
      toBlob: vi.fn(),
    };

    const prevDocument = (globalThis as unknown as Record<string, unknown>).document;
    (globalThis as unknown as Record<string, unknown>).document = {
      createElement: () => fakeCanvas,
    };

    try {
      const fakeBlob = new Blob(['%PDF-timeout'], { type: 'application/pdf' });
      await expect(
        renderFirstPage(
          fakeBlob,
          1600,
          () => Promise.resolve(fakePdfLib),
          undefined,
          10, // 10ms timeout
        ),
      ).rejects.toSatisfy((err: unknown) => {
        return err instanceof PdfError && err.reason === 'timeout';
      });
    } finally {
      (globalThis as unknown as Record<string, unknown>).document = prevDocument;
    }
  });

  it('destroys document and loadingTask even if render fails', async () => {
    const fakePage = {
      getViewport: vi.fn().mockReturnValue({ width: 800, height: 600 }),
      render: vi.fn().mockReturnValue({ promise: Promise.reject(new Error('render failed')) }),
      cleanup: vi.fn(),
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
      expect(fakePage.cleanup).toHaveBeenCalled();
      expect(fakeDoc.cleanup).toHaveBeenCalled();
      expect(fakeDoc.destroy).toHaveBeenCalled();
      expect(destroyTask).toHaveBeenCalled();
    } finally {
      (globalThis as unknown as Record<string, unknown>).document = prevDocument;
    }
  });
});
