# T06 — Start + Capture screens

Builder: Antigravity | Reviewer: Claude Code (Kiro paused) | Planner: Claude Code
Spec: `.kiro/specs/ghost-touch/tasks.md` Task 6 (6.1–6.3) | Requirements: 1.1–1.3, 2.1–2.4, 12.1
Depends on: T1, T2 (sample JSON already in `frontend/public/samples/`: `triangle.json`, `sine.json`, `barchart.json`), and your own T05 (drivers, `runEffects`, `beep`), which comes first in your queue. No Kiro-owned dependency, so no stub is needed. Use the generated `DiagramScene` type from `src/types/scene.gen.ts` (or the types exported by `core/scene.ts`); don't hand-write another copy.

## Read first
1. `.kiro/steering/product.md` and `tech.md`
2. `requirements.md` Requirements 1, 2, 12
3. `design.md` → Screens (`Start` → `Capture` → Explore)
4. `frontend/src/components/AccessibleButton.tsx`, `frontend/src/i18n/index.ts`, `frontend/src/App.tsx` (the scaffold placeholder you are replacing)

## Goal
A blind user can open the app, tap anywhere, hear what to do, pick a sample or photograph a diagram, and get handed to Explore, eyes-closed. Explore itself is T07; here it is a stub that receives the scene.

## Files you own
- `frontend/src/screens/Start.tsx`, `frontend/src/screens/Capture.tsx`
- `frontend/src/screens/ExploreStub.tsx` (placeholder, replaced in T07)
- `frontend/src/drivers/camera.ts` (file read + canvas downscale; browser API so it lives in drivers)
- `frontend/src/api/scene.ts` (client for `POST /api/v1/scene`; base URL from `import.meta.env.VITE_API_URL`)
- `frontend/src/App.tsx` (screen state machine; keep the `#/debug` branch from T05)
- `frontend/src/i18n/*` (new strings only)
- `frontend/src/styles/global.css` (additions only)
- tests in `frontend/tests/`
- `frontend/.env.example` with `VITE_API_URL=` (never `.env`)

## Files you must NOT edit
`frontend/src/core/**`, property tests, `schema.py`, `validate.py`, `scene.gen.ts`, `.kiro/**`.

## Spec

### 6.1 Start screen (Req 1)
- Full-viewport `<button>` covering the screen. Accessible name from `t('start.tapToBegin')` = "Ghost Touch. Tap anywhere to begin."
- On mount: `speech.speak(intro)`. Chrome may block speech before a gesture, so **speak the intro again right after the tap** if it didn't start (simplest: always re-speak on tap; cancel-previous makes this safe).
- On tap, in this order, all inside the click handler (gesture requirement): `audio.unlock()`, `haptics.vibrate(...)` for a short confirmation (use `haptics.vibrate(50)`, a single short pulse), speak "Choose a diagram", then move to Capture.
- If `!haptics.supported`: speak "Vibration is not supported on this device. Please use Chrome on Android. Audio-only mode." and continue (Req 1.3). Never block progress.
- Create drivers once (`createBrowserDrivers()`) at the App level and pass them down; don't create per screen.

### 6.2 Capture screen (Req 2)
Controls, each an `AccessibleButton`, ≥48×48 px, large, stacked vertically, with `aria-label`s from `t()`:
1. **Take photo** → hidden `<input type="file" accept="image/*" capture="environment">`, triggered by the button.
2. **Choose image** → hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`.
3. **Sample: triangle / sine graph / bar chart** → `fetch('/samples/<name>.json')`, validate it is JSON with a `kind`, go straight to Explore. **No network call to the backend** (DoD).
- On mount speak: "Take a photo, choose an image, or pick a sample diagram."
- File validation: only JPEG/PNG/WebP, ≤10 MB (Req 2.2). On rejection speak a short reason ("That file is too large. Maximum is 10 megabytes.") and stay on Capture.
- Downscale: draw to a canvas so the longest side is ≤1600 px (never upscale), export JPEG quality 0.85, return a `Blob`. Put the resize maths in a pure function (`computeTargetSize(w, h, max)`) so it is unit-testable.
- Fix orientation: use `createImageBitmap(file, { imageOrientation: 'from-image' })`, falling back to `<img>` decode.

### 6.3 Waiting state (Req 2.3)
- On submit: speak "Reading your diagram", then every 1.5 s play a soft `audio.beep(440, 120)` until a result or error. Stop the interval on success, error, or unmount (no leaked timers).
- `POST` multipart field `image` to `${VITE_API_URL}/api/v1/scene`. Client timeout 20 s (server's is 15 s). Response `{ scene, mode: 'ai' | 'raw', reason? }`.
- Success → Explore with the scene. If `mode === 'raw'`, speak exactly: "I couldn't fully read this diagram. You can still feel its outlines." (Req 8.1).
- Failure (network, non-2xx, bad JSON) → speak "Something went wrong. Please try again, or pick a sample." and remain on Capture with focus restored to Take photo. Never leave the user in silence.
- Show a visible status line (`aria-live="polite"`) mirroring what is spoken.
- Types: import `DiagramScene` from `src/types/scene.gen.ts`. Do not hand-write a second copy.

### ExploreStub
Shows scene title/kind in text and a "Back" `AccessibleButton` to Capture. T07 replaces it. Keep it under 30 lines.

## Rules (reviewer will check)
- Browser APIs only in `drivers/` (file reading and canvas go in `drivers/camera.ts`).
- Every user-facing string through `t()`; no hardcoded English in components.
- Every screen change is spoken; focus moves to a sensible control after each transition.
- Dark theme, `#39ff88` accents, `#0b0b10` background; text contrast ≥7:1 (Req 12.2).
- No new npm dependencies, no router, no state library (use `useState`). Ask the user first if you believe one is needed.
- No `any`, no `console.log`, named exports only in `core/`-adjacent modules.
- `.env` never committed; only `.env.example`.

## Definition of Done
- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` all pass.
- [ ] Unit tests: `computeTargetSize` (landscape, portrait, already-small, exact boundary); file validator (type, 10 MB boundary); Start speaks twice (mount + tap) and advances; unsupported-vibration path speaks the warning and still advances; Capture wait loop starts and **stops** its interval on success, error and unmount.
- [ ] Selecting a sample reaches ExploreStub with the Network tab showing **no** request to the backend (state this in the report, with how you checked).
- [ ] On the Nord CE6 over HTTPS: tap-anywhere starts; camera opens the rear camera; a photo upload against a running backend returns to ExploreStub (or Raw Mode announcement); airplane mode + sample still works.
- [ ] Walk-through with eyes closed or screen off using TalkBack: every control is reachable and named. Record the result honestly, including anything awkward.
- [ ] All targets ≥48×48 px (check computed size in DevTools, list in report).
- [ ] No edits outside "Files you own".

## Secrets
The backend keys (`GEMINI_API_KEY`, `NVIDIA_API_KEY`) live in `backend/.env`, which is gitignored. Do not open, print, copy or reference its values anywhere. The frontend needs no keys, only `VITE_API_URL`. For the phone upload test the user starts the backend with `uvicorn app.main:app --env-file .env`; if the backend isn't running, say so in the report and test only the sample path.

## Report
Write `docs/handoffs/T06-report.md` **last** (then tell Claude Code "review T06"; Kiro's review hook is dormant while Kiro is paused): files changed, commands run with results, phone and TalkBack results, deviations, "Needs from Kiro". Add a `docs/BUILD_LOG.md` entry with tool = Antigravity.

Do not tick checkboxes in `tasks.md`. Do not commit or push.
