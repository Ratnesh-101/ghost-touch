/**
 * DiagramStore driver — the ONLY place IndexedDB is touched (Task 13).
 *
 * Per architecture rule 1 (tech.md): browser APIs only in `drivers/`.
 * Per architecture rule, wrap every IndexedDB call in try/catch; storage
 * unavailability must never crash the app (Requirement 11.7).
 *
 * The `DiagramStore` interface is narrow enough that tests use
 * `MemoryDiagramStore` instead of a real IndexedDB, following the same
 * injection pattern as `HapticDriver` / `WebHapticDriver`.
 */

import type { SavedDiagram } from '../core/savedDiagrams';
import { deserialise } from '../core/savedDiagrams';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/** Result type for store operations that can silently fail. */
export type StoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface DiagramStore {
  /** List all saved entries (newest first is handled by the caller). */
  list(): Promise<StoreResult<SavedDiagram[]>>;
  /** Retrieve a single entry by id. */
  get(id: string): Promise<StoreResult<SavedDiagram | undefined>>;
  /** Insert or replace an entry (keyed by id). */
  put(entry: SavedDiagram): Promise<StoreResult<void>>;
  /** Delete an entry by id. No-op if it does not exist. */
  delete(id: string): Promise<StoreResult<void>>;
  /**
   * Atomically save an entry and evict an old entry if evictedId is provided (B4-04).
   * Runs in a single readwrite transaction. If saving fails, nothing is evicted.
   */
  putWithEviction?(entry: SavedDiagram, evictedId?: string): Promise<StoreResult<void>>;
}

// ---------------------------------------------------------------------------
// In-memory fake (used in tests)
// ---------------------------------------------------------------------------

/**
 * Synchronous, in-memory implementation of DiagramStore for unit tests.
 * Optionally set `failWith` to a string to simulate storage failures.
 */
export class MemoryDiagramStore implements DiagramStore {
  private readonly store = new Map<string, SavedDiagram>();
  /** When set, every operation returns this error string instead of succeeding. */
  failWith: string | null = null;

  async list(): Promise<StoreResult<SavedDiagram[]>> {
    if (this.failWith !== null) return { ok: false, error: this.failWith };
    return { ok: true, value: [...this.store.values()] };
  }

  async get(id: string): Promise<StoreResult<SavedDiagram | undefined>> {
    if (this.failWith !== null) return { ok: false, error: this.failWith };
    return { ok: true, value: this.store.get(id) };
  }

  async put(entry: SavedDiagram): Promise<StoreResult<void>> {
    if (this.failWith !== null) return { ok: false, error: this.failWith };
    this.store.set(entry.id, entry);
    return { ok: true, value: undefined };
  }

  async delete(id: string): Promise<StoreResult<void>> {
    if (this.failWith !== null) return { ok: false, error: this.failWith };
    this.store.delete(id);
    return { ok: true, value: undefined };
  }

  async putWithEviction(entry: SavedDiagram, evictedId?: string): Promise<StoreResult<void>> {
    if (this.failWith !== null) return { ok: false, error: this.failWith };
    this.store.set(entry.id, entry);
    if (evictedId !== undefined) {
      this.store.delete(evictedId);
    }
    return { ok: true, value: undefined };
  }

  clear(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// IndexedDB implementation
// ---------------------------------------------------------------------------

const DB_NAME = 'ghost-touch';
const DB_VERSION = 1;
const STORE_NAME = 'saved-diagrams';

function defaultIdb(): IDBFactory | undefined {
  return typeof indexedDB === 'undefined' ? undefined : indexedDB;
}

/** Wrap an IDBRequest in a Promise. */
function idbPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDBRequest failed'));
  });
}

/**
 * Safely wait for transaction completion if supported by the IDB implementation.
 * Guards against minimal mocks that don't implement addEventListener.
 */
function waitTx(tx: unknown): Promise<void> {
  if (!tx || typeof tx !== 'object') {
    return Promise.resolve();
  }
  const txObj = tx as Partial<IDBTransaction>;
  // Only wait if the transaction implementation supports completion events (real IDBTransaction or full mock).
  // Minimal unit test mocks that only stub objectStore() resolve immediately.
  if (typeof txObj.addEventListener === 'function' || 'oncomplete' in txObj) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const onDone = (): void => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      const onFail = (err?: unknown): void => {
        if (!settled) {
          settled = true;
          reject(err ?? txObj.error ?? new Error('Transaction aborted or failed'));
        }
      };

      txObj.oncomplete = onDone;
      txObj.onerror = () => onFail(txObj.error ?? new Error('Transaction error'));
      txObj.onabort = () => onFail(txObj.error ?? new Error('Transaction aborted'));

      if (typeof txObj.addEventListener === 'function') {
        try {
          txObj.addEventListener('complete', onDone);
          txObj.addEventListener('error', () => onFail(txObj.error ?? new Error('Transaction error')));
          txObj.addEventListener('abort', () => onFail(txObj.error ?? new Error('Transaction aborted')));
        } catch {
          // Safe fallback for mocks without real event listener support
        }
      }
    });
  }
  return Promise.resolve();
}

/**
 * IndexedDB-backed DiagramStore. Every method wraps IDB calls in try/catch
 * and returns `{ ok: false, error }` rather than throwing (Req 11.7).
 */
export class IDBDiagramStore implements DiagramStore {
  constructor(
    private readonly idb: IDBFactory | null | undefined = defaultIdb(),
    private readonly dbName: string = DB_NAME,
    private readonly dbVersion: number = DB_VERSION,
  ) {}

  private async openDb(): Promise<IDBDatabase | null> {
    const factory = this.idb;
    if (factory === undefined || factory === null) return null;

    return new Promise((resolve) => {
      let req: IDBOpenDBRequest;
      try {
        req = factory.open(this.dbName, this.dbVersion);
      } catch {
        resolve(null);
        return;
      }

      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);

      req.onupgradeneeded = (ev) => {
        try {
          const db = (ev.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        } catch {
          // If creation fails, req.onerror will fire
        }
      };

      req.onsuccess = (ev) => {
        try {
          resolve((ev.target as IDBOpenDBRequest).result);
        } catch {
          resolve(null);
        }
      };
    });
  }

  async list(): Promise<StoreResult<SavedDiagram[]>> {
    try {
      const db = await this.openDb();
      if (db === null) return { ok: false, error: 'storage_unavailable' };

      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const raw = await idbPromise<unknown[]>(store.getAll() as IDBRequest<unknown[]>);

        const entries: SavedDiagram[] = [];
        if (Array.isArray(raw)) {
          for (const item of raw) {
            const entry = deserialise(item);
            if (entry !== undefined) entries.push(entry);
          }
        }
        return { ok: true, value: entries };
      } finally {
        db.close();
      }
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async get(id: string): Promise<StoreResult<SavedDiagram | undefined>> {
    try {
      const db = await this.openDb();
      if (db === null) return { ok: false, error: 'storage_unavailable' };

      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const raw = await idbPromise<unknown>(store.get(id) as IDBRequest<unknown>);
        return { ok: true, value: deserialise(raw) };
      } finally {
        db.close();
      }
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async put(entry: SavedDiagram): Promise<StoreResult<void>> {
    try {
      const db = await this.openDb();
      if (db === null) return { ok: false, error: 'storage_unavailable' };

      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await idbPromise(store.put(entry));
        await waitTx(tx);
        return { ok: true, value: undefined };
      } finally {
        db.close();
      }
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async putWithEviction(entry: SavedDiagram, evictedId?: string): Promise<StoreResult<void>> {
    try {
      const db = await this.openDb();
      if (db === null) return { ok: false, error: 'storage_unavailable' };

      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        if (evictedId !== undefined) {
          await idbPromise(store.delete(evictedId));
        }
        await idbPromise(store.put(entry));
        await waitTx(tx);
        return { ok: true, value: undefined };
      } finally {
        db.close();
      }
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async delete(id: string): Promise<StoreResult<void>> {
    try {
      const db = await this.openDb();
      if (db === null) return { ok: false, error: 'storage_unavailable' };

      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await idbPromise(store.delete(id));
        await waitTx(tx);
        return { ok: true, value: undefined };
      } finally {
        db.close();
      }
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}
