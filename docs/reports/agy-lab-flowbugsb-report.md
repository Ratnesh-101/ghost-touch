# Lane lab-flowbugsb Report: Language, Ask and TalkBack Bug Fixes & Audit Investigation

Report for lane `lab-flowbugsb` in accordance with `docs/briefs/lab-spec.md`, `docs/briefs/agy-lab-flowbugsb.md`, and `docs/reports/audit-bugs.md`.

---

## 1. Verification Summary (Definition of Done)

Commands executed from repository root in strict adherence to headless execution rules:

### `npm --prefix frontend exec -- tsc -p frontend --noEmit`
- **Result:** Clean (Exit code 0).
- **Output:** 0 type errors.

### `npm --prefix frontend test`
- **Result:** Clean (Exit code 0).
- **Summary:** 61 test files passed (61), 847 tests passed (847).
- **New tests added:** 10 new tests across 2 new test files (`lang.rerender.test.tsx`, `ask.errors.test.tsx`), 0 regressions across existing 837 tests.

### `npm --prefix frontend run build`
- **Result:** Clean (Exit code 0).
- **Summary:** Vite v8.3.5 client bundle built in 161ms. Service worker precache generated with 22 entries (498.45 KiB).

---

## 2. Finding 10 (MEDIUM): Language Selector Changes Do Not Update Active Screen Labels (FIXED)

### Defect Overview
In `frontend/src/App.tsx`, the root component did not subscribe to language store changes (`subscribeLang` in `frontend/src/i18n/index.ts`). When a user selected a new language in `LanguageSelector` or the new `LabSettings` sheet on Capture, `setLang(lang)` correctly updated the internal language table and notified listeners, but `App.tsx` did not re-render. Consequently, active screen controls ("Take photo", "Choose image", "Saved diagrams", "Ask", "Back", etc.) remained stuck displaying strings in the previously active language until a screen transition occurred. In addition, `LanguageSelector.tsx` maintained local `useState<Lang>` initialized once, which could drift out of sync if language changed from an external component.

### Implementation
1. **Root Screen Tree Subscription (`frontend/src/App.tsx`):**
   - Added `const currentLang = useSyncExternalStore(subscribeLang, getLang, getLang);` to `App()`.
   - Subscribed `App` directly to the `i18n` store so that any language switch immediately triggers a re-render of `App` and its active child screen (`Start`, `Capture`, `Explore`, `Correct`, `SavedDiagrams`).
   - Replaced static `getLang()` calls in spoken navigation handlers (`handleScene`, `handleBack`, `handleCorrect`, `openSaved`, `saveDiagram`, etc.) with `currentLang`, ensuring spoken messages always match the newly selected language.
2. **LanguageSelector Synchronization (`frontend/src/components/LanguageSelector.tsx`):**
   - Removed local un-synchronized `useState<Lang>` in favour of deriving `isSelected = currentLang === lang` directly from `useSyncExternalStore(subscribeLang, getLang, () => 'en' as Lang)`.
   - Preserved the existing spoken confirmation in the newly selected language via `drivers.speech.speak(confirmMessage, targetBcp47)`.

### Proving Test
- **File:** `frontend/tests/lang.rerender.test.tsx`
- **Verifications:**
  - Verifies `subscribeLang` notifies registered listeners upon `setLang('hi')`, `setLang('gu')`, and `setLang('en')`.
  - Verifies `App` screen labels re-render to Hindi (`घोस्ट टच`, `शुरू करने के लिए कहीं भी टैप करें`), Gujarati (`ગોસ્ટ ટચ`, `શરૂ કરવા માટે ગમે ત્યાં ટેપ કરો`), and English.
  - Verifies `LanguageSelector` dynamically updates its active pressed button state when language store changes.

---

## 3. Finding 11 (MEDIUM): Unhandled Promise Rejections in Explore Screen Ask Flow (FIXED)

### Defect Overview
In `frontend/src/screens/Explore.tsx:186-207, 220-235`, calls to `await askManager.current.submitTextAsk(...)` inside `handleVoiceAsk` and `handleTextSubmit` were unhandled. In `frontend/src/flow/ask.ts`, throwing callback invocations (such as `deps.say` when browser Web Speech throws a DOM exception or audio driver cues fail) could reject the single-flight manager. When any unexpected rejection escaped:
1. `setIsBusy(false)` was never executed.
2. The UI remained permanently frozen in `isBusy === true`, with the Ask button, Send button, and text input disabled.
3. No error message was spoken or displayed, abandoning the user in total silence.

### Implementation
1. **Async Safety in Explore (`frontend/src/screens/Explore.tsx`):**
   - Wrapped all async execution paths in `handleVoiceAsk` and `handleTextSubmit` inside `try / catch / finally` blocks.
   - On error:
     - Plays the error earcon (`drivers.audio.playEarcon?.('error')`).
     - Translates error through `askErrorMessage(err)` (reusing existing `ask.error*` keys; no new keys added).
     - Sets visible status message (`setStatusMessage(msg)`).
     - Speaks error message aloud (`drivers.speech.speak(msg, lang)`), guaranteeing never silence.
     - Offers text fallback box (`setShowTextFallback(true)`).
   - In `finally`:
     - Guarantees `setIsBusy(false)` is always executed unless the component has unmounted (`leaving.current`).
     - Restores focus to `askButtonRef` (or `textInputRef` on text ask error so the user does not lose their typed question and can retry).
2. **Microphone Session Tracking & Abort Cleanup (`frontend/src/flow/ask.ts`, `frontend/src/screens/Explore.tsx`):**
   - Added `setActiveSpeech(speech: SpeechDriver | null)` to `AskManager`.
   - `handleVoiceAsk` registers `askManager.current.setActiveSpeech(drivers.speech)` during listening.
   - In `handleExit` and component unmount cleanup, `drivers.speech.cancelListen?.()` and `askManager.current.abort()` are both called to prevent mic leaks and stale background state mutations.
3. **Robust Callback Handling (`frontend/src/flow/ask.ts`):**
   - Guarded all `deps.say(...)`, `audio.playEarcon`, and `onStatusChange` invocations in `startVoiceAsk` and `submitTextAsk` so throwing speech or audio callbacks cannot cause unhandled promise rejections.
   - Aborting cleanly returns `{ kind: 'cancelled' }` without clobbering newer flight states.

### Proving Test
- **File:** `frontend/tests/ask.errors.test.tsx`
- **Verifications:**
  - Verifies `AskRequestError('timeout')` plays error earcon, speaks `t('ask.errorTimeout')`, returns `{ kind: 'failed' }`, and restores idle state (`isBusy === false`).
  - Verifies `AskRequestError('network')` speaks `t('ask.errorOffline')` and restores idle state.
  - Verifies unexpected generic `TypeError` / network exceptions do not cause unhandled rejections and restore idle state.
  - Verifies `say` throwing (e.g. SpeechSynthesis failure) does not crash `AskManager` and clears busy state in `finally`.
  - Verifies `speech.listen` rejection with `ListenError('no-speech')` requests text fallback, speaks `t('ask.errorNoSpeech')`, and resets busy.
  - Verifies aborting voice ask cancels speech listening, returns `{ kind: 'cancelled' }`, and does not speak error lines.
  - Verifies `Explore` screen renders text fallback form and Send button when speech listening is unsupported.

---

## 4. Finding 5 (HIGH): TalkBack Double Announcement on Explore Canvas (INVESTIGATION ONLY)

Per brief instructions: **INVESTIGATION ONLY — NO BEHAVIOUR CHANGE.**

| Dimension | Details |
| :--- | :--- |
| **Is Finding Real?** | **Yes, 100% real and verifiable in code.** |
| **Reasoning from Code** | When a diagram is opened, `App.tsx:112` executes `drivers.speech.speak(announced, ...)`, speaking the full screen prompt ("Triangle. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave.") via Web Speech API (`speechSynthesis`). Simultaneously, `Explore.tsx:450` runs `canvasRef.current?.focus()`. The canvas element has `role="img"` and `aria-label={canvasAriaLabel(scene)}` (`Explore.tsx:718`), where `canvasAriaLabel` returns `${sceneName(scene)}. ${t('explore.gestureHint')}` (`flow/navigation.ts:27-29`). On Android Chrome with TalkBack active, TalkBack's AccessibilityService immediately speaks the accessible name of the newly focused canvas element while Web Speech API is concurrently speaking through the audio subsystem. Both voices play simultaneously over each other through the phone speaker. |
| **Exact Files & Lines** | `frontend/src/App.tsx:111-113`<br>`frontend/src/screens/Explore.tsx:450, 718`<br>`frontend/src/flow/navigation.ts:27-29` |
| **Smallest Possible Fix** | When `drivers.speech.canSpeak` is true, simplify the canvas `aria-label` to just the short title `sceneName(scene)` (e.g. `aria-label={sceneName(scene)}`), or omit `drivers.speech.speak(announced)` on transition and rely on TalkBack's focus announcement for the verbose instruction. Note: `frontend/tests/screens.render.test.ts:83-86` explicitly asserts that the canvas contains the full hint `aria-label="Triangle. Double-tap and hold..."`, so test expectations would need alignment. |
| **Risk of Changing Behavior** | **HIGH risk.** TalkBack users navigating with touch or swipe rely on the canvas accessible name when moving focus back to the canvas. Removing instructions from `aria-label` degrades accessibility if Web Speech fails or system voices are missing. Conversely, silencing programmatic speech synthesis would break eyes-closed exploration for users not running TalkBack (who rely exclusively on the Web Speech prompt). |
| **Recommendation** | **Do not change without a physical phone test.** Evaluate on an Android device running TalkBack whether the dual speech is noticeable or whether Android Chrome automatically ducks Web Speech during TalkBack announcements. If the overlap is confirmed disruptive during phone testing, conditionally omit the verbose hint from `canvasAriaLabel` only when programmatic speech synthesis is verified active. |

---

## 5. Finding 14 (MEDIUM): Secondary Pointer Dead-Zone After Primary Finger Lift (INVESTIGATION ONLY)

Per brief instructions: **INVESTIGATION ONLY — NO BEHAVIOUR CHANGE.**

| Dimension | Details |
| :--- | :--- |
| **Is Finding Real?** | **Yes, 100% real and verifiable in code.** |
| **Reasoning from Code** | In `Explore.tsx:501-531`, touches are tracked in `activePointers.current`. The first pointer to touch down becomes `primaryPointerId.current`. When a second finger touches down (e.g. pointerId 2), it is added to `activePointers`, but `primaryPointerId.current` remains pointerId 1. When pointer 1 lifts, `handlePointerLift` (`Explore.tsx:656-669`) executes: `activePointers.current.delete(e.pointerId)`, observes `e.pointerId === primaryPointerId.current`, and sets `primaryPointerId.current = null`. Pointer 2 remains in `activePointers.current`. However, in `handlePointerMove` (`Explore.tsx:627-629`), movement is guarded by: `if (e.pointerId !== primaryPointerId.current) return;`. Because `e.pointerId` (2) does not equal `null`, all movement from the remaining finger is dropped. The active finger on screen produces no haptics, no tone, and no cursor update until completely lifted and placed down again. |
| **Exact Files & Lines** | `frontend/src/screens/Explore.tsx:627-629, 656-669` |
| **Smallest Possible Fix** | In `handlePointerLift`, when `primaryPointerId` is lifted and `activePointers.current.size > 0`, promote the first remaining pointer in `activePointers.current.keys()` to become `primaryPointerId.current`, and re-initialize the relative engine/axis state at that pointer's coordinates. |
| **Risk of Changing Behavior** | **VERY HIGH risk.** Ghost Touch's relative cursor (Requirement 13) anchors exploration relative to the diagram centre upon the initial touch. If a secondary finger is promoted on primary lift: (1) the relative offset was calibrated to the first finger, so promoting finger 2 would instantly jump the cursor coordinates across the screen, producing a disorienting sudden pitch glide and unexpected haptic buzz; (2) blind users frequently place a second finger accidentally or during two-finger gestures (two-finger swipe down to exit or two-finger long press to ask). Promoting an accidental touch would disrupt diagram orientation. |
| **Recommendation** | **Do not promote secondary pointers.** In tactile exploration on a mobile screen, accidental multi-touch is common. Requiring the user to lift all fingers and touch down with a single finger cleanly to re-centre is far safer, more predictable, and less disorienting than sudden cursor teleportation. Keep the current single-pointer guard. |

---

## 6. Commit Groups

The changes are divided into three clean, focused logical commits:

### Group 1: Language re-render reactivity
- **Message:** `fix(i18n): subscribe root App and LanguageSelector to language store updates (Finding 10)`
- **Files:**
  - `frontend/src/App.tsx`
  - `frontend/src/components/LanguageSelector.tsx`
  - `frontend/tests/lang.rerender.test.tsx`

### Group 2: Explore Ask error handling and unhandled rejection guards
- **Message:** `fix(explore): guard Ask async paths against unhandled rejections and restore idle state (Finding 11)`
- **Files:**
  - `frontend/src/flow/ask.ts`
  - `frontend/src/screens/Explore.tsx`
  - `frontend/tests/ask.errors.test.tsx`

### Group 3: Documentation and audit report
- **Message:** `docs: add report for lane lab-flowbugsb (Findings 10, 11 fixed; 5, 14 investigated)`
- **Files:**
  - `docs/reports/agy-lab-flowbugsb-report.md`
  - `docs/BUILD_LOG.md`
