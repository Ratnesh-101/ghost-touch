# Lane Report: o2-save-rollback (turn Kiro's P83 green)

**Status:** DONE
**Tool:** agy, reviewed by Claude
**Lane:** o2-save-rollback

## Brief Summary
Fixed `saveDiagramWithEviction` fallback rollback logic in `frontend/src/flow/saved.ts`
so that when a victim delete fails during multi-eviction fallback, any previously
deleted victims are restored (re-put), preventing loss of existing entries on
partial save failures (satisfying Requirement 22.14 and turning Kiro's P83 green).
Added direct regression tests in `frontend/tests/saved.rollback.test.ts`.

## Implementation Details
- In `frontend/src/flow/saved.ts`:
  - When `evictedIds.length > 1` or when the store lacks `putWithEviction`, the
    fallback loop performs an evict-after-put sequence.
  - Tracked `deletedVictims` as deletions succeed.
  - If any victim `store.delete` call fails:
    1. First, re-put every victim that was already deleted to restore its full content.
    2. Then, roll back the new entry (`await store.put(prior)` for in-place updates,
       or `await store.delete(entryToSave.id)` for new diagrams).
    3. Return `{ ok: false, error: deleteResult.error }`.
  - Secondary errors or exceptions during restoration/rollback are trapped gracefully
    so that the operation consistently reports `{ ok: false }` and never claims success.
  - Maintained the single-transaction IndexedDB path (`IDBDiagramStore.putWithEviction`)
    from lane p2 (R5-02) untouched.

## Regression Tests
- Added `frontend/tests/saved.rollback.test.ts` containing focused tests:
  1. Shrunk counterexample (seed `1120139535`): cap 2, store holds `d0..d3` unpinned,
     update `d0`, 3rd mutating call fails (`delete(d2)` fails after `delete(d1)` ok).
     Verifies `d1` is restored and not lost, and all 4 diagrams remain intact.
  2. MemoryDiagramStore multi-victim fallback: confirms that `MemoryDiagramStore`
     with `putWithEviction` takes the fallback path when `evictedIds.length > 1` and
     rolls back cleanly without entry loss.
  3. New entry rollback: confirms that when a brand-new diagram is saved and victim
     eviction fails, the new diagram is deleted and deleted victims are re-put.
  4. Pinned entries skipped: confirms that pinned entries are never selected as victims
     and remain pinned and intact during rollback.
  5. Pinned update preservation: confirms that updating an existing pinned diagram
     preserves `pinned: true` on rollback.
  6. Refusal when surplus cannot be satisfied (`all_pinned` error).
  7. Secondary failure during victim re-put still reports `ok: false` and never
     claims success.

## Verification
- Verified production code only was modified (`frontend/src/flow/saved.ts`).
- No Kiro-owned files (`frontend/src/core/**`, `*.prop.test.ts`, `.kiro/**`) were edited.
- Property test oracle `frontend/tests/saved.writeOrder.prop.test.ts` (P83) and
  `frontend/tests/saved.eviction.prop.test.ts` (P72-P76) are satisfied.
- Lines kept within 100 columns and formatted cleanly.
- `docs/BUILD_LOG.md` entry appended with tool = "agy, reviewed by Claude".

## Pass 2 Note
Fixed test setup in `frontend/tests/saved.rollback.test.ts`: added `d3` so surplus is 2 during
update of `d0` at cap 2, allowing injected failing calls 3 and 4 to execute and verify rollback.

## Deferred
None.
