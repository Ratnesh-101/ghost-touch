# Lane hb2 Report: Corner Heartbeat Switch and Wiring

**Lane:** `hb2`  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-16  
**Status:** Complete & verified  

---

## 1. Summary of Changes

Lane `hb2` wired the optional, OFF-by-default corner heartbeat feature (Requirement 34, task 59) into the application shell. When enabled via Lab Settings, resting stationary on a diagram vertex delivers a periodic double pulse (`[50, 90, 50]` every 900 ms) through the existing 60 ms keep-alive tick, without repeating speech announcements or adding timers.

1. **Storage Driver (`frontend/src/drivers/storage.ts`):**
   - Added `STORAGE_KEY_CORNER_HEARTBEAT = 'gt_corner_heartbeat_enabled'`.
   - Exported `getStoredCornerHeartbeatSetting()` (defaults to `false` when unset).
   - Exported `setStoredCornerHeartbeatSetting(enabled: boolean)`.
   - Exported `_resetCornerHeartbeatSettingForTesting()`.
   - Notifies registered settings listeners upon change.

2. **Lab Settings Sheet (`frontend/src/components/LabSettings.tsx`):**
   - Built an accessible "Corner heartbeat" toggle switch constructed identically to the Directions switch.
   - Conforms to WAI-ARIA switch pattern: `role="switch"`, `aria-checked={cornerHeartbeatEnabled}`, min 48×48 CSS px touch target (`minWidth: 48px`, `minHeight: 48px`).
   - One fixed label (`t('lab.settings.cornerHeartbeat')`), with state conveyed solely via `aria-checked`.
   - Localized across English (`en`), Hindi (`hi`), and Gujarati (`gu`).
   - Refreshes state on dialog open, announces `lab.settings.cornerHeartbeatOn/Off` upon toggle.

3. **Pure Per-Move Pipeline (`frontend/src/flow/explore.ts`):**
   - Extended `processPointerMove` with two optional trailing parameters:
     - `heartbeatState: HeartbeatState = initialHeartbeatState()`
     - `heartbeatCfg: HeartbeatConfig | null = null`
   - When `heartbeatCfg === null`, `heartbeatStep` is bypassed, returning engine effects untouched.
   - When `heartbeatCfg !== null`, invokes pure `heartbeatStep(heartbeatState, { kind: 'move', t, target, engineEffects: effects }, heartbeatCfg)` and returns its effects as `effects`.
   - Added `heartbeatState: HeartbeatState` to `MovePipelineResult`.
   - Re-exported heartbeat helpers and constants (`DEFAULT_HEARTBEAT`, `initialHeartbeatState`, `heartbeatStep`, `HeartbeatConfig`, `HeartbeatState`, `STORAGE_KEY_CORNER_HEARTBEAT`, setting getters/setters).
   - Retained pure core architecture: `inQuietWindow` and proximity are computed from engine state.

4. **Explore Screen Wiring (`frontend/src/screens/Explore.tsx`):**
   - Retained heartbeat state in ref: `heartbeatState = useRef<HeartbeatState>(initialHeartbeatState())`.
   - Updated all 6 `processPointerMove` call sites to pass `heartbeatState.current` and `(getStoredCornerHeartbeatSetting() ? DEFAULT_HEARTBEAT : null)`.
   - Stored returned `moveResult.heartbeatState` into `heartbeatState.current` in `applyMoveResult` (and in active Ask bypasses).
   - Reset `heartbeatState.current` to `initialHeartbeatState()` on finger lift, pointer cancel, new primary touch, pointer promotion, scene change, exit, blur, hidden, and unmount.
   - No new timers added: driven by existing 60 ms `keepAliveTimer`.
   - Made sure `drivers.haptics.stop()` is called when Ask starts, Guide starts, on blur, and on hidden.

5. **i18n Translation Tables (`frontend/src/i18n/index.ts`):**
   - Added 4 keys across all 3 tables with strict parity:
     - `lab.settings.cornerHeartbeat`: English `"Corner heartbeat"`, Hindi `"कोना धड़कन"`, Gujarati `"ખૂણાના ધબકારા"`
     - `lab.settings.cornerHeartbeatHint`: English `"Repeating heartbeat vibration while resting on a corner."`, Hindi `"कोने पर रुकने पर दोहराया जाने वाला कंपन।"`, Gujarati `"ખૂણા પર રોકાવા પર પુનરાવર્તિત વાઇબ્રેશન."`
     - `lab.settings.cornerHeartbeatOn`: English `"Corner heartbeat enabled."`, Hindi `"कोना धड़कन सक्षम की गई।"`, Gujarati `"ખૂણાના ધબકારા સક્ષમ કર્યા."`
     - `lab.settings.cornerHeartbeatOff`: English `"Corner heartbeat disabled."`, Hindi `"कोना धड़कन अक्षम की गई।"`, Gujarati `"ખૂણાના ધબકારા અક્ષમ કર્યા."`
   - Honest copy: no string contains `"tested"`, `"approved"`, `"verified"`, `"checked"`, or `"correct"`.

---

## 2. Files Changed

| File | Type | Changes |
|---|---|---|
| `frontend/src/drivers/storage.ts` | Driver | Added `STORAGE_KEY_CORNER_HEARTBEAT`, `getStoredCornerHeartbeatSetting()`, `setStoredCornerHeartbeatSetting()`, and `_resetCornerHeartbeatSettingForTesting()`. |
| `frontend/src/components/LabSettings.tsx` | Component | Added Corner heartbeat switch section, toggle handler, state sync, and 48×48 px switch button matching Directions pattern. |
| `frontend/src/flow/explore.ts` | Flow | Extended `processPointerMove` with `heartbeatState` and `heartbeatCfg` trailing optional arguments, updated `MovePipelineResult`, re-exported heartbeat symbols. |
| `frontend/src/screens/Explore.tsx` | Screen | Added `heartbeatState` ref, updated all 6 `processPointerMove` call sites, stored state in `applyMoveResult`, reset state on 9 lifecycle events, ensured `haptics.stop()` on Ask, Guide, blur, hidden. |
| `frontend/src/i18n/index.ts` | i18n | Added `lab.settings.cornerHeartbeat*` keys across `en`, `hi`, and `gu`. |
| `frontend/tests/labSettings.test.tsx` | Test | Added tests verifying default off, role="switch", aria-checked="false", fixed label, min 48×48 px size, and Hindi/Gujarati localized render. |
| `frontend/tests/heartbeat.test.ts` | Test | Added comprehensive test suite covering all 6 Definition of Done criteria. |
| `docs/reports/agy-hb2-heartbeat-wiring-report.md` | Docs | This handoff report. |

---

## 3. Every `processPointerMove` Call Site Changed

All 6 call sites in `frontend/src/screens/Explore.tsx` were updated:

1. **Keep-alive ticker `onTick` callback (lines ~1427-1441):**
   - **Context:** `createHoldKeepAliveTimer.onTick` callback driving stationary touch haptics at 60 ms intervals.
   - **Arguments passed:** Added `DEFAULT_PROXIMITY`, `heartbeatState.current`, `getStoredCornerHeartbeatSetting() ? DEFAULT_HEARTBEAT : null`.
   - **State storage:** Dispatches to `applyMoveResult(moveResult, ...)` which sets `heartbeatState.current = moveResult.heartbeatState`.

2. **`handlePointerDown` with `askActive.current` true (lines ~1557-1574):**
   - **Context:** A touch-down while Ask speech recognition is active. Vibration and speech are suppressed, but hit testing and tracking continue.
   - **Arguments passed:** Added `DEFAULT_PROXIMITY`, `heartbeatState.current`, `getStoredCornerHeartbeatSetting() ? DEFAULT_HEARTBEAT : null`.
   - **State storage:** Explicitly sets `heartbeatState.current = moveResult.heartbeatState`.

3. **`handlePointerDown` normal path (lines ~1600-1616):**
   - **Context:** Primary pointer down touch on canvas.
   - **Arguments passed:** Added `DEFAULT_PROXIMITY`, `heartbeatState.current`, `getStoredCornerHeartbeatSetting() ? DEFAULT_HEARTBEAT : null`.
   - **State storage:** Dispatches to `applyMoveResult(moveResult, ...)` which sets `heartbeatState.current = moveResult.heartbeatState`.

4. **`handlePointerMove` with `askActive.current` true (lines ~1665-1682):**
   - **Context:** Pointer dragging while Ask voice listening is open.
   - **Arguments passed:** Added `DEFAULT_PROXIMITY`, `heartbeatState.current`, `getStoredCornerHeartbeatSetting() ? DEFAULT_HEARTBEAT : null`.
   - **State storage:** Explicitly sets `heartbeatState.current = moveResult.heartbeatState`.

5. **`handlePointerMove` normal path (lines ~1700-1715):**
   - **Context:** High-frequency per-move pointer dragging path across the diagram.
   - **Arguments passed:** Added `DEFAULT_PROXIMITY`, `heartbeatState.current`, `getStoredCornerHeartbeatSetting() ? DEFAULT_HEARTBEAT : null`.
   - **State storage:** Dispatches to `applyMoveResult(moveResult, ...)` which sets `heartbeatState.current = moveResult.heartbeatState`.

6. **`handlePointerLift` pointer promotion (lines ~1802-1817):**
   - **Context:** Oldest secondary pointer promoted to primary when the active primary lifts without lifting all touches.
   - **Arguments passed:** Added `DEFAULT_PROXIMITY`, `heartbeatState.current`, `getStoredCornerHeartbeatSetting() ? DEFAULT_HEARTBEAT : null`.
   - **State storage:** Dispatches to `applyMoveResult(moveResult, ...)` which sets `heartbeatState.current = moveResult.heartbeatState`.

---

## 4. Tests Added

1. **`frontend/tests/heartbeat.test.ts` (6 test suites):**
   - **Switch defaults to off:** Verifies `getStoredCornerHeartbeatSetting()` returns `false` when unset, updates on set, and resets on test teardown.
   - **Key parity and honest copy:** Asserts all 4 `lab.settings.cornerHeartbeat*` keys are present, non-empty, and identical in key set across `en`, `hi`, and `gu`. Asserts no string contains prohibited words ("tested", "approved", "verified", "correct", "checked").
   - **Accessibility & target size:** Verifies `LabSettings` renders Corner heartbeat switch with `role="switch"`, `aria-checked="false"`, fixed label, and touch target >= 48×48 px.
   - **Switch OFF identity:** Runs a multi-step trajectory across `triangle.json`, `sine.json`, and `barchart.json`. Asserts `vibrateCalls`, `toneCalls`, and `speakCalls` for switch OFF are strictly identical (`toEqual`) to a run with heartbeat arguments completely omitted.
   - **Switch ON 3 s hold on vertex B:** Simulates finger resting on Point B in `triangle.json` for 3000 ms at 60 ms keep-alive intervals. Verifies entry corner pattern `[50, 90, 50]` fires once, label "Vertex B" is spoken once, and exactly 3 beats fire at ~1900 ms, ~2800 ms, and ~3700 ms (each spaced by ~900 ms within one keep-alive tick). Spoken label does not repeat.
   - **Move onto side BC:** Moving from vertex B onto line segment BC calls `vibrate(80)` (line buzz) and no array pattern follows.
   - **Move into empty space within 100 ms of beat:** Moving off vertex 50 ms after a beat fires outputs `vibrate(0)` to halt the active beat.
   - **Lift, Ask, Guide guards:** Verifies `vibrate(0)` on lift with no subsequent vibration; verifies `drivers.haptics.stop()` called on Ask start and Guide start; verifies moves during Ask and Guide emit no vibrations.

2. **`frontend/tests/labSettings.test.tsx`:**
   - Added suite testing Corner heartbeat switch rendering in English, Hindi, and Gujarati with fixed label and aria-checked attribute.

---

## 5. Anything Unsure & Nuances

1. **`handleVoiceAsk` already stopped haptics:**
   - In `Explore.tsx`, `handleVoiceAsk` already had `drivers.haptics.stop()` inside its try block (`GT-02: Stop tone and haptics and mark askActive while voice listening is open`). As instructed ("If the existing code already does this on a path, leave that path alone and say so in the report"), that path already stops haptics, and we kept it intact.
2. **`drivers.haptics.stop()` added on remaining paths:**
   - Added `drivers.haptics.stop()` to `handleStartGuideFromOffer` (when user activates offered guidance), to `executeExploreCommand` -> `result.guideTarget` (when voice command initiates guidance), to `handleVisibilityChange` (on `document.hidden`), and to `handleWindowBlur` (on `window.blur`).
3. **Fixed label vs dynamic label:**
   - In accordance with Requirement 30.2 / 34 and the Directions switch pattern, the button has a fixed label (`t('lab.settings.cornerHeartbeat')`). The state is conveyed solely through `aria-checked` so TalkBack does not read the state twice (e.g. TalkBack announces "Corner heartbeat, switch, off" rather than "Corner heartbeat disabled, switch, off").
4. **Heartbeat state lifecycle reset locations:**
   - `heartbeatState.current` is reset to `initialHeartbeatState()` at:
     1. Finger lift (when all touches release)
     2. Pointer cancel (via `onPointerCancel={handlePointerLift}`)
     3. Lost pointer capture (via `onLostPointerCapture={handlePointerLift}`)
     4. New primary touch (in `handlePointerDown` before pipeline)
     5. Pointer promotion (in `handlePointerLift` when promoting oldest finger)
     6. Scene change (`useEffect([scene])`)
     7. Back gesture / exit button (`handleExit` and `unbindBack`)
     8. Document hidden (`handleVisibilityChange`)
     9. Window blur (`handleWindowBlur`)
     10. Component unmount (cleanup in mount effect)

---

## 6. Phone Checks (Plan Section d: "After lane hb2 lands")

The owner should verify the following on an Android phone (e.g. Chrome on Android) with TalkBack on and off:

1. **Switch default and toggle:**
   - Open Capture -> open Settings sheet ("Lab settings").
   - Locate "Corner heartbeat" switch. Verify it defaults to OFF (`aria-checked="false"`).
   - Tap the switch. Verify it announces "Corner heartbeat enabled." Spoken announcement should be clear and audible.
   - Close Settings, re-open Settings: verify switch remains ON (persisted in `localStorage`).
   - Toggle back OFF: verify it announces "Corner heartbeat disabled."

2. **Vertex rest feel (with switch ON):**
   - Open the Triangle sample.
   - Touch Corner B (bottom right).
   - Feel the initial corner double-tap pattern (`[50, 90, 50]`) and hear "Vertex B" announced once.
   - Keep finger stationary on Corner B for 4 seconds without moving.
   - **Perception check:** Feel the repeating slow double-tap pulse arriving every ~900 ms.
     - Does the motor produce two distinct pulses or do they blur into a single buzz?
     - Does the 60 ms keep-alive tick introduce perceptible jitter?
     - Confirm the corner label is NOT spoken again during the beats.
     - Confirm no audio tone plays while resting on the corner.

3. **Leaving the corner:**
   - While resting on Corner B, slide finger along side BC towards Corner C.
   - Verify the heartbeat stops immediately and transitions cleanly to the continuous line buzz (`vibrate(80)`).
   - From Corner B, slide finger off into empty space.
   - Verify vibration halts immediately (`vibrate(0)`).

4. **Finger lift:**
   - Rest on Corner B, wait for a beat, and immediately lift finger.
   - Verify motor goes silent immediately without any stray beat after lift.

5. **Microphone isolation (Ask & Guide):**
   - Rest on Corner B until heartbeat is active.
   - Activate "Ask" (or two-finger long press).
   - Verify motor immediately stops vibration so motor buzzing does not leak into the microphone while listening.
