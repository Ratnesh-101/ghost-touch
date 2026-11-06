# Lane lab-start: the three "organ" tiles and their icons (components only)

Read `docs/briefs/lab-spec.md` first. The Start hero shows three organ tiles: Nerves (vibration), Eyes (vision AI), Voice (theremin + speech), one line each. Build them as presentational components. Another lane mounts them on the Start screen later (the Start screen is a single whole-screen button, so everything inside is decorative from the screen reader's point of view and its accessible name stays `t('start.intro')`).

## Allowed files
- `frontend/src/components/start/OrganTiles.tsx`, `frontend/src/components/start/OrganIcons.tsx` (new), `frontend/src/styles/start.css` (new; import from the component, not from `global.css`)
- `frontend/tests/lab.organs.test.tsx` (new), `docs/reports/agy-lab-start-report.md`

## Forbidden
`screens/**`, `i18n/**`, `global.css`, `tokens.css`, `Mascot.tsx`, `Logo.tsx`, drivers, flow, core, backend, prop tests, `.env*`.

## Do
1. `OrganTiles` props: `{ organs: Array<{ id: 'nerves' | 'eyes' | 'voice'; title: string; line: string }>; className?: string }`. Strings come from props. Each tile has an original inline-SVG icon: nerves = a vibrating motor or zig-zag nerve with small arcs; eyes = a stitched, friendly lens (never gory); voice = a theremin antenna with sound waves. Icons are `aria-hidden="true"`, `focusable="false"`, hand-written, under 1.5 KB each.
2. The tiles are a plain list (`ul` and `li`), laid out as three columns on wide screens and stacked rows on narrow ones (320 px safe), readable at 200% zoom, wrapping text rather than truncating. Stitched border and a small rivet per tile, copper hardware, bone secondary text. Not interactive: no buttons, no tab stops (they sit inside the whole-screen start button).
3. Colours only from CSS variables with fallbacks (`var(--gt-copper, var(--gt-green-dim))`, `var(--gt-cyan, var(--gt-green))`, `var(--gt-bone, var(--gt-text-secondary))`). Text at least 7:1 contrast on the tile surface (compute it in a test using the helper style in `tests/a11y.contrast.test.ts` against `tokens.css` values).
4. Tests: three tiles render in order with the given strings; icons are aria-hidden; no focusable elements inside; the CSS has no hard-coded colour literals (regex over `start.css`); a stacked-layout rule for narrow widths exists.

## Done
tsc clean, `npm --prefix frontend test` (old tests pass plus yours, real counts), `npm --prefix frontend run build` pass. Report: exact props, mounting advice, and **Commit groups**.
