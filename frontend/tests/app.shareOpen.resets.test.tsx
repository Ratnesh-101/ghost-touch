// @vitest-environment jsdom
/**
 * Test suite for FLOW-04: Opening a shared diagram resets lastSavedDiagramId and photoUrl.
 *
 * Verifies:
 * 1. Opening a shared diagram calls updatePhotoUrl(null) and resets lastSavedDiagramId.
 * 2. Correct screen receives photoUrl === null for the shared diagram.
 * 3. Saving corrections on the shared diagram creates a new entry rather than overwriting
 *    the captured diagram previously saved.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { encodeShare, type SharePayload } from '../src/share';
import { setLang } from '../src/i18n';
import { MemoryDiagramStore } from '../src/drivers';

const capturedScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Captured Diagram A',
  points: [{ id: 'A', x: 0.1, y: 0.1, label: 'A' }],
  segments: [],
};

const sharedScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Shared Diagram B',
  points: [{ id: 'B', x: 0.5, y: 0.5, label: 'B' }],
  segments: [],
};

let lastCorrectPhotoUrl: string | null = 'not-called';
vi.mock('../src/screens/Correct', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/screens/Correct')>();
  return {
    ...actual,
    Correct: (props: import('../src/screens/Correct').CorrectProps) => {
      lastCorrectPhotoUrl = props.photoUrl;
      return (
        <div className="gt-correct">
          <button
            type="button"
            className="mock-correct-save-btn"
            onClick={() => props.onSave(props.scene)}
          >
            Save Mock
          </button>
        </div>
      );
    },
  };
});

let openSceneWithPhoto!: (scene: DiagramScene, photo: string) => void;
vi.mock('../src/screens/Capture', () => ({
  Capture: ({
    onScene,
  }: {
    onScene?: (scene: DiagramScene, mode: string, photo?: string, source?: string) => void;
  }) => {
    openSceneWithPhoto = (scene: DiagramScene, photo: string) => {
      onScene?.(scene, 'ai', photo, 'camera');
    };
    return <div className="gt-capture" />;
  },
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

vi.mock('../src/config/features', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/features')>();
  return {
    ...actual,
    isShareEnvOn: () => true,
    isAskMockFallbackOn: () => false,
    isGhostwriterOn: () => true,
  };
});

// Give App a real, inspectable MemoryDiagramStore (R7F-2).
const observed = vi.hoisted(() => ({
  store: null as import('../src/drivers').MemoryDiagramStore | null,
}));
vi.mock('../src/drivers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/drivers')>();
  return {
    ...actual,
    createBrowserDrivers: (...args: Parameters<typeof actual.createBrowserDrivers>) => ({
      ...actual.createBrowserDrivers(...args),
      diagramStore: observed.store!,
    }),
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

async function flushSaves(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

describe('FLOW-04: Reset on shared diagram open', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeAll(async () => {
    const appModule = await getAppModule();
    App = appModule.App;
  }, 60_000);

  beforeEach(() => {
    setLang('en');
    lastCorrectPhotoUrl = 'not-called';
    observed.store = new MemoryDiagramStore();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
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

  it('handleOpenSharedDiagram clears photoUrl and does not overwrite original diagram entry', async () => {
    await act(async () => {
      root!.render(createElement(App));
    });

    // Start -> Capture
    const startBtn = container!.querySelector<HTMLButtonElement>('.gt-start-surface');
    await act(async () => {
      startBtn!.click();
    });

    // Capture scene with photo
    const photoDataUrl = 'data:image/jpeg;base64,fakephotodata';
    await act(async () => {
      openSceneWithPhoto(capturedScene, photoDataUrl);
    });

    // Explore is showing
    expect(container!.querySelector('.gt-explore')).not.toBeNull();

    // The captured diagram was saved and is now lastSavedDiagramId.
    await flushSaves();
    const saved = await observed.store!.list();
    expect(saved.ok).toBe(true);
    const entriesBefore = saved.ok ? saved.value : [];
    expect(entriesBefore).toHaveLength(1);
    expect(entriesBefore[0]!.title).toBe('Captured Diagram A');
    const entryAId = entriesBefore[0]!.id;

    // Now drive hash change to a valid shared link
    const payload: SharePayload = {
      v: 1,
      scene: sharedScene,
      verifiedBy: 'Teacher Rao',
      note: 'Check this',
      verifiedAt: '2026-11-12T10:00:00Z',
    };
    const hash = `#s=${encodeShare(payload)}`;

    await act(async () => {
      window.location.hash = hash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    // ShareGate should now be displayed
    const gateOpenBtn = container!.querySelector<HTMLButtonElement>('.gt-share-gate__open-btn');
    expect(gateOpenBtn).not.toBeNull();

    // Tap "Open the shared diagram"
    await act(async () => {
      gateOpenBtn!.click();
    });

    // Explore should be showing with the shared scene
    expect(container!.querySelector('.gt-explore')).not.toBeNull();

    // Tap Correct
    const correctBtn = container!.querySelector<HTMLButtonElement>('.gt-explore__correct');
    expect(correctBtn).not.toBeNull();
    await act(async () => {
      correctBtn!.click();
    });

    // Verify Correct component received photoUrl === null (cleared from previous captured photo)
    expect(lastCorrectPhotoUrl).toBeNull();

    // Tap Save inside Correct
    const mockSaveBtn = container!.querySelector<HTMLButtonElement>('.mock-correct-save-btn');
    expect(mockSaveBtn).not.toBeNull();
    await act(async () => {
      mockSaveBtn!.click();
    });

    // Explore screen restored
    expect(container!.querySelector('.gt-explore')).not.toBeNull();

    // The save went through App's real handleSaveCorrect: A is untouched, B is a new entry.
    await flushSaves();
    const after = await observed.store!.list();
    expect(after.ok).toBe(true);
    const entries = after.ok ? after.value : [];
    expect(entries).toHaveLength(2);
    const entryA = entries.find((e) => e.id === entryAId);
    expect(entryA).toBeDefined();
    expect(entryA!.title).toBe('Captured Diagram A');
    expect(entryA!.scene).toEqual(capturedScene);
    const entryB = entries.find((e) => e.id !== entryAId);
    expect(entryB).toBeDefined();
    expect(entryB!.title).toBe('Shared Diagram B');
    expect(entryB!.scene.title).toBe('Shared Diagram B');
  });
});
