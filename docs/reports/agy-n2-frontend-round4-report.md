# Lane n2-frontend-round4 Report: Frontend Audit Fixes

Status: DONE
Lane: n2-frontend-round4
Auditor & Implementer: Antigravity (agy, reviewed by Claude)
Date: 2026-11-09

## Executive Summary
This report documents the verification, implementation, and regression testing of frontend
findings M4-02, M4-03, M4-04, M4-09, and M4-10 from `docs/reports/audit-m4-round4.md`.

All confirmed issues have been resolved with minimal, surgical changes adhering to the
strict file boundaries, zero console/print logging, single-utterance speech rules, 100-column
line limits, and strict TypeScript types. Comprehensive unit and regression tests have been
implemented in `frontend/tests/n2.round4.test.ts` and test synchronizations completed.

---

## Findings Status Matrix

| ID | Sev | Status | Module & Line Reference | Summary |
|---|---|---|---|---|
| **M4-02** | HIGH | FIXED | `frontend/src/App.tsx:341-380` | Consume atomic `saveDiagramWithEviction` on diagram save. |
| **M4-03** | HIGH | FIXED | `frontend/src/App.tsx:430-445` | Persist Teacher Correct edits to IndexedDB via atomic path. |
| **M4-04** | HIGH | FIXED | `frontend/src/api/scene.ts:76-78,204-224`, `capture.ts:55-67`, `i18n/index.ts:77,389,700` | Exclude HTTP 504 from cold-start retries; accurate 504 error message. |
| **M4-09** | LOW | SKIPPED / NOT REPRODUCED | `frontend/vite.config.ts:45-64` | PDF worker precache is required for offline PWA operation (B4-03). |
| **M4-10** | LOW | FIXED | `frontend/src/verify/verify.ts:571-574` | Strip English `"angle "` prefix in verify finding target to prevent i18n leak. |

---

## Detailed Findings Analysis & Fixes

### 1. M4-02 (HIGH): Atomic Diagram Save with Eviction & Spoken Storage Error Resilience
- **Audit Finding:** In `frontend/src/App.tsx:367-372`, `saveDiagram` performed diagram deletion
  before `put(newEntry)` using two separate, non-atomic calls. Lane k6 created `saveDiagramWithEviction`
  in `flow/saved.ts`, but `App.tsx` was never updated to consume it. If `put` failed (e.g. quota
  exceeded or disk error), the oldest unpinned victim diagram was already deleted, causing data loss.
- **Verification:** CONFIRMED in current code. `App.tsx` directly called `drivers.diagramStore.delete`
  and `drivers.diagramStore.put` sequentially instead of calling `saveDiagramWithEviction`.
- **Fix:** In `frontend/src/App.tsx`:
  - Imported `saveDiagramWithEviction` from `./flow/saved`.
  - Replaced manual deletion and `put` with:
    `saveDiagramWithEviction(drivers.diagramStore, existing, entryToSave, SAVED_DIAGRAMS_CAP)`.
  - Maintained single spoken storage-error notice (`saved.errorStorageUnavailable` when listing
    fails; `saved.errorAllPinned` when store capacity is full with pinned items; `saved.errorSave`
    on storage failure or exception). Never speaks twice back-to-back.
- **Regression Tests:** In `frontend/tests/n2.round4.test.ts`:
  - Verified victim diagram is retained in memory/IndexedDB when `put` fails during eviction.
  - Verified atomic eviction of oldest unpinned entry when `put` succeeds at cap.
  - Verified single spoken utterance on store failure.

---

### 2. M4-03 (HIGH): Teacher Correct Mode Persistence to IndexedDB
- **Audit Finding:** In `frontend/src/screens/Correct.tsx` and `frontend/src/App.tsx:430-435`, saving
  in Teacher Correct mode announced `correct.saved` and loaded Explore, but never invoked
  `saveDiagram(scene)` to persist the corrected scene to IndexedDB, nor did it update
  `lastExploreScene.current`. Teacher edits were permanently lost upon page refresh or navigating
  to Saved diagrams.
- **Verification:** CONFIRMED in current code. `handleSaveCorrect` in `App.tsx` called
  `leaveCorrectEntry()`, spoke the Explore announcement, and navigated to `explore` without touching
  `drivers.diagramStore`.
- **Fix:** In `frontend/src/App.tsx`:
  - Extended `saveDiagram` to accept optional `previousScene?: DiagramScene | null`.
  - When `previousScene` is provided, `saveDiagram` searches `existing` saved entries for a matching
    entry (`e.scene === previousScene` or deep JSON equality).
  - If a matching entry exists: updates the existing entry in-place (preserving its original `id`,
    `createdAt`, and `pinned` status, updating `scene`, `title`, and `thumbnailDataUrl`).
    `saveDiagramWithEviction` replaces the entry in-place with `evictedId: undefined` (no diagrams
    evicted).
  - If no matching entry exists (e.g. diagram opened from share link or sample): creates a new entry
    and persists via atomic eviction path.
  - Updated `handleSaveCorrect` in `App.tsx` to update `lastExploreScene.current = scene` and invoke
    `void saveDiagram(scene, previousScene)`.
- **Regression Tests:** In `frontend/tests/n2.round4.test.ts`:
  - Verified updating existing saved entry in place preserves ID and pinned status without evicting.
  - Verified creating new entry when saving corrections for an unsaved/shared scene.

---

### 3. M4-04 (HIGH): Gateway 504 Timeout No-Retry & Cold-Start 502 Retry
- **Audit Finding:** In `frontend/src/api/scene.ts:76-78`, `isGatewayStatus` matched both HTTP 502
  and HTTP 504. When the backend AI vision pipeline timed out after 25 seconds returning HTTP 504,
  the frontend assumed cold-start sleep, announced `capture.wakingUp`, and re-submitted the upload,
  double-submitting expensive paid AI model calls.
- **Verification:** CONFIRMED in current code (`api/scene.ts:77` had `status === 502 || status === 504`).
- **Fix:**
  - In `frontend/src/api/scene.ts`: Restricted `isGatewayStatus` strictly to `status === 502`.
  - Added immediate 504 mapping: HTTP 504 throws `new SceneRequestError('timeout')` without retry.
  - HTTP 502 Bad Gateway continues to perform a single cold-start retry with localized
    `capture.wakingUp`.
  - In `frontend/src/i18n/index.ts`: Updated `capture.errorTimeout` across English, Hindi,
    and Gujarati to the accurate message required by the brief:
    - `en`: `"The server took too long; please try again."`
    - `hi`: `"सर्वर ने बहुत लंबा समय लिया; कृपया पुनः प्रयास करें।"`
    - `gu`: `"સર્વરે ઘણો સમય લીધો; કૃપા કરીને ફરી પ્રયાસ કરો."`
  - In `frontend/src/flow/capture.ts`: `captureErrorMessage` maps `SceneRequestError('timeout')` to
    `t('capture.errorTimeout')` which is spoken once.
  - Synchronized `frontend/tests/k6.pwa-offline.test.ts:465` to assert that HTTP 504
    does NOT retry and immediately rejects with `'timeout'`.
  - Updated `docs/user-test/translation-review.md` and `.csv`.
- **Regression Tests:** In `frontend/tests/n2.round4.test.ts`:
  - Verified HTTP 504 does not retry (calls fetch once, no `wakingUp` spoken, throws timeout).
  - Verified HTTP 502 still retries once with `capture.wakingUp`.
  - Verified `captureErrorMessage` produces accurate localized 504 timeout messages.

---

### 4. M4-09 (LOW): Precache Size Assessment & Offline PDF Rationale
- **Audit Finding:** Precache size increased to ~2.4 MB due to inclusion of PDF worker assets.
- **Verification:** Evaluated against specification and current code.
- **Resolution:** **SKIPPED / NOT REPRODUCED**.
  - In Wave B, finding B4-03 established that omitting PDF assets from the initial PWA cache broke
    offline PDF math worksheet reading for blind students on Android devices.
  - Lane k6 deliberately removed `'**/pdf*'` from `globIgnores` and included `mjs` in `globPatterns`
    specifically to fulfill Requirement 2.2 and offline PWA capability.
  - The total precache size (~2.4 MB) is well within `maximumFileSizeToCacheInBytes = 3 * 1024 * 1024`
    (3 MiB) and is protected by regression test `frontend/tests/k6.pwa-offline.test.ts:220`.
  - Per brief instructions ("M4-09, M4-10: do each only if reproduced"), M4-09 is skipped as an
    intentional architectural design choice rather than a bug.

---

### 5. M4-10 (LOW): Disputed Angle Phrasing & Localization Leak Prevention
- **Audit Finding:** In `frontend/src/verify/verify.ts:571-573`, angle discrepancy findings hardcoded
  the English word `"angle "` into the target string (`targetName = angle ${angleFact.vertex}`).
  When `navigation.ts:28` interpolated `{name}` into Hindi or Gujarati strings, the English noun
  "angle" leaked into the spoken caveat.
- **Verification:** CONFIRMED in current code. Disputed angle finding generated target `"angle C"`,
  causing Hindi TTS to speak `"तथ्य और चित्र angle C पर असहमत हैं।"`.
- **Fix:** In `frontend/src/verify/verify.ts:571`:
  - Stripped any leading `"angle "` prefix:
    `const targetName = angleFact.vertex.replace(/^angle\s+/i, '');`.
  - The finding target is now cleanly the vertex or angle identifier (e.g. `"C"`, `"ADC"`).
  - Localization templates in Hindi (`"तथ्य और चित्र {name} पर असहमत हैं।"`) and Gujarati
    (`"તથ્યો અને આકૃતિ {name} પર અસંમત છે."`) now speak cleanly without English word leakage.
- **Regression Tests:** In `frontend/tests/n2.round4.test.ts`:
  - Verified target name is stripped of `"angle "`.
  - Verified Hindi verify caveat contains no English word `"angle"`.
  - Verified Gujarati verify caveat contains no English word `"angle"`.

---

## Pass 2 Follow-Up (TypeScript Strictness Gating)
- **Status:** DONE
- **Fixes Applied to `frontend/tests/n2.round4.test.ts`:**
  1. Removed unused import `exploreAnnouncement` from `frontend/src/flow/navigation`.
  2. Discriminated union narrowing for `StoreResult<T>`: Added `if (!r.ok) throw new Error(...)`
     narrowing guards before accessing `r.value` across all `store.get(...)` and `store.list()`.
  3. Explicit parameter types: Added `(e: SavedDiagram) => ...` in `existing.find` callbacks to
     eliminate implicit `any` diagnostics.
- **Verification:** All 21 `tsc -p frontend --noEmit` diagnostics resolved with zero changes to
  production source code.

---

## Files Touched
1. `frontend/src/App.tsx`
2. `frontend/src/api/scene.ts`
3. `frontend/src/verify/verify.ts`
4. `frontend/src/i18n/index.ts`
5. `frontend/tests/k6.pwa-offline.test.ts`
6. `frontend/tests/n2.round4.test.ts` (new)
7. `docs/user-test/translation-review.md`
8. `docs/user-test/translation-review.csv`
9. `docs/reports/agy-n2-frontend-round4-report.md`
10. `docs/BUILD_LOG.md`
