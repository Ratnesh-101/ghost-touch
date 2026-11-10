/**
 * The saved-diagram cap, pinning and in-place updates (Requirement 22.7-22.11). Properties
 * P72-P76 (Kiro, task 38) for `saveDiagramWithEviction` in `flow/saved.ts`.
 *
 * Written while lane p2 was believed unmerged; it had already merged (main at 2d108ca) when these
 * first ran (audit R5-06 and brief p2: "preserve pinned/createdAt when updating in place"). The
 * failing properties, their shrunk counterexamples and replay seeds are in
 * docs/reviews/kiro-round5.md. Do not skip, weaken or `.fails`-mark them.
 *
 * The store is a fake written here. It can fail a `put` or a `delete`, with and without
 * `putWithEviction`, so both branches of `saveDiagramWithEviction` run. A one-shot failure hits at
 * most one call per save, so a correct implementation can always roll back and the cap
 * properties are satisfiable. Only P74 also breaks `delete` for good.
 */
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { SAVED_DIAGRAMS_CAP, type SavedDiagram } from '../src/core/savedDiagrams';
import type { DiagramScene } from '../src/core/scene';
import type { DiagramStore, StoreResult } from '../src/drivers/diagramStore';
import { saveDiagramWithEviction, type SaveWithEvictionResult } from '../src/flow/saved';

const RUNS = { numRuns: 300 };
/** Shrinking a long sequence evaluates the property many times. */
const TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------------------------
// The fake store
// ---------------------------------------------------------------------------------------------

interface Fake {
  readonly store: DiagramStore;
  readonly map: Map<string, SavedDiagram>;
  readonly arm: { put: boolean; del: boolean; delBroken: boolean };
}

function makeFake(atomic: boolean): Fake {
  const map = new Map<string, SavedDiagram>();
  const arm = { put: false, del: false, delBroken: false };
  const takePut = (): boolean => {
    const fails = arm.put;
    arm.put = false;
    return fails;
  };
  const takeDelete = (): boolean => {
    const fails = arm.del || arm.delBroken;
    arm.del = false;
    return fails;
  };
  const ok = (): StoreResult<void> => ({ ok: true, value: undefined });
  const fail = (error: string): StoreResult<void> => ({ ok: false, error });

  const store: DiagramStore = {
    async list() {
      return { ok: true, value: [...map.values()] };
    },
    async get(id) {
      return { ok: true, value: map.get(id) };
    },
    async put(entry) {
      if (takePut()) return fail('put failed');
      map.set(entry.id, entry);
      return ok();
    },
    async delete(id) {
      if (takeDelete()) return fail('delete failed');
      map.delete(id);
      return ok();
    },
  };
  if (atomic) {
    // Like the IndexedDB transaction: if either half fails, nothing changes.
    store.putWithEviction = async (entry, evictedId) => {
      const putFails = takePut();
      const deleteFails = evictedId !== undefined && takeDelete();
      if (putFails || deleteFails) return fail('transaction aborted');
      if (evictedId !== undefined) map.delete(evictedId);
      map.set(entry.id, entry);
      return ok();
    };
  }
  return { store, map, arm };
}

function makeEntry(id: string, createdAt: number, pinned: boolean, version: number): SavedDiagram {
  return {
    id,
    createdAt,
    title: `v${version}`,
    thumbnailDataUrl: `thumb-${version}`,
    scene: { kind: 'unknown', title: `v${version}` } as DiagramScene,
    pinned,
  };
}

// ---------------------------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------------------------

type Step =
  | { readonly step: 'save'; readonly slot: number; readonly createdAt: number; readonly pinned: boolean }
  | { readonly step: 'pin'; readonly pick: number; readonly value: boolean }
  | { readonly step: 'failPut' }
  | { readonly step: 'failDelete' }
  | { readonly step: 'breakDeletes' }
  | { readonly step: 'healDeletes' };

interface Scenario {
  readonly cap: number;
  readonly atomic: boolean;
  readonly steps: readonly Step[];
}

const saveStep: fc.Arbitrary<Step> = fc.record({
  step: fc.constant('save' as const),
  slot: fc.nat({ max: 79 }),
  createdAt: fc.integer({ min: 0, max: 1000 }),
  pinned: fc.boolean(),
});
const pinStep: fc.Arbitrary<Step> = fc.record({
  step: fc.constant('pin' as const),
  pick: fc.nat({ max: 1000 }),
  value: fc.constantFrom(true, true, false),
});
const failPutStep: fc.Arbitrary<Step> = fc.constant({ step: 'failPut' as const });
const failDeleteStep: fc.Arbitrary<Step> = fc.constant({ step: 'failDelete' as const });
const breakStep: fc.Arbitrary<Step> = fc.constant({ step: 'breakDeletes' as const });
const healStep: fc.Arbitrary<Step> = fc.constant({ step: 'healDeletes' as const });

const capArb = fc.constantFrom(2, 3, 5, SAVED_DIAGRAMS_CAP);

/** One-shot failures only: P72, P73, P75, P76. */
const oneShotScenarioArb: fc.Arbitrary<Scenario> = fc.record({
  cap: capArb,
  atomic: fc.boolean(),
  steps: fc.array(
    fc.oneof(
      { weight: 6, arbitrary: saveStep },
      { weight: 3, arbitrary: pinStep },
      { weight: 1, arbitrary: failPutStep },
      { weight: 2, arbitrary: failDeleteStep },
    ),
    { minLength: 1, maxLength: 100 },
  ),
});

/** One-shot failures and a delete that breaks for good: P74. */
const brokenDeleteScenarioArb: fc.Arbitrary<Scenario> = fc.record({
  cap: capArb,
  atomic: fc.boolean(),
  steps: fc.array(
    fc.oneof(
      { weight: 6, arbitrary: saveStep },
      { weight: 3, arbitrary: pinStep },
      { weight: 1, arbitrary: failPutStep },
      { weight: 2, arbitrary: failDeleteStep },
      { weight: 1, arbitrary: breakStep },
      { weight: 1, arbitrary: healStep },
    ),
    { minLength: 1, maxLength: 100 },
  ),
});

interface SaveRecord {
  readonly cap: number;
  readonly atomic: boolean;
  readonly entry: SavedDiagram;
  readonly result: SaveWithEvictionResult;
  readonly before: ReadonlyMap<string, SavedDiagram>;
  readonly after: ReadonlyMap<string, SavedDiagram>;
}

/** Run a scenario and hand every save, with the store before and after it, to `onSave`. */
async function play(scenario: Scenario, onSave: (record: SaveRecord) => void): Promise<void> {
  const { cap, atomic, steps } = scenario;
  const fake = makeFake(atomic);
  let version = 0;
  for (const s of steps) {
    switch (s.step) {
      case 'save': {
        const before = new Map(fake.map);
        const entry = makeEntry(`d${s.slot % (2 * cap)}`, s.createdAt, s.pinned, ++version);
        const result = await saveDiagramWithEviction(fake.store, [...before.values()], entry, cap);
        onSave({ cap, atomic, entry, result, before, after: new Map(fake.map) });
        break;
      }
      case 'pin': {
        const ids = [...fake.map.keys()];
        const id = ids[s.pick % Math.max(ids.length, 1)];
        const current = id === undefined ? undefined : fake.map.get(id);
        if (id !== undefined && current !== undefined) {
          fake.map.set(id, { ...current, pinned: s.value });
        }
        break;
      }
      case 'failPut':
        fake.arm.put = true;
        break;
      case 'failDelete':
        fake.arm.del = true;
        break;
      case 'breakDeletes':
        fake.arm.delBroken = true;
        break;
      case 'healDeletes':
        fake.arm.delBroken = false;
        break;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------------------------

function listOf(map: ReadonlyMap<string, SavedDiagram>): string {
  return (
    '[' +
    [...map.values()]
      .map((e) => `${e.id}(created ${e.createdAt}${e.pinned ? ', pinned' : ''}, ${e.title})`)
      .join(', ') +
    ']'
  );
}

function fail(message: string, r: SaveRecord): never {
  throw new Error(
    `${message}\n  cap ${r.cap}, ${r.atomic ? 'with' : 'without'} putWithEviction; saving ` +
      `${r.entry.id} (created ${r.entry.createdAt}${r.entry.pinned ? ', pinned' : ''}, ${r.entry.title}) ` +
      `returned ${JSON.stringify(r.result)}\n  before: ${listOf(r.before)}\n  after:  ${listOf(r.after)}`,
  );
}

// ---------------------------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------------------------

describe('saveDiagramWithEviction (Requirement 22.7-22.11)', () => {
  it(
    'P72: the store never ends above its cap, whatever the save returned',
    async () => {
      await fc.assert(
        fc.asyncProperty(oneShotScenarioArb, (scenario) =>
          play(scenario, (r) => {
            if (r.after.size > r.cap) {
              fail(`the store holds ${r.after.size} entries, the cap is ${r.cap}`, r);
            }
          }),
        ),
        RUNS,
      );
    },
    TIMEOUT_MS,
  );

  it(
    'P73: an entry that was pinned before a save is still in the store after it',
    async () => {
      await fc.assert(
        fc.asyncProperty(oneShotScenarioArb, (scenario) =>
          play(scenario, (r) => {
            for (const [id, entry] of r.before) {
              if (entry.pinned && !r.after.has(id)) {
                fail(`the pinned entry ${id} was removed`, r);
              }
            }
          }),
        ),
        RUNS,
      );
    },
    TIMEOUT_MS,
  );

  /**
   * Random sequences reach this case rarely (it needs a broken delete at the cap, without
   * `putWithEviction`, then an in-place save), so the shrunk counterexample of seed 937312435 is
   * pinned as an explicit example and always runs.
   */
  const P74_REGRESSION: Scenario = {
    cap: 2,
    atomic: false,
    steps: [
      { step: 'save', slot: 14, createdAt: 0, pinned: false },
      { step: 'breakDeletes' },
      { step: 'save', slot: 0, createdAt: 0, pinned: false },
      { step: 'save', slot: 9, createdAt: 0, pinned: false },
      { step: 'save', slot: 0, createdAt: 0, pinned: false },
      { step: 'healDeletes' },
    ],
  };

  it(
    'P74: a failed delete never reports ok: true while the store is over the cap',
    async () => {
      await fc.assert(
        fc.asyncProperty(brokenDeleteScenarioArb, (scenario) =>
          play(scenario, (r) => {
            if (r.result.ok && r.after.size > r.cap) {
              fail(`ok: true, but the store holds ${r.after.size} entries and the cap is ${r.cap}`, r);
            }
          }),
        ),
        { ...RUNS, examples: [[P74_REGRESSION]] },
      );
    },
    TIMEOUT_MS,
  );

  it(
    'P75: saving an existing id updates it in place and evicts nothing',
    async () => {
      await fc.assert(
        fc.asyncProperty(oneShotScenarioArb, (scenario) =>
          play(scenario, (r) => {
            if (!r.before.has(r.entry.id)) return;
            if (!r.result.ok) {
              for (const [id, entry] of r.before) {
                if (r.after.get(id) !== entry) fail(`a failed save changed ${id}`, r);
              }
              if (r.after.size !== r.before.size) fail('a failed save changed the number of entries', r);
              return;
            }
            if (r.after.size !== r.before.size) {
              fail(`an in-place update changed the number of entries from ${r.before.size} to ${r.after.size}`, r);
            }
            if (r.result.evictedId !== undefined) {
              fail(`an in-place update evicted ${r.result.evictedId}`, r);
            }
            for (const [id, entry] of r.before) {
              if (id !== r.entry.id && r.after.get(id) !== entry) fail(`the entry ${id} was changed or removed`, r);
            }
            const stored = r.after.get(r.entry.id);
            if (
              stored === undefined ||
              stored.title !== r.entry.title ||
              stored.thumbnailDataUrl !== r.entry.thumbnailDataUrl ||
              stored.scene !== r.entry.scene
            ) {
              fail(`${r.entry.id} does not hold the new title, thumbnail and scene`, r);
            }
          }),
        ),
        RUNS,
      );
    },
    TIMEOUT_MS,
  );

  it(
    'P76: updating an existing id keeps its pinned flag and its createdAt',
    async () => {
      await fc.assert(
        fc.asyncProperty(oneShotScenarioArb, (scenario) =>
          play(scenario, (r) => {
            const prior = r.before.get(r.entry.id);
            if (prior === undefined || !r.result.ok) return;
            const stored = r.after.get(r.entry.id);
            if (stored === undefined || stored.pinned !== prior.pinned || stored.createdAt !== prior.createdAt) {
              fail(
                `${r.entry.id} was pinned=${prior.pinned}, createdAt=${prior.createdAt}; ` +
                  `afterwards pinned=${stored?.pinned}, createdAt=${stored?.createdAt}`,
                r,
              );
            }
          }),
        ),
        RUNS,
      );
    },
    TIMEOUT_MS,
  );
});
