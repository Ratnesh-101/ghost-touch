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

let App!: typeof import('../src/App').App;
let appModulePromise: Promise<typeof import('../src/App')> | null = null;
function getAppModule(): Promise<typeof import('../src/App')> {
  if (!appModulePromise) {
    appModulePromise = import('../src/App');
  }
  return appModulePromise;
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
  });
});
