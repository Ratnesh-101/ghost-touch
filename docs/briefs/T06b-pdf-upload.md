# T06b — PDF upload (first page only)

Builder: Antigravity (Claude Code is the stand-in when the owner is away) | Reviewer: Claude Code (Kiro paused)
Spec: WIN_PLAN "Must-have additions" item 2; Requirement 2 change in `docs/kiro-evidence/spec-change-req13.md` item 2.
Owner approval: **pdfjs-dist approved (2026-11-01).** The owner installs it; do not run `npm install` yourself.

## Owner step first
```
cd frontend
npm install pdfjs-dist
```
Builder: before starting, check that `frontend/node_modules/pdfjs-dist` exists and `frontend/package.json` lists it. If not, stop and say so in the report. Do not add any other dependency.

## Goal
A user can choose a PDF in "Choose image"; the first page is rendered to an image in the browser, then goes through the same path as a photo (downscale, upload). The scene comes from the first page only.

## Current state
- `Capture.tsx` already lets the chooser select PDFs (`accept` includes `application/pdf`).
- `validateImageFile` returns `'pdf'` for PDFs, and the flow speaks "PDF files are not supported yet..." (`capture.errorPdf`). That message must go away once this task is done (keep the string unused or remove it).

## Spec
- `frontend/src/drivers/pdf.ts` (browser API, so it lives in `drivers/`): `renderFirstPage(file: Blob, maxSide = MAX_IMAGE_SIDE): Promise<Blob>`.
  - Lazy-load the library: `const pdfjs = await import('pdfjs-dist')`, so the main bundle does not grow.
  - Worker: `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` and set `pdfjs.GlobalWorkerOptions.workerSrc = workerUrl` (check the exact worker path in the installed version; do not guess, read `node_modules/pdfjs-dist/build`).
  - `getDocument({ data: new Uint8Array(await file.arrayBuffer()) })`, page 1, viewport scale chosen so the longest side is at most 1600 px (reuse `computeTargetSize` from `camera.ts`), draw on a canvas with a white background, export JPEG 0.85 (same as `prepareImage`).
  - Destroy the document and the loading task in `finally`.
  - Errors map to a typed `PdfError` with `reason`: `'password'` (PasswordException), `'invalid'` (InvalidPDFException / unreadable), `'empty'` (zero pages).
- `flow/capture.ts`: `validateImageFile` accepts `application/pdf` for the "Choose image" source only (limit 10 MB); the camera source never receives PDFs. For a PDF, `prepare` = `renderFirstPage`; otherwise `prepareImage`. Speak "Reading your diagram" as usual. Errors: speak one clear line per reason (new i18n keys), for example "That PDF is password protected." or "I couldn't open that PDF. Try a screenshot of the page." Never leave silence.
- Say, once, that only the first page is used: "Using the first page of the PDF." spoken before "Reading your diagram" (one utterance joined with a space, since a second `speak` would cancel the first).
- Vite/PWA: make sure `vite build` succeeds and check that the service worker precache does not blow up (`vite-plugin-pwa` precaches built assets; the pdf worker is large). If it does, exclude it from precache with `workbox.globIgnores` and say so; offline PDF is not required.
- Update the T06 tests: the PDF rejection tests become acceptance tests (valid PDF accepted at the validator, spoken first-page line, `prepare` called with the PDF renderer). Add tests for `PdfError` mapping with a fake loader (inject the loader function so tests do not need the real library).

## Rules
No other new dependency. No `any`. Strings through `t()`. Browser APIs only in `drivers/`. Do not edit Kiro-owned files.

## Definition of Done
- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` pass.
- [ ] A real one-page PDF and a multi-page PDF both reach Explore with the first page's scene on the phone (needs the backend), and a password-protected PDF gives the spoken message.
- [ ] Bundle: report the size of the main JS before and after, and confirm pdf.js is a separate lazy chunk.
- [ ] `docs/handoffs/T06b-report.md` written last; `BUILD_LOG.md` entry added.
