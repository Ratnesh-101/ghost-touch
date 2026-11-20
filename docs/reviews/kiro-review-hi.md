# Kiro review "hi": show-me highlight (Requirement 49) and Explore Help button (Requirement 50)

Task 80, 2026-11-20. Spec: `requirements.md` 49 and 50, `design.md` "Show me highlight" and "Explore Help button", `tasks.md` 80 and 81. Kiro wrote the spec, two pure helpers, their property tests and the screen oracles. Kiro did not touch `screens/`, `flow/`, `App.tsx`, `i18n/`, `hitTest.ts`, `hapticEngine.ts` or any tuned value.

## What the agy lanes must use

### Lane 81.1: highlight (`screens/Explore.tsx`), due Nov 28 or withdrawn (D9)
- Import `highlightFor`, type `Highlight` from `frontend/src/core/highlight.ts`.
  `highlightFor(hit: Target | null | undefined, scene: DiagramScene): Highlight`, with `Highlight = { kind: 'vertex' | 'segment' | 'polyline' | 'axis' | 'bar' | 'none'; id: string | null }`.
- Call it with the same target the screen gives `step()` (the `followTarget` result when Stay on line is on). Keep the result in a ref and draw from the ref.
- Canvas attribute (Requirement 49.11): `data-highlight` = `none` or `<kind>:<id>`, for example `vertex:A`, `segment:AB`. Set it on the `<canvas>` element on every redraw.
- Clear (49.5): on last lift, cancel, `blur`, page hidden, scene change, and when the target becomes none. A promoted finger follows its own target.
- Draw-only (49.6, 49.7, 49.8, 49.9): no new `vibrate`, `setTone`, speak, earcon or element; no animation; stroke weight and tint only. Proposed: at least 2x width, lighter tint of the line colour, bigger dot for a vertex. The owner has not seen it on a phone.
- Oracle file: `frontend/tests/explore.highlight.oracle.test.tsx`. H1 to H4 are `it.fails`: remove `.fails` when the lane passes them. H5 (pinned vibrate, tone, speak and earcon calls of a fixed trace) passes today and must stay green. `stopSpeaking` is left out of H5 on purpose, because lane ux1 adds a stop on lift.
- Not testable in jsdom: the drawing itself and the status-line height. Run `npx playwright test` (canvas-stable and actions-layout specs) for the second.

### Lane 81.2: Help button (`screens/Explore.tsx`, `i18n/index.ts`, translation sheets)
- Import from `frontend/src/core/help.ts`: `helpSentences(ctx: { raw: boolean; guideOn: boolean; askOn: boolean }): HelpKey[]`, `HELP_KEYS`, `HELP_BUTTON_KEY`, `HELP_I18N_KEYS`.
- Button: `<AccessibleButton className="gt-explore__help">` in the same footer row as Ask, name `t('explore.help')`, at least 48 x 48 CSS px, shown whether or not Teacher tools or Guide are on.
- On press: speak once, `joinAnnouncements(helpSentences({ raw: isRaw === true, guideOn: <Guide enabled>, askOn: true }).map((k) => t(k)))`. No vibrate, no tone, no mode change, works with a finger down and with Directions off.
- Keys to add to `en`, `hi` and `gu` (seven; hi and gu must differ from English; none may contain "verified", "correct", "checked" or "approved"):

  | Key | Suggested English |
  |---|---|
  | `explore.help` | Help |
  | `help.touch` | Drag one finger to feel the diagram. |
  | `help.back` | Swipe down with two fingers, or press Back, to leave. |
  | `help.ask` | Press and hold with two fingers, or use the Ask button, to ask a question. |
  | `help.guide` | Say take me to, then a corner name, or say find the peak, to be guided. |
  | `help.stop` | Say stop to end guiding. |
  | `help.raw` | This diagram is only rough outlines. Labels may be missing. |

  The guide wording must match what the app does today (Requirement 50.8). Add the rows to `docs/user-test/translation-review.csv` and `.md`.
- Oracle files: `frontend/tests/explore.help.oracle.test.tsx` (E1 to E5, all `it.fails`) and the string test P158 in `frontend/tests/help.prop.test.ts` (one `it.fails`). Remove `.fails` from all six when the lane passes them. The control (Ask button exists) passes today.
- `tests/support/exploreRig.tsx` gained an optional `isRaw` setting (Kiro, for E3). Nothing else in the rig changed.
- Not testable in jsdom: the 48 x 48 size and footer wrapping. Use the e2e layout specs. Folding buttons into "More" is not part of this task.

## State after task 80
- Passing: `highlight.prop.test.ts` (P151 to P154), `help.prop.test.ts` (P155 to P157), controls in both oracle files, H5.
- Expected red (`it.fails`, 10 in total): H1 to H4, E1 to E5, P158.
- Known limit: the voice command "help" still speaks `commands.help` (Requirement 50.9).

## What Kiro did, for the write-up
Kiro wrote Requirements 49 and 50, the design sections and tasks 80 and 81 before any code, then the two pure helpers and eight properties (P151 to P158). Six deliberate mutants were run (a missing vertex id check, an axis not checked as set, a bar edge reported as a segment, a shared result object, guide without stop, and a truthy check instead of `=== true`), and each failed at least one of P151 to P157; P158 is an `it.fails` string test and was not mutated; a first mutation run was invalidated because an edit and a test ran in parallel, and it was redone one step at a time. The screen oracles use a spy on the helper and a `data-highlight` attribute, because the test rig has no canvas context and cannot see drawing. No property found a bug in the new code on its first run, and none of this has been tried on a phone.
