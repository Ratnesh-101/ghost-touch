# Audit Report: a1-guide-runtime

- **Lane:** a1-guide-runtime
- **Auditor:** Antigravity (agy, reviewed by Claude)
- **Status:** Complete
- **Date:** 2026-11-06
- **Scope:** Runtime bugs in "Guide my finger" on a real phone (`frontend/src/guide/**`, `frontend/src/flow/guide.ts`, guide sections of `frontend/src/screens/Explore.tsx`, `frontend/src/drivers/audio.ts`, `frontend/src/flow/commands.ts`, `frontend/src/flow/ask.ts`).

---

## Executive Summary

A comprehensive code and failure-path audit of the "Guide my finger" runtime was conducted across the gesture pipeline, audio oscillators, Web Speech synthesis lifecycle, history stack, coordinate letterboxing, and multilingual voice parsing.

The core geometry helpers and feature gating are mathematically and structurally sound. However, 14 concrete runtime defects were identified under real-device conditions (Android touchscreens, TalkBack gestures, Chrome speech synthesis, and Web Audio lifecycle):
- **5 High-severity issues:** Completely muted Web Audio on direct student share opens; clashing dual oscillators from un-silenced theremin tones; rapid speech cancellation loops dropping spoken guidance and answers; browser history corruption on Android system Back gesture; and violent speech stutter/freezing caused by unthrottled direction-change hint spam.
- **5 Medium-severity issues:** Background tab / lockscreen audio leaks; stale language closure selecting English voices for Hindi/Gujarati text; stale target retention across scene changes; and mis-parsing of common Hindi/Gujarati voice commands ("स्टॉप", Devanagari/Gujarati letter names).
- **4 Low-severity issues:** Synchronous `localStorage` I/O during 60–120 Hz render loops; edge arrival unreachable due to touch bezel dead zones; multi-touch premature tone shutoff; and motionless finger silence.

---

## Sound Areas Checked

- **Target Resolution (`frontend/src/guide/geometry.ts`):** `resolveTarget` handles points, segment midpoints, polyline centroids, and bar geometric centres with strict bounds validation `[0, 1]` and NaN/Infinity guards.
- **Ask Target Parsing (`frontend/src/api/ask.ts`):** `parseTarget` and `parseAskResponse` are fault-tolerant, dropping out-of-range coordinates or missing element IDs without throwing exceptions.
- **Geometry Transforms (`frontend/src/guide/geometry.ts`):** `pitchFor`, `panFor`, and `vectorTo` strictly constrain frequencies to `[pitchLoHz, pitchHiHz]` and stereo panning to `[-1, 1]`.
- **Pulse Interval Throttling (`frontend/src/guide/machine.ts`):** Pulses are throttled monotonically by `pulseIntervalMs` based on distance, strictly respecting `nearMs` and `farMs`.
- **Feature Flag & Setting Gating (`frontend/src/config/features.ts`):** Guidance is strictly gated behind the conjunction of build-time `VITE_FEATURE_GUIDE === '1'` and the runtime settings toggle.
- **Teacher Verification & Honesty Copy:** Verified banner copy and Teacher Editor honesty requirements comply strictly with the contract.

---

## Findings: CONFIRMED

### High Severity

#### G-RUN-01 · high · `frontend/src/App.tsx:172` & `frontend/src/screens/Explore.tsx:735`
- **What is wrong:** WebAudio is completely uninitialized and permanently muted when opening a shared diagram link (`/#s=...`). `WebAudioDriver.unlock()` is only invoked in `Start.handleStartTap`. When a student opens a shared link, `App.tsx` routes directly to `Explore`, completely bypassing `Start`. `Explore.tsx` never calls `drivers.audio.unlock()` on mount or on first user gesture. Consequently, `audio.ctx` remains `undefined` forever, causing all `setTone`, `setGuideTone`, `beep`, and `playEarcon` calls to silently no-op (`if (this.ctx === undefined) return;`).
- **Concrete failure scenario:**
  1. Student taps a teacher-shared link (`http://localhost:5173/#s=eyJ...`).
  2. Diagram loads directly into Explore screen.
  3. Student taps the "Guide me" button or explores the diagram with touch gestures.
  4. *Observed result:* Complete silence. No guide tone, no theremin tone, and no success earcon on arrival, because Web Audio context was never unlocked.
- **Proposed minimal fix:**
  In `frontend/src/screens/Explore.tsx`, inside `handlePointerDown`, call `drivers.audio.unlock()`. Alternatively, in `drivers/audio.ts`, allow `setGuideTone` and `setTone` to call `this.unlock()` lazily when executed inside a user gesture.
- **Proposed test:**
```ts
it('unlocks WebAudio context on first touch in Explore when opened from share link', () => {
  const audio = new WebAudioDriver();
  expect(audio.state).toBe('locked');
  const drivers = { ...createMockDrivers(), audio };
  const { container } = render(<Explore scene={testScene} announced="test" drivers={drivers} onBack={vi.fn()} />);
  const canvas = container.querySelector('canvas')!;
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
  expect(audio.state).not.toBe('locked');
});
```

---

#### G-RUN-02 · high · `frontend/src/screens/Explore.tsx:243, 355` & `frontend/src/drivers/audio.ts:200`
- **What is wrong:** Continuous theremin tone is never silenced when Guidance starts, resulting in two conflicting audio oscillators playing simultaneously. In normal exploration, touching an element sets the theremin tone (`drivers.audio.setTone(hz)`). When guidance starts via voice command or the "Guide me" button, `Explore.tsx` switches gesture routing to `GuideController`, but fails to silence the active theremin oscillator. When the user moves their finger to follow guidance, `setGuideTone(hz, pan)` activates the second oscillator. Both oscillators sound at the same time, violating the contract ("While guiding the theremin is suppressed").
- **Concrete failure scenario:**
  1. User explores canvas; finger is on a line element. Theremin tone sounds at 440 Hz.
  2. User speaks "guide to point B" or taps the "Guide me" button.
  3. Guidance begins; user moves finger across canvas.
  4. Guide tone sounds at 300 Hz.
  5. *Observed result:* The 440 Hz theremin tone continues playing concurrently with the 300 Hz guide tone, creating an uncoordinated dual-tone cacophony.
- **Proposed minimal fix:**
  In `frontend/src/screens/Explore.tsx`, whenever guidance starts (`handleStartGuideFromOffer` and `executeExploreCommand` with `guideTarget`), explicitly call `drivers.audio.setTone(null)` and reset `engineState.current = initialState()`.
- **Proposed test:**
```ts
it('silences active theremin tone when guidance starts', () => {
  const drivers = createMockDrivers();
  drivers.audio.setTone(440);
  const gc = new GuideController({ drivers });
  gc.start({ x: 0.5, y: 0.5, label: 'Target' });
  // Verify theremin is silenced
  expect(drivers.setToneMock).toHaveBeenCalledWith(null);
});
```

---

#### G-RUN-03 · high · `frontend/src/screens/Explore.tsx:378-384, 420-430, 516-527` & `frontend/src/flow/guide.ts:63-75`
- **What is wrong:** Back-to-back `speech.speak` calls cancel and discard each other. The speech driver strictly calls `synth.cancel()` on every `speak()` call. In multiple locations in `Explore.tsx`:
  1. On voice command `guide_to`: `guideController.start` invokes `speech.speak(t('guide.start'))`, and line 379 immediately invokes `speech.speak(result.speech)` with the identical line, cancelling the first utterance in 0 ms.
  2. On voice command `stop`: `guideController.stop` speaks `t('guide.stopped')`, and line 379 immediately speaks it again.
  3. On Ask response offering guide: `submitTextAsk` executes `deps.say(response.answer)`, and immediately lines 425/522 execute `speech.speak(fullMessage)` (`answer + ' ' + offerText`), cutting off the first utterance before speech synthesis emits sound.
  4. In `GuideController.start`, if already guiding, `this.stop('user')` speaks "Guide stopped", immediately cancelled by `start` speaking "Guiding to...".
- **Concrete failure scenario:**
  1. User asks question: "What is this triangle?".
  2. Backend responds: `{ answer: "It is an equilateral triangle.", target: { kind: 'element', elementId: 's1' } }`.
  3. `deps.say` starts speaking "It is an equilateral triangle."
  4. Microseconds later, `Explore.tsx` calls `speech.speak("It is an equilateral triangle. Tap Guide me to trace it.")`.
  5. *Observed result:* On Android Chrome, the rapid cancel/speak cycle drops speech completely or produces an audible glitch/pop.
- **Proposed minimal fix:**
  - In `frontend/src/screens/Explore.tsx`, do not call `drivers.speech.speak(result.speech)` in line 379 if `result.guideTarget` or `result.stopGuide` was executed, as `GuideController` already handles speech.
  - In `submitTextAsk`, pass the combined message to `deps.say` rather than executing two separate speech commands.
  - In `GuideController.start`, suppress the `stopped` speech effect when immediately transitioning to a new target.
- **Proposed test:**
```ts
it('does not dispatch redundant back-to-back speech calls when starting guidance via voice', () => {
  const drivers = createMockDrivers();
  const cmd = parseExploreCommand('find hypotenuse', true);
  const result = executeExploreCommand(cmd, { ...context, isGuideActive: true });
  // Simulating Explore handler
  if (result.guideTarget) {
    guideController.start(result.guideTarget);
  }
  // Assert speech was only invoked once
  expect(drivers.speakMock).toHaveBeenCalledTimes(1);
});
```

---

#### G-RUN-04 · high · `frontend/src/screens/Explore.tsx:759-772` & `frontend/src/drivers/navigation.ts:86-97`
- **What is wrong:** Browser history stack becomes corrupt when using Android system Back or TalkBack Back gesture to cancel guidance. When the user triggers system Back, the browser pops the history entry *before* dispatching the `popstate` event. In `navigation.ts`, `onBack` sets `explorePushed = false`. `subscribeBack` in `Explore.tsx` intercepts the event, calls `guideController.stop('back')`, and returns without navigating away from Explore. Because the history entry was already popped from `window.history`, the URL/history stack is now at `{ screen: 'capture' }` while the user is still on Explore. A subsequent Back tap exits to the screen *prior* to Capture or closes the browser tab.
- **Concrete failure scenario:**
  1. User navigates from Capture to Explore. Browser history has `[{ screen: 'capture' }, { screen: 'explore' }]`.
  2. Guidance starts.
  3. User presses Android hardware Back button to cancel guidance.
  4. Browser pops history to `{ screen: 'capture' }`.
  5. `subscribeBack` intercepts the popstate, stops guidance, and returns. User stays on Explore screen.
  6. User now presses Back button to exit Explore to Capture.
  7. *Observed result:* Instead of returning to Capture, the browser pops history again, exiting the web app or jumping back two screens.
- **Proposed minimal fix:**
  In `Explore.tsx`, when `subscribeBack` cancels guidance, re-push the explore history entry via `pushExploreEntry()` to replenish the popped entry.
- **Proposed test:**
```ts
it('restores explore history entry when system back cancels guidance', () => {
  const pushSpy = vi.spyOn(nav, 'pushExploreEntry');
  // simulate popstate while guiding
  guideController.start(target);
  fireEvent(window, new PopStateEvent('popstate', { state: null }));
  expect(guideController.isGuiding()).toBe(false);
  expect(pushSpy).toHaveBeenCalled();
});
```

---

#### G-RUN-05 · high · `frontend/src/guide/machine.ts:191-207`
- **What is wrong:** Complete absence of time throttling and angular hysteresis on direction changes causes intense Hint Spam. In `guideStep`, `directionChanged = hint !== s.lastHint`. While repeating an identical hint is throttled by `cfg.hintEveryMs (2500ms)`, changing direction has zero minimum interval. When a user moves their finger along the 22.5° boundary between two compass sectors (e.g. between 'down' and 'down-right'), physical finger tremor alternates across the boundary on every `pointermove` event (every 8–16 ms). Each event issues a `{ type: 'speak', key: 'guide.hint.<hint>' }` effect.
- **Concrete failure scenario:**
  1. Target is at (0.5, 0.5). Finger moves near (0.7, 0.6) along the 22.5° sector ray.
  2. Event 1 (t=0ms): angle is 22.4° -> hint 'right'. Speaks "Move right".
  3. Event 2 (t=16ms): angle is 22.6° -> hint 'down-right'. Speaks "Move down-right".
  4. Event 3 (t=32ms): angle is 22.4° -> hint 'right'. Speaks "Move right".
  5. *Observed result:* Speech synthesis receives dozens of cancel and speak requests per second, resulting in machine-gun stuttering ("M-M-M-M-M") or total speech engine lockup on Android.
- **Proposed minimal fix:**
  Enforce a minimum direction-change cooldown (e.g., `MIN_HINT_INTERVAL_MS = 600ms`) or require 5° angular hysteresis before emitting a new direction hint.
- **Proposed test:**
```ts
it('throttles rapid direction changes across sector boundaries to prevent speech spam', () => {
  let s = initialGuideState();
  const res = guideStep(s, { type: 'start', target: { x: 0.5, y: 0.5, label: 'T' }, now: 0 });
  s = res.state;
  // Move 1: Right
  const step1 = guideStep(s, { type: 'move', finger: { x: 0.7, y: 0.58 }, now: 10 });
  s = step1.state;
  // Move 2: Down-right 15ms later
  const step2 = guideStep(s, { type: 'move', finger: { x: 0.7, y: 0.59 }, now: 25 });
  // Verify move 2 does not emit an immediate second speak effect
  const speakEffects = step2.effects.filter((e) => e.type === 'speak');
  expect(speakEffects.length).toBe(0);
});
```

---

### Medium Severity

#### G-RUN-06 · med · `frontend/src/screens/Explore.tsx:735-809` & `frontend/src/drivers/audio.ts:428-434`
- **What is wrong:** Background tab, incoming phone call, or screen lock leaves the guide tone playing and ticker running. Neither `Explore.tsx` nor `WebAudioDriver` silences guide tone audio on `document.visibilityState === 'hidden'`. The 250ms interval ticker continues running in the background until the 20s timeout fires, attempting to speak "Guide stopped" while the tab is hidden.
- **Concrete failure scenario:**
  1. User starts guidance to Point A; guide tone is actively sounding.
  2. Phone receives an incoming call or user presses power button to lock screen.
  3. `visibilitychange` fires with `document.hidden = true`.
  4. *Observed result:* Guide oscillator continues sounding in the background, and 20s later TTS announces "Guide stopped".
- **Proposed minimal fix:**
  In `Explore.tsx`, add a `visibilitychange` event listener. When `document.hidden` becomes true, call `guideController.current?.stop('user')` or silence `setGuideTone(null)`.
- **Proposed test:**
```ts
it('silences guide tone when document becomes hidden', () => {
  const drivers = createMockDrivers();
  const gc = new GuideController({ drivers });
  gc.start(testTarget);
  // simulate background
  fireEvent(document, new Event('visibilitychange'));
  expect(drivers.setGuideToneMock).toHaveBeenCalledWith(null);
});
```

---

#### G-RUN-07 · med · `frontend/src/screens/Explore.tsx:738-757`
- **What is wrong:** Stale language closure in Explore mount effect causes GuideController to speak with wrong voice/language. In `Explore.tsx`, `guideController` is instantiated once inside `useEffect(..., [])` with `lang: LANG_BCP47[getLang()] ?? 'en-IN'`. If the user opens Settings and changes language to Hindi or Gujarati, `Explore` re-renders, but `guideController.deps.lang` is never updated. Subsequent hints pass `lang: 'en-IN'` to `speech.speak(t(key), lang)`. The speech driver receives Hindi/Gujarati text with an English language tag, selecting an English system voice that mispronounces or refuses to read the text.
- **Concrete failure scenario:**
  1. App starts in English. Explore mounts. GuideController created with `lang: 'en-IN'`.
  2. User opens Settings sheet and switches language to Hindi (`hi`).
  3. User starts guidance.
  4. `guideStep` emits `guide.hint.up`, translated to `"ऊपर जाएं"`.
  5. *Observed result:* `speech.speak("ऊपर जाएं", "en-IN")` is invoked. English voice attempts to speak Hindi phonemes, producing garbled speech.
- **Proposed minimal fix:**
  In `Explore.tsx`, add an effect updating `guideController.current?.setDeps({ lang: LANG_BCP47[currentLang] })` whenever language changes.
- **Proposed test:**
```ts
it('updates GuideController language when user switches language in settings', () => {
  const gc = guideController.current!;
  setLang('hi');
  expect(gc.getDeps().lang).toBe('hi-IN');
});
```

---

#### G-RUN-08 · med · `frontend/src/screens/Explore.tsx:201-209, 238-250`
- **What is wrong:** Scene change while guiding or with "Guide me" offer active retains stale target coordinates. When the `scene` prop updates (e.g. from Teacher edit, student share route, or next diagram):
  1. Active guidance is not stopped; the controller continues guiding to the coordinates of the old diagram.
  2. `offeredTarget` from a prior Ask answer is not cleared. Tapping "Guide me" attempts to resolve the old target against the new scene, either guiding to an unrelated element with the same ID or silently failing.
- **Concrete failure scenario:**
  1. User asks question on Triangle ABC; Ask button offers "Guide me" to vertex `p3`.
  2. User opens a different diagram (e.g. Bar Chart) where `p3` is a bar or missing.
  3. User taps "Guide me".
  4. *Observed result:* Finger is guided to a completely unrelated bar instead of vertex C.
- **Proposed minimal fix:**
  In `Explore.tsx`, in the `useEffect` listening to `[scene]`, cancel active guidance (`guideController.current?.stop('user')`) and clear `offeredTarget` (`setOfferedTarget(null)`).
- **Proposed test:**
```ts
it('clears offered target and cancels guidance when scene prop changes', () => {
  const { rerender } = render(<Explore scene={sceneA} ... />);
  // simulate offered target
  rerender(<Explore scene={sceneB} ... />);
  expect(screen.queryByTestId('explore-guide-me')).toBeNull();
});
```

---

#### G-RUN-09 · med · `frontend/src/flow/commands.ts:130-150`
- **What is wrong:** Common transliterated voice commands in Hindi and Gujarati ("स्टॉप" / "સ્ટોપ") mis-parse and are sent to the AI backend. Indian users speaking Hindi or Gujarati commonly say the English loanword "stop", which Web Speech Recognition `hi-IN` and `gu-IN` transcribes as `"स्टॉप"` or `"સ્ટોપ"`. In `parseExploreCommand`, only native terms (`"रुकें"`, `"रोको"`, `"ઊભા રહો"`) are recognized. Transcriptions `"स्टॉप"` and `"સ્ટોપ"` return `unknown`, causing `Explore.tsx` to submit them as questions to the backend LLM while guiding.
- **Concrete failure scenario:**
  1. Language is Hindi. Guidance is active.
  2. User taps voice ask and says "stop" (transcribed as `"स्टॉप"`).
  3. `parseExploreCommand("स्टॉप", true)` returns `{ type: 'unknown' }`.
  4. *Observed result:* App does not stop guidance; instead, it speaks "Thinking..." and submits `"स्टॉप"` to the Ask API.
- **Proposed minimal fix:**
  Add `"स्टॉप"`, `"स्टॉप करो"`, `"स्टॉप गाइड"`, `"સ્ટોપ"`, `"સ્ટોપ કરો"` to the stop command list in `parseExploreCommand`.
- **Proposed test:**
```ts
it('parses transliterated Hindi and Gujarati stop commands correctly', () => {
  expect(parseExploreCommand('स्टॉप', true).type).toBe('stop');
  expect(parseExploreCommand('સ્ટોપ', true).type).toBe('stop');
});
```

---

#### G-RUN-10 · med · `frontend/src/flow/commands.ts:394-451`
- **What is wrong:** Hindi/Gujarati letter names for vertices ("ए", "बी", "સી") fail to match Latin vertex labels in `findElementByLabelOrId`. STEM diagrams universally label vertices with Latin characters (`A`, `B`, `C`). When a Hindi or Gujarati student speaks "बिंदु ए पर ले चलो" (take me to point A), `extractGuideTargetLabel` extracts `"ए"`. `findElementByLabelOrId` compares `p.label.toLowerCase() === "ए"`, which fails (`"a" !== "ए"`). The vertex is reported missing (`guide.notFound`).
- **Concrete failure scenario:**
  1. Triangle diagram has vertices A, B, C.
  2. Student says "बिंदु ए पर ले चलो" (transcribed as `"बिंदु ए पर ले चलो"`).
  3. Target label is extracted as `"ए"`.
  4. *Observed result:* Speech synthesis says "Cannot find ए in this diagram."
- **Proposed minimal fix:**
  In `findElementByLabelOrId`, map Devanagari and Gujarati phonetic vowels/consonants (`ए`/`એ` -> `a`, `बी`/`બી` -> `b`, `सी`/`સી` -> `c`, `डी`/`ડી` -> `d`) to Latin equivalents.
- **Proposed test:**
```ts
it('resolves Hindi and Gujarati phonetic letter names to Latin vertex labels', () => {
  const match = findElementByLabelOrId(triangleScene, 'ए');
  expect(match?.id).toBe('p1'); // Point A
});
```

---

### Low Severity

#### G-RUN-11 · low · `frontend/src/screens/Explore.tsx:1179` & `frontend/src/config/features.ts:35`
- **What is wrong:** Synchronous `localStorage` I/O on every render frame when `offeredTarget` is present. Line 1179 evaluates `{offeredTarget && isGuideActive() && (`. The default parameter of `isGuideActive()` calls `getStoredGuideSetting()`, which invokes `safeGet(STORAGE_KEY_GUIDE)`. During touch dragging (60–120 pointer events/sec), every render issues a synchronous `localStorage.getItem` call, adding unnecessary disk/storage latency to touch exploration.
- **Concrete failure scenario:**
  1. Ask response offers guidance. `offeredTarget` is non-null.
  2. User drags finger across canvas at 120 Hz.
  3. *Observed result:* `localStorage.getItem` executes 120 times per second on the main thread.
- **Proposed minimal fix:**
  In `Explore.tsx`, read `isGuideActive` once on mount or cache it in state rather than querying `localStorage` inside the JSX render path.
- **Proposed test:**
```ts
it('does not query localStorage on every Explore render', () => {
  const spy = vi.spyOn(Storage.prototype, 'getItem');
  render(<Explore ... />);
  expect(spy).toHaveBeenCalledTimes(1); // not on every re-render
});
```

---

#### G-RUN-12 · low · `frontend/src/guide/geometry.ts:356-360`
- **What is wrong:** Arrival detection is physically unreachable for targets on the extreme screen edge on phones with bezel touch rejection. `hasArrived` requires distance `dist <= 0.05` (18 px on a 360 px viewport). When a vertex lies at `x = 0.0` or `x = 1.0`, capacitive touchscreen digitizers and Android palm-rejection margins discard finger centroids within 15–20 px of the bezel or trigger the system Back-swipe gesture.
- **Concrete failure scenario:**
  1. Target is at `(0.0, 0.5)`.
  2. Guide directs "Move left".
  3. User presses finger as close to the left glass edge as possible (`x ≈ 22 px`, `norm.x ≈ 0.061`).
  4. *Observed result:* `dist = 0.061 > 0.05`. Guide never detects arrival. User slides further left and triggers the Android system Back navigation gesture.
- **Proposed minimal fix:**
  In `hasArrived`, for targets located on screen boundaries (`x <= 0.02 || x >= 0.98`), slightly expand the effective arrival radius or test clamped distance.
- **Proposed test:**
```ts
it('detects arrival for boundary vertices when finger reaches touch margin', () => {
  const target = { x: 0.0, y: 0.5, label: 'Edge' };
  expect(hasArrived(0.06, { ...DEFAULT_GUIDE, arriveRadius: 0.05 })).toBe(false); // standard
  // With edge tolerance:
  expect(hasArrivedEdge(0.06, target)).toBe(true);
});
```

---

#### G-RUN-13 · low · `frontend/src/screens/Explore.tsx:1010-1018`
- **What is wrong:** Lifting a secondary finger during multi-touch guidance turns off the guide tone while the primary finger is still touching. In `handlePointerLift`, if `isPrimaryLift` is true and a surviving pointer exists (`promotedPointerId !== null`), `guideController.lift()` is executed anyway, emitting `toneOff`. The guide tone silences even though a finger remains on the canvas.
- **Concrete failure scenario:**
  1. User is guiding with index finger.
  2. User accidentally touches thumb to screen; index finger lifts.
  3. `guideController.lift()` runs.
  4. *Observed result:* Guide tone shuts off while thumb is still touching canvas.
- **Proposed minimal fix:**
  In `handlePointerLift`, only call `guideController.current.lift()` if `promotedPointerId === null`. If a surviving pointer exists, feed its coordinates immediately into `guideController.current.move()`.
- **Proposed test:**
```ts
it('maintains guide tone when lifting one finger if another finger remains active', () => {
  // dispatch two pointerdowns, then one pointerup
  // assert setGuideTone(null) was not called
});
```

---

#### G-RUN-14 · low · `frontend/src/guide/machine.ts:131-147` & `frontend/src/flow/guide.ts:125-140`
- **What is wrong:** A stationary finger receives zero pulses and zero repeated direction hints. When a finger rests motionless on the touchscreen, mobile operating systems emit no `pointermove` events. The 250ms interval ticker in `GuideController` feeds `{ type: 'tick', now }` to `guideStep`, but `guideStep` only checks `elapsed >= timeoutMs`. It does not emit pulses or repeat direction hints.
- **Concrete failure scenario:**
  1. User touches screen to guide. A hint and initial pulse fire.
  2. User holds finger completely still for 5 seconds to listen.
  3. *Observed result:* Zero pulses and zero spoken hints occur during the 5-second pause, giving the false impression that guidance has died. At 20s, it abruptly announces "Guide stopped".
- **Proposed minimal fix:**
  In `GuideController`, cache `lastFingerPoint`. On each ticker interval, if finger is held down and `hintEveryMs` has elapsed, feed a move/hint update.
- **Proposed test:**
```ts
it('repeats direction hint on tick when finger is stationary past hintEveryMs', () => {
  // test stationary finger ticker feedback
});
```

---

## Top 5 to Fix First

1. **G-RUN-01 (AudioContext Unlocked on Share Route):** Critical blocker for Student Open. Without `unlock()`, all WebAudio (guide tone, theremin, and earcons) is completely dead when opening diagrams via shared links.
2. **G-RUN-02 (Theremin Tone Suppression During Guidance):** Violates contract requirement 5. Exploration theremin tone continues playing at full volume while guide tone sounds, creating loud clashing dual tones.
3. **G-RUN-03 (Double Speech Cancellation):** SpeechSynthesis drops answers and guide announcements because immediate consecutive `speak()` calls cancel each other in mid-air.
4. **G-RUN-04 (Android Back Navigation Corruption):** Cancelling guidance with the system Back gesture pops browser history without re-pushing, breaking subsequent screen navigation and causing unexpected app exits.
5. **G-RUN-05 (Direction Change Hint Spam):** Moving along compass sector boundaries triggers rapid unthrottled speech requests (every 16 ms), freezing or stuttering the speech engine on phones.
