# Lane r7-flow Report

Status: DONE
Builder: agy (Antigravity), reviewed by Claude
Lane: r7-flow (fixes for the Nov 12 Kiro audit: app flow, Correct, Teach, share)
Date: 2026-11-12

## Scope & Completed Fixes

### 1. FLOW-01 (Medium) — Correct.tsx handleSave & App.tsx handleSaveCorrect
- Problem: A save validating while the user leaves Correct with system Back (and confirms discard)
  previously invoked onSave upon promise resolution, forcing Explore with discarded edits and
  writing them to diagramStore.
- Fix:
  - In `frontend/src/screens/Correct.tsx`: added `isMountedRef` and `saveAbortControllerRef` with
    AbortSignal forwarded through `executeCorrectSave` to `requestValidate`. If the component
    unmounts or aborts, `executeCorrectSave` throws an abort error rather than falling back to
    offline save, and unmounted state updates, earcons, and `onSave` invocations are prevented.
  - In `frontend/src/App.tsx`: updated `handleSaveCorrect` with guard
    `if (viewRef.current.screen !== 'correct') return;` to ignore any late save calls.
- Tests: `frontend/tests/correct.lateSave.test.tsx` verifying AbortSignal rejection, unmounted
  Correct component safety, and system Back late save rejection in App.

### 2. FLOW-03 (Medium) — ShareError.tsx Cold Open Accessibility
- Problem: On a cold open with a corrupted/unparseable share link (`#s=...`), speech synthesis
  is blocked without user gesture, no element was focused, and message rendered without a live
  region role.
- Fix:
  - In `frontend/src/screens/ShareError.tsx`: restored speech collision prevention contract (no
    alert role when speech is available, polite StatusText live region and card alert when muted).
    Implemented FLOW-03 with focus only: focused the error heading element on mount with
    `tabIndex={-1}` so TalkBack users immediately land on the error context on cold load.
  - In `frontend/src/App.tsx`: passed `canSpeak={drivers.speech.canSpeak}` directly.
- Tests: `frontend/tests/shareError.coldOpen.test.tsx` verifying cold open heading focus with
  `tabIndex={-1}` and error message rendering.

### 3. FLOW-04 (Medium) — App.tsx handleOpenSharedDiagram Reset
- Problem: Opening a shared diagram did not reset `lastSavedDiagramId` or `photoUrl`, allowing
  subsequent Correct saves to overwrite a previously captured diagram entry and bleed through its
  photo background.
- Fix:
  - In `frontend/src/App.tsx`: updated `handleOpenSharedDiagram` to set
    `lastSavedDiagramId.current = null` and call `updatePhotoUrl(null)` before switching view to
    Explore.
- Tests: `frontend/tests/app.shareOpen.resets.test.tsx` verifying `photoUrl === null` in Correct
  and entry isolation between captured and shared diagrams.

### 4. FLOW-05 (Medium) — Teach.tsx handleLoadScene Unsaved Changes Confirmation
- Problem: Loading a diagram into the Teacher editor replaced history and teacher details without
  prompting confirmation even when the editor held unsaved edits.
- Fix:
  - In `frontend/src/screens/Teach.tsx`: exported `executeTeachLoad` pure helper and updated
    `handleLoadScene` to check `isDirty`. When dirty, it prompts
    `window.confirm(t('teach.confirmLeave'))` and speaks `t('teach.confirmLeave')`. Declining
    calls `sayAndStatus(t('teach.stayingInEditor'))` and retains `history.present` without changes.
- Tests: `frontend/tests/teach.loadDirty.test.tsx` verifying `executeTeachLoad` helper and
  interactive confirmation behavior in `<Teach>`.

### 5. CORE-A9 (Low) — LoadModal.tsx Localised Saved Titles
- Problem: `LoadModal.tsx` displayed static `d.title` (captured at save time in original language)
  rather than language-aware title dynamically computed from the active language.
- Fix:
  - In `frontend/src/components/teach/LoadModal.tsx`: subscribed to language store via
    `useSyncExternalStore(subscribeLang, getLang, getLang)` and called `savedTitle(d.scene, lang)`
    matching `SavedDiagrams.tsx`.
- Tests: `frontend/tests/teach.loadModalTitle.test.tsx` verifying Hindi and Gujarati localized
  kind titles ('ज्यामिति: A, B, C' and 'ભૂમિતિ: A, B, C') and custom title preservation.

## Pass 2 Follow-Up (Supervisor Gate Fixes)

### A. Production Code Regressions Resolved
1. **FLOW-03 ShareError Speech Collision Prevention contract restored** (`frontend/src/screens/ShareError.tsx`):
   - Restored original contract: When speech synthesis is available (`canSpeak === true`), `<StatusText>`
     renders plain text without `role="status"` or `aria-live`, and the parent card omits `role="alert"`
     to prevent double-speech collisions with TTS.
   - When speech is unavailable (`canSpeak === false`), the card renders with `role="alert"` (1 alert
     element) and `<StatusText>` provides `role="status"` and `aria-live="polite"`.
   - Implemented FLOW-03 accessibility focus: On mount, focused the heading (`h1` with existing `tabIndex={-1}`)
     so TalkBack screen readers land directly on the error context on cold open without introducing
     duplicate `role="alert"`.
   - Verified regression suites `tests/m3.sharedLinkGate.test.ts` (R5-04 & R5-05) and
     `tests/share.open.errors.test.tsx` pass cleanly with unchanged assertions.

2. **FLOW-01 Correct Invariant Fallback Resilience** (`frontend/src/screens/Correct.tsx`):
   - In `executeCorrectSave`, called `doRequestValidate(scene)` without extra options when `signal` is
     undefined, preserving single-argument signature for `mockValidate` in `tests/k6.pwa-offline.test.ts`.
   - In `Correct.tsx`, ensured the active screen ref (`isMountedRef`) remains true while Correct
     is active so offline invariant fallbacks resolve cleanly to `onSave` during normal flows.
     Guard only suppresses save callbacks if Correct was unmounted or left (`handleCancel`).

### B. New r7 Test Suite Fixes
3. **`tests/shareError.coldOpen.test.tsx`**:
   - Added `vi.mock` for `../src/screens/Capture`, `../src/drivers/pdf`, and worker url
     `pdfjs-dist/build/pdf.worker.min.mjs?url` (matching `tests/z3.appMergedFixes.test.tsx`) to
     prevent jsdom dynamic worker import errors.
   - Used `importOriginal` in `../src/config/features` mock.
   - Updated assertions to check heading focus on mount (`tabIndex={-1}`) and error title/message.

4. **`tests/app.shareOpen.resets.test.tsx`**:
   - Updated `../src/config/features` mock with `async (importOriginal) => ({ ...(await importOriginal()), ... })`,
     providing `getStoredGuideSetting` and all feature flags.

5. **`tests/teach.loadDirty.test.tsx`**:
   - Fixed interactive dirty state simulation to match `tests/teach.editor.test.tsx`: selects vertex on
     `<canvas>` via pointer down and activates Delete to drive dirty state, verifying `onDirtyChange(true)`
     and `undo` button activation.
   - Installed `window.confirm` mock before trigger click.
   - Verified declining leaves editor dirty and retains edits; confirming resets history to new clean scene.

6. **`tests/teach.loadModalTitle.test.tsx`**:
   - Fixed TS2322 type error by setting `thumbnailDataUrl: ''` instead of `null` per `SavedDiagram` schema.
   - Replaced non-existent `store.seed()` with `await store.put(...)` in `beforeEach` and custom title tests.

7. **`tests/correct.lateSave.test.tsx`**:
   - Removed unused `mockRequestValidate` and `resolveValidate` declarations, resolving TS6133 unused
     variable error and driving deferred validation via `deferredValidateResolve`.

## Deferred List
Per lane brief `docs/briefs/agy-r7-flow.md`:
- FLOW-02 (Share Back history; requires manual verification in real mobile browser)
- FLOW-06 (SavedDiagrams focus on delete/cancel; Low finding skipped per brief)
- FLOW-07 (PDF driver timeout error mapping; Low finding skipped per brief)
- FLOW-08 (Saved diagram kind slug underscores; Low finding skipped per brief / Kiro)
- FLOW-09 (SavedDiagrams String.replace patterns; Low finding skipped per brief)
- CORE-A1 through CORE-A8 (Kiro-owned core modules / skipped per brief)

## Files Touched
- `frontend/src/screens/Correct.tsx`
- `frontend/src/App.tsx`
- `frontend/src/screens/ShareError.tsx`
- `frontend/src/screens/Teach.tsx`
- `frontend/src/components/teach/LoadModal.tsx`
- `frontend/tests/correct.lateSave.test.tsx` (new)
- `frontend/tests/shareError.coldOpen.test.tsx` (new)
- `frontend/tests/app.shareOpen.resets.test.tsx` (new)
- `frontend/tests/teach.loadDirty.test.tsx` (new)
- `frontend/tests/teach.loadModalTitle.test.tsx` (new)
- `docs/reports/agy-r7-flow-report.md` (this report)
- `docs/BUILD_LOG.md`
