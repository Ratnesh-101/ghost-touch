// @vitest-environment jsdom
/**
 * Test suite for CORE-A9: LoadModal shows localised saved titles using savedTitle(scene, lang).
 *
 * Verifies:
 * 1. Saved diagrams without scene.title show language-aware titles (e.g. Hindi kind name)
 *    rather than stale original English titles.
 * 2. onLoadScene receives the language-aware title when clicked.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import type { SavedDiagram } from '../src/core/savedDiagrams';
import { LoadModal } from '../src/components/teach/LoadModal';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { setLang } from '../src/i18n';

const untitledTriangleScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.5, y: 0.2, label: 'C' },
  ],
  segments: [],
};

const savedEntrySavedInEnglish: SavedDiagram = {
  id: 'saved-entry-1',
  createdAt: Date.now(),
  title: 'geometry: A, B, C', // Stale English title saved originally
  thumbnailDataUrl: '',
  scene: untitledTriangleScene,
  pinned: false,
};

describe('CORE-A9: LoadModal shows localised saved titles', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let testDrivers: Drivers;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const store = new MemoryDiagramStore();
    await store.put(savedEntrySavedInEnglish);

    testDrivers = {
      haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        state: 'running',
      },
      speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
      diagramStore: store,
    };
  });

  afterEach(async () => {
    setLang('en');
    if (root && container) {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
    }
    container = null;
    root = null;
    vi.restoreAllMocks();
  });

  it('shows Hindi kind name for untitled diagram when language is Hindi', async () => {
    setLang('hi');
    const onLoadScene = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root!.render(
        createElement(LoadModal, {
          open: true,
          drivers: testDrivers,
          onClose,
          onLoadScene,
        }),
      );
    });

    // Wait for saved list fetch
    const titleSpan = container!.querySelector('.gt-teach-modal__saved-title');
    expect(titleSpan).not.toBeNull();
    // In Hindi, geometry kind is 'ज्यामिति'
    expect(titleSpan?.textContent).toBe('ज्यामिति: A, B, C');
    expect(titleSpan?.textContent).not.toBe('geometry: A, B, C');

    // Click saved diagram
    const itemBtn = container!.querySelector<HTMLButtonElement>(
      '.gt-teach-modal__saved-btn',
    );
    await act(async () => {
      itemBtn!.click();
    });

    // onLoadScene was called with the localised title
    expect(onLoadScene).toHaveBeenCalledWith(untitledTriangleScene, 'ज्यामिति: A, B, C');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Gujarati kind name for untitled diagram when language is Gujarati', async () => {
    setLang('gu');
    const onLoadScene = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root!.render(
        createElement(LoadModal, {
          open: true,
          drivers: testDrivers,
          onClose,
          onLoadScene,
        }),
      );
    });

    const titleSpan = container!.querySelector('.gt-teach-modal__saved-title');
    expect(titleSpan).not.toBeNull();
    // In Gujarati, geometry kind is 'ભૂમિતિ'
    expect(titleSpan?.textContent).toBe('ભૂમિતિ: A, B, C');

    const itemBtn = container!.querySelector<HTMLButtonElement>(
      '.gt-teach-modal__saved-btn',
    );
    await act(async () => {
      itemBtn!.click();
    });

    expect(onLoadScene).toHaveBeenCalledWith(untitledTriangleScene, 'ભૂમિતિ: A, B, C');
  });

  it('preserves user custom scene.title when non-blank across languages', async () => {
    setLang('hi');
    const titledScene: DiagramScene = {
      ...untitledTriangleScene,
      title: 'Custom User Title',
    };
    const titledEntry: SavedDiagram = {
      ...savedEntrySavedInEnglish,
      id: 'titled-entry',
      title: 'Custom User Title',
      scene: titledScene,
    };
    const store = new MemoryDiagramStore();
    await store.put(titledEntry);
    const drivers = { ...testDrivers, diagramStore: store };

    await act(async () => {
      root!.render(
        createElement(LoadModal, {
          open: true,
          drivers,
          onClose: vi.fn(),
          onLoadScene: vi.fn(),
        }),
      );
    });

    const titleSpan = container!.querySelector('.gt-teach-modal__saved-title');
    expect(titleSpan?.textContent).toBe('Custom User Title');
  });
});
