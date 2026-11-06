# Lane x-hardening, pass 2: finish Part 0 and then the hardening items, one at a time

Pass 1 did Part 0 in this worktree (see `git diff`: `main.py`, `vision/__init__.py`, `vision/chain.py`, new `backend/tests/test_chain_env.py`) and stopped while waiting for the test suite. Read `docs/briefs/agy-x-hardening.md` for the full task and `docs/reports/audit-backend.md` for the findings. Same rules and allowed files as that brief. Update `docs/reports/agy-x-hardening-report.md` after EVERY step below (tick it off with the real result). The supervisor has a TIME LIMIT: work fast, edit first, and run the full backend test command at most TWICE in total (once after step 1, once at the very end). Do NOT wait for long-running commands to "complete" and then stop: run them and read the result.

## Step 1: make the existing suite pass again (the supervisor ran it: 2 tests FAIL)
- `backend/tests/test_chain_retry.py::test_chain_picks_up_env_retries_when_set` expects the plain `ProviderChain(...)` constructor to read `PROVIDER_RETRIES` from the environment. Part 0 intentionally moved env reading into `build_chain_from_env()`, so rewrite this test to assert the same behaviour through `build_chain_from_env()` (set the env variables with `monkeypatch`, build, assert `retries` and `retry_backoff`), keeping its intent. Do NOT delete it.
- `backend/tests/test_chain_retry.py::test_main_validate_env_settings_retry_warnings` tested warnings that lived in `main.py` and are now emitted by `build_chain_from_env()` / the parse functions. Rewrite it to assert the same warnings (invalid or negative value gives ONE warning and the default) at their new location. Do NOT delete it.
- Ignore formatting and the one fixable lint hint: the supervisor will run `ruff format` and `ruff check --fix` himself. Do not spend time on them.
Then run `backend/.venv/Scripts/python -m pytest backend` ONCE and record the result. It must be all green before you continue.

## Steps 2 to 6: the hardening items from `docs/briefs/agy-x-hardening.md`, in THIS order (each with tests, each reported)
2. SEC-01 concurrency cap (`SCENE_MAX_CONCURRENCY` default 2, `SCENE_QUEUE_WAIT_SECONDS` default 6, HTTP 503 with `Retry-After: 5`).
3. SEC-02 pixel limit 12_000_000 (update the existing tests that assert the old 40 MP boundary, minimal edits, say so).
4. SEC-06 `/api/v1/validate` structural limits (reuse the `/api/v1/ask` scene size check).
5. SEC-07 and SEC-08 and SEC-09 (security headers middleware, docs disabled when `ENVIRONMENT=production`, `ENVIRONMENT: production` and `RATE_LIMIT_VALIDATE_PER_MIN` in `render.yaml`, `docs/DEPLOY.md` updated).
6. SEC-04 EXIF: reproduce with a hand-built JPEG test fixture BEFORE changing code; fix only if real, otherwise change nothing and write the evidence in the report. Skip SEC-03 and mention it as skipped.

## Finish
Run pytest, `ruff check backend` and `ruff format --check backend` once at the end and record the real results (formatting problems are fine to report: the supervisor fixes formatting). The report lists per step what changed and the proving test, and ends with **Commit groups**. If you are running out of time, STOP after the last fully finished step and say clearly which steps are done and which are not: a smaller finished piece is better than a big unfinished one.
