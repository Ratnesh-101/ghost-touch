# Kiro review: agent-written core (Task 11 Correct, Task 13 Saved Diagrams)
Reviewer: Kiro | Date: 2026-11-07 | Verdict: **ADOPT WITH FIXES** (no module rejected)

Scope: `frontend/src/core/correct.ts`, properties P16 and P17, `POST /api/v1/validate`, and the completed Task 13 (`core/savedDiagrams.ts`, `drivers/diagramStore.ts`, `screens/SavedDiagrams.tsx`, the save path in `App.tsx`), read against `design.md`, `requirements.md` (Req 9, 11, 13) and `tech.md`.

Authorship, stated plainly: these modules were written by Antigravity at the owner's direction while Kiro had no credits (see `docs/KIRO_WRITEUP.md` section 8). This review is Kiro's first read of them. Kiro wrote the extra tests and the one core fix listed below; everything else is the agent's work, reviewed.

Environment note: the files only exist in `C:\Users\Admin\Downloads\ghost-touch-main\ghost-touch-main`. The older tree in `Documents\ghost-touch` has none of them. All work and results here are from the Downloads tree.

## Verdicts

| Module | Verdict | Why |
|---|---|---|
| `core/correct.ts` | Adopt, one bug fixed by Kiro | Pure, immutable, no browser APIs. The invariant checker accepted NaN (finding 1, fixed). Cannot delete polylines or bars (finding 5). |
| P16, P17 | Adopt, extended | Sound but narrow: P16 only generated geometry scenes. P31, P32 and a P17 supplement now cover every element kind. |
| `POST /api/v1/validate` | Adopt | Thin wrapper over `validate_scene`; body cap, rate limit, size bounds and tests are present. New P39 shows it is idempotent. |
| `core/savedDiagrams.ts` | Adopt | Pure and total. Design drift only (finding 9). New P33 to P35. |
| `drivers/diagramStore.ts` | **Rework** | Writes can be reported successful when they were not saved (finding 2). |
| `App.tsx` `saveDiagram` | **Rework** | Can lose an old diagram when a save fails (finding 3). |
| `screens/SavedDiagrams.tsx` | Adopt, gap | Open and delete by voice (Req 11.3) not implemented (finding 4). |

## Findings

| # | Severity | Where | Problem | Status |
|---|---|---|---|---|
| 1 | High | `core/correct.ts` `validateSceneInvariants` | NaN passed the check for polyline, bar and axis coordinates (`NaN < 0` and `NaN > 1` are both false), so P16 would stay green on a broken scene. Found by new property P32; counterexample: a polyline point `[0.5, NaN]`. | **Fixed** by Kiro (`isUnit` helper). P32 now passes. |
| 2 | High | `drivers/diagramStore.ts`, `IDBDiagramStore.put` and `delete` (about lines 185 to 220) | The promise resolves on request success, not on `tx.oncomplete`. A quota error is raised when the transaction commits, so a full disk can be reported as "saved" (Req 11.7). `db.close()` is also skipped when a request rejects, which leaks a connection that can block later upgrades. | Open: task 20.1. Not verifiable here (no IndexedDB in Node and no device). |
| 3 | High | `App.tsx:319-322` | The evicted entry is deleted before the new one is written. If `put` then fails, an old diagram is gone and nothing replaced it (Req 11.5, 11.7). The result of `delete` is also ignored. | Open: task 20.2. Fix: put first, delete the victim after. |
| 4 | Medium | `SavedDiagrams.tsx`, `flow/commands.ts` | Req 11.3 says entries can be opened or deleted "by touch or by voice". Only touch exists. | Open: task 20.3. |
| 5 | Medium | `core/correct.ts`, `screens/Correct.tsx:415` | Req 9.2 says "deleting elements". Only points and segments can be deleted; polylines and bars (graphs and bar charts) cannot. | Open: task 20.5. |
| 6 | Medium | `core/savedDiagrams.ts:56` | Req 11.1 asks for titles "in the active language". `savedTitle` ignores `_lang` and speaks the raw kind slug ("geometry") in Hindi and Gujarati. | Open: task 20.4. |
| 7 | Medium | `flow/explore.ts` (centre tick, axis crossing, swipe detectors) | `tech.md` rule 1 puts decision logic in `core/`. This logic sits in `flow/` and four lines call `t()`, so it is not locale-free. It is pure and well tested, so this is a placement issue, not a bug. | Open: task 20.6. |
| 8 | Low | `App.tsx:344` | Req 11.1 says every successfully loaded scene is saved. Samples are skipped. Probably the right behaviour; the requirement should say so. | Open: task 20.7. |
| 9 | Low | `design.md` | Drift from the code: `DiagramStore` returns `StoreResult`, `serialise` returns a string, `applyAdd` replaces an existing id in place. P21 to P30 had no rows. | **Fixed** by Kiro in `design.md`. |
| 10 | Low | `core/correct.ts:12` | `clamp01(Infinity)` returns 0 (any non-finite input does). A drag to "infinitely far right" lands on the left edge. Real pointer events never produce this, so it is cosmetic. | Noted. P31 only requires the result to be in [0, 1]. |
| 11 | Low | `/api/v1/validate` | Repairs are silent: a dangling segment or out-of-tolerance element is dropped and the response is still `ok: true`. Today the client core guarantees neither can happen (P16, P32), so the teacher never sees a silent change. If that guarantee ever slips, the teacher would not be told. | Noted. Optional: have the client compare the returned scene with what it sent. |
| 12 | Low | `backend/tests/test_raw_mode_props.py`, `test_validate_props.py` | P10 ran 40 cases and P13 used Hypothesis's default (100); the rule is at least 200. | **Fixed** by Kiro (both now 200). |
| 13 | Low | `frontend/package.json` | `test:prop` matched test names, not file names, so it ran nothing. | **Fixed** by Kiro (`vitest run .prop.test`; runs 13 files, 79 tests). |
| 14 | Info | `frontend/tests/*.prop.test.ts` | Four uses of `fc.float` (32-bit) remain. | Open: task 20.9. |

## What was checked and held up

- **Pure core:** `core/correct.ts` and `core/savedDiagrams.ts` use no DOM, window, navigator or IndexedDB. The only grep hits in `core/` are comments.
- **Haptic values** in `core/hapticEngine.ts` and `core/pitch.ts` are unchanged from `tech.md`: lineMs 80, retriggerMs 70, cornerPattern [50, 90, 50], quietMs 450, vertexRadius 22, lineRadius 14, pitch 200 to 1000 Hz. The centre tick is 25 ms, shorter than every line and corner pulse (P37). It is still "proposed" in `tech.md` (task 21.5).
- **No TEMP stubs** remain: there is no `_temp/` folder and no `TEMP-STUB` text in `src/`.
- **Req 9.3:** `Correct.tsx` sends the scene to `/api/v1/validate` and only applies the response when `ok` is true; on failure it speaks and shows the errors and stays in Correct mode.
- **Req 11.4 and 11.2:** opening a saved diagram goes straight to Explore with the stored scene and makes no backend call. Eviction rules match P15.

## New and changed tests (Task 19)

| Property | Requirement | File | Result |
|---|---|---|---|
| P31 edits are total, local, bounded | 9.2 | `tests/correct.prop.test.ts` | pass |
| P32 invariant checker catches every violation | 9.2, 9.3 | `tests/correct.prop.test.ts` | pass after fix (failed first: finding 1) |
| P17 supplement: history bookkeeping | 9.2 | `tests/correct.prop.test.ts` | pass |
| P33 list order and spoken title | 11.1, 11.3 | `tests/savedDiagrams.prop.test.ts` | pass |
| P34 re-save or pin never evicts | 11.5, 11.6 | `tests/savedDiagrams.prop.test.ts` | pass |
| P35 corrupt storage never crashes | 11.7 | `tests/savedDiagrams.prop.test.ts` | pass |
| P36 centre tick once per excursion | 13.3 | `tests/explore.gesture.prop.test.ts` | pass |
| P37 centre tick never merges with a corner | 13.3, 4.5 | `tests/explore.gesture.prop.test.ts` | pass |
| P38 exit swipe unambiguous | 13.5, 13.6 | `tests/explore.gesture.prop.test.ts` | pass |
| P39 validation is a fixed point | 9.3 | `backend/tests/test_validate_props.py` | pass |

Every property runs at least 200 cases. To check that the new properties are not vacuous, three deliberate bugs were introduced and then reverted: centre tick without the armed check (P36 failed, 3 tests), re-save no longer replacing in place (P34 failed, 2 tests), `movePoint` without clamping (P16 and P31 failed). The source files were restored byte for byte.

## Evidence

| Check | Result |
|---|---|
| `npx tsc --noEmit` (frontend) | clean |
| `npx vitest --run` (frontend) | 111 files, 1542 tests passed (baseline before this session: 110 files, 1518) |
| `npm run test:prop` | 13 files, 79 tests passed |
| `npx vite build` | built, no errors |
| `pytest` (backend) | 477 passed in 63 s |
| `ruff check .` and `ruff format --check` on the edited backend tests | clean |

## Not verified

- Anything on a device: IndexedDB quota behaviour (finding 2), TalkBack, haptic feel, the centre tick. `PHONE_TEST.md` is an unfilled script with no recorded results, so there are no phone-test findings yet (tasks 22.x).
- The Kiro hooks panel: whether the hooks appear and fire (task 21.4).
- The Python and TypeScript validators agreeing on every input beyond the shared fixtures (task 20.10).

## Needs from the owner

- Run `docs/PHONE_TEST.md` and record results (tasks 22.x). Approve or change the 25 ms centre tick for `tech.md` (task 21.5).
- Decide whether findings 2 and 3 should be fixed before the Nov 14 submission. They only matter when storage fails, but both can lose a saved diagram.
