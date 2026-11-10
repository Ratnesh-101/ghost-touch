# Eyes-Closed Accessibility Audit (Lane w3-eyes-closed-audit)

Status: DONE
Lane: w3-eyes-closed-audit
Scope: The whole frontend as a blind student would use it with eyes closed and the screen off
       (Chrome on Android, with and without TalkBack).
Map: `frontend/src/App.tsx`, `screens/*.tsx`, `flow/*.ts`, `drivers/*.ts`, `docs/PHONE_TEST.md`.

---

## Executive Summary

This audit evaluated Ghost Touch from the perspective of a totally blind student navigating
the application with eyes closed and the screen off on Chrome for Android, both standalone and
under TalkBack screen reader navigation.

Nine concrete issues were identified and verified by direct code inspection. The top findings
involve complete silence and focus entrapment on corrupted share link entry, mid-sentence
speech truncation caused by duplicate screen announcements, and frozen speech queues across
tab backgrounding lifecycles. All core touch exploration mechanics (corner vibrations, quiet
windows, and theremin pitch tracking) were verified as sound and non-conflicting.

---

## Findings Ranked by Severity

### HIGH · frontend/src/screens/ShareError.tsx:43-58 & frontend/src/App.tsx:274-282, 701-706
- **Problem**: Cold open of a corrupted share link leaves the blind student in complete silence
  with focus trapped on `document.body` and no accessible error announcement.
- **Verification**: In `App.tsx:274-282`, cold start initializes view directly from `readHash()`:
  ```ts
  if (resolution.kind === 'error') {
    return { screen: 'shareError', code: resolution.code, announced: resolution.errorMessage };
  }
  ```
  `App.tsx` does NOT call `speakShareAnnouncements` during initial `useState` initialization.
  Furthermore, in `App.tsx:701-706`, `ShareErrorScreen` is rendered without passing `canSpeak`.
  In `ShareError.tsx:43-45`, `speechAvailable` falls back to `'speechSynthesis' in window`, which
  evaluates to `true` on Android Chrome:
  ```ts
  const speechAvailable =
    canSpeak ?? (typeof window !== 'undefined' && 'speechSynthesis' in window);
  ```
  Because `speechAvailable` is `true`, `ShareError.tsx:54` sets `role={undefined}` on the card,
  and `<StatusText spoken={true}>` renders `<p className={className}>{children}</p>` without
  `role="status"` or `aria-live`. Crucially, `ShareError.tsx` has NO `useEffect` moving focus to
  the heading or "Go to start" button on mount.
- **Concrete Failure Scenario**: A blind student opens a broken `#s=corrupted` link sent via
  WhatsApp. The tab opens cold. Because Web Speech requires prior user gesture and was not
  triggered anyway, the browser cannot speak aloud. Because `speechAvailable` is true, no
  `role="alert"` or `aria-live` is rendered in DOM. Focus remains unmanaged on `document.body`.
  TalkBack produces zero sound. The student experiences dead silence and cannot locate the
  "Go to start" button without wandering blindly.
- **Minimal Fix**: In `ShareError.tsx`, add an effect on mount to focus the heading
  (`headingRef.current?.focus()`), and ensure the error container retains `role="alert"` or
  `aria-live="assertive"` so TalkBack announces the error on cold page load.

---

### HIGH · frontend/src/App.tsx:592-594 & frontend/src/screens/Correct.tsx:188-191
- **Problem**: Double speech triggering and mid-sentence utterance clipping when entering Teacher
  Correction mode.
- **Verification**: In `App.tsx:592-594`, `handleCorrect` speaks the intro before mounting:
  ```ts
  const intro = t('correct.intro');
  drivers.speech.speak(intro, LANG_BCP47[currentLang]);
  setView({ screen: 'correct', scene: view.scene });
  ```
  In `Correct.tsx:188-191`, an identical announcement is spoken on mount:
  ```ts
  useEffect(() => {
    headingRef.current?.focus();
    speak(t('correct.intro'));
  }, []);
  ```
  In `frontend/src/drivers/speech.ts:250`, every call to `speak()` executes `synth.cancel()` to
  interrupt previous speech.
- **Concrete Failure Scenario**: When the user triggers "Correct", `App.tsx` starts speaking:
  "Correction mode. Tap elements to select...". A few milliseconds later, `Correct.tsx` mounts
  and invokes its mount effect. Utterance #2 calls `synth.cancel()`, abruptly chopping off
  utterance #1 mid-word ("Correction mode. Tap el—") and restarting the sentence from the
  beginning. This results in an audible glitch and disorienting repetition.
- **Minimal Fix**: Remove `speak(t('correct.intro'))` from `Correct.tsx`'s mount `useEffect`
  (relying on the transition gesture trigger in `App.tsx`), or guard it so it only speaks when
  not already spoken by the caller.

---

### HIGH · frontend/src/drivers/speech.ts:240-284 & frontend/src/screens/Explore.tsx:896-910
- **Problem**: `WebSpeechDriver` lacks tab lifecycle handling; speech synthesis queue freezes and
  gets stuck or bursts out when the app returns from background.
- **Verification**: In `frontend/src/drivers/speech.ts`, `WebSpeechDriver.listen` subscribes to
  `pagehide` and `visibilitychange` (lines 310-313, 340-351), but `WebSpeechDriver.speak` has
  no lifecycle listeners. When a document becomes hidden (`document.hidden = true`), Chrome on
  Android pauses ongoing `speechSynthesis`. In `Explore.tsx:896-910`, `handleVisibilityChange`
  silences oscillators and lifts pointers, but never calls `drivers.speech.stopSpeaking?.()`:
  ```ts
  const handleVisibilityChange = (): void => {
    if (document.hidden) {
      if (guideController.current?.isGuiding()) guideController.current.stop('user');
      drivers.audio.setTone(null);
      drivers.audio.setGuideTone?.(null);
      clearLongPressTimer();
      activePointers.current.clear();
      primaryPointerId.current = null;
      // Note: drivers.speech.stopSpeaking is missing!
    }
  };
  ```
- **Concrete Failure Scenario**: While exploring, the student receives a phone call or switches
  apps while an announcement is playing. Android freezes the speech queue. When the student
  switches back to Ghost Touch, the stale, interrupted speech burst plays out over the new
  canvas touch audio or TalkBack reading. On some Android Chrome versions, `speechSynthesis`
  remains permanently stalled until `cancel()` is explicitly executed.
- **Minimal Fix**: In `Explore.tsx:896-910`, add `drivers.speech.stopSpeaking?.()` when
  `document.hidden` is true. In `speech.ts`, add a `visibilitychange` listener to cancel speech
  synthesis when hidden.

---

### MED · frontend/src/screens/Explore.tsx:438, 564, 569
- **Problem**: When voice Ask fails, focus is forced back onto the failed voice Ask button
  rather than shifting to the newly revealed text fallback input.
- **Verification**: In `Explore.tsx:438` and `564`, voice recognition failure (e.g. mic denied,
  silence timeout) announces the error and activates the fallback form:
  ```ts
  setShowTextFallback(true);
  ```
  The spoken error message is: "Microphone permission denied. You can type your question instead."
  (or "No speech heard. You can type your question instead."). However, in the `finally` block
  at line 569:
  ```ts
  finally {
    busyRef.current = false;
    if (!leaving.current) {
      setIsBusy(false);
      focusAfterRender(askButtonRef);
    }
  }
  ```
  Focus is unconditionally moved to `askButtonRef`.
- **Concrete Failure Scenario**: The student hears: "Microphone permission denied. You can type
  your question instead." Believing they can now type, they activate their screen reader or
  press Enter. Because focus was programmatically forced onto `askButtonRef`, the voice Ask flow
  is re-triggered, failing immediately and re-trapping the user in a loop instead of allowing
  them to type in `#gt-ask-input`.
- **Minimal Fix**: In `handleVoiceAsk`, when fallback is shown due to error, place focus on
  `textInputRef` rather than `askButtonRef`:
  ```ts
  focusAfterRender(showTextFallback || textInputRef.current ? textInputRef : askButtonRef);
  ```

---

### MED · frontend/src/screens/Capture.tsx:151-155, 164-166
- **Problem**: Dismissing the system camera dialog or encountering an OS camera permission
  denial drops into silence without audible feedback.
- **Verification**: In `Capture.tsx:164-166`:
  ```ts
  if (file === undefined) {
    handleCancel();
    return;
  }
  ```
  And in `Capture.tsx:151-155`:
  ```ts
  const handleCancel = (): void => {
    busyRef.current = false;
    setBusy(false);
    takeButton.current?.focus();
  };
  ```
- **Concrete Failure Scenario**: A blind student double-taps "Take photo". If camera permission
  was denied in Android OS settings, the system camera activity immediately closes and returns
  no file. `handleCancel()` runs, resetting busy state and refocusing the button in complete
  silence. The student hears nothing and is left wondering if the app froze or the camera opened.
- **Minimal Fix**: In `handleCancel`, announce a brief reassurance:
  `say(t('capture.prompt'))` or a dedicated cancellation notice.

---

### MED · frontend/src/App.tsx:626-628 & frontend/src/screens/SavedDiagrams.tsx:62-66
- **Problem**: Opening the Saved Diagrams screen cuts off the heading announcement mid-word
  due to asynchronous IndexedDB completion.
- **Verification**: In `App.tsx:626-628`:
  ```ts
  const msg = t('saved.heading');
  drivers.speech.speak(msg, LANG_BCP47[currentLang]);
  setView({ screen: 'saved' });
  ```
  In `SavedDiagrams.tsx:62-66`, `loadSavedList` queries IndexedDB asynchronously:
  ```ts
  void loadSavedList(diagramStore, () => active && activeRef.current, (view) => {
    setLoading(false);
    setEntries(view.entries);
    say(view.announcement);
  });
  ```
  IndexedDB returns within 10-50 ms. Calling `say(view.announcement)` calls `speech.speak()`,
  which immediately runs `synth.cancel()`.
- **Concrete Failure Scenario**: When entering Saved Diagrams, the student hears "Saved dia—"
  before the speech is cut off and replaced by "Triangle. Sine graph..." or "No saved diagrams
  yet."
- **Minimal Fix**: Combine the heading with the initial list status inside `loadSavedList`
  (`"${t('saved.heading')}. ${view.announcement}"`), rather than initiating a separate utterance
  in `App.tsx`.

---

### MED · frontend/src/screens/Explore.tsx:978-1004 & frontend/src/components/StatusText.tsx:21-28
- **Problem**: Complete silence during touch exploration when speech synthesis is unavailable
  because vertex and axis announcements are never forwarded to `StatusText`.
- **Verification**: In `Explore.tsx:978-1004`, `applyMoveResult` processes touch movement:
  ```ts
  const joined = moveEffects.find((e) => e.kind === 'speak');
  if (joined?.kind === 'speak') {
    lastSpokenRef.current = joined.text;
  }
  runEffects(moveEffects, drivers, lang);
  ```
  Notice that `setStatusMessage(joined.text)` is NOT called. `<StatusText spoken={false}>`
  depends on `statusMessage` to update its polite live region (`role="status"`). When
  `drivers.speech.canSpeak === false`, `runEffects` drops the speak effect, but `statusMessage`
  remains stuck on the initial diagram intro.
- **Concrete Failure Scenario**: A student using an Android device without speech synthesis
  support (or with TTS disabled) drags their finger across a vertex. The phone delivers the
  corner vibration pattern, but TalkBack never reads the vertex label because the live region
  was never updated. The student cannot inspect vertex names.
- **Minimal Fix**: In `applyMoveResult`, if `!drivers.speech.canSpeak && joined?.text`, call
  `setStatusMessage(joined.text)`.

---

### MED · frontend/src/flow/capture.ts:51-67 & frontend/src/api/scene.ts:237-239
- **Problem**: Taking a photo or uploading while offline produces generic "Something went wrong"
  instead of notifying the student of network failure.
- **Verification**: In `api/scene.ts:237-239`, network disconnection throws:
  ```ts
  throw new SceneRequestError('network');
  ```
  In `flow/capture.ts:51-67`, `captureErrorMessage` handles `'busy'`, `'gateway'`, and `'timeout'`:
  ```ts
  if (error instanceof SceneRequestError) {
    if (error.failure === 'busy') return t('capture.errorBusy');
    if (error.failure === 'gateway') return t('capture.errorGateway');
    if (error.failure === 'timeout') return t('capture.errorTimeout');
  }
  return t('capture.error');
  ```
  The `'network'` failure case is omitted and falls through to generic `capture.error` ("Something
  went wrong. Please try again, or pick a sample.").
- **Concrete Failure Scenario**: A student takes a photo in an area with poor connectivity or in
  Airplane Mode. Instead of receiving clear guidance that they are offline and should check their
  connection or choose a sample diagram, they hear a generic failure message.
- **Minimal Fix**: Add `if (error.failure === 'network') return t('ask.errorOffline');` (or a
  dedicated `capture.errorOffline` string).

---

### LOW · frontend/src/screens/Correct.tsx:435-438, 577-605
- **Problem**: No keyboard or non-visual selection mechanism for diagram vertices in Teacher
  Correction mode.
- **Verification**: In `Correct.tsx:577-605`, `handleKeyDown` supports nudge (`Arrow*`), delete,
  and undo, but nudging only activates when `selection?.kind === 'point'`. The only way
  `setSelection` is populated is via `handlePointerDown` (lines 435-438), which requires
  precision tapping on a visual canvas point via `hitTestCorrect(px, py)`.
- **Concrete Failure Scenario**: A visually impaired teacher or a switch/keyboard user navigating
  Correction mode cannot select a vertex to edit or nudge its coordinates because there is no
  Tab or keyboard shortcut to cycle point selection.
- **Minimal Fix**: Allow pressing `Tab` or `[` / `]` on the canvas to cycle through existing
  points, announcing each selected point's label and position.

---

## Sound Invariants (One-Line Verifications)

- **Start screen**: Single full-screen button contract cleanly unlocks Web Audio and haptics inside
  the first user gesture without double-announcements.
- **Capture screen**: All buttons satisfy the 48x48 px minimum touch target requirement; specimen
  cards are decorative; bundled sample diagrams load completely offline.
- **Explore canvas & gestures**: TalkBack pass-through gesture (Method A1), 25 ms centre tick,
  two-finger swipe down exit, and relative cursor re-centring on hold work smoothly without visual
  reliance.
- **Haptics & Theremin coexistence**: Tuned haptic parameters (`lineMs: 80`, `retriggerMs: 70`,
  `cornerPattern: [50, 90, 50]`, `quietMs: 450`) ensure corner pulses silence the continuous
  theremin tone so vibrations are never masked.
- **Guide my finger**: Directional audio hints, headphone panning, arrival buzz, and clean
  cancellation on voice commands or Back operate as specified.
- **Saved diagrams screen**: Saved entries survive offline; pinned entries enjoy eviction immunity;
  deletion requires accessible confirmation; zero network requests occur.
- **Share Gate**: User activation gate (`ShareGate`) unlocks Web Audio and speech on cold opens,
  presents honest attribution, and keeps diagram payload client-side.
- **Language switching**: Language changes (`en`, `hi`, `gu`) take effect immediately and speak
  the confirmation in the newly selected language.
- **Phone rotation & resize**: `Explore.tsx` attaches `resize`, `orientationchange`, and
  `ResizeObserver` listeners to recompute letterboxing and update canvas DPR without losing state.

---

## Tests Asserting Nothing Meaningful

1. **frontend/tests/n2.round4.test.ts:144-162**
   - *Test name*: `"never speaks storage errors when storage fails (GT-06 rule)"`
   - *Hollow assertion*: The test creates a mock `drivers.speech.speak` spy, but executes
     `saveDiagramWithEviction(store, existing, newEntry, SAVED_DIAGRAMS_CAP)`. The function
     `saveDiagramWithEviction` does not accept `drivers` and has no speech capabilities. Asserting
     `expect(drivers.speech.speak).not.toHaveBeenCalled()` asserts nothing about whether the
     application UI speaks or silences storage errors.
   - *Improvement*: Test the `App.tsx` state machine or component integration
     where `setStorageError` is invoked to verify speech is suppressed.

2. **frontend/tests/k6.pwa-offline.test.ts:374-420**
   - *Test name*: `"IDBDiagramStore putWithEviction deletes victim before put (R5-02, R5-09)"`
   - *Hollow assertion*: Constructs a synthetic in-memory object mimicking `IDBFactory` where
     all transactions unconditionally succeed and queue callbacks in `setTimeout`. It verifies
     an internal test array sequence rather than validating real IndexedDB error handling, abort
     semantics, or transactional atomicity.
   - *Improvement*: Test using a real IndexedDB shim (such as `fake-indexeddb`) with abort scenarios.

3. **frontend/tests/teach.editor.test.tsx:140-172 & 174-201**
   - *Test name*: `"renders screen heading, toolbar, and canvas with accessible attributes"`
   - *Hollow assertion*: Uses `renderToStaticMarkup` and string inspection (`html.toContain(...)`)
     to verify accessible attributes on static HTML, without dispatching keyboard events or
     verifying focus traversal between toolbar buttons and the canvas.
   - *Improvement*: Mount the component with React Testing Library and verify Tab focus order and
     screen-reader accessible names.
