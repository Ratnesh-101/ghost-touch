/**
 * Direct regression tests for saveDiagramWithEviction rollback (Task 40.2, Requirement 22.14).
 *
 * Verifies that a failed save never loses any previously existing diagrams, both on stores with
 * and without putWithEviction, including when starting over the capacity cap, when updating or
 * inserting, and when entries are pinned.
 */
import { describe, expect, it } from 'vitest';
import type { SavedDiagram } from '../src/core/savedDiagrams';
import type { DiagramScene } from '../src/core/scene';
import {
  MemoryDiagramStore,
  type DiagramStore,
  type StoreResult,
} from '../src/drivers/diagramStore';
import { saveDiagramWithEviction } from '../src/flow/saved';

function makeEntry(
  id: string,
  createdAt: number,
  pinned: boolean,
  version: number,
): SavedDiagram {
  return {
    id,
    createdAt,
    title: `Diagram ${id} v${version}`,
    thumbnailDataUrl: `data:img-${id}-v${version}`,
    scene: { kind: 'geometry', title: `Diagram ${id} v${version}` } as DiagramScene,
    pinned,
  };
}

/** Store that fails the N-th mutating call (1-based index) once. */
class FailingMemoryStore extends MemoryDiagramStore {
  calls = 0;
  constructor(private readonly failAt: number | null) {
    super();
  }
  private failsNow(): boolean {
    this.calls++;
    return this.calls === this.failAt;
  }
  override async put(e: SavedDiagram): Promise<StoreResult<void>> {
    return this.failsNow() ? { ok: false, error: 'injected put failure' } : super.put(e);
  }
  override async delete(id: string): Promise<StoreResult<void>> {
    return this.failsNow() ? { ok: false, error: 'injected delete failure' } : super.delete(id);
  }
  override async putWithEviction(
    e: SavedDiagram,
    evictedId?: string,
  ): Promise<StoreResult<void>> {
    return this.failsNow()
      ? { ok: false, error: 'injected transaction failure' }
      : super.putWithEviction(e, evictedId);
  }
}

/** Store where multi-call failures can be programmed. */
class MultiFailingStore extends MemoryDiagramStore {
  calls = 0;
  constructor(private readonly failIndices: ReadonlySet<number>) {
    super();
  }
  private failsNow(): boolean {
    this.calls++;
    return this.failIndices.has(this.calls);
  }
  override async put(e: SavedDiagram): Promise<StoreResult<void>> {
    return this.failsNow() ? { ok: false, error: 'injected put failure' } : super.put(e);
  }
  override async delete(id: string): Promise<StoreResult<void>> {
    return this.failsNow() ? { ok: false, error: 'injected delete failure' } : super.delete(id);
  }
}

function withoutAtomic(s: FailingMemoryStore | MultiFailingStore): DiagramStore {
  return {
    list: () => s.list(),
    get: (id) => s.get(id),
    put: (e) => s.put(e),
    delete: (id) => s.delete(id),
  };
}

describe('saveDiagramWithEviction fallback rollback (Requirement 22.14)', () => {
  it('shrunk counterexample: cap 2, d0..d3 unpinned, update d0, 3rd call fails', async () => {
    // Initial state: cap 2, 4 unpinned entries (two over cap)
    const d0 = makeEntry('d0', 10, false, 0);
    const d1 = makeEntry('d1', 20, false, 0);
    const d2 = makeEntry('d2', 30, false, 0);
    const d3 = makeEntry('d3', 40, false, 0);
    const existing = [d0, d1, d2, d3];

    // 3rd call fails: put(d0_new) ok, delete(d1) ok, delete(d2) FAILS
    const store = new FailingMemoryStore(3);
    for (const e of existing) {
      await MemoryDiagramStore.prototype.put.call(store, e);
    }

    const updatedD0 = makeEntry('d0', 10, false, 1);
    const res = await saveDiagramWithEviction(withoutAtomic(store), existing, updatedD0, 2);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('injected delete failure');
    }

    const listRes = await store.list();
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      const items = new Map(listRes.value.map((e) => [e.id, e]));
      expect(items.size).toBe(4);
      // d1 must NOT be lost
      expect(items.get('d1')).toEqual(d1);
      // d0 must be rolled back to prior version
      expect(items.get('d0')).toEqual(d0);
      expect(items.get('d2')).toEqual(d2);
      expect(items.get('d3')).toEqual(d3);
    }
  });

  it('shrunk counterexample on MemoryDiagramStore (multi-victim fallback)', async () => {
    const d0 = makeEntry('d0', 10, false, 0);
    const d1 = makeEntry('d1', 20, false, 0);
    const d2 = makeEntry('d2', 30, false, 0);
    const d3 = makeEntry('d3', 40, false, 0);
    const existing = [d0, d1, d2, d3];

    // Multi-victim (targetSurplus = 2) triggers fallback even with putWithEviction present
    const store = new FailingMemoryStore(3);
    for (const e of existing) {
      await MemoryDiagramStore.prototype.put.call(store, e);
    }

    const updatedD0 = makeEntry('d0', 10, false, 1);
    const res = await saveDiagramWithEviction(store, existing, updatedD0, 2);

    expect(res.ok).toBe(false);
    const listRes = await store.list();
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      const items = new Map(listRes.value.map((e) => [e.id, e]));
      expect(items.size).toBe(4);
      expect(items.get('d1')).toEqual(d1);
      expect(items.get('d0')).toEqual(d0);
      expect(items.get('d2')).toEqual(d2);
      expect(items.get('d3')).toEqual(d3);
    }
  });

  it('new entry insertion rollback: new entry deleted and deleted victims restored', async () => {
    const d0 = makeEntry('d0', 10, false, 0);
    const d1 = makeEntry('d1', 20, false, 0);
    const d2 = makeEntry('d2', 30, false, 0);
    const existing = [d0, d1, d2];

    // Cap 2, 3 existing entries. New entry 'd_new' -> targetSurplus = 3 + 1 - 2 = 2 victims.
    // Call 1: put(d_new) ok.
    // Call 2: delete(d0) ok.
    // Call 3: delete(d1) FAILS.
    const store = new FailingMemoryStore(3);
    for (const e of existing) {
      await MemoryDiagramStore.prototype.put.call(store, e);
    }

    const newEntry = makeEntry('d_new', 50, false, 0);
    const res = await saveDiagramWithEviction(withoutAtomic(store), existing, newEntry, 2);

    expect(res.ok).toBe(false);
    const listRes = await store.list();
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      const items = new Map(listRes.value.map((e) => [e.id, e]));
      expect(items.size).toBe(3);
      expect(items.has('d_new')).toBe(false);
      expect(items.get('d0')).toEqual(d0);
      expect(items.get('d1')).toEqual(d1);
      expect(items.get('d2')).toEqual(d2);
    }
  });

  it('pinned entries case: pinned entries are never chosen as victims', async () => {
    // d1 is pinned, so candidates for surplus 2 among d0..d3 are d0, d2, d3.
    // When updating d0, candidates are d2, d3 (d1 skipped as pinned, d0 skipped as target).
    const d0 = makeEntry('d0', 10, false, 0);
    const d1 = makeEntry('d1', 20, true, 0); // PINNED
    const d2 = makeEntry('d2', 30, false, 0);
    const d3 = makeEntry('d3', 40, false, 0);
    const existing = [d0, d1, d2, d3];

    // Call 1: put(d0_new) ok
    // Call 2: delete(d2) ok
    // Call 3: delete(d3) FAILS
    const store = new FailingMemoryStore(3);
    for (const e of existing) {
      await MemoryDiagramStore.prototype.put.call(store, e);
    }

    const updatedD0 = makeEntry('d0', 10, false, 1);
    const res = await saveDiagramWithEviction(withoutAtomic(store), existing, updatedD0, 2);

    expect(res.ok).toBe(false);
    const listRes = await store.list();
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      const items = new Map(listRes.value.map((e) => [e.id, e]));
      expect(items.size).toBe(4);
      expect(items.get('d1')?.pinned).toBe(true);
      expect(items.get('d1')).toEqual(d1);
      expect(items.get('d0')).toEqual(d0);
      expect(items.get('d2')).toEqual(d2);
      expect(items.get('d3')).toEqual(d3);
    }
  });

  it('pinned entries case: update to pinned entry retains pinned on rollback', async () => {
    const d0 = makeEntry('d0', 10, true, 0); // PINNED
    const d1 = makeEntry('d1', 20, false, 0);
    const d2 = makeEntry('d2', 30, false, 0);
    const d3 = makeEntry('d3', 40, false, 0);
    const existing = [d0, d1, d2, d3];

    // Call 1: put(d0) ok
    // Call 2: delete(d1) ok
    // Call 3: delete(d2) FAILS
    const store = new FailingMemoryStore(3);
    for (const e of existing) {
      await MemoryDiagramStore.prototype.put.call(store, e);
    }

    // Attempting to update with pinned=false; core rule preserves prior.pinned
    const updatedD0 = makeEntry('d0', 10, false, 1);
    const res = await saveDiagramWithEviction(withoutAtomic(store), existing, updatedD0, 2);

    expect(res.ok).toBe(false);
    const listRes = await store.list();
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      const items = new Map(listRes.value.map((e) => [e.id, e]));
      expect(items.size).toBe(4);
      const storedD0 = items.get('d0');
      expect(storedD0).toBeDefined();
      expect(storedD0?.pinned).toBe(true);
      expect(storedD0).toEqual(d0);
      expect(items.get('d1')).toEqual(d1);
    }
  });

  it('refuses save with all_pinned when unpinned candidates cannot meet surplus', async () => {
    const d0 = makeEntry('d0', 10, true, 0);
    const d1 = makeEntry('d1', 20, true, 0);
    const existing = [d0, d1];

    const store = new FailingMemoryStore(null);
    for (const e of existing) {
      await MemoryDiagramStore.prototype.put.call(store, e);
    }

    const newEntry = makeEntry('d_new', 30, false, 0);
    const res = await saveDiagramWithEviction(store, existing, newEntry, 2);

    expect(res).toEqual({ ok: false, error: 'all_pinned' });
    const listRes = await store.list();
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      expect(listRes.value).toHaveLength(2);
      expect(listRes.value).toEqual([d0, d1]);
    }
  });

  it('restore failure during rollback reports ok: false and never claims success', async () => {
    const d0 = makeEntry('d0', 10, false, 0);
    const d1 = makeEntry('d1', 20, false, 0);
    const d2 = makeEntry('d2', 30, false, 0);
    const d3 = makeEntry('d3', 40, false, 0);
    const existing = [d0, d1, d2, d3];

    // Call 1: put(d0_updated)
    // Call 2: delete(d1)
    // Call 3: delete(d2) -> FAILS
    // Call 4: put(d1) restore -> FAILS as well
    const store = new MultiFailingStore(new Set([3, 4]));
    for (const e of existing) {
      await MemoryDiagramStore.prototype.put.call(store, e);
    }

    const updatedD0 = makeEntry('d0', 10, false, 1);
    const res = await saveDiagramWithEviction(withoutAtomic(store), existing, updatedD0, 2);

    // Must still report failure and never claim success
    expect(res.ok).toBe(false);
  });
});
