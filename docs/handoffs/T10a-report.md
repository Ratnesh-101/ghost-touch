# T10a report — Deployment Preparation (Render + Vercel + CI)

Builder: **Antigravity (agy)**, 2026-11-01. Followed `AGENTS.md` and `docs/briefs/T10-deploy.md` strictly:
- Deployment preparation files only: created `render.yaml`, `frontend/vercel.json`, `.github/workflows/ci.yml`, `docs/DEPLOY.md`, and updated the Run/Deploy section in `backend/README.md`.
- Never touched `backend/app/**`, `frontend/src/**`, tests, research, or `.kiro/**`.
- No git state change commands run.
- Zero secrets committed or exposed; no `.env` files touched or inspected.
- No packages installed (used existing `backend/.venv` and `frontend/node_modules`).
- Did not edit `docs/BUILD_LOG.md` or `docs/handoffs/KIRO-PAUSE.md` directly; BUILD_LOG entry included at the end of this report.

---

## 1. What was built

1. **`render.yaml`** (Repo root — Render Blueprint):
   - Configured as a Python web service named `ghost-touch-backend` rooted in `backend/`.
   - Plan: `free`.
   - Build command: `pip install .` (installs the package and dependencies via `pyproject.toml`).
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
   - Health check path: `/api/v1/health`.
   - Python version pinned via Render's documented variable: `PYTHON_VERSION=3.11.10`.
   - Secrets marked with `sync: false` so they are prompted safely in the Render dashboard and never committed to git: `GEMINI_API_KEY`, `NVIDIA_API_KEY`.
   - Non-secret defaults provided: `GEMINI_MODEL=gemini-3.8-flash`, `GEMINI_THINKING_BUDGET=0`, `VISION_PROVIDERS=gemini,nvidia`, `PROVIDER_TIMEOUT_SECONDS=8.0`, `SCENE_TIMEOUT_SECONDS=15.0`, and placeholder `ALLOWED_ORIGINS=https://your-frontend-app.vercel.app`.

2. **`frontend/vercel.json`** (Frontend root — Vercel configuration):
   - Preset: `framework: "vite"`.
   - Build command: `npm run build`.
   - Output directory: `dist`.
   - SPA fallback rewrite: rewrites paths to `/index.html` with negative lookahead `^((?!assets/|samples/).*)$` so neither `/assets/*` nor `/samples/*` (the offline sample diagrams) are swallowed.
   - Cache control headers: `Cache-Control: no-cache` for `/sw.js`, `/manifest.webmanifest`, and `/index.html` to prevent stale PWA updates.

3. **`.github/workflows/ci.yml`** (CI Workflow):
   - Runs on `push` and `pull_request` to `main` with concurrency cancellation for stale runs.
   - **Frontend job**: Node LTS (Node 20), npm caching using `frontend/package-lock.json`, `npm ci`, `npx tsc --noEmit`, `npm test`, and `npm run build`. Annotated test step with a comment explaining the Kiro-owned P1 float precision flake so that test context is transparent.
   - **Backend job**: Python 3.11, pip caching using `backend/pyproject.toml`, `pip install -e ".[dev]"`, `ruff check .`, `ruff format --check .`, and `pytest`.

4. **`docs/DEPLOY.md`** (Deployment & Operations Guide):
   - Architecture diagram and component breakdown.
   - Step-by-step instructions for deploying Render backend via Blueprint and Vercel frontend via GitHub import.
   - CORS linkage guide explaining how to set `ALLOWED_ORIGINS` to the Vercel domain.
   - Three smoke tests: backend health probe, offline sample diagram tracing, and end-to-end photo processing.
   - Explanation of Render free-tier cold starts (~50–70s spin-up) and pre-demo warm-up protocol.
   - Instant rollback procedures for both platforms.
   - "Before You Submit" checklist (public visibility, MIT license, `.kiro/` committed, zero secrets).
   - TalkBack and accessibility evaluation guide for judges (testing with TalkBack ON and OFF).

5. **`backend/README.md`** (Run/Deploy Section):
   - Added production run command (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`) used by Render.
   - Added Deploy section referencing `render.yaml` Blueprint and `docs/DEPLOY.md`.
   - Preserved all other sections intact.

---

## 2. Checks and Real Results

All verification checks were run locally and succeeded:

| Check | Tool / Command | Real Result |
|---|---|---|
| **YAML Syntax** | `PyYAML` in `backend/.venv` | `render.yaml`: VALID YAML<br>`.github/workflows/ci.yml`: VALID YAML |
| **JSON Syntax** | `json` stdlib in `backend/.venv` | `frontend/vercel.json`: VALID JSON |
| **Secret Scan** | Python regex pattern scanner (`AIza*`, `nvapi-*`, `sk-*`, `ghp_*`, long tokens) | **PASSED**: 0 secret-like strings across all touched/created files. |
| **Frontend Typecheck** | `npx tsc --noEmit` (in `frontend/`) | **PASSED**: 0 errors, clean exit. |
| **Frontend Tests** | `npm test` (Vitest in `frontend/`) | **PASSED**: 17 test files passed, 163 tests passed (0 failures). |
| **Frontend Build** | `npm run build` (in `frontend/`) | **PASSED**: Production Vite bundle built + PWA SW generated (`dist/sw.js`, `manifest.webmanifest`). |
| **Backend Lint** | `ruff check .` (in `backend/`) | **PASSED**: All checks passed! |
| **Backend Format** | `ruff format --check .` (in `backend/`) | **PASSED**: 33 files already formatted. |
| **Backend Tests** | `pytest` (in `backend/`) | **PASSED**: 92 passed in 2.37s (1 deprecation warning from Starlette `TestClient` with `httpx`). |

---

## 3. Needs from Owner

1. **Render Deployment**: Connect repo in Render dashboard -> Blueprint -> select `render.yaml` -> supply `GEMINI_API_KEY` (and optional `NVIDIA_API_KEY`) in dashboard fields -> click Apply.
2. **Vercel Deployment**: Import repo in Vercel -> Root Directory: `frontend` -> set `VITE_API_URL` to the Render backend URL -> deploy.
3. **CORS Link**: Copy Vercel URL -> paste into Render `ALLOWED_ORIGINS` environment variable.

---

## 4. Suggested BUILD_LOG.md Entry

```markdown
### 2026-11-01 — Task 10.1 Deployment Preparation (Render, Vercel, CI)
- **Tool**: Antigravity
- **Built**:
  - `render.yaml`: Blueprint configuration for FastAPI web service on Render free tier with Python 3.11, health check `/api/v1/health`, secrets flagged `sync: false`, and configurable vision provider env vars.
  - `frontend/vercel.json`: Vite framework config, build/output directives, SPA rewrite preserving `/samples/*` and `/assets/*`, and `Cache-Control: no-cache` for `sw.js`, `manifest.webmanifest`, and `index.html`.
  - `.github/workflows/ci.yml`: Push/PR CI workflow with parallel Node LTS (tsc, npm test, build) and Python 3.11 (ruff check, ruff format, pytest) jobs with dependency caching.
  - `docs/DEPLOY.md`: Complete owner deployment guide, CORS linkage, cold start pre-demo protocol, rollback steps, pre-submission checklist, and TalkBack testing instructions.
  - `backend/README.md`: Updated Run and Deploy sections with production commands.
- **Broke**: Nothing. All 163 frontend tests and 92 backend tests passed; YAML and JSON syntax verified; zero secrets committed.
- **Files touched**:
  - Created: `render.yaml`, `frontend/vercel.json`, `.github/workflows/ci.yml`, `docs/DEPLOY.md`, `docs/handoffs/T10a-report.md`.
  - Modified: `backend/README.md`.
```
