# Report: Lane z3-app-merged-fixes (App.tsx findings from r6 audit)

**Status:** DONE  
**Lane:** z3-app-merged-fixes  
**Auditor / Builder:** agy, reviewed by Claude  
**Date:** 2026-11-10  
**Source:** `docs/reports/audit-r6-merged-share-saved.md`  

---

## 1. Summary of Completed Fixes

### Fix 1 (HIGH) — In-App Exit Double Speech and Duplicate Confirmation
- **Root Cause:** In `Teach.tsx`, clicking the in-app Back button invoked `executeTeachBack(isDirty, ...)`, which confirmed unsaved changes with the user and called `onBack()`. `onBack()` invoked `handleTeachBack` in `App.tsx`, which called `clearHash()`. Calling `clearHash()` dispatched a synthetic `hashchange` event. Because `lastProcessedHash.current` was still `'#/teach'` and `teachDirty.current` was still `true`, the `useEffect` hash listener in `App.tsx` awoke, detected `leaving === 'teach'`, evaluated `step.needsConfirm === true`, and invoked `window.confirm(t('teach.confirmLeave'))` and `drivers.speech.speak(t('teach.confirmLeave'))` a second time. If not dirty, it spoke the Explore entry announcement twice.
- **Fix Applied:**
  1. In `frontend/src/App.tsx:handleTeachBack`: cleared `teachDirty.current = false;` and updated `lastProcessedHash.current = '';` *before* calling `clearHash()`. When `clearHash()` fires `hashchange`, `readHash()` evaluates to `''`, matching `lastProcessedHash.current` (`'' === ''`), causing the hashchange effect to return immediately without re-processing the exit transition.
  2. In `frontend/src/screens/Teach.tsx:handleBack`: updated `onBack` callback to call `onDirtyChange?.(false)` before `onBack()`, ensuring the parent immediately knows the editor is exiting and dirty state is cleared.
- **Result:** Exactly ONE confirmation dialog (if dirty) and exactly ONE spoken announcement occurs upon in-app Exit. Browser Back (`#/teach` -> `#`) continues to be handled safely by `App.tsx`'s hash listener.

### Fix 2 (HIGH) — Cold Shared Links Bypassing ShareGate Tap Gate
- **Root Cause:** In `App.tsx`, both the initial `useState` hook (`view` state initialization on cold link) and the hash change listener assigned `lastExploreScene.current = resolution.scene;` upon resolving a shared route (`resolution.kind === 'explore'`), before the user tapped "Open the shared diagram". If the student navigated to `#/teach` (or another screen) before tapping the gate, `lastExploreScene.current` was already populated with the shared diagram. Pressing Back in Teach returned `{ next: 'explore' }` with `lastExploreScene.current`, navigating directly into Explore without the ShareGate tap, leaving Web Audio locked and speech muted.
- **Fix Applied:**
  1. Removed `lastExploreScene.current = resolution.scene;` from `view` state initialization in `App.tsx`.
  2. Removed `lastExploreScene.current = resolution.scene;` from the hash listener's share route resolution branch in `App.tsx`.
  3. Assigned `lastExploreScene.current = resolution.scene;` strictly inside `handleOpenSharedDiagram` in `App.tsx`, which executes when the user taps "Open the shared diagram" on `ShareGate`.
- **Result:** Shared link diagrams never enter Explore or `lastExploreScene` before the user explicitly unlocks audio and passes the gate.

### Fix 3 (HIGH) — Honest Route Default and Removal of "Verified" Claim Words
- **Root Cause:** Active Teacher mode strings still contained claim words such as "verified" / "सत्यापित" / "પ્રમાણિત" (`teach.validDiagram`, `teach.verifySection`, `teach.markVerified`, `teach.verifiedSuccess`, `teach.qrCodeAlt`, `teach.verifyError`, `teach.validationTitle`, `teach.invalidDiagram`).
- **Fix Applied:**
  1. Verified `resolveShareRoute` in `frontend/src/App.tsx` defaults `honest` to `true` (`options?.honest ?? true`), ensuring no live app path speaks `legacy.verified` or `legacy.verifiedBy`.
  2. In `frontend/src/i18n/index.ts`, rephrased all active `teach.` strings across English, Hindi, and Gujarati to honest phrasing without banned claim words ("verified", "correct", "checked", "approved", "सत्यापित", "પ્રમાણિત"):
     - `teach.validDiagram`: "Diagram is valid and ready to share." / "आरेख मान्य है और साझा करने के लिए तैयार है।" / "આકૃતિ માન્ય છે અને શેર કરવા માટે તૈયાર છે."
     - `teach.verifySection`: "Ready to share" / "साझा करें" / "શેર કરો"
     - `teach.markVerified`: "Ready to share" / "साझा करने के लिए तैयार" / "શેર કરવા માટે તૈયાર"
     - `teach.verifiedSuccess`: "Diagram prepared for sharing and share link ready." / "आरेख तैयार किया गया और साझा लिंक तैयार है।" / "આકૃતિ તૈયાર કરવામાં આવી અને શેર લિંક તૈયાર છે."
     - `teach.qrCodeAlt`: "QR code to open this shared diagram" / "इस साझा आरेख को खोलने के लिए क्यूआर कोड" / "આ શેર કરેલી આકૃતિ ખોલવા માટે ક્યુઆર કોડ"
     - `teach.verifyError`: "Sharing failed" / "साझा करना विफल रहा" / "શેર કરવાનું નિષ્ફળ રહ્યું"
     - `teach.validationTitle`: "Validation status" / "मान्यता स्थिति" / "માન્યતા સ્થિતિ"
     - `teach.invalidDiagram`: "Diagram validation issues: {errors}" / "आरेख मान्यता त्रुटियां: {errors}" / "આકૃતિ માન્યતા સમસ્યાઓ: {errors}"
  3. Appended all modified translations to `docs/user-test/translation-review.csv` and `docs/user-test/translation-review.md`.
  4. Verified placeholder token parity and identical key counts across all three languages.

---

## 2. Invariant Reasoning for Kiro P77/P78 and Share Tests

- **P77 (`share.honesty.prop.test.ts`):** Enforces that no key starting with `share.` contains `verified`, `सत्यापित`, or `પ્રમાણિત`. All `share.*` keys were untouched and remain claim-free. The `teach.*` keys updated here are outside the `share.` namespace and independently claim-free.
- **P78 (`share.honesty.prop.test.ts`):** Enforces that `share.sharedBy` and `share.sharedUnnamed` contain "not checked" ("जाँचा नहीं गया", "ચકાસાયેલ નથી") and `{name}` placeholder. Untouched and green.
- **`m3.sharedLinkGate.test.ts`:** Tests cold link gating, honest author announcements, and banner presentation. All assertions hold: ShareGate continues to gate Explore access, and audio is only unlocked upon tap.
- **`share.open.routing.test.tsx`:** Verified that legacy contract tests passing `{ honest: false }` continue to work, while default/omitted options return honest wording without claims.

---

## 3. DEFERRED (for Supervisor / Parallel Lanes)

1. **`needsConfirm` parameter for `leaveByBack` in `App.tsx`:**  
   Per Supervisor Note (1), lane z1 adds the `needsConfirm` / `dirty` parameter to `leaveByBack` in `flow/navigation.ts` in parallel. The corresponding call-site update in `App.tsx` was intentionally omitted from this lane to prevent merge conflicts.
2. **Core findings belonging to Kiro (Task 39):**  
   Audit findings touching `frontend/src/core/correct.ts` (reserved IDs: `title`, `scene:title`, `__proto__`, etc.) belong to Kiro per `AGENTS.md` ownership rule 1 and Supervisor Note (2).
3. **VerifiedBanner note emoji sanitization (MED finding):**  
   Sanitizing teacher note emojis in `frontend/src/components/VerifiedBanner.tsx` is left for its respective lane per the minimal App.tsx scope requirement.

---

## 4. Verification & Proof of Work

- **Test Suite Created:** `frontend/tests/z3.appMergedFixes.test.tsx`
  - *Fix 1 test:* Asserts `executeTeachBack(true)` prompts confirmation once and calls `onBack()` once; asserts `isTeachDirty` tracking.
  - *Fix 2 test:* Mounts `App` with cold shared link; verifies `ShareGate` is displayed and `gt-explore` is null before tap; verifies tapping open button transitions to Explore with honest banner.
  - *Fix 3 test:* Verifies `resolveShareRoute` defaults `honest` to `true` when options are omitted or empty; verifies all rephrased `teach.*` keys across en, hi, gu contain zero banned claim words; verifies key count and token parity across all 3 languages.
- **Line Length & Formatting:** All modified files kept strictly within 100 columns and ruff-format style.
- **Files Touched:**
  - `frontend/src/App.tsx`
  - `frontend/src/screens/Teach.tsx`
  - `frontend/src/i18n/index.ts`
  - `docs/user-test/translation-review.csv`
  - `docs/user-test/translation-review.md`
  - `frontend/tests/z3.appMergedFixes.test.tsx`
  - `docs/BUILD_LOG.md`
  - `docs/reports/agy-z3-app-merged-fixes-report.md`

---

## 5. Pass 2 Follow-Up Note

- **Pass 2:** Removed unused imports in z3 test and fixed ShareGate query/act timing. Status: DONE.
