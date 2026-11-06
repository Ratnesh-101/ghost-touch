# Lane x-retry Report: Retry Transient Provider Errors

## Status
Complete

## Overview
Implemented immediate retry on transient provider errors (HTTP 429, 500, 502, 503, 504, high demand/unavailable messages, connection reset, connect timeout) before falling through the vision chain, respecting per-scene deadline and backoff settings.

## Error Classification Table

| Error Category | Example / Trigger | Classified As | Retried on Same Provider? |
| :--- | :--- | :--- | :--- |
| **HTTP 429** | `rate limited (429)` / `status_code=429` | Transient | Yes (up to `PROVIDER_RETRIES`) |
| **HTTP 500** | `server error (500)` / `status_code=500` | Transient | Yes |
| **HTTP 502** | `server error (502)` / `status_code=502` | Transient | Yes |
| **HTTP 503** | `API error (503): High demand` / `status_code=503` | Transient | Yes |
| **HTTP 504** | `504 Gateway Timeout` / `status_code=504` | Transient | Yes |
| **Provider UNAVAILABLE** | `"model UNAVAILABLE"` | Transient | Yes |
| **High demand message** | `"This model is currently experiencing high demand"` | Transient | Yes |
| **Connection reset** | `ConnectionResetError` / `"connection reset by peer"` | Transient | Yes |
| **Connect timeout** | `httpx.ConnectTimeout` / `"connect timeout"` | Transient | Yes |
| **HTTP 400** | `HTTP 400: Bad Request` / `status_code=400` | Non-transient | No (falls through immediately) |
| **HTTP 401** | `authentication failed (401)` / `status_code=401` | Non-transient | No |
| **HTTP 403** | `authentication failed (403)` / `status_code=403` | Non-transient | No |
| **HTTP 404** | `HTTP 404: Not Found` / `status_code=404` | Non-transient | No |
| **Schema / Validation** | `"validation failure"`, `"schema error"` | Non-transient | No |
| **Not configured** | `"API key not configured"` | Non-transient | No |
| **Content filter** | `"content filter refusal: safety policy"` | Non-transient | No |
| **Provider-call timeout** | `"request timed out after 8.0s"` | Non-transient | No (consumed full call budget) |

## Implementation Details
1. **Error Classification (`backend/app/vision/base.py`)**:
   - `VisionError` extended with optional `status_code: int | None = None` and `transient: bool | None = None` attributes while preserving 100% backwards compatibility.
   - Pure function `is_transient(error: Any) -> bool` evaluates explicit flags, status codes (429, 500, 502, 503, 504 vs 400, 401, 403, 404), exception cause types (`ConnectionResetError`, `httpx.ConnectTimeout`), and textual error message markers.

2. **Retry Mechanism (`backend/app/vision/chain.py`)**:
   - `extract()` and `complete()` execute retries up to `retries` times on the same provider when `is_transient(exc)` is true.
   - Strict deadline check: requires `deadline - time.monotonic() >= retry_backoff + min_useful_call_time (3.0s)`; otherwise immediately falls through to next provider.
   - Never reorders or mutates the provider chain.
   - Non-transient errors (401, validation, not configured, etc.) break out immediately to the next provider.
   - Logging outputs one concise line per retry containing the provider NAME and error CLASS only:
     `logger.info("Retrying provider %s after %s", provider.name, exc.__class__.__name__)`

3. **Provider Status Code & Transient Flag Exposing**:
   - `backend/app/vision/gemini.py`: Exposes `status_code=exc.code` on `errors.APIError`; marks `TimeoutError` and unconfigured API keys with `transient=False`.
   - `backend/app/vision/_openai_compat.py`: Passes `status_code` and `transient` on HTTP 429, 401/403, 5xx, `httpx.ConnectTimeout`, and connection reset errors.

4. **Configuration & Environment (`backend/app/main.py`, `render.yaml`, `docs/DEPLOY.md`)**:
   - `PROVIDER_RETRIES` (default 1) and `PROVIDER_RETRY_BACKOFF_SECONDS` (default 0.8) validated at startup in `validate_env_settings()` with warning logs on invalid values.
   - Read in `get_provider_chain()` and passed to the chain instance.
   - Documented in `render.yaml` Blueprint and `docs/DEPLOY.md`.

## Files Touched
- `backend/app/vision/base.py`: Added `status_code` and `transient` attributes to `VisionError`; implemented `is_transient()` classification function.
- `backend/app/vision/chain.py`: Added retry logic with backoff, deadline bounding, safe retry logging, and environment variable parsing (`parse_provider_retries`, `parse_provider_retry_backoff`).
- `backend/app/vision/gemini.py`: Forwarded API error code as `status_code` and explicit `transient=False` on call timeouts and missing keys.
- `backend/app/vision/_openai_compat.py`: Added `status_code` and `transient` mapping on chat responses and network errors.
- `backend/app/main.py`: Validated `PROVIDER_RETRIES` and `PROVIDER_RETRY_BACKOFF_SECONDS` and passed them to cached chain in `get_provider_chain()`.
- `backend/tests/test_chain_retry.py`: 41 unit and integration test cases covering classification, env var parsing, retry execution, non-retry on 401, deadline constraints, multiple transient failures fallback, provider order preservation, and safe logging.
- `render.yaml`: Added `PROVIDER_RETRIES` and `PROVIDER_RETRY_BACKOFF_SECONDS` with explanation comments.
- `docs/DEPLOY.md`: Added documentation for the new retry configuration variables.
- `docs/reports/agy-x-retry-report.md`: This comprehensive lane report.

## Verification Results
- **pytest**:
  Command: `backend/.venv/Scripts/python -m pytest backend`
  Result: **389 passed, 1 skipped, 1 warning in 38.92s**
  (All 348 existing tests pass unchanged + 41 new test cases pass)
- **ruff check**:
  Command: `backend/.venv/Scripts/python -m ruff check backend`
  Result: **All checks passed!**
- **ruff format --check**:
  Command: `backend/.venv/Scripts/python -m ruff format --check backend`
  Result: **53 files already formatted**

## Commit groups
- `feat(vision): classify transient provider errors and add retry with deadline budget`
  - `backend/app/vision/base.py`
  - `backend/app/vision/chain.py`
  - `backend/app/vision/gemini.py`
  - `backend/app/vision/_openai_compat.py`
  - `backend/app/main.py`
- `test(vision): add comprehensive retry and error classification unit tests`
  - `backend/tests/test_chain_retry.py`
- `docs(config): document PROVIDER_RETRIES and backoff in render.yaml and DEPLOY.md`
  - `render.yaml`
  - `docs/DEPLOY.md`
  - `docs/reports/agy-x-retry-report.md`
