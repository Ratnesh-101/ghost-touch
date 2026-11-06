# Antigravity Run Report: Lane lab-pwa

> **Lane:** `lab-pwa`  
> **Tool:** Antigravity (agy)  
> **Briefs:** `docs/briefs/lab-spec.md`, `docs/briefs/agy-lab-pwa.md`  
> **Audit Source:** `docs/reports/audit-pwa.md`  
> **Target Report:** `docs/reports/agy-lab-pwa-report.md`  

---

## 1. Overview of Changes

This lane addressed and resolved all deployment, service worker precache, and offline asset vulnerabilities identified in `docs/reports/audit-pwa.md`:

1. **[Finding 1, CRITICAL] Vercel SPA Rewrite Non-Shadowing**:
   - Updated `frontend/vercel.json` SPA negative lookahead rewrite regex to exclude all static assets and service worker files: `assets/`, `samples/`, `icons/`, `brand/`, `mascot/`, `voice/`, `sw.js`, `registerSW.js`, `workbox-*.js`, `manifest.webmanifest`, `favicon.*`, `apple-touch-icon.png`, and `robots.txt`.
   - Authored `frontend/tests/vercel.rewrite.test.ts` (31 assertions) compiling `vercel.json` rewrite source into a JavaScript RegExp and proving all 19 static asset paths pass through untouched while SPA navigation routes (`/`, `/anything`, `/saved`, `/explore`, etc.) are rewritten to `/index.html`.

2. **[Finding 6] Precache Deduplication**:
   - Removed redundant `includeAssets: ['icons/icon-192.png', 'icons/icon-512.png']` and configured `includeManifestIcons: false` in `frontend/vite.config.ts`.
   - Verified in `frontend/dist/sw.js` that `icons/icon-192.png` and `icons/icon-512.png` now appear exactly once in the precache manifest.

3. **[Finding 4] Theme and Background Color Consistency**:
   - Verified `#0b0e0c` is maintained in both `frontend/vite.config.ts` (`theme_color`, `background_color`) and `frontend/index.html` (`<meta name="theme-color" content="#0b0e0c" />`).
   - Added unit test in `frontend/tests/pwa.config.test.ts` asserting exact equality between HTML meta tag and manifest token.

4. **[Precache Hygiene] Font Precache & Heavy Asset Exclusions**:
   - Retained `woff2` in `workbox.globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2}']`, ensuring both Atkinson Hyperlegible Regular and Bold fonts are precached offline.
   - Added `brand/og-image.*` and `voice/manifest.json` to `globIgnores`. Confirmed `dist/sw.js` contains zero `og-image` entries and zero `voice/manifest.json` entries. Verified that nothing in `src/` loads `voice/manifest.json`.

5. **[Finding 7] Workbox Runtime Caching for PDF Worker**:
   - Added Workbox `runtimeCaching` rule in `frontend/vite.config.ts` targeting `/\/assets\/pdf.*/` using `handler: 'CacheFirst'`, a named cache `'pdf-runtime-cache'`, maxEntries 10, maxAgeSeconds 2,592,000 (30 days), and cacheable statuses `[0, 200]`.
   - Verified that `pdf.worker.min-*.mjs` and `pdf-*.js` chunks are excluded from precache budget while being cached automatically upon first online PDF access.

6. **[Finding 3, Social Preview] Absolute Social Preview URLs & Vite Transform Plugin**:
   - Created `frontend/vite-plugins/siteUrl.ts` implementing `transformSiteUrl` and `siteUrlPlugin`.
   - Rewrites `og:image`, `twitter:image`, and `og:url` to absolute URLs (`${VITE_SITE_URL}/brand/og-image.png`, `${VITE_SITE_URL}/`) when `VITE_SITE_URL` is set, stripping trailing slashes. Leaves relative URLs untouched when unset so local dev and test runners remain deterministic.
   - Added canonical `<meta property="og:url" content="/" />` to `frontend/index.html`.
   - Tested plugin and transform function in `frontend/tests/pwa.config.test.ts`.

7. **[Finding 9] Static Mascot SVG XML Attribute**:
   - Fixed `className="gt-mascot"` to valid XML SVG `class="gt-mascot"` in `frontend/public/mascot/frankenstein-phone.svg`. Tested via unit test.

8. **Deployment Documentation**:
   - Updated `docs/DEPLOY.md` adding Step 3 "Social preview and domain (`VITE_SITE_URL`)" explaining the variable, how to redeploy on Vercel, and verification methods using curl and link preview tools.

9. **Design System Logo Section**:
   - Populated the `## Logo` section of `docs/design/LAB_THEME.md` with the construction summary, brand colors, clear space ("Bolt Rule"), minimum dimensions, prohibited usages ("Don'ts"), and reference link to `LOGO.md` without modifying any other section.

---

## 2. Verification Proof (Definition of Done)

### Gate 1: TypeScript Check
Command: `npm --prefix frontend exec -- tsc -p frontend --noEmit`
Result: Clean (exit code 0, 0 errors).

### Gate 2: Frontend Test Suite
Command: `npm --prefix frontend test`
Result: 55 test files passed, 781 tests passed (exit code 0, duration 893ms).
- Baseline: 53 test files, 737 passed.
- Added: 2 new test files, +44 passed tests:
  - `frontend/tests/vercel.rewrite.test.ts` (31 tests)
  - `frontend/tests/pwa.config.test.ts` (13 tests)

### Gate 3: Frontend Production Build & SW Precache List Inspection
Command: `npm --prefix frontend run build`
Result: Clean build (exit code 0).
Output:
```
dist/registerSW.js                                                     0.13 kB
dist/manifest.webmanifest                                              0.49 kB
dist/index.html                                                        1.63 kB │ gzip:   0.62 kB
dist/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2     17.20 kB
dist/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2     17.52 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs                            1,264.34 kB
dist/assets/index-CXx6tzWZ.css                                        30.99 kB │ gzip:   6.20 kB
dist/assets/index-2tcnqpq1.js                                        336.53 kB │ gzip: 101.07 kB
dist/assets/pdf-ULJPBbF3.js                                          430.16 kB │ gzip: 129.27 kB

PWA v2.0.0
mode      generateSW
precache  18 entries (438.45 KiB)
files generated
  dist/sw.js
  dist/workbox-835c8c05.js
```

### Gate 4: `frontend/dist/sw.js` Precache Verification
Inspected `frontend/dist/sw.js` lines 1:
```javascript
e.precacheAndRoute([
  {url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},
  {url:"index.html",revision:"138484814fd5ca6aea5df5c4126f8b3d"},
  {url:"favicon.svg",revision:"0cdc67b9d75ca9f07aa361a1cee82cb2"},
  {url:"samples/triangle.json",revision:"2aa23423fce1e91f52edda2c0f2a5b05"},
  {url:"samples/sine.json",revision:"f81e44bf6e353b480d8a0948af0c8d3e"},
  {url:"samples/barchart.json",revision:"c3fe075076e939746ef0a8391e013922"},
  {url:"mascot/frankenstein-phone.svg",revision:"bf02adea0650c832ade8e446e3c959fc"},
  {url:"icons/icon-512.png",revision:"7315040f4598bc93f2ff6a87fb2420e5"},
  {url:"icons/icon-192.png",revision:"22359a8eafd1409a1ffea4fb5bc3be50"},
  {url:"brand/logo-mono.svg",revision:"1c3b2f7580c61f3025e36ed79fc44d0a"},
  {url:"brand/logo-maskable.svg",revision:"7e715d801d8a83bc7ce3ffee74d3d628"},
  {url:"brand/logo-mark.svg",revision:"841e64132cd21daea1e625eae158b174"},
  {url:"brand/logo-full.svg",revision:"08e6d7e4539316d182be15e5c54bf628"},
  {url:"assets/index-CXx6tzWZ.css",revision:null},
  {url:"assets/index-2tcnqpq1.js",revision:null},
  {url:"assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2",revision:null},
  {url:"assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2",revision:null},
  {url:"manifest.webmanifest",revision:"5786f9653f177bf5c6e2402c620f16a2"}
],{})
```
Confirmation:
- **Each icon listed once**: `icons/icon-512.png` (entry 8) and `icons/icon-192.png` (entry 9) appear exactly once.
- **woff2 present**: both `atkinson-hyperlegible-latin-700-normal-*.woff2` (entry 16) and `400-normal-*.woff2` (entry 17) are present in precache.
- **og-image absent**: no `brand/og-image.*` appears in `dist/sw.js`.
- **Runtime caching active**: `e.registerRoute(/\/assets\/pdf.*/,new e.CacheFirst({cacheName:"pdf-runtime-cache",...}))` is verified in `dist/sw.js`.

---

## 3. Needs from Kiro

None. All fixes were self-contained within frontend infrastructure and documentation files as scoped by the brief.

---

## 4. Commit Groups

The work is organized into 4 ordered logical commit groups:

### Group 1: Vercel routing and mascot SVG attribute
- **Message:** `fix(pwa): exclude static assets from Vercel SPA rewrite and fix mascot SVG class`
- **Files:**
  - `frontend/vercel.json`
  - `frontend/public/mascot/frankenstein-phone.svg`
  - `frontend/tests/vercel.rewrite.test.ts`

### Group 2: PWA precache deduplication, hygiene, and runtime caching
- **Message:** `fix(pwa): deduplicate icon precache, exclude heavy assets, and cache PDF worker at runtime`
- **Files:**
  - `frontend/vite.config.ts`
  - `frontend/vite-plugins/siteUrl.ts`
  - `frontend/index.html`
  - `frontend/tests/pwa.config.test.ts`

### Group 3: Deployment guide and theme documentation
- **Message:** `docs(deploy): document VITE_SITE_URL social preview step and fill Logo guidelines`
- **Files:**
  - `docs/DEPLOY.md`
  - `docs/design/LAB_THEME.md`

### Group 4: Build log and run report
- **Message:** `docs(report): record lab-pwa build log and verification report`
- **Files:**
  - `docs/BUILD_LOG.md`
  - `docs/reports/agy-lab-pwa-report.md`
