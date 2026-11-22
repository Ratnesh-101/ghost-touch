# Kiro review of lanes hi3 (highlight) and hi4 (Help button)

**Verdict: FIX FIRST.** hi3 (`ceecc37`, Requirement 49) meets task 81.1 with one medium edge case. hi4 (`f4d747b`, Requirement 50) does not yet meet task 81.2: Raw Mode never reaches the Help sentence in the live app, the Hindi and Gujarati guide sentences name phrases the voice parser rejects, and one mutant survives.

Reviewed 2026-11-20 at main `f4d747b`+`ceecc37`. Checked against Requirements 49 and 50, `kiro-review-hi.md`, CLAUDE.md, `tech.md`. No source file was changed (mutants were applied and reverted; `git status` clean after each).

## What I ran

| Check | Result |
|---|---|
| `vitest run` (whole frontend) | 240 files, 3059 passed, 1 todo |
| `tsc -p . --noEmit` | clean |
| Playwright `explore.canvas-stable` + `explore.actions-layout`, both Galaxy projects | 22 passed (neither lane report records running these) |
| Oracles H1-H5, E1-E5, P158 | all pass as plain `it` (no `.fails` left) |
| Mutant A (hi3): remove `clearHighlight()` on all-fingers-lifted (`Explore.tsx` ~2331) | **Killed**: H3 and 4 tests in `explore.highlight.test.tsx` fail |
| Mutant B (hi4): `raw: isRaw === true` replaced by `raw: true` (`Explore.tsx` 2437) | **Survived**: 21/21 pass |
| Extra mutants (clear removed at `visibilitychange` 1462, `blur` 1489, scene change 676, in-app Back 817) | 1462 and 1489 killed; 676 and 817 survive |

Tuned haptic values untouched. `frontend/src/core/**`, `.kiro/**`, `schema.py`, `validate.py` untouched by both commits. Edits to Kiro-owned test files are limited to removing `.fails` (`explore.highlight.oracle`, `explore.help.oracle`, `help.prop.test.ts` line 120), which the brief told the lanes to do. H5 (draw-only trace) still passes, so the highlight adds no vibrate, tone, speak or earcon (49.6). Highlight is drawn into the canvas bitmap, no element added (49.7); no animation (49.8); no Settings switch (49.10); `data-highlight` present (49.11).

## Strings (Requirement 50.7)

All seven keys exist in `en`, `hi`, `gu` (21 lines), none blank, hi and gu differ from English, and none contains verified, correct, checked or approved (regex over the 21 lines: 0 hits). `translation-review.csv` and `.md` have the seven rows. The Hindi and Gujarati are real sentences, not English or transliteration, and read naturally. Two wording problems are listed below (issues 2 and 5), and they are about accuracy to the app, not about translation quality.

## Issues

| # | Severity | File:line | Problem | Fix |
|---|---|---|---|---|
| 1 | High | `screens/Explore.tsx:2437` (and `App.tsx:774`) | Help passes `raw: isRaw === true`. `App.tsx` renders `<Explore>` without `isRaw`, so the prop is always `undefined` and `help.raw` is never spoken in the live app, including for Raw Mode scenes. Explore already computes the right value at line 720 (`isRawScene`, from `isRaw ?? (kind === 'unknown' \|\| announced includes raw.announce)`). E3 and the hi4 test pass only because the rig sets `isRaw`. The lane followed Requirement 50.4 as I wrote it, so the defect is in my spec text too. | Use `raw: isRawScene`. Kiro will amend 50.4 to say "the screen's own Raw Mode decision". Add a test with a Raw scene and no `isRaw` prop. |
| 2 | Medium | `i18n/index.ts:1101` (hi), `:1629` (gu) | `help.guide` breaks Requirement 50.8 ("may not promise a gesture the app does not have"). I ran `parseExploreCommand(x, true)`: Hindi "ले चलो बी" and Gujarati "લઈ જાઓ બી" (verb first, as the sentence says) give `unknown`; the app only accepts "बी पर ले चलो" / "બી પર લઈ જાઓ". Hindi "चोटी ढूंढो" gives `guide_to "चोटी"` (a label search that fails), not the peak. "शिखर ढूंढो" and Gujarati "શિખર શોધો" give `guide_semantic peak`. Stop words work in all three languages. | Hindi: `... बोलें, कोने का नाम और फिर पर ले चलो, या बोलें शिखर ढूंढो।` (label first, then "पर ले चलो"; peak word is `शिखर`). Gujarati: label first then `પર લઈ જાઓ`; keep `શિખર શોધો`. Update both CSV rows. Native review still needed. |
| 3 | Medium | `tests/explore.help.oracle.test.tsx` E2/`expectOneUtterance`, `tests/explore.helpButton.test.tsx` | Mutant B survives: no test asserts `help.raw` is absent when the scene is not raw, and `expectOneUtterance` checks only that expected sentences appear in order, not that no extra ones do. This is my oracle's gap. | Kiro adds to E2: `expect(spoken).not.toContain(tables.en['help.raw'])` and `toHaveBeenLastCalledWith({raw:false,...})`. Re-run mutant B and confirm it dies. |
| 4 | Medium | `screens/Explore.tsx` guide start (~778, ~937), guide branch of move (~2128) and of lift (~2234) | While Guide is guiding, `applyHighlight` is never called and the guide branch of the lift handler returns before `clearHighlight()`. If a finger is on a line when guiding starts (voice "take me to B"), the highlight stays frozen on that element for the whole guide and after the lift, until the next touch. This breaks 49.5 (clear on lift). Guide is off by default, so impact is limited. No test covers it. | Call `clearHighlight()` and redraw in `startGuide` and in the guide lift branch. Add an oracle: finger on A, start guide, lift, expect `data-highlight` `none`. |
| 5 | Low | `i18n/index.ts:1099` (hi), `:1627` (gu) | `help.back` says "बैक दबाएं" / "બેક દબાવો", but the button is named `वापस` (`common.back` 690) and `પાછા` (1217). A TalkBack user hears a different word from the one spoken. | Use `वापस` and `પાછા` in the sentence. |
| 6 | Low | `screens/Explore.tsx:676`, `:817` | Clears on scene change and in-app Back have no test (mutants survive). Back also clears again on unmount (1548) so it is redundant; scene change is the real exposure. | Add a rerender-with-new-scene test, or accept. |
| 7 | Low | `renderHighlightElement` (Explore.tsx ~273-420) | A vertex is drawn as a white dot with a dark ring plus its label text. 49.4 asks for a larger, brighter dot, and 49.9 forbids adding texture or regions; the label is new text on the canvas and white is not a tint of the line colour. Segments, polylines, axes and bars use 8 px `#a6ffcc` with 16 px glow, which matches 49.4. Nothing here can be seen in jsdom; the owner has not seen it on a phone. | Phone check; drop the label text if it clutters. |
| 8 | Low | `handleHelpClick` (Explore.tsx ~2232) | The ~300-character help text goes into the status line, which is fixed at 5 rem and clamped to 3 lines (Req 25), so a sighted observer sees only the first lines. Layout is safe (e2e passed), but no e2e presses Help. | Optional: show only `t('explore.help')` in the status line, or add Help to the layout spec. |

## Task ticks

- **81.1 ticked.** Requirements 49.4 to 49.11 met in code and tests; issue 4 (Guide path) and issue 7 are follow-ups. Phone look still outstanding.
- **81.2 not ticked.** Issues 1 and 2 break Requirement 50.4 and 50.8 in the shipped app. Tick after issues 1, 2, 3 are fixed.

## Needs from the lane (hi4 follow-up, brief to agy)

Issues 1, 2, 5 (code and strings), and issue 4 for hi3. Kiro owns the oracle change in issue 3 and the 50.4 wording.

## Not tested here

Drawing on a real canvas, the highlight's look, Help on a phone with TalkBack, and the native-speaker quality of the Hindi and Gujarati.


## Addendum: second independent run (2026-11-20, after 4e7186d)

A second Kiro run repeated the checks on a copy of `frontend/` outside the repository (no source edit in the working tree). It reproduced the results above: full Vitest 3059 passed, `tsc` clean, Playwright 22 passed, mutant A killed, mutant B (`raw: true`) survived, and `isRaw` is never passed by `App.tsx`. `parseExploreCommand` output confirms issue 2 ("ले चलो B" and "લઈ જાઓ B" give `unknown`; "चोटी ढूंढो" gives `guide_to`, not the peak). The Guide path in issue 4 is confirmed at `Explore.tsx:2128-2135` (move) and `:2236-2242` (lift).

Two more mutants survive, both in hi3. They are oracle gaps, not code bugs today:

| # | Severity | File:line | Problem | Fix |
|---|---|---|---|---|
| 9 | Medium | `tests/explore.highlight.oracle.test.tsx` H3; `screens/Explore.tsx:2337` | Deleting `scheduleDraw(viewportRef.current, null)` after the last lift passes all 20 highlight tests. `clearHighlight()` sets `data-highlight` itself, so H3 sees `none` even when the canvas is never redrawn and the old highlight stays visible. 49.5 asks for "redrawn without it". | Kiro: in H3, spy on the canvas mock's `drawImage` or `clearRect` and require one call after the lift, or set `data-highlight` only inside `draw()`. |
| 10 | Low | `tests/explore.highlight.test.tsx`; `screens/Explore.tsx:1293` | Replacing the `renderHighlightElement(...)` call in `draw()` with a no-op passes all 20 highlight tests. The unit tests call `renderHighlightElement` directly, and the screen tests read only the attribute, so nothing checks that the screen draws the highlight. | Add one screen test: finger on side AB, then require a mock-context `stroke` with `lineWidth >= 8` after the redraw. |

These do not change the ticks: 81.1 stays ticked, and 81.2 stays open for issues 1, 2 and 3.


## Kiro follow-up

Done 2026-11-20, tests and spec text only; nothing under `screens/`, `flow/` or `i18n/` changed, and 81.2 stays unticked. For issue 1 I amended Requirement 50.4 and the Help section of design.md so the Help `raw` flag is the screen's own `isRawScene` (prop, or scene kind `unknown`, or the raw announcement), not the `isRaw` prop alone. For issue 3, E2 in `explore.help.oracle.test.tsx` now asserts the exact `helpSentences` arguments (`raw: false`), that `help.raw` is not spoken, and that nothing but joiners surrounds the expected sentences (the old check accepted extra sentences). I added oracle E6, `it.fails`: a scene of kind `unknown` rendered without the `isRaw` prop, as `App.tsx` does, must speak `help.raw`. I ran it with `.fails` removed and it fails for the intended reason (`raw: false` received, `true` expected), so lane hi6 flips it. I did not re-run mutant B (`raw: true`) because that needs a source edit; E2 should kill it, since it asserts `raw: false`, but this is reasoned, not measured. For issue 6, I added H6 to `explore.highlight.oracle.test.tsx`: a rerender with a new scene while the finger is down must give `data-highlight="none"`. It passes today, so it is a plain `it`. I did not mutation-check it either (it would need deleting `clearHighlight()` at `Explore.tsx` ~676), so whether H6 would catch that deletion is unverified. To support H6 I added `rerender(scene)` and an `announced` option to `tests/support/exploreRig.tsx`, with the default behaviour unchanged. Issues 2, 4, 5, 9 and 10 are still open.



## Kiro follow-up 2

Nightly "Property Tests Soak" failure, run 44714393935 on main `2cf6dd0` (2026-11-20). Decided 2026-11-20: **a timeout, not an equivalence failure.**

Evidence from `gh run view 44714393935 --log-failed`: the only failed test is `tests/hitTest.perf.prop.test.ts` > P52 "same target when the scene has a 2000-point polyline", after 14617 ms, with `Error: Test timed out in 5000ms` and no fast-check "Property failed", counterexample or seed. The other five tests in the file passed. A real mismatch would have printed a counterexample and a seed. This test has no explicit timeout, so Vitest's 5000 ms default applies, and the soak workflow scales `numRuns` through `FC_RUNS_MULT`, so the work grows while the limit does not.

Change (`frontend/tests/hitTest.perf.prop.test.ts` only): the test now has an explicit timeout of `Math.max(120_000, runs(200) * 600)` ms, so it grows with the soak multiplier. `numRuns` is still `runs(200)`, 24 fingers each, with the same comparison against the frozen oracle, so the property is not weakened and normal runs are not reduced. Locally the whole file runs in under 1 s and `tsc --noEmit` is clean. I did not re-run the soak itself (it is a scheduled GitHub run), so the fix is confirmed only by the next nightly. The 600 ms per run is a guess from the one CI timing of 14.6 s; if the soak multiplier is large, check that figure. Nothing under `core/` or `src/` changed. Note: the nightly has failed on its last three runs (18, 19 and 20 Nov); I read only the latest log, so the earlier two are not explained by this.


## Kiro follow-up 3

Checked 2026-11-21 at main `b2d9bc6` (lane hi6 `869ae98`, E6 flipped). **Issues 1 to 5 are fixed; task 81.2 is ticked.** Issue 1: `Explore.tsx` now passes `raw: isRawScene` to `helpSentences` (line 2444); E6 passes as a plain `it` with no `isRaw` prop. Issue 2: I ran `parseExploreCommand(x, true)` on the new sentences' phrases: Hindi "बी पर ले चलो" gives `guide_to` `बी`, "शिखर ढूंढो" gives `guide_semantic` `peak`, and Gujarati "બી પર લઈ જાઓ" and "શિખર શોધો" give `guide_to` `બી` and `guide_semantic` `peak`. The old verb-first order ("ले चलो बी") still gives `unknown`, and the sentences no longer say it. Issue 3: mutant B (`raw: true` in the Help call) is now **killed**: 3 tests fail (E2, E4 and a hi6 test); I reverted it and `git status` was clean. Issue 4: `startGuide` and the guide branches of down, move and lift call `clearHighlight()`, and `applyHighlight` returns early while guiding; `explore.highlightGuide.test.tsx` covers it. Issue 5: `help.back` now says `वापस` and `પાછા`, the button names. Full Vitest: 242 files, 3075 passed, 1 todo; `tsc --noEmit` clean.

Still open or unproven: issues 6 (scene-change clear and in-app Back mutants), 7 (vertex dot and label look), 8 (Help text in the 3-line status, no e2e), 9 and 10 (highlight redraw oracle gaps). I did not re-run the Playwright layout specs or re-mutate those places. Nothing was tried on a phone: the highlight's look, Help with TalkBack, Guide under a real finger, and the Hindi and Gujarati wording (still machine-translated, no native-speaker review). The parser check shows the spoken phrases are accepted as typed text; whether speech recognition returns those exact words in hi and gu is untested.



## Kiro follow-up 4

Done 2026-11-22, spec text only; nothing under `screens/`, `flow/`, `i18n/` or the e2e specs changed, and no test was added. Source: `docs/reports/opus-playwright-recommendations.md` items 1, 2 and 4, which the reviewer reproduced under Chromium touch emulation (CDP) and not on a phone. I have not re-run those reproductions; I took the numbers from the report. New clauses: Requirement 25.9 and 25.10, Requirement 50.10 to 50.13, a design.md section with oracles N1 to N6, and task 84. Item 1 (second finger on Help or Where am I): activation also comes from a touch pointer-up on the button, once, with the following `click` ignored; the report found Where am I probably fails the same way but did not test it, so that part is unconfirmed. Item 2 (clipped Help text): the card keeps its height and becomes scrollable and focusable while Help text shows; the measurements are in design.md. Item 4 (landscape): every footer button fully inside the viewport at 640x360, 832x384 and 915x412. Not done: no `it.fails` oracle was committed. N4 and N5 need a layout engine, so vitest cannot express them. N1 and N3 might be expressible in the Explore rig, but I did not try; that is task 84.2. The 160 px landscape canvas bound in 25.10 is a proposal and needs the owner's look on a phone. Items 3 and 5 to 10 of the report are not covered here; item 3 (Help missing from `buttonSpecs`) is only referenced by 50.12.
