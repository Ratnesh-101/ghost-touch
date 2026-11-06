# Lane t3-student-open Report — Antigravity (agy)

**Date:** 2026-11-06  
**Tool:** Antigravity (agy), headless builder (reviewed by Claude Code)  
**Lane:** `t3-student-open`  
**Briefs:** `docs/briefs/agy-t3-student-open.md`, `docs/briefs/guide-share-contract.md`  

---

## 1. Executive Summary

Implemented the "Student Open" feature for Ghost Touch (`t3-student-open`). Students opening a shared URL fragment `/#s=<payload>` now seamlessly land in the Explore screen with an accessible, high-contrast "Verified by <name>" banner (`role="status"`). The diagram scene and verified state are announced sequentially aloud via the Web Speech driver (`exploreAnnouncement` first, followed by `"Verified by <name>"`).

All hostile inputs, corrupted URLs, unsupported versions, empty payloads, and oversized payloads are caught cleanly, routing to a new, user-friendly `ShareError` screen with a minimum 48×48 px "Go to start" button without ever exposing technical stack traces or raw payload data. The feature operates 100% offline with zero network requests (`fetch` is never called), sanitizes and escapes all teacher names, notes, and labels as literal React text nodes (neutralizing XSS vectors like `<img onerror>`), re-routes dynamically when the URL hash changes, and clears the hash via `history.replaceState` when returning from Explore or the error screen.

---

## 2. Deliverables Built

### A. Drivers (`frontend/src/drivers/hashRoute.ts`)
- Defined `SHARE_HASH_PREFIX = '#s='`.
- Added `parseShareHash(hash: string): string | null`: Extracts the payload portion of `#s=<payload>`, `/#s=<payload>`, or complete origin URLs ending with `#s=`. Safely returns `''` for `#s=` and `null` for non-share routes like `#/debug` or empty strings. Preserves whitespace in payloads.
- Added `clearHash(): void`: Clears the URL hash via `history.replaceState(null, '', path || '/')`, updates `window.location.hash = ''`, and dispatches a `hashchange` event to notify subscribers.

### B. Verification Banner (`frontend/src/components/VerifiedBanner.tsx`)
- New accessible component rendered with `role="status"` and `aria-label="Verified by <name>"`.
- Displays verification checkmark badge, localized `"Verified by <name>"`, and an optional `"Read note"` button.
- Note is collapsed/hidden by default; clicking `"Read note"` toggles visibility and speaks the teacher note aloud via `onSpeak`.
- Touch target strictly complies with the 48×48 px touch target requirement via `.gt-control`.
- Renders names, notes, and labels strictly as React text children, preventing script or HTML execution from malicious teacher names or notes.

### C. Error Screen (`frontend/src/screens/ShareError.tsx`)
- New friendly error screen with `role="alert"`.
- Maps all five `ShareErrorCode`s (`too-large`, `bad-format`, `bad-version`, `bad-scene`, `empty`) to friendly localized text:
  - `too-large`: *"This shared link is too large to open."*
  - `bad-format`: *"This shared link is corrupted or incomplete."*
  - `bad-version`: *"This shared link was created by an incompatible version."*
  - `bad-scene`: *"This shared diagram could not be read."*
  - `empty`: *"This shared link has no diagram."*
- Contains a "Go to start" button that resets navigation and calls `clearHash()`.
- Guarantees no raw payload or stack trace ever leaks to the UI.

### D. Route Handling & App Integration (`frontend/src/App.tsx`)
- Exported pure helpers `resolveShareRoute(hash, isFeatureOn)`, `joinShareAnnouncements(sceneAnnouncement, verifiedAnnouncement)`, and `speakShareAnnouncements(speech, resolution, langBcp47)`.
- Gated share link handling behind `isShareEnvOn()` (`VITE_FEATURE_SHARE === '1'`). When the flag is OFF, `#s=` hashes are ignored and the app stays on the standard Start screen.
- Synchronous initial state resolution in `useState<View>` prevents flashes of the Start screen when loading a valid shared link directly.
- Spoken announcements: joins diagram scene announcement (`exploreAnnouncement`) and teacher verified line (`share.verifiedBy`) into ONE combined spoken utterance via `joinShareAnnouncements` before calling `speech.speak(utterance, langBcp47)`. This prevents the speech driver (`synth.cancel()`) from cancelling the scene announcement when back-to-back `speak` calls are issued, while keeping both strings available separately for the on-screen status card and `<VerifiedBanner>`.
- `joinShareAnnouncements` joins with `". "` and avoids double full stops if the scene announcement already ends with terminal punctuation (`.`, Hindi `।`, `!`, or `?`).
- Route effect handles dynamic hash changes while the app is running:
  - Navigating to a new share hash decodes the diagram and re-routes to Explore.
  - Navigating to an invalid share hash routes to `ShareError`.
  - Clearing the hash resets the view to Start.
- Back navigation from Explore (when opened via share link) clears the hash via `clearHash()` (`history.replaceState`) and navigates to the Start screen, speaking `start.intro`.
- Guarded `warmBackend()` so that when opening a share route, no background health check fires, guaranteeing zero network requests (`fetch` is never called).

### E. Explore Screen (`frontend/src/screens/Explore.tsx`)
- Added optional `verified?: { by: string; note?: string; at?: string }` prop to `ExploreProps`.
- Rendered `<VerifiedBanner>` below the Explore title header when `verified` is present.

### F. Styling (`frontend/src/styles/explore.css`)
- Styled `.gt-verified-banner`, `.gt-verified-banner__note-btn`, `.gt-verified-banner__note-body`, `.gt-share-error`, and `.gt-share-error__start-btn`.
- Strictly conforms to Design Token Color Property P20: all colors consume `var(--gt-*)` custom properties with fallbacks.
- Verified 48×48 px minimum touch target tokens and focus visibility rings for keyboard and screen reader accessibility.

### G. Internationalization (`frontend/src/i18n/index.ts`, `translation-review.md`, `translation-review.csv`)
- Added 13 new keys across `en`, `hi`, and `gu` tables with 100% key parity:
  - `share.verified`, `share.verifiedBy`, `share.readNote`, `share.hideNote`, `share.goToStart`, `share.honesty`, `share.error.title`, `share.error.tooLarge`, `share.error.badFormat`, `share.error.badVersion`, `share.error.badScene`, `share.error.empty`, `share.error.generic`.
- Appended Section 18 ("Teacher Share & Student Open") with all 13 keys to `docs/user-test/translation-review.md` and `docs/user-test/translation-review.csv`.

### H. Test Suites (`frontend/tests/`)
- `share.open.hashRoute.test.ts`: 10 tests covering constants, `#s=` and `/#s=` parsing, empty payloads, non-share route rejection, property-based round-trip string preservation, and `clearHash` replaceState/event dispatch.
- `share.open.banner.test.tsx`: 6 tests covering `role="status"` attribute, teacher name rendering, note collapse/expansion, 48×48 px touch targets, XSS `<img onerror>` literal text rendering, and Hindi/Gujarati localization.
- `share.open.errors.test.tsx`: 4 tests covering all 5 `ShareErrorCode` friendly messages, `role="alert"`, lack of stack traces, 48×48 px "Go to start" button, and Hindi/Gujarati localization.
- `share.open.routing.test.tsx`: 13 tests (+2 follow-up t3-fix tests) covering end-to-end routing, single-call spoken utterance join order (scene announcement first, verified banner announcement second without speech driver cancellation), fake speech driver mimicking real cancellation across `en`, `hi`, and `gu`, double full stop avoidance with terminal punctuation, flag OFF gating, zero fetch network calls, dynamic hash changes, and XSS safety.

### I. Follow-up Fix `t3-fix` (`docs/briefs/agy-t3-fix.md`)
- **Defect Addressed:** Back-to-back calls to `speech.speak(resolution.sceneAnnouncement)` and `speech.speak(resolution.verifiedAnnouncement)` caused the Web Speech driver (`drivers/speech.ts` calling `synth.cancel()`) to immediately cancel and overwrite the scene announcement, leaving the student hearing only the verified line.
- **Fix Implemented:**
  - Added pure helper `joinShareAnnouncements(sceneAnnouncement, verifiedAnnouncement)`:
    - Combines both announcements into a single utterance in strict contract order (`sceneAnnouncement` then `verifiedAnnouncement`).
    - Joins with `". "` when the scene announcement lacks terminal punctuation.
    - Avoids double full stops (`..` or `।.`) by detecting terminal punctuation (`.`, Devanagari danda `।`, `!`, `?`) and normalizing multiple trailing periods before appending the verified line with a single space.
    - Preserves empty string fallbacks.
  - Updated `speakShareAnnouncements` to speak the single joined utterance.
  - Kept `resolution.sceneAnnouncement` and `resolution.verifiedAnnouncement` available separately so the on-screen status card and `<VerifiedBanner>` render their independent text without change.
  - Added fake speech driver test mimicking real driver behavior (`each speak replaces previous`) asserting exactly 1 `speak` call with both announcements in order across English, Hindi, and Gujarati.
  - Updated existing tests that previously asserted 2 `speak` calls to assert the single joined utterance.

---

## 3. Verification & Proof of DoD

All commands allowed by the runner executed cleanly:

### 1. `npm --prefix frontend test`
```text
Test Files  95 passed (95)
     Tests  1319 passed (1319)
  Duration  1.46s
```
*Result:* All 95 test files passed, including the 4 new test suites (33 new tests, total 1319 passed).

### 2. `npm --prefix frontend exec -- tsc -p frontend --noEmit`
```text
Exit code 0 (clean, 0 type errors)
```

### 3. `npm --prefix frontend run build`
```text
vite v8.3.5 building client environment for production...
transforming...
✓ 114 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                                                     0.13 kB
dist/manifest.webmanifest                                              0.49 kB
dist/index.html                                                        1.72 kB │ gzip:   0.64 kB
dist/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2     17.20 kB
dist/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2     17.52 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs                            1,264.34 kB
dist/assets/index-DHk-rjCW.css                                        67.11 kB │ gzip:  10.46 kB
dist/assets/index-Bv6EKO0a.js                                        417.89 kB │ gzip: 124.78 kB
dist/assets/pdf-ULJPBbF3.js                                          430.16 kB │ gzip: 129.27 kB
✓ built in 165ms
PWA v2.0.0
precache  22 entries (578.90 KiB)
```

---

## 4. Files Touched

### Modified Files:
- `frontend/src/App.tsx`
- `frontend/src/drivers/hashRoute.ts`
- `frontend/src/screens/Explore.tsx`
- `frontend/src/i18n/index.ts`
- `frontend/src/styles/explore.css`
- `docs/user-test/translation-review.md`
- `docs/user-test/translation-review.csv`

### Created Files:
- `frontend/src/components/VerifiedBanner.tsx`
- `frontend/src/screens/ShareError.tsx`
- `frontend/tests/share.open.hashRoute.test.ts`
- `frontend/tests/share.open.banner.test.tsx`
- `frontend/tests/share.open.errors.test.tsx`
- `frontend/tests/share.open.routing.test.tsx`
- `docs/reports/agy-t3-student-open-report.md`

---

## 5. Needs from Reviewer (Claude Code)
None. No Kiro-owned files were edited (`frontend/src/core/**`, `backend/app/schema.py`, etc. are untouched). No new package dependencies were introduced.
