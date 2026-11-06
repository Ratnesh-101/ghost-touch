# Lane lab-explore3: fix the CSS import bug and the Explore layout bugs from the audit

Read `docs/reports/audit-layout.md` (sections 2.3, 5 and 6) and `docs/reports/audit-csstests.md`, then `docs/briefs/lab-spec.md` and `docs/briefs/agy-lab-explore.md`.

KNOWN BUG FOUND BY THE SUPERVISOR: `frontend/src/styles/global.css` has `@import './explore.css';` near the END of the file. CSS requires `@import` before every other rule; the bundler prints "[vite:css][postcss] @import statements must precede all other statements" and DROPS it, so none of the specimen-table frame styles reach the built CSS (verify: `npm --prefix frontend run build`, then search `frontend/dist/assets/index-*.css` for `gt-lab-specimen-table`; it is missing). The tests did not catch it because they read `explore.css` directly.

## Allowed files
- `frontend/src/styles/global.css` (move the import to the top next to the other `@import` lines; fix the `.gt-explore*` layout rules named below), `frontend/src/styles/explore.css`, `frontend/src/screens/Explore.tsx` (class names and wrapper markup only)
- `frontend/tests/explore.lab.test.tsx` and new `frontend/tests/css.imports.test.ts`
- `docs/reports/agy-lab-explore3-report.md`

## Forbidden
The canvas element, its pointer handlers, `touch-action: none`, hit-testing, haptic and effect calls, speech and earcon calls, `flow/**`, `core/**`, `drivers/**`, `i18n/**`, other screens, backend, `.env*`, prop tests.

## Do
1. Fix the import: place `@import './explore.css';` with the other imports at the top of `global.css`. Rebuild and CONFIRM the frame, rivet and HUD classes now exist in `dist/assets/index-*.css`.
2. Add a guard test `tests/css.imports.test.ts`: for every `.css` file in `src/styles/`, assert every `@import` line appears before any rule (ignoring comments and `@charset`), and that every imported file exists. This must fail on the old layout and pass now. Also assert that every CSS file imported by `global.css` or by a component (`import '../styles/x.css'`) exists.
3. Audit BUG-01 (critical): `.gt-explore` uses `height: 100dvh; overflow: hidden;` so at 200 percent zoom, in landscape or with the keyboard open the Ask, Correct and Back controls are unreachable. Make the page layout robust: the chrome (title, HUD, action buttons) must remain reachable by scrolling or by shrinking the canvas area, while the canvas keeps `touch-action: none` and its size logic unchanged in behaviour. A safe pattern: `min-height: 100dvh`, a flex column where the canvas container takes `flex: 1 1 auto` with a sensible `min-height` (for example `clamp(220px, 50dvh, 100%)`), the actions row below with `flex-wrap`, and the page itself scrollable (`overflow-y: auto`) outside the canvas. Verify by reading how the canvas gets its size (it must read its own box: see audit section 5) and say in the report whether hit-testing still matches the drawing.
4. BUG-04: `.gt-explore__actions` must wrap (`flex-wrap: wrap`) so Ask, Correct and Back never collide at 320 px or 200 percent zoom. BUG-08: `.gt-explore__title` must not truncate with `nowrap` and ellipsis; allow two lines. BUG-06: add safe-area padding (`env(safe-area-inset-*)`) to the Explore container.
5. Extend `explore.lab.test.tsx` (or add tests) for the new rules: the actions row wraps, the title does not use `nowrap`, the container has no `height: 100dvh` together with `overflow: hidden`, every control still has a 48 px target.
6. Do not change anything else.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all old tests pass, plus yours, real counts), `npm --prefix frontend run build` pass and the built CSS contains the frame rules (quote the grep result). Run NO backend commands. Report with the diff stat and **Commit groups**; write it even if something failed.
