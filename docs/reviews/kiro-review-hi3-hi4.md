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
