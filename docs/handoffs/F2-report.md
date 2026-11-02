# F2 Report — Backend Review Fixes (T08 & T09a Pipeline Hardening)

**Builder:** Antigravity (agy)  
**Reviewer:** Claude Code (Kiro paused)  
**Source Brief:** `docs/briefs/F2-backend-review-fixes.md`  
**Review Fixed:** `docs/reviews/T08-review.md`  
**Date:** 2026-11-01  

---

## 1. Summary of Changes & Fixes

Followed `AGENTS.md` and user instructions strictly:
- **Backend Only**: Owned and touched `backend/**` only. Never touched `frontend/`, `research/`, or `docs/reviews/`.
- **Kiro Ownership Preserved**: Never touched `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/core/**`, `*.prop.test.ts`, `backend/tests/test_*_props.py`, `frontend/src/types/scene.gen.ts`, or `.kiro/**`.
- **Read-only Git**: Zero state-changing git commands executed (`git status`, `git diff`, `git log` only).
- **Secrets & Environment**: Did not open, search, or print any real `.env` file; only modified the committed template `backend/.env.example`.
- **Zero Real External API Calls**: In accordance with the prompt rules and DoD constraints, no live external APIs were invoked; all tests use mocked/fake clients or recorded unit tests.

### Implementation Details by Finding

1. **Gemini Thinking Configuration (Finding 2, Highest Priority)**:
   - Updated `GeminiProvider` (`backend/app/vision/gemini.py`) to support `GEMINI_THINKING` accepting `off` (`thinking_budget=0`), levels (`minimal`, `low`, `medium`, `high` mapping to `types.ThinkingLevel`), and `default` (`None`, omitting thinking config).
   - Default setting: `minimal` (`types.ThinkingLevel.MINIMAL`), preventing latency overshoots on newer Gemini models (3.8-flash).
   - Maintained `GEMINI_THINKING_BUDGET` as a backward-compatible deprecated alias (e.g., `0` maps to `off`, positive integer to budget).
   - Added automatic fallback and single retry: if Gemini returns an invalid argument error mentioning `thinking`, it logs a warning, retries **once** without any thinking config, and remembers `_process_disable_thinking = True` for the lifetime of the process so subsequent calls avoid repeating the failure.
   - Guarded against malformed settings: an invalid `GEMINI_THINKING` string logs a clear warning and falls back to `minimal`, never throwing a 500.

2. **Hostile Images & Header Sniffing (Finding 3)**:
   - Added `backend/app/image_utils.py` with pure-Python header sniffers (`sniff_image_format`, `sniff_image_dimensions`, `validate_image_bytes`) for JPEG, PNG, and WebP:
     - Verifies actual magic bytes (`\x89PNG\r\n\x1a\n`, `\xff\xd8\xff`, `RIFF...WEBP`) and compares against declared MIME type. Mismatches or non-images reject with HTTP 415.
     - Parses image dimensions directly from header chunks (PNG `IHDR`, JPEG `SOF`, WebP `VP8`/`VP8L`/`VP8X`) without decoding pixel buffers. Corrupt or truncated headers reject with HTTP 422.
     - Enforces a 40 megapixel limit (`MAX_IMAGE_PIXELS = 40_000_000`): rejection occurs before passing bytes to OpenCV or paid providers.
   - Enforced pixel caps in `backend/app/raw_mode.py` and `backend/app/vision/nvidia.py:fit_image_for_inline`.

3. **Event Loop Non-Blocking Execution & Total Deadline (Finding 4)**:
   - Wrapped `build_raw_scene` with `await asyncio.to_thread(build_raw_scene, image_bytes)` in `backend/app/main.py`.
   - Wrapped `fit_image_for_inline` with `await asyncio.to_thread(fit_image_for_inline, image, self.inline_limit)` in `backend/app/vision/nvidia.py`.
   - Structured deadline partitioning: `total_deadline = 15.0s` (`SCENE_TIMEOUT_SECONDS`). Set aside `RAW_MODE_RESERVE_SECONDS = 2.5s` for Raw Mode fallback. If the AI provider times out or fails, Raw Mode executes in the remaining total deadline budget via `asyncio.wait_for`.

4. **Raw Mode Scene Rejected by Validator or Blank Photo (Finding 5)**:
   - In `backend/app/main.py`:
     - If Raw Mode detects zero drawable elements (e.g., blank or solid-color image), returns HTTP 422 with spoken message: `"No diagram outlines detected in image. Please take a clearer photo."`
     - If the validator rejects the Raw Mode scene (`val_result.scene is None`), returns HTTP 422: `"Extracted outline could not be validated: ... Please upload a clearer photo."` Never returns an unchecked scene object.

5. **`backend/.env.example` Defaults (Finding 6)**:
   - Updated `backend/.env.example` with `GEMINI_MODEL=gemini-3.8-flash`, `GEMINI_THINKING=minimal`, `VISION_PROVIDERS=gemini,nvidia`, `PROVIDER_TIMEOUT_SECONDS=8.0`, `SCENE_TIMEOUT_SECONDS=15.0`, and commented sensible defaults for `NVIDIA_*`.
   - In `backend/app/vision/__init__.py`, treated empty or unset `VISION_PROVIDERS` as `"gemini,nvidia"`.

6. **Startup Validation & Cached Provider Chain (Finding 7)**:
   - In `backend/app/main.py`, added `validate_env_settings()` to lifespan startup, logging clear warnings if `SCENE_TIMEOUT_SECONDS`, `PROVIDER_TIMEOUT_SECONDS`, or `ASK_TIMEOUT_SECONDS` contain malformed numeric strings.
   - Implemented cached provider chain via `_cached_chain` in `get_provider_chain()`, constructing clients once per process rather than per-request, while remaining overridable in tests via `app.dependency_overrides`.

7. **Upload Streaming Size Check (Finding 8)**:
   - In `backend/app/main.py`, checked `Content-Length` header first (returning HTTP 413 if > 10 MB).
   - Read image stream in 64 KB chunks up to `MAX_UPLOAD_SIZE = 10 * 1024 * 1024` bytes, aborting with HTTP 413 before fully buffering oversize uploads into memory.

8. **Low Findings Addressed (Findings 9, 10, 11, 12, 13, 14)**:
   - **Finding 9**: Wrapped response JSON parsing in `GeminiProvider` and `NvidiaProvider` (`extract` and `complete`), raising `VisionError` on unexpected payload structures or non-string/missing content.
   - **Finding 10**: In `raw_mode.py`, added `_dedupe_segments` to eliminate twin contour traces on thin lines, and merged nearby endpoints (within tolerance) to produce shared vertices for tactile corner haptics.
   - **Finding 11**: In `backend/app/vision/prompts.py:build_prompt`, capped retry validation error lines to 5 lines and 150 characters each. In `backend/app/main.py`, set response header `X-Vision-Provider` to `"none"` whenever `mode` is `"raw"`.
   - **Finding 12**: Added `expose_headers=["X-Vision-Provider"]` to CORSMiddleware in `backend/app/main.py`.
   - **Finding 13**: Updated `fit_image_for_inline` to raise `VisionError` if the image exceeds pixel caps, while returning undecodable bytes as-is for downstream error handling.
   - **Finding 14**: Added comprehensive tests for all new behaviors across `test_scene_pipeline.py`, `test_gemini_provider.py`, and `test_raw_mode.py`.

---

## 2. Unmeasured DoD Items (DoD 1)

As instructed by the brief and hard safety rules:
- **No Real Paid/External API Calls**: No real Gemini or NVIDIA endpoints were contacted during this task. All test cases use mocked SDK clients, `httpx.MockTransport`, or `FakeProvider`.
- **Unmeasured Real-World Benchmarks**:
  - Real-photo latency under `gemini-3.8-flash` with thinking level `minimal` against real camera photos.
  - End-to-end network latency over physical cellular/mobile links.
  - Live clutter photo extraction against real paper diagrams.

---

## 3. Verification & Proof of DoD

All verification commands executed from `backend/`:

### A. Pytest Suite
```
backend/.venv/Scripts/python -m pytest
======================= 179 passed, 1 warning in 25.75s =======================
```
*(1 warning is standard Starlette testclient httpx deprecation).*

### B. Ruff Lint
```
backend/.venv/Scripts/python -m ruff check .
All checks passed!
```

### C. Ruff Format
```
backend/.venv/Scripts/python -m ruff format --check .
35 files already formatted
```

---

## 4. Files Touched

- `backend/.env.example` (updated defaults, model names, and thinking setting)
- `backend/app/image_utils.py` (created image header inspection and dimension capping utility)
- `backend/app/main.py` (chunked streaming, lifespan settings validation, thread offloading, Raw Mode error handling, CORS headers)
- `backend/app/raw_mode.py` (segment deduplication, vertex merging, pixel limit check)
- `backend/app/vision/__init__.py` (default provider parsing, defensive timeout parsing)
- `backend/app/vision/gemini.py` (thinking config support, process-level retry memory, safe response parsing)
- `backend/app/vision/nvidia.py` (thread-safe inline image fitting, malformed JSON handling, pixel limit check)
- `backend/app/vision/prompts.py` (capped validation error feedback length)
- `backend/tests/test_gemini_provider.py` (added tests for thinking levels, retry on rejection, deprecated budget alias)
- `backend/tests/test_raw_mode.py` (updated assertions for merged vertices)
- `backend/tests/test_scene_pipeline.py` (added tests for hostile images, blank photo, rejecting validator, CORS exposure, provider retry)

---

## 5. Suggested BUILD_LOG Entry

```markdown
### 2026-11-01 — Task F2: Backend Review Fixes & Hardening (Antigravity)
- **Built:**
  - Robust Gemini thinking configuration supporting `GEMINI_THINKING` (`off`, `minimal`, `low`, `medium`, `high`, `default`) with automatic single retry and process-level memory on thinking rejection. Deprecated alias `GEMINI_THINKING_BUDGET` maintained.
  - Non-decoding image header inspection (`image_utils.py`) sniffing magic bytes (JPEG/PNG/WebP), dimension bounds, and capping resolution at 40 megapixels before OpenCV or external provider calls.
  - Streaming upload size enforcement (rejecting >10 MB before buffering entire body in memory).
  - Offloaded OpenCV image decoding, Raw Mode processing, and NVIDIA image fitting to worker threads (`asyncio.to_thread`).
  - Partitioned 15s deadline reserving time for Raw Mode fallback so pipeline never stalls event loop.
  - Rejecting validator and blank image handling returning explicit spoken HTTP 422 errors instead of unchecked raw scene objects.
  - Raw Mode segment deduplication and nearby vertex merging for tactile corner haptics.
  - Capped prompt retry validation errors; exposed `X-Vision-Provider` header in CORS and ensured it reports `none` for Raw Mode.
  - Lifespan startup validation for numeric settings and cached provider chain instantiation.
  - 12 new test cases covering hostile inputs, thinking settings, retry behavior, and CORS headers (179 tests passing).
- **Broke:** None. All 179 backend tests passing; `ruff check` and `ruff format` clean.
- **Files touched:**
  - `backend/.env.example`
  - `backend/app/image_utils.py`
  - `backend/app/main.py`
  - `backend/app/raw_mode.py`
  - `backend/app/vision/__init__.py`
  - `backend/app/vision/gemini.py`
  - `backend/app/vision/nvidia.py`
  - `backend/app/vision/prompts.py`
  - `backend/tests/test_gemini_provider.py`
  - `backend/tests/test_raw_mode.py`
  - `backend/tests/test_scene_pipeline.py`
```
