# Antigravity Lane Report: ux11

**Lane:** `ux11` — Classroom-ready limits and basic observability  
**Tool:** Antigravity (`agy`)  
**Date:** 2026-11-17  
**Status:** Complete  

---

## 1. Summary of Changes

This lane delivers classroom-ready concurrency bounds, observability endpoints, rate limit Retry-After accuracy, rate slot refunds on in-flight rejections, smoke check verification, and runbook operational guidance.

1. **Application Logger Configuration (`backend/app/main.py`):**
   - Configured `lifespan` to set `logging.getLogger("app")` to level `INFO`.
   - Attached exactly one `StreamHandler` with the fixed format `"%(asctime)s [%(levelname)s] %(name)s: %(message)s"`.
   - Left `uvicorn` and other framework loggers untouched.

2. **Status Endpoint (`backend/app/main.py`):**
   - Implemented `GET /api/v1/status` returning exact keys `{"commit": str, "ai_available": bool}`.
   - `commit` resolves from `RENDER_GIT_COMMIT` environment variable or `"unknown"` when unset or whitespace.
   - `ai_available` is `True` when vision provider(s) are configured and daily paid call budget is not exhausted; `False` when zero providers are configured or emergency kill switch (`PAID_CALLS_PER_DAY=0`) is active.
   - Rate-limited like `GET /api/v1/health` (lightweight GET endpoint, bypassing POST body/rate limiter).
   - Strict privacy: leaks no provider names, model IDs, API keys, client IPs, or budget tallies.

3. **Rate Limit 429 Header & In-Flight Slot Refund (`backend/app/limits.py`):**
   - Exported `compute_retry_after(oldest_hit, now, window_seconds=60.0) -> int`, calculating the remaining seconds until the oldest hit in the window expires, strictly clamped to `[1, 60]`.
   - Updated `RequestGuardMiddleware._reject` to emit the `Retry-After: <seconds>` HTTP response header on 429 responses.
   - Exported `give_back_rate_slot(client, path)` (with aliases `return_rate_slot`, `refund_rate_slot`).
   - Integrated downstream 429 response interception in `RequestGuardMiddleware.tracking_send`: when a request is rejected downstream by the per-client in-flight concurrency limiter (`HTTPException(429, ...)`), the middleware automatically gives back its deducted rate limit slot, ensuring in-flight saturation does not penalize a client's per-minute rate allowance.

4. **Classroom Concurrency Limits Blueprint (`render.yaml`):**
   - Added `SCENE_CLIENT_MAX_CONCURRENCY: "2"` and `ASK_CLIENT_MAX_CONCURRENCY: "2"` under the classroom-profile comment without altering any existing configuration keys.

5. **Security Runbook Troubleshooting Guidance (`docs/SECURITY_RUNBOOK.md`):**
   - Added Section 7 ("Symptom & Troubleshooting Table") with explicit operational diagnoses and remedies for:
     - **"Busy for a whole class"**: Handling shared NAT IP exhaustion across in-flight caps, rate limits, and queue wait times.
     - **"Outlines only for everyone"**: Diagnosing emergency kill switch (`PAID_CALLS_PER_DAY=0`), daily budget exhaustion, and provider key expiry.
   - Updated Section 5 smoke test command documentation to cover Check 10.

6. **Production Smoke Verification (`scripts/smoke-deployed.mjs`):**
   - Added Check 10: fetches `<api>/api/v1/status` and fails if HTTP status is not 200 or `ai_available` is not `true`.
   - Updated script header documentation to list all 10 checks.

---

## 2. Files Changed

| File | Change |
|---|---|
| `backend/app/main.py` | Configured `app` logger in lifespan; added `GET /api/v1/status` |
| `backend/app/limits.py` | Added `compute_retry_after`, `give_back_rate_slot`, Retry-After 429 header, and in-flight refund in `RequestGuardMiddleware` |
| `render.yaml` | Added `SCENE_CLIENT_MAX_CONCURRENCY` and `ASK_CLIENT_MAX_CONCURRENCY` at `"2"` with classroom comment |
| `docs/SECURITY_RUNBOOK.md` | Added Section 7 Symptom & Troubleshooting Table ("busy for a whole class", "outlines only for everyone") |
| `scripts/smoke-deployed.mjs` | Added Check 10 verifying `GET /api/v1/status` and `ai_available === true` |

---

## 3. Tests Added

### `backend/tests/test_ux11_status.py`
- `test_status_shape_and_leaks_nothing`: asserts exact key set `{"commit", "ai_available"}` and verifies no sensitive keys leak.
- `test_status_commit_from_env_or_unknown`: tests resolution from `RENDER_GIT_COMMIT`, fallback to `"unknown"` when unset or whitespace.
- `test_status_ai_available_false_with_no_provider`: verifies `ai_available` is `False` when provider chain has no configured providers.
- `test_status_ai_available_false_with_kill_switch`: verifies `ai_available` is `False` when `PAID_CALLS_PER_DAY=0`.
- `test_status_ai_available_true_when_healthy`: verifies `ai_available` is `True` under normal operating conditions.
- `test_status_rate_limited_like_health`: verifies rapid GET requests succeed without rate-limiting.
- `test_info_line_emitted_for_processed_scene`: verifies lifespan logger setup and captures `scene processed:` INFO log via `caplog`.

### `backend/tests/test_ux11_limits.py`
- `test_compute_retry_after_clamping`: verifies calculation and strict clamping to `[1, 60]` across boundary conditions.
- `test_rate_limit_429_has_retry_after_between_1_and_60`: verifies that a rate limit 429 response carries a valid `Retry-After` header.
- `test_give_back_rate_slot_unit`: unit test verifying `give_back_rate_slot` decrements the newest hit.
- `test_middleware_refunds_rate_slot_on_downstream_429`: verifies middleware refunds rate slot when downstream returns 429.
- `test_rejected_by_in_flight_does_not_reduce_remaining_rate_allowance`: end-to-end test proving in-flight rejected requests do not penalize per-minute rate allowance.

---

## 4. What Could Not Be Verified

- **Live Render / Vercel cloud deployment:** Verified locally in source code and unit test coverage; production deployment requires owner credentials and dashboard actions.
- **Headless shell command execution:** Per UX rules (`"Do NOT run any shell command. No npm, npx, node, python, pytest, ruff, git, curl. The orchestrator runs all gates."`), test suites and linting are deferred to the orchestrator. All code adheres strictly to Python type hints, Pydantic schemas, and project standards.

---

## 5. Follow-Up Pass 1 Gate Fixes

1. **Ruff Linter Cleanliness (`backend/tests/test_ux11_limits.py`):**
   - Removed unused imports `RATE_WINDOW_SECONDS`, `get_scene_in_flight_limiter`, and `TestClient` (F401).
   - Sorted remaining imports cleanly according to isort (I001).

2. **Integration Test Environment Isolation (`backend/tests/test_ux11_limits.py`):**
   - In `test_rejected_by_in_flight_does_not_reduce_remaining_rate_allowance`: replaced import-time singleton `app` with `test_app = create_app()`. This ensures the monkeypatched `RATE_LIMIT_SCENE_PER_MIN="2"` is dynamically evaluated by `default_rate_limits()` and configured on `test_app`'s `RequestGuardMiddleware`, so that the 4th request triggers the per-minute rate limit (429) as designed, resolving the `assert 200 == 429` failure without weakening any test assertions.

---

## 6. Follow-Up Pass 2 Gate Fixes

1. **Ruff Import Sorting (`backend/tests/test_ux11_limits.py`):**
   - Corrected isort ordering within `from app.limits import (...)` by placing `_HITS` ahead of `RequestGuardMiddleware` per Ruff `I001`.
   - Maintained headless run boundaries: zero shell commands executed, zero edits to other lanes' files (e.g. `test_hx3_ask_injection.py`), and zero weakening of test coverage or assertions.


