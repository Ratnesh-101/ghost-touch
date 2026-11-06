# Lane lab-startscreen: build the Lab Start screen

Read `docs/briefs/lab-spec.md` first, then `docs/reports/audit-layout.md` (sections 2.1, 3 and 6) and `docs/reports/audit-csstests.md`. All the parts you need are already merged: `components/Logo.tsx`, `components/Mascot.tsx`, `components/start/OrganTiles.tsx`, `components/lab/*` (Seam, Rivets, LabCard), the lab tokens in `styles/tokens.css`, the `lab.*` strings in `i18n/index.ts`.

## Allowed files
- `frontend/src/screens/Start.tsx`, the `.gt-start*` rules in `frontend/src/styles/global.css` (keep them in `global.css`: the CSS tests scan that file), `frontend/src/i18n/index.ts` (ONLY to add new keys in all three languages; never change existing keys or spoken strings)
- `frontend/tests/flow.start.test.ts`, `frontend/tests/screens.render.test.ts`, `frontend/tests/polish.test.ts` and other existing tests only if an assertion must follow an intentional markup change (never weaken what it protects); new `frontend/tests/start.lab.test.tsx`
- `docs/reports/agy-lab-startscreen-report.md`

## Forbidden
`flow/**`, `core/**`, `drivers/**`, haptics, other screens, `vite.config.ts`, backend, `.env*`, prop tests.

## Do
1. Hero: the Logo (full variant, decorative copy), the mascot, the tagline `t('app.tagline')`, the three organ tiles via `<OrganTiles organs={[...]}>` with strings from `t('lab.organ.nerves.title')`, `t('lab.organ.nerves.line')`, and the eyes and voice equivalents, then one huge "Wake the creature" call to action showing `t('lab.start.wake')`. The whole screen stays ONE button with `aria-label={t('start.intro')}`, the same `onClick`, the same `speakIntro` and `handleStartTap` calls and the same focus-on-mount behaviour. The hero content stays `aria-hidden` (the button's accessible name is the intro sentence) exactly as today.
2. Remove the hard-coded English chips and the "TalkBack & touch ready" sub-hint from `Start.tsx`: route every visible string through `t()` (add a key like `lab.start.subhint` in en, hi and gu if you keep that line; hi/gu machine-translated, say so).
3. Fix audit BUG-03: `.gt-start-surface` flex centring clips the hero when zoomed. Use a layout that scrolls from the top (`margin: 0 auto; min-height: 100%` and `align-items: flex-start` or `safe center`), so at 200 percent zoom and 320 px width nothing is cut off and the page scrolls. Add safe-area padding (`env(safe-area-inset-*)`, via the `--gt-safe-*` tokens if foundation added them, otherwise a fallback) for notches.
4. Restyle in the lab look (stitched seams, rivets, copper hardware, bone secondary text, blueprint grid from the body). Colours come only from tokens. 7:1 text contrast. Visible focus ring on the start button (copper or cyan, 3 px). Motion: at most a slow idle glow on the call to action, under 3 flashes per second, none under `prefers-reduced-motion` (extend the reduced-motion block; `tests/a11y.motion.test.ts` must pass).
5. Hindi and Gujarati lines are longer and need taller line boxes: no `white-space: nowrap`, no fixed heights, no `overflow: hidden` on text.
6. IMPORTANT CSS rule: any new CSS file must be imported from the component that uses it (like `OrganTiles` does). Never add an `@import` after other rules in a CSS file (bundlers ignore it). After your change, run the build and confirm the rules you wrote exist in `frontend/dist/assets/*.css` (`npm --prefix frontend run build`, then search the output with the allowed read tools).
7. Tests: the button keeps its accessible name; the hero is `aria-hidden`; no hard-coded English strings remain in `Start.tsx` (assert by rendering in hi and gu and checking no English organ text appears); three organ tiles; the `.gt-start*` rules satisfy the 48 px and focus-visible expectations.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all old tests pass, plus yours, real counts), `npm --prefix frontend run build` pass. Run NO backend commands. Report with the diff stat for `Start.tsx` and **Commit groups**. Write the report even if something failed.
