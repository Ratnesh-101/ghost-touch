/**
 * P83 (Kiro, task 40.2, Requirement 22.14): a failed save never loses an entry that was in the
 * store before it. Covers the real `MemoryDiagramStore` (its `putWithEviction` branch) and a
 * fallback store without `putWithEviction`, with one injected failure at any mutating call,
 * including after a delete has already succeeded. Starting contents may be over the cap, which an
 * earlier failed save can leave behind; that is what sends a save down the multi-victim path.
 *
 * Expected red until the saved-diagrams lane fixes the fallback in `flow/saved.ts`; the
 * counterexample is in docs/reviews/kiro-round6.md.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { SavedDiagram } from '../src/core/savedDiagrams';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type DiagramStore, type StoreResult } from '../src/drivers/diagramStore';
import { saveDiagramWithEviction } from '../src/flow/saved';

const RUNS = { numRuns: 300 };

function entry(id: string, createdAt: number, pinned: boolean, version: number): SavedDiagram {
  return {
    id,
    createdAt,
    title: `v${version}`,
    thumbnailDataUrl: `thumb-${version}`,
    scene: { kind: 'unknown', title: `v${version}` } as DiagramScene,
    pinned,
  };
}

/** The real memory store, failing its `failAt`-th mutating call (1-based) once. */
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
  override async putWithEviction(e: SavedDiagram, evictedId?: string): Promise<StoreResult<void>> {
    return this.failsNow() ? { ok: false, error: 'injected transaction failure' } : super.putWithEviction(e, evictedId);
  }
}

/** The same store with `putWithEviction` hidden, so `saveDiagramWithEviction` takes its fallback. */
function withoutAtomic(s: FailingMemoryStore): DiagramStore {
  return { list: () => s.list(), get: (id) => s.get(id), put: (e) => s.put(e), delete: (id) => s.delete(id) };
}

const scenarioArb = fc
  .record({
    cap: fc.constantFrom(2, 3, 5),
    extra: fc.nat({ max: 3 }),
    pins: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
    times: fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 8, maxLength: 8 }),
    target: fc.nat({ max: 9 }),
    atomic: fc.boolean(),
    failAt: fc.option(fc.integer({ min: 1, max: 4 }), { nil: null }),
  })
  .map(({ cap, extra, pins, times, target, atomic, failAt }) => {
    const n = Math.min(8, cap + extra); // up to 3 over the cap
    const before = Array.from({ length: n }, (_, i) => entry(`d${i}`, times[i]!, pins[i]!, 0));
    const id = target < n ? `d${target}` : `new${target}`; // an update or a new entry
    return { cap, before, saved: entry(id, 500, false, 1), atomic, failAt };
  });

describe('P83: a failed save never loses an entry that was there before (22.14)', () => {
  /** `atCap`: the store starts with exactly `cap` entries, so a save has at most one victim. */
  const check = (mode: 'atomic' | 'fallback', atCap = false) =>
    fc.asyncProperty(
      scenarioArb
        .map((s) => ({ ...s, atomic: mode === 'atomic' }))
        .map((s) => (atCap ? { ...s, before: s.before.slice(0, s.cap) } : s)),
      async ({ cap, before, saved, atomic, failAt }) => {
        const store = new FailingMemoryStore(failAt);
        // Fill the store without counting towards the injected failure.
        for (const e of before) await MemoryDiagramStore.prototype.put.call(store, e);
        const res = await saveDiagramWithEviction(atomic ? store : withoutAtomic(store), before, saved, cap);
        if (!res.ok) {
          const listed = await MemoryDiagramStore.prototype.list.call(store);
          const after = new Map((listed.ok ? listed.value : []).map((e) => [e.id, e]));
          for (const e of before) {
            expect(after.has(e.id), `lost ${e.id}`).toBe(true);
            expect(after.get(e.id)).toEqual(e);
          }
        }
      },
    );

  it('MemoryDiagramStore and the fallback, at the cap (one victim at most), any single failing call (300 runs)', async () => {
    await fc.assert(check('atomic', true), RUNS);
    await fc.assert(check('fallback', true), RUNS);
  });

  // RED until the saved-diagrams lane fixes the multi-victim rollback in flow/saved.ts. With two or
  // more victims `saveDiagramWithEviction` takes the fallback for every store, MemoryDiagramStore
  // included, so both of these fail on the same lines.
  it('MemoryDiagramStore over the cap, any single failing call (300 runs)', async () => {
    await fc.assert(check('atomic'), RUNS);
  });

  it('fallback without putWithEviction over the cap, any single failing call (300 runs)', async () => {
    await fc.assert(check('fallback'), RUNS);
  });

  it('the audit case: MemoryDiagramStore.putWithEviction(e, e.id) keeps e', async () => {
    const store = new MemoryDiagramStore();
    const e = entry('d0', 1, false, 0);
    await store.put(e);
    const updated = entry('d0', 1, false, 1);
    expect((await store.putWithEviction(updated, 'd0')).ok).toBe(true);
    const got = await store.get('d0');
    expect(got.ok && got.value).toEqual(updated);
  });
});
