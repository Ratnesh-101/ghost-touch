# Kiro review: commit 0f4bc97 (agy bu6, graph scan audio, Lane A6)

Read-only review. Checked against `.kiro/steering/tech.md`, `core/curve.ts` (Req 5.5, 5.6, P104-P108), the pure-core rule and `docs/reports/fable-blind-user-plan.md` section 8 A6. I did not run the tests. I read the diff and the surrounding code.

## Verdict: FIX FIRST

The audio logic is sound. Two things should be fixed before merge: the Hindi and Gujarati strings are literal question marks, and the tests do not cover the `Explore.tsx` wiring.

## What passes

- **Tuned haptics unchanged.** No `vibrate` call, pattern, `DEFAULT_HAPTICS` or radius is touched. The commit changes nothing under `frontend/src/core/**` or `.kiro/**`.
- **Pure core.** `scanTone` is in `flow/explore.ts` and only reads `curveYAtX` and `pitchForY`. All browser calls stay in `Explore.tsx` and `drivers/audio.ts`.
- **No overlap with the theremin.** `setTone(hz, level)` drives the one existing oscillator, so no second voice exists. The engine's polyline tone calls `setTone(hz)`, which resets the level to 1. A curve hit is therefore full gain and an off-curve hit is 0.33.
- **Lift.** `step({kind:'lift'})` emits `tone(null)`. The pointerup, cancel and lost-capture handlers all go through `handlePointerLift`.
- **Other stop paths.** Tone stops on Back, on scene change, on unmount, on Ask start, on Guide start, on window blur and on `document.hidden`.
- **Ask and Guide.** The scan block is skipped while `askActive.current` is true or `guideController.current?.isGuiding()` is true.
- **Settings toggle.** It is a `role="switch"` with `aria-checked`, a spoken on/off state, `minHeight: 48px`, a stored value and en strings. The default is on, as A6 specifies.
- **Other scene kinds.** `scanTone` returns null unless `scene.kind === 'function_graph'`.

## Findings

### 1. HIGH · `frontend/src/i18n/index.ts:892-895` and `:1342-1347` · hi and gu strings are literal `?`

I checked the bytes with `xxd`. The four new hi keys and four new gu keys are runs of 0x3f. The findingSound strings from the earlier lane have the same defect (lines 888-889). A Hindi or Gujarati user hears or reads "???????" when toggling Graph scan. The test at `graphScan.test.ts` only checks that each string is non-empty, so it passes on question marks.

Fix: rewrite the strings in real UTF-8 Devanagari and Gujarati. Add a test that fails when a hi or gu value matches `/^[?\s.]+$/`. Also repair the findingSound strings from the earlier lane.

### 2. HIGH · `frontend/tests/graphScan.test.ts` (sweep tests) · tests copy the `Explore.tsx` logic instead of running it

`simulateSweep` re-implements the scan-tone block, including `playingScanTone`, the guard and the stop branches. It never renders `Explore`. Several assertions check values the test itself writes:

- `toneLevel` is set to 1 by the test's own effect loop, so "level 1 on the curve" tests the test.
- "Vibrations identical on and off" cannot fail, because the simulation never touches `vibrate`.

No test fails if I delete or invert any of these in `Explore.tsx`:

- `!askActive.current` (`Explore.tsx` ~1236).
- `!guideController.current?.isGuiding()` (~1237).
- The `getStoredGraphScanSetting()` gate (~1235).
- The `window` blur and `visibilitychange` handlers (~412-437).
- `playingScanToneRef.current = false` on lift (~1690), on Back, and on Ask.
- The `setTone(null)` on scene change (~403).
- The else-branch that stops the tone when the setting is turned off mid-scan.

Fix: add a jsdom test of `Explore` with a fake audio driver that asserts:

- (a) The last `setTone` after a lift is null.
- (b) A `blur` event and a hidden `visibilitychange` each call `setTone(null)`.
- (c) No scan `setTone(hz, 0.33)` is made while Ask is active or Guide is guiding.
- (d) With the toggle off, `setTone` is never called with `level < 1`.
- (e) A real `vibrate` spy is identical with the toggle on and off.

### 3. MEDIUM · `frontend/tests/drivers.audio.test.ts:277-316` and `frontend/src/drivers/audio.ts:~224-233, 520` · earcon paths are untested

The new tests cover only the plain `setTone` path. There are two other level-scaled gain paths:

- The earcon-ducked branch of `setTone`.
- The restore-after-earcon call near line 520, which now uses `TONE_GAIN * this.activeToneLevel`.

Mutate either back to `TONE_GAIN` and every test still passes. A user who hears an earcon (for example the Back cue) while scanning would get full-volume restoration. Fix: add one test per path that plays `setTone(600, 0.33)`, plays an earcon, and expects the restore gain to be `0.15 * 0.33`.

### 4. MEDIUM · `frontend/src/flow/explore.ts` (`scanTone`, rounding block) · unrequested workaround for a float edge

A6 says to use `curveYAtX` and nothing more. The added retry at `Math.round(xNorm * 100000) / 100000` widens the audible x range by up to 5e-6. It exists to make the 0.9000000000000006 test pass. It is harmless, but it hides a boundary question that belongs to K4 (`curve.ts`, which is Kiro-owned). No test pins the rounding, so deleting the block changes behaviour silently.

Fix: either remove it, or report it under "Needs from Kiro" and cover it with a test at x = 0.9000000000000006.

### 5. LOW · `Explore.tsx` ~1107, 1128, 1181 · `playingScanToneRef` is not cleared on every lift

Three lift paths do not reset the ref. The only consequence is one extra `setTone(null)` on the next move, and the polyline and bar guards stop it from cutting the engine's own tone. The tone itself does stop, because the engine's lift effect emits `tone(null)`. Fix: clear the ref in a single helper that all lift paths call.

### 6. LOW · `Explore.tsx` ~412-437 · blur and hidden stop the tone once

If a pointer is still down after blur, the next `pointermove` restarts the scan tone. `WebAudioDriver` also has its own lifecycle listeners, which suspend the context. I judge this acceptable. A short test would document the behaviour.

### 7. LOW · `frontend/tests/graphScan.test.ts` (titles and comments) · en dash saved as `?`

Titles such as "Lane A6 ??? Graph scan pure function" show the same encoding damage as finding 1. This is cosmetic.

### 8. NOTE · default on changes the sine sample demo

Default on follows the plan. A finger anywhere inside the curve's x range on the sine sample now sounds at about one third of normal gain. The earlier demo and README steps describe the tone as sounding only on the curve. Update README step 5, `docs/DEMO_SCRIPT.md`, and the Devpost copy so the demo claim matches the shipped behaviour. This item does not block the merge.

## Mutation coverage, short list

Guards no test covers:

- Ask guard.
- Guide guard.
- Setting gate in `Explore.tsx`.
- Blur and hidden handlers.
- Lift and Back resets.
- Earcon-restore level.
- Rounding retry.
- hi and gu string contents.

Guards covered: `kind !== 'function_graph'` returns null, polyline target returns null, outside the x range returns null, level clamping and default level, and the default-on setting.

## Needed before MERGE

1. Fix the hi and gu strings (finding 1), including the earlier findingSound pair.
2. Add the `Explore` behavioural tests (finding 2) and the earcon-restore test (finding 3).
3. Remove or defer the rounding retry (finding 4).

Findings 5 to 8 can follow.
