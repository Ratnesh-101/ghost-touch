# Lane y1-w3-fixes-a Report

- **Lane:** y1-w3-fixes-a
- **Builder:** Antigravity (agy, reviewed by Claude)
- **Status:** DONE
- **Date:** 2026-11-10
- **Source Audit:** `docs/reports/audit-w3-eyes-closed.md`

## Overview
Addressed three accessibility and reliability findings identified in the Eyes-Closed Accessibility
Audit (`docs/reports/audit-w3-eyes-closed.md`) within files scoped to lane `y1-w3-fixes-a`:
1. **HIGH 3** (`frontend/src/drivers/speech.ts`): Speech synthesis lifecycle handling on tab
   backgrounding/hiding (`visibilitychange` / `pagehide`).
2. **MED** (`frontend/src/screens/Capture.tsx`): Audible and visual feedback when camera dialog
   is cancelled or no file returns.
3. **MED** (`frontend/src/flow/capture.ts` with `frontend/src/api/scene.ts`): Clear offline guidance
   on network failure during capture/upload.

---

## Detailed Implementation & Verification

### 1. HIGH 3 · Speech synthesis lifecycle handling (`frontend/src/drivers/speech.ts`)
- **Source Audit Quote** (`docs/reports/audit-w3-eyes-closed.md:89-118`):
  > **HIGH · frontend/src/drivers/speech.ts:240-284 & frontend/src/screens/Explore.tsx:896-910**
  > Problem: `WebSpeechDriver` lacks tab lifecycle handling; speech synthesis queue freezes and
  > gets stuck or bursts out when the app returns from background.
  > Verification: In `frontend/src/drivers/speech.ts`, `WebSpeechDriver.listen` subscribes to
  > `pagehide` and `visibilitychange`... but `WebSpeechDriver.speak` has no lifecycle listeners.
  > When a document becomes hidden (`document.hidden = true`), Chrome on Android pauses ongoing
  > `speechSynthesis`.
- **Implementation**:
  - In `frontend/src/drivers/speech.ts`, added `dispose?(): void` to `SpeechDriver` interface.
  - In `defaultHost()`, exposed `window` and `document` references when running in browser DOM.
  - In `WebSpeechDriver`, attached `visibilitychange` and `pagehide` listeners in constructor.
  - When `document.hidden === true` or `document.visibilityState === 'hidden'` (or `pagehide`
    fires), `host.synth?.cancel()` is executed immediately, clearing pending speech queue.
  - Implemented `dispose()` to detach lifecycle event listeners and cancel speech cleanly.
  - Preserved `listen()` behavior and listeners.
- **Verification**:
  - In `frontend/tests/drivers.speech.test.ts`, added 4 unit tests driving `FakeDocument` and
    `FakeWindow`:
    1. Hiding document (`visibilitychange` with `doc.hidden = true`) triggers `synth.cancel()`;
       restoring to visible does not re-cancel; subsequent `speak()` works normally.
    2. Window `pagehide` event triggers `synth.cancel()`.
    3. `dispose()` tears down listeners and cancels active speech; subsequent events do not trigger.
    4. `listen()` continues to function alongside lifecycle listeners and aborts on backgrounding.

### 2. MED · Camera dialog dismissal / permission denial feedback (`frontend/src/screens/Capture.tsx`)
- **Source Audit Quote** (`docs/reports/audit-w3-eyes-closed.md:155-179`):
  > **MED · frontend/src/screens/Capture.tsx:151-155, 164-166**
  > Problem: Dismissing the system camera dialog or encountering an OS camera permission denial
  > drops into silence without audible feedback.
  > Verification: In `Capture.tsx:164-166`: `if (file === undefined) { handleCancel(); return; }`
  > And `handleCancel` runs resetting busy state and refocusing the button in complete silence.
- **Implementation**:
  - In `frontend/src/screens/Capture.tsx`, updated `handleCancel()` to call
    `say(t('capture.cancelled'))`, speaking aloud and displaying the message in `<StatusText>`.
  - Added `lastCancelTimeRef` with a 300 ms window to debounce duplicate cancel/change event triggers,
    guaranteeing the cancel path speaks exactly once.
  - Refocused `takeButton.current?.focus()` after cancellation.
  - Added new string `capture.cancelled` ("No photo was taken. Choose Take photo, Choose image,
    or a sample.") in `en`, `hi`, and `gu` in `frontend/src/i18n/index.ts`.
  - Appended review rows to `docs/user-test/translation-review.csv` and
    `docs/user-test/translation-review.md`.
  - Strictly avoided forbidden words (verified, correct, checked, approved).
- **Verification**:
  - Added `frontend/tests/capture.cancel.test.tsx` with jsdom mounting `<Capture />`:
    1. Dispatched `cancel` event on camera input: verifies speech is spoken with `capture.cancelled`
       and status element is visibly updated.
    2. Dispatched both `cancel` and empty `change` events in rapid succession: verifies speech is
       triggered EXACTLY ONCE.
    3. Dispatched `cancel` on file picker: verifies cancel announcement.
    4. Localized Hindi and Gujarati speech verification.
    5. Verified focus returns to the "Take photo" button.

### 3. MED · Offline message on photo upload failure (`frontend/src/flow/capture.ts`)
- **Source Audit Quote** (`docs/reports/audit-w3-eyes-closed.md:234-257`):
  > **MED · frontend/src/flow/capture.ts:51-67 & frontend/src/api/scene.ts:237-239**
  > Problem: Taking a photo or uploading while offline produces generic "Something went wrong"
  > instead of notifying the student of network failure.
  > Verification: In `api/scene.ts:237-239`, network disconnection throws
  > `new SceneRequestError('network')`. In `flow/capture.ts:51-67`, `captureErrorMessage` handles
  > `'busy'`, `'gateway'`, and `'timeout'`. The `'network'` failure case is omitted and falls
  > through to generic `capture.error`.
- **Implementation**:
  - In `frontend/src/flow/capture.ts:captureErrorMessage`, added mapping for `error.failure === 'network'`
    to return `t('capture.errorOffline')`.
  - Preserved all other failure mappings (`busy`, `gateway`, `timeout`, `http`, `bad-response`,
    `aborted`, `PdfError`).
  - Added new string `capture.errorOffline` ("You are offline. Samples still work. Try again when
    you are connected.") in `en`, `hi`, and `gu` in `frontend/src/i18n/index.ts`.
  - Appended review rows to `docs/user-test/translation-review.csv` and
    `docs/user-test/translation-review.md`.
- **Verification**:
  - In `frontend/tests/flow.capture.test.ts`, added comprehensive failure mapping test covering:
    - `SceneRequestError` kinds: `busy`, `gateway`, `timeout`, `network`, `http`, `bad-response`,
      `aborted`.
    - `PdfError` reasons: `password`, `invalid`, `empty`, `timeout`.
    - Generic errors.
    - Localized network error assertions for Hindi and Gujarati.
    - Tested `processImageFile` rejecting with `SceneRequestError('network')` produces
      `capture.errorOffline` announcement.

---

## Deferred Findings (Deferred to Later Lanes)
As directed by the lane brief, the following findings from `docs/reports/audit-w3-eyes-closed.md`
are deferred to other lanes that own those files:
- **HIGH** (`frontend/src/screens/ShareError.tsx:43-58` & `frontend/src/App.tsx:274-282, 701-706`):
  Cold open of corrupted share link silence and focus entrapment. (Deferred: owned by other lanes).
- **HIGH** (`frontend/src/App.tsx:592-594` & `frontend/src/screens/Correct.tsx:188-191`): Double
  speech trigger / clipping entering Correct mode. (Deferred: owned by other lanes).
- **HIGH 3 caller part** (`frontend/src/screens/Explore.tsx:896-910`): Stopping speech in
  `Explore.tsx` `handleVisibilityChange`. (Deferred: `Explore.tsx` owned by another lane; this lane
  handled the driver lifecycle in `frontend/src/drivers/speech.ts`).
- **MED** (`frontend/src/screens/Explore.tsx:438, 564, 569`): Focus forced to voice button after
  voice ask failure instead of text fallback. (Deferred: `Explore.tsx` owned by another lane).
- **MED** (`frontend/src/App.tsx:626-628` & `frontend/src/screens/SavedDiagrams.tsx:62-66`): Saved
  Diagrams heading speech clipping. (Deferred: `App.tsx` owned by another lane).
- **MED** (`frontend/src/screens/Explore.tsx:978-1004` & `frontend/src/components/StatusText.tsx:21-28`):
  Missing vertex/axis speech fallback to StatusText when TTS unavailable. (Deferred: `Explore.tsx`
  owned by another lane).
- **LOW** (`frontend/src/screens/Correct.tsx:435-438, 577-605`): Keyboard point cycling in Correct
  mode. (Deferred: `Correct.tsx` owned by another lane).

---

## Pass 2 Note
- Pass 2: Mocked `drivers/pdf` in `capture.cancel.test.tsx` to fix Vite URL import, aligned `capture.lifecycle.test.tsx` cancel assertions with `t('capture.cancelled')`, and restricted `capture.errorOffline` to `navigator.onLine === false`.

---

## Pass 3 Note
- Pass 3: Cast origNav through unknown in frontend/tests/flow.capture.test.ts to fix TS2352.

---

## Files Touched
- `frontend/src/i18n/index.ts`
- `frontend/src/drivers/speech.ts`
- `frontend/src/screens/Capture.tsx`
- `frontend/src/flow/capture.ts`
- `frontend/tests/drivers.speech.test.ts`
- `frontend/tests/flow.capture.test.ts`
- `frontend/tests/capture.cancel.test.tsx`
- `frontend/tests/capture.lifecycle.test.tsx`
- `docs/user-test/translation-review.csv`
- `docs/user-test/translation-review.md`
- `docs/reports/agy-y1-w3-fixes-a-report.md`
- `docs/BUILD_LOG.md`
