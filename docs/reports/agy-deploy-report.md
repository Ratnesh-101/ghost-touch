# Antigravity Report: Lane A — Deploy Prep (T10b), Config & Docs

**Agent**: Antigravity (agy, builder)  
**Task**: Lane A: Deploy prep (`docs/briefs/agy-deploy.md`)  
**Date**: 2026-11-03  

---

## 1. Executive Summary

This task prepared Ghost Touch for one-click deployment by the repository owner across **Render** (FastAPI backend) and **Vercel** (Vite React PWA frontend). All environment configurations, infrastructure Blueprints, CORS handling, Vercel routing rules, example environment files, and owner deployment instructions were audited, aligned, and verified.

Key accomplishments:
1. **Render Blueprint (`render.yaml`)**: Audited against all `os.environ` variables in `backend/app`. Added missing non-secret configurations (`ASK_TIMEOUT_SECONDS`, `SCENE_CACHE_SIZE`, `SCENE_CACHE_TTL_SECONDS`, `RATE_LIMIT_ASK_PER_MIN`, `RATE_LIMIT_SCENE_PER_MIN`, `OPENAI_BASE_URL`, `NEBIUS_BASE_URL`). Ensured all secrets specify `sync: false`. Confirmed no stale NVIDIA references.
2. **CORS Parsing & Preflight (`backend/app/main.py`)**: Added `parse_allowed_origins` to robustly handle comma-separated origin strings, strip trailing slashes, and trim whitespace. Wired startup logging of allowed CORS origins into lifespan. Added 10 tests in `backend/tests/test_cors.py`.
3. **Frontend Vercel Configuration (`frontend/vercel.json`)**: Configured SPA rewrites to ensure client-side and hash routes work on reload without swallowing `/samples/`, `/assets/`, `/icons/`, `/sw.js`, or `/manifest.webmanifest`. Added sane Cache-Control headers (`no-cache, no-store, must-revalidate` for service worker, `public, max-age=31536000, immutable` for static assets).
4. **Owner Checklist (`docs/DEPLOY.md`)**: Rewrote as a comprehensive numbered checklist with all owner-only manual dashboard actions clearly isolated under `## You must do these yourself`. Included curl verification commands, an Android TalkBack / accessibility checklist, and cold-start pre-demo warm-up instructions.
5. **Environment Templates (`.env.example`)**: Updated `backend/.env.example` and `frontend/.env.example` with complete variable sets, extensive documentation comments, and safe placeholders. Never opened, searched, or printed any secret or `.env` file.

---

## 2. Definition of Done & Verification Proof

### Backend Verification (Python 3.11 / venv)

#### 1. Pytest
**Command**: `backend/.venv/Scripts/python -m pytest backend`  
**Exit code**: `0`  
**Output**:
```
279 passed, 1 skipped, 1 warning in 29.04s
```
*(All 269 pre-existing tests + 10 new CORS tests passed cleanly.)*

#### 2. Ruff Linter
**Command**: `backend/.venv/Scripts/python -m ruff check backend`  
**Exit code**: `0`  
**Output**:
```
All checks passed!
```

#### 3. Ruff Formatter Check
**Command**: `backend/.venv/Scripts/python -m ruff format --check backend`  
**Exit code**: `0`  
**Output**:
```
50 files already formatted
```

---

### Frontend Verification (Headless Runner Status)

The following allowed commands were executed:
- `npm --prefix frontend exec -- tsc -p frontend --noEmit`  
  **Exit code**: `1`  
  **Result**: `npm : The term 'npm' is not recognized as the name of a cmdlet, function, script file, or operable program.` (Node/npm is not installed on PATH in this headless runner).
- `npm --prefix frontend test`  
  **Exit code**: `1` (`npm` not on PATH).
- `npm --prefix frontend run build`  
  **Exit code**: `1` (`npm` not on PATH).

*Note*: As documented in `docs/BUILD_LOG.md` (2026-11-03 entry), this machine environment currently only has the Python 3.11 virtual environment configured. Frontend TypeScript and build verification will run in GitHub Actions CI where Node.js is present.

---

## 3. You Must Do These Yourself (Owner-Only Steps)

Because automated tools cannot authenticate to cloud SaaS dashboards or access private account credentials, the repository owner must execute the following actions directly:

1. **Obtain API Keys**:
   - Google Gemini API key from [Google AI Studio](https://aistudio.google.com/) (**Required**).
   - *(Optional)* OpenAI API key from [OpenAI Platform](https://platform.openai.com/).
   - *(Optional)* Nebius API key from [Nebius Token Factory](https://tokenfactory.nebius.com/).

2. **Deploy Backend on Render**:
   - Go to [Render Dashboard](https://dashboard.render.com/) -> **New +** -> **Blueprint**.
   - Connect repository and select `render.yaml`.
   - Enter secret values marked `sync: false`: `GEMINI_API_KEY` (and optionally `OPENAI_API_KEY` / `NEBIUS_API_KEY`).
   - Click **Apply** and wait for deployment to complete.
   - Copy the backend URL: `https://ghost-touch-backend-xxxx.onrender.com` (**no trailing slash**).

3. **Deploy Frontend on Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard) -> **Add New...** -> **Project**.
   - Import repository. Set **Root Directory** to `frontend`.
   - Under **Environment Variables**, set:
     - `VITE_API_URL`: Your Render backend URL from Step 2 (e.g. `https://ghost-touch-backend-xxxx.onrender.com`).
   - Click **Deploy** and copy your production URL: `https://ghost-touch.vercel.app`.

4. **Connect Frontend & Backend**:
   - Go to Render Dashboard -> `ghost-touch-backend` -> **Environment**.
   - Edit `ALLOWED_ORIGINS` and set to your Vercel URL: `https://ghost-touch.vercel.app` (or comma-separated: `https://ghost-touch.vercel.app,http://localhost:5173`).
   - Save changes (Render triggers a redeploy).

5. **Run Post-Deployment Smoke Tests**:
   - Run health curl: `curl -i https://<RENDER_URL>/api/v1/health` (verify HTTP 200 `{"ok": true}`).
   - Run CORS preflight curl:
     ```bash
     curl -i -X OPTIONS https://<RENDER_URL>/api/v1/health \
       -H "Origin: https://<VERCEL_URL>" \
       -H "Access-Control-Request-Method: GET"
     ```
     Verify `access-control-allow-origin: https://<VERCEL_URL>`.
   - Open Vercel URL on an Android device in Google Chrome over HTTPS.
   - Verify built-in sample diagrams explore offline with vibration and theremin audio.
   - Verify TalkBack mode with 48×48 touch targets and pointer-captured canvas dragging.

6. **Pre-Demo Protocol (Render Free-Tier Cold Starts)**:
   - Render free tier spins down containers after 15 minutes of inactivity. First boot takes 50–70s.
   - Send `curl https://<RENDER_URL>/api/v1/health` 5 minutes before judging or recording a demo video to ensure container is warm.

---

## 4. Files Touched

1. `render.yaml`: Added missing non-secret config variables (`ASK_TIMEOUT_SECONDS`, `SCENE_CACHE_SIZE`, `SCENE_CACHE_TTL_SECONDS`, `RATE_LIMIT_ASK_PER_MIN`, `RATE_LIMIT_SCENE_PER_MIN`, `OPENAI_BASE_URL`, `NEBIUS_BASE_URL`), verified secrets are `sync: false`.
2. `backend/app/main.py`: Added `parse_allowed_origins` function to normalize CORS origins (handles comma lists, trailing slashes, whitespace); wired startup logging of allowed CORS origins.
3. `backend/tests/test_cors.py`: Created new test suite with 10 unit and integration tests for CORS preflights, disallowed origins, comma lists, trailing slash handling, and header exposure.
4. `frontend/vercel.json`: Added rewrite exclusion for PWA assets (`/sw.js`, `/manifest.webmanifest`, `/icons/`, `/samples/`, `/assets/`); added cache headers for SW, manifest, index, and immutable assets.
5. `backend/.env.example`: Updated with complete, commented variable list and safe placeholders.
6. `frontend/.env.example`: Updated with `VITE_API_URL` placeholder and instructions.
7. `docs/DEPLOY.md`: Completely rewritten as a structured, numbered owner deployment checklist with owner-only dashboard steps highlighted.
8. `docs/BUILD_LOG.md`: Appended entry documenting changes, verification results, and touched files.
9. `docs/reports/agy-deploy-report.md`: Created this completion report.

---

## 5. Needs from Kiro

None. No Kiro-owned files (`frontend/src/core/**`, `*.prop.test.ts`, `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts`, `.kiro/**`) were modified or required modification.

---

## 6. TEMP Stub Register

No temporary stubs were created or needed for this configuration and documentation task.
