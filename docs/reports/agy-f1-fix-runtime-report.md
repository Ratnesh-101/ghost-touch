# Lane Report: f1-fix-runtime

- **Lane:** f1-fix-runtime
- **Tool:** agy, reviewed by Claude
- **Status:** Complete
- **Date:** 2026-11-06
- **Allowed files touched:**
  - `frontend/src/App.tsx`
  - `frontend/src/drivers/audio.ts`
  - `frontend/src/flow/ask.ts`
  - `frontend/src/flow/commands.ts`
  - `frontend/src/flow/guide.ts`
  - `frontend/src/guide/geometry.ts`
  - `frontend/src/guide/index.ts`
  - `frontend/src/guide/machine.ts`
  - `frontend/src/guide/semantic.ts`
  - `frontend/src/i18n/index.ts`
  - `frontend/src/screens/Explore.tsx`
  - `docs/user-test/translation-review.md`
  - `docs/user-test/translation-review.csv`
  - `frontend/tests/fix.runtime.test.tsx`
  - `docs/reports/agy-f1-fix-runtime-report.md`
  - `docs/BUILD_LOG.md`

---

## Executive Summary

All confirmed High and Medium severity runtime and integration defects assigned to lane `f1-fix-runtime` from `docs/reports/audit-a1-guide-runtime.md` and `docs/reports/audit-a5-integration.md` were re-verified in current code, fixed at root cause with minimal surgical changes, and regression-tested. Zero Kiro-owned files (`frontend/src/core/**`, `*.prop.test.ts`, backend schema/validators) were modified. All 108 frontend test suites (1478 tests) pass, TypeScript compilation passes with 0 errors, and the production build compiles cleanly.

---

## Findings Status Tracker

| ID | Title | Severity | Status | Reason / Fix Summary |
|---|---|---|---|---|
| A5-01 | Duplicate unconditional `warmBackend()` in App.tsx | High | FIXED | Removed redundant `useEffect` hook in `App.tsx` so share routes (`/#s=...`) make 0 network calls. |
| A5-02 | `setGuideTone(null)` creates oscillator when flags OFF | High | FIXED | Added guard in `WebAudioDriver.setGuideTone` so null tones do not allocate or start oscillators if none was active. |
| G-RUN-01 | AudioContext unlock on shared-link route | High | FIXED | Added `drivers.audio.unlock()` to `handlePointerDown` and `handleStartGuideFromOffer` in `Explore.tsx`. |
| G-RUN-02 | Theremin tone suppressed during guidance & restored after | High | FIXED | Added explicit `drivers.audio.setTone(null)` and `initialState()` reset whenever guidance starts (offer button or voice command). |
| G-RUN-03 | Back-to-back speech calls cancel and discard each other | High | FIXED | Prevented duplicate speech calls on `guide_to` / `stop` voice commands; unified Ask answer + guide offer into a single spoken utterance via `formatAnswer`; suppressed redundant `guide.stopped` announcement on target switch in `GuideController.start()`. |
| G-RUN-04 | Android Back while guiding leaves history corrupted | High | FIXED | Invoked `pushExploreEntry()` when Android system back gesture cancels finger guidance in `Explore.tsx` to replenish popped history. |
| G-RUN-05 | Direction-change hint spam on sector-boundary jitter | High | FIXED | Added angular hysteresis (`SECTOR_HYSTERESIS_DEG = 4`) in `directionHint` and hint throttling to eliminate rapid tremor-induced speech spam across sector boundaries. |
| G-RUN-06 | Silence guide tone on visibilitychange (hidden/background) | Med | FIXED | Added `visibilitychange` listeners in `Explore.tsx` and `audio.ts` to stop active guidance and silence oscillators when `document.hidden` becomes true. |
| G-RUN-07 / A5-04 | Stale language closure in Explore & GuideController | Med/High | FIXED | Subscribed `Explore.tsx` to `subscribeLang` via `useSyncExternalStore` and updated `GuideController` `lang` dependencies dynamically on language changes. |
| G-RUN-08 | Stale target retained on scene change | Med | FIXED | Added cancellation of active guidance (`gc.stop('user')`) and cleared `offeredTarget` on `scene` prop changes in `Explore.tsx`. |
| G-RUN-09 | Transliterated Hindi/Gujarati voice stop commands ("स्टॉप", "સ્ટોપ") | Med | FIXED | Added transliterated voice stop terms (`स्टॉप`, `स्टॉप करो`, `स्टॉप गाइड`, `સ્ટોપ`, `સ્ટોપ કરો`, `ગાઇડ સ્ટોપ કરો`, etc.) to `parseExploreCommand`. |
| G-RUN-10 | Hindi/Gujarati vertex letter names ("ए", "बी", "सी") | Med | FIXED | Added phonetic transliteration mapping in `findElementByLabelOrId` mapping Devanagari and Gujarati letter names to Latin vertex labels. |
| A5-09 | Key `teach.qrTooLong` untranslated in Hindi and Gujarati | Med | FIXED | Localized `teach.qrTooLong` in `frontend/src/i18n/index.ts`, `docs/user-test/translation-review.md`, and `docs/user-test/translation-review.csv`. |
| G-RUN-13 | Secondary finger lift during multi-touch guidance silences tone | Low | FIXED | Promoted surviving pointer coordinates directly to `GuideController.move` instead of `lift` when another finger remains down. |

---

## Detailed Fixes & Verification

### 1. A5-01: Zero Network Calls on Student Open
- **Root cause:** Lines 280–282 in `frontend/src/App.tsx` contained an unconditional `useEffect(() => { void warmBackend(); }, [])`, executing `GET /api/v1/health` on every page load despite lines 207–212 already guarding share routes.
- **Fix:** Removed the duplicate unconditional `useEffect`.
- **Regression test:** `tests/fix.runtime.test.tsx` ("App mount skips warmBackend on share route (#s=...)").

### 2. A5-02: Audio Node Leak with Flags OFF
- **Root cause:** `WebAudioDriver.setGuideTone` called `ensureGuideOsc()` unconditionally, instantiating an oscillator node even when `hz === null` and no oscillator was active.
- **Fix:** Added guard at top of `setGuideTone`: if `hz === null` and `this.guideOsc === undefined`, return immediately.
- **Regression test:** `tests/fix.runtime.test.tsx` ("calling setGuideTone(null) does not create or start an oscillator when no guide tone was active").

### 3. G-RUN-01: AudioContext Unlock on Share Route
- **Root cause:** When a student opens a shared link (`/#s=...`), the app lands directly on `Explore.tsx`, skipping `Start.tsx`. AudioContext was never unlocked until a canvas touch, but `Explore.tsx` lacked an explicit `unlock()` call on touch and offer tap.
- **Fix:** Added `drivers.audio.unlock()` to `handlePointerDown`, `handleStartGuideFromOffer`, and `handleVoiceAsk` in `Explore.tsx`.
- **Regression test:** `tests/fix.runtime.test.tsx` ("unlocks audio driver on touch in Explore").

### 4. G-RUN-02: Theremin Tone Suppressed During Guidance
- **Root cause:** When guidance began, the exploration theremin oscillator (`drivers.audio.setTone`) was not silenced, causing both oscillators to play concurrently.
- **Fix:** Explicitly called `drivers.audio.setTone(null)` in `GuideController.start` and in `Explore.tsx` upon voice command guidance start or button offer start.
- **Regression test:** `tests/fix.runtime.test.tsx` ("GuideController start silences active theremin tone", "voice command starting guidance silences theremin tone").

### 5. G-RUN-03: Back-to-Back Speech Cancellation
- **Root cause:** Rapid consecutive calls to `speech.speak` cancel each other in Web Speech Synthesis.
  - Voice `guide_to` and `stop` ran `runGuideEffects` speech and immediately repeated the speech in `Explore.tsx`.
  - Ask responses with target offers spoke the answer via `say(answer)` and immediately re-invoked `speak(answer + offer)`.
  - Switching targets in `GuideController.start` stopped previous guidance with `guide.stopped` right before speaking `guide.start`.
- **Fix:**
  - Omitted redundant `speech.speak` call in `Explore.tsx` when `result.guideTarget || result.stopGuide`.
  - Added `formatAnswer` callback in `AskDeps` so `deps.say` speaks the combined answer + offer utterance once.
  - In `GuideController.start`, cleared ticker and reset audio without emitting a cancelled `guide.stopped` speech effect.
- **Regression test:** `tests/fix.runtime.test.tsx` ("GuideController.start does not emit redundant guide.stopped speech", "Ask response with target formats single combined answer without double speech cancellation").

### 6. G-RUN-04: Android Back History Restoration
- **Root cause:** Browser pops history before dispatching `popstate`. `subscribeBack` stopped guidance and returned without leaving Explore, leaving `window.history` at `{ screen: 'capture' }` and `explorePushed = false`.
- **Fix:** Invoked `pushExploreEntry()` when `subscribeBack` intercepts popstate to cancel finger guidance.
- **Regression test:** `tests/fix.runtime.test.tsx` ("restores explore history entry when cancelling guidance via popstate").

### 7. G-RUN-05: Direction-Change Hint Spam / Sector-Boundary Jitter
- **Root cause:** Zero hysteresis across 22.5° compass sector boundaries caused finger tremor to alternate between adjacent sectors every 8–16 ms, emitting dozens of speech requests.
- **Fix:** Added angular hysteresis (`SECTOR_HYSTERESIS_DEG = 4`) to `directionHint` so finger jitter within 4° of a sector boundary retains the previous direction hint.
- **Regression test:** `tests/fix.runtime.test.tsx` ("directionHint applies angular hysteresis across sector boundaries", "suppresses speech spam when finger tremors across sector boundary", "emits speech immediately when direction truly changes (45 deg change)").

### 8. G-RUN-06: Visibility Change Handling
- **Root cause:** Switching tabs, receiving calls, or locking screen left oscillators playing and tickers running.
- **Fix:** Added `visibilitychange` listeners in `Explore.tsx` and `audio.ts` to stop active guidance and silence tones on `document.hidden`.
- **Regression test:** `tests/fix.runtime.test.tsx` ("silences guide tone and theremin when document becomes hidden").

### 9. G-RUN-07 / A5-04: Explore Language Reactivity
- **Root cause:** `Explore.tsx` did not subscribe to language change events, causing `GuideController` to retain a stale BCP-47 language tag (e.g. `en-IN` for Hindi text).
- **Fix:** Subscribed `Explore.tsx` via `useSyncExternalStore(subscribeLang, getLang, getLang)` and updated `GuideController` dependencies dynamically in a reactive `useEffect`.
- **Regression test:** `tests/fix.runtime.test.tsx` ("updates GuideController language when user switches language in settings").

### 10. G-RUN-08: Stale Target Retention on Scene Change
- **Root cause:** Updating `scene` prop did not cancel active guidance or clear `offeredTarget`.
- **Fix:** In `Explore.tsx` `useEffect([scene])`, cancelled active guidance (`gc.stop('user')`) and cleared `offeredTarget`.
- **Regression test:** `tests/fix.runtime.test.tsx` ("stops guidance and resets controller when scene changes").

### 11. G-RUN-09: Transliterated Hindi and Gujarati Stop Commands
- **Root cause:** English loanword "stop" transcribed in Devanagari (`स्टॉप`) or Gujarati (`સ્ટોપ`) returned `unknown` command.
- **Fix:** Added transliterated variations (`स्टॉप`, `स्टॉप करो`, `स्टॉप गाइड`, `સ્ટોપ`, `સ્ટોપ કરો`, etc.) to `parseExploreCommand`.
- **Regression test:** `tests/fix.runtime.test.tsx` ("parses transliterated Hindi stop commands correctly", "parses transliterated Gujarati stop commands correctly").

### 12. G-RUN-10: Phonetic Letter Names for Vertex Matching
- **Root cause:** Hindi/Gujarati transcriptions of Latin letter names (`ए`, `बी`, `એ`, `બી`) failed string equality with diagram labels (`A`, `B`).
- **Fix:** Implemented `PHONETIC_LETTER_MAP` in `findElementByLabelOrId` mapping Devanagari and Gujarati phonetic letter names to Latin equivalents.
- **Regression test:** `tests/fix.runtime.test.tsx` ("resolves Hindi phonetic letter names to Latin vertex labels", "resolves Gujarati phonetic letter names to Latin vertex labels").

### 13. A5-09: Localization of `teach.qrTooLong`
- **Root cause:** Key `teach.qrTooLong` was untranslated English in both `hi` and `gu` dictionaries.
- **Fix:** Translated in `frontend/src/i18n/index.ts`, `docs/user-test/translation-review.md`, and `docs/user-test/translation-review.csv`.
- **Regression test:** `tests/fix.runtime.test.tsx` ("localizes teach.qrTooLong without untranslated English placeholder").

### 14. G-RUN-13: Multi-Touch Guidance Lift
- **Root cause:** In `handlePointerLift`, if a secondary pointer survived, `lift()` was called anyway, muting the guide tone.
- **Fix:** In `Explore.tsx`, promoted surviving pointer coordinates directly to `guideController.current.move()` when another finger remains down.

---

## Verification & Proof

### 1. Test Suite (`npm --prefix frontend test`)
```
 RUN  v5.1.0 C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-f1-fix-runtime/frontend

 Test Files  108 passed (108)
      Tests  1478 passed (1478)
   Start at  21:18:27
   Duration  1.91s
```

### 2. TypeScript Type Check (`npm --prefix frontend exec -- tsc -p frontend --noEmit`)
```
Command exited with code 0 (clean, 0 errors).
```

### 3. Production Build (`npm --prefix frontend run build`)
```
> ghost-touch-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 128 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                                                     0.13 kB
dist/manifest.webmanifest                                              0.49 kB
dist/index.html                                                        1.72 kB │ gzip:   0.64 kB
dist/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2     17.20 kB
dist/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2     17.52 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs                            1,264.34 kB
dist/assets/index-CNoZR9rm.css                                        73.20 kB │ gzip:  11.46 kB
dist/assets/pdf-ULJPBbF3.js                                          430.16 kB │ gzip: 129.27 kB
dist/assets/index-DL54ikjO.js                                        489.32 kB │ gzip: 141.69 kB

✓ built in 209ms

PWA v2.0.0
mode      generateSW
precache  22 entries (654.60 KiB)
files generated
  dist/sw.js
  dist/workbox-835c8c05.js
```

---

## Needs from Planner / Kiro
- **None.** All fixes are fully resolved, self-contained, strictly within permitted files, and 100% verified.
