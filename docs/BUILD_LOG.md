# Build Log

A running, honest record of how Ghost Touch was built, by tool. The Kiroween
write-up (Task 16.2) leans on this — what was attempted, what broke, and what
property-based tests caught — so keep entries specific.

Format for each entry:

```
## YYYY-MM-DD — <tool> — <action>
- <what was done>
- <what broke / surprising findings, if any>
- <files touched>
```

---

## 2026 — Kiro — Scaffold the monorepo (Task 1)
- Created the full monorepo layout per `structure.md`:
  - `frontend/` — React 18 + Vite + TypeScript (strict), Vitest + fast-check,
    `vite-plugin-pwa` (name "Ghost Touch", theme `#0b0b10`), `json-schema-to-typescript`.
  - `backend/` — FastAPI + Pydantic v2, `pyproject.toml` with dev extras
    (pytest + Hypothesis + httpx + ruff), `GET /api/v1/health` -> `{"ok": true}`.
  - `docs/`, MIT `LICENSE` (already present), PWA manifest + generated icons.
- Accessibility baseline wired for Requirement 12.1: an `AccessibleButton`
  primitive and a `.gt-control` rule enforcing a 48x48 CSS px minimum touch
  target; every string flows through `frontend/src/i18n/`.
- DoD checks: `npm test` and `pytest` both run; `uvicorn` serves the health
  endpoint. (Results captured below as the commands were run.)

### Verification results (Task 1 DoD)
- Frontend `npm install`: 446 packages, OK (transitive `glob` deprecation warnings only).
- Frontend `npm test`: 1 file, 2 tests passed (`tests/scaffold.test.ts`).
- Frontend `npm run build`: `tsc --noEmit` clean; `vite build` produced `dist/`
  with PWA `manifest.webmanifest`, `sw.js`, and 9 precache entries. Split into
  `vite.config.ts` (Vite + plugins) and `vitest.config.ts` (test settings) to
  avoid a Vitest↔Vite 6 plugin-type clash in a single config.
- Backend `pip install -e ".[dev]"`: editable `ghost-touch-backend` wheel built
  (hatchling); imports OK — fastapi 0.162.0, pydantic 2.14.2, cv2 5.0.0,
  numpy 2.5.4.
- Backend `pytest`: 1 passed (`tests/test_health.py`).
- Backend `ruff check .`: all checks passed.
- Backend live `uvicorn app.main:app` → `GET /api/v1/health` → `200 {"ok":true}`.
- Notes: Python on the machine is 3.13 (spec targets 3.11+; compatible). A
  0-byte root `.env` was present (gitignored, empty, no secrets); left as-is.

## 2026-10-31 — Claude Code — Review T1, T2.1–2.3, T3.1–3.3 (no code changes)
- Ran frontend/backend tests, `tsc`, `ruff`, build, live health check, and a `scene.gen.ts` regeneration drift check.
- Findings (14, one High: `hitTest.ts` has no bar-edge hits) recorded in `docs/reviews/T01-T03-review.md`. No Kiro-owned file was edited.

## 2026-10-31 — Claude Code — Briefs for Antigravity and vision-spike scorer
- Wrote `docs/briefs/T05-drivers.md`, `T06-start-capture.md`, `T08-scene-pipeline.md` (T08: Gemini primary, NVIDIA fallback, teacher-vocabulary prompt rules and the matching `validate.py` requirement for Kiro).
- Wrote `research/vision_spike.py` + `research/spike_scoring.py` + `research/tests/` (scores model output against the synthetic ground truth). Verified only with `--oracle` (truth vs truth = 1.00 on 20 samples) and 31 unit tests; no live provider call has been run yet.
- Found and fixed a scorer bug while verifying (point-count range was unfair to a 20-point straight-line curve).

## 2026-10-31 — Claude Code — Kiro paused (credits): queue, rules, reviewer switch
- Kiro is out of credits; credit request pending. Last commit `f5de39d WIP: Kiro paused (credits)`. Full state in `docs/handoffs/KIRO-PAUSE.md`.
- **No task ownership was moved.** Reserved for Kiro: T2 follow-ups, T3 (3.4 tick, 3.5, bar edges), all of T4, 8.3, 8.6, 8.7.
- Reassignments / process changes: agy queue reordered to T05 → T06 → T07 → T08.1/8.2/8.4/8.5 → T09; agy uses TEMP stubs for missing Kiro modules (new `AGENTS.md` rule 3; `AGENTS.md` and `WIN_PLAN.md` were empty files, so `AGENTS.md` was written now); Claude Code (not Kiro) reviews agy's reports until Kiro returns.
- Contingency (move T2–T4 to agy) drafted but not active; decision date Nov 5, needs the owner's OK.
- Files: `AGENTS.md`, `docs/handoffs/KIRO-PAUSE.md`, `docs/reviews/T01-T03-review.md`, briefs T05/T06/T08 edited.

## 2026-10-31 — Claude Code (builder stand-in for agy) — T05 browser drivers
- `agy --print` is a documented headless mode, but it auto-denies non-allow-listed shell commands; two launches (second with `--settings` allow-rules) produced no files. `--dangerously-skip-permissions` was not used. Claude Code built T05 following `AGENTS.md` exactly.
- Built `drivers/{haptics,audio,speech,index,hashRoute}.ts`, `screens/Debug.tsx` (`#/debug`), TEMP stub `_temp/hapticTypes.stub.ts` (registered in `KIRO-PAUSE.md`), 36 driver tests.
- `tsc` clean, build OK, driver tests pass. **Found:** Kiro-owned P1 (`hitTest.prop.test.ts`) is flaky (about 1 in 4-7 runs; two points collide on one pixel in a tiny viewport; seed 1149324890). Not edited. Phone test of `#/debug` still pending.
- Files: see `docs/handoffs/T05-report.md`.

## 2026-10-31 — Claude Code (builder stand-in for agy) — T06 Start + Capture screens
- Built `screens/{Start,Capture,ExploreStub}.tsx`, `flow/{start,capture,navigation}.ts`, `drivers/camera.ts`, `api/scene.ts`, `.env.example`, App state machine; `AccessibleButton` now forwards refs. Start listens for `click` (TalkBack double-tap), speaks once per transition inside the gesture; the wait tone's timer is always cleared (tested).
- 62 new tests; `tsc` clean, build OK. Kiro-owned P1 flake still shows up intermittently. Phone and TalkBack checks NOT done. PDF upload NOT done: needs a new dependency (owner approval).
- Files: see `docs/handoffs/T06-report.md`.
- Review (independent subagent) found camera photos hit the 10 MB cap before shrinking; fixed (camera 50 MB raw, chosen files 10 MB). Possible double announcement by TalkBack (spoken text plus `aria-live` line) left for a phone check.

## 2026-11-01 — Claude Code — Gate A result (A1 passes), T07 brief, Req 13 draft, TalkBack status text
- Owner's Gate A result recorded: A1 (double-tap-and-hold then drag) delivers events and vibrates with TalkBack on; virtual finger starts at the centre, movement relative. Decision: stay on web; Capacitor spike is optional Phase 2. Updated `docs/research/talkback-spike.md`, `docs/WIN_PLAN.md` (§0 row, Gate A result, Phase 0b label, risk register).
- Wrote `docs/briefs/T07-explore.md` (relative cursor: spoken hint, centre tick, re-centre per hold, exit via Android Back/TalkBack Back + labelled button + two-finger swipe for TalkBack-off; TEMP stubs for `step` and pitch).
- Drafted `docs/kiro-evidence/spec-change-req13.md` for Kiro (method A1; centre tick marked proposed).
- TalkBack double-reading: status text is now `aria-hidden` when the app speaks it, and becomes a polite live region only when speech synthesis is unavailable (new `StatusText` component); tests updated.

## 2026-11-01 — Claude Code — P1 flake evidence (no code edited)
- Ran `npx vitest run tests/hitTest.prop.test.ts` 30 times: 6 failures (20%). Captured seeds, paths and shrunk counterexamples in `docs/kiro-evidence/pbt-p1-flake.md`, with a replay script (`docs/kiro-evidence/pbt-p1-replay.ts`).
- Cause: the test generator makes points unique in normalised space, but two points differing by ~1e-45 land on the same pixel after the letterbox offset (5.96e-8) is added, so `hitTest` (first of equal-distance candidates wins) cannot satisfy "returns this point" for the second one. This is a test-generator bug, not a `hitTest` bug. Kiro owns the fix; suggested changes are in the evidence file.

## 2026-11-01 — Claude Code — T06 second review, StatusText pattern, PDF brief, TouchSight lessons
- Fresh independent review of T06 (`docs/reviews/T06-review-2.md`): FIX FIRST on two mediums. Fixed: `StatusText` now has no live region when the app speaks (text stays readable); chooser accepts PDFs so the spoken message is reachable; pickers refuse while busy. PDF rendering is a separate brief (`docs/briefs/T06b-pdf-upload.md`) waiting for the owner to run `npm install pdfjs-dist`.
- `docs/research/competitors.md` rewritten with the WIN_PLAN §8 table and verified TouchSight lessons (README and dev.to write-up read 2026-11-01); same lessons added to `docs/briefs/T08-scene-pipeline.md` (including: never cache failed responses; fall through providers on 429/503).
- `docs/user-test/plan.md` aligned with WIN_PLAN §4 (BPA session, tasks, consent, results.md).
- Vision spike: API key loads from `backend/.env` (never printed). `gemini-2.5-flash` is retired for new users (404); `gemini-3.8-flash` works but returned 503 once, so the spike now retries transient errors. Defaults updated in the spike and T08 brief.

## 2026-11-01 — Claude Code — Vision spike run (Gemini 3.8 flash, synthetic clean + photo)
- 20 samples run; 18 scored, 2 hit the free-tier 429 quota (photo 09 and 10, not scored). Results and findings: `docs/research/vision-spike.md`. Headline (scorer v3): clean 9/10 usable (0.91), photo 7/10 usable counting the 2 failures (0.66); geometry strong, parabola weakest; 0 appearance-only labels.
- **Latency 29-169 s (median about 60 s) against the 15 s backend budget: a blocker for T08 as designed.** Not yet diagnosed.
- I changed the scorer twice after seeing results (facts paraphrase matching; shape-based corner and curve scores). Both disclosed with v1/v2/v3 numbers in the doc; v3 is frozen; absolute-frame metrics are kept. 41 scorer tests.
- Script fixes: retry on transient errors (503/429), per-attempt latency, partial/resume runs merge into `results.json`, model default `gemini-3.8-flash` (the old one answers 404).

## 2026-11-01 — Antigravity — T06b PDF upload (first page only)
- Installed `pdfjs-dist` (v6.4.299) in `frontend/`. Built `frontend/src/drivers/pdf.ts` with lazy-loaded dynamic import in a separate chunk (`dist/assets/pdf-*.js`, 483.74 kB) and worker URL configuration (`pdf.worker.min.mjs`).
- Implemented `renderFirstPage(file: Blob, maxSide)` downscaling to max 1600 px longest side on canvas with white background and exporting JPEG 0.85; cleanup in `finally` with `cleanup()`, `destroy()`, and `loadingTask.destroy()`; typed error mapping for `PasswordException`, `InvalidPDFException`, and empty PDFs.
- Updated `flow/capture.ts` and `drivers/camera.ts` to validate and accept PDFs up to 10 MB limit from "Choose image"; speaks "Using the first page of the PDF. Reading your diagram" in one utterance; speaks specific errors for password/invalid/empty PDFs.
- Configured `workbox.globIgnores: ['**/pdf*']` in `vite.config.ts` so service worker precache stays compact (12 entries, 186.43 KiB) without caching the large 1.26 MB PDF worker.
- Converted T06 PDF rejection tests to acceptance tests; added `tests/drivers.pdf.test.ts` testing error mapping and cleanup with injected fake loader.
- Files: `frontend/src/drivers/pdf.ts`, `frontend/src/flow/capture.ts`, `frontend/src/drivers/camera.ts`, `frontend/src/i18n/index.ts`, `frontend/vite.config.ts`, `frontend/tests/drivers.pdf.test.ts`, `frontend/tests/flow.capture.test.ts`, `frontend/tests/camera.test.ts`, `docs/handoffs/T06b-report.md`.

## 2026-11-01 — Antigravity — T07 Explore screen (relative cursor, TalkBack on/off)
- Created TEMP stubs in `frontend/src/_temp/`: `pitch.stub.ts` (`pitchForY`, `pitchForValue`) and `hapticEngine.stub.ts` (`step`, `initialState`, `DEFAULT_HAPTICS`, `EngineState`, `Input`) implementing engine rules 1-6 from `design.md` and bar label/value speech and pitch. Registered both stubs in `docs/handoffs/KIRO-PAUSE.md`.
- Implemented pure decision functions in `frontend/src/flow/explore.ts`:
  - Proposed centre reference tick (constant `CENTRE_TICK_MS = 25`, `CENTRE_RADIUS_PX = 24`, re-arm at 36 px; suppressed in quiet window; speaks "Centre." on first hold only).
  - Axis crossing tracker (speaks "x-axis" / "y-axis" once per crossing in each direction).
  - Two-finger swipe down detector (dy >= 80 px, dt <= 600 ms, dx < 0.5 * dy).
  - Per-move pipeline (`processPointerMove`) feeding `hitTest`, normalized coordinates, and `step`.
- Built `frontend/src/drivers/navigation.ts` handling `history.pushState` on Explore entry and `popstate` for Android Back and TalkBack Back gesture.
- Built `frontend/src/screens/Explore.tsx`: glowing green canvas (`#39ff88`, width 4, shadow blur 12), faint centre cross, cursor indicator, `StatusText` without live region when speech is enabled, accessible 48px+ Back button outside canvas, debug offset tracking for the phone spike.
- Replaced `ExploreStub.tsx` in `App.tsx` and deleted `ExploreStub.tsx` and test references. Added i18n keys and styles in `global.css`.
- Added unit tests in `tests/flow.explore.test.ts`, `tests/drivers.navigation.test.ts`, and updated `tests/screens.render.test.ts`. Total frontend tests now 163 across 17 files; `tsc` clean, build clean.
- Files: `frontend/src/_temp/pitch.stub.ts`, `frontend/src/_temp/hapticEngine.stub.ts`, `frontend/src/flow/explore.ts`, `frontend/src/drivers/navigation.ts`, `frontend/src/screens/Explore.tsx`, `frontend/src/App.tsx`, `frontend/src/flow/navigation.ts`, `frontend/src/i18n/index.ts`, `frontend/src/styles/global.css`, `frontend/tests/flow.explore.test.ts`, `frontend/tests/drivers.navigation.test.ts`, `frontend/tests/screens.render.test.ts`, `docs/handoffs/KIRO-PAUSE.md`, `docs/handoffs/T07-report.md`.

## 2026-11-01 — Antigravity — T08 backend scene pipeline (launched by Claude Code with the owner's permission flag)
- Built the vision provider interface, `GeminiProvider` (default `gemini-3.8-flash`, configurable thinking budget), `NvidiaProvider` with inline image fitting, the fallback chain, the extraction prompt with the teacher-vocabulary rules, Raw Mode (`raw_mode.py`) and `POST /api/v1/scene` with validate-then-retry-once and Raw Mode as the floor. TEMP stub `backend/app/_temp/validate_stub.py` stands in for Kiro's 8.3 (registered in `KIRO-PAUSE.md`).
- 92 backend tests pass, `ruff` clean. No real API was called and no environment file was read. Latency of the real Gemini call is still untested against the 15 s budget (needs quota). Details: `docs/handoffs/T08-report.md`.

## 2026-11-01 — Claude Code — Git history for the project
- The owner reset git to a fresh repository with everything staged. With temporary `git add`/`git commit` permission, Claude Code split it into logical, conventional commits in build order, using real timestamps (no `--date`). `backend/.env` and `.claude/settings.local.json` were never staged (both ignored; a pattern scan of every file found no keys).
- Verified before committing the agy work: tests, `tsc`, build, no edits to Kiro-owned files, no commits by the agents. Scaffold files were committed in their original form and pipeline changes in later commits.
- Not a clean per-task history in two places: Capture, i18n and App were committed in their final (T06b/T07) form, and the intermediate `ExploreStub` never entered history. Total commit count is above the 25-30 target (over-split).

## 2026-11-01 — Antigravity — T09b frontend Ask flow (launched by Claude Code with the owner's permission flag)
- Added the Ask client (`api/ask.ts`, 12 s timeout, abort), the pure Ask flow (`flow/ask.ts`: listening cue, voice question, spoken answer, one Ask at a time, a spoken line for every failure, text-box fallback), and an Ask button, text box and optional two-finger long-press (600 ms) in the Explore screen. Status text keeps the no-live-region pattern while the app speaks.
- 194 frontend tests pass, `tsc` clean, build OK (31 new tests). Not tested on a phone. The backend half (T09a) is built separately. Details: `docs/handoffs/T09b-report.md`.

## 2026-11-01 — Antigravity — T10a deployment preparation (launched by Claude Code with the owner's permission flag)
- Added `render.yaml` (Render blueprint, secrets `sync: false`), `frontend/vercel.json` (SPA fallback that keeps `/assets` and `/samples`, no-cache for the service worker, manifest and index), `.github/workflows/ci.yml` and `docs/DEPLOY.md`. Nothing was deployed. Environment variable names in `render.yaml` match what the backend reads.
- Claude Code then changed the CI test step to retry once and documented why: the Kiro-owned P1 property test fails in about 1 run in 5 (`docs/kiro-evidence/pbt-p1-flake.md`); the comment from the agent called it "very rare", which is not what was measured. Python 3.11 in CI is untested locally (the dev venv is 3.13).
- Details: `docs/handoffs/T10a-report.md`.

## 2026-11-01 — Claude Code — STEMergent draft and demo script
- Added `docs/STEMERGENT_SUBMISSION.md` and `docs/DEMO_SCRIPT.md` as drafts: only things that exist are claimed; everything that needs the owner's facts or real results is marked `[FILL]` or `[ONLY IF REAL]`.

## 2026-11-01 — Antigravity — T09a backend Ask (launched by Claude Code with the owner's permission flag)
- Added `POST /api/v1/ask` (`app/ask.py`): answers in at most 2 short sentences from the scene and its facts only, the exact sentence "I don't know from this diagram." otherwise, the question treated as data inside delimiters, text-only completion added to the providers with the same fallback chain, and a deterministic **facts lookup** fallback so Ask works with no key or quota. 126 backend tests pass, `ruff` clean. No real API was called. Details: `docs/handoffs/T09a-report.md`.

## 2026-11-01 — Claude Code — Independent reviews of T06b, T07 and T08, and fix briefs
- Two fresh reviewers wrote `docs/reviews/T06b-T07-review.md` (FIX FIRST: stale history entry makes the first Android Back do nothing after leaving Explore; centre tick skipped on some holds; bar tone sticks; PDF rendered at 72 dpi; stale viewport; spurious axis speech; weak tests) and `docs/reviews/T08-review.md` (FIX FIRST: thinking setting may be rejected by the current Gemini model; no pixel cap or real file-type check; OpenCV on the event loop; unvalidated Raw Mode scene returned; example env file means zero providers; chain rebuilt per request; upload read before the size check).
- Wrote `docs/briefs/F1-frontend-review-fixes.md` and `F2-backend-review-fixes.md`. A live probe of the Gemini thinking settings could not run: the free-tier quota is still exhausted (429 on every variant). So the thinking fix is specified to degrade safely (retry once without the setting) rather than assume one parameter works.

## 2026-11-01 — Claude Code — Gemini quota diagnosis and thinking probe
- The 429s were the Gemini API **free tier**: 20 requests per day per project per model (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`); the credits the owner saw belong to Antigravity, a separate account. Per-model limits mean other models still worked.
- Probe on `gemini-3.5-flash` and `gemini-3.5-flash-lite`: `thinking_budget=0` is rejected (HTTP 400) by the lite model; `thinking_level` MINIMAL/LOW is accepted by both; call time 2-4 s (lite) and 7-10 s (flash) with thinking trimmed, against 29-169 s for `gemini-3.8-flash` untrimmed. Spike on the lite model (16 samples): geometry 0.94, bars 0.96, graphs 0.49 (0 of 5 usable). Written up in `docs/research/vision-spike.md` (update section).
- Scratch probe scripts are in the session scratchpad, not in the repo; no key was printed (only the 4-character prefix of the key format, to tell key types apart).

## 2026-11-01 — Claude Code — agy authentication and permissions investigated; safe launcher added
- Question: does headless agy use the app's `GEMINI_API_KEY`? Evidence says no: the key variables are NOT SET in the shell, Windows User or Machine environment; nothing in the repo exports the key; agy's log shows `authenticated via keyring` (account OAuth) and the only host is `daily-cloudcode-pa.googleapis.com` (Antigravity's backend, not the Gemini API). The 429s came from Claude Code's own direct API calls with the key from `backend/.env` (free tier, 20 per day per model).
- Found that the stored Antigravity grants in `~/.gemini/config/config.json` include `git push`, `git commit`, `gh pr merge` and `gh pr create`; they are NOT applied when `--settings` supplies permissions (tested). Allow-list rules match the exact command text (no wildcards) and agy's command tool has no working-directory option, so allowed commands are root-relative.
- Added `scripts/agy-run.sh`, `scripts/agy-run.ps1` and `scripts/agy-settings.json`: key variables removed for the agy process only, `gemini-3.8-flash-high` with `--effort high`, no dangerous flag, logs in `logs/agy/` (gitignored). Verified with a tiny task (file created, keyring auth, model label "Gemini 3.8 Flash (High)") and with real allowed commands. Details and limits: `docs/research/agy-setup.md`.
- Disclosure: earlier agy launches today (T08, T09, T10a, F1, F2, the commit agents and the offline spike) used `--dangerously-skip-permissions` with the owner's approval at the time. Rule from now on: never. The `--provider agy` option in `research/vision_spike.py` still uses that flag internally and must be changed before it is used again.
- A git remote named `origin` exists (discovered during the tests); nothing was pushed.

## 2026-11-02 — Claude Code — Handoff file updated
- Rewrote `docs/handoff.md` to the state of Nov 2: what is built, the 72 local commits and what is uncommitted (F1/F2 fixes and the agy tooling), fresh checks (tsc clean, 212 frontend and 138 backend tests, ruff clean, build OK), the Gemini free-tier finding, the agy findings and launcher, and the next steps.
- Corrections to the previous version: the P1 flake is a test-generator bug (not a hitTest bug); `prototypes/index.html` is not in the repo; the prompt now points at `docs/handoff.md`; the BPA phone numbers, staff names and emails were removed because the file will be public (WIN_PLAN says no phone numbers in the repo). The previous version was never committed.
