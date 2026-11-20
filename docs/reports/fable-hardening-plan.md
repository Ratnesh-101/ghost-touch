# Ghost Touch hardening plan: bug-proofing and security

Date: 2026-11-16. Author: Claude Code (planning agent, read-only). Base commit: `3a6fc78` on `main`.
Scope: static reading of the repo. Nothing was run, scanned or exploited. No source file was changed.

How to read the evidence: `file:line` refers to the tree at the base commit. "Verified" means I read
the code. "Not re-audited" means earlier audits cover it and I did not repeat them.

Not read or not re-audited (say so rather than guess):
- `backend/.env.example` and `frontend/.env.example`: blocked by this session's permission settings. No `.env` file was opened.
- `frontend/src/screens/Explore.tsx` and `frontend/src/flow/explore.ts`: not re-audited line by line. They are changing right now (heartbeat, speech pacing, stay-on-line, page-edge lanes) and were audited on 2026-11-12 (`docs/reviews/kiro-audit-2026-11-12-explore.md`, EX-01 to EX-06).
- `frontend/src/i18n/index.ts` (1553 lines): key parity not re-checked; three i18n test files exist.
- Whether earlier findings B4-05 (service worker), PERF-05 (photo decode) and R4 (share decompression) were closed: the code at the cited lines still looks open, but I did not trace every lane report.

---

## (a) Verdict and top 10 risks

**Verdict: the backend request path is already well hardened; the gaps are at the edges.** Seven audit
rounds closed the classic holes (upload caps, magic-byte sniffing, pixel cap, rate limits, in-flight
caps, safe expression parser, share decoding, API security headers, no `innerHTML`). What is left is
(1) the app has no last line of defence when something unexpected throws, (2) one client can spend
the whole day's AI budget for everyone, (3) CI does not test what is deployed, and (4) several
controls only exist in process memory or in dashboards nobody has confirmed.

| # | Risk | Sev | Part | Fix lane |
|---|---|---|---|---|
| 1 | Any render exception leaves a blind user on a silent black screen: no error boundary, no global handler | High | 1 (B1) | hx1 |
| 2 | One IP can drain the global daily AI budget; every student then gets Raw Mode until UTC midnight | High | 2 (S1) | hx2 |
| 3 | Budget and rate limits live in memory and reset on every restart; no provider-side spend cap is confirmed | Med | 2 (S2) | owner + hx10 |
| 4 | Scenes from the network, samples and IndexedDB are trusted after a `kind` check only; a bad one crashes Explore (and meets risk 1) | Med | 1 (B2) | K-H1 + hx6 |
| 5 | CI installs unpinned backend deps while Render installs `requirements.lock`; no `pip-audit` / `npm audit`; no schema-to-TypeScript drift gate | Med | 1 (B5, B6), 2 (S3) | hx4 |
| 6 | Ask after 15 idle minutes hits a Render cold start with a 12 s client timeout and no retry | Med | 1 (B3) | hx5 |
| 7 | After a deploy an open tab keeps old code while the service worker swaps the cache; nothing tells the user or recovers a failed chunk load | Med | 1 (B7) | hx7 |
| 8 | CSP `connect-src` pins a host name that does not match `render.yaml` or `DEPLOY.md`; never confirmed against production | Med | 2 (S5) | owner + hx8 |
| 9 | Test suite is flaky under load and the nightly "soak" does not soak; no e2e or deployed smoke in CI | Med | 1 (B8-B10) | K-H5, hx4, hx8, hx11 |
| 10 | Agent "dangerous" mode and loose shell allow-list patterns run next to a real `backend/.env`; GitHub Actions pinned by tag | Low-Med | 2 (S4, S10) | owner + hx10 |

---

## (b) Part 1: bug-proofing

### Findings

**B1 · High · `frontend/src/main.tsx:9-13`**
Evidence: the root renders `<App />` with nothing around it. A search of `frontend/src` finds no
`ErrorBoundary`, `componentDidCatch`, `unhandledrejection`, `window.onerror` or `error` listener.
How it fails: any exception during render (bad scene, a bug in a new lane) makes React unmount the
whole tree. The student gets a black page, no speech and no way back except knowing to reload.
Rejected promises (for example `void saveDiagram(...)` chains) vanish silently.
Fix: a root error boundary plus `error` / `unhandledrejection` listeners that (1) call
`vibrate(0)` and stop the tone, (2) speak one sentence, (3) show one full-screen focused button
"Start again" that reloads. Rate-limit to one announcement so an error loop cannot chatter.

**B2 · Medium · `frontend/src/api/scene.ts:123-127, 258-260`, `frontend/src/core/savedDiagrams.ts:236-248`**
Evidence: `asScene` accepts anything whose `kind` is a string (comment at line 129: "Shape check
only"). `deserialise` checks `kind` against four values and casts. Only share links pass through
`validateShareScene` (`frontend/src/share/codec.ts:236`).
How it fails: a saved entry written by an older build, a corrupted IndexedDB record, or a backend
bug returns a scene without `points` or with a non-finite number. `hitTest` or the canvas draw
throws, which is B1. A corrupt saved diagram would crash every time it is opened.
Fix: one pure guard in `core/` (`isRenderableScene`), used by `deserialise`, `parseSceneResponse`
and `loadSample`. A rejected network scene becomes `bad-response`; a rejected saved entry is skipped.

**B3 · Medium · `frontend/src/api/health.ts:27,46-54`, `frontend/src/App.tsx:331-336`, `frontend/src/api/ask.ts:24,138`, `render.yaml:8`**
Evidence: the backend is warmed once per page load. Render's free plan sleeps after idle time.
Ask has a 12 s timeout, no retry, and maps every non-200 (including 429 and 503 with `Retry-After`,
`backend/app/main.py:916-936`) to a generic `http` failure. The server may spend 5 s queueing plus
10 s answering (`main.py:80`, `ask.py:968`), which is longer than the client waits.
How it fails: a student explores a diagram for 20 minutes, then asks a question; the first Ask
times out. Needs confirmation on the deployed site.
Fix: re-warm when Ask opens if the last successful API call is older than 10 minutes; on
`timeout` or `network` retry once after saying "Waking the server"; treat 429/503 as busy and
honour `Retry-After` as `api/scene.ts` does; raise the client timeout to 17 s.

**B4 · Medium · `.github/workflows/ci.yml:67-70`, `render.yaml:9`, `backend/pyproject.toml:13-22`**
Evidence: CI runs `pip install -e ".[dev]"` (ranges such as `fastapi>=0.115.0`); Render runs
`pip install -r requirements.lock` (`fastapi==0.162.0`). CI Python is floating 3.11, Render 3.11.10.
How it fails: tests go green on versions production never runs, or production breaks on a version
CI never saw.
Fix: CI installs `requirements.lock` plus the dev tools; pin Python to 3.11.10.

**B5 · Medium · `.gitignore:20`, `frontend/package.json:14`, `.github/workflows/ci.yml`**
Evidence: `backend/scene.schema.json` is ignored, CI never runs `export_schema` + `gen:types`, and
no test compares `backend/app/schema.py` with `frontend/src/types/scene.gen.ts`. The only
regeneration path is a Kiro on-save hook; agy lanes cannot run shell commands.
How it fails: a schema field added by a backend lane never reaches the TypeScript types; the
frontend compiles against a stale contract.
Fix: CI step that regenerates and fails on `git diff`; a pytest that compares field names of
`DiagramScene.model_json_schema()` with the interfaces in `scene.gen.ts`.

**B6 · Medium · `frontend/vite.config.ts:22,48-63`, `frontend/src/drivers/pdf.ts:29`, `frontend/src/main.tsx`**
Evidence: `registerType: 'autoUpdate'`; no code in `src` listens for `controllerchange` or
handles a failed dynamic import. `pdfjs-dist` is the one lazy chunk, runtime-cached for 30 days.
How it fails: after a deploy the open tab still runs the old bundle while the new service worker
replaces the precache. A first PDF import in that tab can request a chunk that no longer exists.
The user hears a generic error and does not know a reload fixes it. Earlier audit B4-05 raised this.
Fix: catch the import failure, say "The app was updated, reloading", reload once (guarded by a
session flag). On `controllerchange`, reload only when the user is on Start or Capture, never in
Explore. Verify on a real phone with the installed PWA.

**B7 · Medium · `.github/workflows/pbt-soak.yml:45-52,76-89`, `backend/tests/conftest.py`**
Evidence: the nightly job repeats `npm test` and `pytest` with the normal example counts.
`conftest.py` registers no Hypothesis profile, so the `hypothesis_profile` input makes pytest fail.
How it fails: the soak finds only what a lucky seed finds; it does not search deeper.
Fix: register `ci` and `soak` Hypothesis profiles; add a fast-check run multiplier from an env var.

**B8 · Medium · `docs/BUILD_LOG.md` (entries 2026-11-15 and 2026-11-16), `frontend/vitest.config.ts`**
Evidence: Kiro logged "8 failures in screens.render, flow.explore and k1.verifyWiring that did not
reproduce", `shareError.coldOpen.test.tsx` hitting a 60 s hook timeout in a full run, P108 and P117
generator flakes. 198 test files (23 jsdom) run in one pool with default workers and timeouts.
How it fails: a red run is ignored as "flaky", and a real regression hides in the noise.
Fix: split node and jsdom projects, cap workers, set an explicit `hookTimeout`, and make every
property test's coverage check deterministic (the P117 fix pattern).

**B9 · Medium · `.github/workflows/ci.yml`, `frontend/e2e/`, `frontend/playwright.config.ts:24`**
Evidence: two Playwright specs exist; CI never runs them; service workers are blocked in the config.
Nothing checks the deployed pair (Vercel page, Render API, CORS, CSP) after a deploy.
Fix: CI Playwright job on the preview build; a small `scripts/smoke-deployed.mjs` the owner or the
orchestrator runs after each deploy.

**B10 · Low-Med · `frontend/src/drivers/camera.ts:19,89-97`**
Evidence: `MAX_CAMERA_BYTES` is 50 MB and `createImageBitmap(file, { imageOrientation })` decodes
at full resolution before the canvas downscale. A 50 MP photo is about 200 MB of pixels.
How it fails: on a 2 to 3 GB phone the tab can be killed during decode; the user hears nothing.
Earlier audit PERF-05. Phone-only verification.
Fix: pass `resizeWidth` or `resizeHeight` (1600) to `createImageBitmap` so the decoder downsamples;
keep the `<img>` fallback; on a decode failure say "Photo too large, try again closer".

**B11 · Low · `frontend/src/drivers/diagramStore.ts` (whole file), no `navigator.storage` use in `src`**
Evidence: saved diagrams are in IndexedDB as best-effort storage; `persist()` is never requested.
How it fails: Chrome may evict the origin under storage pressure on a full low-end phone; the
student's saved diagrams disappear.
Fix: call `navigator.storage.persist()` once after the first successful save; ignore the answer.

**B12 · Low · `frontend/src/App.tsx:394-397, 437-440`**
Evidence: unsaved-changes confirmation uses `window.confirm` right after `speech.speak`.
How it fails: the native dialog blocks the page; without TalkBack the dialog itself is silent and
the spoken prompt may be cut. Teacher screens only. Phone-only verification; owner decision.

**B13 · Low · `backend/app/main.py:361, 719-725`, `backend/app/validate.py:583`**
Evidence: validator error strings can contain a label; they are logged by the improve pass and
returned to the client in a 422. `docs/PRIVACY.md:123` says labels are not logged.
Fix: log the error count only; return a fixed sentence. (Handled in lane hx3.)

**Test gaps (no finding number; they are tasks):**
- No property drives the touch pipeline with a random storm of events (down, move, up, cancel,
  blur, hidden, second finger) and checks that haptics and tone always end stopped. Task K-H2.
- No test bounds `decodeShare` time and memory on a worst-case payload (earlier R4, suspected). Task K-H4.
- No "never 5xx" property for `/api/v1/ask` and `/api/v1/validate` with arbitrary JSON. Lane hx3.
- No browser-level soak of Explore. Lane hx11.

### Verified sound in Part 1 (do not re-audit)
- Scene request: timeout, one retry on 502/503/429 with clamped `Retry-After`, abort on unmount (`api/scene.ts:147-243`).
- Storage: every IndexedDB call returns a result object instead of throwing (`diagramStore.ts:189-291`); `localStorage` wrapped (`storage.ts:9-38`); save failures set status text and never interrupt Explore (`App.tsx:473-548`).
- Backend pipeline: deadline split with a Raw Mode reserve, cancellation on client hang-up, Raw Mode in a worker thread with cooperative cancel (`main.py:649-895`, `raw_mode.py:34-43`).
- Schema: NaN and infinity rejected, `aspect` bounded 0.05 to 20, unique ids, no dangling segments (`schema.py:35-126`).

---

## (c) Part 2: security hardening (defensive)

### Findings

**S1 · High · `backend/app/paid_budget.py:19,95-125`, `backend/app/limits.py:31-33`, `backend/app/main.py:777-893`**
Evidence: the paid-call budget is one global counter (2000 per UTC day). Rate limits allow 20
scene and 40 ask requests per minute per IP. One scene request can make several paid calls:
extract (`main.py:777`), equation route (`:785`), validation retry (`:798`), rescue (`:809`),
improve pass (`:886`), plus provider retries (`render.yaml:47-48`). The cache is keyed by image
bytes (`scene_cache.py:33-41`), so changing one byte bypasses it.
How it fails: one client spends the day's budget in well under an hour. From then on
`is_budget_exhausted()` sends every student to Raw Mode and facts-only Ask until UTC midnight.
Cost is capped; availability of the AI path is not.
Fix: a per-client daily allowance inside `paid_budget` (env `PAID_CALLS_PER_CLIENT_PER_DAY`),
charged by the same `try_consume` call through a context variable set in the two routes. A client
over its share gets Raw Mode / facts answers; others are unaffected. The number is an owner
decision because a classroom behind one school network shares an IP (see section e).

**S2 · Medium · `backend/app/paid_budget.py:21-24`, `backend/app/limits.py:160`, `render.yaml:8,12-74`**
Evidence: budget, rate-limit windows and in-flight counts are module globals. The free plan
restarts on deploy, crash and wake-up. `PAID_CALLS_PER_DAY` is not set in `render.yaml` (default 2000 applies).
How it fails: every restart hands out a fresh day's budget. The code cannot be the cost cap.
Fix: owner sets hard spend limits at each provider (section e). Set `PAID_CALLS_PER_DAY`
explicitly in `render.yaml`. Document the kill switch: `PAID_CALLS_PER_DAY=0` turns all paid calls
off (`paid_budget.py:84-85`) and the app keeps working in Raw Mode.

**S3 · Medium · `.github/workflows/ci.yml`, `.github/workflows/dependency-review.yml`, `backend/requirements.lock`**
Evidence: no `pip-audit` or `npm audit` step. Dependency review only looks at the diff of a pull
request, so a new advisory against an existing pin is not seen. The lock has no hashes.
`frontend/package.json:16-36` uses caret ranges (the lockfile pins them; `npm ci` is used).
Fix: weekly and on-push audit job (`pip-audit -r backend/requirements.lock`,
`npm audit --omit=dev --audit-level=high`). Hashes are optional.

**S4 · Medium · `.github/workflows/*.yml`**
Evidence: every action is pinned by a mutable tag, including third-party ones that receive a
token: `gitleaks/gitleaks-action@v3` (`gitleaks.yml:27-29`), `release-drafter/release-drafter@v7`
with `contents: write` (`release-drafter.yml:14-28`). `pbt-soak.yml:47,80` interpolates
`github.event.inputs.*` straight into a shell script. `release-drafter.yml` grants write
permissions at workflow level for `pull_request` runs too. `ci.yml` has no `timeout-minutes`.
`a11y.yml:39` is `continue-on-error` with no assertion, so it never fails.
`labeler.yml` uses `pull_request_target`; it is safe only because it never checks out PR code.
Fix: pin third-party actions to commit SHAs (Dependabot keeps them fresh); pass inputs through
`env:` and validate as integers; move write permissions to the job that needs them and only on
`push`; add timeouts; add a comment in `labeler.yml` forbidding a checkout.

**S5 · Medium · `frontend/vercel.json:24`, `frontend/tests/security.headers.test.ts:70`, `render.yaml:5`, `docs/DEPLOY.md:67`**
Evidence: CSP `connect-src` allows only `https://ghost-touch-api.onrender.com`. The blueprint
names the service `ghost-touch-backend` and the deploy guide shows `ghost-touch-backend-xxxx`.
How it fails: if the real host differs, the browser blocks every API call and the app fails as
"network error" with no hint. Raised three times before (A6, R3-F1, S-01) and never confirmed.
Fix: owner confirms the production host once; the deployed smoke script (hx8) checks it forever.
Also add `upgrade-insecure-requests`, `Cross-Origin-Opener-Policy: same-origin`, and deny unused
sensors in `Permissions-Policy`. `style-src 'unsafe-inline'` stays (React inline styles); `script-src 'self'` is already strict.

**S6 · Low-Med · `backend/app/main.py:455-474`**
Evidence: `allow_methods=["*"]`, `allow_headers=["*"]`; `ALLOWED_ORIGINS` falls back to
`http://localhost:5173`; nothing rejects `*` or `http://` origins in production.
Note: CORS does not protect the API key. Anyone can call the API without a browser; S1 and S2 are the real controls.
Fix: methods `GET, POST, OPTIONS`, headers `Content-Type`; in production drop `*` and non-https origins with a logged error.

**S7 · Low · `backend/app/ask.py:350-377, 1019-1049`, `backend/app/vision/prompts.py:51-67`**
Evidence: prompt-injection handling is sound in structure: scene strings and the question are
framed as untrusted, closing tags are stripped, the answer is clamped to 2 sentences and 300
characters, the target must be an id in the scene, and extraction output must pass
`validate_scene`. What is missing is an output check and a regression corpus.
How it fails: a model that obeys text inside a photo or a forged fact can still speak that text
(bounded, but wrong), or echo the prompt.
Fix: put a random canary in the Ask prompt; if the reply contains the canary, the delimiters, a
URL or the words "Scene Element IDs", answer the "don't know" sentence. Add a corpus test with a
fake provider that obeys injected instructions and assert the response stays inside the schema.
A forged fact ("AC = 7 cm") is data poisoning, not injection; the existing "shared by, not
verified" wording is the control for that.

**S8 · Low · `render.yaml:10`**
Evidence: uvicorn runs with defaults: `Server` header on, no `--limit-concurrency`, access log
with client addresses. Earlier W2 finding 3.
Fix: `--no-server-header --limit-concurrency 64`. Access-log choice is an owner decision (privacy versus debugging).

**S9 · Low · privacy and retention: `backend/app/main.py:626,777,886-893`, `backend/app/scene_cache.py:86-94`, `docs/PRIVACY.md:188`**
Evidence (sound): the server never writes images to disk; the cache holds scene JSON only, in
memory, 64 entries, 6 hours. The app re-encodes every photo through a canvas
(`frontend/src/drivers/camera.ts:131-148`), which drops EXIF and GPS before upload.
Open: image bytes are forwarded unchanged to OpenAI, Gemini or Nebius; their retention and
training terms are marked UNVERIFIED in `PRIVACY.md`. Students may be minors. Free API tiers often
have weaker data terms than paid tiers. A client that calls the API directly can send EXIF.
Fix: owner reads and records each provider's current data terms and settings (section e);
optional server-side re-encode before forwarding; confirm a "delete all saved diagrams" control exists.

**S10 · Low-Med · agent permission modes: `scripts/agy-run.sh:57-59`, `scripts/agy-settings.json`, `.kiro/agents/gt-*.json`**
Evidence: `AGY_DANGEROUS=1` runs agy with `--dangerously-skip-permissions`. Kiro shell allow-lists
use patterns such as `git diff( .*)?` and `npx vitest run( .*)?`; if the matcher is a plain regex,
`git diff ; <anything>` matches. `gt-writer` may `git add` and `git commit`. A real
`backend/.env` sits in the working tree. `gt-auditor.json:12` and `gt-reviewer.json:12` commit a
machine-specific temp path.
How it fails: instructions hidden in any text an agent reads (a doc, a web page, a test fixture)
can become commands with the owner's rights: read the key, change code, commit.
Guardrails to document and follow: dangerous mode only in a separate worktree with no `.env`
present and no untrusted input; never give an agent network tools together with shell; every
lane diff reviewed by the orchestrator's own gates before merge; gitleaks before every push;
tighten the patterns to `( [-\w./=:@]+)*`; keys rotated if a dangerous-mode run ever misbehaved.

**S11 · Low · repo hygiene**
Verified: no `.env` file is tracked and none was ever added in history (only the two
`.env.example` files); gitleaks scans full history on push; `.gitignore` covers `.env*`, `logs/`,
`.claude/settings.local.json`. `/.kiro` is not ignored (do not change).
Open: no `SECURITY.md`; absolute local paths in committed agent configs; GitHub-side settings unconfirmed (section e).

### Verified sound in Part 2 (do not re-audit)
- Uploads: body cap before buffering (`limits.py:240-278`), 10 MB stream check (`main.py:606-618`), MIME allow-list, magic-byte sniff and MIME match (`image_utils.py:238-255`), 12 MP cap from the header and again after decode (`image_utils.py:274`, `raw_mode.py:111-140`), EXIF parsed for orientation only.
- Rate limiting: per-IP sliding window with IPv6 /64 grouping, bounded table, right-most trusted `X-Forwarded-For` hop (`limits.py:69-130, 288-314`); per-client in-flight caps (`limits.py:341-367`).
- No SSRF surface: the backend only calls provider base URLs from env (`_openai_compat.py:127`); no user-supplied URL is fetched. No open redirect: share links are URL fragments decoded on the device; nothing assigns `location` from a payload.
- No XSS sink: no `innerHTML`, `dangerouslySetInnerHTML`, `eval` or `document.write` in `frontend/src`. Share decoding is total, size-capped, depth-capped and drops `__proto__` keys (`share/codec.ts:171-214`).
- Expression route: hand-written parser, no `eval`, length, depth and node caps (`graphs/expr.py:21-24, 205-211`).
- API responses: `nosniff`, `default-src 'none'`, `X-Frame-Options: DENY`, `no-store`; docs endpoints off in production (`middleware.py:15-58`, `main.py:440-443`). Key redaction in provider errors (`_openai_compat.py:20-30`).

---

## (d) Worker plans

### Shared rules

Serialization (important): a lane driver is merging heartbeat, speech pacing, stay-on-line and
page-edge lanes into `main`. **No lane below may edit `frontend/src/screens/Explore.tsx` or
`frontend/src/flow/explore.ts`** except the two marked "SERIALIZED". Every other lane lists those
two files as forbidden and must stop and report if it thinks it needs them.

File overlap between hardening lanes:
- `backend/app/main.py`: hx2 then hx3 (serial).
- `frontend/src/main.tsx`: hx1 then hx7 (serial).
- `frontend/src/App.tsx`: hx7 only.
- `frontend/src/api/scene.ts`: hx6 only. `frontend/src/api/ask.ts`, `api/health.ts`, `flow/ask.ts`: hx5 only.
- `frontend/src/core/**`, `.kiro/specs/**`: Kiro only.

Paste this block at the top of every agy prompt:

```
HX RULES (agy):
- Do NOT run any shell command. No npm, npx, python, pytest, ruff, git, curl. The orchestrator runs all gates.
- Do NOT open, read, create or edit any .env file (any name starting with .env, including .env.example).
- Do NOT edit: frontend/src/screens/Explore.tsx, frontend/src/flow/explore.ts, frontend/src/core/**,
  .kiro/**, .gitignore, .kiro/specs/ghost-touch/tasks.md, or any path outside the ALLOWED list of this lane.
- Do NOT change any tuned haptic value. Do NOT add a dependency. Do NOT add a paid service.
- Browser APIs only in frontend/src/drivers/. Every new spoken string goes through i18n with en, hi, gu.
- Every new control: accessible name, at least 48x48 px, state changes spoken.
- If the task cannot be done inside ALLOWED paths, stop and write why in your report.
- End with a report file docs/reports/agy-<lane>-report.md: files changed, tests added, what you could not verify.
```

### Suggested order

| Slice | Lanes (parallel inside a slice unless noted) | Why first |
|---|---|---|
| 1 (highest value, lowest risk) | hx1, hx2, hx4, K-H1 | Closes risks 1, 2, 5; none touch Explore; all small |
| 2 | hx3 (after hx2), hx5, hx8, hx10, K-H2, K-H4 | Leak/CORS, Ask resilience, headers and smoke, docs, chaos property |
| 3 | hx6 (after K-H1), hx7 (after hx1), hx9, K-H5 | Ingress wiring, update handling, storage and decode, flake work |
| 4 (SERIALIZED behind the lane driver) | hx11, then hxE only if K-H2 or hx11 found a bug | Needs a stable Explore |

### KIRO WORKER TASKS

Rules for every Kiro task: spec first (requirement, design note, property numbers, task entry in
`tasks.md`; use the next free numbers after Requirement 34 / P127 / task 60 and re-check, other
work is in flight). Tests in `frontend/tests`. Never push. Never change a tuned value in
`.kiro/steering/tech.md`. Log in `docs/BUILD_LOG.md`. Run `npx tsc --noEmit` and `npx vitest run` as the gate.

**K-H1 · Scene ingress guard (B2)**
Scope: `frontend/src/core/sceneGuard.ts` (new), `frontend/src/core/savedDiagrams.ts`, `frontend/tests/sceneGuard.prop.test.ts`, spec files.
Acceptance: `isRenderableScene(value: unknown): value is DiagramScene` is pure and total; `deserialise` returns `undefined` for a scene the guard rejects; all three samples, every fixture in `backend/fixtures/*.json` and a 500-point Raw Mode scene are accepted; properties pass with at least 300 runs; mutation check logged.
```
Task: add a pure scene ingress guard. Spec first: a new requirement "Every scene that reaches Explore, from the
network, a bundled sample or saved storage, has passed one structural guard", a design note, properties, a task entry.
Create frontend/src/core/sceneGuard.ts exporting isRenderableScene(value: unknown): value is DiagramScene.
It checks: kind is one of the four; points/segments/polylines/bars/facts are arrays when present (missing means
empty is NOT acceptable for points, segments, polylines, bars: require arrays); every coordinate is a finite number
in [0,1]; ids are non-empty strings; segment endpoints exist; bar value finite; aspect, when present, finite and in
[0.05, 20]; size caps equal to the backend's (500 points, 1000 segments, 50 polylines, 1000 polyline points,
100 bars, 100 facts, text 300 chars). No React, no browser API, no i18n.
Use it in core/savedDiagrams.ts deserialise (a rejected scene returns undefined).
Properties: (1) total: for any JSON value it returns a boolean and never throws; (2) every sample in
frontend/public/samples and every scene fixture in backend/fixtures is accepted; (3) for any accepted scene and any
finger and viewport, hitTest, step, compass, curveYAtX and followTarget never throw and return finite numbers;
(4) removing or corrupting any one required array or coordinate of an accepted scene makes it rejected.
Do not change hitTest.ts, hapticEngine.ts or any tuned value. If property (3) finds a throw in core, stop, log the
counterexample in BUILD_LOG.md, and fix it as its own spec'd task.
```

**K-H2 · Touch pipeline chaos property (test gap)**
Scope: `frontend/tests/pipeline.chaos.prop.test.ts` (new), spec files. No `src` change unless a property fails.
Acceptance: properties pass at 500 runs; at least three mutants of the test harness are shown to be caught; any real failure is logged with its seed and not hidden.
```
Task: a chaos property for the pure touch pipeline. Spec first (requirement text: "After the last finger lifts or the
page loses focus, vibration and tone are off and stay off"; properties; task entry).
Generate random event sequences of length 1..400 over the three sample scenes and random valid scenes: pointer down,
move (any point, including outside the canvas and exactly on corners), up, cancel, a second pointer, "blur" and
"hidden" (modelled as a lift), with time steps from 0 ms to 5 s including repeated equal timestamps.
Drive the real step() (and heartbeatStep and followTarget wrappers when their flags are on).
Invariants: never throws; every effect list is bounded (at most 4 effects per step); after any lift the effects
contain vibrate(0) or no vibration is pending, and tone(null); no speak effect repeats the same label twice in a row
within the quiet window; state after lift equals initialState() in every field that Requirement 4 says resets;
replaying the same sequence gives the same effects (determinism).
Include degenerate inputs: zero-length segments, coincident points, bars with x0 == x1, a polyline of two identical
points, viewport width or height 0, NaN or Infinity finger coordinates.
Do not change tuned values. If an invariant fails, keep the failing seed as a pinned regression example and report.
```

**K-H4 · Share decode worst-case bound (earlier R4)**
Scope: `frontend/tests/share.decodeBound.test.ts` (new), spec note. `frontend/src/share/limits.ts` only if the test proves a problem.
Acceptance: test builds the most compressible payloads at `LIMITS.maxHashChars`, asserts `decodeShare` returns or throws `ShareError` within 250 ms and that the decompressed length never exceeds a stated bound; result recorded in BUILD_LOG.md.
```
Task: settle whether a share link can be a decompression bomb. Write frontend/tests/share.decodeBound.test.ts.
Build worst-case inputs: LZString.compressToEncodedURIComponent of a 1 MB, 5 MB and 20 MB string of one repeated
character and of repeated '[' and '{"a":' patterns; keep only those whose compressed form fits LIMITS.maxHashChars.
For each, measure decodeShare time and the length of the decompressed string (call LZString directly for the length).
Assert: decodeShare throws ShareError 'too-large' or 'bad-format', never another error, in under 250 ms.
If any input within maxHashChars expands beyond 2 MB or takes longer, do not hide it: record the numbers, then
propose (spec first) the smallest fix: lower maxHashChars, or reject on a compressed-length to distinct-symbol
heuristic before decompressing. Do not weaken any existing share test.
```

**K-H5 · Deterministic property tests and a run multiplier (B7, B8)**
Scope: `frontend/tests/**` (property files for hitTest, geometry, hapticEngine, sticky, heartbeat, curve, compass), `frontend/tests/support/runs.ts` (new), spec note.
Acceptance: no property test asserts on a count of randomly reached cases; `FC_RUNS_MULT=10 npx vitest run .prop.test` runs ten times the examples; full suite green five times in a row with `--maxWorkers=6`; findings logged.
```
Task: remove luck from the property suite. (1) Search frontend/tests/*.prop.test.ts for coverage or statistics
assertions on random draws (counters compared with toBeGreaterThan, fc.pre filters that reject most cases, wall-clock
budgets). For each, apply the P117 pattern: deterministic seeded cases for coverage, random cases for breadth.
(2) Add frontend/tests/support/runs.ts exporting runs(n) = n * (Number(process.env.FC_RUNS_MULT) || 1), and use it
for numRuns in the core property files (hitTest, geometry, hapticEngine, sticky, heartbeat, curve, compass).
(3) Run the full suite five times; list every test that failed at least once with its seed in BUILD_LOG.md and
classify each as generator bug, test-environment load, or product bug. Fix generator bugs; report the other two.
Do not change src/core or any tuned value.
```

### AGY WORKER TASKS

Each prompt starts with the HX RULES block above. Backend lanes: the orchestrator runs
`backend/.venv/Scripts/python -m pytest backend`, `-m ruff check backend` and
`-m ruff format --check backend`; all must pass. Frontend lanes: the orchestrator runs
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test`, `npm --prefix frontend run build`.

**hx1 · Error boundary and crash announcer (B1)** · independent · slice 1
Allowed: `frontend/src/main.tsx`, `frontend/src/components/CrashScreen.tsx` (new), `frontend/src/components/ErrorBoundary.tsx` (new), `frontend/src/drivers/crashGuard.ts` (new), `frontend/src/i18n/index.ts`, `frontend/src/styles/global.css`, `frontend/tests/crash*.test.tsx` (new).
Acceptance: a child that throws during render shows the crash screen; `navigator.vibrate(0)` is called and speech says the crash sentence once; the button is focused, at least 48x48 px, has an accessible name and reloads; a second error within 5 s does not speak again; `unhandledrejection` and `error` events are caught without replacing the screen for non-fatal rejections (speak nothing, record only); works with `speechSynthesis` missing.
```
[HX RULES]
LANE hx1: last line of defence for a blind user when the app crashes.
ALLOWED: frontend/src/main.tsx, frontend/src/components/ErrorBoundary.tsx (new), frontend/src/components/CrashScreen.tsx
(new), frontend/src/drivers/crashGuard.ts (new), frontend/src/i18n/index.ts, frontend/src/styles/global.css,
frontend/tests/crashBoundary.test.tsx (new), frontend/tests/crashGuard.test.ts (new).
DO:
1. drivers/crashGuard.ts: stopEverything() calls navigator.vibrate(0) and window.speechSynthesis.cancel() inside
   try/catch, and announceCrash(text, lang) speaks once (ignore repeat calls within 5 s). installGlobalHandlers()
   adds window 'error' and 'unhandledrejection' listeners that call stopEverything() only for 'error' events; for
   rejections do nothing audible. No dependency on the app's Drivers object (it may be the thing that broke).
2. components/ErrorBoundary.tsx: a class component; on error call stopEverything(), announceCrash(t('crash.message')),
   render CrashScreen.
3. components/CrashScreen.tsx: role="alert", the sentence as text, one full-screen button t('crash.restart') that calls
   window.location.reload(); focus it on mount.
4. main.tsx: wrap <App /> in <ErrorBoundary>, call installGlobalHandlers() once.
5. i18n keys crash.message ("Something went wrong. Double tap the screen to start again.") and crash.restart, in en, hi, gu.
TESTS: boundary shows the screen and speaks once when a child throws; vibrate(0) called; button has a name and the
48 px class; second error inside 5 s is silent; works when speechSynthesis and navigator.vibrate are undefined.
```

**hx2 · Per-client share of the daily AI budget (S1, S2)** · backend · slice 1
Allowed: `backend/app/paid_budget.py`, `backend/app/main.py` (route entry only), `backend/app/ask.py` (budget check only), `backend/tests/test_hx2_client_budget.py` (new), `render.yaml`, `backend/README.md`.
Acceptance: with `PAID_CALLS_PER_CLIENT_PER_DAY=N`, client A is refused paid calls after N and gets Raw Mode / facts answers with reason `budget_exhausted`, client B is unaffected; global cap still holds; table bounded at 20,000 keys; UTC rollover resets both; unset or 0 means no per-client cap (current behaviour); existing tests unchanged and green.
```
[HX RULES]
LANE hx2: stop one client from spending the whole day's AI budget.
ALLOWED: backend/app/paid_budget.py, backend/app/main.py, backend/app/ask.py, backend/tests/test_hx2_client_budget.py
(new), render.yaml, backend/README.md. Do not touch backend/app/limits.py or the vision providers.
DO:
1. paid_budget.py: add a contextvars.ContextVar "budget_client" (default None), set_budget_client(key) returning the
   token, and a per-client ledger dict[str, int] for the current UTC date (cleared on date change, capped at 20_000
   keys: when full, refuse new keys' paid calls rather than evict). get_client_daily_limit() reads
   PAID_CALLS_PER_CLIENT_PER_DAY (int >= 0; unset, invalid or 0 = no per-client cap).
   try_consume(n): under the same lock, if a client is set and a cap is on and client_count + n > cap, return False
   (log once per client per day, without the key itself); otherwise charge both ledgers.
   is_budget_exhausted(): also True when the current context's client is at its cap.
2. main.py: in process_scene and ask_question_route, right after request_client_key(...), call set_budget_client(key).
   The context variable must be set before any asyncio.create_task so tasks inherit it. Do not reset it early;
   the background improve pass must charge the same client.
3. render.yaml: add PAID_CALLS_PER_DAY "2000" and PAID_CALLS_PER_CLIENT_PER_DAY "500" with a comment that both are
   owner decisions. backend/README.md: document both and the kill switch PAID_CALLS_PER_DAY=0.
TESTS (pytest + Hypothesis): for any interleaving of consumes across up to 5 clients, each client's count <= its cap
and the total <= the global cap; A exhausted does not block B; date rollover resets; cap 0 or unset equals old
behaviour; table cap holds; an endpoint test with a fake provider shows /api/v1/scene returns mode "raw" with reason
"budget_exhausted" for the capped client and mode "ai" for another.
The orchestrator will run pytest and ruff; keep line length <= 100 and existing tests untouched.
```

**hx3 · Backend leak, CORS and Ask output filter (S6, S7, B13)** · backend · slice 2, after hx2
Allowed: `backend/app/main.py`, `backend/app/ask.py`, `backend/tests/test_hx3_*.py` (new), `render.yaml`.
Acceptance: CORS allows only GET, POST, OPTIONS and `Content-Type`; in production `*` and `http://` origins are dropped with an error log; 422 from Raw Mode validation is a fixed sentence; the improve-pass log line carries a count, not error text; Ask replies containing the canary, a delimiter, a URL or "Scene Element IDs" become the "don't know" answer; injection corpus and never-5xx properties pass.
```
[HX RULES]
LANE hx3: close small leaks and add an output check to Ask.
ALLOWED: backend/app/main.py, backend/app/ask.py, backend/tests/test_hx3_cors_leaks.py (new),
backend/tests/test_hx3_ask_injection.py (new), render.yaml.
DO:
1. main.py create_app: allow_methods ["GET","POST","OPTIONS"], allow_headers ["Content-Type"]. Add
   filter_production_origins(origins): when is_production(), drop "*" and any origin not starting with "https://",
   log one error naming how many were dropped (not their values). Update tests/test_cors.py expectations only if they
   assert the old wildcard.
2. main.py line ~361: log len(val_result.errors), not the list. Line ~719: return the fixed detail
   "Extracted outline could not be validated. Please upload a clearer photo." with no validator text.
3. ask.py: build_ask_prompt gains a canary parameter (random 16 hex chars made per request in answer_question) placed
   in a line "Internal marker (never repeat): <canary>". After parse_model_ask_output, if the answer contains the
   canary, either question delimiter, "Scene Element IDs", "http://" or "https://", treat it as "don't know".
4. render.yaml startCommand: add --no-server-header --limit-concurrency 64.
TESTS: (a) corpus of at least 20 injection strings placed in labels, title, facts and the question, with a fake
provider that obeys them (returns the canary, the prompt, a URL, a 2000-char essay, a target id not in the scene):
response always matches AskResponse, answer <= 300 chars, target is None or an id in the scene.
(b) Hypothesis: POST /api/v1/ask and /api/v1/validate with arbitrary JSON bodies never return a status >= 500.
(c) CORS preflight from an unlisted origin gets no allow-origin header; production drops "*" and "http://x".
```

**hx4 · CI hardening (B4, B5, B7, B9, S3, S4)** · independent · slice 1
Allowed: `.github/workflows/**`, `.github/dependabot.yml`, `backend/tests/conftest.py`, `backend/tests/test_hx4_schema_contract.py` (new).
Acceptance: backend CI installs `requirements.lock` plus `pytest hypothesis ruff`, Python 3.11.10; a `schema-drift` step regenerates types and fails on diff; an `audit` job runs `pip-audit` and `npm audit --omit=dev --audit-level=high`; a Playwright job runs `e2e/` on the preview build; every job has `timeout-minutes`; `pbt-soak.yml` passes inputs through `env:` and rejects non-integers; `release-drafter.yml` write permissions are job-level and only on `push`; Hypothesis profiles `ci` and `soak` exist. Action SHA pinning is left to the orchestrator (needs network lookups).
```
[HX RULES]
LANE hx4: make CI test what is deployed and catch drift. You cannot run anything; write careful YAML.
ALLOWED: .github/workflows/ci.yml, pbt-soak.yml, release-drafter.yml, a11y.yml, labeler.yml, codeql.yml,
.github/workflows/audit.yml (new), .github/dependabot.yml, backend/tests/conftest.py,
backend/tests/test_hx4_schema_contract.py (new).
DO:
1. ci.yml backend job: python-version '3.11.10'; install with "pip install -r requirements.lock" then
   "pip install pytest hypothesis ruff"; cache key on requirements.lock. Add timeout-minutes: 20 to both jobs.
2. ci.yml new job schema-drift (needs Python and Node): in backend run "python -m app.export_schema", in frontend run
   "npm ci" and "npm run gen:types", then "git diff --exit-code frontend/src/types/scene.gen.ts".
3. ci.yml new job e2e: npm ci, "npx playwright install --with-deps chromium", "npx playwright test"; upload the
   report as an artifact on failure; timeout-minutes: 20.
4. audit.yml: on push to main, weekly cron and workflow_dispatch; permissions contents: read; steps
   "pip install pip-audit && pip-audit -r backend/requirements.lock" and
   "npm ci && npm audit --omit=dev --audit-level=high" in frontend.
5. pbt-soak.yml: move inputs into env (ITERS, HYPOTHESIS_PROFILE), validate ITERS with a case statement that accepts
   digits only, default the backend profile to "soak", export FC_RUNS_MULT=10 for the frontend job, add timeouts.
6. release-drafter.yml: top-level permissions contents: read; the job gets contents: write and pull-requests: write
   and runs only when github.event_name == 'push'.
7. labeler.yml: add a comment "pull_request_target: never add a checkout of the PR head to this workflow".
8. a11y.yml: add a comment that it is report-only; do not make it blocking.
9. conftest.py: register Hypothesis profiles "ci" (default settings, print_blob=True) and "soak"
   (max_examples=1000, deadline=None); load the profile named by HYPOTHESIS_PROFILE when set. Do not change any
   existing test's own @settings.
10. test_hx4_schema_contract.py: read frontend/src/types/scene.gen.ts as text and assert every property name in
    DiagramScene.model_json_schema() (top level and each $defs model) appears in the matching interface, and that
    the four "kind" literals appear. Skip with a clear message if the file is missing.
Do not pin actions to SHAs (you cannot look them up); leave the tags as they are.
```

**hx5 · Ask resilience after idle (B3)** · independent · slice 2
Allowed: `frontend/src/api/ask.ts`, `frontend/src/api/health.ts`, `frontend/src/flow/ask.ts`, `frontend/src/i18n/index.ts`, `frontend/tests/ask*.test.ts` (new or existing Ask tests).
Acceptance: `requestAsk` distinguishes `busy` (429/503) and waits the clamped `Retry-After` once; on `timeout` or `network` the flow says "Waking the server" and retries once within a 45 s total budget; `ASK_TIMEOUT_MS` is 17 s; `warmBackend` can be re-run when the last success is older than 10 minutes; abort on screen leave still cancels everything; no change to Explore files.
```
[HX RULES]
LANE hx5: Ask must survive a sleeping server.
ALLOWED: frontend/src/api/ask.ts, frontend/src/api/health.ts, frontend/src/flow/ask.ts, frontend/src/i18n/index.ts,
frontend/tests/hx5.askResilience.test.ts (new). If you believe Explore.tsx must change, stop and report instead.
DO:
1. api/health.ts: replace the once-per-load guard with a timestamp: warmBackend() runs when it has never run or the
   last attempt is older than 10 minutes (injectable clock). Keep resetWarmGuardForTesting and isBackendWarmed.
2. api/ask.ts: ASK_TIMEOUT_MS = 17_000. Add failure 'busy' with retryAfterSeconds for 429 and 503, reusing
   parseRetryAfter from api/scene.ts (import it; do not copy).
3. flow/ask.ts (startVoiceAsk and submitTextAsk): call warmBackend() when an Ask starts (fire and forget). On 'busy'
   wait the given seconds once and retry. On 'timeout' or 'network' (and navigator.onLine is not false) say
   t('ask.wakingUp') once and retry once. Total budget 45 s; the existing AbortController cancels waits and retries.
   The final failure message stays what askErrorMessage gives today.
4. i18n: ask.wakingUp in en, hi, gu ("The server is waking up. One moment.").
TESTS with fake fetch and fake timers: timeout then success speaks wakingUp once and returns the answer; two timeouts
give the normal error; 503 with Retry-After: 2 waits 2 s then retries; abort during the wait resolves as cancelled
with no further speech; offline does not retry.
```

**hx6 · Wire the scene guard at the network and sample ingress (B2)** · slice 3, after K-H1 merges
Allowed: `frontend/src/api/scene.ts`, `frontend/tests/hx6.sceneIngress.test.ts` (new).
Acceptance: `parseSceneResponse` and `loadSample` reject anything `isRenderableScene` rejects with `bad-response`; all three samples still load; existing scene tests green.
```
[HX RULES]
LANE hx6: use Kiro's guard where scenes enter from the network.
ALLOWED: frontend/src/api/scene.ts, frontend/tests/hx6.sceneIngress.test.ts (new). core/** is read-only for you.
DO: in api/scene.ts make asScene return the value only when isRenderableScene (from ../core/sceneGuard) accepts it;
parseSceneResponse and loadSample then throw SceneRequestError('bad-response') as they do today for a bad shape.
TESTS: a response whose scene lacks "points", has a NaN coordinate, or a segment to a missing point is 'bad-response';
the three files in frontend/public/samples load; a valid 500-point raw scene is accepted.
If core/sceneGuard.ts does not exist yet, stop and report.
```

**hx7 · Service worker update and failed chunk recovery (B6)** · slice 3, after hx1 (shares `main.tsx`)
Allowed: `frontend/src/drivers/swUpdate.ts` (new), `frontend/src/main.tsx`, `frontend/src/App.tsx` (one effect), `frontend/src/drivers/pdf.ts`, `frontend/src/flow/capture.ts` (error mapping only), `frontend/src/i18n/index.ts`, `frontend/tests/hx7.swUpdate.test.ts` (new).
Acceptance: a rejected `import('pdfjs-dist')` speaks "The app was updated. Reloading." and reloads at most once per session; a `controllerchange` while on Start or Capture reloads after the announcement; in Explore, Correct, Teach or Saved it only sets a flag and reloads on the next visit to Start or Capture; no reload ever happens during Explore. Phone verification required.
```
[HX RULES]
LANE hx7: never strand a user on stale code, and never reload under a finger.
ALLOWED: frontend/src/drivers/swUpdate.ts (new), frontend/src/main.tsx, frontend/src/App.tsx,
frontend/src/drivers/pdf.ts, frontend/src/flow/capture.ts, frontend/src/i18n/index.ts,
frontend/tests/hx7.swUpdate.test.ts (new). Do not change vite.config.ts.
DO:
1. drivers/swUpdate.ts: createUpdateWatcher({ sw = navigator.serviceWorker, reload, storage = sessionStorage }) with
   onUpdate(listener) fired on 'controllerchange' (ignore the very first controller of a fresh install), and
   reloadOnce(reason): reloads only if sessionStorage key 'gt_reloaded' is not set, then sets it. All in try/catch.
2. drivers/pdf.ts: wrap the dynamic import; when it rejects throw a PdfError with a new reason 'stale'.
3. flow/capture.ts: map 'stale' to t('app.updatedReloading'); the Capture caller then calls reloadOnce after 2.5 s.
4. App.tsx: one effect subscribing to the watcher. If view.screen is 'start' or 'capture', speak
   t('app.updatedReloading') and reloadOnce after 2.5 s. Otherwise set a ref flag; when the view next becomes 'start'
   or 'capture', do the same. Never reload from any other screen.
5. i18n: app.updatedReloading in en, hi, gu.
TESTS with fakes: first controller is ignored; update on Capture reloads once; update in Explore does not reload
until Capture is shown; a second update in the same session does not reload again; import failure maps to 'stale'.
```

**hx8 · Frontend headers and a deployed smoke script (S5, B9)** · independent · slice 2
Allowed: `frontend/vercel.json`, `frontend/tests/security.headers.test.ts`, `scripts/smoke-deployed.mjs` (new), `docs/DEPLOY.md`.
Acceptance: CSP gains `upgrade-insecure-requests`; headers gain `Cross-Origin-Opener-Policy: same-origin`; `Permissions-Policy` also denies accelerometer, gyroscope, magnetometer, display-capture; `connect-src` host is NOT changed (owner confirms it); the smoke script, given two URLs, checks page headers, that the API host is inside `connect-src`, health, a CORS preflight from the page origin, a 415 for a text upload and a sample JSON, and exits non-zero on any failure. The script sends no image and no key.
```
[HX RULES]
LANE hx8: tighten page headers and give the owner a one-command check of production.
ALLOWED: frontend/vercel.json, frontend/tests/security.headers.test.ts, scripts/smoke-deployed.mjs (new),
docs/DEPLOY.md. Do not change the connect-src host; the owner must confirm it.
DO:
1. vercel.json: append "; upgrade-insecure-requests" to the CSP; add header Cross-Origin-Opener-Policy: same-origin;
   extend Permissions-Policy with accelerometer=(), gyroscope=(), magnetometer=(), display-capture=().
   Keep camera=(self), microphone=(self). Update security.headers.test.ts to assert the new values and to keep
   asserting script-src 'self' has no 'unsafe-inline' or 'unsafe-eval' and frame-ancestors 'none'.
2. scripts/smoke-deployed.mjs (Node 22, no dependencies, global fetch): usage
   "node scripts/smoke-deployed.mjs <frontend-url> <api-url>". Checks, each printed PASS or FAIL:
   GET frontend / is 200 and has the CSP, HSTS, nosniff, Referrer-Policy and Permissions-Policy headers;
   the CSP connect-src contains the origin of <api-url>;
   GET <api>/api/v1/health is {"ok":true} within 70 s (cold start) and has x-content-type-options: nosniff;
   OPTIONS <api>/api/v1/ask with Origin: <frontend-url> and Access-Control-Request-Method: POST returns that origin
   in access-control-allow-origin; the same with Origin: https://example.invalid does not;
   GET <api>/docs is 404; POST <api>/api/v1/scene with a 10-byte text file as "image" is 415;
   GET frontend /samples/triangle.json parses as JSON with kind "geometry"; GET /sw.js is 200 with no-cache.
   Exit code 1 if any check fails. No retries beyond the health wait. Never send a real image.
3. docs/DEPLOY.md: a short "After every deploy" section with the command.
```

**hx9 · Storage persistence and safe photo decode (B10, B11)** · independent · slice 3
Allowed: `frontend/src/drivers/camera.ts`, `frontend/src/drivers/persist.ts` (new), `frontend/src/flow/saved.ts`, `frontend/src/i18n/index.ts`, `frontend/tests/hx9.*.test.ts` (new).
Acceptance: `createImageBitmap` is called with a resize option so the long side is at most 1600 px before the canvas step, with fallback to the current path when the option is rejected; output is still an upright JPEG at most 1600 px; `navigator.storage.persist()` is requested once after the first successful save and never throws. Phone verification required.
```
[HX RULES]
LANE hx9: keep low-end phones alive during photo decode, and keep saved diagrams.
ALLOWED: frontend/src/drivers/camera.ts, frontend/src/drivers/persist.ts (new), frontend/src/flow/saved.ts,
frontend/src/i18n/index.ts, frontend/tests/hx9.camera.test.ts (new), frontend/tests/hx9.persist.test.ts (new).
DO:
1. camera.ts decodeWithBitmap: first try createImageBitmap(file, { imageOrientation: 'from-image',
   resizeWidth: MAX_IMAGE_SIDE, resizeQuality: 'medium' }). If the result's height is larger than MAX_IMAGE_SIDE
   (portrait), close it and retry with resizeHeight: MAX_IMAGE_SIDE instead. If the bitmap would be upscaled (you
   cannot know the source size here), accept it: computeTargetSize never upscales further. If the call rejects, fall
   back to today's call, then to the <img> path. Always close bitmaps you discard.
2. drivers/persist.ts: requestPersistentStorage() calls navigator.storage?.persist?.() once per page load inside
   try/catch and resolves to a boolean; never throws, never speaks.
3. flow/saved.ts: after saveDiagramWithEviction succeeds, call requestPersistentStorage() (fire and forget).
TESTS with fakes: landscape and portrait inputs end at most 1600 px on the long side; a rejecting resize call falls
back; discarded bitmaps are closed; persist is requested once after two saves; missing navigator.storage is fine.
```

**hx10 · Security documentation and runbook (S2, S9, S10, S11)** · docs only · slice 2
Allowed: `SECURITY.md` (new, repo root), `docs/SECURITY_RUNBOOK.md` (new), `docs/PRIVACY.md`, `AGENTS.md`, `docs/OWNER_CHECKLIST.md`.
Acceptance: `SECURITY.md` says how to report a problem and what is in scope; the runbook covers the kill switch, key rotation steps per provider, what resets on restart, the per-client budget, how to run the smoke script, and the agent-mode guardrails from S10; `PRIVACY.md` corrects the logging statement if hx3 has not merged yet and lists the provider-terms check as an owner item; no claim is made that was not verified in code.
```
[HX RULES]
LANE hx10: write down the security controls so the owner can operate them. Docs only. Plain language, short.
ALLOWED: SECURITY.md (new), docs/SECURITY_RUNBOOK.md (new), docs/PRIVACY.md, AGENTS.md, docs/OWNER_CHECKLIST.md.
Read docs/reports/fable-hardening-plan.md sections (c) and (e) first and use only facts stated there or in code.
DO:
1. SECURITY.md: supported version (main), how to report privately (GitHub private vulnerability reporting), what the
   app stores and does not store, a two-line summary of the controls.
2. docs/SECURITY_RUNBOOK.md: (a) kill switch: set PAID_CALLS_PER_DAY=0 on Render, the app falls back to Raw Mode;
   (b) rotate a key: create the new key at the provider, set it on Render, redeploy, delete the old key; one
   paragraph each for Gemini, OpenAI, Nebius, with no key values; (c) what resets on restart (budget, rate limits,
   cache); (d) the per-client budget and how to tune it for a classroom behind one network address; (e) the
   after-deploy smoke command; (f) agent guardrails: dangerous mode only in a separate worktree with no .env file
   present, never with untrusted input, no network tools together with shell, orchestrator gates and a secret scan
   before every push, rotate keys if a run misbehaved.
3. AGENTS.md: add a short "Permission modes" section pointing to the runbook.
4. docs/PRIVACY.md: keep the UNVERIFIED label on provider retention; add the owner action to record each provider's
   data terms and date checked. Do not state that any provider does or does not train on data.
5. docs/OWNER_CHECKLIST.md: add the items from section (e) of the plan as unticked boxes.
```

**hx11 · Browser soak of Explore (test gap)** · SERIALIZED: start only after the lane driver has merged the heartbeat, speech-pacing, stay-on-line and page-edge lanes · slice 4
Allowed: `frontend/e2e/explore.soak.spec.ts` (new) only. Reads Explore, does not edit it.
Acceptance: on both Playwright projects, 60 seconds of random touch input on each of the three samples produces no `pageerror`, no console error, a stable canvas size, and after the final lift no element is in a "busy" state; `navigator.vibrate` is stubbed and the last call after the final lift is `0` or there was no call pending.
```
[HX RULES]
LANE hx11: a browser soak for the touch pipeline. Tests only; do not edit any file under frontend/src.
ALLOWED: frontend/e2e/explore.soak.spec.ts (new).
DO: for each sample (triangle, sine, barchart): open the app, tap Start, pick the sample, wait for the canvas.
Before navigation use page.addInitScript to replace navigator.vibrate with a recorder (window.__vib = []) and to
collect window 'error' events. Then for 60 s (seeded PRNG, print the seed) send touch sequences through CDP
Input.dispatchTouchEvent: single-finger drags across and outside the canvas, quick taps, two-finger touches, a
touchCancel, and twice dispatch a visibilitychange to hidden and back. End with all fingers lifted and wait 1.5 s.
ASSERT: no pageerror, no console error; canvas width and height attributes equal their values at the start; the last
entry of window.__vib is 0 (or an array of zeros) or __vib is empty; the page still responds to one more tap on the
Back control. Keep the existing two specs untouched.
```

**hxE · Explore fixes from the chaos findings (conditional)** · SERIALIZED behind the lane driver and behind hx11 · slice 4
Only created if K-H2 or hx11 produces a failing seed. Allowed paths: `frontend/src/screens/Explore.tsx`, `frontend/src/flow/explore.ts`, one new test file. The prompt is written from the failing seed at that time: one bug, one lane, smallest change, the seed pinned as a regression test. Core changes go to Kiro, not agy.

---

## (e) Owner-only items

### Decisions
1. **Per-client daily AI allowance (S1).** Proposed 500 paid calls per network address per day with the global 2000. A class of 30 on one school network shares one address (rough use: 30 students x about 35 calls = 1050). Choose: 500 (safer against abuse, a full class may hit it), 1000, or off.
2. **Provider spend caps (S2). This is the real cost limit; code cannot do it.** Set a hard monthly budget and alert in the OpenAI project, a quota or billing cap for the Gemini key, and a limit at Nebius. Use one key per provider for this app only.
3. **Provider data terms (S9).** Students' photos, possibly of minors, go to OpenAI first (`render.yaml:43`), then Gemini, then Nebius. Read each provider's current API data-use and retention terms for the tier you are on, record the date in `docs/PRIVACY.md`, and reorder or drop providers if a tier trains on inputs.
4. **Agent dangerous mode (S10).** Decide: forbid `AGY_DANGEROUS=1`, or allow it only in a separate worktree with no `.env` file. If it has ever been run in this checkout with `backend/.env` present, rotating the three keys once before the final submission is cheap insurance.
5. **Kiro agent shell patterns (S10).** Tighten `( .*)?` to `( [-\w./=:@]+)*` in `.kiro/agents/gt-*.json` and replace the machine temp path. These are Kiro's files: ask Kiro to do it; do not let agy edit `.kiro/`.
6. **`window.confirm` on teacher Back (B12).** Keep, or replace with a spoken in-app confirm. Needs a phone check first.
7. **Access logs on Render (S8).** Keep (helps debugging, records addresses) or turn off (`--no-access-log`).
8. **Keep-warm ping.** A free uptime monitor hitting `/api/v1/health` every 10 minutes removes most cold starts (helps B3). It uses Render free hours; one service fits in the monthly allowance.

### Dashboard settings to confirm (cannot be seen from the repo)
- **Render:** the real service host. It must equal the CSP `connect-src` host `ghost-touch-api.onrender.com` (`frontend/vercel.json:24`); if it is `ghost-touch-backend-...`, the CSP and its test must change. `ENVIRONMENT=production`. `ALLOWED_ORIGINS` is exactly the Vercel origin, https, no trailing slash, no `*`. `PAID_CALLS_PER_DAY` set. Keys present only for providers you intend to use.
- **Render proxy hops (earlier R3-4):** with `TRUSTED_PROXY_HOPS` unset the code trusts one hop on Render (`limits.py:52-66`). Confirm two phones on different networks get separate rate-limit buckets (one phone hitting the limit must not block the other).
- **Vercel:** `VITE_API_URL` equals the Render URL with no trailing slash; feature flags as intended; the production branch is `main` only.
- **GitHub:** branch protection on `main` (required checks: CI, Gitleaks, CodeQL); secret scanning with push protection on; private vulnerability reporting on; Dependabot alerts on; Actions default token read-only; "require approval for all outside collaborators" for fork pull requests; no repository secrets beyond what workflows need (none are needed today).
- **Action SHA pinning (S4):** the orchestrator or owner pins `gitleaks/gitleaks-action`, `release-drafter/release-drafter` and the `github/codeql-action` steps to commit SHAs (needs a network lookup, so not an agy task).

### Verifiable only on a real phone
- hx1: force a crash (temporary debug throw) and confirm the sentence is spoken and one double tap restarts, with and without TalkBack.
- hx7: install the PWA, deploy a new build, reopen: no reload during Explore; announcement and reload on Capture.
- hx9: a full-resolution camera photo on the budget phone decodes without the tab dying; saved diagrams survive a week.
- B12: the Back confirmation in Teach and Correct, eyes closed, without TalkBack.
- All Explore behaviour after slice 4 (the existing checklist in `docs/PHONE_TEST.md`).

### Verifiable only on the deployed site
- `node scripts/smoke-deployed.mjs <vercel-url> <render-url>` after hx8 (headers, CSP host, CORS, health, docs off, 415).
- hx5: leave the app idle 20 minutes, then Ask: hear "waking up", then the answer.
- hx2: from one network send more than the per-client allowance and confirm Raw Mode with reason `budget_exhausted`, while a second network still gets AI. Do this with `PAID_CALLS_PER_CLIENT_PER_DAY` set to a small number temporarily.
- The Render proxy-hop check above.

### Orchestrator notes
- This plan wrote one file only. No BUILD_LOG entry was added (single-file rule for this task); please log it as: tool = Claude Code, "hardening plan, read-only review".
- Before launching any lane, re-check `git log` and `git status`: Kiro, a second Claude session and the lane driver share this checkout.
