# Antigravity Lane Report: k6-pwa-offline

**Lane:** `k6-pwa-offline`  
**Tool:** Antigravity (agy, reviewed by Claude)  
**Date:** 2026-11-09  
**Status:** DONE  

---

## 1. Summary of Verification & Scope

This lane addresses findings B4-01 through B4-08 from `docs/reports/audit-b4-pwa-offline.md`, ensuring full offline operation, PWA caching integrity, atomic persistence without data loss, and Render cold-start resilience.

| Finding | Severity | Status | Summary of Action / Verification |
|---|---|---|---|
| **B4-01** | HIGH | **VERIFIED / ALREADY FIXED** | Verified against current code in `frontend/src/screens/SavedDiagrams.tsx` and `frontend/src/flow/saved.ts`. Lane h7 already replaced the separate `say(msg)` and `say(empty)` calls with `deletedAnnouncement(entry.title, remaining.length)` joining deletion and empty state into one single utterance, and restores focus to `headingRef`. Added regression test in `tests/k6.pwa-offline.test.ts`. |
| **B4-02** | HIGH | **FIXED** | Teacher Correct mode no longer hard-blocks saving corrections when offline. In `frontend/src/screens/Correct.tsx`, implemented `executeCorrectSave`: checks `isOnline` and attempts backend `/validate`, falling back on network error, offline state, or timeout to local structural validation via `validateSceneInvariants` (read-only import from `core/correct`). Valid corrections save locally with localized `t('correct.savedOffline')` ("Saved without server check.") and trigger `onSave`. Invalid corrections show formatted errors without hardcoded English strings. |
| **B4-03** | HIGH | **FIXED** | In `frontend/vite.config.ts`, removed `'**/pdf*'` from `workbox.globIgnores`, added `'mjs'` to `workbox.globPatterns` so the PDF worker bundle is matched, and set `workbox.maximumFileSizeToCacheInBytes = 3 * 1024 * 1024` (3 MiB). The dynamic PDF chunk (`pdf-*.js`, ~484 KiB) and worker (`pdf.worker.min-*.mjs`, ~1.26 MiB) are now precached on initial install, enabling full offline PDF rendering. |
| **B4-04** | HIGH | **FIXED** | Enforced atomic diagram save and eviction. In `frontend/src/drivers/diagramStore.ts`, added `putWithEviction(entry, evictedId)` to `DiagramStore`, `MemoryDiagramStore`, and `IDBDiagramStore` (single readwrite transaction). In `frontend/src/flow/saved.ts`, implemented `saveDiagramWithEviction`: puts new entry first before deleting evicted victim, guaranteeing that if `put` fails (e.g. quota exceeded or disk write error), the oldest unpinned diagram is NOT deleted, preventing data loss. Also added transaction commit waiting (`waitTx`) to `IDBDiagramStore.put` and `delete`. |
| **B4-05** | MEDIUM | **SKIPPED** | `frontend/src/main.tsx` is outside allowed files for this lane. Furthermore, B4-03 eliminates the primary chunk failure vector by precaching PDF chunks and workers into cache storage upon initial load. |
| **B4-06 & B4-07** | MEDIUM | **FIXED** | Lengthened `SCENE_TIMEOUT_MS` from 45s to 65s (`65_000` ms) in `frontend/src/api/scene.ts` to comfortably cover Render free-tier cold starts (30-60s). Added retry on HTTP 502 Bad Gateway and 504 Gateway Timeout: invokes `onRetry` callback with localized `t('capture.wakingUp')` ("Waking up the server…"), waits retry interval (default 3s), and retries once. If 502/504 persists, throws `SceneRequestError('gateway')`. In `frontend/src/flow/capture.ts`, `captureErrorMessage` maps `'gateway'` to localized `t('capture.errorGateway')` ("The server is waking up. Please try again in a few seconds.") and `'timeout'` to `t('capture.errorTimeout')`. |
| **B4-08** | MEDIUM | **SKIPPED / NOT REPRODUCED** | Existing test suite explicitly enforces that `SceneRequestError('network')` maps to `t('capture.error')` in `frontend/tests/flow.capture.test.ts:221`. Weakening or altering this assertion is strictly forbidden by brief guidelines. Specific cold-start and timeout errors are instead mapped to dedicated informative keys. |

---

## 2. Precache Size Assessment (B4-03)

- **Previous Precache Manifest:**
  - 22 precached entries totaling 659.37 KiB (fonts, base HTML/CSS/JS, bundled sample diagrams).
  - PDF dynamic chunk (`pdf-*.js`, ~484 KiB) and worker (`pdf.worker.min-*.mjs`, ~1.26 MiB) were excluded via `globIgnores: ['**/pdf*']`.
- **New Precache Manifest:**
  - With `globIgnores` no longer filtering out PDF assets and `mjs` included in `globPatterns`:
  - Estimated new precache entries: ~24 entries.
  - Estimated total precache size: ~2.40 MiB (659.37 KiB baseline + ~484 KiB pdfjs chunk + ~1.26 MiB pdfjs worker).
  - Fits comfortably within the configured `maximumFileSizeToCacheInBytes` (3.00 MiB / 3,145,728 bytes).
  - Ensures a fresh PWA installation can immediately open and render first-page PDF math worksheets completely offline.

---

## 3. New i18n Keys Added (en, hi, gu)

Added 4 new keys across English, Hindi, and Gujarati with strict key parity, non-empty values, and zero hardcoded English fallback strings:

| Key | English (`en`) | Hindi (`hi`) | Gujarati (`gu`) | Notes |
|---|---|---|---|---|
| `correct.savedOffline` | Saved without server check. | सर्वर जांच के बिना सहेजा गया। | સર્વર તપાસ વિના સાચવવામાં આવ્યું. | Spoken notice when saving offline |
| `capture.wakingUp` | Waking up the server… | सर्वर चालू किया जा रहा है… | સર્વર શરૂ થઈ રહ્યું છે… | Spoken notice during 502/504 cold start retry |
| `capture.errorGateway` | The server is waking up. Please try again in a few seconds. | सर्वर चालू हो रहा है। कृपया कुछ सेकंड में पुनः प्रयास करें। | સર્વર શરૂ થઈ રહ્યું છે. કૃપા કરીને થોડી સેકંડમાં ફરી પ્રયાસ કરો. | Spoken error when 502/504 persists |
| `capture.errorTimeout` | The server took too long to respond. It may still be waking up, please try again. | सर्वर ने प्रतिक्रिया देने में बहुत अधिक समय लिया। यह अभी भी चालू हो रहा हो सकता है, कृपया पुनः प्रयास करें। | સર્વરે પ્રતિસાદ આપવામાં ઘણો સમય લીધો. તે હજી પણ શરૂ થઈ રહ્યું હોઈ શકે છે, કૃપા કરીને ફરી પ્રયાસ કરો. | Spoken error on scene request timeout |

All keys have been appended to:
- `docs/user-test/translation-review.md` (Section 23)
- `docs/user-test/translation-review.csv`

---

## 4. Verification and Regression Tests

Created new test file `frontend/tests/k6.pwa-offline.test.ts` (17 tests) covering all lane scope:
- **B4-01:** `deletedAnnouncement` speaks joined utterance on last deletion without cutting off speech.
- **B4-02:** `executeCorrectSave` allows offline saving when scene invariants pass (`saved-offline`), refuses invalid scenes with formatted errors, falls back to local invariants when backend `/validate` fails with network error, and handles normal server validate success/rejection.
- **B4-03:** `vite.config.ts` configuration assertions ensuring PDF assets are not ignored in precache, `mjs` is included, and `maximumFileSizeToCacheInBytes` >= 3 MiB.
- **B4-04:** `saveDiagramWithEviction` preserves victim diagram in store when saving fails (e.g. quota exceeded simulated via `failWith`), evicts oldest unpinned diagram when saving succeeds at cap, refuses eviction when all entries are pinned, and verifies `IDBDiagramStore.putWithEviction`.
- **B4-06 / B4-07:** `SCENE_TIMEOUT_MS` >= 60_000 ms; `requestScene` retries on HTTP 502 and 504 with `capture.wakingUp` announcement, throws `SceneRequestError('gateway')` when 502 persists; `captureErrorMessage` maps `'gateway'` and `'timeout'` to dedicated helpful messages while preserving existing error mappings.

---

## 5. Files Touched

1. `frontend/src/i18n/index.ts`
2. `frontend/src/screens/Correct.tsx`
3. `frontend/vite.config.ts`
4. `frontend/src/drivers/diagramStore.ts`
5. `frontend/src/flow/saved.ts`
6. `frontend/src/api/scene.ts`
7. `frontend/src/flow/capture.ts`
8. `frontend/tests/k6.pwa-offline.test.ts`
9. `frontend/tests/api.scene.test.ts`
10. `docs/user-test/translation-review.md`
11. `docs/user-test/translation-review.csv`
12. `docs/reports/agy-k6-pwa-offline-report.md`
13. `docs/BUILD_LOG.md`

---

## 6. Follow-Up 3: Test Synchronizations and Matching Logic Fix

1. **Strict Typecheck Compliance (`tsc`):**
   - In `frontend/tests/k6.pwa-offline.test.ts`, removed unused imports `type SceneResponse` and `orderForDisplay`, satisfying `tsc --noUnusedLocals`.

2. **Timeout Test Synchronization:**
   - In `frontend/tests/api.scene.test.ts`, updated test title `'defines SCENE_TIMEOUT_MS as 65 seconds for cold backend start'` and assertion `expect(SCENE_TIMEOUT_MS).toBe(65_000);` to match the deliberate B4-06 Render cold-start lengthening from 45s to 65s (aligning with `frontend/tests/api.health.test.ts`).

3. **Joined Announcement Single Period:**
   - In `frontend/tests/k6.pwa-offline.test.ts`, updated the `deletedAnnouncement` expectation for the final deletion to expect `"Deleted Right triangle. No saved diagrams yet."` (single space separator, single period) rather than double periods.

4. **PDF Asset Precache Ignore Test Matching Logic:**
   - `frontend/vite.config.ts` contains `globIgnores: ['**/*.pdf', ...]` which excludes user/sample `.pdf` documents from the precache. `frontend/tests/pwa.config.test.ts` requires this pattern (`ignoresPdf = globIgnores.some((pattern) => pattern.includes('pdf')) === true`).
   - The compiled PDF worker (`assets/pdf.worker.min-*.mjs`) and dynamic chunk (`assets/pdf-*.js`) do NOT end in `.pdf` and are therefore not ignored by `'**/*.pdf'`.
   - The test in `frontend/tests/k6.pwa-offline.test.ts` previously checked `pattern.includes('pdf') === false`, which caused a false failure against `'**/*.pdf'`.
   - The test matching logic was fixed to test actual asset paths (`pdf.worker.min-*.mjs`, `assets/pdf-*.js`) against the glob patterns, confirming that no ignore pattern matches them and verifying that the old broad pattern `'**/pdf*'` is not present. This keeps both `tests/pwa.config.test.ts` and `tests/k6.pwa-offline.test.ts` green.
