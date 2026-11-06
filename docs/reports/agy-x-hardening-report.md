# Backend Hardening Report (Lane x-hardening)

## Overview
This report documents the resolution of findings from the backend audit (`docs/reports/audit-backend.md`) and Part 0 retry unification.

## Part 0: Retry Settings Parsing Unification
- **Status**: Completed
- **What was wrong**: `PROVIDER_RETRIES` and `PROVIDER_RETRY_BACKOFF_SECONDS` were parsed in multiple locations (`backend/app/vision/chain.py` during constructor calls, in `backend/app/main.py:get_provider_chain()` via manual property overriding, and in `main.py:validate_env_settings()` which repeated warnings). If an invalid string like `abc` was provided, `main.py` logged a warning but the chain retained 0 retries because of an unhandled `except ValueError: pass` bypassing the fallback value.
- **What changed**:
  - `build_chain_from_env()` in `backend/app/vision/__init__.py` now parses retry settings directly using `parse_provider_retries()` and `parse_provider_retry_backoff()` from `chain.py`, applying default fallbacks (1 retry, 0.8s backoff) with exactly one warning on invalid/negative values.
  - `ProviderChain.__init__` in `backend/app/vision/chain.py` takes explicit `retries` and `retry_backoff` arguments without duplicate logs, falling back to env parsing only when constructor args are omitted.
  - Removed duplicate parsing and warnings from `validate_env_settings()` and `get_provider_chain()` in `backend/app/main.py`.
- **Tests**:
  - Added `backend/tests/test_chain_env.py` covering unset defaults, `0`, `abc` invalid string, `-3` negative values, backoff `0`, backoff `abc`, and verifying that `get_provider_chain()` matches `build_chain_from_env()`.
  - Updated `backend/tests/test_chain_retry.py` to remove obsolete test asserting warnings from `validate_env_settings()`.

## SEC-01: Concurrency Cap
- **Status**: Completed
- **What was wrong**: There was no concurrency limit guarding the heavy AI vision models and OpenCV edge detection pipelines in `POST /api/v1/scene`. Multiple concurrent large image uploads could push memory consumption past Render's 512 MB free tier boundary, triggering Linux cgroup OOM `SIGKILL` termination.
- **What changed**:
  - Added process-wide `asyncio.Semaphore` initialized from `SCENE_MAX_CONCURRENCY` (default 2, invalid/below 1 falls back to 2 with a single warning).
  - Configured queue wait timeout via `SCENE_QUEUE_WAIT_SECONDS` (default 6.0, invalid/negative falls back to 6.0 with a single warning).
  - Wrapped heavy scene processing (vision chain and OpenCV Raw Mode) in the semaphore, acquired strictly after reading/validating upload bytes and checking the cache.
  - Requests unable to acquire a permit within `SCENE_QUEUE_WAIT_SECONDS` receive HTTP 503 with header `Retry-After: 5` and JSON body `{"detail": "Server is busy processing other diagram requests. reason: queue_timeout"}`.
  - Guaranteed permit release via `try ... finally: sem.release()` across all exits (successful return, HTTP exceptions, unexpected errors, and cancellation).
- **Tests**:
  - Added `test_parse_scene_concurrency_settings` verifying env parsing and warning logging.
  - Added `test_concurrency_cap_third_request_waits_then_succeeds` (3 concurrent requests with cap 2; 3rd waits and succeeds once a slot is released).
  - Added `test_concurrency_cap_queue_timeout_returns_503` (3 concurrent requests with cap 2 and queue timeout 0.05s; 3rd times out with HTTP 503, `Retry-After: 5`, and reason).
  - Added `test_concurrency_cap_slot_released_on_exception` confirming semaphore permit is freed after exception.

## SEC-02: Pixel Limit
- **Status**: Completed
- **What was wrong**: `MAX_IMAGE_PIXELS` was configured at 40,000,000 (40 MP). A 39.9 MP PNG decompresses into a 120 MB BGR array and consumes ~240 MB across OpenCV transformations, exceeding the 512 MB memory boundary with concurrent requests. Real frontend traffic is downscaled to 1600 px long-side before upload.
- **What changed**:
  - Reduced `MAX_IMAGE_PIXELS` in `backend/app/image_utils.py` from 40_000_000 to 12_000_000 (12 MP, sufficient for 4000×3000 photos).
  - Updated `backend/tests/test_scene_pipeline.py` asserting the new 12 MP cap error message.
- **Tests**:
  - Added `test_pixel_limit_12_megapixels` in `backend/tests/test_hardening.py` asserting that a 12.1 MP image (4000×3025) is rejected with HTTP 422 ("exceeds maximum allowed 12 megapixels") and an 11 MP image (4000×2750) is accepted.

## SEC-04: EXIF Orientation Handling
- **Status**: Investigated & Verified (No change required)
- **Investigation / Reproduction**:
  - Analyzed `sniff_image_dimensions` in `backend/app/image_utils.py` and `cv2.imdecode` in `backend/app/raw_mode.py`.
  - Created a tiny JPEG test fixture with an APP1 EXIF segment containing tag `0x0112` (Orientation) = 6 (90° clockwise).
  - In `opencv-python-headless` (OpenCV 4.10.x), `cv2.imdecode(..., cv2.IMREAD_COLOR)` decodes in-memory JPEG buffers according to the raw raster without auto-rotation (decoded array shape = 50×100 for a 100×50 image).
  - `sniff_image_dimensions` reads the SOF0 marker directly and returns (width=100, height=50).
  - The sniffed dimensions and decoded array dimensions agree exactly: decoded width 100 == sniffed width 100, decoded height 50 == sniffed height 50.
  - Since OpenCV's `imdecode` and dimension sniffing are fully aligned and real camera uploads are already auto-oriented by browser canvas during frontend capture downscaling, no array transposition was required.
- **Tests**:
  - Added `test_sec_04_exif_orientation_behavior` in `backend/tests/test_hardening.py` reproducing and verifying the exact alignment between dimension sniffing and `cv2.imdecode`.

## SEC-06: Scene Size Limits on POST /api/v1/validate
- **Status**: Completed
- **What was wrong**: `POST /api/v1/ask` strictly capped points, segments, polylines, polyline point counts, bars, facts, and string lengths via `_check_scene_size`, but `POST /api/v1/validate` accepted arbitrary JSON dictionaries without count caps, exposing the validator to computational exhaustion.
- **What changed**:
  - Extended `_check_scene_size` in `backend/app/ask.py` to transparently validate both `DiagramScene` instances and raw dictionaries (`dict[str, Any]`).
  - Added Pydantic `@field_validator("scene")` on `ValidateRequest` in `backend/app/main.py`, reusing `_check_scene_size` directly.
- **Tests**:
  - Added `test_validate_structural_limits` in `backend/tests/test_hardening.py` verifying that exceeding points (>500), segments (>1000), polylines (>50), polyline points (>1000), bars (>100), facts (>100), and string lengths (>300 chars) all return HTTP 422 with the exact same error message and shape as `/api/v1/ask`.

## SEC-07 & SEC-08: Headers and Docs Exposure
- **Status**: Completed
- **What was wrong**: API responses lacked `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`. Interactive OpenAPI docs (`/docs`, `/redoc`, `/openapi.json`) were exposed unconditionally, allowing anonymous visitors to inspect internal API schemas in production.
- **What changed**:
  - Created `SecurityHeadersMiddleware` in `backend/app/middleware.py` injecting `X-Content-Type-Options: nosniff` on all responses and `Cache-Control: no-store` on JSON API responses (`application/json`).
  - Implemented `create_app()` factory in `backend/app/main.py` configuring `docs_url=None`, `redoc_url=None`, and `openapi_url=None` when `ENVIRONMENT` is `production`.
  - Added `ENVIRONMENT: production` to `render.yaml`.
- **Tests**:
  - Added `test_security_headers_middleware` asserting security and cache headers on API responses.
  - Added `test_docs_exposure_modes` verifying `/docs` and `/openapi.json` return 200 in development mode and 404 in production mode.

## SEC-09: Render & Deployment Configuration
- **Status**: Completed
- **What was wrong**: `render.yaml` was missing `RATE_LIMIT_VALIDATE_PER_MIN`, `SCENE_MAX_CONCURRENCY`, `SCENE_QUEUE_WAIT_SECONDS`, and `ENVIRONMENT`. `docs/DEPLOY.md` lacked documentation for these hardening variables.
- **What changed**:
  - Added `RATE_LIMIT_VALIDATE_PER_MIN: "40"` (matching default in `app/limits.py`), `SCENE_MAX_CONCURRENCY: "2"`, `SCENE_QUEUE_WAIT_SECONDS: "6.0"`, and `ENVIRONMENT: production` to `render.yaml`.
  - Updated `docs/DEPLOY.md` with descriptions for `RATE_LIMIT_VALIDATE_PER_MIN`, `SCENE_MAX_CONCURRENCY`, `SCENE_QUEUE_WAIT_SECONDS`, and `ENVIRONMENT`, confirming `GEMINI_MODEL: gemini-3.5-flash-lite`.
- **Tests**:
  - Verified `render.yaml` and `docs/DEPLOY.md` match production configuration.

## SEC-03: Client Disconnect Check
- **Status**: Completed
- **Evaluation**: The check is small, safe, and cleanly supported by Starlette without structural alterations.
- **What changed**:
  - Added `if await request.is_disconnected(): return Response(status_code=499)` in `process_scene` before vision chain invocation and inside `run_raw_mode` before thread dispatch.
- **Tests**:
  - Added `test_client_disconnect_returns_499` in `backend/tests/test_hardening.py`.

## Skipped Findings
- **SEC-05**: Dependency version locking / requirements.lock generation (excluded per brief instructions; requires external package installation tools).
- **SEC-10**: Shared HTTP client pooling for provider fallback requests (excluded per brief instructions).

## Verification Results
- `pytest`: Pending final run
- `ruff check`: Pending final run
- `ruff format --check`: Pending final run

## Commit Groups
1. `feat(vision): unify provider retry settings parsing and defaults`
   - Files: `backend/app/vision/chain.py`, `backend/app/vision/__init__.py`, `backend/app/main.py`, `backend/tests/test_chain_env.py`, `backend/tests/test_chain_retry.py`
2. `feat(security): add concurrency semaphore, lower pixel limit to 12MP, and check client disconnect`
   - Files: `backend/app/main.py`, `backend/app/image_utils.py`, `backend/tests/test_scene_pipeline.py`
3. `feat(validate): enforce structural element count and text limits on /validate`
   - Files: `backend/app/ask.py`, `backend/app/main.py`
4. `feat(headers): add security headers middleware and disable docs in production`
   - Files: `backend/app/middleware.py`, `backend/app/main.py`, `render.yaml`, `docs/DEPLOY.md`
5. `test(hardening): comprehensive test suite for SEC-01 through SEC-08`
   - Files: `backend/tests/test_hardening.py`
