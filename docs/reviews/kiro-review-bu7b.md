# Kiro review: agy lane bu7b (A7 speech pacing and verbosity)

Reviewer: Kiro (read-only; this file is the only thing written).
Worktree: `gt-lane-bu7b`, HEAD `e279631`, changes uncommitted (`flow/explore.ts`, `screens/Explore.tsx`, `components/LabSettings.tsx`, `i18n/index.ts`, `tests/labSettings.test.tsx`, new `tests/speechPacing.test.ts`, new report).
Checked against: `fable-blind-user-plan.md` section 8 A7, Requirement 31 (T55), `tech.md`, `kiro-review-bu3-bu5.md`.
Line numbers are from the worktree files.

## Verdict: FIX FIRST

The design is right and the default is safe. But the lane does not compile (`tsc` fails) and one of the three tests the brief mandates fails. Both are small fixes. Two medium issues concern when the full bar value is spoken and what the tests prove.

Commands run (read-only): `npx vitest run tests/speechPacing.test.ts tests/labSettings.test.tsx` gives 33 passed, 1 failed. `npx tsc -p . --noEmit` gives 10 errors.

## Blockers

**H1. `tsc` fails, so `npm run build` fails.**
- `src/screens/Explore.tsx:1245`: `Cannot find name 'Effect'`. The new `const pacedEffects: Effect[]` uses a type that `Explore.tsx` does not import. Fix: import `Effect` from where `hapticEngine`/`core` exports it (the same place `runEffects` takes it from).
- `src/screens/Explore.tsx:83`: unused import `type SpeechDetail`. Remove it.
- `tests/speechPacing.test.ts:1,11,19,22,23,25,32`: unused `vi`, `extractCornerLabel`, `resetBarRest`, `SpeechDetail`, `SpeechPacingState`, `Lang`, `triangleScene`. Remove them (or use `extractCornerLabel` in a test, see L1).

**H2. The mandated x-axis wobble test fails.** `tests/speechPacing.test.ts:465`, `TypeError: t is not a function`. The loop `for (let t = 0; ...)` shadows the imported `t()` translator, so `t('explore.xAxis')` calls a number. It throws on the first spoken axis word. Fix: rename the loop variable (for example `ms`), or compare against a constant `'x-axis'`. After the fix, re-run to confirm the "at most twice in 3.3 s" assertion really holds, because that assertion has never run. The report (section 2) says it was "confirmed" but records no result.

## Medium

**M1. "Rested for 500 ms" is measured from entry, not from stillness.** `flow/explore.ts:1117-1124` stores `enterTime: t` when the reduced label is spoken. `checkBarRest` (`:1175-1196`) speaks the full value as soon as `t - enterTime >= 500` and the keep-alive timer fires, and the keep-alive fires after only 60 ms without a move (`explore.ts:631`, `shouldKeepAlive`). So a finger that slides 600 ms across a wide bar and then pauses for one tick hears "Q2, 25" immediately, while the finger was moving a moment ago. Requirement 31.3 says "after the finger has rested on that bar for 500 ms". Fix: track the time of the last pointer move on the bar (or the start of the current stationary run) and compare against that. Add a test: move on the bar for 700 ms, then pause 60 ms, expect no full value; pause 500 ms, expect the value.

**M2. The tests would stay green on broken code, and none touches the Explore wiring.**
- The bar sweep test (`:340-440`) checks only that consecutive utterances start at least 500 ms apart. That gap is set by the sweep speed (80 px at 120 px/s is 667 ms), not by `paceSpeech`. It passes in full mode as well as short mode, and it models no utterance length, so it cannot detect a cut label. It does confirm that the first bar is full, the others are labels, and the rest speaks "Q4, 32", which is useful, but "never cuts a label" is not tested.
- Test 4.3 (`:480-530`) and the pure tests call `paceSpeech` directly. Nothing renders `Explore`, so these can be deleted without a red test: the source mapping in `applyMoveResult` (`Explore.tsx:1245-1272`: vertex to 'corner', bar to 'bar'), the short-mode compass suppression (`:1275-1278`), the `pacedAxisCrossings` routing (`:1224-1235`), `checkBarRest` in `onTick` (`:1419-1433`), and the resets on lift (`:540`, `:1113`, `:1770`). This is the same gap as M3 in `kiro-review-bu3-bu5.md`.
- Fix: one jsdom test that mounts `Explore` with fake drivers and checks (a) short mode and a corner: spoken text is the label only and no compass; (b) full mode and a corner: the compass is still spoken; (c) an axis crossing 200 ms after a corner is not spoken; (d) a pointer lift clears a pending bar rest (no value spoken later). Add a pure property or table test that in full mode every non-axis text passes through unchanged and in the same order.

## Low

- **L1. The corner label cut in short mode is a string heuristic.** `extractCornerLabel` (`explore.ts:995`) keeps text up to the first `.`, `!`, `?`, `।` or `॥`. Short mode runs it on every speak effect while `target.kind === 'vertex'` (`Explore.tsx:1250-1256`), so a label such as "Point 1.5" or any other speak effect in that step is also trimmed. The unit test only covers "Point A. Down-right to B." Fix: take the label from the scene (vertex label) rather than the sentence, or test labels containing a dot.
- **L2. Rest speech is invisible to the pacing state.** The full value spoken by `checkBarRest` goes straight to `drivers.speech.speak` (`Explore.tsx:1428-1431`). It does not set `lastCornerOrBarTime`, so an axis crossing right after it can cut it, which is the failure A7 exists to stop. It also does not consult `lastSpeechStartRef` before speaking. Fix: record it as a 'bar' announcement in the pacing state.
- **L3. Dead and odd branch in `paceSpeech`.** `explore.ts:1083-1100` (the "querying rest dwell" branch inside `source === 'bar'`) returns the stored full text when a new bar text arrives with the same text after 500 ms. It is not covered by a test and `checkBarRest` already does this job. Remove it.
- **L4. Storage read cost.** `initialSpeechPacingState()` is called as the `useRef` argument (`Explore.tsx:270`), so it reads `localStorage` on every render. `getStoredSpeechDetailSetting()` is also read on every pointer move (`:1221`). Same pattern as L4 in the bu3-bu5 review. Read once per hold or use a lazy initializer.
- **L5. Settings spoken confirmation fires on re-selecting the same value** (`LabSettings.tsx` `handleSelectSpeechDetail`). Harmless. Skip when unchanged if wanted.
- **L6. Report has no run results.** `agy-bu7-speech-pacing-report.md` says what the tests prove but gives no counts or failures (brief said the orchestrator runs them, so this is expected). It should be corrected after H1 and H2 are fixed, because "Confirmed that..." for the wobble test is currently untrue.

## Branch state

`git diff main --stat` in the worktree shows deletions of `.kiro/specs/ghost-touch/*`, `docs/reviews/kiro-owner-decisions.md`, `docs/accessibility/TALKBACK_PHONE_TESTING.md`, `docs/reports/agy-bu10-report.md`, and a 190-line cut of `tests/haptic.corner.regression.test.ts`. These come from the worktree being based on an older commit than `main`, not from the lane (the lane's own `git diff HEAD` touches none of them). Rebase on `main` before merging so none of that is reverted, and re-run the suite after the rebase.

## What is clean

- **Tuned values and core:** `tech.md` unchanged. No change under `frontend/src/core/**`, `.kiro/**`, `*.prop.test.ts`, `schema.py` or `validate.py`. No `vibrate` call added or changed; haptic effects pass through `pacedEffects` untouched (`Explore.tsx:1245-1248`).
- **Default and demo:** default is `full` (`getStoredSpeechDetailSetting` returns `full` on a missing or invalid value). In full mode `paceSpeech` returns the text unchanged for corner, bar and other, so the demo changes only through the two axis rules, which Requirement 31.2 specifies.
- **No important speech dropped:** only `source === 'axis'` can return `null` from the pacing rules. Corner labels, bar text, Ask answers, errors and status text are never dropped. In short mode a bar value is reduced, not removed, and is spoken after the rest.
- **Ask and errors:** they do not go through `paceSpeech`. The rest speech is skipped during Ask, Guide and leaving (`Explore.tsx:1421-1425`).
- **Queue growth:** none. `paceSpeech` is stateless apart from one `pendingBarRest`, one timestamp per axis word (two words at most) and two timestamps. `speech.speak` replaces the previous utterance. The full value is spoken once per bar entry (`spoken: true`).
- **TalkBack double reading:** the rest speech sets the status message the same way as the other app speech, and `StatusText` does not use `aria-live` while the app speaks (see bu3-bu5 review), so no new double read.
- **Speech cutting other speech:** the axis rule reduces cuts by design. Remaining gap is L2.
- **Settings UI:** two buttons with accessible names, `aria-pressed`, at least 48 px, spoken confirmation. Strings exist in `en`, `hi` and `gu` and contain none of "verified", "correct", "checked", "approved".
- **Scope:** every touched file is on the brief's allowed list. Nothing unrequested found.

## Owner decisions

None new. The 600, 700, 500 and 2000 ms numbers are the plan's proposals (Requirement 31 says pending a phone test), so they are not "tuned" values. The default stays `full`; I recommend leaving it so for the Devpost recording.

## Phone checks only the owner can do

- Short mode at a normal bar sweep with TalkBack off and on: does each label finish before the next?
- Whether 500 ms of rest feels right once M1 is fixed.
- Axis wobble on the sine sample: "x-axis" at most about twice in 3 seconds.
