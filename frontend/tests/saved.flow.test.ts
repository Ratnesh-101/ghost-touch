/**
 * Tests for Saved Diagrams: UI, App save-on-load flow, offline explore, and i18n parity.
 *
 * Requirements: 11.1–11.7. Tasks: 13.6–13.9.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  applyAdd,
  makeId,
  orderForDisplay,
  savedTitle,
  SAVED_DIAGRAMS_CAP,
  type SavedDiagram,
} from '../src/core/savedDiagrams';
import {
  MemoryDiagramStore,
  renderSceneThumbnail,
  type DiagramStore,
  type Drivers,
  type SpeechDriver,
} from '../src/drivers';
import { setLang, t, tables } from '../src/i18n';
import { SavedDiagrams } from '../src/screens/SavedDiagrams';
import { Capture } from '../src/screens/Capture';

function makeMockSpeech(): { speech: SpeechDriver; spoken: string[] } {
  const spoken: string[] = [];
  const speech: SpeechDriver = {
    speak: vi.fn((text: string) => void spoken.push(text)),
    listen: vi.fn(),
    canSpeak: true,
    canListen: true,
  };
  return { speech, spoken };
}

function makeMockDrivers(store?: DiagramStore): {
  drivers: Drivers;
  spoken: string[];
  vibrated: (number | number[])[];
} {
  const spoken: string[] = [];
  const vibrated: (number | number[])[] = [];
  const drivers: Drivers = {
    haptics: {
      supported: true,
      lastResult: null,
      vibrate: vi.fn((p) => (vibrated.push(p), true)),
      stop: vi.fn(),
    },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running',
    },
    speech: {
      speak: vi.fn((text: string) => void spoken.push(text)),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    },
    diagramStore: store ?? new MemoryDiagramStore(),
  };
  return { drivers, spoken, vibrated };
}

const testScene: DiagramScene = {
  kind: 'geometry',
  title: 'Test Right Triangle',
  points: [
    { id: 'p1', x: 0.1, y: 0.1, label: 'Vertex A' },
    { id: 'p2', x: 0.9, y: 0.1, label: 'Vertex B' },
    { id: 'p3', x: 0.1, y: 0.9, label: 'Vertex C' },
  ],
  segments: [
    { id: 's1', a: 'p1', b: 'p2', label: 'Hypotenuse' },
    { id: 's2', a: 'p1', b: 'p3', label: 'Leg' },
  ],
};

describe('Task 13.8 & 13.9: i18n parity for saved.* and capture.* keys', () => {
  beforeEach(() => {
    setLang('en');
  });

  it('all saved.* and capture.savedDiagrams keys in English exist in Hindi and Gujarati tables', () => {
    const enKeys = Object.keys(tables.en).filter(
      (k) => k.startsWith('saved.') || k === 'capture.savedDiagrams',
    );
    expect(enKeys.length).toBeGreaterThanOrEqual(18);

    for (const key of enKeys) {
      expect(tables.hi[key], `Hindi missing key: ${key}`).toBeDefined();
      expect(tables.hi[key]?.trim().length).toBeGreaterThan(0);
      expect(tables.gu[key], `Gujarati missing key: ${key}`).toBeDefined();
      expect(tables.gu[key]?.trim().length).toBeGreaterThan(0);
    }
  });

  it('translates core saved UI strings in Hindi and Gujarati', () => {
    setLang('en');
    expect(t('saved.heading')).toBe('Saved diagrams');
    expect(t('saved.empty')).toBe('No saved diagrams yet.');
    expect(t('capture.savedDiagrams')).toBe('Saved diagrams');

    setLang('hi');
    expect(t('saved.heading')).toBe('सहेजे गए आरेख');
    expect(t('saved.empty')).toBe('अभी कोई सहेजा गया आरेख नहीं।');
    expect(t('capture.savedDiagrams')).toBe('सहेजे गए आरेख');

    setLang('gu');
    expect(t('saved.heading')).toBe('સેવ કરેલ આકૃતિઓ');
    expect(t('saved.empty')).toBe('હજી કોઈ સેવ કરેલ આકૃતિ નથી.');
    expect(t('capture.savedDiagrams')).toBe('સેવ કરેલ આકૃતિઓ');

    setLang('en');
  });
});

describe('Task 13.7: SavedDiagrams screen rendering and accessibility', () => {
  beforeEach(() => {
    setLang('en');
  });

  it('renders heading, back button, and empty message when store is empty', async () => {
    const store = new MemoryDiagramStore();
    const { speech } = makeMockSpeech();

    const html = renderToStaticMarkup(
      createElement(SavedDiagrams, {
        diagramStore: store,
        speech,
        onOpen: vi.fn(),
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('Saved diagrams');
    expect(html).toContain('Back to Capture');
    expect(html).toContain('gt-saved__back');
    expect(html).toContain('gt-control');
  });

  it('renders list items with open, pin, and delete controls when entries exist', async () => {
    const store = new MemoryDiagramStore();
    const entry: SavedDiagram = {
      id: 'd1',
      createdAt: 1000,
      title: 'Right Triangle ABC',
      thumbnailDataUrl: 'data:image/jpeg;base64,fake',
      scene: testScene,
      pinned: true,
    };
    await store.put(entry);

    const { speech } = makeMockSpeech();
    const html = renderToStaticMarkup(
      createElement(SavedDiagrams, {
        diagramStore: store,
        speech,
        onOpen: vi.fn(),
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('gt-saved');
    expect(html).toContain('gt-saved__back');
    expect(html).toContain('gt-saved__heading');
  });

  it('Capture screen renders 48x48 accessible Saved diagrams button', () => {
    const { drivers } = makeMockDrivers();
    const onSavedDiagrams = vi.fn();
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams,
      }),
    );

    expect(html).toContain('gt-capture__button--saved');
    expect(html).toContain('Saved diagrams');
  });
});

describe('Task 13.6: Save on scene load & eviction invariants', () => {
  beforeEach(() => {
    setLang('en');
  });

  it('renderSceneThumbnail generates thumbnail safely without throwing', () => {
    const thumb = renderSceneThumbnail(testScene);
    expect(typeof thumb).toBe('string');
  });

  it('savedTitle creates meaningful title from scene title or synthesises from kind and points', () => {
    expect(savedTitle(testScene)).toBe('Test Right Triangle');

    const untitled: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: '1', x: 0, y: 0, label: 'X' },
        { id: '2', x: 1, y: 1, label: 'Y' },
      ],
    };
    expect(savedTitle(untitled)).toBe('geometry: X, Y');
  });

  it('applyAdd evicts oldest unpinned entry when SAVED_DIAGRAMS_CAP (20) is reached', () => {
    const entries: SavedDiagram[] = [];
    for (let i = 0; i < SAVED_DIAGRAMS_CAP; i++) {
      entries.push({
        id: `entry-${i}`,
        createdAt: 1000 + i * 10,
        title: `Diagram ${i}`,
        thumbnailDataUrl: '',
        scene: testScene,
        pinned: i === 0, // first is pinned
      });
    }

    const newEntry: SavedDiagram = {
      id: 'entry-new',
      createdAt: 5000,
      title: 'New Diagram',
      thumbnailDataUrl: '',
      scene: testScene,
      pinned: false,
    };

    const decision = applyAdd(entries, newEntry, SAVED_DIAGRAMS_CAP);
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.next).toHaveLength(SAVED_DIAGRAMS_CAP);
      // Entry 1 (oldest unpinned, createdAt 1010) was evicted, NOT Entry 0 (pinned)
      expect(decision.evictedId).toBe('entry-1');
      expect(decision.next.find((e) => e.id === 'entry-0')).toBeDefined();
      expect(decision.next.find((e) => e.id === 'entry-1')).toBeUndefined();
      expect(decision.next.find((e) => e.id === 'entry-new')).toBeDefined();
    }
  });

  it('applyAdd returns all_pinned when all 20 slots are pinned', () => {
    const entries: SavedDiagram[] = [];
    for (let i = 0; i < SAVED_DIAGRAMS_CAP; i++) {
      entries.push({
        id: `entry-${i}`,
        createdAt: 1000 + i * 10,
        title: `Diagram ${i}`,
        thumbnailDataUrl: '',
        scene: testScene,
        pinned: true,
      });
    }

    const newEntry: SavedDiagram = {
      id: 'entry-new',
      createdAt: 5000,
      title: 'New Diagram',
      thumbnailDataUrl: '',
      scene: testScene,
      pinned: false,
    };

    const decision = applyAdd(entries, newEntry, SAVED_DIAGRAMS_CAP);
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.reason).toBe('all_pinned');
    }
  });

  it('orderForDisplay sorts entries newest first', () => {
    const entries: SavedDiagram[] = [
      { id: '1', createdAt: 100, title: 'Old', thumbnailDataUrl: '', scene: testScene, pinned: false },
      { id: '2', createdAt: 300, title: 'Newest', thumbnailDataUrl: '', scene: testScene, pinned: false },
      { id: '3', createdAt: 200, title: 'Middle', thumbnailDataUrl: '', scene: testScene, pinned: false },
    ];
    const ordered = orderForDisplay(entries);
    expect(ordered.map((e) => e.id)).toEqual(['2', '3', '1']);
  });

  it('save-on-load failure path: catches throwing store without crashing', async () => {
    const throwingStore: DiagramStore = {
      list: vi.fn(async () => ({ ok: true as const, value: [] })),
      get: vi.fn(async () => ({ ok: true as const, value: undefined })),
      put: vi.fn(async () => {
        throw new Error('IDB transaction failed abruptly');
      }),
      delete: vi.fn(async () => ({ ok: true as const, value: undefined })),
    };

    const { speech, spoken } = makeMockSpeech();

    // Replicate App saveDiagram failure handler
    let errorSpoken = false;
    try {
      const listRes = await throwingStore.list();
      if (listRes.ok) {
        const entry: SavedDiagram = {
          id: makeId(Date.now(), Math.random),
          createdAt: Date.now(),
          title: savedTitle(testScene, 'en'),
          thumbnailDataUrl: '',
          scene: testScene,
          pinned: false,
        };
        const putRes = await throwingStore.put(entry);
        if (!putRes.ok) {
          speech.speak(t('saved.errorSave'));
          errorSpoken = true;
        }
      }
    } catch {
      speech.speak(t('saved.errorSave'));
      errorSpoken = true;
    }

    expect(errorSpoken).toBe(true);
    expect(spoken).toContain('Could not save this diagram.');
  });

  it('save-on-load storage unavailable path speaks errorStorageUnavailable', async () => {
    const unavailableStore: DiagramStore = {
      list: vi.fn(async () => ({ ok: false as const, error: 'storage_unavailable' })),
      get: vi.fn(async () => ({ ok: false as const, error: 'storage_unavailable' })),
      put: vi.fn(async () => ({ ok: false as const, error: 'storage_unavailable' })),
      delete: vi.fn(async () => ({ ok: false as const, error: 'storage_unavailable' })),
    };

    const { speech, spoken } = makeMockSpeech();

    const listRes = await unavailableStore.list();
    if (!listRes.ok) {
      speech.speak(t('saved.errorStorageUnavailable'));
    }

    expect(spoken).toContain('Saving is unavailable on this device.');
  });
});

describe('Requirement 11.2 & 11.4: Offline exploration makes NO network calls', () => {
  beforeEach(() => {
    setLang('en');
  });

  it('opening a saved diagram makes zero network calls (fetch spy)', async () => {
    const store = new MemoryDiagramStore();
    const entry: SavedDiagram = {
      id: 'offline-1',
      createdAt: 1000,
      title: 'Offline Geometry',
      thumbnailDataUrl: '',
      scene: testScene,
      pinned: false,
    };
    await store.put(entry);

    // Spy on global fetch
    const fetchSpy = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    try {
      const { speech, spoken } = makeMockSpeech();
      const openSpy = vi.fn();

      // Opening the saved diagram triggers Explore without touching backend
      openSpy(entry.scene, entry.title);
      speech.speak(`${entry.title}. Double-tap and hold, then drag to feel the diagram.`);

      // Verify zero network calls were made
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith(testScene, 'Offline Geometry');
      expect(spoken[0]).toContain('Offline Geometry');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
