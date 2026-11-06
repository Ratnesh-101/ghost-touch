# Lane x-retry: retry transient provider errors before falling through the vision chain

CONTEXT (measured by the supervisor): on 2026-11-06 a live scene request on Render returned Raw Mode with reason "timeout". Locally, Gemini answered HTTP 503 "This model is currently experiencing high demand. Spikes in demand are usually temporary." twice in a row. Such 503 and 429 answers are transient: retrying the SAME provider once, quickly, often succeeds, whereas today the chain immediately moves to the next provider, and when the others are slow or unconfigured the user gets Raw Mode.

DO NOT edit `docs/BUILD_LOG.md` (the supervisor adds one entry). Create your report `docs/reports/agy-x-retry-report.md` FIRST as a short skeleton and update it as you go. Allowed commands: `backend/.venv/Scripts/python -m pytest backend`, `backend/.venv/Scripts/python -m ruff check backend`, `backend/.venv/Scripts/python -m ruff format --check backend`, `git status`, `git diff`. Never open `.env*`.

## Allowed files
`backend/app/vision/chain.py`, `backend/app/vision/base.py` (only if a small error classification helper belongs there), `backend/app/vision/gemini.py`, `backend/app/vision/openai_provider.py`, `backend/app/vision/nebius.py`, `backend/app/vision/_openai_compat.py` (ONLY to expose the HTTP status or a `transient` flag on the raised `VisionError` if it is not already available), `backend/app/main.py` (ONLY to read two new environment variables and pass them to the chain), `backend/tests/test_chain.py` and new `backend/tests/test_chain_retry.py`, `render.yaml` (add the two new variables with their defaults), `docs/DEPLOY.md` (document them), `docs/reports/agy-x-retry-report.md`.

## Forbidden
`backend/app/schema.py`, `backend/app/validate.py`, `backend/app/vision/prompts.py`, `backend/app/raw_mode.py`, the `Kiro`-owned property tests, `.env*`, the frontend.

## Do
1. Read `backend/app/vision/chain.py`, `base.py`, the three providers, `_openai_compat.py` and `backend/tests/test_chain.py` first. Understand how `VisionError` is raised, how `call_timeout` (`PROVIDER_TIMEOUT_SECONDS`, default 8 s) and the total deadline (`SCENE_TIMEOUT_SECONDS`, default 15 s in `main.py`) interact.
2. Classify errors: TRANSIENT = HTTP 429, 500, 502, 503, 504, a provider-side "UNAVAILABLE" or "high demand" message, and a connection reset or connect timeout; NOT transient = 400, 401, 403, 404, a schema or validation failure, "not configured", content-filter refusals, and a provider-call timeout that already consumed the whole per-provider budget. Expose this as a small pure function (`is_transient(error)`) with unit tests for each class.
3. In the chain, after a TRANSIENT failure from a provider, retry that same provider up to `PROVIDER_RETRIES` times (default 1) after `PROVIDER_RETRY_BACKOFF_SECONDS` (default 0.8) ONLY IF enough of the total scene deadline remains for another attempt (at least the backoff plus a minimum useful call time, say 3 s); otherwise fall through to the next provider immediately as today. Never retry a non-transient error. Never exceed the total deadline. Invalid values for the two variables fall back to the defaults with a warning log (follow how `PROVIDER_TIMEOUT_SECONDS` is parsed in `main.py`).
4. Logging: log one short line per retry with the provider NAME and the error CLASS only, never a key, a URL with a key, or the image.
5. Tests with fake providers and a fake clock or tiny backoff (look at how `test_chain.py` builds fakes): a provider that fails once with 503 then succeeds is retried and its answer used; a provider that fails with 401 is NOT retried and the next provider is tried; with `PROVIDER_RETRIES=0` nothing is retried; when the remaining deadline is too small no retry happens; retries are counted against the total deadline; two transient failures then fall through to the next provider; the retry never reorders the provider list.
6. `render.yaml` and `docs/DEPLOY.md`: add `PROVIDER_RETRIES=1` and `PROVIDER_RETRY_BACKOFF_SECONDS=0.8` with a one-line explanation.
7. Run pytest, ruff check and ruff format --check and record the real results (the existing suite must keep passing: it was 348 passed, 1 skipped).

## Done
All three commands pass; the report lists every file, the classification table, and **Commit groups**.
