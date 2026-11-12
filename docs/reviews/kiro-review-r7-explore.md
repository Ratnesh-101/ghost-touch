# Review: agy/r7-explore vs main

Scope: `git diff main...agy/r7-explore` (1 commit, e41e8b1, 14 files, +1183/-25) and the brief `docs/briefs/agy-r7-explore.md`.

Method and limits: I read the full diff and the branch versions of Explore.tsx and the new tests (via `git show`). I did NOT check out the branch or run tsc, vitest or the build, because checkout is blocked in this environment. All pass/fail statements about old code below come from reading the code, not from running it. The report's green claims are the lane's own and are unverified by me.

## Findings

### MEDIUM - frontend/tests/explore.askUnsupportedResetsGate.test.tsx (the final `pointerdown` + `expect(vibrate)...` block): EX-01 test would also pass on the old code
The test presses Ask with `canListen: false`, then fires a `pointerdown` on vertex A and expects a vibrate and a speak. Before this lane, `handlePointerDown` was not gated by `askActive`; only `handlePointerMove` was (Explore.tsx diff, hunk at the new line ~1182 adds the first pointerdown gate). So on the old code a stuck `askActive` does not suppress a pointerdown, and the assertions hold. The brief required "each test must fail on the old code". The brief's own wording ("a pointerdown on a vertex must still vibrate") has the same hole, because EX-02 had not landed yet.
Fix: after the Ask press, `pointerdown` somewhere neutral (for example off-diagram), then `pointermove` onto vertex A (100,100), and assert vibrate `[50, 90, 50]` and speak 'A'. Old code stays silent on pointermove (Explore.tsx old ~1271 gate), so the test fails there and passes on the fix. Alternatively, mutate-check by reverting the `finally` reset and confirming the test goes red; it currently would not.

### LOW - frontend/src/flow/ a11yFeatures.ts (pointQuota block, ~line 167-172): unused budget is not given back to points
`pointQuota = min(points, floor(max/2))` is applied whenever any other feature exists. With 80 points and 1 segment the result is 31 features, although 60 are allowed; 29 reachable points are dropped for no reason. Old code gave 60 points. The brief says "keep the total cap at 60" and gives 30 points only as an example. Not wrong, but a regression in coverage for point-heavy scenes with one or two other features (typical Raw Mode or Ghostwriter output).
Fix: after the water-fill, add `remaining` (what the other kinds did not use) back to the point quota: `pointQuota = min(points.length, maxFeatures - sum(allocated))`. Keep the 30-point reservation as the floor for other kinds, not as a ceiling for points. Add a test: 80 points + 1 segment => 60 features, 59 of them points.

### LOW - frontend/src/flow/a11yFeatures.ts (point filter, polyline filter)
Beyond the brief: points with non-finite x/y are now dropped, and polyline x/y arrays are filtered independently (`xs`, `ys`), which can misalign if only one coordinate of a pair is non-finite. The bounding box stays finite so there is no harm, but it is untested scope creep. Fix: either leave it or filter polyline points as pairs. No action required to merge.

### LOW - frontend/src/drivers/speech.ts (`speak(text, lang, options?: boolean | SpeakOptions)`)
The `boolean` shorthand is extra API surface nobody uses (only `{ queue: true }` is called). The brief asked for an optional queue flag with the default unchanged; that holds (default still cancels, and the existing cancel test is untouched). Fix: drop the boolean overload and its test, or keep it. Not blocking.

### LOW - Explore.tsx handlePointerDown EX-02 gate (new ~1182-1198)
The gated branch duplicates the pointermove branch (copy-paste of ~14 lines). While listening, the engine state is advanced silently, so a finger still resting on a vertex when listening ends will not re-announce it. This is the same behaviour as the existing pointermove gate, so it is consistent, just worth knowing. Fix (optional): extract a `silentMove()` helper.

### INFO - EX-03 ordering
`{ queue: true }` is correct: the real-driver test shows `['cancel','speak','speak']` and would fail on old code, which produced a second `cancel`. The w3.buzzFallback.test.tsx edit only adds the new third argument to an existing expectation; message and language assertions are intact, so no weakening.

## Per-fix verdict

- EX-01 (High): Code fix is correct. The outer `finally` now clears `askActive` and `setActiveSpeech(null)` on every exit, including the `!canListen` early return. Test is not discriminating (see MEDIUM).
- EX-02 (Medium): Fixed. Gate sits after pointer bookkeeping and before the centre tick and `applyMoveResult`, so there is no tone, vibration or speech while the mic is open, and idle behaviour is unchanged. Test sets up a pending listen, asserts silence, then asserts normal behaviour after resolve. It fails on old code. Good.
- EX-03 (Medium): Fixed, test is real.
- EX-05 (Low): Fixed on system Back and on unmount. `cancelListen` is called, `askActive` is reset and `askManager.abort()` is called. Both tests fail on old code. Good. The "Pass 2" relaxation to `toHaveBeenCalled()` applies to this lane's own new tests only (the double call on back plus unmount is legitimate), so no pre-existing test was weakened.
- CORE-A2 (Medium): Fixed. The 80-points + segment/polyline/axis test and the 40/30/30 fairness test both fail on old code (old code returned 60 points and nothing else). The points-only test keeps the full 60 and still passes. Existing "caps at 10 / default 60" test (points only) is unaffected. See the LOW about slack.
- CORE-A3 (Medium): Fixed. Non-finite bars are skipped, `maxValue` comes from finite bars, and NaN never reaches a label or target. Tests fail on old code. Good.

## Constraint checks

- Tuned haptic values: diff touches no vibration constants (`[50,90,50]`, 80/70/450, 25 are unchanged; they appear only as test expectations). OK.
- Kiro-owned files: no changes under `frontend/src/core/**`, `.kiro/**`, `*.prop.test.ts`, `test_*_props.py`, `backend/app/schema.py`, `validate.py` or `scene.gen.ts`. OK.
- Requirement 25: `flow/canvasSize.ts` is not in the diff. No JSX, CSS or overlay changes; the TalkBack overlay code is untouched except for the feature list builder. No layout-affecting overlays added. OK (Playwright canvas tests not run by me).
- Architecture: browser API use stays in `drivers/`; Explore.tsx only calls driver methods. No `any`, no `console.log` seen in the diff.
- Secrets: grepped the diff (src, tests, docs) for key/secret/token/AIza/sk- patterns: no matches. No `.env` touched. OK.
- Dependencies: no package.json or lockfile changes. OK.
- Process: the report and BUILD_LOG entry exist with the correct tool label. The report says no shell commands were run by the lane, yet it contains a "Pass 2: supervisor gate fixes" section for tsc/vitest failures. This is consistent with supervisor-run gates, so I treat it as the supervisor's results, not the lane's.

## Verdict

FIX FIRST - The production fixes for all six findings are correct and in scope, with no Kiro-owned, haptic, Requirement 25 or secret problems. But the High-severity EX-01 regression test would pass on the old code (it checks pointerdown, which was not gated before this change), which breaks the brief's "fails on old code" rule, and the a11y point cap needlessly drops up to 29 points when other kinds are sparse. Fix the EX-01 test (pointerdown neutral, then pointermove onto the vertex) and, ideally, hand unused budget back to points; then merge. I could not run tsc, vitest or the build myself, so re-run them on the branch before merging.

REVIEW-COMPLETE
