# Report: Lane o1-leavebyback (turn Kiro's amended P43 green)

**Status:** DONE  
**Lane:** o1-leavebyback  
**Auditor / Builder:** agy, reviewed by Claude  
**Date:** 2026-11-11  
**Spec Reference:** `.kiro/specs/ghost-touch/design.md` "Round-6 decisions", section
"Back from Correct (24.1)" and `docs/reviews/kiro-round6.md` item 1  

---

## 1. Summary of Work Completed

### 1.1 Policy Table Updates (`frontend/src/flow/navigation.ts`)
- Added optional `correctDirty?: boolean` (defaults to false) to `BackContext`.
- Updated `leaveByBack`:
  ```ts
  const needsConfirm =
    (screen === 'teach' && ctx.dirty) ||
    (screen === 'correct' && ctx.correctDirty === true);
  ```
  - For `teach`: `needsConfirm` is `ctx.dirty`.
  - For `correct`: `needsConfirm` is `ctx.correctDirty === true`. `next` stays `'explore'`,
    and `announceKey` stays `'explore.gestureHint'`.
  - For all other screens: `needsConfirm` is `false`.
- Updated `handleAppHashBack`:
  - When `leaving === 'correct'`, uses `correct.confirmLeave` and `correct.stayingInEditor`
    localization keys rather than Teacher-specific strings.

### 1.2 Correct Screen & App State Integration (`frontend/src/screens/Correct.tsx` & `frontend/src/App.tsx`)
- In `frontend/src/screens/Correct.tsx`:
  - Reused lane z3 pattern for exit confirmation: in `handleCancel`, updated `onLeave`
    to invoke `onDirtyChange?.(false)` before `onCancel()`.
  - Guarantees that once confirmed via the in-app Cancel button, the editor reports clean
    status before the transition occurs, strictly eliminating duplicate confirmations or utterances.
- In `frontend/src/App.tsx`:
  - Passed `correctDirty: correctDirty.current` to `leaveByBack` at the hardware/hash
    `leaveByBack(leaving, ...)` call site.
  - In `onCorrectBack`, replaced the raw `if (correctDirty.current)` check with
    `leaveByBack('correct', ctx)`, ensuring navigation policy is driven strictly by the
    central policy table.
  - Set `correctDirty.current = false` upon confirmed navigation in `onCorrectBack`,
    `handleCancelCorrect`, and `handleSaveCorrect`.

### 1.3 New Test Suite (`frontend/tests/correct.back.test.tsx`)
Added comprehensive test coverage:
- **Policy Table (`leaveByBack`):**
  - Confirmed `leaveByBack('correct', { dirty: false, correctDirty: true, fromShare: false })`
    returns `{ next: 'explore', announceKey: 'explore.gestureHint', needsConfirm: true }`.
  - Confirmed `leaveByBack('correct', { dirty: false, correctDirty: false, fromShare: false })`
    returns `{ next: 'explore', announceKey: 'explore.gestureHint', needsConfirm: false }`.
  - Confirmed omitted `correctDirty` defaults to false.
  - Confirmed editor isolation: Teacher edits (`dirty: true`) never block leaving Correct,
    and Correct edits (`correctDirty: true`) never block leaving Teach.
- **Pure Leave Helper (`executeCorrectLeave`):**
  - Verified `isDirty=true` prompts `confirm(t('correct.confirmLeave'))` and speaks
    `t('correct.confirmLeave')` once; on cancel, stays in editor and speaks
    `t('correct.stayingInEditor')`.
  - Verified `isDirty=false` leaves immediately without prompt or speech.
- **Component In-App Cancel Button (`Correct.tsx`):**
  - Verified clicking Cancel when dirty prompts confirmation once; if confirmed, notifies
    `onDirtyChange(false)` before `onCancel()`; if rejected, stays in editor and focuses title.
  - Verified clicking Cancel when clean calls `onCancel()` immediately without confirmation.
- **App Integration (`App.tsx`):**
  - Verified hardware/gesture Back (`popstate`) on Correct screen with unsaved edits prompts
    `confirm(t('correct.confirmLeave'))` once; if cancelled, stays in Correct mode; if
    confirmed, navigates to Explore.
  - Verified hardware/gesture Back on Correct screen without unsaved edits navigates to Explore
    directly without confirmation dialog.

---

## 2. Status of Red Tests from Task 40

- `frontend/tests/round2.navigation.prop.test.ts`:
  - Amended property: "asks before discarding unsaved Teach or Correct edits, and only then
    (200+ runs)" -> **TURNS GREEN**.
  - Property: "keeps the two editors apart: Teacher edits never block leaving Correct, and
    the reverse" -> **TURNS GREEN**.
  - All 7 tests in `round2.navigation.prop.test.ts` pass cleanly without touching the oracle
    test file.

---

## 3. Deferred Items

**DEFERRED list:** None. All requirements in the brief are fully implemented.

---

## 4. Files Touched

- `frontend/src/flow/navigation.ts`
- `frontend/src/screens/Correct.tsx`
- `frontend/src/App.tsx`
- `frontend/tests/correct.back.test.tsx` (new test file)
- `docs/reports/agy-o1-leavebyback-report.md`
- `docs/BUILD_LOG.md`

---

## 5. Pass 2 Follow-Up Note

- **Pass 2:** Loaded App module once via cached dynamic import in `beforeAll` (60s timeout)
  for App integration tests only, keeping pure policy table tests free of App imports and
  preventing parallel suite hook timeouts. Status: DONE.

