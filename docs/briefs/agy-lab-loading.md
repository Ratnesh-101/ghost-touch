# Lane lab-loading: the "lab powering up" loading visual (component only)

Read `docs/briefs/lab-spec.md` first. Build the presentational loading visual that Capture shows while a diagram is being read. Another lane mounts it later; you build and test the component.

## Allowed files
- `frontend/src/components/loading/LabLoading.tsx` (new), `frontend/src/styles/loading.css` (new; import from the component, not from `global.css`)
- `frontend/tests/lab.loading.test.tsx` (new), `docs/reports/agy-lab-loading-report.md`

## Forbidden
`screens/**`, `i18n/**`, `global.css`, `tokens.css`, drivers, flow, core, backend, prop tests, `.env*`.

## Do
1. `LabLoading` props: `{ title: string; hint: string; className?: string }`. Strings arrive as props (the i18n lane owns the copy). Markup: a card with the title as a plain paragraph, the hint as text, and a copper "charge meter": a track with segmented cells that fill in sequence (an indeterminate "charging" loop), plus a small spark glyph. The meter is `aria-hidden="true"`. The component itself is NOT a live region (Capture already owns the live region and the spoken "Reading your diagram" message and progress tone; do not duplicate speech). Do not use `role="progressbar"` without a real value.
2. Animation: CSS only, a loop whose brightness changes smoothly, never more than 3 flashes per second, no large-area flashing. Under `prefers-reduced-motion: reduce` the meter shows a static half-filled state. Include the reduced-motion block in `loading.css`.
3. Colours only from CSS variables with fallbacks (`var(--gt-copper, var(--gt-green-dim))`, `var(--gt-green)`, `var(--gt-bone, var(--gt-text-secondary))`); the foundation lane adds those tokens. Text at least 7:1 contrast against the card.
4. Tests: renders both strings, the meter is `aria-hidden`, no live region or progressbar role inside, and `loading.css` has a reduced-motion block that disables the animation (read the CSS with `node:fs`) and no flashing keyframe cycle shorter than 0.34 s.

## Done
tsc clean, `npm --prefix frontend test` (all old tests pass plus yours, real counts), `npm --prefix frontend run build` pass. Report: exact props and how to mount it, and **Commit groups**.
