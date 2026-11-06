# Lane lab-foundation: tokens, fonts, global base, shared lab primitives, theme doc

Read `docs/briefs/lab-spec.md` first. You own the design-system foundation that the screen lanes build on.

## Allowed files
- `frontend/src/styles/tokens.css` (new lab tokens), `frontend/src/styles/global.css` (ONLY: `@font-face`/font stack, body background + blueprint grid, base typography, focus rings, base `.gt-button`-style primitives, reduced-motion block, and a new `/* LAB PRIMITIVES */` section at the END; do not edit any `.gt-start*`, `.gt-capture*`, `.gt-explore*`, `.gt-saved*`, `.gt-correct*` rule)
- `frontend/src/styles/lab.css` (new; import it from `global.css` the same way the other style files are imported)
- `frontend/src/components/lab/**` (new presentational components) and `frontend/src/main.tsx` ONLY if a style import must be added
- `frontend/src/assets/fonts/**` (the fonts are already there; do not add others)
- `frontend/vite.config.ts`: change ONLY the `globPatterns` line so woff2 files are precached
- `frontend/tests/lab.*.test.ts(x)` (new tests)
- `docs/design/LAB_THEME.md` (new), `docs/reports/agy-lab-foundation-report.md`

## Forbidden
Everything else, especially `screens/**`, `i18n/**`, `components/Mascot.tsx`, `components/Logo.tsx`, `public/**`, backend, core, prop tests.

## Do
1. Tokens (in `tokens.css`, hex only for colour tokens so the contrast test can parse them): lab charcoal `--gt-bg: #0b0e0c` and elevated/surface steps, keep `--gt-green: #39ff88`, add voltage cyan, copper/brass (border and hardware), bone/parchment (stitches, secondary text), plus radii/shadow/spark/glow tokens. Keep every existing token name so nothing breaks (alias if you change a value). Verify contrast (7:1 for text roles, 4.5:1 for large text and UI borders) and extend coverage with a NEW test file `tests/lab.tokens.test.ts` (reuse the helper functions exported from `tests/a11y.contrast.test.ts` if convenient). The tuned haptic values are not CSS; do not touch them.
2. Fonts: `@font-face` for Atkinson Hyperlegible 400 and 700 from `src/assets/fonts/*.woff2` (`font-display: swap`), then the font stack with system fallbacks that cover Devanagari and Gujarati (for example `'Nirmala UI', 'Noto Sans Devanagari', 'Noto Sans Gujarati'`, then `system-ui`). Add woff2 to the PWA `globPatterns`. Add a test that proves the build config precaches woff2 and that the `@font-face` files exist.
3. Global base: body background = charcoal + faint blueprint grid (CSS gradients only, no image), good line-height, large readable base size, visible focus rings (copper or cyan, 3px, offset), `prefers-reduced-motion` block that disables the new animations. Keep the existing reduced-motion block's guarantees; `tests/a11y.motion.test.ts` must still pass.
4. Lab primitives (non-interactive, decorative, `aria-hidden="true"`): `Seam` (SVG dashed suture divider, horizontal; stitched border helper), `Rivets` (4 corner bolts for primary cards), `LabCard` (a wrapper that composes stitched edge + rivets, children untouched), `Spark` (the one-shot "it's alive" arc + glow pulse: a component that plays once on mount, under 1.2 s, max 3 flashes per second, a static final frame under reduced motion, plus an optional `onDone` callback). No audio in these components; the screen lane plays the existing `success` earcon.
5. Interactive base styles: a lab button style (copper border, green life fill for primary, 48x48 minimum, hover/active/focus) as CSS classes in `global.css` with names `.gt-btn`, `.gt-btn--primary`, `.gt-btn--secondary`, `.gt-btn--quiet`. These are NEW class names (the old screen classes stay until the screen lanes migrate). They must satisfy `tests/a11y.targets.test.ts` rules (min-height and min-width of at least 48px).
6. `docs/design/LAB_THEME.md`: tokens table (name, value, use, contrast ratio against its background), components, the do/don't list, and the accessibility rationale (why Atkinson Hyperlegible, why high contrast, why decoration is `aria-hidden`, the 3-flash and reduced-motion rules, why the canvas has no texture). Leave a heading `## Logo` with the text "Filled in by the brand lane" so it can be merged.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all existing tests still pass, plus your new ones, with real counts), `npm --prefix frontend run build` pass. Report lists every file, every token with its real contrast ratio, and anything the screen lanes must know. End with **Commit groups**.
