# Lane x-config: make render.yaml match production, and parse the retry settings in ONE place

DO NOT edit `docs/BUILD_LOG.md`. Create your report `docs/reports/agy-x-config-report.md` FIRST as a short skeleton and update it as you go. Allowed commands: `backend/.venv/Scripts/python -m pytest backend`, `backend/.venv/Scripts/python -m ruff check backend`, `backend/.venv/Scripts/python -m ruff format --check backend`, `git status`, `git diff`. Run all three backend commands at the end and record the real results. Never open `.env*`.

## Part 1: render.yaml and DEPLOY.md must match what production should use
`render.yaml` still holds old defaults. If the Render service was created from the Blueprint, a sync would overwrite the owner's dashboard values with these. Update ONLY these entries in `render.yaml` (keep every other entry, comments and ordering):
- `VISION_PROVIDERS` -> `openai,gemini,nebius` (OpenAI answered in about 4 s reliably; Gemini returned HTTP 503 "high demand" during testing)
- `PROVIDER_TIMEOUT_SECONDS` -> `"12.0"`
- `SCENE_TIMEOUT_SECONDS` -> `"25.0"`
- `ALLOWED_ORIGINS` -> `https://ghost-touch-iota.vercel.app` (it currently holds the placeholder `https://your-frontend-app.vercel.app`)
Update `docs/DEPLOY.md` so every value it lists for those variables matches (also fix any sentence that says Gemini is tried first, and the order of fallback comments in `render.yaml`). Do not change the code defaults in Python (`DEFAULT_PROVIDER_ORDER` stays as it is: tests assert it).

## Part 2: unify the retry settings parsing (a small bug and duplication)
`PROVIDER_RETRIES` and `PROVIDER_RETRY_BACKOFF_SECONDS` are parsed twice: in `backend/app/vision/chain.py` (`parse_provider_retries`, `parse_provider_retry_backoff`, used when the chain is constructed) and again in `backend/app/main.py` (where the cached chain gets `chain.retries = ...` and the startup validation logs). Known defect: with an INVALID value (for example `abc`), `main.py` logs "using default 1" but the chain keeps 0 retries, because the `except ValueError: pass` leaves the constructor default. Fix it:
1. Make `build_chain_from_env()` in `backend/app/vision/__init__.py` (or the single place that builds the chain from the environment) apply the settings through the existing parse functions in `chain.py`, so that: variable unset -> retries 1 and backoff 0.8; valid value -> that value; invalid or negative value -> the default (1 and 0.8) with ONE warning log. Keep the plain `ProviderChain(...)` constructor behaviour used by existing tests (it must keep working with explicit arguments and not read the environment unexpectedly: read `backend/tests/test_chain.py` and `test_chain_retry.py` before changing it).
2. Delete the duplicated parsing and the duplicated startup warnings from `main.py` (keep the startup validation for the OTHER variables exactly as it is), so the behaviour lives in one place.
3. Add tests (in a new `backend/tests/test_chain_env.py`): unset gives 1 and 0.8; `PROVIDER_RETRIES=0` gives 0; `PROVIDER_RETRIES=abc` gives 1 (the bug); `PROVIDER_RETRIES=-3` gives 1; `PROVIDER_RETRY_BACKOFF_SECONDS=abc` gives 0.8; `PROVIDER_RETRY_BACKOFF_SECONDS=0` gives 0; the cached chain used by the app has the same values.

## Allowed files
`render.yaml`, `docs/DEPLOY.md`, `backend/app/vision/__init__.py`, `backend/app/vision/chain.py`, `backend/app/main.py`, `backend/tests/test_chain.py`, `backend/tests/test_chain_retry.py`, new `backend/tests/test_chain_env.py`, `docs/reports/agy-x-config-report.md`.

## Forbidden
`backend/app/schema.py`, `backend/app/validate.py`, `backend/app/vision/prompts.py`, the Kiro-owned property tests, the frontend, `.env*`.

## Done
pytest, ruff check and ruff format --check all pass; the existing tests keep passing unchanged (do not weaken or delete any). The report lists every changed value in `render.yaml` (before and after), the behaviour table for the retry variables, and **Commit groups**.
