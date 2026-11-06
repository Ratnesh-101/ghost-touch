# Lane lab-explore: the "specimen table" frame and HUD around the Explore canvas

Read `docs/briefs/lab-spec.md` first. This is the most sensitive screen, so the rule is: the canvas and its behaviour do not change at all; only the frame and the HUD chip around it do.

## Allowed files
- `frontend/src/screens/Explore.tsx` (markup and class names AROUND the canvas only), `frontend/src/styles/explore.css` (new; add ONE import line for it at the very end of `global.css`, in a clearly marked line, because the CSS tests read `global.css`)
- Existing `.gt-explore*` rules in `frontend/src/styles/global.css` may be edited or removed if you move them into `explore.css`; but keep any rule that `tests/a11y.targets.test.ts` or `tests/screens.render.test.ts` depends on (read those tests first and keep them passing, or move the rules and extend the tests in a NEW test file without weakening them)
- `frontend/tests/explore.lab.test.tsx` (new), `docs/reports/agy-lab-explore-report.md`

## Forbidden
The canvas element, its pointer handlers, `touch-action`, hit-testing, haptic/effect calls, speech and earcon calls, the two-finger swipe, the long-press Ask gesture, `flow/**`, `core/**`, `drivers/**`, `i18n/**`, other screens, `tokens.css`, `.env*`. No decorative texture inside the canvas.

## Do
1. Frame: a "specimen table" around the canvas: stitched border (SVG or CSS dashed suture look), four small rivets in the corners, subtle copper edge, charcoal surface. The canvas keeps maximum contrast: glowing green strokes on near-black, no texture, no gradient overlay on top of it, nothing positioned over the drawing area.
2. HUD / status chip: restyle only (lab look, high contrast, at least 7:1 text, 48x48 targets for every button around the canvas). Keep every `aria-label`, role, `aria-live` region and spoken string exactly. The Ask button, Save/Correct buttons and the Raw Mode notice keep their behaviour; restyle them with the lab look. The Raw Mode notice may show the new visible copy "The creature's eyes are blurry — you can still feel the outlines." ONLY through a `t()` key that the i18n lane adds: use `t('lab.raw.notice')` and, until that lane merges, make your code compile by checking how `t()` handles an unknown key (do not edit `i18n/index.ts`); if `t()` is strictly typed, leave the existing notice text and report that the swap is pending.
3. Colours come only from CSS variables. The lab tokens (`--gt-copper`, `--gt-cyan`, `--gt-bone`) are being added by another lane: write `var(--gt-copper, <existing token>)` style fallbacks so your code works before and after the merge.
4. Add a small `data-lab-frame` marker and tests that prove: the canvas element, its `aria-label`, `touch-action: none` and pointer handlers are unchanged; the frame and rivets are `aria-hidden`; every control around the canvas still has an accessible name and a 48 px target in the CSS.
5. Reduced motion: no animation in the frame at all (the "alive" spark is wired by a later lane).

## Done
tsc clean, `npm --prefix frontend test` (all old tests pass with the same count plus yours), `npm --prefix frontend run build` pass. The report lists exactly what changed in `Explore.tsx` (should be class names and wrapper markup only, say so with the diff stat), and **Commit groups**.
