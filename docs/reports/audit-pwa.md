# PWA, Offline, and Asset Audit: Lab Redesign Risks

> **Audit Context**: Preparation for the Frankenstein's Laboratory redesign (self-hosted fonts, new brand assets, maskable icons, favicons, and social preview meta).  
> **Target Report**: `docs/reports/audit-pwa.md`  
> **Rules Enforced**: Read-only audit; no runtime code or test changes; allowed verification commands only.

---

## 1. Precache Analysis: Present & Planned Assets

### 1.1 Existing Public Assets and Sizes
Analysis of `frontend/public/**` assets present in the tree:

| File Path | Raw Size | Description | In Current Precache? |
|---|---|---|---|
| `frontend/public/icons/icon-192.png` | ~4.2 KB | PWA icon (192×192 PNG) | Yes (Duplicate in SW) |
| `frontend/public/icons/icon-512.png` | ~13.8 KB | PWA icon (512×512 PNG) | Yes (Duplicate in SW) |
| `frontend/public/mascot/frankenstein-phone.svg` | ~2.6 KB | Inline/static mascot vector (55 lines) | Yes |
| `frontend/public/samples/triangle.json` | ~0.9 KB | Geometry sample fixture (54 lines) | Yes |
| `frontend/public/samples/sine.json` | ~4.6 KB | Function graph fixture (425 lines) | Yes |
| `frontend/public/samples/barchart.json` | ~1.1 KB | Bar chart fixture (55 lines) | Yes |
| `frontend/public/voice/manifest.json` | ~0.8 KB | Svara creature voice metadata (38 lines) | Yes (Orphaned cues) |

*Note: No favicon (`favicon.ico` / `favicon.svg`) or `robots.txt` currently exists in `frontend/public/`.*

### 1.2 Verification of `frontend/dist/sw.js` Precache Manifest
Running `npm --prefix frontend run build` produces the following build output:
```
dist/registerSW.js                           0.13 kB
dist/manifest.webmanifest                    0.48 kB
dist/index.html                              0.70 kB │ gzip:   0.40 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs  1,264.34 kB
dist/assets/index-DkhKiTy5.css              23.69 kB │ gzip:   4.84 kB
dist/assets/index-DiKDvnGx.js              330.17 kB │ gzip:  99.91 kB
dist/assets/pdf-ULJPBbF3.js                430.16 kB │ gzip: 129.27 kB

PWA v2.0.0
mode      generateSW
precache  14 entries (378.97 KiB)
files generated: dist/sw.js, dist/workbox-9c191d2f.js
```

Inspection of `frontend/dist/sw.js` reveals the exact 14 precached entries passed to `e.precacheAndRoute`:
1. `registerSW.js` (hash `1872c500de69...`)
2. `index.html` (hash `3765b0d39d18...`)
3. `voice/manifest.json` (hash `1a78ad1d5a96...`)
4. `samples/triangle.json` (hash `2aa23423fce1...`)
5. `samples/sine.json` (hash `f81e44bf6e35...`)
6. `samples/barchart.json` (hash `c3fe075076e9...`)
7. `mascot/frankenstein-phone.svg` (hash `bfd5c9199f40...`)
8. `icons/icon-512.png` (hash `7315040f4598...`)
9. `icons/icon-192.png` (hash `22359a8eafd1...`)
10. `assets/index-DkhKiTy5.css` (content-hashed by Vite)
11. `assets/index-DiKDvnGx.js` (content-hashed by Vite)
12. `icons/icon-192.png` (**DUPLICATE ENTRY**)
13. `icons/icon-512.png` (**DUPLICATE ENTRY**)
14. `manifest.webmanifest` (hash `23128f392932...`)

### 1.3 How `globPatterns` and `globIgnores` Behave
In `frontend/vite.config.ts`:
```ts
includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
workbox: {
  globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
  globIgnores: ['**/pdf*'],
}
```

1. **Precache Duplication Bug**:
   `includeAssets` explicitly injects `icons/icon-192.png` and `icons/icon-512.png`. Simultaneously, `globPatterns` captures `**/*.png`, which matches `dist/icons/icon-*.png`. Workbox adds them twice into the generated manifest array.
2. **Behavior with Planned Lab Assets**:
   - **Self-hosted Fonts (`.woff2`)**: **WILL NOT BE PRECACHED**. The extension `woff2` is missing from `globPatterns`. Vite places bundled `@font-face` assets into `dist/assets/*.woff2`. Because `woff2` is not matched, offline users will fail to load Atkinson Hyperlegible.
   - **`public/brand/**` (`.svg`, `.ico`, `.png`)**: **WILL BE PRECACHED** by Workbox glob matching `**/*.{svg,png,ico}`.
     - *Risk*: An OpenGraph image placed in `public/brand/og-image.png` will be precached on every client device even though crawlers fetch over HTTP and app users do not need it in offline storage.
   - **`public/icons/**` (`.png`, `.svg`)**: **WILL BE PRECACHED**.
   - **`public/samples/*.json`**: **WILL BE PRECACHED** (`json` is matched).
   - **PDF Engine Exclusions (`globIgnores: ['**/pdf*']`)**: Correctly excludes `pdf.worker.min-*.mjs` (1.26 MB) and `pdf-*.js` (430 KB) from the precache. However, this means PDF parsing cannot occur offline without prior runtime caching.

---

## 2. Web App Manifest & Installability Audit

Inspecting `frontend/vite.config.ts:14-33` and generated `dist/manifest.webmanifest`:

```json
{
  "name": "Ghost Touch",
  "short_name": "Ghost Touch",
  "description": "Feel STEM diagrams by touch on an Android phone.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0b0b10",
  "theme_color": "#0b0b10",
  "lang": "en",
  "scope": "/",
  "orientation": "portrait",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Installability and Specification Findings:
1. **Maskable Icon Violation & Clipping**:
   - `icons/icon-512.png` is assigned to both `purpose: "any"` and `purpose: "maskable"`.
   - The graphic artwork inside `icon-512.png` spans ~90% of the canvas.
   - *Android Adaptive Icon Safe Zone Rule*: Key artwork must be within the central **80% diameter safe zone** (a minimum 10% outer margin padding on all edges). When Android masks this icon into circular, teardrop, or squircle frames, the outer green ring is clipped.
   - *Requirement*: Create a separate, dedicated `icon-maskable-512.png` with generous background margins.
2. **Theme and Background Color Drift**:
   - Manifest: `"theme_color": "#0b0b10"`, `"background_color": "#0b0b10"`.
   - `index.html`: `<meta name="theme-color" content="#0b0b10" />`.
   - Lab Redesign (`lab-spec.md`): Background is charcoal **`#0b0e0c`**.
   - *Impact*: During Android splash screen loading and status bar styling, the OS displays the old `#0b0b10` color before jumping to `#0b0e0c`, creating a visible theme flash. Both files must be synchronized to `#0b0e0c`.
3. **Missing iOS Apple Touch Icon**:
   - iOS Safari ignores the Web App Manifest icon declarations for home screen bookmarks.
   - `index.html` lacks `<link rel="apple-touch-icon" href="/icons/icon-192.png">`. iOS users get an auto-generated page screenshot tile.
4. **Missing Manifest `id` Property**:
   - Modern W3C Web App Manifest specification recommends setting `"id": "/"` to uniquely distinguish the PWA identity regardless of origin URL variations.
5. **Orientation Constraint (`orientation: "portrait"`)**:
   - Standalone mode enforces portrait. While STEM exploration on phones prioritizes portrait grip, widescreen bar charts or math curves in landscape mode cannot be rotated by the user when locked to portrait in the manifest.

---

## 3. Offline Risks & Routing Analysis

### 3.1 First Load Offline
- PWAs cannot boot for the very first time without network connectivity, as the browser requires an HTTP fetch to acquire `index.html`, register `sw.js`, and populate CacheStorage.
- If previously loaded once, Workbox `NavigationRoute` returns precached `index.html`.
- Bundled samples (`triangle.json`, `sine.json`, `barchart.json`) and saved diagrams (`IDBDiagramStore`) function 100% offline.
- Dynamic PDF loading fails offline because PDF chunks are excluded via `globIgnores`.

### 3.2 Update Lifecycle (`registerType: 'autoUpdate'`)
- In `frontend/vite.config.ts`, `registerType: 'autoUpdate'` outputs `self.skipWaiting()` and `clientsClaim()` in `sw.js`.
- In `frontend/dist/registerSW.js`:
  ```js
  if('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
    })
  }
  ```
- *Risk*: There is **no client reload listener** (`navigator.serviceWorker.addEventListener('controllerchange', ...)`).
- When a new deployment occurs while an end user is interacting with the app:
  1. The new service worker activates immediately in the background and claims the client.
  2. `e.cleanupOutdatedCaches()` purges the old precached chunks.
  3. The user's active page is still executing the old JavaScript bundle.
  4. If the user performs an action triggering a lazy dynamic import (such as loading the PDF parser chunk), the browser requests the old chunk hash. Because it was purged from cache and server, the request throws an unhandled `ChunkLoadError` or MIME type mismatch.

### 3.3 New Font File with Active Old Service Worker
- If a user has the existing service worker cached and a new build ships Atkinson Hyperlegible fonts:
- The old service worker serves the old `index.html` from cache. The app continues rendering with system fonts.
- Once the new SW activates, if `woff2` was omitted from `globPatterns`, the font is never added to the precache. Every font request falls back to the network. If the user goes offline, font rendering defaults to the system fallback stack.

### 3.4 Deep Links, `#/debug`, and Critical `vercel.json` Rewrite Flaw
- **Hash Route (`#/debug`)**: Functions properly. URL hash fragments are never transmitted to the HTTP server. The service worker returns `/index.html`, and React's `subscribeHash` routes to `<Debug />`.
- **CRITICAL DEFECT IN `frontend/vercel.json` REWRITES**:
  Lines 44-49 of `frontend/vercel.json`:
  ```json
  "rewrites": [
    {
      "source": "/((?!assets/|samples/|icons/|sw\\.js|manifest\\.webmanifest).*)",
      "destination": "/index.html"
    }
  ]
  ```
  *Analysis of the Negative Lookahead Regex*:
  The rewrite regex intercepts any request not starting with `assets/`, `samples/`, `icons/`, `sw.js`, or `manifest.webmanifest`, rewriting it to `/index.html`.
  1. **`/brand/*` is SHADOWED**: When Brand lane adds `/brand/logo.svg`, `/brand/og-image.png`, or `/brand/mascot.svg`, Vercel rewrites these requests to `/index.html` (returning HTTP 200 with `text/html`). Browsers parsing SVG or PNG fail immediately.
  2. **`/favicon.*` is SHADOWED**: Favicon requests (`/favicon.ico`, `/favicon.svg`) are rewritten to `/index.html`.
  3. **`/registerSW.js` & `/workbox-*.js`**: While root files, they are omitted from the negative lookahead! If requested by the browser or worker, they risk receiving HTML text rather than JavaScript.

---

## 4. Large-Asset Risks

1. **Self-Hosted Font Budget**:
   - Atkinson Hyperlegible has 4 styles: Regular, Bold, Italic, Bold Italic.
   - Each `.woff2` file is ~25–30 KB.
   - If all 4 styles are precached, total font payload is **~105–120 KB**.
   - If only Regular and Bold are bundled (the app UI does not use italics), total payload is **~55–60 KB**.
   - *Recommendation*: Include only `AtkinsonHyperlegible-Regular.woff2` and `AtkinsonHyperlegible-Bold.woff2`. Specify `font-display: swap;` in `@font-face` so text is never blocked.
2. **30 KB Image Limit (`lab-spec.md` Rule)**:
   - `icons/icon-192.png`: 4.2 KB (Pass).
   - `icons/icon-512.png`: 13.8 KB (Pass).
   - `mascot/frankenstein-phone.svg`: 2.6 KB (Pass).
   - **`public/brand/og-image.png` (High Risk)**:
     Standard OpenGraph images are 1200×630. A default 24-bit PNG easily exceeds 150–400 KB, which would violate the 30 KB hard constraint.
     *Remediation*: The OG image must be an optimized 8-bit paletted PNG (indexed color) or high-compression vector rendering kept strictly under 30 KB.
3. **Duplicate Files & Stale Assets**:
   - `public/voice/manifest.json`: Orphaned file referencing 8 non-existent MP3s. It wastes a precache slot.
   - `vite.config.ts`: Redundant `includeAssets` duplicating `icons/icon-*.png`.

---

## 5. Social Preview Risks & Dynamic `og:image` Architecture

### 5.1 The Crawling Problem
- OpenGraph specifications demand an **absolute URL** (e.g. `https://ghost-touch.vercel.app/brand/og-image.png`) with `http://` or `https://`. Relative URLs fail on WhatsApp, Twitter/X, Discord, and LinkedIn.
- Social crawlers do not execute JavaScript and do not install Service Workers. Setting meta tags dynamically in React via `document.head` does not work for link previews.
- Hard-coding a static domain into `index.html` breaks branch previews, staging deployments, and custom domain renames.

### 5.2 Cleanest Solution: Vite `transformIndexHtml` Plugin
Vite can dynamically transform `index.html` at build time by reading Vercel and CI environment variables without requiring external dependencies or runtime code.

#### Implementation Sketch (for `frontend/vite.config.ts`):
```ts
import { defineConfig, type Plugin } from 'vite';

function openGraphMetaPlugin(): Plugin {
  return {
    name: 'og-meta-transform',
    transformIndexHtml(html) {
      // Priority: Custom App URL -> Vercel Production URL -> Vercel Deployment URL -> Fallback
      const host =
        process.env.VITE_APP_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://ghost-touch.vercel.app');

      const siteUrl = host.replace(/\/+$/, '');

      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { property: 'og:image', content: `${siteUrl}/brand/og-image.png` },
            injectTo: 'head',
          },
          {
            tag: 'meta',
            attrs: { name: 'twitter:image', content: `${siteUrl}/brand/og-image.png` },
            injectTo: 'head',
          },
          {
            tag: 'meta',
            attrs: { property: 'og:url', content: `${siteUrl}/` },
            injectTo: 'head',
          },
        ],
      };
    },
  };
}
```

In `frontend/index.html`, keep standard static properties (`og:type`, `og:title`, `og:description`), letting the plugin inject the absolute image and URL tags automatically at build time.

---

## 6. Concrete Bugs and Failure Modes (Ranked by Severity)

| # | Severity | File & Location | Problem Description | Concrete Fix |
|---|---|---|---|---|
| **1** | **CRITICAL** | `frontend/vercel.json:46` | **Vercel rewrite regex shadows new static assets**: The pattern `"/((?!assets/|samples/|icons/|sw\\.js|manifest\\.webmanifest).*)"` excludes only 5 paths. Any request to `/brand/*` (`logo.svg`, `og-image.png`), `/favicon.*`, `/registerSW.js`, or Workbox runtime scripts will be rewritten to `/index.html` and returned as HTML. | Update `vercel.json` rewrites regex to: `"source": "/((?!assets/|samples/|icons/|brand/|sw\\.js|manifest\\.webmanifest|registerSW\\.js|workbox-[a-f0-9]+\\.js|favicon\\..*).*)"` |
| **2** | **HIGH** | `frontend/vite.config.ts:35` | **Self-hosted fonts omitted from precache**: `workbox.globPatterns` matches only `{js,css,html,svg,png,ico,json}`. When Atkinson Hyperlegible `.woff2` files are introduced, they will not be precached. The app will fail to load custom fonts offline. | Append `woff2` to `globPatterns`: `globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2}']` |
| **3** | **HIGH** | `frontend/index.html:3-9` | **Missing favicon, apple touch icon, and social preview tags**: `index.html` lacks `<link rel="icon">`, `<link rel="apple-touch-icon">`, and social meta tags (`og:image`, `twitter:card`). Browser tabs and iOS Safari homescreen bookmarks display default/missing placeholders. | Add standard favicon and Apple touch icon link tags in `<head>`, and use the build plugin for OpenGraph tags. |
| **4** | **HIGH** | `frontend/index.html:6` & `frontend/vite.config.ts:18-19` | **Theme color mismatch with Lab redesign**: `index.html` meta and webmanifest specify legacy theme `#0b0b10`. `lab-spec.md` specifies `#0b0e0c`. This causes Android OS splash screens and browser toolbars to display the wrong background color. | Change `theme-color` in `index.html` and `theme_color`/`background_color` in `vite.config.ts` to `#0b0e0c`. |
| **5** | **MEDIUM** | `frontend/vite.config.ts:26-31` & `frontend/public/icons/icon-512.png` | **Maskable icon safe zone violation**: `icon-512.png` is used for `purpose: "maskable"`, but its outer artwork extends to 90% of the canvas. Android adaptive icon masks will slice off the outer ring. | Provide a dedicated `icon-maskable-512.png` with graphics padded inside the 80% safe circle, and decouple it from `purpose: "any"`. |
| **6** | **MEDIUM** | `frontend/vite.config.ts:13,35` | **Duplicate precache entries for PWA icons**: `includeAssets` explicitly specifies `icons/icon-192.png` and `icons/icon-512.png`, while `globPatterns` already captures `**/*.png`. Workbox includes both icons twice in `sw.js`. | Remove `includeAssets` in `vite.config.ts` since `globPatterns` already recursively captures icons. |
| **7** | **MEDIUM** | `frontend/src/drivers/pdf.ts:28-35` & `vite.config.ts:36` | **Offline PDF parsing failure**: `globIgnores: ['**/pdf*']` prevents precaching the 1.26 MB PDF worker. Opening a PDF offline fails with `PdfError('invalid')`. | Keep exclusion to preserve precache budget, but add a Workbox `runtimeCaching` rule so once a user loads a PDF online, the worker is cached for offline use. |
| **8** | **LOW** | `frontend/public/voice/manifest.json` | **Orphaned voice manifest precached**: `voice/manifest.json` references 8 non-existent `.mp3` files (all synthesized audio is Web Audio oscillator-driven). It wastes precache space. | Remove the orphaned `manifest.json` from `frontend/public/voice/`. |
| **9** | **LOW** | `frontend/public/mascot/frankenstein-phone.svg:1` | **JSX attribute in static SVG asset**: Root tag uses `className="gt-mascot"` instead of valid SVG XML attribute `class="gt-mascot"`. | Change `className` to `class` in the static SVG file. |
