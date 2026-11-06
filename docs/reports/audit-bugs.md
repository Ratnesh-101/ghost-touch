# Audit D: Bug Hunt in Frontend Flow and Drivers

Audit of the Ghost Touch frontend flow, browser drivers, and screen state machines (`frontend/src/App.tsx`, `frontend/src/flow/*.ts`, `frontend/src/drivers/*.ts`, `frontend/src/screens/Explore.tsx`, `Capture.tsx`, `Start.tsx`, `SavedDiagrams.tsx`, `Correct.tsx`).

This audit evaluates behavior likely to fail on real mobile hardware (specifically Android Chrome with TalkBack screen reader).

---

## 1. Verification Baseline

Commands executed from repo root per audit specification:

### `npm --prefix frontend exec -- tsc -p frontend --noEmit`
- **Result:** Clean (Exit code 0, 0 type errors).

### `npm --prefix frontend test`
- **Result:** Clean (Exit code 0).
- **Summary:** 42 test files passed (42), 473 tests passed (473). Duration: 646 ms.

---

## 2. Findings Summary by Severity

| Severity | Count | Summary of Key Areas |
| :--- | :--- | :--- |
| **High** | 7 | Web Audio stuck tone, mic leak on unmount, missing Back navigation on secondary screens, memory leak from unrevoked photo blobs, TalkBack double speech collision, suspended AudioContext after camera app switch, touch misalignment in Teacher Correct. |
| **Medium** | 7 | Lost focus on screen mount (Correct/Saved), double-tap race on Start/samples, language switch not re-rendering active screens, unhandled promise rejections in Explore Ask, vibration capability misreporting, audio node graph leak, pointer tracking dead-zone. |
| **Low** | 3 | Concurrent IndexedDB eviction race, missing file input cancel event, PDF blob passed directly to image overlay. |
| **Total** | **17** | Code-verified defects. |

---

## 3. Detailed Findings

---

### Finding 1 (HIGH): Stuck Theremin Tone after Earcon Ducking (Web Audio Timeline Race)
- **Location:** `frontend/src/drivers/audio.ts:227-231` (and `frontend/src/drivers/audio.ts:164-175`)
- **One-line description:** `playEarcon` schedules a future WebAudio timeline event to restore the theremin tone, but subsequent `setTone(null)` calls never cancel scheduled values, causing the tone to turn back on and drone indefinitely after finger lift.
- **Concrete failure scenario:**
  1. User explores a curve or bar: continuous theremin tone is playing (`setTone(hz)` sets `this.activeToneHz = hz`).
  2. An earcon cue fires (e.g. voice command feedback, listening cue beep, or landmark chime). `playEarcon` ducks the tone (`gain.setTargetAtTime(0, now)`) and schedules tone restoration at `restoreAt = maxEnd + 0.05` via `this.gain.gain.setTargetAtTime(TONE_GAIN, restoreAt, GAIN_ON_TIME_CONSTANT)`.
  3. While the earcon is playing or before `restoreAt`, the user lifts their finger or moves into empty space (`step` emits `{ kind: 'tone', hz: null }`).
  4. `setTone(null)` executes: sets `this.activeToneHz = null` and sets gain to 0 at `now`.
  5. Crucially, `setTone` does NOT call `cancelScheduledValues()`. When the audio context reaches `restoreAt`, WebAudio executes the queued `setTargetAtTime(TONE_GAIN, restoreAt, GAIN_ON_TIME_CONSTANT)`.
  6. The oscillator gain ramps up to 0.15. The theremin tone drones permanently with no finger on the screen until another tone event overrides it.
- **Minimal suggested fix:**
  In `WebAudioDriver.setTone`, call `this.gain.gain.cancelScheduledValues(now)` before applying any gain transition. In `playEarcon`, ensure that tone restoration is guarded or cancelled if `this.activeToneHz === null`.

---

### Finding 2 (HIGH): Speech Recognition Session Orphaned on Screen Exit (Microphone Leak & Stale State Mutation)
- **Location:** `frontend/src/screens/Explore.tsx:115-142` and `frontend/src/flow/ask.ts:228-236`
- **One-line description:** `Explore.tsx` calls `drivers.speech.listen()` directly instead of through `AskManager.startVoiceAsk`, preventing `askManager.current.abort()` from cancelling the microphone on unmount.
- **Concrete failure scenario:**
  1. User triggers voice ask (via "Ask" button or two-finger long press). `handleVoiceAsk` sets `isBusy(true)` and awaits `drivers.speech.listen(lang)`.
  2. User immediately taps "Back" or uses the Android Back gesture to return to Capture. Explore unmounts.
  3. Explore's unmount cleanup calls `askManager.current.abort()`. Because `startVoiceAsk` was bypassed, `askManager.current.activeSpeech` is `null`, so `cancelListen()` is never called.
  4. The device's microphone remains open and listening in the background.
  5. When speech recognition finishes or times out after 6 seconds, the continuation in `handleVoiceAsk` executes: speaks `t('ask.thinking')` on the Capture screen, sends an HTTP request, mutates state on the unmounted Explore component, and speaks the answer over the Capture UI.
- **Minimal suggested fix:**
  Route voice listening through `askManager.current.startVoiceAsk(deps)`, or in `Explore.tsx` store a reference to the active listen session and call `drivers.speech.cancelListen?.()` in both `handleExit` and the unmount cleanup effect.

---

### Finding 3 (HIGH): Android Back & TalkBack Back Gesture Broken or Trapped on Secondary Screens
- **Location:** `frontend/src/screens/Correct.tsx:51-85` and `frontend/src/screens/SavedDiagrams.tsx:46-65` (also `frontend/src/drivers/navigation.ts:33-42`)
- **One-line description:** Navigation history entries and `popstate` listeners are only wired in `Explore.tsx`; the Android hardware / TalkBack Back gesture on `Correct` and `SavedDiagrams` screens fails to navigate back or exits the PWA.
- **Concrete failure scenario:**
  1. From Explore, user taps "Correct" to enter Teacher Correction mode (`onCorrect`).
  2. Explore unmounts (its `unbindBack()` removes the popstate listener), but `{ screen: 'explore' }` remains in browser history and `explorePushed = true`.
  3. User performs Android Back or TalkBack Back gesture.
  4. The browser pops the history entry, but no component is listening to `popstate`. The screen remains stuck on Teacher Correction.
  5. A second Back press causes the browser to exit the PWA or jump to an unexpected external page.
  6. Similarly, on `SavedDiagrams` (navigated from Capture), pressing Android Back exits the PWA instead of returning to Capture.
- **Minimal suggested fix:**
  Lift navigation history handling to `App.tsx` (the central state machine), or add `pushExploreEntry`/`onBack` history listeners in `Correct.tsx` and `SavedDiagrams.tsx` that trigger `onCancel` / `onBack`.

---

### Finding 4 (HIGH): Raw Photo Object URLs Never Revoked (Memory Leak on Camera Capture)
- **Location:** `frontend/src/screens/Capture.tsx:95-101` and `frontend/src/App.tsx:44, 105`
- **One-line description:** `Capture.tsx` creates Blob URLs via `URL.createObjectURL(file)` for every image/photo and never revokes them, accumulating 10–50 MB blobs in memory until mobile Chrome tab crashes.
- **Concrete failure scenario:**
  1. User takes a 20–50 MP photo using the phone camera (15–30 MB raw file).
  2. `Capture.tsx` creates `photoUrl = URL.createObjectURL(file)` and passes it to `App.tsx`, which stores it in state.
  3. User returns to Capture and takes another photo or opens a sample diagram (`handleScene` sets `photoUrl` to a new URL or `null`).
  4. `URL.revokeObjectURL(oldUrl)` is never called anywhere in the application.
  5. After repeated captures, multiple raw Blobs remain pinned in browser memory. On mobile devices with constrained RAM, Android Chrome abruptly reloads or crashes the tab with an out-of-memory error.
- **Minimal suggested fix:**
  In `App.tsx`, keep a ref to `photoUrl` and call `URL.revokeObjectURL(prevUrl)` whenever `photoUrl` is updated or replaced, and on component unmount.

---

### Finding 5 (HIGH): TalkBack Double Announcement: Simultaneous Speech Synthesis and Focused Canvas Label
- **Location:** `frontend/src/screens/Explore.tsx:443, 697` (and `frontend/src/App.tsx:107`)
- **One-line description:** When entering Explore, `App.tsx` speaks the screen prompt via Web Speech while `Explore.tsx` simultaneously focuses the canvas, causing TalkBack to read the canvas `aria-label` at the same time.
- **Concrete failure scenario:**
  1. A diagram is loaded. `App.tsx` calls `drivers.speech.speak(announced)`: "Triangle. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave."
  2. `Explore.tsx` mounts and executes `canvasRef.current?.focus()`.
  3. TalkBack detects focus on the canvas and immediately speaks its accessible name (`aria-label={canvasAriaLabel(scene)}`): "Triangle. Double-tap and hold, then drag to feel the diagram. You start at the centre."
  4. Web Speech API and TalkBack AccessibilityService speak simultaneously through the phone speaker, producing overlapping voices that drown each other out.
- **Minimal suggested fix:**
  Remove the verbose `aria-label` from `<canvas>` when speech is supported, or mark the canvas `aria-hidden="true"` while relying on `StatusText` for screen reader fallback when speech synthesis is unavailable.

---

### Finding 6 (HIGH): AudioContext Suspended by Camera App Switch Never Resumes (Audio Silence on Android)
- **Location:** `frontend/src/drivers/audio.ts:134-162` and `frontend/src/screens/Explore.tsx:484-587`
- **One-line description:** `drivers.audio.unlock()` is only called on Start screen; when Android Chrome suspends the `AudioContext` during native camera capture, Explore never resumes it on touch, causing total audio silence.
- **Concrete failure scenario:**
  1. User starts app (`drivers.audio.unlock()` initializes the AudioContext).
  2. On Capture screen, user taps "Take photo". Android switches foreground focus to the native camera application.
  3. Chrome transitions the tab to the background, and Android OS suspends the `AudioContext` (`ctx.state === 'suspended'`).
  4. User captures photo and returns to Chrome. The diagram is parsed and Explore opens.
  5. User touches the canvas and drags across polylines and bars. `setTone` and `playEarcon` are invoked.
  6. `setTone` assumes the context is running and does not check or resume suspended contexts.
  7. The user explores the diagram in complete silence (no theremin tone, no earcons).
- **Minimal suggested fix:**
  In `WebAudioDriver.setTone` and `playEarcon`, check `if (this.ctx?.state === 'suspended') { void this.ctx.resume(); }` inside touch event handlers, or call `drivers.audio.unlock()` inside `handlePointerDown` in `Explore.tsx`.

---

### Finding 7 (HIGH): Touch Coordinate Misalignment in Teacher Correct Mode on Mobile Displays
- **Location:** `frontend/src/screens/Correct.tsx:230-268, 417-429` and `frontend/src/styles/correct.css:69-75`
- **One-line description:** `<canvas>` has hardcoded 600×400 buffer dimensions with CSS `object-fit: contain`, causing letterboxing that shifts touch coordinates away from drawn points on mobile screens.
- **Concrete failure scenario:**
  1. Teacher opens Correct mode on a mobile device (e.g. 360 px width viewport, canvas container height 300 px).
  2. CSS `object-fit: contain` scales the 3:2 canvas to 360×240 px and centers it, creating 30 px letterbox bars top and bottom.
  3. Teacher taps a point near the middle of the diagram.
  4. `handlePointerDown` reads `e.clientY - rect.top` relative to the 300 px container bounding box.
  5. `pointerToNorm` divides by `rect.height` (300) without accounting for the 30 px letterbox offset or aspect ratio scaling.
  6. `hitTestCorrect` tests against unshifted coordinates: touch hits miss the target point or select an unintended element, and dragging moves the point off-center from the teacher's finger.
- **Minimal suggested fix:**
  Dynamically size the canvas buffer to match its container layout box using `getBoundingClientRect()` and `window.devicePixelRatio` (as done in `Explore.tsx`), or adjust `px`/`py` in `pointerToNorm` by subtracting letterbox margins.

---

### Finding 8 (MEDIUM): Lost Focus on Mount in Correct and SavedDiagrams Screens
- **Location:** `frontend/src/screens/Correct.tsx:81-85` and `frontend/src/screens/SavedDiagrams.tsx:46-65`
- **One-line description:** Neither `Correct.tsx` nor `SavedDiagrams.tsx` sets initial focus on mount, causing screen reader and keyboard focus to be lost to `document.body`.
- **Concrete failure scenario:**
  1. A TalkBack or keyboard user navigates to Saved Diagrams from Capture.
  2. `SavedDiagrams` mounts with `loading = true`. No element receives focus.
  3. Focus resets to `<body>`.
  4. When diagram list loading completes, focus remains on `<body>`. TalkBack does not announce the top control or list items, leaving the user with no active cursor.
- **Minimal suggested fix:**
  Add a ref to the primary screen heading or the first action button, and call `.focus()` in a `useEffect` on mount.

---

### Finding 9 (MEDIUM): Double-Tap Vulnerability on Sample Diagram Buttons and Start Button
- **Location:** `frontend/src/screens/Capture.tsx:108-123` and `frontend/src/screens/Start.tsx:29-32`
- **One-line description:** `handleSample` in `Capture.tsx` fails to set `busy = true` before fetching, and `Start.tsx` lacks click debounce, allowing rapid double-taps to trigger duplicate fetches and state transitions.
- **Concrete failure scenario:**
  1. User double-taps "Sample: triangle".
  2. `handleSample` checks `if (busy)`. Because `busy` is false, both taps pass the guard.
  3. Two concurrent `loadSample('triangle')` requests run.
  4. Both succeed, playing the success earcon twice and invoking `onScene` twice in rapid succession, causing screen flickering and overlapping speech announcements.
- **Minimal suggested fix:**
  In `Capture.tsx`, call `setBusy(true)` synchronously at the start of `handleSample`. In `Start.tsx`, disable the button or guard `begin` with a ref after the first tap.

---

### Finding 10 (MEDIUM): Language Selector Changes Do Not Update Active Screen Labels
- **Location:** `frontend/src/screens/Capture.tsx:48-212`, `frontend/src/screens/Explore.tsx:58-770`, `frontend/src/App.tsx:40-201`
- **One-line description:** `subscribeLang` is only subscribed to inside `LanguageSelector.tsx`; active screens do not subscribe to language changes, leaving all buttons and status labels in the previous language.
- **Concrete failure scenario:**
  1. User is on Capture screen with English language active.
  2. User selects "हिन्दी" (Hindi) in the language bar.
  3. The language driver speaks confirmation in Hindi, and `LanguageSelector` updates.
  4. `Capture.tsx` does not re-render: "Take photo", "Choose image", "Saved diagrams", and sample names remain in English.
  5. Sighted teachers and TalkBack users continue to see and hear English control labels until a screen transition occurs.
- **Minimal suggested fix:**
  Subscribe to `subscribeLang` in `App.tsx` (via `useSyncExternalStore(subscribeLang, getLang)`), ensuring all screens and child components re-render with updated `t()` strings upon language changes.

---

### Finding 11 (MEDIUM): Unhandled Promise Rejections in Explore Screen Ask Flow
- **Location:** `frontend/src/screens/Explore.tsx:186-207, 220-235`
- **One-line description:** `await askManager.current.submitTextAsk(...)` in `handleVoiceAsk` and `handleTextSubmit` is not wrapped in `try/catch`, causing unhandled promise rejections and permanently locking the UI in a disabled `isBusy` state upon error.
- **Concrete failure scenario:**
  1. User submits a voice or text question.
  2. An unexpected exception occurs during request execution (e.g. network failure or DOM serialization error not caught by internal driver).
  3. The unhandled rejection escapes.
  4. `setIsBusy(false)` is never called.
  5. The Ask button and other inputs remain permanently disabled (`isBusy === true`), with no error message spoken, freezing the screen.
- **Minimal suggested fix:**
  Wrap the `await submitTextAsk` call in `try/catch/finally` and ensure `setIsBusy(false)` is always executed in `finally`.

---

### Finding 12 (MEDIUM): Vibration Capability Misreported on Devices Where `navigator.vibrate` Returns False
- **Location:** `frontend/src/flow/start.ts:14-16, 29-34` and `frontend/src/drivers/haptics.ts:33-35, 41-55`
- **One-line description:** `capturePrompt` checks `drivers.haptics.supported` (method existence) rather than whether vibration succeeded (`drivers.haptics.lastResult`), failing to warn users on devices where `navigator.vibrate()` returns `false`.
- **Concrete failure scenario:**
  1. User runs the app on an Android tablet or device where vibration is disabled in system settings.
  2. User taps Start. `handleStartTap` executes `drivers.haptics.vibrate(50)`, which returns `false` (`lastResult = false`).
  3. `capturePrompt(drivers.haptics.supported)` evaluates `supported` as `true` because `navigator.vibrate` exists on `window.navigator`.
  4. The required Requirement 1.3 warning ("Vibration is not supported on this device. Audio-only mode.") is omitted.
  5. The user enters Explore expecting haptic feedback, feels nothing, and is left without explanation.
- **Minimal suggested fix:**
  In `handleStartTap` and `App.tsx`, check `drivers.haptics.lastResult !== false` (or pass the return value of `vibrate()`) to determine whether haptics are genuinely functional.

---

### Finding 13 (MEDIUM): Web Audio GainNode Graph Leak (Missing Node Disconnection)
- **Location:** `frontend/src/drivers/audio.ts:182-192, 211-224`
- **One-line description:** `beep()` and `playEarcon()` connect newly allocated `GainNode` instances to `ctx.destination` on every cue without disconnecting them on completion, leaking nodes in Web Audio's graph.
- **Concrete failure scenario:**
  1. User spends several minutes exploring diagrams. Earcons and progress beeps fire dozens of times.
  2. Each cue instantiates an `OscillatorNode` and `GainNode`, connecting the gain to `ctx.destination`.
  3. While `osc.stop()` stops oscillation, the `GainNode` remains connected to `ctx.destination` and is kept alive in browser internal audio graphs.
- **Minimal suggested fix:**
  In `beep` and `playEarcon`, add `osc.onended = () => { osc.disconnect(); gain.disconnect(); }` to release nodes immediately upon completion.

---

### Finding 14 (MEDIUM): Secondary Pointer Dead-Zone After Primary Finger Lift
- **Location:** `frontend/src/screens/Explore.tsx:619-623, 650-662`
- **One-line description:** When two fingers touch the canvas and the primary finger lifts, `primaryPointerId.current` is set to `null` while the second finger remains active; `handlePointerMove` ignores non-primary pointers, making the remaining finger unresponsive.
- **Concrete failure scenario:**
  1. User explores canvas with thumb (primary pointer).
  2. User places index finger on the canvas.
  3. User lifts thumb. `handlePointerLift` sets `primaryPointerId.current = null`.
  4. User continues dragging index finger.
  5. `handlePointerMove` checks `if (e.pointerId !== primaryPointerId.current)` -> returns immediately because `e.pointerId !== null`.
  6. The active finger on the screen produces no haptics, no tone, and no cursor update until the user lifts all fingers and touches down again.
- **Minimal suggested fix:**
  When `primaryPointerId` is lifted and `activePointers.current.size > 0`, promote the oldest remaining pointer to `primaryPointerId.current` and update engine state accordingly.

---

### Finding 15 (LOW): Concurrent IndexedDB Eviction Race in `App.tsx`
- **Location:** `frontend/src/App.tsx:61-94`
- **One-line description:** `saveDiagram` executes `list()`, `chooseEviction()`, and `put()` across separate unisolated IndexedDB transactions, allowing rapid successive saves to race and exceed `SAVED_DIAGRAMS_CAP`.
- **Concrete failure scenario:**
  1. Two diagrams are saved in rapid succession.
  2. Both calls to `saveDiagram` read the same snapshot of existing entries from `diagramStore.list()`.
  3. Neither observes the other's pending insert, causing both to insert without evicting, exceeding the 20-diagram cap.
- **Minimal suggested fix:**
  Queue `saveDiagram` calls with an in-memory promise chain in `App.tsx` to serialize storage operations.

---

### Finding 16 (LOW): Missing Cancel Event Handler on Camera File Input
- **Location:** `frontend/src/screens/Capture.tsx:197-211`
- **One-line description:** File inputs have no `oncancel` listener; dismissing the system camera or file picker produces no event, leaving blind users with silence and no confirmation that capture was aborted.
- **Concrete failure scenario:**
  1. Blind user activates "Take photo". Android camera opens.
  2. User presses Android Back to cancel camera.
  3. The file input's `onChange` does not fire. No sound or speech is emitted.
  4. The user is left in silence with no feedback confirming they are back on the Capture screen.
- **Minimal suggested fix:**
  Add `onCancel={() => say(t('capture.prompt'))}` to the file inputs to restore spoken context when the picker is dismissed.

---

### Finding 17 (LOW): Raw PDF Blob Passed to Teacher Correct Mode (Fails to Load Photo Overlay)
- **Location:** `frontend/src/screens/Capture.tsx:96-101` and `frontend/src/screens/Correct.tsx:93-102`
- **One-line description:** For PDF uploads, `Capture.tsx` creates an object URL from the raw PDF file blob; in `Correct.tsx`, `new Image().src = photoUrl` fails to decode PDFs, leaving Teacher Correct mode with no background image overlay.
- **Concrete failure scenario:**
  1. User uploads a PDF diagram. The first page is rendered for scene analysis.
  2. `Capture.tsx` creates `photoUrl` from the original `application/pdf` file blob.
  3. Teacher enters Correct mode. `img.src = photoUrl` fails with `onerror` because `HTMLImageElement` cannot render PDF files.
  4. Teacher is presented with a blank canvas and cannot visually compare the diagram against the source PDF.
- **Minimal suggested fix:**
  In `Capture.tsx`, store the rendered image JPEG blob (from `renderFirstPage`) rather than the raw PDF file blob as `photoUrl`.

---

## 4. Five Findings the Owner Should Fix First

These five defects represent the highest risk of immediate failure on a real phone:

1. **Finding 1 (`frontend/src/drivers/audio.ts:227-231`): Stuck Theremin Tone after Earcon Ducking**
   - *Why fix first:* Violates the fundamental audio-haptic contract. Any earcon or cue tone played during exploration causes the continuous tone to turn back on and drone indefinitely after the finger lifts. Fixed with `cancelScheduledValues()`.
2. **Finding 6 (`frontend/src/drivers/audio.ts:134-162` / `frontend/src/screens/Explore.tsx:484-587`): AudioContext Remains Suspended After Camera Switch**
   - *Why fix first:* Guarantees complete silence on real phones. Launching the Android camera app suspends Chrome's `AudioContext`. Without resuming on touch, all subsequent exploration is silent. Fixed by calling `resume()` on touch.
3. **Finding 5 (`frontend/src/screens/Explore.tsx:443, 697`): TalkBack Double Announcement on Explore Canvas**
   - *Why fix first:* Major accessibility failure. TalkBack's focused canvas announcement and Web Speech API instructions speak simultaneously over each other on entrance to Explore. Fixed by removing redundant `aria-label` on canvas.
4. **Finding 3 (`frontend/src/screens/Correct.tsx:51-85` / `frontend/src/screens/SavedDiagrams.tsx:46-65`): Android Back & TalkBack Gesture Trapped on Secondary Screens**
   - *Why fix first:* Standard Android navigation fails on Correct and Saved Diagrams. Users pressing the hardware Back button or TalkBack back gesture either get stuck or crash out of the PWA. Fixed by listening to `popstate` on all sub-screens.
5. **Finding 4 (`frontend/src/screens/Capture.tsx:95-101` / `frontend/src/App.tsx:44`): Memory Leak via Unrevoked Photo Object URLs**
   - *Why fix first:* High-resolution phone photos (15–30 MB) accumulate in memory across captures until mobile Chrome runs out of memory and crashes the tab. Fixed with `URL.revokeObjectURL()`.
