# Kiro: Playwright regressions on main (2026-11-22)

Run: `cd frontend; npx playwright test --reporter=list` on main at `0b4ea94`. Both Galaxy projects (384x832 dpr3, 412x915 dpr3.5).
Starting point: 14 failed (13 on the second run, one was flaky). After the e2e-only fixes below: **58 passed, 4 failed of 62**. The 4 remaining failures are one real app regression (C), on both projects, in two tests.

## Classification

| Test (both projects unless noted) | Class | Cause | Action |
|---|---|---|---|
| `explore.help-fixes` test (a), second touch on Help | A, stale test | The test released the second finger with CDP `touchEnd` carrying the primary finger's point. CDP `touchEnd` ends all touches, so the primary finger was lifted and `data-highlight` went to `none` (correct app behaviour). | `touchEnd` now carries the second finger's point (id 1). Help still has to activate and the highlight must stay `vertex:B`. |
| `explore.help-fixes` test (b) at 320x640 and 384x832 | A, stale string | Expected "Tap Ask to ask a question with your voice". The real `help.ask` is "Press and hold with two fingers, or use the Ask button, to ask a question." | The spec imports `t` from `src/i18n` and asserts `t('help.ask')`. |
| `explore.help-highlight` "highlight follows a finger ... pixel probe" (412 project only, passed on 384) | B, race | `data-highlight` is set before the next animation-frame redraw. The test read the pixel once right after `touchEnd`. | The after-lift pixel check polls (5 s). The `r < 100` threshold is unchanged. 64 of 64 passes with `--repeat-each=4`. |
| `explore.raw-guide` "no highlight while guiding" | A (two causes), B (one) | (1) B, environmental: the Ask text input exists only when speech recognition is unavailable, and Chromium ships `webkitSpeechRecognition`. (2) A, stale mock: `/api/v1/ask` mock lacked the required `source` field and used a `{kind, id}` target; the client parser throws `bad-response`, which showed "Server error". (3) A, wrong premise: the test touched corner B, which is the guided target. Touching the target is the arrival and ends Guide, so the highlight legitimately returns on the next move. | (1) `addInitScript` deletes `SpeechRecognition` and `webkitSpeechRecognition`. (2) The mock returns `source: 'ai'` and `target: { elementId: 'B' }`. (3) The guided touches now start on corner A and move onto side CA, both of which highlight when Guide is not active. The assertion `data-highlight == none` while guiding is unchanged, and the later "highlight comes back after Back" step is unchanged. |
| `explore.actions-layout` "360x640 compact viewport" | **C, app regression** | See below. | None in the app. Test untouched. |
| `explore.actions-layout` "6 action buttons layout" | **C, app regression** | Same cause. | None. Test untouched. |

## C: the footer takes a second row and the canvas falls below the Requirement 25 minimum

Failing assertions (the spec has Teacher tools on, so Correct is shown):

- `[360x640 3s hold] Canvas height (216.0px) is below minimum 40% of viewport (256.0px)`, `explore.actions-layout.spec.ts:288`
- `expect(canvasBox.height).toBeGreaterThanOrEqual(230)` received 216, `explore.actions-layout.spec.ts:559`

Measured at 360x640, Teacher tools on, triangle sample (scratch spec, deleted afterwards):

| | before Walk button (5 buttons: Where am I, Ask, Help, Correct, Back) | now (Walk me through, Where am I, Ask, Help, Correct, Back) |
|---|---|---|
| Footer height | about 112 px (see note) | **176 px** |
| Canvas height | at least 256 px (the spec passed at 3a6fc78 and 67d3c88) | **216 px** |
| Status card | 80 px | 75.4 px |

Layout of the 6 footer buttons now: five buttons on row 1 at y 448, each **56 px wide and 109 px tall** (the labels wrap into narrow columns), and Back on row 2 at y 569, 328 px wide, 55 px tall. With Teacher tools off (5 buttons) the canvas is 277 px at 360x640, which passes the 40 % rule (256 px), so the regression shows only when the sixth button is there. At 384x832 the canvas is 469 px (fine). No horizontal scroll was observed, and every button is at least 48 x 48.

Note on "before": the 112 px figure is inferred from 5 buttons on one row plus Back, not measured at the old commit. The spec's passing baseline at 3a6fc78 and 67d3c88 is what is on record (task 66).

Cause: lane hi11 (`3be49dd`, Planchette) added the "Walk me through" button, which appears for the triangle sample, to the same `.gt-explore__actions` flex row. In portrait at 360 px the row cannot hold six buttons with `flex: 1` and `min-width: 48px`, so the text wraps to a 56 px column and the row height grows to 109 px (the tallest wrapped label), and then the last button wraps to a second row. Both rows are inside the fixed-height screen (Requirement 25.5), so the canvas container (`flex: 1 1 0`, `min-height: 220px`) gives the space up. The status card is not the cause (Requirement 25.4 holds).

### Brief for an agy lane (CSS and Explore.tsx only; do not touch tuned haptic values or `core/`)

Constraints that must all hold afterwards:

1. At 360x640, Teacher tools on (6 footer buttons, 7 with Guide me): canvas height at least 40 % of the viewport (256 px), and `explore.actions-layout.spec.ts` lines 288 and 559 (230 px) pass unchanged. Do not lower the thresholds.
2. Every footer button at least 48 x 48 CSS px, fully inside the viewport, no horizontal scroll, no scroll of the page or of `.gt-explore` (Requirement 25.10 for landscape stays as built).
3. Requirement 25.1 to 25.4 and 25.6: canvas box stable, status card height unchanged (`5rem` card), fixed `height: 100dvh` screen.
4. Labels stay readable and are not clipped (the accessible names are unchanged); Hindi and Gujarati wrap must still fit (`explore.actions-layout.spec.ts` Gujarati case).

Suggested approach, in order of preference (the lane decides after measuring):

- `frontend/src/styles/global.css` `.gt-explore__actions` (about line 1167) and `frontend/src/styles/explore.css` `.gt-explore__actions` (line 305) and the portrait rules around line 946: give the footer a deterministic two-row grid, for example `display: grid; grid-template-columns: repeat(3, 1fr)` below about 420 px wide, so six buttons make two rows of three at a fixed 48 to 52 px height each (about 112 px total with gaps), instead of five squeezed columns plus a wrapped Back. Set `min-height: 48px` and `height` or `align-items: stretch` so wrapped text cannot make a row 109 px tall. Use `white-space: normal` with `overflow-wrap: anywhere` only inside that fixed height.
- Alternative: move "Walk me through" out of the primary footer row (for example into its own row only shown when the canvas has room, or beside Help), but only if Requirement 51.7 (a button of at least 48 x 48 that exists while a walk exists) is kept.
- `Explore.tsx` lines 2904 to 2930 (`<footer className="gt-explore__footer">`, `<div className="gt-explore__actions">`, the Walk button at about 2921) only if the DOM order has to change.

Acceptance: `npx playwright test e2e/explore.actions-layout.spec.ts` green on both projects, plus `explore.canvas-stable`, `explore.help-fixes` (landscape test (c)) and the layout vitest `tests/explore.layout.test.tsx` (P87) still green.
