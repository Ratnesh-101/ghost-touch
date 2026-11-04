# Lane A: Deploy prep (T10b), config + docs only
## Goal
Make the backend (Render) and frontend (Vercel) deployable by the owner in a few clicks, and prove the config is consistent.
## Allowed files
render.yaml, frontend/vercel.json, docs/DEPLOY.md, backend/.env.example, frontend/.env.example, backend/app/main.py ONLY for CORS/health/startup-log tweaks (and backend/tests/test_health.py + a new backend/tests/test_cors.py), docs/reports/agy-deploy-report.md
## Forbidden
everything else (frontend/src, other backend/app files, .kiro, property tests, schema/validate).
## Do
1. Audit render.yaml vs the env vars the backend really reads (grep os.environ in backend/app): every var present, secrets `sync: false`, no stale ones (NVIDIA was removed; chain is gemini,openai,nebius). Fix drift.
2. Verify CORS: ALLOWED_ORIGINS parsing handles comma lists, trailing slashes and whitespace; add example tests for it (preflight from allowed and disallowed origin). Health endpoint returns {"ok": true}.
3. Check frontend/vercel.json: SPA rewrite so hash routes and reloads work, service-worker and manifest headers sane, no rewrite swallowing /samples or /assets.
4. Rewrite docs/DEPLOY.md as a numbered owner checklist (accounts, which secrets to paste where, the exact order Render -> Vercel -> set ALLOWED_ORIGINS and VITE_API_URL -> redeploy -> smoke test with curl commands and a phone checklist incl. TalkBack, cold-start warning for Render free tier). Put the owner-only steps under a heading "You must do these yourself".
5. Update both .env.example files so they list every variable with safe placeholders.
## Done
backend: python -m pytest backend, ruff check backend, ruff format --check backend all pass. Report lists files touched and every owner-only step.
Shared rules: read AGENTS.md first. Never edit Kiro-owned files: frontend/src/core/**, any *.prop.test.ts or test_*_props.py, backend/app/schema.py, backend/app/validate.py, frontend/src/types/scene.gen.ts, .kiro/**. Do NOT change the tuned haptic values or the haptic engine (public interface only). No git state changes, no installs, no .env access, no new dependencies. Example-based tests only (property tests belong to Kiro). Every user-facing string through t(). Browser APIs only in frontend/src/drivers/. Run the DoD commands from the allowed list and record real results, including failures. Write your report last.
