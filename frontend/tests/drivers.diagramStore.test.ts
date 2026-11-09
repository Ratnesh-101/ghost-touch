import { describe, expect, it, vi } from 'vitest';
import {
  IDBDiagramStore,
  MemoryDiagramStore,
} from '../src/drivers/diagramStore';
import type { SavedDiagram } from '../src/core/savedDiagrams';

describe('MemoryDiagramStore', () => {
  const sample1: SavedDiagram = {
    id: 'id-1',
    createdAt: 1000,
    title: 'Sample 1',
    thumbnailDataUrl: 'data:image/jpeg;base64,1',
    scene: { kind: 'geometry' },
    pinned: false,
  };

  const sample2: SavedDiagram = {
    id: 'id-2',
    createdAt: 2000,
    title: 'Sample 2',
    thumbnailDataUrl: 'data:image/jpeg;base64,2',
    scene: { kind: 'function_graph' },
    pinned: true,
  };

  it('starts empty and supports list, put, get, and delete', async () => {
    const store = new MemoryDiagramStore();

    // Initially empty
    const initialList = await store.list();
    expect(initialList).toEqual({ ok: true, value: [] });

    // Get non-existent
    const missing = await store.get('none');
    expect(missing).toEqual({ ok: true, value: undefined });

    // Put entries
    const putRes1 = await store.put(sample1);
    expect(putRes1).toEqual({ ok: true, value: undefined });

    const putRes2 = await store.put(sample2);
    expect(putRes2).toEqual({ ok: true, value: undefined });

    // Get stored
    const got1 = await store.get('id-1');
    expect(got1).toEqual({ ok: true, value: sample1 });

    // List all
    const allList = await store.list();
    expect(allList.ok).toBe(true);
    if (allList.ok) {
      expect(allList.value).toEqual([sample1, sample2]);
    }

    // Put updates existing
    const updated1 = { ...sample1, title: 'Updated Title' };
    await store.put(updated1);
    const gotUpdated = await store.get('id-1');
    expect(gotUpdated).toEqual({ ok: true, value: updated1 });

    // Delete
    const delRes = await store.delete('id-1');
    expect(delRes).toEqual({ ok: true, value: undefined });

    const afterDel = await store.get('id-1');
    expect(afterDel).toEqual({ ok: true, value: undefined });

    // Delete non-existent succeeds
    const delMissing = await store.delete('unknown-id');
    expect(delMissing).toEqual({ ok: true, value: undefined });
  });

  it('simulates storage errors when failWith is set', async () => {
    const store = new MemoryDiagramStore();
    store.failWith = 'storage_unavailable';

    expect(await store.list()).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(await store.get('id-1')).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(await store.put(sample1)).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(await store.delete('id-1')).toEqual({ ok: false, error: 'storage_unavailable' });
  });

  it('clears all entries with clear()', async () => {
    const store = new MemoryDiagramStore();
    await store.put(sample1);
    store.clear();
    const listRes = await store.list();
    expect(listRes).toEqual({ ok: true, value: [] });
  });
});

describe('IDBDiagramStore — unavailable and error paths', () => {
  const sample: SavedDiagram = {
    id: 'test-1',
    createdAt: 1000,
    title: 'Test',
    thumbnailDataUrl: '',
    scene: { kind: 'geometry' },
    pinned: false,
  };

  it('returns storage_unavailable cleanly when idb is undefined or null', async () => {
    const storeNull = new IDBDiagramStore(null);

    const listRes = await storeNull.list();
    expect(listRes).toEqual({ ok: false, error: 'storage_unavailable' });

    const getRes = await storeNull.get('test-1');
    expect(getRes).toEqual({ ok: false, error: 'storage_unavailable' });

    const putRes = await storeNull.put(sample);
    expect(putRes).toEqual({ ok: false, error: 'storage_unavailable' });

    const delRes = await storeNull.delete('test-1');
    expect(delRes).toEqual({ ok: false, error: 'storage_unavailable' });
  });

  it('returns storage_unavailable when open throws synchronously (e.g. SecurityError)', async () => {
    const throwingFactory = {
      open: () => {
        throw new Error('SecurityError: IndexedDB is not allowed in this context');
      },
    } as unknown as IDBFactory;

    const store = new IDBDiagramStore(throwingFactory);

    expect(await store.list()).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(await store.get('id')).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(await store.put(sample)).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(await store.delete('id')).toEqual({ ok: false, error: 'storage_unavailable' });
  });

  it('returns storage_unavailable when open request triggers onerror', async () => {
    const errorFactory = {
      open: () => {
        const req: Record<string, unknown> = {};
        setTimeout(() => {
          if (typeof req.onerror === 'function') {
            (req.onerror as () => void)();
          }
        }, 0);
        return req;
      },
    } as unknown as IDBFactory;

    const store = new IDBDiagramStore(errorFactory);
    const res = await store.list();
    expect(res).toEqual({ ok: false, error: 'storage_unavailable' });
  });

  it('returns storage_unavailable when open request triggers onblocked', async () => {
    const blockedFactory = {
      open: () => {
        const req: Record<string, unknown> = {};
        setTimeout(() => {
          if (typeof req.onblocked === 'function') {
            (req.onblocked as () => void)();
          }
        }, 0);
        return req;
      },
    } as unknown as IDBFactory;

    const store = new IDBDiagramStore(blockedFactory);
    const res = await store.put(sample);
    expect(res).toEqual({ ok: false, error: 'storage_unavailable' });
  });
});

describe('IDBDiagramStore — with minimal fake indexedDB', () => {
  const sample1: SavedDiagram = {
    id: 'd1',
    createdAt: 1000,
    title: 'Diag 1',
    thumbnailDataUrl: 'data:img1',
    scene: { kind: 'geometry' },
    pinned: false,
  };

  const sample2: SavedDiagram = {
    id: 'd2',
    createdAt: 2000,
    title: 'Diag 2',
    thumbnailDataUrl: 'data:img2',
    scene: { kind: 'bar_chart' },
    pinned: true,
  };

  /** Minimal in-memory fake IDBFactory simulating basic IndexedDB operations */
  function createFakeIdb() {
    const inMemoryData = new Map<string, unknown>();
    let closeCalled = 0;

    const fakeDb = {
      objectStoreNames: {
        contains: (name: string) => name === 'saved-diagrams',
      },
      createObjectStore: vi.fn(),
      close: () => {
        closeCalled++;
      },
      transaction: (_storeName: string, _mode: string) => ({
        objectStore: (_name: string) => ({
          getAll: () => {
            const req: { result?: unknown[]; onsuccess?: () => void; onerror?: () => void } = {};
            setTimeout(() => {
              req.result = [...inMemoryData.values()];
              req.onsuccess?.();
            }, 0);
            return req;
          },
          get: (key: string) => {
            const req: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
            setTimeout(() => {
              req.result = inMemoryData.get(key);
              req.onsuccess?.();
            }, 0);
            return req;
          },
          put: (val: SavedDiagram) => {
            const req: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
            setTimeout(() => {
              inMemoryData.set(val.id, val);
              req.onsuccess?.();
            }, 0);
            return req;
          },
          delete: (key: string) => {
            const req: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
            setTimeout(() => {
              inMemoryData.delete(key);
              req.onsuccess?.();
            }, 0);
            return req;
          },
        }),
      }),
    };

    const fakeFactory: IDBFactory = {
      open: (_name: string, _version?: number) => {
        const req: {
          result?: typeof fakeDb;
          onsuccess?: (ev: { target: { result: typeof fakeDb } }) => void;
          onerror?: () => void;
          onupgradeneeded?: (ev: { target: { result: typeof fakeDb } }) => void;
        } = {};
        setTimeout(() => {
          req.result = fakeDb;
          req.onupgradeneeded?.({ target: { result: fakeDb } });
          req.onsuccess?.({ target: { result: fakeDb } });
        }, 0);
        return req as unknown as IDBOpenDBRequest;
      },
      cmp: () => 0,
      deleteDatabase: vi.fn(),
      databases: vi.fn(),
    };

    return {
      factory: fakeFactory,
      getCloseCount: () => closeCalled,
      rawStore: inMemoryData,
    };
  }

  it('performs put, get, list, and delete successfully', async () => {
    const fake = createFakeIdb();
    const store = new IDBDiagramStore(fake.factory);

    // Initially empty
    const list0 = await store.list();
    expect(list0).toEqual({ ok: true, value: [] });

    // Put entries
    await store.put(sample1);
    await store.put(sample2);

    // Get entry
    const got1 = await store.get('d1');
    expect(got1).toEqual({ ok: true, value: sample1 });

    // Get non-existent
    const missing = await store.get('missing');
    expect(missing).toEqual({ ok: true, value: undefined });

    // List all
    const all = await store.list();
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.value).toEqual([sample1, sample2]);
    }

    // Delete
    await store.delete('d1');
    const afterDelete = await store.get('d1');
    expect(afterDelete).toEqual({ ok: true, value: undefined });

    // DB connections closed properly
    expect(fake.getCloseCount()).toBeGreaterThan(0);
  });

  it('filters out corrupt or invalid objects when listing', async () => {
    const fake = createFakeIdb();
    fake.rawStore.set('valid', sample1);
    fake.rawStore.set('corrupt', { id: 'corrupt', invalid: true });

    const store = new IDBDiagramStore(fake.factory);
    const list = await store.list();
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value).toEqual([sample1]);
    }
  });

  it('catches and reports transaction exceptions cleanly without throwing', async () => {
    const fake = createFakeIdb();
    // Override transaction to throw
    (fake.factory as unknown as { open: () => IDBOpenDBRequest }).open = () => {
      const req: Record<string, unknown> = {};
      setTimeout(() => {
        const brokenDb = {
          objectStoreNames: { contains: () => true },
          close: vi.fn(),
          transaction: () => {
            throw new Error('Transaction aborted');
          },
        };
        if (typeof req.onsuccess === 'function') {
          (req.onsuccess as (ev: unknown) => void)({ target: { result: brokenDb } });
        }
      }, 0);
      return req as unknown as IDBOpenDBRequest;
    };

    const store = new IDBDiagramStore(fake.factory);
    const res = await store.put(sample1);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('Transaction aborted');
    }
  });

  it('catches and reports store request error events cleanly without throwing', async () => {
    const fake = createFakeIdb();
    (fake.factory as unknown as { open: () => IDBOpenDBRequest }).open = () => {
      const req: Record<string, unknown> = {};
      setTimeout(() => {
        const errorDb = {
          objectStoreNames: { contains: () => true },
          close: vi.fn(),
          transaction: () => ({
            objectStore: () => ({
              put: () => {
                const putReq: { error?: Error; onerror?: () => void } = {};
                setTimeout(() => {
                  putReq.error = new Error('QuotaExceededError');
                  putReq.onerror?.();
                }, 0);
                return putReq;
              },
            }),
          }),
        };
        if (typeof req.onsuccess === 'function') {
          (req.onsuccess as (ev: unknown) => void)({ target: { result: errorDb } });
        }
      }, 0);
      return req as unknown as IDBOpenDBRequest;
    };

    const store = new IDBDiagramStore(fake.factory);
    const res = await store.put(sample1);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('QuotaExceededError');
    }
  });
});

describe('IDBDiagramStore — realistic IndexedDB failure paths (TQ-06)', () => {
  const existing1: SavedDiagram = {
    id: 'orig-1',
    createdAt: 1000,
    title: 'Original 1',
    thumbnailDataUrl: 'data:img1',
    scene: { kind: 'geometry' },
    pinned: false,
  };

  const existing2: SavedDiagram = {
    id: 'orig-2',
    createdAt: 2000,
    title: 'Original 2',
    thumbnailDataUrl: 'data:img2',
    scene: { kind: 'bar_chart' },
    pinned: true,
  };

  const incoming: SavedDiagram = {
    id: 'new-3',
    createdAt: 3000,
    title: 'Incoming 3',
    thumbnailDataUrl: 'data:img3',
    scene: { kind: 'function_graph' },
    pinned: false,
  };

  /** Helper creating a controllable IndexedDB factory with realistic lifecycle hooks */
  function createControllableIdb(options: {
    initialData?: SavedDiagram[];
    abortOnPutTx?: Error;
    failPutRequest?: Error;
    failDeleteRequest?: Error;
    abortOnEvictTx?: Error;
  }) {
    const rawMap = new Map<string, unknown>();
    for (const item of options.initialData ?? []) {
      rawMap.set(item.id, item);
    }

    const fakeDb = {
      objectStoreNames: {
        contains: (name: string) => name === 'saved-diagrams',
      },
      close: vi.fn(),
      transaction: (_storeName: string, mode: string) => {
        const snapshot = new Map(rawMap);
        let isPutOp = false;
        let isDeleteOp = false;
        let hasRequestError = false;
        let requestError: Error | undefined;
        const stagedPuts: SavedDiagram[] = [];
        const stagedDeletes: string[] = [];

        const rollback = () => {
          rawMap.clear();
          for (const [k, v] of snapshot) {
            rawMap.set(k, v);
          }
        };

        const txObj = {
          mode,
          error: undefined as Error | undefined,
          oncomplete: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onabort: null as (() => void) | null,
          addEventListener: vi.fn(),
          abort: () => {
            rollback();
            txObj.onabort?.();
          },
          objectStore: (_name: string) => ({
            getAll: () => {
              const req: {
                result?: unknown[];
                onsuccess?: () => void;
                onerror?: () => void;
              } = {};
              setTimeout(() => {
                req.result = [...rawMap.values()];
                req.onsuccess?.();
              }, 0);
              return req;
            },
            get: (key: string) => {
              const req: {
                result?: unknown;
                onsuccess?: () => void;
                onerror?: () => void;
              } = {};
              setTimeout(() => {
                req.result = rawMap.get(key);
                req.onsuccess?.();
              }, 0);
              return req;
            },
            put: (val: SavedDiagram) => {
              isPutOp = true;
              const req: {
                result?: unknown;
                error?: Error;
                onsuccess?: () => void;
                onerror?: () => void;
              } = {};
              setTimeout(() => {
                if (options.failPutRequest) {
                  hasRequestError = true;
                  requestError = options.failPutRequest;
                  req.error = options.failPutRequest;
                  req.onerror?.();
                } else {
                  stagedPuts.push(val);
                  req.onsuccess?.();
                }
              }, 0);
              return req;
            },
            delete: (key: string) => {
              isDeleteOp = true;
              const req: {
                result?: unknown;
                error?: Error;
                onsuccess?: () => void;
                onerror?: () => void;
              } = {};
              setTimeout(() => {
                if (options.failDeleteRequest) {
                  hasRequestError = true;
                  requestError = options.failDeleteRequest;
                  req.error = options.failDeleteRequest;
                  req.onerror?.();
                } else {
                  stagedDeletes.push(key);
                  req.onsuccess?.();
                }
              }, 0);
              return req;
            },
          }),
        };

        // Complete or abort the transaction on next tick after requests finish
        setTimeout(() => {
          if (isDeleteOp && options.abortOnEvictTx) {
            txObj.error = options.abortOnEvictTx;
            rollback();
            txObj.onabort?.();
            return;
          }
          if (isPutOp && options.abortOnPutTx) {
            txObj.error = options.abortOnPutTx;
            rollback();
            txObj.onabort?.();
            return;
          }
          if (hasRequestError) {
            txObj.error = requestError ?? new Error('Request failed in transaction');
            rollback();
            txObj.onabort?.();
            return;
          }
          for (const key of stagedDeletes) {
            rawMap.delete(key);
          }
          for (const item of stagedPuts) {
            rawMap.set(item.id, item);
          }
          txObj.oncomplete?.();
        }, 10);

        return txObj;
      },
    };

    const factory: IDBFactory = {
      open: () => {
        const req: {
          result?: typeof fakeDb;
          onsuccess?: (ev: { target: { result: typeof fakeDb } }) => void;
          onerror?: () => void;
          onupgradeneeded?: (ev: { target: { result: typeof fakeDb } }) => void;
        } = {};
        setTimeout(() => {
          req.result = fakeDb;
          req.onsuccess?.({ target: { result: fakeDb } });
        }, 0);
        return req as unknown as IDBOpenDBRequest;
      },
      cmp: () => 0,
      deleteDatabase: vi.fn(),
      databases: vi.fn(),
    };

    return { factory, rawMap };
  }

  it('reports error and leaves earlier entries intact when tx aborts on quota', async () => {
    const quotaError = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    const { factory, rawMap } = createControllableIdb({
      initialData: [existing1, existing2],
      abortOnPutTx: quotaError,
    });
    const store = new IDBDiagramStore(factory);

    const res = await store.put(incoming);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/QuotaExceededError|quota/i);
    }

    // Earlier entries must remain completely intact
    const listRes = await store.list();
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      expect(listRes.value).toEqual([existing1, existing2]);
    }
    expect(rawMap.has(incoming.id)).toBe(false);
    expect(rawMap.get(existing1.id)).toEqual(existing1);
    expect(rawMap.get(existing2.id)).toEqual(existing2);
  });

  it('reports error and leaves earlier entries intact on failing put request', async () => {
    const putError = new DOMException('Key constraint failed.', 'ConstraintError');
    const { factory, rawMap } = createControllableIdb({
      initialData: [existing1],
      failPutRequest: putError,
    });
    const store = new IDBDiagramStore(factory);

    const res = await store.put(incoming);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/ConstraintError/i);
    }

    // Earlier entries must remain completely intact
    const listRes = await store.list();
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      expect(listRes.value).toEqual([existing1]);
    }
    expect(rawMap.has(incoming.id)).toBe(false);
    expect(rawMap.get(existing1.id)).toEqual(existing1);
  });

  it('reports error and leaves earlier entries intact on eviction failure', async () => {
    const deleteError = new DOMException('Could not delete victim diagram.', 'AbortError');
    const { factory, rawMap } = createControllableIdb({
      initialData: [existing1, existing2],
      failDeleteRequest: deleteError,
    });
    const store = new IDBDiagramStore(factory);

    // Attempt to put incoming diagram and evict existing1
    const res = await store.putWithEviction(incoming, existing1.id);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/AbortError/i);
    }

    // Both earlier entries must remain present and intact.
    // Eviction failed before put (R5-02), so incoming diagram was not saved.
    const listRes = await store.list();
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      expect(listRes.value).toHaveLength(2);
      expect(listRes.value).toEqual([existing1, existing2]);
    }
    expect(rawMap.get(existing1.id)).toEqual(existing1);
    expect(rawMap.get(existing2.id)).toEqual(existing2);
    expect(rawMap.has(incoming.id)).toBe(false);
  });
});
