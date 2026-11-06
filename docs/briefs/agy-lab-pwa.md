# Lane lab-pwa: fix the deployment and offline problems found by the PWA audit

Read `docs/reports/audit-pwa.md` completely first (every finding and its suggested fix), then `docs/briefs/lab-spec.md`. The brand lane has already merged the new icons, favicon, manifest entries and `index.html` tags.

## Allowed files
- `frontend/vercel.json`, `frontend/vite.config.ts` (the whole file this time), `frontend/index.html`
- `frontend/public/mascot/frankenstein-phone.svg` (fix the `className` attribute only)
- `frontend/tests/pwa.config.test.ts` (new), `frontend/tests/vercel.rewrite.test.ts` (new)
- `docs/DEPLOY.md` (add the new variable and steps), `docs/design/LAB_THEME.md` (fill the `## Logo` section from `docs/design/LOGO.md`: construction summary, colours, clear space, minimum size, don'ts, and a link to LOGO.md; do not change other sections), `docs/reports/agy-lab-pwa-report.md`

## Forbidden
`src/**`, backend, `.env*` and `.env.example` (you cannot open them; document variables in `docs/DEPLOY.md` instead), prop tests, deleting files (you cannot; if a file should go, say so in the report).

## Do (audit finding numbers in brackets)
1. [1, CRITICAL] `vercel.json`: the SPA rewrite regex must NOT shadow static files. Exclude `assets/`, `samples/`, `icons/`, `brand/`, `mascot/`, `voice/`, `sw.js`, `registerSW.js`, `workbox-*.js`, `manifest.webmanifest`, `favicon.*`, `apple-touch-icon.png`, `robots.txt`. Write a test (`tests/vercel.rewrite.test.ts`) that reads `vercel.json`, compiles the rewrite source into a JavaScript RegExp, and asserts that every static path above passes through while SPA routes (`/`, `/anything`, `/saved`) are rewritten to `index.html`.
2. [6] Remove the duplicate precache entries (the explicit `includeAssets` for icons that `globPatterns` already captures); confirm with a build that `dist/sw.js` lists each icon once.
3. [4 of the audit's table is done] Keep `theme_color` and `background_color` `#0b0e0c` in both the manifest and `index.html`; add a test that the two match.
4. Precache hygiene: `brand/og-image.png` (about 250 KB) must NOT be precached (add it to `globIgnores`); keep woff2, svg, icons and the sample JSON files precached. Add `voice/manifest.json` to `globIgnores` ONLY after you verify nothing in `src/` loads it (search with the allowed tools); otherwise leave it and say why.
5. [7] Add a Workbox `runtimeCaching` rule so the PDF worker and chunks (excluded from precache to save budget) are cached after the first online use (`CacheFirst`, a named cache, a sensible expiration). Test the config object shape in `tests/pwa.config.test.ts` (import the config pieces or read the file text; keep it robust).
6. [3, social preview] Social images need an ABSOLUTE URL. Add a small Vite plugin in `vite.config.ts` using `transformIndexHtml` that rewrites `og:image`, `twitter:image` and `og:url` to `${VITE_SITE_URL}/brand/og-image.png` (and the site root) when the environment variable `VITE_SITE_URL` is set at build time, and leaves the relative path untouched when it is not (so local builds and tests keep working). Strip a trailing slash from the variable. Unit-test the transform function by exporting it from a separate small module (for example `frontend/vite-plugins/siteUrl.ts`, referenced from `vite.config.ts`; keep it inside `tsconfig` coverage or add it to the config's include if the `tsc` run requires that).
7. [9] Fix `className` to `class` in the static `public/mascot/frankenstein-phone.svg`.
8. `docs/DEPLOY.md`: add a short "Social preview and domain" step explaining `VITE_SITE_URL` (set it in Vercel to the production origin, no trailing slash, then redeploy) and how to test it (a link preview tool).
9. `LAB_THEME.md` `## Logo` section as described above.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all old tests pass, plus yours, real counts), `npm --prefix frontend run build` pass. After the build inspect `frontend/dist/sw.js`'s precache list with the allowed read tools and quote it in the report (each icon once, woff2 present, og-image absent). Run NO backend commands. Report with **Commit groups**; write it even if something failed.
