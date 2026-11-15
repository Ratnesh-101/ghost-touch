# Lane A4 Report: Near-Line Click ("Find the Line Again")

**Lane:** A4 (Near-Line Click Cue, Requirement 27, Task 51)  
**Author:** Antigravity (agy)  
**Date:** 2026-11-15  
**Status:** Complete — ready for review and phone tuning

---

## 1. Executive Summary

Lane A4 implements the "Find the line again" near-line click cue (Requirement 27). When the user's finger drifts off a line but remains within `radiusPx` (48 CSS px) of one, the app emits a soft audio click that speeds up, rises in pitch, and increases in loudness as the finger nears the line, panned horizontally toward the line. On a line inside the corner quiet window, clicks play at the closest setting to confirm turns while the line buzz is suppressed.

This feature is **audio only**: it never calls `haptics.vibrate` and leaves all tuned haptic values untouched.

---

## 2. Changes Implemented

### 2.1 Audio Driver (`frontend/src/drivers/audio.ts`)
- Added optional `playClick(hz: number, pan?: number, gain?: number): void` to the `AudioDriver` interface.
- Implemented `playClick` in `WebAudioDriver`:
  - Enveloped sine blip on its own dedicated `OscillatorNode` and `GainNode`.
  - Envelope duration <= 30 ms (total duration 25 ms, 2 ms attack time constant, 5 ms decay time constant).
  - Routes through `StereoPannerNode` when available on `AudioContext` (`panner.pan.value = clampedPan`), falling back cleanly to mono.
  - Nodes are disconnected on oscillator `onended`.
  - Never disturbs or mutes the continuous theremin oscillator or the guide tone.
  - Silent before `unlock()`, safe when suspended (resumes), and wrapped in `try/catch` so it never throws.

### 2.2 Drivers Entry Point (`frontend/src/drivers/index.ts`)
- Added `runProximityEffects(effects, drivers)` to dispatch proximity click effects to `drivers.audio.playClick`.
- Re-exported `type ProximityEffect`.
- Never calls `haptics.vibrate`.

### 2.3 Pure Flow Pipeline (`frontend/src/flow/explore.ts`)
- Extended `MovePipelineResult` with:
  - `nearest: NearestElement | null`
  - `proximityState: ProximityState`
  - `proximityEffects: ProximityEffect[]`
- Extended `processPointerMove`:
  - Calls `nearestElement(scene, finger, view, proximityCfg.radiusPx)`.
  - Calls `proximityStep(proximityState, { kind: 'move', t, distPx, dxPx, onLine, inQuietWindow }, proximityCfg)`.
  - `onLine`: `target.kind === 'line'`.
  - `inQuietWindow`: `t < nextEngineState.quietUntil`.
  - `distPx`: `null` if finger is on a vertex or inside a bar, or if `nearest === null`; otherwise `nearest.distPx`.
  - `dxPx`: `nearest ? nearest.dxPx : 0`.
  - Kept 100% pure: no side effects, DOM, or browser APIs.
- Added stored setting helpers:
  - `getStoredFindingSoundSetting(): boolean` (defaults to `true`)
  - `setStoredFindingSoundSetting(enabled: boolean): void`
  - `_resetFindingSoundSettingForTesting(): void`

### 2.4 Explore Screen (`frontend/src/screens/Explore.tsx`)
- Held proximity state in `useRef<ProximityState>(initialProximityState())`.
- In `applyMoveResult`: updates `proximityState.current = moveResult.proximityState` and runs `runProximityEffects(moveResult.proximityEffects, drivers)` immediately after `runEffects`.
  - This covers pointer down, pointer move, second-finger promotion, and the A1 hold keep-alive tick.
- Gated: skips proximity effects when `!getStoredFindingSoundSetting()`, `askActive.current` is true, or `guideController.current?.isGuiding()` is true.
- Sends proximity lift (`proximityStep(..., { kind: 'lift', t })`) on:
  - Pointer lift (all fingers lifted)
  - Promotion of secondary finger
  - Window blur (`blur` event)
  - Tab hidden (`visibilitychange` with `document.hidden`)
  - Exit via Back button or two-finger swipe
  - Component unmount
  - Voice ask start
  - Guide start

### 2.5 Lab Settings Sheet (`frontend/src/components/LabSettings.tsx`)
- Added "Finding sound" switch toggle section right below Directions.
- Stored in localStorage via `getStoredFindingSoundSetting` / `setStoredFindingSoundSetting` (default: ON).
- Accessible 48×48 px minimum target (`AccessibleButton` with `role="switch"` and `aria-checked`).
- Spoken announcements on toggle via `t('lab.settings.findingSoundOn')` / `t('lab.settings.findingSoundOff')`.

### 2.6 Internationalization (`frontend/src/i18n/index.ts`)
- Added string keys to `en`, `hi`, and `gu`:
  - `lab.settings.findingSound`: "Finding sound" / "खोज ध्वनि" / "શોધ ધ્વનિ"
  - `lab.settings.findingSoundHint`: "Clicking sounds guide your finger back to lines." / "क्लिक की आवाज़ आपकी उंगली को रेखाओं तक वापस ले जाती है।" / "ક્લિકનો અવાજ તમારી આંગળીને રેખાઓ પર પાછી લાવે છે."
  - `lab.settings.findingSoundOn`: "Finding sound enabled." / "खोज ध्वनि सक्षम की गई।" / "શોધ ધ્વનિ સક્ષમ કરી."
  - `lab.settings.findingSoundOff`: "Finding sound disabled." / "खोज ध्वनि अक्षम की गई।" / "શોધ ધ્વનિ અક્ષમ કરી."

---

## 3. Values to Tune on the Phone

Every proximity constant is proposed in `frontend/src/core/proximity.ts` (Requirement 27.9) and must be tuned on real phone hardware (Chrome on Android):

| Parameter | Proposed Value | Description | Phone Tuning Considerations |
|---|---|---|---|
| `radiusPx` | `48` CSS px | Near-line capture radius | Is 48 px wide enough to catch drifting fingers without triggering accidentally across empty space? |
| `lineRadiusPx` | `14` CSS px | Line hit radius (copied, not changed) | Matches tuned `DEFAULT_HAPTICS.lineRadius`. Inner threshold where cue reaches maximum rate/pitch. |
| `farMs` | `400` ms | Click interval at `radiusPx` | Is 400 ms slow enough to feel "far" without feeling like the app stalled? |
| `nearMs` | `90` ms | Click interval at or inside `lineRadiusPx` | Floor for click gap. Is 90 ms distinct and fast enough on budget phone speakers? |
| `loHz` | `500` Hz | Click pitch at `radiusPx` | Is 500 Hz clearly audible on phone bottom speakers? |
| `hiHz` | `1200` Hz | Click pitch at or inside `lineRadiusPx` | Is 1200 Hz piercing or pleasant? Does it stand out from the theremin tone (200–1000 Hz)? |
| `PROXIMITY_GAIN_FAR` | `0.3` | Loudness at `radiusPx` | Soft enough to not be startling when first entering the near-line zone. |
| `PROXIMITY_GAIN_NEAR` | `0.6` | Loudness at or inside `lineRadiusPx` | Clear, affirmative volume. |
| Click blip duration | `25` ms | Envelope stop time (<= 30 ms) | 2 ms attack, 5 ms decay. Does it sound like a crisp tap/click without popping or clicking from DC offset? |
| Stereo Pan | `[-1, 1]` | `Math.sign(dxPx) * min(1, \|dxPx\| / radiusPx)` | Effective on stereo headphones/earbuds; degrades gracefully to mono on phone speaker. |

### Key Questions for Phone Evaluation:
1. **Auditory discrimination:** Is the near-line click blip easily distinguishable from the theremin sine tone and the Guide tone when played simultaneously or sequentially?
2. **Quiet window turn confirmation:** When making a corner turn, does hearing rapid clicks during the 450 ms quiet window give students confidence that they are still on the line before the buzz resumes?
3. **Speed of motion:** Does the interval scaling feel natural when dragging quickly vs slowly?

---

## 4. Test Coverage Summary

Created `frontend/tests/nearLineClick.test.ts` and augmented existing suites:
1. **Fake AudioContext test:**
   - Proves `playClick` does not touch `thereminOsc` (no stop, no frequency or gain schedule changes).
   - Proves `playClick` does not touch `guideOsc` or `guideGain`.
   - Proves `playClick` before unlock is a safe no-op.
   - Proves `playClick` works in mono when `createStereoPanner` is undefined.
   - Proves node disconnection onended.
2. **Shrinking gaps trace (45 px to 15 px off side CA):**
   - Verified that a finger moving from 45 px to 35 px, 25 px, and 15 px off vertical segment CA produces successive clicks with shrinking time gaps (380 ms > 290 ms > 150 ms) and rising pitches (562 Hz < 768 Hz < 974 Hz < 1179 Hz).
3. **Negative tests:**
   - No clicks beyond 48 px.
   - No clicks on a line outside the quiet window (line buzz plays instead).
   - Clicks DO play on a line inside the quiet window (confirming turn).
   - No clicks after pointer lift.
   - No clicks dispatched when finding sound toggle is off.
4. **Haptics invariance:**
   - Executed an identical scripted trace through empty space, line entry, corner vertex, and quiet window with `findingSoundEnabled = true` and `findingSoundEnabled = false`.
   - Recorded `haptics.vibrate` calls: the two arrays of vibration patterns are 100% identical.
   - Proved `runProximityEffects` never calls `haptics.vibrate`.
5. **Settings & i18n tests:**
   - Switch button rendered, default on, accessible 48px targets.
   - Verified strings in English, Hindi, and Gujarati.

---

## 5. Files Touched

- `frontend/src/drivers/audio.ts`
- `frontend/src/drivers/index.ts`
- `frontend/src/flow/explore.ts`
- `frontend/src/screens/Explore.tsx`
- `frontend/src/components/LabSettings.tsx`
- `frontend/src/i18n/index.ts`
- `frontend/tests/nearLineClick.test.ts` (new)
- `frontend/tests/drivers.audio.test.ts`
- `frontend/tests/drivers.runEffects.test.ts`
- `frontend/tests/flow.explore.test.ts`
- `frontend/tests/LabSettings.test.tsx`
- `docs/reports/agy-bu4-near-line-click-report.md` (this report)
