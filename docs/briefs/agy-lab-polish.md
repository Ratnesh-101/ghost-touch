# Lane lab-polish: visual fixes found by screenshot review (Start on phones, Capture labels)

The supervisor reviewed real screenshots of the merged app (Brave, 390x844 phone and 1440x900 desktop). Fix exactly these problems. Read `docs/briefs/lab-spec.md` first.

## Problems
1. START, 390 px wide: the Logo (full variant, with the "Ghost Touch" wordmark) is NOT visible. At 1440 px it shows correctly above the mascot, but at 390 px the first thing on screen is the mascot, so the app name is missing from the hero. Find out why (read `screens/Start.tsx` and the `.gt-start*` rules in `styles/global.css` and `styles/start.css`: a media query that hides it, a zero height or width on narrow screens, `overflow`, or a flex-shrink collapse) and fix it so the wordmark is visible at 320, 360, 390 and 430 px widths, and still correct at 200 percent zoom.
2. START, 390x844: the three organ tiles are tall stacked cards that take most of the screen and push "Wake the creature" to the bottom edge. On narrow screens lay each tile out HORIZONTALLY (icon on the left, title and one line of text on the right) in a compact row of about 64 to 72 px, so the logo, mascot, tagline, three tiles and the "Wake the creature" button all fit in one 390x844 screen without scrolling. Keep the three-column layout on wide screens (it already looks good at 1440). Hindi and Gujarati text is longer: rows must grow in height and wrap, never clip or truncate, and the page must still scroll from the top at 200 percent zoom.
3. CAPTURE: the sample card labels ("Right triangle", "Sine wave", "Bar chart") are tiny (about 11 px). Make them at least 14 px (0.875rem) with comfortable line height, keep the cards at least 48 px tall and let the labels wrap for longer Hindi and Gujarati names.
4. Do not change any accessible name, spoken string, handler or logic.

## Allowed files
`frontend/src/screens/Start.tsx` (markup and class names only), `frontend/src/components/start/OrganTiles.tsx` (class names and markup only), `frontend/src/styles/start.css`, the `.gt-start*` and `.gt-capture__sample*` rules in `frontend/src/styles/global.css` (leave all other rules alone; other lanes are editing nearby rules), new tests `frontend/tests/polish.start.test.tsx`, extend `frontend/tests/start.lab.test.tsx` and `frontend/tests/capture.lab.test.tsx` (never weaken an assertion), `docs/reports/agy-lab-polish-report.md`.

## Forbidden
`Capture.tsx` logic, `flow/**`, `core/**`, `drivers/**`, `i18n/**` (no text changes), `Explore.tsx` and `explore.css`, `vite.config.ts`, backend, `.env*`, prop tests.

## Do
Diagnose problem 1 first and state the root cause in the report. Add tests: the Logo markup is present in the Start hero; the CSS has no rule that hides or collapses the logo at narrow widths (parse `start.css` and `global.css` with `node:fs`, find media queries and check); a narrow-screen rule lays organ tiles out in a row; sample label font-size is at least 0.875rem; all 48 px target tests still pass. All colours come from tokens. New CSS must be reachable in the build: confirm your rules exist in `frontend/dist/assets/index-*.css` after `npm --prefix frontend run build`.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all pass except possibly `api.health.test.ts`, which a different lane is fixing; say so), `npm --prefix frontend run build` pass. Run NO backend commands. Report with root cause, diff stat and **Commit groups**; write it even if something failed.
