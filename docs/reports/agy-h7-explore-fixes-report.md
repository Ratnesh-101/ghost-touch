# Antigravity Lane Report: h7-explore-fixes

**Lane:** `h7-explore-fixes`  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-08  
**Status:** DONE  

---

## 1. Summary of Scope and Findings

This lane addresses defects identified in `docs/reports/audit-r3-speech-pointers.md` (R3-01..R3-08) and `docs/reports/audit-claude-explore-bughunt.md` (GT-01..GT-10).

| ID | Finding | Status | Description / Notes |
|---|---|---|---|
| R3-01 | Centre announcement cancelled on pointer-down | FIXED | Merged centre message into `applyMoveResult(..., centreAnnouncements)` calling `mergeAnnouncements([centreMsg, ...axisCrossings], effects)` so pointer-down at canvas centre on a vertex emits exactly one combined `speak` utterance. |
| R3-02 | `lastSpokenRef` stale on vertex/bar only speech | FIXED | Updated `lastSpokenRef` unconditionally from the merged speak effect (removed `moveResult.axisCrossings.length > 0` condition). |
| R3-03 | Copy-pasted move paths | FIXED | Extracted unified `applyMoveResult(moveResult, lang, extraAnnouncements)` helper used across pointer-down, pointer-move, and pointer-lift promotion paths. |
| R3-04 | SavedDiagrams `handleConfirmDelete` unmount guard | FIXED | Added `activeRef` set to `false` on unmount; created `confirmDeleteDiagram` in `flow/saved.ts` which returns early after await if inactive; functional update for `setEntries`. |
| R3-05 | `loadSavedList` raw join | FIXED | Joined diagram titles using `joinAnnouncements` instead of raw `.join('. ')`, avoiding duplicate punctuation (`..`, `।.`). |
| GT-01 | `handleVoiceAsk` re-entry | FIXED | Added `busyRef` and `askManager.current.isBusy()` re-entry guard at entry of `handleVoiceAsk`, cleared in `finally`. |
| GT-02 | Theremin tone / haptics / move speech during Ask | FIXED | At Ask start, stopped tone (`audio.setTone(null)`) and haptics (`haptics.stop()`), set `askActive.current = true`; `handlePointerMove` skips `runEffects` and axis crossings while listening. |
| GT-03 | Stuck tone on second-finger promotion | FIXED | On promotion in `handlePointerLift`, ran `step(engineState.current, { kind: 'lift', t: now })` and its silencing effects (`tone: null`, `vibrate: 0`) before resetting to `initialState()`. |
| GT-04 | Backgrounding without `pointercancel` breaks pointer tracking | FIXED | Cleared `activePointers`, `primaryPointerId`, and lifted engine state on `visibilitychange` (when `document.hidden`) and `window.addEventListener('blur')`; added `selfHealPrimaryPointer` in `handlePointerDown`. |
| GT-09 | Two-finger long-press timer not re-armed when finger count drops to 2 | FIXED | Extracted `armTwoFingerLongPressTimer(now)` and invoked it in `handlePointerLift` when `activePointers.current.size === 2`. |
| GT-07 | Listen timeout runs before mic granted | SKIPPED (Needs from planner) | Fake recognition in `tests/drivers.speech.test.ts` (an existing file not in allowed files) does not implement or dispatch `onstart`/`onaudiostart`; starting the 6 s timeout on `onstart` breaks the test harness. Per brief ("only if the fake recognition in the tests allows it; otherwise 'Needs from planner'"), deferred to planner to update fake recognition. |
| GT-05 | Teacher's shared link cold open speech blocked | SKIPPED | Not in scope per brief (`App.tsx` owned by lane h6). |
| GT-06 | saveDiagram failure cancels Explore announcement | SKIPPED | Not in scope per brief (`App.tsx` owned by lane h6). |
| GT-08 | `setPointerCapture` throwing `InvalidStateError` | SKIPPED | Already try/caught in current code (`Explore.tsx:908-913`). |
| GT-10 | Ask button focus steals audio on TalkBack | SKIPPED | Not in scope per brief. |
| R3-07 | `hitTest.findBar` NaN bar value | SKIPPED (Needs from planner) | Core file `frontend/src/core/hitTest.ts` is forbidden per brief and AGENTS.md rule 1. |
| R3-08 | Focus after delete device check | SKIPPED | Device check / info finding, not in scope per brief. |

---

## 2. Detailed Implementation Notes

### R3-01, R3-02, R3-03: Explore Move Pipeline & Announcement Merging
- **Extracted `applyMoveResult`**: Created a single helper in `frontend/src/screens/Explore.tsx`:
  ```ts
  const applyMoveResult = (
    moveResult: ReturnType<typeof processPointerMove>,
    lang: string,
    extraAnnouncements: readonly string[] = [],
  ): void => {
    engineState.current = moveResult.nextEngineState;
    centreTickState.current = moveResult.centreCheck.nextState;
    axisState.current = moveResult.nextAxisState;

    if (moveResult.centreCheck.tick) {
      drivers.haptics.vibrate(CENTRE_TICK_MS);
    }
    const moveEffects = mergeAnnouncements(
      [...extraAnnouncements, ...moveResult.axisCrossings],
      moveResult.effects,
    );
    const joined = moveEffects.find((e) => e.kind === 'speak');
    if (joined?.kind === 'speak') {
      lastSpokenRef.current = joined.text;
    }
    runEffects(moveEffects, drivers, lang);
  };
  ```
- **R3-01**: In `handlePointerDown`, `centreAnnouncements = centreResult.speakCentre ? [t('explore.centre')] : []` is passed into `applyMoveResult`. This joins `"Centre."` and any vertex/bar announcement (e.g. `"Centre. Point A"`) into exactly one utterance passed to `runEffects`, avoiding utterance cancellation.
- **R3-02**: `lastSpokenRef.current = joined.text` runs unconditionally when any speak effect is present in `moveEffects`, fixing stale `lastSpokenRef` when moving over vertices or bars without crossing axes.
- **R3-03**: All three move execution points (`handlePointerDown`, `handlePointerMove`, and `handlePointerLift` promotion) now call `applyMoveResult`.

### R3-04 & R3-05: Saved Diagrams Unmount Guard and Announcement Joining
- **R3-04**: In `frontend/src/flow/saved.ts`, added `confirmDeleteDiagram(store, id, isActive, onDeleted, onError)` which checks `if (!isActive()) return;` after awaiting `store.delete(id)`. In `frontend/src/screens/SavedDiagrams.tsx`, `activeRef` is marked `false` on unmount. If the user navigates away before deletion finishes, `onDeleted` is skipped and no speech or focus changes occur. `setEntries` uses a functional updater.
- **R3-05**: `loadSavedList` uses `joinAnnouncements(entries.map((e) => e.title))` rather than `.join('. ')`. Titles ending in danda or periods are not double-punctuated.

### GT-01, GT-02: Voice Ask Guarding & Effect Suppression
- **GT-01**: In `Explore.tsx`, added `busyRef = useRef(false)`. At the top of `handleVoiceAsk`, `if (busyRef.current || askManager.current.isBusy()) return;` prevents concurrent asks. `busyRef.current = false` is placed in outer `finally`.
- **GT-02**: At the start of `handleVoiceAsk`, `askActive.current = true`, `drivers.audio.setTone(null)`, and `drivers.haptics.stop()` are executed. While `askActive.current` is true, `handlePointerMove` runs pipeline tracking but skips `runEffects` and axis crossings, keeping the microphone clean of feedback. When `listen()` resolves or rejects, `askActive.current = false`.

### GT-03: Tone Stuck on Second-Finger Promotion
- In `handlePointerLift`, before promoting the surviving pointer and resetting `engineState.current = initialState()`, we run `step(engineState.current, { kind: 'lift', t: now })` and pass its effects (`{ kind: 'tone', hz: null }`, `{ kind: 'vibrate', pattern: 0 }`) to `runEffects(liftResult.effects, drivers)`. This silences the line tone that was playing under the lifted finger before the second finger is processed.

### GT-04: Pointer Tracking Resilience & Self-Healing
- On `visibilitychange` (when `document.hidden`) and on `window.addEventListener('blur')`, `activePointers.current.clear()`, `primaryPointerId.current = null`, `clearLongPressTimer()`, and engine lift effects are dispatched.
- Added pure helper `export function selfHealPrimaryPointer(primaryId, activePointers)`. In `handlePointerDown`, if `primaryPointerId.current !== null` but is missing from `activePointers.current`, it self-heals by resetting to `null`, preventing the canvas from becoming unresponsive.

### GT-09: Re-arming Two-Finger Long-Press Timer
- Extracted `armTwoFingerLongPressTimer(now)` which clears any existing timer, re-baselines `pointer.start = { ...pointer.current, t: now }` for both remaining pointers, and arms the `TWO_FINGER_LONG_PRESS_MS` timeout.
- In `handlePointerLift`, if `activePointers.current.size === 2`, `armTwoFingerLongPressTimer(now)` is called.

---

## 3. Needs from Planner

1. **GT-07 (`speech.ts` 6 s timeout on `onaudiostart` / `onstart`)**:
   `FakeRecognition` in `tests/drivers.speech.test.ts` does not implement `onstart` or dispatch it during mock tests. Modifying `WebSpeechDriver.listen` to only start the timer inside `onstart` causes `tests/drivers.speech.test.ts` to fail because the fake recognizer never fires the event. Updating `tests/drivers.speech.test.ts` is forbidden by this lane's file constraints. The planner should update the test mock `FakeRecognition` to dispatch `onstart` on `start()`, after which `speech.ts` can move the timer trigger.
2. **R3-07 (`core/hitTest.ts` bar value NaN)**:
   Per AGENTS.md rule 1 and the brief instructions, `frontend/src/core/**` is forbidden for this lane. Kiro or the core owner must add `!Number.isFinite(bar.value)` in `core/hitTest.ts`.

---

## 4. Verification and DoD Evidence

All commands run from repo root:

- `npm --prefix frontend test`:
  ```
  Test Files  119 passed (119)
       Tests  1606 passed (1606)
    Duration  2.09s
  ```
- `npm --prefix frontend exec -- tsc -p frontend --noEmit`:
  ```
  Clean (exited with code 0, 0 errors).
  ```
- `npm --prefix frontend run build`:
  ```
  vite v8.3.5 building client environment for production...
  ✓ 129 modules transformed.
  dist/assets/index-BsQBjiUb.js 495.84 kB │ gzip: 143.99 kB
  dist/assets/pdf-ULJPBbF3.js 430.16 kB │ gzip: 129.27 kB
  PWA v2.0.0
  precache 22 entries (661.80 KiB)
  Clean (exited with code 0).
  ```

---

## 5. Files Touched

- `frontend/src/screens/Explore.tsx`
- `frontend/src/screens/SavedDiagrams.tsx`
- `frontend/src/flow/saved.ts`
- `frontend/tests/h7.explore.fixes.test.ts`
- `docs/reports/agy-h7-explore-fixes-report.md`
- `docs/BUILD_LOG.md`
