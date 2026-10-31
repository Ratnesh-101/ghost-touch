# T06 report — Start + Capture screens

Builder: **Claude Code (builder stand-in for agy)**, 2026-10-31 (see the T05 report for why agy's headless mode could not be used). Followed `AGENTS.md` exactly: no Kiro-owned file edited, no new dependency, no router, no git, no `.env` access.

## What was built
- **Start** (`screens/Start.tsx`, `flow/start.ts`): one full-viewport `<button>` named "Ghost Touch. Tap anywhere to begin." It listens for **`click`**, which is what TalkBack's double-tap, keyboard activation and a normal tap all produce (not `pointerdown`). On load it speaks the intro; on the tap it unlocks audio, buzzes once (`vibrate(50)`) and speaks the Capture prompt, then opens Capture. If vibration is unsupported it speaks the warning and the prompt as one utterance and still continues.
- **Capture** (`screens/Capture.tsx`, `flow/capture.ts`): "Take photo" (`capture="environment"`), "Choose image" (JPEG/PNG/WebP, which covers **screenshots**), and three sample buttons. A live status line mirrors everything spoken. After a failure or rejection focus returns to "Take photo". Samples call only `fetch('/samples/<name>.json')`.
- **Upload path** (`drivers/camera.ts`, `api/scene.ts`): validation (type, 10 MB limit, empty, PDF), EXIF-aware decode (`createImageBitmap` with `imageOrientation: 'from-image'`, `<img>` fallback), canvas downscale to 1600 px longest side (never upscaled), JPEG 0.85, white background so transparent screenshots stay readable; multipart `POST ${VITE_API_URL}/api/v1/scene` with a 20 s timeout and abort support.
- **Waiting**: says "Reading your diagram", beeps `beep(440, 120)` every 1.5 s, and always stops the timer on success, failure, rejection or leaving the screen (an unmount aborts the request).
- **Raw Mode**: a `mode: 'raw'` response opens Explore with the exact sentence "I couldn't fully read this diagram. You can still feel its outlines."
- `ExploreStub`, a state machine in `App.tsx`, `frontend/.env.example` (`VITE_API_URL=`), i18n strings, styles.

## Files
New: `frontend/src/screens/{Start,Capture,ExploreStub}.tsx`, `frontend/src/flow/{start,capture,navigation}.ts`, `frontend/src/drivers/camera.ts`, `frontend/src/api/scene.ts`, `frontend/.env.example`, `frontend/tests/{camera,api.scene,flow.start,flow.capture,screens.render}.test.ts`.
Edited: `frontend/src/App.tsx`, `frontend/src/components/AccessibleButton.tsx` (now forwards its ref), `frontend/src/i18n/index.ts`, `frontend/src/styles/global.css`, `frontend/vitest.config.ts` (one line so a test can read the stylesheet), `docs/BUILD_LOG.md`.

## Commands and results (from `frontend/`)
| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run build` | OK (12 precache entries) |
| `npm test` (4 runs after the last change) | 126 tests; 3 of 4 runs fully green; 1 run failed **only** in Kiro-owned `hitTest.prop.test.ts` (P1 flake, see T05 report) |
| T06 test files | 5 files, 62 tests, all pass in every run |

## DoD checklist
- [x] `npm test` (with the P1 caveat), `tsc`, `build` pass.
- [x] Unit tests: `computeTargetSize` (landscape, portrait, already small, exact limit, one over, extreme ratio, invalid); file validator (types, 10 MB boundary, PDF, empty); Start speaks on load and on tap and advances; unsupported-vibration path speaks the warning and still advances; the wait loop starts and **stops its timer** on success, failure, rejection and abort (asserted with `vi.getTimerCount() === 0`).
- [~] "Selecting a sample reaches Explore with no backend request": proven at the code level only. The sample loader calls `fetch('/samples/<id>.json')` and nothing else (unit test asserts exactly one call with that URL). **Not** observed in a browser Network tab.
- [ ] **Phone checks NOT DONE** (need your phone and, for uploads, a running backend): tap-anywhere start, rear camera, real photo upload, Raw Mode announcement, airplane-mode sample.
- [ ] **TalkBack walk-through NOT DONE.**
- [~] Touch targets: CSS rule `.gt-control { min-width/min-height: 48px }` and Capture buttons `min-height: 64px` are asserted by a test; computed sizes were **not** measured in DevTools.
- [x] No edits outside the files listed above.

## Screenshots, PDFs (WIN_PLAN §1)
`docs/WIN_PLAN.md` is empty, so I could not read §1. Interpreting it as "screenshots and PDFs can be uploaded":
- **Screenshots: supported** through "Choose image" (PNG, JPEG, WebP up to 10 MB, downscaled like photos).
- **PDFs: not supported yet.** A PDF is detected and rejected with a spoken reason ("PDF files are not supported yet. Please upload a screenshot or photo of the page."). Rendering a PDF page to an image needs a PDF library (for example `pdfjs-dist`, lazy-loaded, about 1 MB) or a server-side renderer such as PyMuPDF. **Both are new dependencies and need your OK.** Not added.

## Deviations from the brief
1. **Speech on transitions.** The brief had Start speak the intro again and then "Choose a diagram". Two back-to-back utterances cancel each other (`speak` cancels the previous), so Start speaks the intro on load, and the tap speaks the Capture prompt once, inside the click. Capture and Explore are announced by `App` at the moment of transition; screens do not speak on mount.
2. `AccessibleButton` forwards refs (needed to focus "Take photo" and "Back").
3. New `src/flow/` folder (behaviour separated from components so it is unit-testable without a DOM library). Not listed in `structure.md`.
4. `api/scene.ts` calls `fetch`/`FormData`; `structure.md` assigns the backend client to `api/`, so I kept browser fetch there rather than in `drivers/`.
5. No jsdom or testing-library is installed (and none may be added), so component behaviour is tested through the extracted flow functions plus server-render markup checks. Click handlers themselves are not exercised by a test.

## Needs from Kiro
- P1 flake (see T05 report).
- When T4 lands nothing here changes; `App` does not use the engine yet.

## What you must test on the phone (short list is in `docs/handoffs/SESSION-2026-10-31.md`)

## Independent review and fixes (`docs/reviews/T06-review.md`, first verdict: FIX FIRST)
- **M1 fixed:** the 10 MB limit applied to "Take photo" before the photo was shrunk, so a large phone photo (for example 50 MP) could be refused. Now "Take photo" accepts up to 50 MB raw (it is shrunk to about 1 MB before upload) and "Choose image" keeps the 10 MB limit from Requirement 2.2. Different spoken message for each. Tests added.
- **M2 not changed, needs your phone:** each message is spoken by `speechSynthesis` and also written to an `aria-live="polite"` status line, so TalkBack may read it twice. The brief asked for the live region. Check on the phone; if TalkBack doubles it, switch the status line to `aria-live="off"` or stop speaking from the app when TalkBack is on (your decision).
- **M3 still open:** Network-tab check, phone run, TalkBack walk-through, computed 48 px sizes. All need you.
- Low findings fixed: tapping a control while busy now says "Still reading your diagram. Please wait." instead of ignoring the tap; a failure in opening Explore is no longer reported as "could not open that sample"; coming back from Explore no longer repeats the one-time vibration warning; the stub now shows the spoken line (including the Raw Mode sentence). Not changed: the tests cannot prove Start uses `click` rather than `pointerdown` (no DOM library installed); the code reads `onClick` only.
- After fixes: `tsc` clean, `npm run build` OK, **129 frontend tests passed in 5 of 5 consecutive runs**, backend 58 pass, research 31 pass.

## Second independent review (`docs/reviews/T06-review-2.md`, fresh reviewer, first verdict: FIX FIRST) and fixes, 2026-11-01
- **Status text / TalkBack (M1, fixed with a better pattern).** The first fix hid the text with `aria-hidden`. The fresh reviewer pointed out that the double reading comes from the **live region**, not from the text itself, and that hiding the text stops a TalkBack user from re-reading a message they missed (an error, for example). `StatusText` now renders plain readable text with **no `aria-live`** when the app speaks the line, and a polite live region only when speech is unavailable. Tests updated. This still removes the double announcement; please confirm on the phone.
- **PDF (M2).** The chooser did not list PDFs, so the spoken "PDF not supported" message could never be reached. `accept` now includes `application/pdf`. Real PDF support (first page) is specified in `docs/briefs/T06b-pdf-upload.md`; it needs `npm install pdfjs-dist` first (owner step), which I cannot run.
- **M3** (phone, TalkBack, Network tab, 48 px measurement) is still open and needs the phone.
- Low: the two pickers no longer open while an upload is running (they say "Still reading your diagram. Please wait."). Not changed: the full-size decode of a 50 MP photo on a budget phone (memory) is unverified; Android Back handling belongs to T07 (`T07-explore.md`).
- After the fixes: `tsc` clean, build OK, 130 frontend tests (green in 2 of 3 runs; the 3rd failed only in Kiro-owned P1, see `docs/kiro-evidence/pbt-p1-flake.md`).
