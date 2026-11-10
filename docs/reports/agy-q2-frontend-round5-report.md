# Report: Lane q2-frontend-round5

**Status: DONE**  
**Auditor / Builder:** agy, reviewed by Claude  
**Date:** 2026-11-10  
**Lane:** `q2-frontend-round5`

---

## 1. Executive Summary

This lane addressed all frontend, language, and `App.tsx` items identified in the round-5 audits
(`docs/reports/audit-r5-kiro-glue.md` and `docs/reports/audit-r5-share-a11y.md` finding R5-12),
mandated by `docs/briefs/agy-q2-frontend-round5.md`.

All 5 assigned items were resolved and verified with real component and unit tests:
1. `screens/Explore.tsx`: Status text and repeat-speech announcement dynamically rebuilt in the
   active language upon mid-session language switch; repeat speech uses the current language tag.
2. `flow/ask.ts`: `caveatForQuestion` uses caller's language (`deps.lang` / `activeLang`) with
   UI language as last fallback, delivering Hindi/Gujarati caveats for Hindi/Gujarati queries.
3. `flow/ask.ts`: `caveatForQuestion` candidate extraction now matches 3-letter vertex codes
   ("ADC") and single-letter vertex queries ("D", "angle at D"), while ignoring unrelated vertices.
4. `App.tsx`: ShareError double speech prevented by passing `canSpeak` to `ShareErrorScreen` and
   guarding `speakShareAnnouncements` so exactly one speech channel fires across all environments.
5. `App.tsx`: `resolveShareRoute` explicitly defaults `honest` to `true` (`options?.honest ?? true`)
   preventing shared links without explicit flags from emitting legacy "Verified" wording.

Zero forbidden files (`frontend/src/core/**`, `Teach.tsx`, `flow/ghostwriter.ts`,
`flow/share.ts` sanitisers, `.env*`) were touched. Zero shell commands were run. All lines remain
strictly within 100 columns.

---

## 2. Item-by-Item Findings & Fixes

### Item 1 (HIGH, kiro-glue #1): Explore.tsx Mid-Session Language Switch
- **Status:** FIXED
- **Files changed:** `frontend/src/screens/Explore.tsx`
- **Cause:** `Explore.tsx` initialized `statusMessage` state and `lastSpokenRef` once on mount
  from `announced`. When language was switched via SettingsLauncher mid-session, `statusMessage`
  and `lastSpokenRef` retained the initial English announcement string, causing TalkBack status
  cards and repeat speech to speak English with the Hindi/Gujarati TTS synthesizer voice.
- **Resolution:**
  - Added `deriveAnnouncement()` in `Explore.tsx`, recalculating `exploreAnnouncement` from `scene`,
    mode (`isRawScene ? 'raw' : verified ? 'shared' : 'ai'`), and current language.
  - Added a `useEffect` on `currentLang` that detects language changes, re-derives the announcement,
    and updates `statusMessage` and `lastSpokenRef.current`.
  - Passed `LANG_BCP47[getLang()]` to SettingsLauncher `speak` callback.
  - Spoken repeat in `startVoiceAsk` uses `lastSpokenRef.current` and passes `LANG_BCP47[getLang()]`
    (`'hi-IN'`) to `drivers.speech.speak`.
- **Test:** `frontend/tests/q2.round5.test.tsx` ("rebuilds status text and speaks repeat in
  current language (en -> hi)").

### Item 2 (HIGH, kiro-glue #2): caveatForQuestion Caller Language Wiring
- **Status:** FIXED
- **Files changed:** `frontend/src/flow/ask.ts`
- **Cause:** `caveatForQuestion` took only `(findings, question)` and called `tf()` without
  specifying language. `tf()` read global `currentLang`. When backend questions were processed in
  Hindi (`deps.lang = 'hi-IN'`) while the UI remained in English, the caveat was generated in
  English and prepended to the Hindi answer.
- **Resolution:**
  - Added `lang?: string` parameter to `caveatForQuestion(findings, question, lang)`.
  - Parsed `safeLang` from `lang.split('-')[0]`, falling back to `getLang()`.
  - Looked up `verify.angleName` and `verify.disagree` templates in `tables[safeLang]` with English
    fallback.
  - In `AskManager.startVoiceAsk` and `AskManager.submitTextAsk`, passed `activeLang`
    (`deps.lang ?? LANG_BCP47[getLang()]`) to `caveatForQuestion(findings, question, activeLang)`.
- **Test:** `frontend/tests/q2.round5.test.tsx` ("uses caller lang for Hindi and Gujarati caveat
  when UI is English" & "AskManager.submitTextAsk attaches caveat matching deps.lang").

### Item 3 (MED, kiro-glue #4): Single-Letter Vertex Matching for 3-Letter Angle Codes
- **Status:** FIXED
- **Files changed:** `frontend/src/flow/ask.ts`
- **Cause:** When an angle dispute specified a 3-letter vertex code like "ADC", `candidates`
  contained only "ADC" and "angle ADC". When students touched vertex D and asked "What is angle D?"
  or "angle at D", word boundary regex matching failed and no caveat was produced.
- **Resolution:**
  - In `caveatForQuestion`, when `finding.angleVertex` has 3 letters (or `targetName` matches
    `/^angle\s+[a-zA-Z0-9]{3}$/i`), also added `cand.charAt(1)` (middle vertex, e.g. "D") to
    `candidates`.
  - Word boundary regex ensures "D" matches "angle at D" and "what is angle D", while non-matching
    vertices (e.g. "angle B") or segments ("length of AC") return `null`.
- **Test:** `frontend/tests/q2.round5.test.tsx` ("matches questions naming 3-letter vertex 'ADC'",
  "matches questions naming single-letter vertex 'D' or 'angle at D'", and "does not match
  questions naming an unrelated vertex or segment").

### Item 4 (R5-12 & ShareError): App.tsx ShareError Double-Speech Prevention
- **Status:** FIXED
- **Files changed:** `frontend/src/App.tsx`
- **Cause:** When navigating to `#s=<invalid>`, `App.tsx` called `speakShareAnnouncements` via Web
  Speech synthesis while `ShareError.tsx` was rendered without `canSpeak`. Because `canSpeak` was
  omitted in `App.tsx:702`, `ShareError.tsx` could not reliably coordinate speech synthesis with
  DOM live regions, risking TalkBack dual-speech collisions.
- **Resolution:**
  - Passed `canSpeak={drivers.speech.canSpeak}` to `<ShareErrorScreen>` in `App.tsx`.
  - In `speakShareAnnouncements`, guarded error speech with `if (speech.canSpeak)`.
  - In `App.tsx` routing, guarded error speech with `if (drivers.speech.canSpeak)`.
  - When speech is active: Web Speech speaks once and `ShareError` omits `role="alert"` / live
    region; when speech is inactive: Web Speech does not speak and `ShareError` mounts assertive
    `role="alert"`. Exactly one channel fires in each environment.
- **Test:** `frontend/tests/q2.round5.test.tsx` ("speakShareAnnouncements speaks once when canSpeak
  is true, 0 times when false" & "ShareError renders alert only when canSpeak is false, plain text
  when true").

### Item 5 (R5-12): resolveShareRoute Honest Default Enforcement
- **Status:** FIXED
- **Files changed:** `frontend/src/App.tsx`, `frontend/tests/share.open.routing.test.tsx`
- **Cause:** In `App.tsx:126`, `useHonest` was initialized as `options?.honest ?? false`. Any caller
  invoking `resolveShareRoute(hash, true)` without passing `{ honest: true }` silently received
  legacy "Verified by <name>" announcements.
- **Resolution:**
  - In `App.tsx`, defaulted `useHonest` to `true`: `options?.honest ?? true`.
  - Shared link routes now always construct honest "Shared by <name>, not checked" announcements
    unless `{ honest: false }` is explicitly requested.
  - Updated legacy contract tests in `share.open.routing.test.tsx` to pass `{ honest: false }`.
  - Added tests asserting that omitted options and empty `{}` options objects default to honest copy
    without the word "Verified".
- **Test:** `frontend/tests/q2.round5.test.tsx` ("defaults honest to true when options argument is
  omitted", "defaults honest to true when options object is empty {}", "returns legacy announcement
  only when honest: false is explicitly set") and `frontend/tests/share.open.routing.test.tsx`.

---

## 3. DEFERRED Items (Kiro-Owned / Other Lanes)

The following findings from `docs/reports/audit-r5-kiro-glue.md` and `audit-r5-share-a11y.md` are
deferred per `AGENTS.md` and the lane brief rules:

1. **Reserved ID `'title'` in `addPoint` (`frontend/src/core/correct.ts:172`):**  
   *Reason:* Kiro-owned file (`frontend/src/core/**`). Core modification forbidden in this lane.
2. **500-point limit in `validateSceneInvariants` and `addPoint` (`frontend/src/core/correct.ts:193,345`):**  
   *Reason:* Kiro-owned file (`frontend/src/core/**`).
3. **`_is_point_id` alphanumeric point IDs (`backend/app/ask.py:412`):**  
   *Reason:* Backend file outside frontend lane scope.
4. **`localizedFindingTarget` fallback without `angleVertex` (`frontend/src/core/verify.ts:36`):**  
   *Reason:* Kiro-owned file (`frontend/src/core/**`).
5. **`parseFacts` Hindi/Gujarati keywords (`frontend/src/core/verify.ts:143`):**  
   *Reason:* Kiro-owned file (`frontend/src/core/**`).
6. **`Teach.tsx` and `flow/ghostwriter.ts` changes:**  
   *Reason:* Owned by lane g1.
7. **`flow/share.ts` sanitiser regexes:**  
   *Reason:* Owned by lane q1.

---

## 4. Files Touched

- `frontend/src/flow/ask.ts` (Items 2 and 3)
- `frontend/src/screens/Explore.tsx` (Item 1)
- `frontend/src/App.tsx` (Items 4 and 5)
- `frontend/tests/share.open.routing.test.tsx` (Item 5 legacy test alignment)
- `frontend/tests/q2.round5.test.tsx` (New verification test suite for Items 1–5)
- `frontend/tests/k1.verifyWiring.test.ts` (Pass 2: Item 5 shared-link announcement alignment)
- `docs/reports/agy-q2-frontend-round5-report.md` (This report)
- `docs/BUILD_LOG.md` (Build log entry)

---

## 5. Pass 2 Follow-Up Notes

1. **TypeScript (`tsc --noEmit`) Clean-up:**
   - In `frontend/src/flow/ask.ts`, removed unused import `tf`.
   - In `frontend/tests/q2.round5.test.tsx`:
     - Removed unused `type SpeechDriver` and `t` imports.
     - Typed mock `getRate` return value explicitly as `SpeechRateSetting`
       (`(): SpeechRateSetting => 'normal'`).
     - Replaced post-construction assignment to read-only `speech.canSpeak` by parameterizing
       `createMockDrivers({ canSpeak })`.

2. **DOM Test Environment (`tests/q2.round5.test.tsx`):**
   - Added `// @vitest-environment jsdom` as the first line of
     `frontend/tests/q2.round5.test.tsx` so that DOM primitives (`document`, `window`)
     are properly initialized by Vitest during real DOM rendering and event dispatch.

3. **Shared-Link Announcement Verification (`tests/k1.verifyWiring.test.ts`):**
   - *Analysis & Decision:* Per SPEC GHOST, R1, and R3, shared link announcements MUST
     carry the honest title prefix (`share.titlePrefix`: `"Title: <title>"`) and honest
     creator label (`share.sharedBy`: `"Shared by <name>, not checked"`) along with the
     honesty disclaimer (`share.honesty`). Defaulting `honest` to `true` in
     `resolveShareRoute` (Item 5) is the safe and intended behavior.
   - *Resolution:* Updated `tests/k1.verifyWiring.test.ts` Section 3 to build the expected
     strings from the i18n keys (`share.titlePrefix`, `share.sharedBy`, and `share.honesty`),
     while continuing to assert the caveat (for forged scenes) and no-caveat (for honest
     scenes) behavior under test.

---

## 6. Pass 3 Follow-Up Note

- **PDF Worker URL Isolation (`tests/q2.round5.test.tsx`):** Mocked `Capture`, `drivers/pdf`,
  and `pdf.worker.min.mjs?url` with inert stubs before dynamically importing App route helpers,
  enabling the test suite to load cleanly and run under jsdom without Vitest URL import errors.
