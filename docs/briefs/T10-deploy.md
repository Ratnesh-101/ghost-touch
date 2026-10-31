# T10 — Deployment preparation (Render + Vercel + CI)

Builder: Antigravity | Reviewer: Claude Code (Kiro paused) | Planner: Claude Code
Spec: `.kiro/specs/ghost-touch/tasks.md` Task 10.1 (10.2 and 10.3, the STEMergent text and the submission, are not part of this job). Deadline context: STEMergent submission by Nov 14 (hard stop Nov 16 09:00 IST).
Read first: `AGENTS.md`, `CLAUDE.md` §5 and §6 Task 10, `backend/README.md`, `backend/pyproject.toml`, `backend/app/main.py`, `frontend/package.json`, `frontend/vite.config.ts`, `.gitignore`.

## Goal
Everything the owner needs to deploy the backend on Render and the frontend on Vercel in a few clicks, plus a CI workflow, **without any secret in the repository**. Nothing is deployed in this job (no credentials, no network).

## Files you may create or edit
- `render.yaml` (repo root, Render Blueprint): a Python web service rooted in `backend/`, build `pip install .`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/api/v1/health`, free plan, environment variables declared with `sync: false` for every secret (`GEMINI_API_KEY`, `NVIDIA_API_KEY`) and plain defaults for non-secrets (`GEMINI_MODEL=gemini-3.8-flash`, `ALLOWED_ORIGINS` as a placeholder the owner replaces, `SCENE_TIMEOUT_SECONDS`, `VISION_PROVIDERS`, `GEMINI_THINKING_BUDGET`, `PROVIDER_TIMEOUT_SECONDS`). Pin the Python version in the way Render supports (check Render's documented variable for it; if unsure, say so in the doc rather than guessing).
- `frontend/vercel.json`: framework Vite, build `npm run build`, output `dist`, SPA fallback, and headers so the service worker and manifest are not cached stale (`Cache-Control: no-cache` for `sw.js`, `manifest.webmanifest`, `index.html`). No rewrite may swallow `/samples/*` or `/assets/*`.
- `.github/workflows/ci.yml`: on push and pull request, a frontend job (Node LTS, `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run build`) and a backend job (Python 3.11, install `backend` with the dev extra, `ruff check`, `ruff format --check`, `pytest`). Cache dependencies. Mark the job step that runs the frontend tests so a Kiro-owned flaky property test does not hide other failures: run `npm test` normally (do not change the test); note the known flake in a comment and in the doc.
- `docs/DEPLOY.md`: step-by-step for the owner (Render: connect repo, Blueprint, paste secrets in the dashboard, copy the URL; Vercel: import `frontend/`, set `VITE_API_URL` to the Render URL, set Render's `ALLOWED_ORIGINS` to the Vercel URL; then smoke tests: health URL, a sample diagram offline, a real photo end to end; Render free-tier cold start of about a minute and what to do before a demo; how to roll back). Include a "before you submit" checklist (public repo, MIT visible, `.kiro` committed, no secrets) and the TalkBack test note (how a judge tests with and without TalkBack).
- `backend/README.md` only to fix the run/deploy section if it is wrong.
You may NOT edit anything else: not `backend/app/**`, not `frontend/src/**`, not tests, not `.kiro/**`, not `docs/briefs/**`.

## Checks you can run (and must report honestly)
- Validate YAML/JSON syntax (`python -c` with the standard library for JSON; for YAML use PyYAML only if it is already importable in `backend/.venv`; otherwise say it was not validated).
- Dry-run the exact CI commands locally from `frontend/` and `backend/` with the existing environments (`npx tsc --noEmit`, `npm test`, `npm run build`; `backend/.venv/Scripts/python -m pytest`, `-m ruff check .`, `-m ruff format --check .`). Note that CI uses `npm ci`; do not run `npm install` or `pip install` here.
- Confirm by search that no key-like string is in anything you created.

## Rules
No secrets anywhere (placeholders and `sync: false` only). Never open or print any environment-variable file. No git commands that change state. No new dependencies in the app. Do not edit `docs/BUILD_LOG.md`; put the BUILD_LOG text at the end of your report `docs/handoffs/T10a-report.md`.
