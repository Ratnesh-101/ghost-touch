# Kiro review: lane hb2 (commit 9860495), corner heartbeat switch and Explore wiring

Reviewer: Kiro. Read-only review, 2026-11-16. Only this file was written.
Checked against: `docs/reports/fable-heartbeat-plan.md` (c, e hb2), `core/heartbeat.ts`, Requirement 34, `tech.md`.
Ran `vitest run tests/heartbeat.test.ts tests/labSettings.test.tsx tests/heartbeat.prop.test.ts`: 48 passed.
I did not mutate source to try the guards. The test findings below come from reading the tests.

## Verdict: FIX FIRST

The production wiring is correct and the feature is safe to ship OFF. I found no behavioural bug in the heartbeat path. The block is on test quality. The Explore wiring and the "stop on Ask, Guide, blur, hidden, lift" claims are not covered by any test that would fail if the wiring were deleted. Two Explore changes also alter output with the switch OFF, which breaks the stated acceptance ("identical to before"). Both are small.

## Findings

### 1. HIGH (tests) `frontend/tests/heartbeat.test.ts:550-626`: Ask and Guide test is tautological
The test sets `const askActive = true;` (line 607) and `const isGuiding = true;` (line 620), then wraps `runEffects` in `if (!askActive)` / `if (!isGuiding)`. It then asserts that no vibrate happened. That passes with any code. `drivers.haptics.stop()` is called by the test itself, not by Explore. The lift part calls `step()` directly in the test. Nothing here exercises `Explore.tsx`.
Fix: render the real Explore (as the existing Explore jsdom tests do) with fake timers and a fake `VibrateHost`. Assert after Ask start, Guide start, blur, hidden and lift that the last vibrate call is `0` and no array pattern follows when the keep-alive interval advances.

### 2. HIGH (tests) the whole Explore wiring is unguarded
`heartbeat.test.ts` never imports `Explore`. It only calls `processPointerMove` with the heartbeat arguments it passes itself. If every edit in `Explore.tsx` were reverted, all 48 tests would still pass. These guards have no covering test:
- `Explore.tsx:1442, 1574, 1614, 1683, 1713, 1813`: the `cornerHeartbeatSettingRef.current ? DEFAULT_HEARTBEAT : null` argument. Passing `DEFAULT_HEARTBEAT` always (switch ignored) stays green. The plan says "removing the switch guard turns it red"; it does not.
- `Explore.tsx:1263` and the other `heartbeatState.current = initialHeartbeatState()` resets (lift 1829, promotion 1796, new touch 1536, blur 1209, hidden 1186, exit 589/1165, scene change 456, Ask 609, Guide 554/704).
- `Explore.tsx:1290`: `heartbeatState.current = moveResult.heartbeatState` in `applyMoveResult`. Dropping it means the beat never advances in the keep-alive path, and no test notices.
- The `subscribeSettings` refresh and the `pointerdown` / promotion re-read of the setting ref (`Explore.tsx` around 1483 and 1785).
- The `drivers.haptics.stop()` calls added at 550, 701, 1177 and 1200.
The OFF test (`heartbeat.test.ts:181`) compares a call with the heartbeat arguments against one without them. That only checks `processPointerMove`'s own default. It does not show that Explore passes `null` when the setting is off.
Fix: same as finding 1. Add one real-Explore test with the switch OFF, a still finger on B for 3 s, that asserts exactly one array vibrate call (the corner pattern). Add one with the switch ON that asserts roughly one extra beat per 900 ms.

### 3. MEDIUM `Explore.tsx:550, 701, 1177, 1200`: new `drivers.haptics.stop()` calls run with the switch OFF
The plan asked for these. They are unconditional, so with the switch OFF a Guide start, blur and hidden event now send an extra `vibrate(0)` that was not sent before. It is harmless, since `step` lift already emits `vibrate(0)` on blur and hidden, and Guide start previously only cleared the tone. The acceptance says OFF output is identical, though, and finding 2's OFF test cannot see it.
Fix: either gate the new `stop()` calls on `cornerHeartbeatSettingRef.current`, or state in the report that they are deliberate, harmless OFF-path changes and cover them in a test.

### 4. MEDIUM `Explore.tsx:455, 608`: `engineState.current = initialState()` added on scene change and on Ask start
The plan asked only for the heartbeat state to be reset at those points. Resetting the engine state is a behaviour change with the switch OFF. After Ask ends with a finger still on a vertex, the engine now sees a first visit and repeats the corner pattern and the spoken label. Requirement 4.4 says it must not repeat. Scene change is harmless (new scene). Ask start is the real one.
Fix: remove the two `engineState.current = initialState()` lines at 455 and 608, or justify them and add a test. Resetting only the heartbeat state is enough for this lane.

### 5. LOW `core/heartbeat.ts`, `Explore.tsx`: no repeat cap, no time limit
While the finger rests on a vertex with the switch ON, the beat repeats without limit. Duty is about 190 ms per 900 ms (21%; the plan's "11%" counts 100 ms of motor-on time and is the motor-on fraction only). A student who rests on a corner for several minutes drains the battery faster than the plan states. The 10 s cap in the plan (line 391) applies only to the hb1 demo button. Requirement 34 sets none.
Fix: no change needed to merge, because the feature is opt-in. Record it for the owner's phone check as "does a long rest annoy or heat the phone". If a cap is wanted, add it in core as a new property (Kiro-owned), not in the shell.

### 6. LOW `Explore.tsx:1417` (keep-alive) beat lateness
`shouldKeepAlive` fires when `now - lastMoveAt >= 60` on a 60 ms `setInterval`. A tick can therefore land every 60 to 120 ms. A beat can be up to about 120 ms late, not 60 as the plan says. The schedule does not drift (`nextBeatAt += periodMs`). Phone check item only.

## Checks that pass

| Check | Result |
|---|---|
| Switch defaults OFF | Yes. `storage.ts` `getStoredCornerHeartbeatSetting` returns `false` when nothing is stored. Ref is refreshed on subscribe, pointerdown and promotion. |
| OFF means no call into heartbeat code | Yes for `processPointerMove`: `heartbeatCfg === null` skips `heartbeatStep` and returns the engine's `effects` array itself. (See findings 3 and 4 for the other OFF-path changes.) |
| Tuned values unchanged | Yes. `git show 9860495` touches no `core/**`, `.kiro/**` or `DEFAULT_HAPTICS`. `DEFAULT_HEARTBEAT` is only imported. |
| Pure core untouched | Yes. `core/heartbeat.ts` is not in the commit. It is DOM-free and has no timer. |
| Stops within one move on leaving the vertex | Yes. `heartbeat.ts` rule 7 puts `vibrate(0)` first when no engine vibrate arrives; on a line the engine's `vibrate(80)` replaces the beat. |
| Stops on lift, cancel, lost capture | Yes. All three use `handlePointerLift`, which runs `step` lift (`vibrate(0)`) and resets the state. |
| Stops on blur, hidden | Yes. `Explore.tsx:1177, 1200` call `haptics.stop()`, stop the keep-alive and reset the state. |
| Stops on Ask listening | Yes. `handleVoiceAsk` stops the keep-alive, calls `haptics.stop()` (610), and `shouldRun` returns false while `askActive`. Moves during Ask run `processPointerMove` but the effects are not run. State advances but the effects are discarded, so no beat is played. |
| Stops on Guide start, exit | Yes (550, 701, 589, 1165, 1263 unmount lift). |
| No overlap with 80 ms line buzz or corner pattern | Yes. The first beat is at least one period after entry (900 ms is at least 450 ms plus 190 ms), a beat is never added when the engine emitted a vibrate, and a line step emits the buzz instead. A centre tick `vibrate(25)` can clip one beat. This is accepted in the plan. |
| Vibration cancel path | Correct. One `vibrate` call per beat, `vibrate(0)` through `runEffects` to `WebHapticDriver.vibrate(0)`. A lost step stops by itself within 190 ms. |
| Keep-alive (bu1) interaction | No new timer. The existing tick passes the same arguments and stores `heartbeatState` via `applyMoveResult`. It stops on lift, blur, hidden, Ask and Guide, and so do the beats. |
| Switch accessibility | `role="switch"`, `aria-checked`, `minWidth/minHeight: 48px`, one fixed label, state spoken through `doSpeak` on toggle. Strings in en, hi and gu with parity and an honest-copy test. Static markup tests cover role, aria-checked and size. |
| Secrets, dependencies | None added. No `.env`, no `package.json` change. |
| Requirement 25 canvas | No layout change in this commit. |

## What to test on the phone (owner)
1. Switch OFF: triangle B, still finger 3 s. One corner pattern only, as before. Blur or lock the phone while on B: no stray buzz.
2. Switch ON: a beat about every 0.9 s. Slide to BC: line buzz at once. Slide into empty space: stops at once. Lift: stops.
3. Switch ON, start Ask while resting on B: no buzz over the microphone.
4. Rest on B for 2 minutes: is it annoying, does the phone warm.
5. Decide: owner approval of 900 ms and `[50, 90, 50]` is still pending (`tech.md`).

## Needed from the builder before merge
- Add real-Explore tests for findings 1 and 2 (switch OFF/ON and each stop path).
- Remove the two extra `engineState.current = initialState()` lines (finding 4), or justify them.
- Gate or document the unconditional `haptics.stop()` calls (finding 3).
