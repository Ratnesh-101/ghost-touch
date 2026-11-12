// @vitest-environment jsdom
/**
 * Test suite for FLOW-01: Late Save race condition in Correct screen and App.
 *
 * Verifies:
 * 1. executeCorrectSave respects AbortSignal and does not fall back to offline save when aborted.
 * 2. Correct component aborts and ignores completed save when unmounted.
 * 3. App ignores handleSaveCorrect if Correct is no longer the active screen.
 * 4. Late validate resolution after system Back discard does not overwrite original scene in
 *    diagramStore or change view back to Explore with discarded edits.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { Correct, executeCorrectSave } from '../src/screens/Correct';
import { ValidateRequestError, type ValidateResponse } from '../src/api/validate';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { setLang, t } from '../src/i18n';

const sampleScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Original Scene',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.2, y: 0.2, label: 'C' },
  ],
  segments: [
    { id: 's_ab', a: 'A', b: 'B', label: 'AB' },
    { id: 's_bc', a: 'B', b: 'C', label: 'BC' },
    { id: 's_ca', a: 'C', b: 'A', label: 'CA' },
  ],
  polylines: [],
  bars: [],
};

// Mock Capture and PDF drivers
vi.mock('../src/screens/Capture', () => ({
  Capture: ({
    onScene,
  }: {
    onScene?: (scene: DiagramScene, mode: string, photo?: string, source?: string) => void;
  }) => (
    <div className="gt-capture">
      <button
        type="button"
        className="mock-open-scene-btn"
        onClick={() => onScene?.(sampleScene, 'ai', undefined, 'file')}
      >
        Open File Scene
      </button>
    </div>
  ),
}));

vi.mock('../src/drivers/pdf', () => ({
  PdfError: class PdfError extends Error {
    readonly reason: string;
    constructor(reason: string, message?: string) {
      super(message ?? `PDF error: ${reason}`);
      this.name = 'PdfError';
      this.reason = reason;
    }
  },
  defaultPdfLoader: vi.fn(async () => ({})),
  renderFirstPage: vi.fn(async () => new Blob()),
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: '',
}));

let deferredValidateResolve: ((val: ValidateResponse) => void) | null = null;
vi.mock('../src/api/validate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/validate')>();
  return {
    ...actual,
    requestValidate: vi.fn(async (_scene: DiagramScene, options?: { signal?: AbortSignal }) => {
      if (options?.signal?.aborted) {
        throw new actual.ValidateRequestError('aborted');
      }
      return new Promise<ValidateResponse>((resolve, reject) => {
        deferredValidateResolve = resolve;
        options?.signal?.addEventListener('abort', () => {
          reject(new actual.ValidateRequestError('aborted'));
        });
      });
    }),
  };
});

// App builds its drivers with createBrowserDrivers(); hand it a real MemoryDiagramStore and a
// speech spy so the test can observe what App saves and says (R7F-1).
const observed = vi.hoisted(() => ({
  store: null as import('../src/drivers').MemoryDiagramStore | null,
  speak: null as import('vitest').Mock | null,
}));
vi.mock('../src/drivers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/drivers')>();
  return {
    ...actual,
    createBrowserDrivers: (...args: Parameters<typeof actual.createBrowserDrivers>) => {
      const real = actual.createBrowserDrivers(...args);
      return {
        ...real,
        speech: { ...real.speech, speak: observed.speak! },
        diagramStore: observed.store!,
      };
    },
  };
});

let App!: typeof import('../src/App').App;
let appModulePromise: Promise<typeof import('../src/App')> | null = null;
function getAppModule(): Promise<typeof import('../src/App')> {
  if (!appModulePromise) {
    appModulePromise = import('../src/App');
  }
  return appModulePromise;
}

describe('FLOW-01: Late Save Protection', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let testDrivers: Drivers;
  let restoreRect: () => void;
  let restoreContext: () => void;

  beforeEach(() => {
    setLang('en');
    deferredValidateResolve = null;
    observed.store = new MemoryDiagramStore();
    observed.speak = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const proto = HTMLCanvasElement.prototype;
    const originalRect = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function rect(): DOMRect {
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 400,
        bottom: 400,
        width: 400,
        height: 400,
        toJSON: () => ({}),
      } as DOMRect;
    };
    restoreRect = () => {
      proto.getBoundingClientRect = originalRect;
    };

    const originalContext = proto.getContext;
    proto.getContext = (() => null) as typeof proto.getContext;
    restoreContext = () => {
      proto.getContext = originalContext;
    };

    testDrivers = {
      haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        state: 'locked',
      },
      speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
      diagramStore: new MemoryDiagramStore(),
    };
  });

  afterEach(async () => {
    restoreRect();
    restoreContext();
    if (root && container) {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
    }
    container = null;
    root = null;
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  it('executeCorrectSave throws abort error and does not fallback to offline save', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      executeCorrectSave(sampleScene, { signal: controller.signal }),
    ).rejects.toThrow(ValidateRequestError);
  });

  it('Correct screen ignores resolve and skips onSave after unmount', async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    await act(async () => {
      root!.render(
        createElement(Correct, {
          scene: sampleScene,
          photoUrl: null,
          drivers: testDrivers,
          onSave,
          onCancel,
        }),
      );
    });

    const saveBtn = container!.querySelector<HTMLButtonElement>('.gt-correct__btn--primary');
    expect(saveBtn).not.toBeNull();

    // Click save with delayed validate
    await act(async () => {
      saveBtn!.click();
    });

    // Unmount before validate resolves
    await act(async () => {
      root!.unmount();
    });

    // Resolve deferred validate
    await act(async () => {
      deferredValidateResolve?.({ ok: true, scene: sampleScene, errors: [] });
    });

    // onSave and audio must NOT be called
    expect(onSave).not.toHaveBeenCalled();
    expect(testDrivers.audio.playEarcon).not.toHaveBeenCalled();
  });

  describe('App integration with late save and system Back', () => {
    beforeAll(async () => {
      const appModule = await getAppModule();
      App = appModule.App;
    }, 60_000);

    it('ignores late save resolution after system Back discard', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      await act(async () => {
        root!.render(createElement(App));
      });

      // Start -> Capture
      const startBtn = container!.querySelector<HTMLButtonElement>('.gt-start-surface');
      await act(async () => {
        startBtn!.click();
      });

      // Capture -> Open File Scene -> Explore
      const openSceneBtn = container!.querySelector<HTMLButtonElement>('.mock-open-scene-btn');
      await act(async () => {
        openSceneBtn!.click();
      });

      expect(container!.querySelector('.gt-explore')).not.toBeNull();

      // Explore -> Correct
      const correctBtn = container!.querySelector<HTMLButtonElement>('.gt-explore__correct');
      await act(async () => {
        correctBtn!.click();
      });

      expect(container!.querySelector('.gt-correct')).not.toBeNull();

      // Make edits (dirty)
      const canvas = container!.querySelector('canvas');
      const pointBtn = container!.querySelector<HTMLButtonElement>('.gt-correct__element-btn');
      await act(async () => {
        pointBtn!.click();
      });
      await act(async () => {
        canvas!.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
        );
      });

      // Tap Save (validating is now in progress)
      const saveBtn = container!.querySelector<HTMLButtonElement>('.gt-correct__btn--primary');
      await act(async () => {
        saveBtn!.click();
      });

      // System back while validating
      await act(async () => {
        window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
      });

      // User confirmed discard
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith(t('correct.confirmLeave'));

      // Discard lands on Explore with the original scene; the user then goes Back to Capture.
      expect(container!.querySelector('.gt-explore')).not.toBeNull();
      expect(container!.querySelector('.gt-correct')).toBeNull();
      const exploreBack = container!.querySelector<HTMLButtonElement>('.gt-explore__back');
      await act(async () => {
        exploreBack!.click();
      });
      expect(container!.querySelector('.gt-capture')).not.toBeNull();

      // Snapshot the store and the speech log before the late validate resolves.
      const before = await observed.store!.list();
      expect(before.ok).toBe(true);
      const beforeJson = JSON.stringify(before.ok ? before.value : null);
      const spokenBefore = observed.speak!.mock.calls.length;

      // Late validate resolves with edits the user discarded.
      const editedScene: DiagramScene = {
        ...sampleScene,
        title: 'Discarded Edits Should Not Be Applied',
      };
      await act(async () => {
        deferredValidateResolve?.({ ok: true, scene: editedScene, errors: [] });
      });
      // Let any queued save task run.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      // The view did not change: old code forced Explore here.
      expect(container!.querySelector('.gt-capture')).not.toBeNull();
      expect(container!.querySelector('.gt-explore')).toBeNull();
      expect(container!.querySelector('.gt-correct')).toBeNull();

      // No new or changed saved entry, and the discarded title was never stored.
      const after = await observed.store!.list();
      expect(after.ok).toBe(true);
      expect(JSON.stringify(after.ok ? after.value : null)).toBe(beforeJson);
      expect(beforeJson).not.toContain('Discarded Edits Should Not Be Applied');

      // Nothing was spoken by the late resolve, and "Corrections saved" never was.
      expect(observed.speak!.mock.calls.length).toBe(spokenBefore);
      const spoken = observed.speak!.mock.calls.map((call) => String(call[0]));
      expect(spoken.some((s) => s.includes(t('correct.saved')))).toBe(false);    });
  });
});
