# Lane f3-fix-teach Report: Teacher Editor & Whole-App Integration Fixes

**Lane**: f3-fix-teach  
**Builder**: agy, reviewed by Claude  
**Date**: 2026-11-06  
**Status**: Complete  
**Brief**: `docs/briefs/agy-f3-fix-teach.md`  
**Reference Contracts**: `docs/briefs/fix-common.md`, `docs/briefs/guide-share-contract.md`, `AGENTS.md`  

---

## Executive Summary

All confirmed High and Medium findings assigned from `docs/reports/audit-a3-teach-editor.md` and `docs/reports/audit-a5-integration.md` (Teach scope) have been re-verified in the current code, resolved at root cause with minimal surgical changes, and backed by a comprehensive regression test suite (`frontend/tests/fix.teach.editor.test.tsx` containing 20 tests). In addition, all relevant low findings within allowed files and the spec requirement for the honesty disclosure line in `SharePanel` have been resolved.

Every Design Token bare hex literal in `frontend/src/styles/teach.css` was converted to `var(--gt-*, <hex>)` fallbacks, and `teach.css` was integrated into the Design Token Color Property P20 test runner in `frontend/tests/labTheme.prop.test.ts`.

All 108 frontend test files (1,479 tests) pass cleanly, `tsc --noEmit` reports 0 errors, `npm run build` succeeds without issues, and no Kiro-owned or forbidden files were modified.

---

## Findings Status Matrix

| ID | Severity | File(s) | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FINDING-01** | High | `Teach.tsx`, `VerifyForm.tsx` | Stale share link / QR code after editing teacher name or note | **FIXED** |
| **FINDING-02** | High | `Teach.tsx`, `VerifyForm.tsx` | Async verification race condition and in-flight editing | **FIXED** |
| **FINDING-03** | High | `LoadModal.tsx` | Missing keyboard Tab focus trap in LoadModal dialog | **FIXED** |
| **FINDING-04** | High | `Teach.tsx`, `LoadModal.tsx` | Focus lost to `document.body` on modal close and control disable | **FIXED** |
| **FINDING-05** | High | `Teach.tsx`, `VerifyForm.tsx` | Invalid axis positions do not block verification in function_graph | **FIXED** |
| **FINDING-06** | High | `Teach.tsx` | Unsaved edits data loss on back navigation or tab close | **FIXED** |
| **FINDING-07** | High | `i18n/index.ts` | Missing Hindi and Gujarati translations for `teach.qrTooLong` | **FIXED** |
| **FINDING-08** | Med | `flow/teach.ts` | `generateUniquePointId` ID collisions with segments/polylines/bars | **FIXED** |
| **FINDING-09** | Med | `TeachCanvas.tsx` | Axes, bars, and polylines disappear during point drag operations | **FIXED** |
| **FINDING-10** | Med | `Teach.tsx`, `flow/teach.ts` | Boundary nudge pushes duplicate undo history states & false announcements | **FIXED** |
| **FINDING-11** | Med | `LoadModal.tsx`, `Teach.tsx` | Loading diagram from share link drops verifier name and note | **FIXED** |
| **FINDING-12** | Med | `LabSettings.tsx` | "Open Teacher Editor" causes back-to-back speech cutoff | **FIXED** |
| **A5-03** | High | `styles/teach.css`, `labTheme.prop.test.ts` | 20+ unmanaged bare hex colors in `teach.css`; add to P20 scan | **FIXED** |
| **A5-04** | High | `Teach.tsx` | Mid-flow language switch desynchronization in Teach screen | **FIXED** |
| **Honesty** | Spec | `SharePanel.tsx` | Add honesty line `share.honesty` to SharePanel | **FIXED** |
| **FINDING-13** | Low | `Teach.tsx`, `TeachCanvas.tsx` | Hardcoded English strings in toolbar and canvas | **FIXED** |
| **FINDING-14** | Low | `SharePanel.tsx` | Uncleaned setTimeout on unmount in SharePanel | **FIXED** |
| **FINDING-15** | Low | `Teach.tsx` | Unused dedicated teacher selection announcement keys | **FIXED** |
| **FINDING-17** | Low | `clipboard.ts` | Clipboard fallback textarea cleanup missing finally block | **FIXED** |

---

## Detailed Findings & Fixes

### FINDING-01 · High · Stale share link / QR code after editing teacher name or note
- **Re-verification**: Confirmed. In `Teach.tsx`, modifying `teacherName` or `teacherNote` updated local state without resetting `shareData`, leaving a stale link and QR code from the previous verification visible.
- **Root Cause**: `onNameChange` and `onNoteChange` passed `setTeacherName` and `setTeacherNote` directly without invoking `setShareData(null)`.
- **Fix**: Wrapped `onNameChange` and `onNoteChange` in `Teach.tsx` to call `setShareData(null)` on every keystroke/change in teacher name or note.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-01").

### FINDING-02 · High · Async verification race condition & in-flight editing
- **Re-verification**: Confirmed. `handleVerify` awaits `qrDataUrl(url)`. During generation, users could click verify multiple times or edit the diagram on canvas. When the promise resolved, it wrote the old scene's URL into `shareData`.
- **Root Cause**: No `isVerifying` loading state, `VerifyForm` submit button was not disabled during in-flight generation, and no check was performed upon promise resolution to ensure the scene had not changed.
- **Fix**:
  1. Added `isVerifying` state in `Teach.tsx` and passed `disabled={isVerifying}` to `VerifyForm`.
  2. Maintained `historyRef.current = history`.
  3. Checked `if (historyRef.current.present === sceneSnapshot)` before calling `setShareData`.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-02").

### FINDING-03 · High · Missing keyboard Tab focus trap in `LoadModal`
- **Re-verification**: Confirmed. `LoadModal` set `role="dialog"` and `aria-modal="true"`, but its `handleKeyDown` only handled `Escape`. Pressing `Tab` from the last focusable element escaped into the canvas and toolbar behind the modal.
- **Root Cause**: Missing Tab key cycle query and wrap logic.
- **Fix**: Added standard Tab / Shift+Tab keyboard focus trap in `LoadModal.tsx` querying all active focusable elements and wrapping focus between first and last elements.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-03").

### FINDING-04 · High · Focus lost to `document.body` on modal close and control disable
- **Re-verification**: Confirmed. Closing `LoadModal` dropped focus to `document.body`. Disabling the Delete button after element deletion, and disabling the Undo button after the last undo dropped focus to `document.body`.
- **Root Cause**: Lack of trigger button ref retention on `LoadModal` close, and lack of programmatic focus shift before disabling focused buttons.
- **Fix**:
  1. Stored `loadBtnRef = useRef<HTMLButtonElement>(null)` and restored focus when `isLoadModalOpen` transitions from true to false.
  2. Stored `addVertexBtnRef = useRef<HTMLButtonElement>(null)` and shifted focus to Add vertex button when Delete is pressed or when Undo is pressed on the final undoable action.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-04").

### FINDING-05 · High · Invalid axis positions do not block verification in `function_graph`
- **Re-verification**: Confirmed. Typing an invalid axis position (e.g. 1.5) showed an error message but did not update `history.present`. Because `isValidDiagram` only checked `validateShareScene(history.present).ok`, it evaluated to `true`, leaving the "Mark verified" button enabled.
- **Root Cause**: `isValidDiagram` omitted the `!axisError` condition.
- **Fix**: Updated `isValidDiagram` to `validationResult.ok && !axisError`. When an axis coordinate error is present, verification is strictly blocked.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-05").

### FINDING-06 · High · Unsaved edits data loss on back navigation or tab close
- **Re-verification**: Confirmed. Clicking Back in the header immediately exited without prompt, losing custom vertices and notes. No `beforeunload` handler protected against closing the browser tab.
- **Root Cause**: No dirty state tracking or exit guards.
- **Fix**:
  1. Defined `isDirty = canUndo(history) || teacherName.trim().length > 0 || teacherNote.trim().length > 0`.
  2. Registered `beforeunload` listener when `isDirty`.
  3. Added `handleBack` prompting confirmation via `window.confirm(t('teach.confirmLeave'))` when `isDirty`.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-06").

### FINDING-07 · High · Missing Hindi and Gujarati translations for `teach.qrTooLong`
- **Re-verification**: Confirmed. `teach.qrTooLong` in `hi` and `gu` contained verbatim English strings.
- **Root Cause**: Audit finding confirmed in `frontend/src/i18n/index.ts`.
- **Fix**: Updated translations:
  - `hi`: `'क्यूआर कोड के लिए लिंक बहुत लंबा है; लिंक कॉपी करें का उपयोग करें'`
  - `gu`: `'ક્યુઆર કોડ માટે લિંક ખૂબ લાંબી છે; લિંક કોપી કરો વાપરો'`
  Updated `docs/user-test/translation-review.md` and `translation-review.csv`.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-07").

### FINDING-08 · Med · `generateUniquePointId` ID collisions
- **Re-verification**: Confirmed. `generateUniquePointId` only checked `existingPoints`, causing collision if segments, polylines, or bars used an ID like `p2`.
- **Root Cause**: Missing check across `scene.segments`, `scene.polylines`, and `scene.bars`.
- **Fix**: Expanded `generateUniquePointId` to accept `DiagramScene | Point[]`, collecting all element IDs across points, segments, polylines, and bars. Updated `addVertex(scene)` to check the entire scene.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-08").

### FINDING-09 · Med · Canvas drag disappears axes, bars, and polylines
- **Re-verification**: Confirmed. Pointer move called `renderCanvasWithScene` which was a stripped-down routine omitting axes, bars, polylines, and segment labels.
- **Root Cause**: Duplicate rendering function missing element types.
- **Fix**: Parameterized `renderCanvas(view, activeScene = scene)` to render all scene elements uniformly and called `renderCanvas(view, tempScene)` during drag. Removed obsolete `renderCanvasWithScene`.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-09").

### FINDING-10 · Med · Boundary nudge duplicate history & false speech
- **Re-verification**: Confirmed. Nudging a point clamped at boundary (e.g. x = 1.0) returned a new scene reference, pushing duplicate undo history and announcing false movement.
- **Root Cause**: `nudgeVertex` did not check if clamped coordinates matched existing coordinates before calling `movePoint`.
- **Fix**: In `nudgeVertex`, checked `if (newX === pt.x && newY === pt.y) return scene;`. In `Teach.tsx:handleNudgePoint`, checked `if (updated !== history.present)` before applying edit and speaking.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-10").

### FINDING-11 · Med · Loading diagram from share link drops verifier name and note
- **Re-verification**: Confirmed. `LoadModal.handleShareSubmit` only passed `scene` and `title` to `onLoadScene`, dropping `verifiedBy` and `note`.
- **Root Cause**: `onLoadScene` callback signature did not accept the decoded `SharePayload`.
- **Fix**: Extended `onLoadScene(scene, sourceTitle, payload?: SharePayload)` in `LoadModal.tsx`. In `Teach.tsx:handleLoadScene`, populated `setTeacherName(payload.verifiedBy)` and `setTeacherNote(payload.note)` when present.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-11").

### FINDING-12 · Med · `LabSettings.tsx` speech cutoff on "Open Teacher Editor"
- **Re-verification**: Confirmed. Clicking "Open Teacher Editor" called `handleClose()` which announced `lab.settings.closed`, immediately cut off or cancelling `teach.intro`.
- **Root Cause**: `handleClose` had no option for silent closure when transitioning to a destination screen with its own entrance announcement.
- **Fix**: Added `silent?: boolean | unknown` option to `handleClose(silent)`. In "Open Teacher Editor" button click handler, called `handleClose(true)`.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("FINDING-12").

### A5-03 · High · Bare hex colors in `teach.css` and Property P20 scan
- **Re-verification**: Confirmed. 20+ unmanaged bare hex literals in `teach.css` were masked because `teach.css` was omitted from `screenStylesheets` in `labTheme.prop.test.ts`.
- **Root Cause**: Missing design token `var(--gt-*, <hex>)` wrappers and omission from test scan list.
- **Fix**:
  1. Converted all bare hex literals in `frontend/src/styles/teach.css` to token fallbacks (`var(--gt-danger, #f85149)`, `var(--gt-danger-text, #ff7b72)`, `var(--gt-green, #39ff88)`, `var(--gt-charcoal, #0b0b10)`, `var(--gt-focus, #58a6ff)`, `var(--gt-surface, #161b22)`, `var(--gt-border-subtle, #30363d)`, `var(--gt-text, #f0f6fc)`, `var(--gt-accent, #ffdf5d)`, `var(--gt-surface-sunken, #0d1117)`, `var(--gt-text-white, #ffffff)`).
  2. Added `'teach.css'` to `screenStylesheets` in `frontend/tests/labTheme.prop.test.ts:410`.
- **Test**: `npm test frontend/tests/labTheme.prop.test.ts` passes Property P20 with zero violations.

### A5-04 · High · Mid-flow language switch desynchronization in Teach screen
- **Re-verification**: Confirmed. `Teach.tsx` did not subscribe to `subscribeLang`, causing status card text to freeze and TTS voice to stay on old language.
- **Root Cause**: Missing `useSyncExternalStore(subscribeLang, getLang, getLang)`.
- **Fix**: Added `useSyncExternalStore(subscribeLang, getLang, getLang)` to `Teach.tsx`. Wired TTS speech calls with `LANG_BCP47[activeLang]` and added effect to update intro status text on language change.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("A5-04").

### Honesty line in `SharePanel.tsx`
- **Re-verification**: Spec requirement from `guide-share-contract.md` and brief.
- **Fix**: Added `<p className="gt-teach__honesty-notice" role="note">{t('share.honesty')}</p>` to `frontend/src/components/teach/SharePanel.tsx`. Reused existing CSS token-compliant styling `.gt-teach__honesty-notice`.
- **Test**: `frontend/tests/fix.teach.editor.test.tsx` ("Honesty line in SharePanel").

### FINDING-13, 14, 15, 17 (Low severity fixes)
- **FINDING-13**: Replaced hardcoded strings with `t('teach.toolbar')`, `t('explore.xAxis')`, `t('explore.yAxis')`, and `t('teach.verifyError')`. Added translations across `en`, `hi`, `gu`.
- **FINDING-14**: Added unmount cleanup hook in `SharePanel.tsx` to clear `copyTimerRef.current` timeout.
- **FINDING-15**: Updated `Teach.tsx:handleSelect` to use `teach.selectedVertex` and `teach.selectedSegment` for teacher selection announcements.
- **FINDING-17**: Wrapped fallback textarea DOM removal in `frontend/src/drivers/clipboard.ts` in a `finally` block to ensure cleanup if `execCommand` throws.

---

## Verification Proof (DoD Commands)

### 1. Frontend Test Suite
`npm --prefix frontend test`
- **Result**: 108 test files passed (108), 1,479 tests passed (1,479), 0 failures. Duration: 1.85s.

### 2. Frontend Type Check
`npm --prefix frontend exec -- tsc -p frontend --noEmit`
- **Result**: 0 errors.

### 3. Frontend Build
`npm --prefix frontend run build`
- **Result**: Built clean in 205ms. 128 modules transformed. Clean PWA service worker with 22 precache entries (655.13 KiB).

### 4. Backend Pytest
`backend/.venv/Scripts/python -m pytest backend`
- **Result**: 454 passed, 1 skipped in 41.17s.

### 5. Backend Ruff Linter
`backend/.venv/Scripts/python -m ruff check backend`
- **Result**: All checks passed!

### 6. Backend Ruff Formatter
`backend/.venv/Scripts/python -m ruff format --check backend`
- **Result**: 60 files already formatted.

---

## Needs from Planner / Kiro

None. All issues were completely resolved within the allowed files without requiring changes to Kiro-owned files or other lanes.
