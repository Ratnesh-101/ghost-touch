# Kiro review: lane hi12 (commit 0b4ea94, Requirement 52, task 86)

**Verdict: FIX FIRST.** The form logic is correct and the tests pass. Two defects stop a merge: the `build.feelSmall` notice measures the window instead of the Explore canvas, and the Build wrapper adds padding and height around Explore, which has its own 100dvh layout (Requirement 25 risk). Neither needs a core change.

I ran `vitest run` on `build.screen.test.tsx`, `build.screen.oracle.test.tsx` and `build.i18n.oracle.test.ts`: 24 passed, 1 expected fail remains. I did not run a browser, so the 320 px layout and the Requirement 25 findings come from reading the CSS.

| severity | file:line | problem | fix |
|---|---|---|---|
| High | `screens/Build.tsx:52-60`, `109-111` | `getCanvasScale()` returns `min(window.innerWidth, window.innerHeight)`. The Explore canvas is smaller than the window (wrapper padding 16 px a side, Explore's own header and controls), and `pinSpacingOk` needs the canvas `scale` (Requirement 52.12: letterboxed `min(canvas w, h)`). On a 360 x 800 phone the window gives 360, so the notice is silent, while the canvas is about 328 and pins are about 41 px apart, under the 44 px rule. The only test sets a 320 x 320 window (`build.screen.test.tsx:268-288`), so it cannot see this. | Measure the Explore canvas after it mounts (a ref on `.gt-build__feel-container`, then `querySelector('canvas').getBoundingClientRect()` in an effect, `min(width, height)`), then speak `build.feelSmall` with `{ queue: true }`. Add a test with a 360 x 800 window and a mocked canvas rect of 328. |
| Medium | `styles/build.css:8-19`, `195-201` | `.gt-build` has `padding: 16px; min-height: 100dvh` and also wraps Explore in feel mode. `.gt-explore` is already `height: 100dvh` with its own padding (`explore.css:20-28`, `900-908`). The page becomes 32 px taller than the viewport (vertical scroll during a touch drag) and the canvas loses 32 px of width. The `height: 100%` on `.gt-build__feel-container` resolves against a `min-height` parent, so it computes to auto. This conflicts with the Requirement 25 rule that no overlay or wrapper may change the canvas size. | Move the padding to `.gt-build__form`. Add `.gt-build[data-mode="feel"] { padding: 0; min-height: 0; }` and `.gt-build__feel-container { display: contents; }`, or drop the wrapper's height rules. Check on a 360 x 800 device that the document does not scroll in Feel. |
| Medium | `tests/build.i18n.oracle.test.ts:49`, `tests/build.screen.oracle.test.tsx:182,202,217,227,244,263` | The builder edited Kiro-authored oracle files (rule 1 of AGENTS.md). Each edit only changes `it.fails` to `it`, which is what the oracle said would happen when the lane landed ("until lane C-wire"). No assertion changed (checked in the diff). | Accept this flip. Record it in the lane report as "Needs from Kiro" in future. Do not accept any other change to these files. |
| Low | `i18n/index.ts:120,715,1312` | The new key `explore.back` is added in en, hi and gu, and nothing uses it (grep finds no `t('explore.back')`). | Remove the three lines, or say which lane will use it. |
| Low | `screens/Build.tsx:178`, `197` | The visible text and `aria-valuetext` are the hard-coded English `x ${n}` and `y ${n}`. This bypasses `t()` (rule 7). In hi and gu, TalkBack reads the slider name in the local language and the value in English. The text matches `pinLabel` (`x 2 y 5`), so this is a small issue. | Add `build.xValue` and `build.yValue` keys (`x {n}`), or record that "x" and "y" are deliberately the same in every language. |
| Low | `flow/build.ts:132-133` | A second Stitch press calls `applyEdit` with an identical scene and speaks "Joined n pairs". If `applyEdit` does not drop equal scenes, Undo then removes nothing visible and speaks "The joins are removed". I did not verify what `applyEdit` does with an equal scene. | Return `history` unchanged and speak `build.stitched` when `nextScene` deep-equals the present scene. Add a test: Stitch, Stitch, Undo leaves the pins. |
| Low | `tests/round2.navigation.prop.test.ts:61-88` (not in this commit) | `tsc -p frontend --noEmit` reports 5 errors: `buildDirty` is missing from `BackContext` and `'build'` is not a route. This is the navigation oracle waiting for lane hi13. | Not a hi12 fault. Do not merge hi13 unless these errors are gone. |

## Checks you asked for

| Check | Result |
|---|---|
| Two range sliders, accessible names, `aria-valuetext` | Pass. x is 0..6 and y is 0..8, `aria-label` and `<label htmlFor>`, `aria-valuetext` "x 3" and "y 5" (only the `t()` issue above). |
| Buttons at least 48 x 48 | Pass in CSS (`min-height: 48px; min-width: 48px`, thumbs 48 px, Back included). Not measured in a browser. |
| Feel and Hand in disabled until `canFeel` / `canHandIn`, spoken `build.needPin` | Pass. They use `aria-disabled` (still focusable) and the handlers speak `build.needPin` (`Build.tsx:106`, `118`). |
| Every outcome spoken | Pass. Pin (pinned, occupied, badInput), Undo (pin, stitch, nothing), Stitch (done, none), Hand in (soon), Back (backToForm). Entering the form is not spoken. The polite status text and the focused controls cover it, so I record it as accepted. |
| No vibrate, tone or earcon in the form | Pass. `Build.tsx` and `flow/build.ts` never touch `drivers.haptics` or `drivers.audio`. |
| Feel mounts the unchanged Explore with no `onCorrect` | Pass. Props are `scene`, `announced`, `drivers` and `onBack`. `Explore.tsx` is not in the commit. |
| `build.feelSmall` when `pinSpacingOk` is false | Fail in practice, see the High finding. The logic and the key are right, the input is wrong. |
| Labels without brackets | Pass. Labels come from `pinLabel` (`x 2 y 5`). No bracket characters in the en, hi or gu `build.*` values. |
| Stitch is ONE history apply and never a polyline | Pass. `pressStitch` makes one `applyEdit(stitchInOrder(...))`, which gives n - 1 segments. No polyline is created. Undo takes it back in one step. |
| 320 px layout | Probably pass. Single column, `max-width: 480px`, `flex-wrap` rows with a 120 px basis, `overflow-x: hidden`. I did not render it. The Feel layout is the Medium finding. |
| The 44 px rule | Core use is correct (`pinSpacingOk`, 352 threshold). The input is wrong, see the High finding. |
| Tuned haptic values, `core/` purity | No changes. No file under `core/`, `.kiro/`, `schema.py` or `validate.py` is in the commit. |
| Secrets, dependencies | None. No `.env`, no `package.json` change. |

## Needed before merge
1. Fix the High and the Medium layout finding, each with a test.
2. Phone check: on a 360 x 800 Android phone, Feel must speak the small-screen notice only if the canvas is under 352, and the page must not scroll in Feel.
