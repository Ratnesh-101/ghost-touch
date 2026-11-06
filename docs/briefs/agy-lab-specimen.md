# Lane lab-specimen: real mini previews for the "specimen jar" sample cards

Read `docs/briefs/lab-spec.md` first. The Capture screen's three sample buttons (triangle, sine, barchart) become larger "specimen jar" cards with a REAL mini preview of each diagram. Another lane mounts your component into `Capture.tsx` later; you only build the component.

## Allowed files
- `frontend/src/components/SpecimenPreview.tsx` (new), `frontend/src/components/specimenPaths.ts` (new, pure: scene to SVG path data), `frontend/src/styles/specimen.css` (new; import it from the component, not from `global.css`)
- `frontend/tests/specimen.test.tsx`, `frontend/tests/specimenPaths.test.ts` (new)
- `docs/reports/agy-lab-specimen-report.md`

## Forbidden
`frontend/src/core/**` (read-only: you may IMPORT its types and pure helpers), `screens/**`, `i18n/**`, `global.css`, `tokens.css`, `api/**`, drivers, backend, prop tests, `.env*`.

## Do
1. Read `frontend/src/api/scene.ts` (`SAMPLE_IDS`, `loadSample`) and `frontend/src/types/scene.gen.ts`, and the three files in `frontend/public/samples/`. `SpecimenPreview` takes `{ id: SampleId; className?: string }` and renders an inline `<svg viewBox="0 0 100 100">` with the diagram's lines drawn in life green on charcoal, thin strokes, rounded caps, with vertex dots. It must not need the network at render time beyond what `loadSample` already does (it is served from the precache). While loading or on failure show a neutral static glyph (never an error message, never a spoken text).
2. `specimenPaths.ts`: pure functions turning a `DiagramScene` into SVG path strings in a 100x100 box with padding, covering segments, polylines (down-sample long polylines to at most 40 points), axes and bars. Fully unit-tested with the three real sample files (read them in tests with `node:fs`, like `tests/a11y.contrast.test.ts` does) and with edge cases (empty scene, missing point ids).
3. Decorative only: `aria-hidden="true"`, `focusable="false"`, no `<title>`, so the button's accessible name stays exactly what Capture gives it.
4. Colours only from CSS variables with fallbacks (`var(--gt-copper, var(--gt-green-dim))`, `var(--gt-green)`, `var(--gt-bg)`); another lane adds the lab tokens. No animation; under reduced motion nothing changes.
5. Size: each preview is a few hundred bytes of SVG; no images.

## Done
tsc clean, `npm --prefix frontend test` (old tests pass with the same count plus yours, real counts), `npm --prefix frontend run build` pass. Report: component API (exact props), how to mount it inside the existing sample button, and **Commit groups**.
