# Lane T13a Report: Saved diagrams, core and storage driver (Tasks 13.2–13.5, Requirement 11)

**Date:** 2026-11-04  
**Author / Builder:** Antigravity (agy)  
**Lane:** `agy/savedcore` (Tasks 13.2, 13.3, 13.4, 13.5)  
**Spec Reference:** `.kiro/specs/ghost-touch/{requirements.md,design.md,tasks.md}` (Requirement 11, Properties P14 & P15)

---

## 1. Summary of Work

This lane delivers the pure core logic and storage drivers for locally saved diagrams in Ghost Touch, implementing Requirement 11 criteria 11.1–11.7 and sub-tasks 13.2–13.5.

Per the brief `docs/briefs/agy-savedcore.md` and explicit authorization under `AGENTS.md`, Antigravity implemented the core module `frontend/src/core/savedDiagrams.ts`, the storage driver `frontend/src/drivers/diagramStore.ts`, property-based tests for P14 and P15 in `frontend/tests/savedDiagrams.prop.test.ts`, unit tests in `frontend/tests/savedDiagrams.test.ts`, and driver integration tests in `frontend/tests/drivers.diagramStore.test.ts`.

All code complies with:
- **Architecture Rule 1 (tech.md):** Browser APIs (`indexedDB`) isolated entirely within `frontend/src/drivers/`. The core logic in `core/savedDiagrams.ts` is 100% pure (no `window`, `document`, `indexedDB`, `navigator`, or `crypto`).
- **Resilience (Req 11.7):** Every IndexedDB call is protected by `try/catch`. IndexedDB unavailability returns `{ ok: false, error: 'storage_unavailable' }` and never throws or crashes.
- **Zero Interface Drift:** Exported function signatures and types remain strictly compatible with `agy/savedui` and existing screens.

---

## 2. Attribution: Kiro Draft vs. Antigravity Build

In accordance with `AGENTS.md` and the lane brief:

### What came from Kiro's draft (`docs/kiro-wip/`)
- Initial interface shapes and type definitions for `SavedDiagram`, `SAVED_DIAGRAMS_CAP = 20`, and `DiagramStore`.
- Initial function skeletons for `savedTitle`, `makeId`, `chooseEviction`, `capExceeded`, and `orderForDisplay`.
- Baseline `MemoryDiagramStore` and initial draft of `IDBDiagramStore`.

### What Antigravity built, redesigned, and fixed
1. **`applyAdd` capacity bug fix:** Kiro's draft evicted an unpinned entry even when updating an entry with an existing ID at maximum capacity. Antigravity introduced in-place update logic that avoids eviction when updating existing IDs.
2. **`deserialise` string parsing bug fix:** Kiro's draft rejected JSON string inputs (`typeof raw !== 'object'`), returning `undefined`. Antigravity added string detection and `JSON.parse` parsing so `deserialise(serialise(entry))` works reliably.
3. **`deserialise` validation hardening:** Added validation to reject `NaN` or non-finite `createdAt` timestamps, malformed scene objects, and invalid scene `kind` values.
4. **`makeId` defensive sanitization:** Handled `NaN`, negative numbers, and floating timestamps on `nowMs`, and clamped RNG outputs to strictly avoid invalid characters.
5. **`IDBDiagramStore` resource leak fix:** Wrapped transaction execution in `try ... finally { db.close(); }` to prevent database connection leaks on transaction error or rejection.
6. **`IDBDiagramStore` dependency injection:** Enabled optional constructor injection (`idb: IDBFactory | null | undefined = defaultIdb()`) to allow clean unit and integration testing without monkey-patching global variables.
7. **Property test suite (`frontend/tests/savedDiagrams.prop.test.ts`):** Authored fast-check property tests for **P14** (serialise round-trip across all scene kinds, 250 runs) and **P15** (eviction invariants across sequences of saves, 250 runs).
8. **Unit test suite (`frontend/tests/savedDiagrams.test.ts`):** 28 comprehensive example-based tests covering titles, ID generation, eviction selection, capacity checks, display ordering, and deserialisation.
9. **Driver test suite (`frontend/tests/drivers.diagramStore.test.ts`):** 11 tests covering `MemoryDiagramStore`, `IDBDiagramStore` unavailable/error handling, and full CRUD over an in-memory fake `indexedDB`.
10. **Spec tracking:** Ticked tasks 13.2, 13.3, 13.4, and 13.5 in `.kiro/specs/ghost-touch/tasks.md`.

---

## 3. Defects Discovered and Resolved

### Defect 1: `applyAdd` evicts on updates when store is at cap
- **Issue:** In Kiro's draft, `applyAdd` checked `capExceeded(entries.length, cap)` before inspecting whether `newEntry.id` was already present in `entries`. When updating a saved diagram (e.g., toggling `pinned` in `SavedDiagrams.tsx` when the store has 20 items), the function evicted an unpinned item, or returned `{ ok: false, reason: 'all_pinned' }` if all items were pinned.
- **Failing case:** Store with 20 items updating item `id: "d1"`. The count should remain 20 without evicting any other diagram.
- **Fix:** Check `entries.findIndex((e) => e.id === newEntry.id)` first. If found, replace the item in place at the same index without triggering eviction.

### Defect 2: `deserialise` rejected JSON strings
- **Issue:** `serialise(entry)` returns a JSON representation. Kiro's draft checked `if (raw === null || typeof raw !== 'object') return undefined;`. Because `typeof string === 'string'`, any JSON string passed to `deserialise` immediately returned `undefined`.
- **Failing case:** `deserialise(JSON.stringify(entry))` returned `undefined`.
- **Fix:** Inspect `typeof raw === 'string'` and parse via `JSON.parse` with try/catch before shape validation. This allows `deserialise` to accept both JSON strings (from disk/wire/serialise) and plain objects (from IndexedDB `getAll()`).

### Defect 3: Connection leak on IndexedDB errors
- **Issue:** `IDBDiagramStore` called `db.close()` at the end of each method. If `store.getAll()`, `store.put()`, or transaction creation threw an error, `db.close()` was skipped, leaking open connections.
- **Fix:** Placed `db.close()` in a `finally` block following database opening.

### Defect 4: Timestamp validation accepted `NaN`
- **Issue:** `typeof NaN === 'number'`. In Kiro's draft, an object with `{ createdAt: NaN }` was accepted as a valid `SavedDiagram`.
- **Fix:** Enforced `Number.isFinite(r.createdAt)`.

---

## 4. Verification and Proof

All required checks were executed directly from the repo root:

### 1. TypeScript Compilation
```bash
npm --prefix frontend exec -- tsc -p frontend --noEmit
```
- **Exit Code:** `0`
- **Output:** Clean (0 errors).

### 2. Frontend Test Suite (Vitest)
```bash
npm --prefix frontend test
```
- **Exit Code:** `0`
- **Result:** **41 passed (41 test files)**, **459 passed (459 tests)**
- **New tests added and passing:**
  - `tests/savedDiagrams.test.ts`: **28 passed**
  - `tests/savedDiagrams.prop.test.ts`: **2 passed (P14 & P15, 250 runs each)**
  - `tests/drivers.diagramStore.test.ts`: **11 passed**

### 3. Production Build (Vite + PWA)
```bash
npm --prefix frontend run build
```
- **Exit Code:** `0`
- **Output:**
  - `dist/registerSW.js` (0.13 kB)
  - `dist/manifest.webmanifest` (0.49 kB)
  - `dist/index.html` (0.71 kB)
  - `dist/assets/index-*.js` (243.92 kB)
  - `dist/assets/index-*.css` (21.12 kB)
  - PWA service worker generated cleanly.

### 4. Backend Health Check
```bash
backend/.venv/Scripts/python -m pytest backend
backend/.venv/Scripts/python -m ruff check backend
backend/.venv/Scripts/python -m ruff format --check backend
```
- **pytest:** 346 passed, 1 skipped
- **ruff check:** All checks passed!
- **ruff format:** 52 files already formatted.

---

## 5. Files Touched

### Created / Modified (Allowed list):
- `frontend/src/core/savedDiagrams.ts`
- `frontend/src/drivers/diagramStore.ts`
- `frontend/tests/savedDiagrams.test.ts`
- `frontend/tests/savedDiagrams.prop.test.ts`
- `frontend/tests/drivers.diagramStore.test.ts`
- `.kiro/specs/ghost-touch/tasks.md`
- `docs/reports/agy-savedcore-report.md`

---

## 6. Commit groups

The reviewer can commit these changes in the following logical order:

### Commit 1: Pure core logic and unit tests
- **Message:** `feat(core): implement pure logic for saved diagrams (Task 13.2)`
- **Files:**
  - `frontend/src/core/savedDiagrams.ts`
  - `frontend/tests/savedDiagrams.test.ts`

### Commit 2: Property test P14 (Serialise round-trip)
- **Message:** `test(core): add property test P14 for scene serialisation round-trip (Task 13.3)`
- **Files:**
  - `frontend/tests/savedDiagrams.prop.test.ts` (P14 test and scene arbitraries)

### Commit 3: Property test P15 (Eviction invariants)
- **Message:** `test(core): add property test P15 for storage cap and eviction invariants (Task 13.4)`
- **Files:**
  - `frontend/tests/savedDiagrams.prop.test.ts` (P15 eviction invariant test)

### Commit 4: Storage drivers and integration tests
- **Message:** `feat(drivers): implement IndexedDB and memory DiagramStore with error resilience (Task 13.5)`
- **Files:**
  - `frontend/src/drivers/diagramStore.ts`
  - `frontend/tests/drivers.diagramStore.test.ts`

### Commit 5: Spec tasks and completion report
- **Message:** `docs: tick tasks 13.2-13.5 and add Lane T13a completion report`
- **Files:**
  - `.kiro/specs/ghost-touch/tasks.md`
  - `docs/reports/agy-savedcore-report.md`
