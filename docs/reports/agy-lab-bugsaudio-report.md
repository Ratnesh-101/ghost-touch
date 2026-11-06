# Lane lab-bugsaudio Report: Audio & Speech Driver Bug Fixes

**Lane:** lab-bugsaudio  
**Author:** Antigravity (agy)  
**Date:** 2026-11-06  
**Audited findings resolved:** Findings 1, 2, 6, 13  

---

## 1. Verification Baseline & Definition of Done

All required verification commands were executed from repository root:

### `npm --prefix frontend exec -- tsc -p frontend --noEmit`
- **Exit Code:** 0
- **Output:** Clean (0 errors, strict typechecking verified).

### `npm --prefix frontend test`
- **Exit Code:** 0
- **Summary:** 57 test files passed (57/57), 814 tests passed (814/814), 0 failed.
- **Delta:** Baseline was 55 test files and 786 passed; added 2 new test files and 28 new tests locking regressions and verifying lifecycle behavior.

### `npm --prefix frontend run build`
- **Exit Code:** 0
- **Output:** `tsc --noEmit && vite build` completed cleanly; client bundles and PWA service worker generated successfully.

---

## 2. Findings Addressed

### Finding 1 (HIGH): Stuck Theremin Tone after Earcon Ducking (Web Audio Timeline Race)
- **What was wrong:**
  In `frontend/src/drivers/audio.ts`, `playEarcon()` scheduled future Web Audio timeline events (`this.gain.gain.setTargetAtTime(TONE_GAIN, restoreAt, GAIN_ON_TIME_CONSTANT)`) to un-duck the continuous theremin tone after earcon playback. However, when the user lifted their finger (`setTone(null)`), `setTone()` did not call `cancelScheduledValues()`. When the AudioContext reached `restoreAt`, the scheduled automation executed anyway, raising the theremin gain to 0.15 and leaving a permanent droning tone with no finger on the screen.
- **What changed:**
  - In `WebAudioDriver.setTone(hz)`:
    - Calls `this.gain.gain.cancelScheduledValues?.(now)` and `this.osc.frequency.cancelScheduledValues?.(now)` before applying any automation.
    - If `hz === null`, clears `this.earconRestoreAt = null` and transitions gain to 0 (`GAIN_OFF_TIME_CONSTANT`). All future restorations are cancelled immediately.
    - If `hz !== null` while an earcon is currently playing (`now < this.earconRestoreAt`), keeps gain at 0 and re-schedules restoration to the new frequency at `this.earconRestoreAt`.
  - In `WebAudioDriver.playEarcon(kind)`:
    - Calls `cancelScheduledValues?.(now)` on gain and frequency before ducking, preventing collision with prior earcon schedules.
    - If `this.activeToneHz === null`, sets `this.earconRestoreAt = null` and does not schedule restoration.
    - If `this.activeToneHz !== null`, schedules restoration at `restoreAt = maxEnd + 0.05` and records `this.earconRestoreAt = restoreAt`.
- **Tests proving the fix:**
  - `tests/drivers.audio.earcons.test.ts`:
    - `"cancels scheduled restoration when finger is lifted (setTone(null)) during earcon playback (Finding 1)"`
    - `"reschedules restoration to new pitch when setTone(newHz) is called during earcon (Finding 1)"`
  - `tests/drivers.audio.test.ts`:
    - `"setTone(hz) and setTone(null) cancel scheduled values (Finding 1)"`
  - `tests/drivers.audio.lifecycle.test.ts`:
    - `"ducking cancels scheduled automations and does not leave stuck drone on finger lift"`
    - `"rapid successive earcons cancel previous restore schedule without overlapping"`
- **Screen changes needed later:** None. The driver handles timeline automations and cancellation autonomously.

---

### Finding 2 (HIGH): Speech Recognition Session Orphaned on Screen Exit
- **What was wrong:**
  When speech recognition was active (e.g. user initiated voice question in Explore), navigating away (Back button or gesture) or backgrounding the browser left the microphone open and listening. When recognition timed out (6 s) or completed, callbacks executed on unmounted components, causing microphone leakage and stale state mutation.
- **What changed:**
  - Extended `ListenFailure` type with `'cancelled'`.
  - Added clean, idempotent `cancelListen()` to `WebSpeechDriver`:
    - Aborts the active recognition session immediately (`recognition.abort()` when available, falling back to `recognition.stop()`).
    - Clears timeout timer and removes lifecycle listeners.
    - Settles the pending `listen()` promise with `ListenError('cancelled')`.
    - Idempotent: safe to call repeatedly or when no listen session is active.
  - Added automatic cancellation on `visibilitychange` (hidden) and `pagehide`:
    - When `listen()` starts, attaches listeners for `window` (`pagehide`) and `document` (`visibilitychange`).
    - When `document.hidden` / `visibilityState === 'hidden'` or `pagehide` occurs, immediately invokes cancellation.
    - Cleans up listeners on any resolution/rejection (result, timeout, error, or cancel).
- **Tests proving the fix:**
  - `tests/drivers.speech.test.ts`:
    - `"cancelListen() is safe when idle (idempotent)"`
    - `"cancelListen() aborts active recognition and rejects with ListenError(\"cancelled\") (Finding 2)"`
    - `"cancelListen() is idempotent across repeated calls during and after session"`
  - `tests/drivers.speech.cancel.test.ts`:
    - `"cancelListen() is clean and idempotent when called while idle"`
    - `"cancelListen() aborts active recognition and rejects pending listen() with \"cancelled\""`
    - `"cancelListen() falls back to stop() when abort() is undefined on recogniser"`
    - `"automatically aborts recognition when visibilitychange transitions to hidden (Finding 2)"`
    - `"does not abort recognition when visibilitychange fires with visible state"`
    - `"automatically aborts recognition on pagehide event (Finding 2)"`
    - `"isolates state so late events after cancel do not trigger duplicate settlement or errors"`
    - `"cleans up lifecycle listeners when recognition completes normally"`
    - `"cleans up lifecycle listeners when recognition times out"`
- **Screen changes needed later:**
  In a subsequent lane, wire `drivers.speech.cancelListen?.()` into screen unmount effects and exit handlers (e.g. `Explore.tsx` unmount effect, `handleExit`, and `AskManager.abort()`).

---

### Finding 6 (HIGH): AudioContext Suspended by Camera App Switch Never Resumes
- **What was wrong:**
  `drivers.audio.unlock()` was only called once on the Start screen. When Android Chrome switched foreground focus to the native camera app for diagram capture, the browser suspended the `AudioContext` (`ctx.state === 'suspended'`). On returning to Chrome, Explore never resumed the context on touch, resulting in total silence (no continuous tone, no earcons).
- **What changed:**
  - In `WebAudioDriver`:
    - Added `attachLifecycleListeners()` on `unlock()`, registering:
      - `visibilitychange` listener on `document`: when `document.visibilityState === 'visible'`, calls `ctx.resume()` if context is suspended.
      - User gesture listeners on `window` (`pointerdown`, `touchstart`, `keydown`): calls `ctx.resume()` if context is suspended.
    - In `setTone(hz)`, `playEarcon(kind)`, and `beep(hz, ms)`: checks `if (ctx.state === 'suspended') { this.resumeIfSuspended(ctx); }`.
    - Preserves singleton context invariant: calls `ctx.resume()` on the existing context, never invoking the context factory again.
    - Prevents sound leakage: when `activeToneHz === null`, theremin gain remains 0; resuming the context never starts any sound by itself.
- **Tests proving the fix:**
  - `tests/drivers.audio.test.ts`:
    - `"setTone, beep, and playEarcon resume a suspended context (Finding 6)"`
  - `tests/drivers.audio.lifecycle.test.ts`:
    - `"resumes suspended context when app becomes visible after camera switch without creating a second context"`
    - `"does not produce any tone by itself when resuming a suspended context while idle (Finding 6)"`
    - `"resumes suspended context on next user gesture (pointerdown, touchstart, keydown)"`
    - `"resumes suspended context when setTone is called on touch in Explore screen"`
    - `"does not attach resume listeners or resume context before unlock() is called"`
    - `"ignores visibilitychange when document transitions to hidden"`
- **Screen changes needed later:** None required. Driver automatically resumes on visibility return and on canvas touch/gestures.

---

### Finding 13 (MEDIUM): Web Audio GainNode Graph Leak (Missing Node Disconnection)
- **What was wrong:**
  `beep()` and each step in `playEarcon()` created new `OscillatorNode` and `GainNode` instances, connecting the gain to `ctx.destination`. While `osc.stop()` stopped the oscillator, the `GainNode` and `OscillatorNode` remained connected to `ctx.destination`, accumulating in the browser's Web Audio graph over minutes of exploration.
- **What changed:**
  - In `frontend/src/drivers/audio.ts`:
    - In `beep()`: registered `osc.onended = () => { osc.disconnect?.(); gain.disconnect?.(); };`.
    - In `playEarcon()`: registered `osc.onended = () => { osc.disconnect?.(); gain.disconnect?.(); };` on each transient step oscillator and gain.
    - Persistent nodes (`this.osc`, `this.gain` created on `unlock()`) are never disconnected.
- **Tests proving the fix:**
  - `tests/drivers.audio.test.ts`:
    - `"beep disconnects its oscillator and gain when playback ends (Finding 13)"`
  - `tests/drivers.audio.earcons.test.ts`:
    - `"disconnects earcon oscillators and gains when each step ends (Finding 13)"`
  - `tests/drivers.audio.lifecycle.test.ts`:
    - `"disconnects all earcon oscillators and gain nodes upon onended completion"`
- **Screen changes needed later:** None.

---

### Pure Earcon Steps Lock (Regression Lock)
- **Requirement:**
  "the output of `getEarconSteps` (earcon frequencies, durations and timings must be unchanged: add a test that locks them)"
- **Verification:**
  Added explicit snapshot assertion in `tests/drivers.audio.earcons.test.ts` locking `start`, `success`, `error`, `listening`, and `back` steps.

---

## 3. Commit Groups

### Group 1: Audio Driver timeline automation, lifecycle recovery, and node cleanup
- **Files:**
  - `frontend/src/drivers/audio.ts`
  - `frontend/tests/drivers.audio.test.ts`
  - `frontend/tests/drivers.audio.earcons.test.ts`
  - `frontend/tests/drivers.audio.lifecycle.test.ts`
- **Description:**
  - Fix Web Audio timeline race in `setTone` and `playEarcon` via `cancelScheduledValues` and `earconRestoreAt` guards (Finding 1).
  - Add `visibilitychange` and user gesture lifecycle recovery for suspended `AudioContext` without creating duplicate contexts or spontaneous sounds (Finding 6).
  - Disconnect transient cue oscillators and gains on `onended` to prevent Web Audio graph memory leaks (Finding 13).
  - Lock earcon frequencies, durations, delays and gains.

### Group 2: Speech Driver clean cancellation and visibility teardown
- **Files:**
  - `frontend/src/drivers/speech.ts`
  - `frontend/tests/drivers.speech.test.ts`
  - `frontend/tests/drivers.speech.cancel.test.ts`
- **Description:**
  - Add idempotent `cancelListen()` settling with `ListenError('cancelled')` and aborting recogniser (Finding 2).
  - Add automatic session cancellation on `pagehide` and `visibilitychange` hidden.
  - Clean up lifecycle listeners on all completion branches.

### Group 3: Documentation and Build Log
- **Files:**
  - `docs/reports/agy-lab-bugsaudio-report.md`
  - `docs/BUILD_LOG.md`
- **Description:**
  - Detailed audit findings resolution report, verification proof, and build log entry.
