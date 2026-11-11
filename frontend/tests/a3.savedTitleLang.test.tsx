/**
 * @vitest-environment jsdom
 */

/**
 * Tests for Lane a3-saved-title-lang:
 * Saved screen titles follow the active language at render time.
 *
 * Verifies:
 * - Untitled geometry scene stored with 'geometry' (in 'en') displays, speaks,
 *   and provides aria-labels with the Hindi kind name in 'hi'.
 * - Displays and speaks 'geometry' in 'en'.
 * - A scene with its own title displays that title unchanged in every language.
 * - Stored entry object is not mutated.
 * - List re-renders dynamically when active language switches.
 * - Open, pin, delete announcements and accessible names use displayed title.
 * - onOpen receives the displayed title.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  KIND_NAMES,
  type SavedDiagram,
} from '../src/core/savedDiagrams';
import { MemoryDiagramStore } from '../src/drivers/diagramStore';
import type { SpeechDriver, SpeechRateSetting } from '../src/drivers';
import { getLang, setLang, t, type Lang } from '../src/i18n';
import {
  SavedDiagrams,
  type SavedDiagramsProps,
} from '../src/screens/SavedDiagrams';

function createMockSpeech(): {
  speech: SpeechDriver;
  spoken: Array<{ text: string; langBcp47?: string }>;
} {
  const spoken: Array<{ text: string; langBcp47?: string }> = [];
  const speech: SpeechDriver = {
    speak: vi.fn((text: string, langBcp47?: string) => {
      spoken.push({ text, langBcp47 });
    }),
    listen: vi.fn(),
    canSpeak: true,
    canListen: true,
    getRate: vi.fn((): SpeechRateSetting => 'normal'),
    setRate: vi.fn(),
  };
  return { speech, spoken };
}

describe('Lane a3-saved-title-lang: SavedDiagrams screen language titles', () => {
  let prevLang: Lang;
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    setLang(prevLang);
    vi.restoreAllMocks();
  });

  async function mountSavedDiagrams(props: SavedDiagramsProps): Promise<void> {
    root = createRoot(container!);
    await act(async () => {
      root?.render(createElement(SavedDiagrams, props));
    });
    // Allow loadSavedList microtasks and state update to flush
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }

  it('renders Hindi kind name for untitled geometry scene stored in English', async () => {
    setLang('hi');
    const store = new MemoryDiagramStore();
    const untitledScene: DiagramScene = {
      kind: 'geometry',
    };
    const storedEntry: SavedDiagram = {
      id: 'd-geo-untitled',
      createdAt: 1000,
      title: 'geometry', // English kind string stored at save time
      thumbnailDataUrl: 'data:image/jpeg;base64,fake',
      scene: untitledScene,
      pinned: false,
    };
    const entrySnapshot = JSON.stringify(storedEntry);
    await store.put(storedEntry);

    const { speech, spoken } = createMockSpeech();
    const onOpen = vi.fn();
    const onBack = vi.fn();

    await mountSavedDiagrams({
      diagramStore: store,
      speech,
      onOpen,
      onBack,
    });

    const expectedHindiKind = KIND_NAMES['hi']?.['geometry'];
    if (expectedHindiKind === undefined) {
      throw new Error('missing hi geometry name in KIND_NAMES');
    }
    expect(expectedHindiKind).toBe('ज्यामिति');

    // 1. Visible title text uses Hindi kind name, not English slug
    const titleEl = container!.querySelector('.gt-saved__title');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBe(expectedHindiKind);
    expect(titleEl?.textContent).not.toBe('geometry');

    // 2. Open button aria-label uses Hindi kind name
    const openBtn = container!.querySelector<HTMLButtonElement>('.gt-saved__btn--open');
    expect(openBtn).not.toBeNull();
    const expectedOpenAria = `${t('saved.open')} ${expectedHindiKind}`;
    expect(openBtn?.getAttribute('aria-label')).toBe(expectedOpenAria);

    // 3. Open button click speaks Hindi kind name and delivers it to onOpen
    await act(async () => {
      openBtn?.click();
    });

    const expectedOpenSpoken = t('saved.opened').replace('{title}', expectedHindiKind);
    const openSpeakCall = spoken.find((s) => s.text === expectedOpenSpoken);
    expect(openSpeakCall).toBeDefined();
    expect(openSpeakCall?.langBcp47).toBe('hi-IN');

    expect(onOpen).toHaveBeenCalledWith(
      untitledScene,
      expectedHindiKind,
      'd-geo-untitled',
    );

    // 4. Stored entry object is not mutated
    expect(storedEntry.title).toBe('geometry');
    expect(JSON.stringify(storedEntry)).toBe(entrySnapshot);
    const fromStore = await store.get('d-geo-untitled');
    expect(fromStore.ok).toBe(true);
    if (fromStore.ok && fromStore.value) {
      expect(fromStore.value.title).toBe('geometry');
    }
  });

  it('renders "geometry" in English for untitled geometry scene', async () => {
    setLang('en');
    const store = new MemoryDiagramStore();
    const untitledScene: DiagramScene = {
      kind: 'geometry',
    };
    const storedEntry: SavedDiagram = {
      id: 'd-geo-en',
      createdAt: 1000,
      title: 'geometry',
      thumbnailDataUrl: '',
      scene: untitledScene,
      pinned: false,
    };
    await store.put(storedEntry);

    const { speech, spoken } = createMockSpeech();
    const onOpen = vi.fn();

    await mountSavedDiagrams({
      diagramStore: store,
      speech,
      onOpen,
      onBack: vi.fn(),
    });

    // 1. Visible title shows 'geometry'
    const titleEl = container!.querySelector('.gt-saved__title');
    expect(titleEl?.textContent).toBe('geometry');

    // 2. Open button aria-label shows 'Open geometry'
    const openBtn = container!.querySelector<HTMLButtonElement>('.gt-saved__btn--open');
    expect(openBtn?.getAttribute('aria-label')).toBe('Open geometry');

    // 3. Spoken announcement and onOpen receive 'geometry'
    await act(async () => {
      openBtn?.click();
    });

    const expectedOpenSpoken = t('saved.opened').replace('{title}', 'geometry');
    expect(expectedOpenSpoken).toContain('geometry');
    const spokenCall = spoken.find(
      (s) => s.text === expectedOpenSpoken && s.langBcp47 === 'en-IN',
    );
    expect(spokenCall).toBeDefined();
    expect(spokenCall?.text).toBe(expectedOpenSpoken);
    expect(spokenCall?.text).toContain('geometry');
    expect(onOpen).toHaveBeenCalledWith(untitledScene, 'geometry', 'd-geo-en');
  });

  it('shows scene own title in every language (en, hi, gu)', async () => {
    const sceneWithTitle: DiagramScene = {
      kind: 'geometry',
      title: 'Pythagorean Triangle',
      points: [
        { id: 'p1', x: 0, y: 0, label: 'A' },
        { id: 'p2', x: 1, y: 0, label: 'B' },
      ],
    };
    const storedEntry: SavedDiagram = {
      id: 'd-real-title',
      createdAt: 2000,
      title: 'Pythagorean Triangle',
      thumbnailDataUrl: '',
      scene: sceneWithTitle,
      pinned: false,
    };

    for (const testLang of ['en', 'hi', 'gu'] as const) {
      setLang(testLang);
      const store = new MemoryDiagramStore();
      await store.put(storedEntry);
      const { speech, spoken } = createMockSpeech();
      const onOpen = vi.fn();

      await mountSavedDiagrams({
        diagramStore: store,
        speech,
        onOpen,
        onBack: vi.fn(),
      });

      const titleEl = container!.querySelector('.gt-saved__title');
      expect(titleEl?.textContent).toBe('Pythagorean Triangle');

      const openBtn = container!.querySelector<HTMLButtonElement>('.gt-saved__btn--open');
      expect(openBtn?.getAttribute('aria-label')).toBe(
        `${t('saved.open')} Pythagorean Triangle`,
      );

      await act(async () => {
        openBtn?.click();
      });

      const expectedMsg = t('saved.opened').replace('{title}', 'Pythagorean Triangle');
      expect(spoken.some((s) => s.text === expectedMsg)).toBe(true);
      expect(onOpen).toHaveBeenCalledWith(
        sceneWithTitle,
        'Pythagorean Triangle',
        'd-real-title',
      );

      // Clean up root for next iteration
      act(() => {
        root?.unmount();
      });
      root = null;
    }
  });

  it('dynamically re-renders displayed titles when language changes without remounting', async () => {
    setLang('en');
    const store = new MemoryDiagramStore();
    const untitledScene: DiagramScene = {
      kind: 'geometry',
    };
    const storedEntry: SavedDiagram = {
      id: 'd-dynamic-lang',
      createdAt: 1000,
      title: 'geometry',
      thumbnailDataUrl: '',
      scene: untitledScene,
      pinned: false,
    };
    await store.put(storedEntry);

    const { speech } = createMockSpeech();
    await mountSavedDiagrams({
      diagramStore: store,
      speech,
      onOpen: vi.fn(),
      onBack: vi.fn(),
    });

    const titleEl = container!.querySelector('.gt-saved__title');
    const openBtn = container!.querySelector<HTMLButtonElement>('.gt-saved__btn--open');
    expect(titleEl?.textContent).toBe('geometry');
    expect(openBtn?.getAttribute('aria-label')).toBe('Open geometry');

    // Switch to Hindi
    act(() => {
      setLang('hi');
    });

    const hindiKind = KIND_NAMES['hi']?.['geometry'];
    if (hindiKind === undefined) {
      throw new Error('missing hi geometry name in KIND_NAMES');
    }
    expect(titleEl?.textContent).toBe(hindiKind);
    expect(openBtn?.getAttribute('aria-label')).toBe(`${t('saved.open')} ${hindiKind}`);

    // Switch to Gujarati
    act(() => {
      setLang('gu');
    });

    const gujaratiKind = KIND_NAMES['gu']?.['geometry'];
    if (gujaratiKind === undefined) {
      throw new Error('missing gu geometry name in KIND_NAMES');
    }
    expect(titleEl?.textContent).toBe(gujaratiKind);
    expect(openBtn?.getAttribute('aria-label')).toBe(`${t('saved.open')} ${gujaratiKind}`);
  });

  it('uses active language title for pin, unpin, and delete announcements and aria-labels', async () => {
    setLang('hi');
    const store = new MemoryDiagramStore();
    const untitledScene: DiagramScene = {
      kind: 'bar_chart',
    };
    const storedEntry: SavedDiagram = {
      id: 'd-barchart',
      createdAt: 1000,
      title: 'bar_chart',
      thumbnailDataUrl: '',
      scene: untitledScene,
      pinned: false,
    };
    await store.put(storedEntry);

    const { speech, spoken } = createMockSpeech();
    await mountSavedDiagrams({
      diagramStore: store,
      speech,
      onOpen: vi.fn(),
      onBack: vi.fn(),
    });

    const hindiBarKind = KIND_NAMES['hi']?.['bar_chart'];
    if (hindiBarKind === undefined) {
      throw new Error('missing hi bar_chart name in KIND_NAMES');
    }
    expect(hindiBarKind).toBe('बार चार्ट');

    // 1. Pin button aria-label and action
    const pinBtn = container!.querySelector<HTMLButtonElement>('.gt-saved__btn--pin');
    expect(pinBtn?.getAttribute('aria-label')).toBe(`${t('saved.pin')} ${hindiBarKind}`);

    await act(async () => {
      pinBtn?.click();
    });

    const expectedPinnedSpoken = t('saved.pinned.announced')
      .replace('{title}', hindiBarKind);
    expect(spoken.some((s) => s.text === expectedPinnedSpoken)).toBe(true);
    expect(pinBtn?.getAttribute('aria-label')).toBe(`${t('saved.unpin')} ${hindiBarKind}`);

    // Unpin action
    await act(async () => {
      pinBtn?.click();
    });

    const expectedUnpinnedSpoken = t('saved.unpinned.announced')
      .replace('{title}', hindiBarKind);
    expect(spoken.some((s) => s.text === expectedUnpinnedSpoken)).toBe(true);

    // 2. Delete request aria-label and confirmation speech
    const deleteBtn = container!.querySelector<HTMLButtonElement>('.gt-saved__btn--delete');
    expect(deleteBtn?.getAttribute('aria-label')).toBe(`${t('saved.delete')} ${hindiBarKind}`);

    await act(async () => {
      deleteBtn?.click();
    });

    const expectedDeleteConfirmSpoken = t('saved.deleteConfirm')
      .replace('{title}', hindiBarKind);
    expect(spoken.some((s) => s.text === expectedDeleteConfirmSpoken)).toBe(true);

    // Confirm button aria-label uses active language title
    const confirmBtn = container!.querySelector<HTMLButtonElement>('.gt-saved__btn--confirm');
    expect(confirmBtn?.getAttribute('aria-label')).toBe(
      `${t('saved.confirmDelete')} ${hindiBarKind}`,
    );

    // Cancel button aria-label uses active language title
    const cancelBtn = container!.querySelector<HTMLButtonElement>('.gt-saved__btn--cancel');
    expect(cancelBtn?.getAttribute('aria-label')).toBe(
      `${t('saved.cancel')} ${hindiBarKind}`,
    );

    // 3. Confirm deletion speaks deleted announcement with active language title
    await act(async () => {
      confirmBtn?.click();
    });

    const expectedDeletedSpoken = t('saved.deleted').replace('{title}', hindiBarKind);
    expect(spoken.some((s) => s.text.includes(expectedDeletedSpoken))).toBe(true);
  });

  it('synthesises kind with labelled points in the active language', async () => {
    const sceneWithPoints: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'p1', x: 0, y: 0, label: 'A' },
        { id: 'p2', x: 1, y: 0, label: 'B' },
      ],
    };
    const storedEntry: SavedDiagram = {
      id: 'd-points',
      createdAt: 1000,
      title: 'geometry: A, B', // saved initially in English
      thumbnailDataUrl: '',
      scene: sceneWithPoints,
      pinned: false,
    };

    setLang('hi');
    const store = new MemoryDiagramStore();
    await store.put(storedEntry);

    const { speech } = createMockSpeech();
    await mountSavedDiagrams({
      diagramStore: store,
      speech,
      onOpen: vi.fn(),
      onBack: vi.fn(),
    });

    const titleEl = container!.querySelector('.gt-saved__title');
    expect(titleEl?.textContent).toBe('ज्यामिति: A, B');

    // In Gujarati
    act(() => {
      setLang('gu');
    });
    expect(titleEl?.textContent).toBe('ભૂમિતિ: A, B');

    // In English
    act(() => {
      setLang('en');
    });
    expect(titleEl?.textContent).toBe('geometry: A, B');
  });

  it('respects optional lang prop when passed directly', async () => {
    // Current global lang is en, but prop is 'gu'
    setLang('en');
    const store = new MemoryDiagramStore();
    const untitledScene: DiagramScene = {
      kind: 'function_graph',
    };
    const storedEntry: SavedDiagram = {
      id: 'd-func',
      createdAt: 1000,
      title: 'function_graph',
      thumbnailDataUrl: '',
      scene: untitledScene,
      pinned: false,
    };
    await store.put(storedEntry);

    const { speech } = createMockSpeech();
    await mountSavedDiagrams({
      diagramStore: store,
      speech,
      onOpen: vi.fn(),
      onBack: vi.fn(),
      lang: 'gu',
    });

    const guFuncKind = KIND_NAMES['gu']?.['function_graph'];
    if (guFuncKind === undefined) {
      throw new Error('missing gu function_graph name in KIND_NAMES');
    }
    const titleEl = container!.querySelector('.gt-saved__title');
    expect(titleEl?.textContent).toBe(guFuncKind);
    expect(titleEl?.textContent).toBe('વિધેય આલેખ');
  });
});
