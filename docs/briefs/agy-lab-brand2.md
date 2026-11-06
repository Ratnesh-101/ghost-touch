# Lane lab-brand, pass 2: finish the mascot and write the report

A first pass (same worktree) already created the SVG assets in `frontend/public/brand/`, `frontend/public/favicon.svg`, `Logo.tsx`, `scripts/build-brand.mjs`, the README and `index.html`/manifest edits, and tests (tsc clean, 483 tests passing). It stopped before finishing. Read `docs/briefs/lab-spec.md` and `docs/briefs/agy-lab-brand.md` first, then `git status` and `git diff --stat` to see what exists. Do NOT redo finished work and do NOT run the backend test suite (it is irrelevant to this lane).

## Allowed files
`frontend/src/components/Mascot.tsx`, `frontend/tests/mascot.test.ts`, `docs/design/LOGO.md` (complete it if it is missing sections: construction, colours, clear space, minimum size, don'ts), `docs/reports/agy-lab-brand-report.md`, and small fixes to files the first pass created if you find a bug while reviewing them.

## Do
1. Redraw `Mascot.tsx`: a friendly stitched phone creature with a bolt and a glowing screen-face (original design, matching the logo mark's phone-with-seam and neck-bolt language, but a character with a face: two simple eyes and a small smile drawn as the glowing screen). Keep it decorative (`aria-hidden="true"`), keep the props `className` and `size` and the `gt-mascot` class, stay within the size limit enforced by `tests/mascot.test.ts`, no text elements, never gory or scary. Colours may be literal hex inside the SVG, matching the palette: green `#39ff88`, copper `#c9803a`, bone `#e8dfc8`, charcoal `#0b0e0c`. Extend `tests/mascot.test.ts` if useful; keep every existing assertion.
2. Review the first pass quickly against `docs/briefs/agy-lab-brand.md`: each SVG under its size limit with a `<title>`; `Logo.tsx` props (`variant`, `decorative`, `className`, `height`) and accessibility (decorative copies `aria-hidden`, the non-decorative one has `role="img"` and the accessible name "Ghost Touch" via `t('app.name')`); `index.html` tags; the manifest block (icons including a maskable entry, `theme_color` and `background_color` `#0b0e0c`); the `globPatterns` line of `vite.config.ts` untouched. Fix any bug you find and say what you fixed.
3. Run `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` and `npm --prefix frontend run build` and record the real results.
4. Write `docs/reports/agy-lab-brand-report.md`: files created and changed, the exact command the supervisor must run for the PNG/ICO files (`node scripts/build-brand.mjs`), doubts, and a **Commit groups** section (ordered conventional commits with the exact files each). Write the report even if something failed; say what failed.

## Rules
Do not run any other commands. Never open `.env*` files. No git state changes.
