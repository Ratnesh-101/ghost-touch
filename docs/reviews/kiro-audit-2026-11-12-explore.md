# Audit: Explore screen, canvas sizing, TalkBack overlay, drivers

Method: read Explore.tsx, flow/canvasSize.ts, flow/a11yFeatures.ts, drivers/{audio,haptics,speech,index}.ts, explore.css/global.css rules for the canvas and overlay, core/hapticEngine.ts lift/vertex rules, and the App.tsx call sites. I did not run tests (read-only audit; no new test files written). Line numbers are from the current files.

Checked and found OK (no finding): canvasSize.ts (container-only measure, no feedback loop; ResizeObserver watches the container and the canvas is absolutely positioned); FallbackHapticDriver timer handling (every vibrate() and stop() clears pending timers; engine lift always emits vibrate(0) + tone(null), so unmount cleanup is complete); a11y overlay CSS (pointer-events none, 48 px min size, so zero-size boxes for sides and axes are fine); WebAudioDriver tone/earcon ducking and restore; speech.listen settle-once logic.

---

## EX-01 · High · Explore.tsx:449 (set), :461-470 (early return), :509 (only reset)
Problem: `askActive.current = true` is set before the outer try, but it is only reset in the `finally` of the inner `listen()` try, so the `!canListen` early return leaves it true forever.
Scenario: On a device or browser without SpeechRecognition (`drivers.speech.canListen === false`: iOS, Firefox, many desktop and WebView setups), the student presses Ask, or does the two-finger long-press. `handleVoiceAsk` sets `askActive = true`, takes the "unsupported" branch, shows the text fallback and returns. `askActive` stays true. Every later `pointermove` takes the `if (askActive.current)` branch (about line 1190), which updates state but runs no effects: no vibration, no tone, no speech, no corner labels. `handleFeatureFocus` also returns early on `askActive`. Exploring is dead until the screen is remounted, and the blind user gets no explanation.
Suggested failing test: `explore.askUnsupportedResetsGate.test.tsx`. Render Explore with `speech.canListen=false`, click Ask, then fire pointerdown and pointermove over a vertex. Assert that `haptics.vibrate` was called with the corner pattern and that `speech.speak` was called with the vertex label.
Fix by: agy
Confidence: high

## EX-02 · Medium · Explore.tsx:1092 (handlePointerDown, no askActive check), also :1190 (askActive gate only on move)
Problem: The GT-02 "silence while listening" gate covers only `pointermove`; `pointerdown` (and a new hold after lift) still runs `applyMoveResult`, so tone, vibration and speech fire while the microphone is open.
Scenario: The student says "ask" by long-press, the earcon plays and the mic opens. They lift and touch again, or put a second finger down. Pointerdown on a vertex vibrates, speaks "C" and sets a tone, so the recogniser hears the TTS or the question is cut off. Related: `askActive` is false again while `submitTextAsk` is waiting for or speaking the answer. A finger resting on the canvas keeps producing `speak` effects, and each one cancels the spoken answer.
Suggested failing test: `explore.pointerdownDuringAsk.test.tsx`. While `listen()` is pending, fire pointerdown on a vertex. Assert that no vibrate, tone or speak calls were made. A second test checks that a pointermove across a vertex during `submitTextAsk` does not call `speech.speak`.
Fix by: agy
Confidence: medium (listening part is high; the answer-cancel part depends on whether the product wants touch to interrupt answers)

## EX-03 · Medium · Explore.tsx:295-297
Problem: The mount effect speaks `explore.noVibration` with `speech.speak`, which cancels the scene announcement that App.tsx spoke just before switching to Explore.
Scenario: On a device without the Vibration API (laptop, or any fallback-driver device), the student picks a sample or finishes a photo. App.tsx (lines ~407 and ~449, and the capture and sample paths) speaks "Right triangle, 3 corners ...". Explore mounts and its effect immediately speaks the no-vibration notice, so `synth.cancel()` removes the diagram description. The same happens when returning from Correct. The student never hears what the diagram is, only that vibration is missing. The text stays only in the status card.
Suggested failing test: `explore.noVibrationKeepsAnnouncement.test.tsx`. With `haptics.supported=false`, mount Explore and assert that the last `speak` text contains both `announced` and the no-vibration notice (one joined utterance), or that the notice is not spoken on top of the announcement.
Fix by: agy
Confidence: medium (the order of App's speak and Explore's effect was read, not run)

## EX-04 · Low · Explore.tsx:918 (`if (!changed) return`) and :935 (only place `renderStaticScene` runs)
Problem: The offscreen scene bitmap is redrawn only when the container size changes, not when the `scene` prop changes.
Scenario: The component is kept mounted while `scene` changes (the code already handles that case with `prevSceneRef`, e.g. an edited or reloaded scene with the same container size). Hit-testing, haptics and the a11y tree use the new scene, but the canvas keeps showing the old drawing, so a sighted teacher or observer sees something that does not match what is felt.
Suggested failing test: `explore.redrawOnSceneChange.test.tsx`. Mount with scene A, rerender with scene B at the same size, and assert that the 2D context `stroke` or `moveTo` calls after the rerender reflect scene B's points.
Fix by: agy
Confidence: medium (App.tsx may always remount Explore; I did not find a same-instance scene swap)

## EX-05 · Low · Explore.tsx:963-975 (system Back handler) and the unmount cleanup
Problem: Only the on-screen Back button path (`handleExit`, line ~428) calls `speech.cancelListen()`. The system or hardware Back path and the unmount cleanup do not.
Scenario: The mic is open (listening, up to 6 s) and the student presses Android system Back. Explore unmounts, but the recogniser keeps listening until result, error or the 6 s timeout. The mic indicator stays on over the next screen, and a late result is dropped silently.
Suggested failing test: `explore.systemBackCancelsListen.test.tsx`. Start a pending `listen()`, trigger the popstate or back subscription, and assert that `speech.cancelListen` was called.
Fix by: agy
Confidence: medium

## EX-06 · Low · Explore.tsx:996-1010 (handleWindowBlur) and the visibilitychange handler
Problem: Both handlers clear `activePointers` and `primaryPointerId` while a finger may still be down, and nothing re-registers that finger, so its later moves are ignored.
Scenario: A window `blur` fires mid-gesture (notification shade pulled slightly, system dialog). The student keeps dragging. `pointermove` fails the `pointerId !== primaryPointerId` check, so the rest of the drag gives no vibration, tone or speech until they lift and touch again. No message tells them.
Suggested failing test: `explore.blurMidDragRecovers.test.tsx`. Pointerdown, fire window blur, then pointermove over a vertex with the same pointerId. Assert either that effects still run or that a "lift and touch again" cue is spoken.
Fix by: agy
Confidence: low (needs a device to see how often blur fires with an active touch)

---
SUMMARY: 1 high, 2 medium, 3 low
AUDIT-DONE
