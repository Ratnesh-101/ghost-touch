# Kiro review: agy lanes bu3, bu4, bu5

Reviewer: Kiro (read-only; this file is the only thing written).
Commits: `3550acc` (bu3 corner compass, line dwell), `de960df` (bu4 near-line click, audio driver), `35e4904` (bu5 where-am-I).
Checked against: `tech.md`, Requirements 26 and 27, the pure-core rule, `docs/reports/fable-blind-user-plan.md` section 8 A3, A4, A5.
Line numbers are from the tree at `35e4904`. Commit `0f4bc97` (bu6) landed while I was reviewing and was not reviewed. It only adds to `Explore.tsx`, so the line numbers here shift by about 70 there.

## Verdict: FIX FIRST

No tuned value moved and no Kiro-owned file was touched. The blockers are a spec miss on corner touch-down, a line-name cue that fires while tracing and can cut off the corner speech, and tests that cannot fail when the Explore wiring is removed. Three owner decisions are listed at the end.

Checks run: `tsc --noEmit` is clean. 9 related test files pass (203 tests). The run happened after bu6 landed, so it includes bu6. Passing says little here; see M3.

## What is clean

- `tech.md` is unchanged. The K3 proximity row is still PROPOSED. No haptic constant changed. `vibrate(25)`, `[50, 90, 50]`, 80/70 ms and 450 ms are untouched.
- `frontend/src/core/**`, `*.prop.test.ts`, `schema.py`, `validate.py` and `.kiro/**` are not in any of the three diffs. `core/compass.ts` and `core/proximity.ts` are consumed as-is.
- No call to `haptics.vibrate` was added for the click cue. `runProximityEffects` only calls `audio.playClick`.
- `playClick` uses its own oscillator and gain, stops after 25 ms, and disconnects `onended`. It leaves the theremin and guide nodes alone and is a no-op before unlock (`ctx === undefined`). Nothing can stay playing after lift or blur, because the longest sound is 25 ms.
- Click effects are dispatched only from `applyMoveResult`. That function is reached only after the Guide and Ask early returns in `handlePointerDown` and `handlePointerMove`, and the keep-alive `shouldKeepAlive` already excludes Ask and Guide. It also has its own `askActive`/`isGuiding` check (`Explore.tsx:1191-1195`).
- The where-am-I dwell passes `isAskActive` and `isGuiding`, and it is reset on lift, blur, hidden and exit.
- `.gt-explore__status-card` has a fixed `height: 5rem` with a 3-line clamp, so the long line-name and where-am-I strings cannot move the canvas (Requirement 25.4). `StatusText` renders no `aria-live` when the app speaks, so TalkBack does not double-read the new messages.
- The new switches (Directions, Finding sound) are `role="switch"` with `aria-checked`, at least 48 px, and speak their new state. Strings exist in en, hi and gu.

## Issues

### Medium

**M1. Landing on a corner with a new touch gives no compass.** `Explore.tsx:1426` (`handlePointerDown`) calls `checkLineDwell` but not `checkVertexCompass`, and it then sets `prevTargetRef` to the vertex. The A3 acceptance says that landing on A from empty space speaks both edges. Landing by touch-down on a corner speaks only "A", and a later move cannot say it either, because the corner is no longer a new entry.
Fix: call `checkVertexCompass(moveResult.target, now)` in `handlePointerDown` and pass the result as `afterAnnouncements`, as the move and tick paths do. Add a test that renders `Explore` and does a pointerdown on a vertex.

**M2. The line name fires while the finger keeps moving, and it can cut off other speech.** `Explore.tsx:1220-1245` (`checkLineDwell`) measures only the time since entering a line id (`LINE_DWELL_MS = 800`). It never checks that the finger has stopped. A3 says "resting 800 ms". An ordinary trace along a side therefore announces "Side AB. Up-left to A, down-right to B." about 0.8 s after entering the side. It also does not look at `lastSpeechStartRef`, unlike where-am-I, so it calls `speech.speak` while the corner label and compass ("A. Down-right to B.") may still be playing. `speak` cancels the previous utterance. The result is a speech flood on every traced side, and the compass just given is repeated by the line name.
Fix: require movement under a small threshold, as `WHERE_AM_I_REST_MAX_MOVE_PX` does, or at least apply the `WHERE_AM_I_SPEECH_QUIET_MS` guard. Add a test for both.

**M3. Tests would stay green if the Explore wiring were deleted.** No test renders `Explore` for A3 or A4, so none of these is covered: `checkVertexCompass` and `checkLineDwell`; the arrival-edge memory (`prevTargetRef`); the 10 s revisit window; the Ask/Guide/Directions guards. For A5 the pure dwell machine is tested, but not how Explore calls it.
- `cornerCompass.test.ts:369-434` ("haptic invariance, toggle on and off") runs `processPointerMove`, which never reads the Directions setting. It cannot fail.
- `nearLineClick.test.ts:446-486` ("no clicks with the toggle off") reproduces the guard in the test body (`if (getStoredFindingSoundSetting()) runProximityEffects(...)`). Deleting the real guard at `Explore.tsx:1191-1195` leaves it green.
- `nearLineClick.test.ts:488-597` ("vibrate calls identical with the toggle on and off") has the same flaw. It also runs no Explore code.
- Nothing tests "no click during Ask, during Guide or after lift", which is an A4 acceptance item.
- `whereAmI.test.ts:330-358` passes `isAskActive: true` to the pure function. It does not show that Explore passes the real flags.
Fix: add at least one jsdom or Playwright test. It should mount `Explore` with fake drivers and check four things: (a) no `playClick` and no extra speech while Ask is listening or Guide is guiding; (b) no `playClick` with Finding sound off; (c) no compass or line name with Directions off; (d) the vibrate and tone calls are identical with the settings on and off. Mutating each guard should turn one of these red.

**M4. Default-on for a PROPOSED, phone-untested cue, and an auto-speech cue with no switch.** Finding sound and Directions default to on (`storage.ts` and `flow/explore.ts:44-52`; the plan says default on). The click numbers are still "proposed, pending owner approval, not phone-tested" in `tech.md` and Requirement 27.9, and the live app now uses them by default. Gain 0.3 to 0.6 is 2 to 4 times the theremin's 0.15. A resting finger near a line clicks every 90 to 400 ms, and the clicks continue under the line-name and where-am-I speech with no ducking. Separately, the 1200 ms where-am-I dwell speech (`Explore.tsx:1278-1291`, `1524-1540`) has no setting. The Directions switch text says "corners and line names", so it does not cover it. The "Try it in 60 seconds" steps in the README no longer describe what the demo does (corners now speak directions).
Fix: owner decision (see below). The where-am-I dwell should sit behind the Directions switch or its own switch.

**M5. Files edited outside the lane's allowed paths, and a test written to match.** bu5 changed `frontend/src/styles/global.css` and `frontend/vitest.config.ts`, which are not in A5's allowed list. It copied the `.gt-explore__where-am-i` rule into `global.css` with the comment `Test regex requirement` (a duplicate of the `explore.css` rule), and widened the vitest CSS include to `explore.css`. The new touch-target test in `screens.render.test.ts` also falls back from `explore.css` to `global.css` (`raw = ... ? exploreCss : css`), so it can pass without checking the file it names.
Fix: remove the duplicate rule. Either keep the config change with the owner's approval, or have the test read the one CSS file directly. Report the out-of-scope edits under "Needs from".

### Low

- **L1. Hard-coded numbers in `commands.ts`.** The 22 px vertex radius (`:454`) duplicates `DEFAULT_RADII` and will drift. The touching/close/far limits 14 and 60 (`:500-502`) are spec'd, but the 14 should come from the line radius.
- **L2. `whereAmI` ignores bar interiors.** `commands.ts:419` uses only `nearestElement`. A finger inside a tall bar can hear "bar Q2, far". A5 does not cover it, but the button and the voice command can both reach it. Use the `hitTest` bar result first.
- **L3. Where-am-I "speech still playing" is a timestamp guess.** `lastSpeechStartRef` is updated only by move speech, line names, feature speech and the button (`Explore.tsx:1185, 1238, 1291, 1668, 1684`). Ask answers, Guide arrival, overview and earcon speech are not recorded, so a 1200 ms rest can cut off an Ask answer. Prefer the speech driver's speaking state if it has one.
- **L4. `localStorage` is read on every pointer move.** `getStoredFindingSoundSetting()` runs per move (`Explore.tsx:1191`), and the Directions check runs per vertex entry and dwell. Read once per hold or subscribe to changes.
- **L5. A test assertion was dropped to make a test pass.** `guide.ui.explore.test.tsx:123` lost `expect(html).not.toContain('role="switch"')`, because the Directions switch is now always present. Narrow it to the Guide switch rather than deleting it. In `explore.askUnsupportedResetsGate.test.tsx` the `'A'` expectation was loosened to `/^A[. ]/`, which is acceptable given the compass.
- **L6. Finding-sound storage lives in `flow/explore.ts` (`:44-61`).** The Directions storage is in `drivers/storage.ts`. Put both in one place. `LabSettings` imports from `flow/explore` for this.
- **L7. Switch label repeats its state.** The button text is "Directions enabled." while `aria-checked` says on, so TalkBack reads the state twice. Use a fixed label ("Directions") and let `aria-checked` carry the state.
- **L8. Orphaned i18n keys.** `commands.whereNearVertex`, `commands.whereNearLine` and `commands.whereEmpty` are no longer used by any source file. Remove them or note why they stay.
- **L9. Layout at 360 px not verified.** The new "Where am I" button sits in `.gt-explore__actions` (`flex-wrap: wrap`, each `flex: 1`, `min-height: 52px`). With Back, Where am I, Ask, Correct and Guide me, the row may wrap and make the canvas shorter. This is a steady layout, not a Requirement 25 growth, but it is not covered by the e2e canvas test. Run it at 360x640 and 390x844.

## Decisions for the owner

1. Finding sound default: on (as briefed) or off until the click values are tuned on the phone? I lean off. `tech.md` still marks the cue PROPOSED, and an off default also keeps the live demo and README steps unchanged.
2. Directions default on changes the demo audio at every corner. Keep it on and update the README "Try it" steps, or ship it off for the Devpost recording?
3. Where-am-I dwell: allow it to be switched off, and under which Settings switch?

## Phone checks that only the owner can do

- Click gain and pitch against the theremin, TTS and one earbud.
- The 800 ms line name and 1200 ms where-am-I timing while tracing, on a real trace, with TalkBack off and on.
- Corner touch-down speech after M1.
