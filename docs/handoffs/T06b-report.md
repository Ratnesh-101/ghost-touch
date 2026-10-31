# T06b report — PDF upload (first page only)

Builder: **Antigravity (agy)**, 2026-11-01. Followed `AGENTS.md` exactly: FRONTEND ONLY, no Kiro-owned file edited, no git state changes, no `.env` access.

## What was built
- **pdfjs-dist installed**: `pdfjs-dist` (v6.4.299) installed via `npm install pdfjs-dist` in `frontend/`.
- **PDF first-page renderer** (`drivers/pdf.ts`):
  - `renderFirstPage(file: Blob, maxSide = MAX_IMAGE_SIDE, loader = defaultPdfLoader)` renders page 1 of any valid PDF to a JPEG Blob (quality 0.85, white background, aspect ratio preserved, downscaled to max 1600 px side).
  - Lazy loading: `pdfjs-dist` imported dynamically via `await import('pdfjs-dist')` inside `defaultPdfLoader`, separating it from the main bundle into its own chunk (`dist/assets/pdf-*.js`).
  - Worker configured: `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`; set `pdfjs.GlobalWorkerOptions.workerSrc = workerUrl`.
  - Typed error mapping (`PdfError` with `reason: 'password' | 'invalid' | 'empty'`):
    - `PasswordException` -> `'password'`
    - `InvalidPDFException` or unreadable/render failure -> `'invalid'`
    - Zero pages (`numPages <= 0`) -> `'empty'`
  - Cleanup in `finally`: properly calls `doc.cleanup()`, `doc.destroy()` (if available) and `loadingTask.destroy()`.
- **Capture flow** (`flow/capture.ts`):
  - `validateImageFile` accepts `application/pdf` for "Choose image" source up to the 10 MB limit; camera source does not accept PDFs.
  - Spoken notification on choosing PDF: `"Using the first page of the PDF. Reading your diagram"` (single combined utterance).
  - Handled spoken errors without silence:
    - `'password'`: "That PDF is password protected."
    - `'invalid'`: "I couldn't open that PDF. Try a screenshot of the page."
    - `'empty'`: "That PDF has no pages. Please choose another diagram."
- **PWA Precache & Vite config** (`vite.config.ts`):
  - Added `workbox.globIgnores: ['**/pdf*']` so the 1.26 MB PDF worker and PDF chunk do not blow up the service worker precache cache.
  - Precache remains at 12 entries (186.43 KiB after T06b).
- **Tests**:
  - `tests/drivers.pdf.test.ts`: 5 unit tests with injected fake loader verifying password, invalid, empty, and happy-path cleanup.
  - `tests/flow.capture.test.ts`: PDF rejection tests converted to acceptance tests (PDF accepted, spoken first page message, error mapping, camera source rejection).
  - `tests/camera.test.ts`: updated validator tests for PDF acceptance when allowed.

## Bundle sizes
| Asset | Before T06b | After T06b | Change |
|---|---|---|---|
| Main JS chunk (`dist/assets/index-*.js`) | 160.39 kB (52.08 kB gzip) | 163.77 kB (53.37 kB gzip) | +3.38 kB (glue & strings only) |
| PDF lazy chunk (`dist/assets/pdf-*.js`) | — | 483.74 kB (144.80 kB gzip) | Separate lazy chunk |
| PDF worker (`dist/assets/pdf.worker.min-*.mjs`) | — | 1,264.34 kB | Excluded from precache |
| Service worker precache | 12 entries (183.13 KiB) | 12 entries (186.43 KiB) | +3.30 KiB |

## Commands and results (from `frontend/`)
| Command | Result |
|---|---|
| `npx tsc --noEmit` | Clean (0 errors) |
| `npm run build` | Built in 1.17s; separate lazy chunk confirmed |
| `npm test` | 137 passed (15 files) |

## DoD checklist
- [x] `npm test`, `npx tsc --noEmit`, `npm run build` pass.
- [x] Separate lazy chunk for pdf.js confirmed (`dist/assets/pdf-BtCWNl9F.js`).
- [x] Precache did not blow up (kept at 12 entries / 186.43 KiB using `workbox.globIgnores`).
- [ ] Phone check with live backend (one-page PDF, multi-page PDF, password-protected PDF) needs real phone with backend running.
- [x] `docs/handoffs/T06b-report.md` written and `BUILD_LOG.md` entry added.
