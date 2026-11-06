# Lane x-busyretry Report: Handle Server Busy (HTTP 503 / 429 with Retry-After) in the Frontend

**Tool:** Antigravity (agy)  
**Lane:** x-busyretry  
**Date:** 2026-11-06  
**Status:** Complete  

---

## 1. Summary of Changes

When the hardened backend concurrency queue is full (`POST /api/v1/scene` timeout), it returns HTTP 503 with a `Retry-After: 5` header. When client rate limits are exceeded, it returns HTTP 429. Previously, the frontend treated all non-2xx responses generically as `SceneRequestError('http')`, producing a generic failure announcement.

This lane implements:
1. **Distinct `busy` Error Kind:** Extended `SceneFailure` in `frontend/src/api/scene.ts` to include `'busy'`.
2. **`Retry-After` Header Parsing:** Added `parseRetryAfter` with strict sanitization: parses integer/float seconds, ignores HTTP-dates and non-numeric values (falling back to 3 s default), and clamps to the range 1..10 s.
3. **Single Automatic Retry:** `requestScene` now automatically retries once for 503 and 429 responses after the parsed wait time. It strictly respects the overall `SCENE_TIMEOUT_MS` (45 s) and caller `AbortSignal`. If remaining budget is less than or equal to the wait time, or if aborted, it skips the retry. A second 503/429 surfaces as `SceneRequestError('busy', retryAfterSeconds)`. Non-busy errors (400, 404, 500, network rejection) are never retried.
4. **Spoken and Visible UI Announcement:** Added `captureErrorMessage` in `frontend/src/flow/capture.ts` mapping `SceneRequestError('busy')` to `capture.errorBusy`. Spoken via `drivers.speech.speak` and mirrored in the status region (`StatusText`). The retry button ("Take photo") maintains focus so the student can easily try again.
5. **Full i18n Table Parity (en, hi, gu):** Added `'capture.errorBusy'` to all three language dictionaries in `frontend/src/i18n/index.ts`, preserving strict key parity.
6. **Comprehensive Unit Tests:** Extended `frontend/tests/api.scene.test.ts` and `frontend/tests/flow.capture.test.ts` with 13 new unit tests covering all retry, clamping, fallback, abort, and error-mapping behaviors using Vitest fake timers.

---

## 2. Detailed Implementation

### 2.1 `frontend/src/api/scene.ts`
- **Constants**:
  - `DEFAULT_RETRY_AFTER_SECONDS = 3`
  - `MIN_RETRY_AFTER_SECONDS = 1`
  - `MAX_RETRY_AFTER_SECONDS = 10`
- **Error types**:
  - `SceneFailure`: `'timeout' | 'network' | 'http' | 'bad-response' | 'aborted' | 'busy'`
  - `SceneRequestError`: stores `failure: SceneFailure` and optional `retryAfterSeconds?: number`.
- **`parseRetryAfter(headerValue: string | null | undefined): number`**:
  - Rejects null, undefined, empty, non-digit strings, and HTTP-date strings (e.g. `'Wed, 21 Oct 2015 07:28:00 GMT'`), returning default `3`.
  - Parses numeric seconds and clamps to `1`..`10` seconds.
- **`requestScene(image: Blob, options: SceneRequestOptions)`**:
  - Employs a fresh `FormData` factory for each request.
  - On receiving status `503` or `429`:
    - Reads `Retry-After` header via case-insensitive lookup.
    - Evaluates remaining time against overall `timeoutMs` (45 s).
    - If `remainingMs <= waitMs` or `controller.signal.aborted`, immediately throws `SceneRequestError('busy', retryAfterSec)`.
    - Otherwise, sleeps for `waitMs` with signal cancellation listener.
    - Retries the `POST /api/v1/scene` request once.
    - If the retry also returns `503` or `429`, throws `SceneRequestError('busy', secondRetryAfter)`.
  - Clears all timeouts and removes abort listeners in `finally`.

### 2.2 `frontend/src/flow/capture.ts` & `frontend/src/screens/Capture.tsx`
- Added `captureErrorMessage(error: unknown): string`:
  - `PdfError` -> `pdfErrorMessage(error.reason)`
  - `SceneRequestError` with `failure === 'busy'` -> `t('capture.errorBusy')`
  - All other errors -> `t('capture.error')`
- In `processImageFile`: caught errors pass through `captureErrorMessage(err)` and are passed to `deps.say(...)`.
- In `Capture.tsx`: `deps.say` speaks via `speech.speak` and sets `status` displayed in `<StatusText spoken={drivers.speech.canSpeak}>{status}</StatusText>`.
- In `Capture.tsx`: on failed outcome, `drivers.audio.playEarcon('error')` sounds and `takeButton.current?.focus()` keeps the "Take photo" button focused and reachable.

### 2.3 `frontend/src/i18n/index.ts`
Added key `'capture.errorBusy'` to all three tables:
- **`en`**: `"The server is busy right now. Please try again in a moment."`
- **`hi`**: `"सर्वर अभी व्यस्त है। कृपया थोड़ी देर में पुन: प्रयास करें।"`
  - *Flag:* Machine-written translation; needs native speaker check.
- **`gu`**: `"સર્વર અત્યારે વ્યસ્ત છે. કૃપા કરીને થોડીવારમાં ફરી પ્રયાસ કરો."`
  - *Flag:* Machine-written translation; needs native speaker check.

---

## 3. Verification & Proof

All allowed verification commands were run and passed cleanly:

### 3.1 TypeScript Typecheck
```powershell
npm --prefix frontend exec -- tsc -p frontend --noEmit
```
**Output:** Clean, exit code 0, 0 errors.

### 3.2 Frontend Test Suite
```powershell
npm --prefix frontend test
```
**Output:**
```
 RUN  v5.1.0 C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-x-busyretry/frontend

 Test Files  76 passed (76)
      Tests  1122 passed (1122)
   Start at  13:32:40
   Duration  1.23s (transform 53%, import 26%, tests 16%, worker 5%)
```
All 1122 tests passed across 76 test files (13 new unit tests added: 10 in `api.scene.test.ts` and 3 in `flow.capture.test.ts`).

### 3.3 Frontend Production Build
```powershell
npm --prefix frontend run build
```
**Output:**
```
✓ 77 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                                                     0.13 kB
dist/manifest.webmanifest                                              0.49 kB
dist/index.html                                                        1.72 kB │ gzip:   0.64 kB
dist/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2     17.20 kB
dist/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2     17.52 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs                            1,264.34 kB
dist/assets/index-BTsYWoe7.css                                        63.84 kB │ gzip:  10.00 kB
dist/assets/index-CRelzRkA.js                                        371.76 kB │ gzip: 109.44 kB
dist/assets/pdf-ULJPBbF3.js                                          430.16 kB │ gzip: 129.27 kB

✓ built in 169ms

PWA v2.0.0
mode      generateSW
precache  22 entries (530.66 KiB)
files generated
  dist/sw.js
  dist/workbox-835c8c05.js
```
Clean build, exit code 0.

### 3.4 Commands Not Run
Per instructions ("Do NOT run backend tests or ruff"), zero backend commands were executed.

---

## 4. Governance & Constraints Check

- **Ownership:** Zero edits to Kiro-owned files (`frontend/src/core/**`, `*.prop.test.ts`, `backend/app/schema.py`, etc.).
- **No Git Mutations:** No commits, pushes, branches, or PRs executed.
- **No Secrets:** No `.env` files read or touched.
- **Architecture:** No `any`, no `console.log`, strings routed through `t()`, 48×48 px targets preserved, spoken state change on error.

---

## 5. Files Touched

- `frontend/src/api/scene.ts`
- `frontend/src/flow/capture.ts`
- `frontend/src/i18n/index.ts`
- `frontend/tests/api.scene.test.ts`
- `frontend/tests/flow.capture.test.ts`
- `docs/BUILD_LOG.md`
- `docs/reports/agy-x-busyretry-report.md`

---

## Commit groups

- `feat(api): handle server-busy 503/429 with one Retry-After retry and a spoken message`
