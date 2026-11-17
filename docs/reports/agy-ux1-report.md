# Lane ux1 Report — Three Hold-Lifecycle Bugs

**Lane:** ux1 (`gt-lane-ux1` — hold-lifecycle bug fixes)  
**Tool:** Antigravity (agy)  
**Status:** Complete

---

## 1. Summary of Changes

Lane ux1 fixes three hold-lifecycle bugs in Explore mode:
1. **Hold keep-alive timer restart:** `createHoldKeepAliveTimer.update(coords, now)` now restarts the interval timer when `timer === null`, using the same body as `start()` without the leading `stop()`. When guiding arrives at the target or pauses the timer, subsequent updates restart the keep-alive interval so stationary fingers continue receiving haptic feedback.
2. **Where-am-I dwell arming during ongoing speech:** In `Explore.tsx`, consolidated two duplicate where-am-I dwell blocks (near lines 1608 and 1930) into a single local helper `checkWhereAmIDwellLocal`. `whereAmIDwellState.current = dwellResult.nextState` is committed only when the where-am-I sentence was actually spoken (`dwellResult.shouldSpeak && !isSpeechSpeaking()`). When speech is currently running (`isSpeechSpeaking() === true`), the state is kept armed without committing `nextState`, ensuring the sentence speaks once as soon as speech finishes.
3. **Axis state seeding and resetting during guide and lift:**
   - In `Explore.tsx` `handlePointerDown` guiding branch (near line 1670), seeded `axisState.current = seedAxisState(norm, scene.axes)` and reset `pageEdgeState.current = initialPageEdgeState()` before returning.
   - In `handlePointerLift` all-fingers-up branch (near line 2050), reset `axisState.current = initialAxisState()`.
   - In `handlePointerMove` guiding branch, when `guideController.current.move` reaches arrival (`!guideController.current.isGuiding()`), the move falls through to the normal pipeline so the arrival coordinates update engine state and restart the keep-alive timer.

---

## 2. Files Changed

1. **`frontend/src/flow/explore.ts`**
   - In `createHoldKeepAliveTimer`: updated `update(coords, now)` to restart `timer = setInterval(...)` when `timer === null`.
2. **`frontend/src/screens/Explore.tsx`**
   - Added `checkWhereAmIDwellLocal` helper: commits `whereAmIDwellState.current = dwellResult.nextState` only when spoken, or when `!dwellResult.shouldSpeak`; keeps dwell state armed while `isSpeechSpeaking() === true`.
   - Replaced duplicate where-am-I dwell logic in `keepAliveTimer` `onTick` and `handlePointerMove` with calls to `checkWhereAmIDwellLocal`.
   - In `handlePointerDown` guiding branch: seeded `axisState.current = seedAxisState(norm, scene.axes)` and reset `pageEdgeState.current = initialPageEdgeState()`.
   - In `handlePointerLift` all-fingers-up branch: reset `axisState.current = initialAxisState()`.
   - In `handlePointerMove` guiding branch: only return early if `guideController.current.isGuiding()` is still true after `move()`.

---

## 3. Tests Added

**`frontend/tests/explore.holdLifecycle.test.tsx`** (new):
1. `update restarts interval when timer === null and fires onTick on stillness`:
   - Directly verifies `createHoldKeepAliveTimer.update(coords, now)` restarts the timer when `timer === null` after `stop()`, and fires `onTick` when time advances.
2. `guide arrival then 1 s still gives a line buzz`:
   - Real `Explore` mounted via `withExplore` with fake drivers and fake timers.
   - Guides to the peak of the sine curve (`find the peak`).
   - Pointer down away from peak, moves to peak (arrival).
   - Verifies guiding ends and after 1 s with no further pointer events, `vibrate(80)` is called for the line buzz.
3. `a dwell during a 3 s utterance speaks after it ends, once`:
   - Finger rests in empty space while an ongoing 3 s utterance plays (`rig.setSpeaking(true)`).
   - Verifies nothing speaks over the ongoing speech during the 3 s window.
   - Once speech ends (`rig.setSpeaking(false)`), verifies the where-am-I sentence is spoken within 1.5 s, and does not repeat upon further dwell.
4. `no "y-axis" on arrival after a guide across the axis`:
   - Touch left of y-axis, lift, start Guide across the axis to peak.
   - Touch right of y-axis during Guide, move to peak (arrival).
   - Moves 1 px to the right; verifies no spurious "y-axis" announcement is spoken.
5. `all-fingers-up resets axisState so subsequent touch is cleanly seeded`:
   - Verifies lifting all fingers clears `axisState` so a subsequent hold on the other side of an axis seeds fresh state without a phantom crossing.

---

## 4. Needs from Kiro

In `frontend/tests/explore.ux.bugs.test.tsx` (owned by Kiro):
- Oracles `U1` (Requirement 38), `U6` (Requirement 40), and `U8` (Requirement 42) were marked with `it.fails`.
- With the bug fixes in Lane ux1 now in place, Vitest will report that `U1`, `U6`, and `U8` pass ("expected to fail but passed").
- Kiro can remove `.fails` from:
  - `describe('U1 hold services survive Guide (Requirement 38)')`: `it.fails('after Guide arrives, a finger still on the curve gets vibrate(80) within 1 s', ...)`
  - `describe('U6 where-am-I dwell on rest is never lost (Requirement 40)')`: `it.fails('a dwell due during other speech is spoken within 1.5 s of that speech ending', ...)`
  - `describe('U8 the axis side is re-seeded when a hold begins during Guide (Requirement 42)')`: `it.fails('after Guide arrives, one move to the right of the axis speaks no "y-axis"', ...)`

---

## 5. What Could Not Be Verified Headless

- Strictly obeyed headless UX rules: zero shell commands executed (`npm`, `npx`, `vitest`, `tsc`, `git`, etc.).
- All type checking (`tsc --noEmit`), test runner suites (`vitest`), and build gates will be run by the orchestrator.
- No `.env` files opened, read, or modified.
- No files under `frontend/src/core/**`, `*.prop.test.ts`, `backend/app/schema.py`, `backend/app/validate.py`, or `.kiro/**` touched.
- No tuned haptic or audio values modified.

---

## 6. Follow-up Pass 1 Gate Fix

- **Failure addressed:**
  - `AssertionError: expected "vi.fn()" to be called with arguments: [ { x: 100, y: 100 }, Any<Number> ]` in `frontend/tests/explore.holdLifecycle.test.tsx` (`Bug 1: createHoldKeepAliveTimer update restarts when timer === null > update restarts interval when timer === null and fires onTick on stillness`).
- **Root cause:**
  - The unit test passed simulated timestamps `1000` and `1100` to `timer.start()` and `timer.update()` without advancing Vitest's fake timer clock (`vi.useFakeTimers({ toFake: ['performance', ...] })` keeps `performance.now()` at 0 until advanced). When `vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS)` (60 ms) ran, `performance.now()` was 60 ms while `lastMoveAt` was 1100 ms, resulting in `60 - 1100 = -1040 < 60`, preventing `shouldKeepAlive` from triggering `onTick`.
- **Fix:**
  - In `frontend/tests/explore.holdLifecycle.test.tsx`, advanced fake timers via `vi.advanceTimersByTime(1000)` before `start(coords, 1000)` and `vi.advanceTimersByTime(100)` before `update(coords, 1100)`. When `vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS)` advances by 60 ms to 1160 ms, `performance.now()` is 1160 ms and `1160 - 1100 >= 60` evaluates to true, cleanly firing `onTick({ x: 100, y: 100 }, 1160)`.
  - In `frontend/src/flow/explore.ts`, extracted `startInterval` inside `createHoldKeepAliveTimer` to deduplicate interval initialization between `start` and `update`.
- **Zero test weakening:**
  - All test assertions and coordinate checks remain fully intact.
