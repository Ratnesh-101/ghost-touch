# Lane x-brandfinal: adopt the approved logo and add a 64x64 favicon

DECISION BY THE OWNER (2026-11-06): the CURRENT logo is approved: `frontend/public/brand/logo-mark.svg` (and the rest of the current brand set) plus `frontend/public/favicon.svg`, and the owner wants a 64x64 favicon. The alternative-logo exploration is cancelled. The generated PNG and ICO images are already committed in `main`.

DO NOT edit `docs/BUILD_LOG.md`. Create your report `docs/reports/agy-x-brandfinal-report.md` FIRST as a short skeleton and update it as you go. Allowed commands: `npm --prefix frontend test`, `npm --prefix frontend run build`, `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `git status`, `git diff`. NO backend commands. You cannot run `node scripts/build-brand.mjs` (the supervisor runs it after you finish). Never open `.env*`.

## Allowed files
`scripts/build-brand.mjs`, `frontend/index.html`, `frontend/vercel.json`, `frontend/vite.config.ts` (only if needed), `frontend/tests/vercel.rewrite.test.ts`, `frontend/tests/pwa.config.test.ts`, `frontend/tests/logo.test.tsx`, a new `frontend/tests/brand.assets.test.ts`, `docs/design/LOGO.md`, `docs/design/LAB_THEME.md` (its Logo section only), `docs/reports/agy-x-brandfinal-report.md`.

## Forbidden
The logo SVG files themselves (the design is approved: do not change them), `frontend/src/**`, the backend, `.env*`, other tests (extend only the named ones; never weaken an assertion).

## Do
1. `scripts/build-brand.mjs`: add one more output, `frontend/public/favicon-64x64.png` (64x64, transparent background), rendered from `frontend/public/favicon.svg` exactly the way the 16/32/48 favicon renders are produced for the ICO (same render path, same device scale handling). Keep every existing output and its filename unchanged. Update the script's header comment and its list of outputs.
2. `frontend/index.html`: add `<link rel="icon" type="image/png" sizes="64x64" href="/favicon-64x64.png">` next to the existing favicon links (keep the SVG and ICO links as they are).
3. IMPORTANT deploy bug to prevent: `frontend/vercel.json` has a SPA rewrite whose negative lookahead excludes `favicon\..*`. The new file is named `favicon-64x64.png`, which that pattern does NOT match, so Vercel would answer `/favicon-64x64.png` with `index.html`. Fix the rewrite so every `favicon*` file passes through (for example exclude `favicon[^/]*`), and extend `tests/vercel.rewrite.test.ts` with `/favicon-64x64.png`, `/favicon.svg`, `/favicon.ico` and `/apple-touch-icon.png` as pass-through paths, keeping every existing case.
4. Tests: a new `frontend/tests/brand.assets.test.ts` that reads files with `node:fs` and asserts: the approved SVGs exist and each has a `<title>`; `favicon.svg` and `logo-mark.svg` are under 6 KB; `index.html` references `/favicon.svg`, `/favicon.ico`, `/favicon-64x64.png` and `/apple-touch-icon.png`; the manifest in `vite.config.ts` lists the 192, 512 and maskable icons; the committed icon files exist and are PNGs (check the 8-byte PNG signature) with the expected dimensions read from the IHDR chunk (192x192, 512x512, maskable 512x512, apple touch 180x180, og image 1200x630). The `favicon-64x64.png` check must be written so that it passes only once the file exists and is a 64x64 PNG (the supervisor generates it after you finish: mark that single assertion clearly in the report so the supervisor knows it is expected to fail until the script is run, and use `it.todo` or a conditional that skips with a clear message when the file is absent, never a silent pass).
5. `docs/design/LOGO.md` and the `## Logo` section of `docs/design/LAB_THEME.md`: record that the current mark and favicon were approved by the owner on 2026-11-06, list the final asset set with file names and sizes, mention the 64x64 favicon, and note that the alternative-logo exploration was cancelled. Change nothing else in those files.
6. Run tsc, the full frontend suite and the build; record the real results.

## Done
The report lists every file changed, the real command results, which assertion is waiting for the generated PNG, and **Commit groups**.
