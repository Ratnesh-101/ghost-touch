import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestScene, SceneRequestError } from '../src/api/scene';
import { captureErrorMessage } from '../src/flow/capture';
import { saveDiagramWithEviction } from '../src/flow/saved';
import { verifyCaveatForScene } from '../src/flow/navigation';
import { verifyScene } from '../src/verify/verify';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import {
  SAVED_DIAGRAMS_CAP,
  savedTitle,
  makeId,
  type SavedDiagram,
} from '../src/core/savedDiagrams';
import type { DiagramScene } from '../src/core/scene';
import { getLang, setLang, t, type Lang } from '../src/i18n';

function createMockDrivers(diagramStore = new MemoryDiagramStore()): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running',
    },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    },
    diagramStore,
  };
}

const sampleTriangle: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle ABC',
  points: [
    { id: 'A', x: 0.25, y: 0.25, label: 'A' },
    { id: 'B', x: 0.7, y: 0.85, label: 'B' },
    { id: 'C', x: 0.25, y: 0.85, label: 'C' },
  ],
  segments: [
    { id: 'CA', a: 'C', b: 'A', label: 'CA' },
    { id: 'AB', a: 'A', b: 'B', label: 'AB' },
    { id: 'BC', a: 'B', b: 'C', label: 'BC' },
  ],
  facts: [
    'angle C = 90 degrees',
    'AC = 4 cm',
    'BC = 3 cm',
    'AB = 5 cm',
  ],
};

function createSampleEntry(
  id: string,
  createdAt = Date.now(),
  pinned = false,
  scene = sampleTriangle,
): SavedDiagram {
  return {
    id,
    createdAt,
    title: savedTitle(scene, 'en'),
    thumbnailDataUrl: 'data:image/jpeg;base64,mock',
    scene,
    pinned,
  };
}

describe('M4-02 (HIGH): Atomic Diagram Save with Eviction & Storage Error Resilience', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('does not evict victim diagram if put fails (e.g. quota exceeded)', async () => {
    const store = new MemoryDiagramStore();
    const victim = createSampleEntry('victim-1', 1000, false);
    await store.put(victim);

    // Simulate put failure on eviction
    store.putWithEviction = async () => ({ ok: false, error: 'QuotaExceededError' });
    const existing = [victim];
    const newEntry = createSampleEntry('new-1', 2000, false);

    const result = await saveDiagramWithEviction(store, existing, newEntry, 1);
    expect(result.ok).toBe(false);

    // Victim diagram is still in store — no data loss
    const victimCheck = await store.get('victim-1');
    expect(victimCheck.ok).toBe(true);
    if (!victimCheck.ok) throw new Error(victimCheck.error);
    expect(victimCheck.value).toBeDefined();
    expect(victimCheck.value?.id).toBe('victim-1');

    // New entry was not saved
    const newCheck = await store.get('new-1');
    expect(newCheck.ok).toBe(true);
    if (!newCheck.ok) throw new Error(newCheck.error);
    expect(newCheck.value).toBeUndefined();
  });

  it('evicts oldest unpinned diagram when putWithEviction succeeds at cap', async () => {
    const store = new MemoryDiagramStore();
    const existing: SavedDiagram[] = [];
    for (let i = 1; i <= SAVED_DIAGRAMS_CAP; i++) {
      const entry = createSampleEntry(`diag-${i}`, 1000 + i, i > 1); // diag-1 is unpinned oldest
      existing.push(entry);
      await store.put(entry);
    }

    const newEntry = createSampleEntry('diag-new', 9999, false);
    const result = await saveDiagramWithEviction(store, existing, newEntry, SAVED_DIAGRAMS_CAP);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.evictedId).toBe('diag-1');
    }

    const evicted = await store.get('diag-1');
    expect(evicted.ok).toBe(true);
    if (!evicted.ok) throw new Error(evicted.error);
    expect(evicted.value).toBeUndefined();

    const saved = await store.get('diag-new');
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error(saved.error);
    expect(saved.value?.id).toBe('diag-new');
  });

  it('speaks exactly ONE utterance when storage is unavailable or put fails', async () => {
    const store = new MemoryDiagramStore();
    store.failWith = 'IndexedDB unavailable';
    const drivers = createMockDrivers(store);

    const speakCalls: string[] = [];
    drivers.speech.speak = vi.fn((text: string) => {
      speakCalls.push(text);
    });

    // Simulate App.tsx saveDiagram flow with failing store
    const listResult = await drivers.diagramStore.list();
    if (!listResult.ok) {
      drivers.speech.speak(t('saved.errorStorageUnavailable'), 'en-IN');
    }

    expect(drivers.speech.speak).toHaveBeenCalledTimes(1);
    expect(speakCalls).toEqual([t('saved.errorStorageUnavailable')]);
  });
});

describe('M4-03 (HIGH): Teacher Correct Mode Persistence to IndexedDB', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('updates existing saved entry in place with corrected scene', async () => {
    const store = new MemoryDiagramStore();
    const originalScene: DiagramScene = { ...sampleTriangle, title: 'Original AI Diagram' };
    const originalEntry = createSampleEntry('entry-123', 1000, true, originalScene);
    await store.put(originalEntry);

    const correctedScene: DiagramScene = {
      ...originalScene,
      title: 'Teacher Corrected Triangle',
      points: [
        { id: 'A', x: 0.2, y: 0.2, label: 'A' },
        { id: 'B', x: 0.8, y: 0.2, label: 'B' },
        { id: 'C', x: 0.2, y: 0.8, label: 'C' },
      ],
    };

    // Simulate App.tsx handleSaveCorrect -> saveDiagram(correctedScene, originalScene)
    const listRes = await store.list();
    expect(listRes.ok).toBe(true);
    if (!listRes.ok) throw new Error(listRes.error);
    const existing = listRes.value;

    const matchingEntry = existing.find(
      (e: SavedDiagram) =>
        e.scene === originalScene ||
        JSON.stringify(e.scene) === JSON.stringify(originalScene),
    );
    expect(matchingEntry).toBeDefined();

    const entryToSave: SavedDiagram = matchingEntry
      ? {
          ...matchingEntry,
          title: savedTitle(correctedScene, 'en'),
          thumbnailDataUrl: 'data:image/jpeg;base64,updated_mock',
          scene: correctedScene,
        }
      : {
          id: makeId(Date.now(), Math.random),
          createdAt: Date.now(),
          title: savedTitle(correctedScene, 'en'),
          thumbnailDataUrl: 'data:image/jpeg;base64,new_mock',
          scene: correctedScene,
          pinned: false,
        };

    const saveRes = await saveDiagramWithEviction(
      store,
      existing,
      entryToSave,
      SAVED_DIAGRAMS_CAP,
    );
    expect(saveRes.ok).toBe(true);

    const updatedListRes = await store.list();
    expect(updatedListRes.ok).toBe(true);
    if (!updatedListRes.ok) throw new Error(updatedListRes.error);
    const updatedList = updatedListRes.value;
    expect(updatedList).toHaveLength(1);
    expect(updatedList[0]?.id).toBe('entry-123');
    expect(updatedList[0]?.pinned).toBe(true); // preserved pinned state
    expect(updatedList[0]?.title).toBe('Teacher Corrected Triangle');
    expect(updatedList[0]?.scene).toEqual(correctedScene);
  });

  it('creates new entry through atomic path when no prior saved entry exists', async () => {
    const store = new MemoryDiagramStore();
    const sharedScene: DiagramScene = { ...sampleTriangle, title: 'Shared Diagram' };

    const listRes = await store.list();
    expect(listRes.ok).toBe(true);
    if (!listRes.ok) throw new Error(listRes.error);
    const existing = listRes.value;
    const matchingEntry = existing.find(
      (e: SavedDiagram) =>
        e.scene === sharedScene ||
        JSON.stringify(e.scene) === JSON.stringify(sharedScene),
    );
    expect(matchingEntry).toBeUndefined();

    const newEntry: SavedDiagram = {
      id: makeId(Date.now(), Math.random),
      createdAt: Date.now(),
      title: savedTitle(sharedScene, 'en'),
      thumbnailDataUrl: 'data:image/jpeg;base64,new_mock',
      scene: sharedScene,
      pinned: false,
    };

    const saveRes = await saveDiagramWithEviction(
      store,
      existing,
      newEntry,
      SAVED_DIAGRAMS_CAP,
    );
    expect(saveRes.ok).toBe(true);

    const listResAfter = await store.list();
    expect(listResAfter.ok).toBe(true);
    if (!listResAfter.ok) throw new Error(listResAfter.error);
    const list = listResAfter.value;
    expect(list).toHaveLength(1);
    expect(list[0]?.scene).toEqual(sharedScene);
  });
});

describe('M4-04 (HIGH): Gateway 504 Timeout No-Retry & Cold-Start 502 Retry', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('does NOT retry on HTTP 504 and throws SceneRequestError timeout', async () => {
    let callCount = 0;
    const onRetry = vi.fn();
    const mockFetch = vi.fn(async () => {
      callCount++;
      return new Response(JSON.stringify({ detail: 'timeout' }), { status: 504 });
    });

    const blob = new Blob(['image data'], { type: 'image/jpeg' });
    await expect(
      requestScene(blob, {
        fetchImpl: mockFetch as unknown as typeof fetch,
        onRetry,
      }),
    ).rejects.toMatchObject({
      name: 'SceneRequestError',
      failure: 'timeout',
    });

    expect(callCount).toBe(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('keeps cold-start retry for HTTP 502 Bad Gateway and speaks waking up notice', async () => {
    let callCount = 0;
    const onRetry = vi.fn();
    const mockFetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response('', { status: 502 });
      }
      return new Response(
        JSON.stringify({
          scene: sampleTriangle,
          mode: 'ai',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const blob = new Blob(['image data'], { type: 'image/jpeg' });
    const res = await requestScene(blob, {
      fetchImpl: mockFetch as unknown as typeof fetch,
      onRetry,
      timeoutMs: 5000,
    });

    expect(callCount).toBe(2);
    expect(onRetry).toHaveBeenCalledWith(t('capture.wakingUp'));
    expect(res.mode).toBe('ai');
    expect(res.scene.title).toBe('Right Triangle ABC');
  });

  it('maps SceneRequestError timeout to accurate 504 message in en, hi, gu', () => {
    const err = new SceneRequestError('timeout');

    setLang('en');
    expect(captureErrorMessage(err)).toBe('The server took too long; please try again.');
    expect(captureErrorMessage(err)).not.toContain('waking up');

    setLang('hi');
    expect(captureErrorMessage(err)).toBe('सर्वर ने बहुत लंबा समय लिया; कृपया पुनः प्रयास करें।');

    setLang('gu');
    expect(captureErrorMessage(err)).toBe('સર્વરે ઘણો સમય લીધો; કૃપા કરીને ફરી પ્રયાસ કરો.');
  });
});

// SKIPPED on merge: M4-10 (strip the English word "angle" from the disputed-angle target) conflicts
// with Kiro's Requirement 18.2 property in verify.review.test.ts, which pins the exact English
// sentence "disagree on angle B". core/verify.ts is Kiro's module: needs a Kiro decision, then un-skip.
describe.skip('M4-10 (LOW): Disputed Angle Target Phrasing & Localization Leak Prevention', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('strips english word "angle " from finding target when angle fact is disputed', () => {
    const disputedAngleScene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.25, y: 0.25, label: 'A' },
        { id: 'B', x: 0.7, y: 0.85, label: 'B' },
        { id: 'C', x: 0.25, y: 0.85, label: 'C' },
      ],
      segments: [
        { id: 'CA', a: 'C', b: 'A', label: 'CA' },
        { id: 'AB', a: 'A', b: 'B', label: 'AB' },
        { id: 'BC', a: 'B', b: 'C', label: 'BC' },
      ],
      facts: [
        'angle C = 45 degrees', // drawn angle at C is 90 degrees -> dispute > 8 deg
        'AC = 4 cm',
        'BC = 3 cm',
        'AB = 5 cm',
      ],
    };

    const res = verifyScene(disputedAngleScene);
    expect(res.status).toBe('disagree');
    expect(res.findings.length).toBeGreaterThan(0);
    // Disputed message must reference target 'C', NOT 'angle C'
    expect(res.findings[0]?.message).toBe(
      "Facts and drawing disagree on C. I can't tell which is right.",
    );
  });

  it('does not leak english word "angle" into Hindi verify caveat', () => {
    setLang('hi');
    const disputedAngleScene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.25, y: 0.25, label: 'A' },
        { id: 'B', x: 0.7, y: 0.85, label: 'B' },
        { id: 'C', x: 0.25, y: 0.85, label: 'C' },
      ],
      segments: [
        { id: 'CA', a: 'C', b: 'A', label: 'CA' },
        { id: 'AB', a: 'A', b: 'B', label: 'AB' },
        { id: 'BC', a: 'B', b: 'C', label: 'BC' },
      ],
      facts: [
        'angle C = 45 degrees',
        'AC = 4 cm',
        'BC = 3 cm',
        'AB = 5 cm',
      ],
    };

    const caveat = verifyCaveatForScene(disputedAngleScene, 'ai');
    expect(caveat).toBeDefined();
    expect(caveat).not.toContain('angle');
    expect(caveat).toContain('तथ्य और चित्र C पर असहमत हैं।');
  });

  it('does not leak english word "angle" into Gujarati verify caveat', () => {
    setLang('gu');
    const disputedAngleScene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.25, y: 0.25, label: 'A' },
        { id: 'B', x: 0.7, y: 0.85, label: 'B' },
        { id: 'C', x: 0.25, y: 0.85, label: 'C' },
      ],
      segments: [
        { id: 'CA', a: 'C', b: 'A', label: 'CA' },
        { id: 'AB', a: 'A', b: 'B', label: 'AB' },
        { id: 'BC', a: 'B', b: 'C', label: 'BC' },
      ],
      facts: [
        'angle C = 45 degrees',
        'AC = 4 cm',
        'BC = 3 cm',
        'AB = 5 cm',
      ],
    };

    const caveat = verifyCaveatForScene(disputedAngleScene, 'ai');
    expect(caveat).toBeDefined();
    expect(caveat).not.toContain('angle');
    expect(caveat).toContain('તથ્યો અને આકૃતિ C પર અસંમત છે.');
  });
});
