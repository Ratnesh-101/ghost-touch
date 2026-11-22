# Antigravity Lane Report: hi16 (Planchette Follow-up Fixes in Explore)

**Date:** 2026-11-22  
**Lane:** hi16 (EX, Explore lane)  
**Tool:** Antigravity (agy)  
**Status:** Complete  

---

## 1. Summary of Fixes

Addressed all verified Planchette findings from `docs/reviews/kiro-review-hi11.md` and `docs/reviews/kiro-review-hi10.md` per the lane brief:

### DO (1) — 120 s Idle Timeout With Finger Up & Button Click Feedback
- **Problem:** Idle timeout (120 s) was previously checked only in keep-alive `onTick`, which only runs while a finger is down on the canvas (`primaryPointerId` active). When a finger was lifted after starting a walk, waiting 130 s left the button showing "Next step". Tapping it called `walkStep(next)`, which detected the timeout and silently returned `initialWalkState()` with no speech or audio feedback, leaving the user without any feedback from the main control.
- **Fix:**
  1. In `handleWalkClick`, `handleWalkNext`, and `handleWalkRepeat`, first ran `walkStep(walkRef.current, { kind: 'tick', t: now })` and called `syncWalkPhase(tickRes.state.phase)`.
  2. If the walk had ended due to idle timeout:
     - In `handleWalkClick`: when the press was on "Walk me through" (`wasRunning` was false), starts a new walk; when the press was on "Next step" and timed out, speaks `walk.stopped` and reverts the label to "Walk me through". The main control is never silent.
     - In `handleWalkNext` and `handleWalkRepeat`: speaks `walk.stopped`.
  3. Added a low-rate interval timer (5 s interval) via `walkIntervalRef` and `startWalkInterval()` that ticks while a walk is running (`phase !== 'idle' && phase !== 'done'`). If 120 s elapse with no touch activity, the interval tick detects the idle timeout and resets `walkPhase` to `'idle'`, automatically restoring the button label to "Walk me through" without requiring a finger down.
  4. Registered cleanup of the low-rate interval timer on component unmount, Back button (`handleBack`), scene change (`prevSceneRef.current !== scene`), and stop command (`result.stopWalk` / `stepWalkTouch` done).

### DO (2) — Voice Commands When Walk is Null or Not Running
- **Problem:** Voice commands `walk_next`, `walk_start` when `walk === null` (Raw Mode or no template), or `repeat` with no walk running previously hit a bare return with no speech, silently dropping the command.
- **Fix:**
  1. Added localized strings to `frontend/src/i18n/index.ts` across `en`, `hi`, and `gu`:
     - `walk.none`: `"There is no walk for this diagram."` / `"इस चित्र के लिए कोई वॉक नहीं है।"` / `"આ આકૃતિ માટે કોઈ વૉક નથી."`
     - `walk.notRunning`: `"No walk is running. Say walk me through to start one."` / `"कोई वॉक नहीं चल रहा है। शुरू करने के लिए मुझे समझाएं कहें।"` / `"કોઈ વૉક ચાલી રહ્યું નથી. શરૂ કરવા માટે મને સમજાવો બોલો."`
  2. Added corresponding rows to `docs/user-test/translation-review.csv` and `docs/user-test/translation-review.md`.
  3. In `handleVoiceAsk`:
     - When `cmd.type === 'walk_start'` and `walk === null`: speaks `walk.none` with language argument.
     - When `cmd.type === 'walk_next'`: if `walk === null`, speaks `walk.none`; if not running (`!isWalk`), speaks `walk.notRunning`.
  4. In `handleWalkNext` and `handleWalkRepeat`: if `walk === null`, speaks `walk.none`; if walk is idle/done, speaks `walk.notRunning`. Never silent.

### DO (3) — Playwright E2E Speech Spying Spec (`e2e/explore.walk-speech.spec.ts`)
- **Problem:** In `e2e/explore.walk.spec.ts`, assertions for "finger lift does not cut the step speech" checked only `.gt-explore__status` DOM text, which does not change when `speechSynthesis` is cancelled.
- **Fix:**
  1. Created a new E2E test file `frontend/e2e/explore.walk-speech.spec.ts` leaving `explore.walk.spec.ts` untouched.
  2. Injected a wrapper script via `page.addInitScript` spying on `window.speechSynthesis.cancel` and `window.speechSynthesis.speak` to count call invocations and record utterance text.
  3. On the bar chart sample: starts a walk, touches tall bar Q4 so step one is spoken, lifts finger, waits 400 ms, and asserts zero `cancel` calls after `touchEnd` while the step utterance is playing.
  4. On Next step: touches wrong bar Q2, waits 300 ms, and asserts absence of '22' (`not.toContainText(/22/)`) before touching the second bar (Q1). Touches Q1 and verifies '22' is announced and preserved on lift.
  5. On the triangle sample (control): touches corner C without a walk, lifts finger, waits 400 ms, and asserts that corner label speech IS cancelled by a lift (`cancel` calls increased).

---

## 2. Files Changed & Added

- `frontend/src/screens/Explore.tsx` (modified: interval timer, tick pre-check, feedback on idle end, voice command fallbacks)
- `frontend/src/i18n/index.ts` (modified: added `walk.none` and `walk.notRunning` to `en`, `hi`, `gu`)
- `docs/user-test/translation-review.csv` (modified: added review entries for `walk.none` and `walk.notRunning`)
- `docs/user-test/translation-review.md` (modified: added section 30 table rows for `walk.none` and `walk.notRunning`)
- `frontend/tests/explore.walkFixes.test.tsx` (new: vitest unit and integration tests covering DO 1 and DO 2)
- `frontend/e2e/explore.walk-speech.spec.ts` (new: Playwright E2E spec verifying speech spy and lift preservation/cancellation)
- `docs/reports/agy-hi16-report.md` (new)
- `docs/BUILD_LOG.md` (modified: added hi16 entry)

---

## 3. Tests Added

### `frontend/tests/explore.walkFixes.test.tsx`
1. `130 s idle with finger up reverts button to "Walk me through" via low-rate interval, then press starts new walk`: verifies the 5 s interval ticks without a finger down, resets phase to idle after 120 s, reverts button label to "Walk me through", and pressing button starts a new walk with intro speech.
2. `pressing Next step after idle timeout (without waiting for interval) speaks walk.stopped and flips to Walk me through`: verifies pressing "Next step" when idle timeout has elapsed speaks `walk.stopped` and resets phase so feedback is never silent.
3. `interval is cleared on Back navigation`: verifies Back button clears the interval timer.
4. `interval is cleared on scene change`: verifies re-rendering with another scene clears the interval timer.
5. `interval is cleared on "stop" voice command`: verifies voice command "stop" clears the interval timer and reverts label.
6. `voice command "walk me through" when walk is null (Raw Mode) speaks walk.none with language`: verifies `walk_start` on Raw Mode diagram speaks `walk.none` ("There is no walk for this diagram.") with `en-IN`.
7. `voice command "next step" when walk is null (Raw Mode) speaks walk.none with language`: verifies `walk_next` on Raw Mode diagram speaks `walk.none` with `en-IN`.
8. `voice command "next step" when walk is not running speaks walk.notRunning with language`: verifies `walk_next` when walk is idle speaks `walk.notRunning` ("No walk is running. Say walk me through to start one.") with `en-IN`.
9. `voice command "walk me through" on unknown scene kind (walk is null) speaks walk.none`: verifies unreadable/unknown kind speaks `walk.none`.
10. `voice command "repeat" when no walk is running speaks without failing silently`: verifies repeat with no active walk does not hit a bare return.

### `frontend/e2e/explore.walk-speech.spec.ts`
1. `bar chart walk step speech is NOT cancelled on lift, and wrong touch 300 ms wait asserts not 22`: Playwright CDP touch test with speech spy confirming 0 cancel calls 400 ms after `touchEnd` on step one and step two, and 300 ms wait asserting absence of '22' on wrong bar touch.
2. `control: corner label spoken on triangle sample IS cancelled by finger lift`: Playwright CDP touch test verifying non-walk exploration speech (corner C) is cancelled on lift after the 300 ms quiet timer.

---

## 4. What Could Not Be Verified

- **Direct shell execution:** In accordance with the headless UX rules ("Do NOT run any shell command. No npm, npx, node, python, pytest, ruff, git, curl. The orchestrator runs all gates"), tests and gates were not run directly in this environment.
- **Physical device speech synthesis:** Physical speech synthesis device nuances and audio hardware latency across physical Android devices.
- **Screen reader pass-through gesture:** Physical TalkBack gesture pass-through on hardware devices.

---

## 5. Needs from Kiro

None. All implementation and test requirements for Lane hi16 have been completed within the ALLOWED boundaries and match the specs in `docs/reviews/kiro-review-hi11.md` and `docs/reviews/kiro-review-hi10.md`.
