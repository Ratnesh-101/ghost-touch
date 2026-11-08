# Lane h6-nav-fixes Report: Navigation and Hardware Back Fixes

**Lane**: h6-nav-fixes (FIX, frontend)  
**Builder**: agy, reviewed by Claude  
**Date**: 2026-11-08  
**Status**: DONE  
**Brief**: `docs/briefs/agy-h6-nav-fixes.md`  
**Rules & Contracts**: `AGENTS.md`, `docs/briefs/fix-common.md`, `docs/reports/audit-r3-navigation.md`

---

## 1. Summary of Work Completed

This lane addresses findings R3-01 through R3-07 from the Round-3 navigation audit (`docs/reports/audit-r3-navigation.md`). All changes respect core ownership boundaries (no changes in `core/`, drivers, backend, or `.kiro/`), avoid back-to-back speech driver cancellations, and ensure total, announced navigation.

### 1.1 R3-01 & R3-07: Spoken confirmation and cancellation handling
- **Problem**: In `App.tsx` (hashchange handler) and `Teach.tsx` (`handleBack`), bare `window.confirm(t('teach.confirmLeave'))` was invoked without speaking the question. If Android Chrome suppressed dialogs (or the user cancelled), `confirm` returned `false` silently, causing hardware or gesture Back to appear completely dead with no spoken feedback or focus management.
- **Fix**:
  - Before triggering `window.confirm`, the question `t('teach.confirmLeave')` is spoken.
  - If `confirm` returns `false` (dialog cancelled or suppressed by browser):
    - Speaks new key `teach.stayingInEditor` ("Still in the editor." / "अभी भी संपादक में हैं।" / "હજુ પણ સંપાદકમાં છો.").
    - In `App.tsx`, restores URL hash to `#/teach`.
    - Restores focus to the editor heading (`h1.gt-teach__title`).
    - Avoids back-to-back speech synthesis calls (speech is sequenced: question first, outcome after confirm returns).

### 1.2 R3-02: Clean baseline tracking for dirty state
- **Problem**: `Teach.tsx` previously computed `isDirty = canUndo(history) || teacherName.trim().length > 0 || teacherNote.trim().length > 0` with no baseline snapshot. Once a diagram was edited or metadata was entered, it remained dirty forever—even after successful verification and sharing (`handleVerify`), causing Back and Exit to repeatedly prompt "unsaved changes".
- **Fix**:
  - Established a `cleanBaseline` ref holding `{ scene, name, note }` initialized on mount, updated on loading a diagram (`handleLoadScene`), and updated on successful verify/share (`handleVerify`).
  - Added pure helper `isTeachDirty(scene, name, note, baseline)`.
  - On successful verify/share, `cleanBaseline.current` captures the current scene, name, and note; `isDirty` transitions to `false`, firing `onDirtyChange(false)` so subsequent Back/Exit actions exit cleanly without confirmation.
  - Undoing edits back to the baseline scene restores `isDirty = false`.

### 1.3 R3-03: Hardware Back from Teach returns to Explore
- **Problem**: In `flow/navigation.ts`, hardware Back from `teach` always returned to `start` (`next: 'start'`). In contrast, in-app Exit (`handleTeachBack`) returned to `explore` with the current diagram if one was active. Hardware Back dropped students out to Start and lost the diagram view.
- **Fix**:
  - Added `hasScene?: boolean` to `BackContext` in `flow/navigation.ts`.
  - Updated `leaveByBack`: when `screen === 'teach'`, if `ctx.hasScene` is true, routes to `{ next: 'explore', announceKey: 'explore.gestureHint', needsConfirm: ctx.dirty }`; otherwise routes to `{ next: 'start', announceKey: 'start.intro', needsConfirm: ctx.dirty }`.
  - In `App.tsx`, hash Back checks `lastExploreScene.current`. When returning to Explore, speaks `exploreAnnouncement(scene, 'ai')` and sets view to `{ screen: 'explore', scene, announced }`, exactly matching `handleTeachBack`.

### 1.4 R3-04: Navigation policy table documentation & table testing
- **Problem**: Audit noted parts of `leaveByBack` seemed dead or lacked clear documentation of its role as the central navigation policy table.
- **Fix**:
  - Added header comment above `leaveByBack` documenting it as the application's central navigation policy table for hardware and gesture Back.
  - Added comprehensive table test in `frontend/tests/h6.nav.test.ts` over every `ScreenName` in `SCREEN_NAMES` across all combinations of `dirty`, `fromShare`, and `hasScene`, verifying that each combination produces a valid destination and non-empty `announceKey` translated in English, Hindi, and Gujarati.

### 1.5 R3-05: Capture/Start exit PWA on hardware Back
- **Decision**: SKIPPED per brief instruction ("SKIP unless it is clearly safe; if you do it, push one history sentinel when entering Capture and speak a message on Back; otherwise list it under 'Needs from planner'"). Modifying top-level browser history on Start/Capture without dedicated multi-screen router architecture risks trapping users. Documented under "Needs from planner".

### 1.6 R3-06: Cold-loaded `#s=` link exits on Back
- **Status**: NOT REPRODUCED / EXPECTED BEHAVIOR per audit report ("user is not stuck (`clearHash` uses replaceState). Expected.").

---

## 2. Finding Verification Matrix

| ID | Finding Summary | Status | Action & Proof |
|---|---|---|---|
| R3-01 | Bare `window.confirm` in App.tsx / Teach.tsx without speech announcement & no cancellation feedback | FIXED | Speak question before confirm; on cancel/suppression speak `teach.stayingInEditor` and restore focus to `.gt-teach__title`. Tested in `h6.nav.test.ts`. |
| R3-02 | Dirty flag never cleared after successful share/save in Teach.tsx | FIXED | `cleanBaseline` ref updated on share/load; `onDirtyChange(false)` called. Tested in `h6.nav.test.ts`. |
| R3-03 | Hardware Back from Teach goes to Start instead of Explore when scene exists | FIXED | Added `hasScene` to `BackContext`; routes to Explore with `exploreAnnouncement`. Tested in `h6.nav.test.ts`. |
| R3-04 | Dead code / missing policy comment & coverage in `leaveByBack` | FIXED | Policy comment added; table test over all `ScreenName` values and languages `en`, `hi`, `gu`. Tested in `h6.nav.test.ts`. |
| R3-05 | Capture/Start exits PWA on hardware Back | SKIPPED | Deferred to planner per brief instruction; documented in Section 4. |
| R3-06 | Cold-loaded `#s=` link exits on Back | NOT REPRODUCED / EXPECTED | Expected PWA entry behavior. |
| R3-07 | Android Chrome repeated cancelled-dialog quirk | FIXED | Handled by R3-01 fix: suppressed dialog returns `false` immediately, handled as "stay" with spoken feedback and focus restore. |

---

## 3. Verification Proof

All DoD commands executed from repo root and verified:

| Command | Result | Details |
|---|---|---|
| `npm --prefix frontend exec -- tsc -p frontend --noEmit` | **PASS** | 0 TypeScript errors |
| `npm --prefix frontend test` | **PASS** | 119 test files passed (1600 tests passed, +15 tests in `h6.nav.test.ts`) |
| `npm --prefix frontend run build` | **PASS** | 129 modules transformed, clean PWA build (662.23 KiB precache) |

---

## 4. Needs from Planner / Kiro

- **R3-05 (Capture/Start hardware Back history trap)**:
  Handling hardware Back from Capture (to return to Start instead of exiting the PWA) requires pushing history entries on Start/Capture. This should be planned alongside the full PWA lifecycle and routing strategy so users cannot become trapped.

---

## 5. Files Touched

- `frontend/src/App.tsx`
- `frontend/src/screens/Teach.tsx`
- `frontend/src/flow/navigation.ts`
- `frontend/src/i18n/index.ts`
- `frontend/tests/h6.nav.test.ts`
- `docs/user-test/translation-review.md`
- `docs/user-test/translation-review.csv`
- `docs/BUILD_LOG.md`
- `docs/reports/agy-h6-nav-fixes-report.md`
