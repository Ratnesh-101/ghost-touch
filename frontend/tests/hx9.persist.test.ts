import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedDiagram } from '../src/core/savedDiagrams';
import { MemoryDiagramStore } from '../src/drivers/diagramStore';
import {
  requestPersistentStorage,
  resetPersistentStorageForTest,
} from '../src/drivers/persist';
import { saveDiagramWithEviction } from '../src/flow/saved';

function makeSampleDiagram(id: string, pinned = false): SavedDiagram {
  return {
    id,
    title: `Diagram ${id}`,
    createdAt: 1000,
    pinned,
    thumbnailDataUrl: 'data:image/jpeg;base64,sample',
    scene: {
      kind: 'geometry',
      points: [],
      segments: [],
      polylines: [],
      bars: [],
    },
  };
}

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
);

function setNavigator(mockNavigator: unknown): void {
  Object.defineProperty(globalThis, 'navigator', {
    value: mockNavigator,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

function restoreNavigator(): void {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
  } else {
    delete (globalThis as Record<string, unknown>).navigator;
  }
}

describe('hx9 persist: requestPersistentStorage driver', () => {
  beforeEach(() => {
    resetPersistentStorageForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetPersistentStorageForTest();
    restoreNavigator();
  });

  it('calls navigator.storage.persist and resolves to true when granted', async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    setNavigator({
      storage: {
        persist: persistMock,
      },
    });

    const result = await requestPersistentStorage();
    expect(result).toBe(true);
    expect(persistMock).toHaveBeenCalledTimes(1);
  });

  it('resolves to false when persistent storage is denied', async () => {
    const persistMock = vi.fn().mockResolvedValue(false);
    setNavigator({
      storage: {
        persist: persistMock,
      },
    });

    const result = await requestPersistentStorage();
    expect(result).toBe(false);
    expect(persistMock).toHaveBeenCalledTimes(1);
  });

  it('calls navigator.storage.persist at most once per page load across multiple calls', async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    setNavigator({
      storage: {
        persist: persistMock,
      },
    });

    const res1 = await requestPersistentStorage();
    const res2 = await requestPersistentStorage();
    const res3 = await requestPersistentStorage();

    expect(res1).toBe(true);
    expect(res2).toBe(true);
    expect(res3).toBe(true);
    expect(persistMock).toHaveBeenCalledTimes(1);
  });

  it('concurrent calls invoke navigator.storage.persist only once', async () => {
    const persistMock = vi.fn().mockImplementation(
      () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 10)),
    );
    setNavigator({
      storage: {
        persist: persistMock,
      },
    });

    const [res1, res2] = await Promise.all([
      requestPersistentStorage(),
      requestPersistentStorage(),
    ]);

    expect(res1).toBe(true);
    expect(res2).toBe(true);
    expect(persistMock).toHaveBeenCalledTimes(1);
  });

  it('handles missing navigator.storage gracefully without throwing', async () => {
    setNavigator({});

    const result = await requestPersistentStorage();
    expect(result).toBe(false);
  });

  it('handles missing global navigator gracefully without throwing', async () => {
    delete (globalThis as Record<string, unknown>).navigator;
    if (typeof navigator !== 'undefined') {
      setNavigator(undefined);
    }

    const result = await requestPersistentStorage();
    expect(result).toBe(false);
  });

  it('handles missing persist function on navigator.storage gracefully without throwing', async () => {
    setNavigator({
      storage: {},
    });

    const result = await requestPersistentStorage();
    expect(result).toBe(false);
  });

  it('handles synchronous throw inside persist() without throwing', async () => {
    setNavigator({
      storage: {
        persist: () => {
          throw new Error('Storage manager security exception');
        },
      },
    });

    const result = await requestPersistentStorage();
    expect(result).toBe(false);
  });

  it('handles asynchronous rejection inside persist() without throwing', async () => {
    setNavigator({
      storage: {
        persist: () => Promise.reject(new Error('Permission denied asynchronously')),
      },
    });

    const result = await requestPersistentStorage();
    expect(result).toBe(false);
  });
});

describe('hx9 persist integration: saveDiagramWithEviction', () => {
  beforeEach(() => {
    resetPersistentStorageForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetPersistentStorageForTest();
    restoreNavigator();
  });

  it('persist is requested once after two saves', async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    setNavigator({
      storage: {
        persist: persistMock,
      },
    });

    const store = new MemoryDiagramStore();
    const entry1 = makeSampleDiagram('diag-1');
    const entry2 = makeSampleDiagram('diag-2');

    // First save
    const res1 = await saveDiagramWithEviction(store, [], entry1);
    expect(res1).toEqual({ ok: true, evictedId: undefined });

    // Allow fire-and-forget microtask to run
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(persistMock).toHaveBeenCalledTimes(1);

    // Second save
    const res2 = await saveDiagramWithEviction(store, [entry1], entry2);
    expect(res2).toEqual({ ok: true, evictedId: undefined });

    // Allow fire-and-forget microtask to run
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Persist must still only have been requested once across the two saves!
    expect(persistMock).toHaveBeenCalledTimes(1);
  });

  it('missing navigator.storage is fine during save', async () => {
    setNavigator({});

    const store = new MemoryDiagramStore();
    const entry = makeSampleDiagram('diag-1');

    const res = await saveDiagramWithEviction(store, [], entry);
    expect(res).toEqual({ ok: true, evictedId: undefined });

    // Stored successfully in diagram store even without StorageManager
    const stored = await store.get('diag-1');
    expect(stored.ok && stored.value?.id).toBe('diag-1');
  });

  it('failed save does not trigger persistent storage request', async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    setNavigator({
      storage: {
        persist: persistMock,
      },
    });

    const store = new MemoryDiagramStore();
    store.failWith = 'Disk quota exceeded';

    const entry = makeSampleDiagram('diag-failed');
    const res = await saveDiagramWithEviction(store, [], entry);

    expect(res).toEqual({ ok: false, error: 'Disk quota exceeded' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('all_pinned failure does not trigger persistent storage request', async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    setNavigator({
      storage: {
        persist: persistMock,
      },
    });

    const store = new MemoryDiagramStore();
    const pinned1 = makeSampleDiagram('p1', true);
    const pinned2 = makeSampleDiagram('p2', true);
    const newEntry = makeSampleDiagram('new');

    // Cap of 2 with 2 pinned items
    const res = await saveDiagramWithEviction(store, [pinned1, pinned2], newEntry, 2);

    expect(res).toEqual({ ok: false, error: 'all_pinned' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('atomic putWithEviction triggers persistent storage request on success', async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    setNavigator({
      storage: {
        persist: persistMock,
      },
    });

    const entry = makeSampleDiagram('atomic-1');
    const atomicStore = {
      list: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      putWithEviction: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    };

    const res = await saveDiagramWithEviction(atomicStore, [], entry);
    expect(res).toEqual({ ok: true, evictedId: undefined });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(persistMock).toHaveBeenCalledTimes(1);
  });
});
