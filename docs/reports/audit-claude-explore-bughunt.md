# Explore / Capture / Start / App navigation bug hunt (Claude Sonnet subagent, read-only, 2026-11-08)
Committed code only; nothing was run on a device. "CONFIRMED" = cause plain in code. **Supervisor has NOT re-verified; verify before fixing.** Already-known (excluded): hardware Back from `#/teach`, axis-crossing speech cancelled by vertex speech, SavedDiagrams speaking after unmount.

| ID | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| GT-01 | MED CONFIRMED | Explore.tsx:284-287, 861-876 | Two-finger long-press Ask can run twice: `handleVoiceAsk` has no re-entry guard. A second hold during listen cancels the first session, which then speaks "couldn't hear you", clears busy and drops the second session's cancel handle. A hold during "thinking" speaks the first answer into the second open mic. | Guard at top of `handleVoiceAsk` with `busyRef`/`askManager.isBusy()`, clear in `finally`. |
| GT-02 | MED CONFIRMED | Explore.tsx:304-316 | Theremin tone and vertex/axis speech keep running while the mic is open (the earcon only ducks the tone), polluting the transcript. | `setTone(null)` and `haptics.stop()` when Ask starts; `askActive` ref makes `handlePointerMove` skip effects. |
| GT-03 | MED CONFIRMED | Explore.tsx:1049-1082, hapticEngine.ts:181-192 | Tone stuck on: trace the sine with finger A, put finger B on empty canvas, lift A. Promotion resets `engineState` (`onLine=false`) so no `tone(null)` is emitted. Bars likewise. | Run `step(state,{kind:'lift'})` and its effects before resetting on promotion. (`hapticEngine.ts` is core-adjacent; fix in the screen.) |
| GT-04 | MED SUSPECTED | Explore.tsx:784-792, 958-992 | After backgrounding mid-touch with no `pointercancel`, `primaryPointerId` stays set and every later `pointerdown` is ignored: dead canvas, no cue. | Clear `activePointers`/`primaryPointerId` on `visibilitychange` hidden and window `blur`; self-heal in `handlePointerDown`. |
| GT-05 | MED SUSPECTED | App.tsx:207-261, 167-181 | A teacher's shared link opened cold is silent: speech is blocked without user activation and audio is not unlocked until the first touch. | Gate: "Tap anywhere to open the shared diagram"; speak and `audio.unlock()` inside the tap, or replay on first `pointerdown`. |
| GT-06 | LOW-MED SUSPECTED | App.tsx:331-345, 290-327 | A saveDiagram failure calls `speech.speak`, cancelling the Explore announcement milliseconds after it starts (IndexedDB unavailable). Repeats per photo. | Show in status text only, or speak after the announcement, once per session. |
| GT-07 | LOW-MED SUSPECTED | speech.ts:361-365 | The 6 s listen timeout includes the mic permission prompt, so first Ask times out while the dialog is up. | Start the timer on `onaudiostart`/`onstart`, or prompt first. |
| GT-08 | LOW SUSPECTED | Explore.tsx:847 | `setPointerCapture` can throw `InvalidStateError` before `activePointers.set`, swallowing the touch. (Same as audit CORE-08.) | try/catch. |
| GT-09 | LOW CONFIRMED | Explore.tsx:861-879 | Long-press timer not re-armed when finger count drops back to 2 (palm as third touch). | Re-baseline and restart in `handlePointerLift` when exactly 2 remain. |
| GT-10 | LOW SUSPECTED | Explore.tsx:226-239, 463-468, 542 | `focusAfterRender(askButtonRef)` after every Ask makes TalkBack announce "Ask, button", possibly cutting the spoken answer. | Delay focus until the answer ends. |

Other (low): Explore status text/canvas stay stale if the scene prop changes without remount (add `key` by scene); `updateDimensions()` runs on every `pointerdown` (only when size changed); **Capture and Start push no history entry, so hardware Back exits the whole PWA from Capture with no warning** (push a guard entry, "Press back again to exit").

Checked fine: photo double-submit blocked by `busyRef`; `lostpointercapture` double lift harmless; listen cleanup on Back; suppress-pop in `navigation.ts`; audio/haptic drivers swallow errors; camera denial handled by OS file input.

Overlap with Kiro's T26: GT-06/08 and the Back-exit note touch CORE-01/CORE-08 areas; coordinate. The Back-to-exit finding (Capture) is not covered by T26.
