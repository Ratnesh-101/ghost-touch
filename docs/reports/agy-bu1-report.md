# Lane A1 Report — Hold Keep-Alive

**Agent:** Antigravity (agy)  
**Task:** Lane A1 (hold keep-alive timer for resting pointer on Explore screen)  
**Allowed paths modified:**
- `frontend/src/flow/explore.ts`
- `frontend/src/screens/Explore.tsx`
- `frontend/tests/flow.explore.test.ts`
- `frontend/tests/explore.keepAlive.test.ts`
- `docs/reports/agy-bu1-report.md`

---

## 1. Problem Addressed
Previously, the haptic engine only executed on `pointermove` events. When a blind user rested a stationary finger on a line (such as side CA of a triangle), the browser ceased firing `pointermove` events. As a consequence, the 80 ms line buzz finished without re-triggering, making the line seem to abruptly vanish under the user's touch.

---

## 2. Changes Made

### `frontend/src/flow/explore.ts`
1. **`KEEP_ALIVE_INTERVAL_MS = 60`**:
   - Named exported constant defining the 60 ms keep-alive polling interval.
2. **`shouldKeepAlive(lastMoveAt, now, intervalMs = KEEP_ALIVE_INTERVAL_MS)`**:
   - Pure decision logic function returning `true` when at least `intervalMs` has elapsed since the last handled move (or down/keep-alive), and `false` otherwise.
3. **`createHoldKeepAliveTimer(options)`**:
   - Factory function managing the 60 ms `setInterval` timer, coordinates tracking, and defensive cancellation checks (`shouldRun()`).

### `frontend/src/screens/Explore.tsx`
1. **Timer Integration**:
   - Integrated `createHoldKeepAliveTimer` via `keepAliveTimer` ref.
   - On tick, calls the exact same move pipeline (`processPointerMove` + `applyMoveResult`) and `scheduleDraw(view, coords)` with the last known primary pointer coordinates.
2. **Hold Lifecycle**:
   - **Start**: `handlePointerDown` starts the keep-alive timer when the primary pointer is down (and neither Ask listening nor Guide is active).
   - **Update**: `handlePointerMove` updates coordinates and timestamp on every primary move event, resetting the 60 ms countdown so active moves do not double-fire keep-alive ticks.
   - **Promotion**: `handlePointerLift` transfers keep-alive tracking to the promoted pointer if a secondary pointer is promoted to primary.
3. **Cancellation & Stopping Guards**:
   - Stopped on `pointerup`, `pointercancel`, and `lostpointercapture` via `handlePointerLift`.
   - Stopped on `window` blur (`handleWindowBlur`).
   - Stopped on `document.hidden` (`handleVisibilityChange`).
   - Stopped when Ask voice listening begins (`handleVoiceAsk` and `askActive.current`).
   - Stopped while Guide is active (`handleStartGuideFromOffer`, voice command guide trigger, and `guideController.current?.isGuiding()`).
   - Stopped on navigation exit (`handleExit` and system back via `subscribeBack`).
   - Stopped on unmount in `useEffect` cleanup.
4. **Haptic Values & Engine Invariance**:
   - Zero modifications to `frontend/src/core/**`, `hitTest.ts`, or tuned haptic parameters in `tech.md`.

---

## 3. Tests Added

### `frontend/tests/flow.explore.test.ts`
- Unit tests for pure decision function `shouldKeepAlive`:
  - Returns `true` when `now - lastMoveAt >= intervalMs`.
  - Returns `false` when `now - lastMoveAt < intervalMs`.
  - Verifies default interval `KEEP_ALIVE_INTERVAL_MS = 60`.
  - Handles non-positive intervals safely (`intervalMs <= 0`).

### `frontend/tests/explore.keepAlive.test.ts`
Comprehensive suite with Vitest fake timers (`vi.useFakeTimers()`):
1. **Still finger on side CA of triangle sample**:
   - Midpoint of side CA: `x = 0.25, y = 0.55` (`(100, 220)` in a 400×400 viewport).
   - Still finger for 2 s (2000 ms) receives continuous `vibrate(80)` buzzes (re-triggered at ~120 ms outside the 70 ms engine retrigger window).
   - Verified that every gap between consecutive `vibrate(80)` calls is at most 150 ms (`gap <= 150`).
   - Verified that after pointer lift (`pointerLift`), no further vibrate calls occur.
2. **Still finger on a vertex**:
   - Vertex C: `x = 0.25, y = 0.85` (`(100, 340)` in a 400×400 viewport).
   - Initial touch receives corner pattern `[50, 90, 50]`.
   - Finger rests still for 2 s; verified corner pattern fires **once only** with no duplicate vibrations.
3. **Still finger in empty space**:
   - Coords `x = 0.85, y = 0.15` (`(340, 60)` in a 400×400 viewport).
   - Finger rests still for 2 s; verified zero vibrate calls occur.
4. **Movement resets keep-alive**:
   - Moving within the 60 ms window updates `lastMoveAt`, preventing spurious ticks.
5. **Guard conditions**:
   - Timer stops on window blur.
   - Timer stops on document hidden.
   - Timer stops when Ask listening is active.
   - Timer stops while Guide is guiding.

---

## 4. Anything Unsure / Notes for Reviewer
- No dependencies or stack changes were introduced.
- In accordance with the headless run instructions, no shell/terminal commands were executed; all test runs and builds are deferred to the orchestrator.

---

## 5. Follow-up Pass 1 (Gate Fixes)
- Fixed floating point assertion in `frontend/tests/explore.keepAlive.test.ts` using `toBeCloseTo` on `coordsCA.x` and `coordsCA.y`.
- Fixed tsc `TS2532` ("Object is possibly 'undefined'") errors under `noUncheckedIndexedAccess` in `frontend/tests/explore.keepAlive.test.ts` (gap calculation and vertex vibrate call assertions) using a typed `nonNull` helper without using `any` or `ts-ignore`.
