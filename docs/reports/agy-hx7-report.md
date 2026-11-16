# AGY Report — Lane hx7: Service Worker Update & Safe Reload

**Date:** 2026-11-16  
**Agent:** Antigravity (agy)  
**Lane:** hx7 — never strand a user on stale code, and never reload under a finger.  

---

## 1. Files Changed

1. **`frontend/src/drivers/swUpdate.ts`** *(new)*:
   - Implemented `createUpdateWatcher({ sw = navigator.serviceWorker, reload, storage = sessionStorage })`.
   - Listens for `controllerchange` on the service worker container.
   - Detects fresh install vs existing controller: if `sw.controller` was null on load, ignores the very first `controllerchange` (fresh install activation and clients claiming); subsequent controller changes fire `onUpdate(listener)`.
   - Returns unsubscribe cleanup function from `onUpdate(listener)`.
   - Implements `reloadOnce(reason)`: checks `sessionStorage` key `gt_reloaded` (and in-memory guard); if unset, sets it with `reason` and triggers `reload()`. If already set in the current session, skips reload to prevent reload loops. All operations enclosed in `try/catch`.
   - Exports singleton accessor `getDefaultUpdateWatcher()` and helper `reloadOnce(reason)`.

2. **`frontend/src/drivers/pdf.ts`**:
   - Expanded `PdfErrorReason` union with `'stale'`: `'password' | 'invalid' | 'empty' | 'timeout' | 'stale'`.
   - In `defaultPdfLoader`, wrapped dynamic `import('pdfjs-dist')` in `try/catch`; when import rejects, throws `new PdfError('stale', 'PDF chunk import failed (stale deployment)')`.
   - In `renderFirstPage`, updated error handling to propagate `PdfError('stale')` (and detect chunk/import load rejections as `'stale'`).

3. **`frontend/src/flow/capture.ts`**:
   - Mapped `PDF_ERROR_KEYS['stale']` to `'app.updatedReloading'`.
   - `pdfErrorMessage('stale')` and `captureErrorMessage(new PdfError('stale'))` return `t('app.updatedReloading')`.
   - Updated `processImageFile`: when handling `PdfError('stale')`, speaks `t('app.updatedReloading')` and schedules `reloadOnce('stale')` after 2500 ms (2.5 s), safely cancelled if the request signal is aborted.
   - Added `scheduleStaleReload` export.

4. **`frontend/src/App.tsx`**:
   - Added `AppProps { watcher?: UpdateWatcher }` accepting an injected watcher (defaults to `getDefaultUpdateWatcher()`).
   - Added `pendingUpdateRef` and `reloadTimerRef`.
   - Added one effect subscribing to the update watcher:
     - If current view is `'start'` or `'capture'`, speaks `t('app.updatedReloading')` and schedules `reloadOnce('sw-update')` after 2.5 s.
     - If current view is any other screen (e.g. `'explore'`), sets `pendingUpdateRef.current = true` and does not reload.
     - When navigating back to `'start'` or `'capture'` with `pendingUpdateRef.current === true`, triggers spoken line and reloads after 2.5 s.
     - If the user leaves `'start'` or `'capture'` while the 2.5 s timer is ticking, cancels the reload timer and re-flags `pendingUpdateRef` to ensure the app **never reloads under a finger**.

5. **`frontend/src/i18n/index.ts`**:
   - Added `'app.updatedReloading'` across all three supported languages:
     - **en**: `"App updated. Reloading…"`
     - **hi**: `"ऐप अपडेट हो गया है। पुनः लोड हो रहा है…"`
     - **gu**: `"એપ અપડેટ થઈ ગઈ છે. ફરી લોડ થઈ રહ્યું છે…"`

6. **`frontend/tests/hx7.swUpdate.test.ts`** *(new)*:
   - Full Vitest suite with fakes covering all 5 core requirements and translations.

---

## 2. Tests Added (`frontend/tests/hx7.swUpdate.test.ts`)

- **1. First controller is ignored**:
  - Verified with fake service worker container where `controller === null`: the initial `controllerchange` event (fresh install claiming clients) does not trigger `onUpdate`.
  - A second `controllerchange` event in the same session triggers `onUpdate`.
  - If `controller` is already present at initialization (returning user with existing SW), the first `controllerchange` triggers `onUpdate` immediately.
- **2. Update on Capture reloads once**:
  - Mounted `<App watcher={fakeWatcher} />` in jsdom and navigated to Capture screen.
  - Triggered SW update callback: verified speech spoke `t('app.updatedReloading')`.
  - Verified no reload at 2.4 s; verified `reloadOnce('sw-update')` was called at 2.5 s.
- **3. Update in Explore does not reload until Capture is shown**:
  - Navigated to Explore screen and triggered SW update callback.
  - Advanced fake timers by 10 s: verified `reloadOnce` was never called while exploring.
  - User pressed Back returning to Capture: verified speech announcement and `reloadOnce('sw-update')` triggered 2.5 s after returning.
- **4. A second update in the same session does not reload again**:
  - Verified `reloadOnce`: first call sets `sessionStorage` key `gt_reloaded` and executes `reload()`; second call in the same session sees `gt_reloaded` and returns `false` without executing `reload()`.
- **5. Import failure maps to 'stale'**:
  - `defaultPdfLoader` with failing dynamic import throws `PdfError` with `reason === 'stale'`.
  - `renderFirstPage` preserves and propagates `PdfError('stale')`.
  - `pdfErrorMessage('stale')` and `captureErrorMessage(err)` return `t('app.updatedReloading')`.
  - `processImageFile` on stale error speaks `app.updatedReloading` and invokes `reloadOnce('stale')` after 2.5 s.
- **6. i18n translations**:
  - Verified distinct, accurate translations for `app.updatedReloading` in English, Hindi, and Gujarati.

---

## 3. What Could Not Be Verified

- Shell commands (such as `npm test`, `npm run build`, `tsc`, `git`) were strictly not run, in compliance with the headless run rules (`"Do NOT run any shell command. No npm, npx, python, pytest, ruff, git, curl. The orchestrator runs all gates."`).
- Real physical device vibration and browser service worker lifecycle on Android Chrome (orchestrator handles end-to-end verification and gates).
