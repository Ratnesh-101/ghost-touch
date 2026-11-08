# Wave-B Audit Report: Lane b4-pwa-offline

**Auditor:** Antigravity (agy, reviewed by Claude)  
**Lane:** b4-pwa-offline  
**Date:** 2026-11-08  
**Scope:** PWA and offline behaviour: `frontend/vite.config.ts` (VitePWA, workbox), manifest, icons, service worker update flow, precache contents and size, runtime caching of `/api/*` and `/samples/*`, what works offline (samples, Saved Diagrams in IndexedDB, Explore), what the user hears when offline or when the API is cold (Render free tier cold start 30 to 60 s), retry and timeout behaviour in the API client, stale-service-worker traps (a user stuck on an old build), IndexedDB failure paths (private mode, quota, blocked upgrade, corrupt records), install prompt, and share target / hash-route behaviour after reload.

---

## Executive Summary

The Ghost Touch PWA foundation is exceptionally lightweight and fast: production build precaches 22 entries totaling 659.37 KiB (well within Workbox limits). Bundled samples (`triangle`, `sine`, `barchart`), offline saved diagram exploration in IndexedDB, and the relative haptic/tone exploration engine function 100% offline without network roundtrips.

However, the audit identified critical gaps in offline reliability, service worker lifecycle, and error handling:
1. **CORE-07 Navigation/Announcement Violation:** Deleting the last saved diagram in `SavedDiagrams.tsx` triggers two immediate back-to-back speech calls, cancelling the deletion speech mid-syllable, and fails to return focus to the heading.
2. **Offline Correction Trap:** Teacher Correct mode requires online `POST /api/v1/validate` to save, hard-blocking teachers from saving corrections offline and speaking a hardcoded, unlocalized English error string.
3. **Offline PDF Chunk Failure:** PDF rendering chunks (`pdfjs-dist` and `pdf.worker.min`) are excluded from the precache (`globIgnores: ['**/pdf*']`). An offline student attempting to render a PDF for the first time experiences a fatal chunk import failure and is told "I couldn't open that PDF. Try a screenshot of the page."
4. **Data Loss on Eviction Failure:** Eviction of the oldest unpinned diagram and saving a new diagram are executed across two separate IndexedDB transactions; if `put` fails (e.g. quota exceeded), the evicted diagram is already deleted and permanently lost.
5. **Render Cold-Start Timeout & Proxy Failures:** `SCENE_TIMEOUT_MS` (45s) is shorter than Render's 60s cold-start window, and HTTP 502/504 gateway responses bypass the client's retry logic, emitting misleading generic errors.
6. **Android Autoplay Speech Block on Direct Share Reload:** Opening `/#s=...` directly on page load triggers Web Speech synthesis without a user gesture, which Android Chrome blocks, leaving visually impaired users in silence on a diagram they cannot see.

---

## What Is Sound (Checked & Verified)

- **Bundled sample diagrams offline loading:** `frontend/public/samples/{triangle,sine,barchart}.json` are revisioned in the Workbox precache manifest (`dist/sw.js`). `loadSample(id)` fetches `/samples/${id}.json`, which Workbox serves offline directly from cache with zero network access.
- **Saved Diagrams in IndexedDB offline access:** `IDBDiagramStore` reads and writes `SavedDiagram` entities to `indexedDB`. Listing, opening, and navigating to saved diagrams in Explore execute without any network dependencies.
- **Explore haptics, pitch theremin, and local voice commands offline:** Touch tracking, relative centre calibration, vibration effects, Web Audio theremin pitch (`pitchForY`), and local voice commands (`flow/commands.ts`: "where am I", "next corner", "describe", "help", rate changes) execute entirely in pure client-side TypeScript.
- **Offline Share decoding:** `share/decode.ts` and `resolveShareRoute` inflate and decode `#s=` base64/zlib payloads completely in-browser without network requests.
- **Precache size and font assets:** 22 precached entries total 659.37 KiB. Atkinson Hyperlegible fonts (`latin-400` and `latin-700` woff2) are self-hosted and precached.
- **Backend Warm-up Guard:** `warmBackend()` in `frontend/src/api/health.ts` has a module-level guard (`warmed`), 60s timeout, swallows all network errors, and skips execution when offline.

---

## Detailed Findings

### CONFIRMED FINDINGS (Ranked by Severity)

#### B4-01 · HIGH · `frontend/src/screens/SavedDiagrams.tsx:98-106`
- **What is wrong:** Requirement 17.4 (CORE-07) specifies: *"WHEN the last saved diagram is deleted THEN the system SHALL speak the deletion and the empty list as one utterance and SHALL return focus to the screen heading."* In `SavedDiagrams.tsx`, `handleConfirmDelete` calls `say(msg)` (e.g. "Deleted triangle") and then immediately inside `setEntries` calls `say(t('saved.empty'))`. Because `speech.speak()` invokes `this.synth.cancel()` on every call, the second call cancels the deletion utterance mid-syllable. Additionally, `headingRef.current?.focus()` is never called upon deleting the last entry, leaving TalkBack focus stranded on a removed DOM node.
- **Concrete failure scenario:**
  1. User has exactly one diagram in Saved Diagrams.
  2. User activates "Delete", then activates "Confirm delete".
  3. `say(msg)` starts speech for "Deleted triangle".
  4. React updater runs `next.length === 0` and executes `say(t('saved.empty'))`.
  5. `WebSpeechDriver.speak` executes `this.synth.cancel()`, abruptly aborting "Deleted triangle".
  6. The deletion confirmation is lost; only "No saved diagrams" is spoken.
  7. Focus is lost because the deleted button is unmounted and `headingRef` is never focused.
- **Proposed minimal fix:** In `handleConfirmDelete`, check `entries.length === 1`. When deleting the last diagram, join the two phrases into one utterance (`say(`${msg}. ${t('saved.empty')}`)`) and call `headingRef.current?.focus()`.
- **Proposed test:**
```ts
it('speaks deletion and empty state as one single utterance and focuses heading when last entry is deleted (CORE-07)', async () => {
  const speakMock = vi.fn();
  const fakeStore = new MemoryDiagramStore();
  const entry = { id: 'd1', createdAt: 1000, title: 'Triangle', thumbnailDataUrl: '', scene: { kind: 'geometry' }, pinned: false };
  await fakeStore.put(entry);
  // Render SavedDiagrams, click delete and confirm delete
  // Expect speakMock to be called with "Deleted Triangle. No saved diagrams." in one call, not two separate calls
});
```

---

#### B4-02 · HIGH · `frontend/src/screens/Correct.tsx:445-462`
- **What is wrong:** In Teacher Correct mode, tapping "Save" calls `await requestValidate(history.present)` (`POST /api/v1/validate`). If the teacher is offline, `fetch` throws a network error. In `Correct.tsx:456-461`, the catch block catches the error and executes `sayAndStatus(formatValidationErrors(['Network or server validation error']), true)` without saving. Teachers cannot save corrections offline, trapping them on the screen. Furthermore, `'Network or server validation error'` is hardcoded in English, violating AGENTS.md rule 7 and Requirement 10.
- **Concrete failure scenario:**
  1. Teacher opens a saved diagram while in airplane mode or in a classroom without internet.
  2. Teacher taps "Correct" and adjusts point positions.
  3. Teacher taps "Save".
  4. `requestValidate` fails with network error.
  5. Screen announces hardcoded English: "Network or server validation error."
  6. The corrected diagram is not saved to the store or applied to Explore.
- **Proposed minimal fix:** When offline (`!navigator.onLine` or network failure), fall back to client-side structural validation using `validateShareScene` from `frontend/src/share/validate.ts`, save the valid scene, and announce `t('correct.savedOffline')`. Replace any raw error strings with localized `t()` keys.
- **Proposed test:**
```ts
it('allows saving corrected scene offline when client-side validation passes', async () => {
  const onSave = vi.fn();
  // Mock requestValidate rejecting with ValidateRequestError('network')
  // Verify Correct screen falls back to client validation and calls onSave(scene)
});
```

---

#### B4-03 · HIGH · `frontend/vite.config.ts:46`, `frontend/src/drivers/pdf.ts:29`
- **What is wrong:** `globIgnores: ['**/pdf*']` prevents `pdf-*.js` and `pdf.worker.min-*.mjs` from being precached by Workbox. While `runtimeCaching` defines a `CacheFirst` rule for `/\/assets\/pdf.*/`, dynamic import `await import('pdfjs-dist')` only caches after a successful online fetch. If a student installs the PWA and later selects a PDF while offline, the dynamic import fails fatally with a chunk load error. `renderFirstPage` catches this and speaks the misleading error: "I couldn't open that PDF. Try a screenshot of the page." (violating Requirement 2.2).
- **Concrete failure scenario:**
  1. Student installs Ghost Touch PWA on Android while connected to school Wi-Fi.
  2. Student travels on a bus without connectivity.
  3. Student opens Ghost Touch, taps "Choose image", and selects a math worksheet PDF.
  4. `processImageFile` calls `defaultPdfLoader()` -> `import('pdfjs-dist')`.
  5. The chunk is not in cache; network is unavailable; browser throws `TypeError: Failed to fetch dynamically imported module`.
  6. App speaks: "I couldn't open that PDF. Try a screenshot of the page."
- **Proposed minimal fix:** In `frontend/vite.config.ts`, remove `**/pdf*` from `globIgnores` and set `workbox.maximumFileSizeToCacheInBytes = 3 * 1024 * 1024` so PDF rendering chunks are precached for true offline support.
- **Proposed test:**
```ts
it('fails to load PDF when offline if chunk has not been cached', async () => {
  const offlineLoader = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(renderFirstPage(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 1600, offlineLoader))
    .rejects.toThrow(PdfError);
});
```

---

#### B4-04 · HIGH · `frontend/src/App.tsx:316-324`, `frontend/src/drivers/diagramStore.ts:188-204`
- **What is wrong:** When the saved diagrams store reaches capacity (`SAVED_DIAGRAMS_CAP = 20`), `saveDiagram` in `App.tsx` evicts the oldest unpinned diagram by calling `await drivers.diagramStore.delete(decision.evictedId)`. Once that transaction commits, it calls `await drivers.diagramStore.put(newEntry)` in a second transaction. If the second transaction fails (e.g. `QuotaExceededError` or storage write error), the evicted diagram is already permanently deleted, and the new diagram is not saved, resulting in permanent data loss.
- **Concrete failure scenario:**
  1. Store contains 20 diagrams. Diagram #1 is oldest unpinned.
  2. Device storage is close to quota limit.
  3. User captures a new diagram.
  4. `diagramStore.delete(victimId)` succeeds; transaction 1 commits.
  5. `diagramStore.put(newEntry)` is called with a large thumbnail data URL.
  6. Transaction 2 fails with `QuotaExceededError`.
  7. Diagram #1 is gone forever, and the new diagram was never saved.
- **Proposed minimal fix:** Execute eviction and save in a single atomic readwrite transaction within `DiagramStore` (e.g. `putWithEviction(entry, cap)`), or insert the new entry before deleting the evicted victim.
- **Proposed test:**
```ts
it('preserves evicted entry if put fails due to quota or storage error', async () => {
  // Verify atomic rollback: victim remains in store if put fails
});
```

---

#### B4-05 · MEDIUM · `frontend/vite.config.ts:22`, `dist/sw.js:1`
- **What is wrong:** `pwaOptions.registerType = 'autoUpdate'` generates `self.skipWaiting()`, `clientsClaim()`, and `cleanupOutdatedCaches()`. When a new deployment occurs, the new service worker activates immediately in the background and deletes old cache entries. An active user interacting with the page who triggers lazy loading (PDF import, modal sheets, or font loads) will attempt to fetch old hashed chunk URLs that were purged from cache and no longer exist on the hosting server, crashing dynamic imports with zero recovery or reload prompt.
- **Concrete failure scenario:**
  1. User is on Capture screen in version 1.
  2. Version 2 is deployed to production with new asset hashes.
  3. Browser background SW update downloads `sw.js` (v2), immediately calls `skipWaiting()` and `clientsClaim()`, and invokes `cleanupOutdatedCaches()`, wiping v1 cached chunks.
  4. User clicks "Choose image" -> PDF file.
  5. The runtime evaluates `import('pdfjs-dist')`, requesting `assets/pdf-v1.js`.
  6. Service worker misses cache; network returns 404 from host.
  7. Dynamic import fails fatally without prompting user to reload.
- **Proposed minimal fix:** Add a global `vite:preloadError` event listener in `frontend/src/main.tsx` that reloads the window on chunk load failure:
```ts
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});
```
- **Proposed test:**
```ts
it('reloads page on vite:preloadError chunk load failure', () => {
  const reloadSpy = vi.fn();
  Object.defineProperty(window, 'location', { value: { reload: reloadSpy }, writable: true });
  window.dispatchEvent(new Event('vite:preloadError'));
  expect(reloadSpy).toHaveBeenCalled();
});
```

---

#### B4-06 · MEDIUM · `frontend/src/api/scene.ts:26,141`, `frontend/src/flow/capture.ts:51-59`
- **What is wrong:** Render free tier spins down idle instances and takes between 30 and 60 seconds to boot on the first incoming request. `SCENE_TIMEOUT_MS` in `scene.ts` is capped at 45 seconds (`45_000` ms). If a user launches the app and quickly takes a photo (within 5 seconds), the scene upload aborts at t=50s while Render is still starting up (e.g. taking 52-55s). When `requestScene` times out, `captureErrorMessage` maps `SceneRequestError('timeout')` to generic `t('capture.error')` ("Something went wrong. Please try again, or pick a sample."), without explaining that the server is warming up or advising the user to wait a moment.
- **Concrete failure scenario:**
  1. Backend container on Render is idle/sleeping.
  2. User opens app; `warmBackend` starts `GET /api/v1/health` at t=0.
  3. At t=3s, user taps Start and arrives at Capture.
  4. At t=6s, user takes photo and clicks submit.
  5. `requestScene` sets a 45s timeout timer (expires at t=51s).
  6. Render takes 54 seconds to boot up.
  7. At t=51s, `controller.abort()` fires. `requestScene` throws `SceneRequestError('timeout')`.
  8. User hears "Something went wrong. Please try again, or pick a sample." right before the backend actually wakes up.
- **Proposed minimal fix:** Increase `SCENE_TIMEOUT_MS` to 65_000 ms to comfortably cover the 60s Render cold start window, and differentiate `timeout` in `captureErrorMessage` to speak `t('capture.errorTimeout')` ("The server took too long to respond. It may be waking up, please try again in a few seconds.").
- **Proposed test:**
```ts
it('distinguishes timeout error from generic error in captureErrorMessage', () => {
  expect(captureErrorMessage(new SceneRequestError('timeout'))).not.toBe(t('capture.error'));
});
```

---

#### B4-07 · MEDIUM · `frontend/src/api/scene.ts:64-66,162-184`
- **What is wrong:** During cold starts on Render, the reverse proxy returns HTTP 502 (Bad Gateway) or 504 (Gateway Timeout) while waiting for the FastAPI Uvicorn process to bind to port 10000. `requestScene` defines `isBusyStatus(status)` as only `status === 503 || status === 429`. When Render's proxy returns 502 or 504, `isBusyStatus` evaluates to `false`, the request bypasses the retry loop entirely, immediately fails with `SceneRequestError('http')`, and speaks `capture.error`.
- **Concrete failure scenario:**
  1. Backend container is booting.
  2. Render proxy receives `POST /api/v1/scene` and returns HTTP 502 Bad Gateway.
  3. `isBusyStatus(502)` returns `false`.
  4. Code does not sleep or retry. It throws `SceneRequestError('http')`.
  5. Photo upload fails immediately even though the server is about to finish booting in 2 seconds.
- **Proposed minimal fix:** Include 502 and 504 in `isBusyStatus`:
```ts
function isBusyStatus(status: number): boolean {
  return status === 503 || status === 429 || status === 502 || status === 504;
}
```
- **Proposed test:**
```ts
it('retries on HTTP 502 and 504 status codes during cold start', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response('', { status: 502 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ scene: { kind: 'geometry' }, mode: 'ai' }), { status: 200 }));
  const res = await requestScene(new Blob(['']), { fetchImpl: fetchMock, timeoutMs: 5000 });
  expect(res.mode).toBe('ai');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
```

---

#### B4-08 · MEDIUM · `frontend/src/flow/capture.ts:51-59`
- **What is wrong:** In `captureErrorMessage(error)`, `SceneRequestError('network')` falls through to the default return value `t('capture.error')` ("Something went wrong. Please try again, or pick a sample."). Unlike the Ask flow (which checks for network error and speaks `t('ask.errorOffline')`: "Network error. Check your connection or type your question."), photo capture never informs the user that the internet connection is offline.
- **Concrete failure scenario:**
  1. User is offline.
  2. User taps "Take photo" and captures a textbook diagram.
  3. The app beeps repeatedly with the reading diagram tone.
  4. Fetch throws `TypeError: Failed to fetch`.
  5. `requestScene` throws `SceneRequestError('network')`.
  6. App speaks: "Something went wrong. Please try again, or pick a sample."
  7. Blind user assumes the photo was blurry, badly framed, or corrupted, rather than realizing they need network connectivity for vision LLM diagram extraction.
- **Proposed minimal fix:** Check for `error.failure === 'network'` in `captureErrorMessage` and return a dedicated string `t('capture.errorOffline')`: "You are offline. Connect to the internet to read new diagrams, or explore a sample diagram."
- **Proposed test:**
```ts
it('returns an offline explanation when photo upload fails due to network error', () => {
  expect(captureErrorMessage(new SceneRequestError('network'))).toContain('offline');
});
```

---

#### B4-09 · MEDIUM · `frontend/src/App.tsx`, `frontend/src/screens/Start.tsx`
- **What is wrong:** The PWA does not capture the browser's `beforeinstallprompt` event or provide an accessible, discoverable in-app install button or voice prompt. For blind and low-vision users using TalkBack, Chrome on Android's ambient install banner is virtually invisible and hard to navigate to. Without an accessible install control (e.g. in Start screen or Lab Settings), users miss out on installing the standalone PWA to their home screen for full-screen exploration with hardware gesture exclusion.
- **Concrete failure scenario:**
  1. Low-vision student navigates to `https://ghost-touch.org` on Android Chrome.
  2. Chrome fires `beforeinstallprompt`. The app ignores the event.
  3. Chrome shows a tiny, silent ambient infobar at the bottom of the screen.
  4. TalkBack user continues through the start screen without being informed that Ghost Touch can be installed.
  5. The student must navigate the complex 3-dot overflow menu in Chrome to find "Install app".
- **Proposed minimal fix:** Capture `beforeinstallprompt` in a lightweight driver (`drivers/installPrompt.ts`), and surface an accessible "Install app" button in Lab Settings or Start screen with spoken confirmation.
- **Proposed test:**
```ts
it('captures beforeinstallprompt event and triggers prompt on user action', () => {
  // Test verifying install prompt driver listener
});
```

---

#### B4-10 · MEDIUM · `frontend/vite.config.ts:24-43`
- **What is wrong:** The Web App Manifest defines `name`, `icons`, `display: 'standalone'`, etc., but omits `share_target`. When a student or teacher receives a STEM diagram photo or PDF in WhatsApp, email, or files, they cannot use the Android system "Share" sheet to share the file directly into Ghost Touch.
- **Concrete failure scenario:**
  1. Teacher sends a student a photo of a math diagram via WhatsApp.
  2. Student taps "Share" on the image in WhatsApp.
  3. The system share sheet appears, but Ghost Touch is not listed as a share target.
  4. The student must save the image to Android Files, open Ghost Touch, tap "Choose image", and find the file in the file picker.
- **Proposed minimal fix:** Add `share_target` to `pwaOptions.manifest` in `frontend/vite.config.ts`:
```ts
share_target: {
  action: '/',
  method: 'GET',
  params: {
    title: 'title',
    text: 'text',
    url: 'url',
  },
}
```
- **Proposed test:**
```ts
it('includes share_target in manifest configuration', () => {
  expect(pwaOptions.manifest).toHaveProperty('share_target');
});
```

---

#### B4-11 · LOW · `frontend/src/drivers/diagramStore.ts:154-160`, `frontend/src/core/savedDiagrams.ts:189-214`
- **What is wrong:** If an entry in IndexedDB becomes corrupt (e.g. truncated JSON, invalid `scene.kind`, missing required properties), `deserialise` returns `undefined`. `IDBDiagramStore.list()` skips corrupt records. However, the corrupt record remains in the object store. In `App.tsx`, `existing` only contains valid records. If 15 records are corrupt and 5 are valid, `applyAdd` thinks there are only 5 records and does not evict, allowing total IndexedDB records to exceed `SAVED_DIAGRAMS_CAP` and accumulate dead disk space.
- **Concrete failure scenario:**
  1. Corrupt record exists in IndexedDB from a previous bug or disk glitch.
  2. `diagramStore.list()` returns an array omitting the corrupt record.
  3. The corrupt record cannot be viewed, opened, or deleted in Saved Diagrams screen.
  4. Storage continues to grow without bounds.
- **Proposed minimal fix:** When `list()` encounters an item that fails `deserialise(item)`, record its key and purge it from the store with `store.delete(item.id)`.
- **Proposed test:**
```ts
it('purges corrupt records encountered during list', async () => {
  // Test verifying corrupt record cleanup
});
```

---

#### B4-12 · LOW · `frontend/src/drivers/diagramStore.ts:89-94,196-198`
- **What is wrong:** `idbPromise(req)` wraps `IDBRequest` and resolves on `req.onsuccess`. In IndexedDB, `req.onsuccess` for a `put()` operation fires when the request is queued in memory. If the transaction subsequently fails during disk commit (due to quota exceeded or OS I/O error), `tx.onabort` or `tx.onerror` fires. Because `put()` only awaits `idbPromise(req)` and ignores `tx.oncomplete`, `put()` can return `{ ok: true }` even if the transaction aborted and the data was not written.
- **Concrete failure scenario:**
  1. Disk space is full.
  2. `store.put(entry)` is executed. `req.onsuccess` fires.
  3. `put()` returns `{ ok: true }`.
  4. The transaction fails on disk commit, triggering `tx.onabort`.
  5. The app tells the user the diagram was saved, but on reloading, the diagram is missing.
- **Proposed minimal fix:** In `put()`, wait for transaction completion:
```ts
await new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error);
});
```
- **Proposed test:**
```ts
it('rejects put if transaction aborts on commit', async () => {
  // Verify transaction level error propagation
});
```

---

#### B4-13 · LOW · `frontend/vercel.json:37-72`
- **What is wrong:** In `frontend/vercel.json`, `/sw.js`, `/index.html`, and `/manifest.webmanifest` have explicit `Cache-Control: no-cache` headers. However, `/registerSW.js` is not listed, so it falls back to the default rule `/(.*)` with no cache-control header specified, allowing CDN edge caching. If `registerSW.js` is updated by VitePWA in a future build, an edge cache could serve an outdated registration script.
- **Concrete failure scenario:**
  1. Deployment updates `registerSW.js`.
  2. Edge CDN caches `registerSW.js` with default TTL.
  3. Client fetches stale `registerSW.js`.
- **Proposed minimal fix:** Add `/registerSW.js` alongside `/sw.js` in `frontend/vercel.json` with `Cache-Control: no-cache, no-store, must-revalidate`.
- **Proposed test:**
```ts
it('ensures registerSW.js has no-cache header in vercel.json', () => {
  // Verify vercel.json header entries
});
```

---

### UNVERIFIED (Needing Physical Android Device & TalkBack Testing)

#### B4-14 · UNVERIFIED · `frontend/src/App.tsx:234-243`, `frontend/src/screens/Explore.tsx:184-187`
- **What is wrong:** When a shared diagram URL (`/#s=...`) is opened or reloaded, `App.tsx` initializes directly into `{ screen: 'explore' }` and calls `speakShareAnnouncements(...)` inside `useEffect`. Because this happens immediately on page load without any prior user gesture (tap/click), Android Chrome may block Web Speech synthesis under its autoplay user gesture policy. In `Explore.tsx`, `suppressAriaLabel` is set because it believes `announced` was spoken, so the screen reader label on the canvas is suppressed. The student may be left in complete silence on a diagram they cannot see.
- **Concrete failure scenario:**
  1. Student taps a link to a shared diagram: `https://ghost-touch.org/#s=...`.
  2. App loads directly to Explore screen.
  3. `useEffect` in `App.tsx` calls `drivers.speech.speak(utterance)`.
  4. Android Chrome blocks `speechSynthesis.speak()` due to lack of user gesture.
  5. The canvas suppresses aria-label to prevent double speech.
  6. Nothing is spoken, leaving the student unaware that the diagram loaded or what the diagram contains.
- **Proposed minimal fix:** If opened via share link on cold load without prior gesture, show a 1-tap "Explore Shared Diagram. Tap anywhere to begin" unlock screen (or re-speak the announcement on the very first touch/pointerdown of the Explore canvas).
- **Proposed test:** Manual verification on Chrome on Android with TalkBack enabled.

---

## Top 5 to Fix First

1. **B4-01 (SavedDiagrams.tsx:98-106):** Deleting the last saved diagram cancels deletion speech and never restores heading focus (CORE-07 violation).
2. **B4-02 (Correct.tsx:445-462):** Correct mode validation hard-blocks saving corrections when offline and emits hardcoded un-localized string.
3. **B4-03 (vite.config.ts:46 / pdf.ts:29):** PDF dynamically loaded chunk excluded from precache breaks offline PDF rendering on fresh PWA install.
4. **B4-04 (App.tsx:316-324 / diagramStore.ts:188-204):** Non-atomic eviction and save in IndexedDB causes permanent data loss if `put` fails.
5. **B4-06 & B4-07 (scene.ts:26,64 / capture.ts:51-59):** Render free tier cold-start causes 45s upload timeout and 502/504 proxy errors skip retry logic with misleading error messages.
