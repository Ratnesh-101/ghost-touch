# Lane k4-scene-pipeline Report: Backend Scene Pipeline Fixes

Status: DONE
Lane: k4-scene-pipeline
Auditor & Implementer: Antigravity (agy, reviewed by Claude)
Date: 2026-11-09

## Executive Summary
This report documents backend scene pipeline fixes specified in
`docs/briefs/agy-k4-scene-pipeline.md` and subsequent follow-up fixes resolving findings
B2-01 through B2-04, B2-07 through B2-09, F13, F14, and F16 across `backend/app/main.py`,
`backend/app/raw_mode.py`, `backend/app/image_utils.py`, and
`backend/app/vision/openai_provider.py`.
All changes strictly adhere to the allowed file scope, preserve line length limits (<= 100
columns) and ruff formatting standards, and include fast, deterministic regression test
coverage in `backend/tests/test_k4_scene_pipeline.py`.

---

## Findings Status Matrix

| ID | Sev | Status | Module & Line Reference | Summary |
|---|---|---|---|---|
| **B2-01** | HIGH | FIXED | `main.py:821-837` | AI timeout uses absolute remaining deadline. |
| **B2-02** | HIGH | FIXED | `main.py:825-877` | Disconnect poll aborts AI call and frees permits. |
| **B2-03** | HIGH | FIXED | `raw_mode.py:119-244` | OpenCV cv2.error mapped to 422, not 500. |
| **B2-04** | HIGH | FIXED | `raw_mode.py:72-130` | EXIF orientation applied before raw downscaling. |
| **B2-07** | MED | FIXED | `main.py:327-350` | Improve pass preserves equation graphs. |
| **B2-08** | MED | FIXED | `main.py:849-857` | Fast provider error returns provider_error. |
| **B2-09** | MED | FIXED | `openai_provider.py` | OpenAIProvider downscales inline <= 1.5 MB. |
| **F14** | LOW | FIXED | `main.py:860-877` | Handler cancellation cleanly re-raised. |
| **F16** | LOW | FIXED | `image_utils.py:230` | Error responses use clean generic messages. |

---

## Follow-up Fixes: Failing Tests and Ruff E501 Resolution

### 1. Ruff E501 at `backend/app/raw_mode.py:158`
- **Issue:** Line 158 exceeded 100 columns (102 > 100).
- **Fix:** Split comment across two lines so all lines are <= 100 columns.

### 2. Existing Test: `test_pipeline_all_providers_fail_returns_raw_mode`
- **Decision:** Code bug in `backend/app/main.py`.
- **Root Cause:** In the initial B2-01 fix, `except VisionError as exc:` matched `"timeout"`
  inside `exc.reason.lower()`. In `test_pipeline_all_providers_fail_returns_raw_mode`,
  `FakeProvider("openai", [VisionError("openai", "timeout")])` carried the string `"timeout"`,
  causing `main.py` to classify a rapid provider failure (<1ms) as `fallback_reason = "timeout"`.
- **Fix:** Updated `process_scene` in `backend/app/main.py`:
  A `VisionError` is classified as `timeout` ONLY if `time.monotonic() >= ai_deadline` or
  `"deadline reached" in reason_lower` (the chain-level deadline marker). If providers fail
  quickly before the deadline, `fallback_reason = "provider_error"` is preserved.

### 3. Test: `test_b2_02_client_disconnect_cancels_vision_call_and_frees_slot`
- **Decision:** Test environment and latency issue.
- **Root Cause:** The test used `@pytest.mark.asyncio`, which is unsupported in the repo's
  pytest environment (missing `pytest-asyncio` plugin). In addition, default 0.25s polling
  introduced test latency, and `request.client` as a plain tuple lacked `.host`, resulting in
  `"unknown"` client key resolution during permit cleanup assertions.
- **Fix:** Converted test to standard synchronous `def test_...` running `asyncio.run(_run())`.
  Monkeypatched `ASK_DISCONNECT_POLL_SECONDS = 0.01` for deterministic, sub-20ms execution.
  Provided `MockAddress(host="10.0.0.99")` and verified that both `_scene_semaphore` and
  `ClientInFlightLimiter` permits are restored to full capacity.

### 4. Code & Test: `test_b2_04_exif_orientation_applied_before_raw_mode`
- **Decision:** Code bug in `backend/app/raw_mode.py`.
- **Root Cause:** In OpenCV 4, `cv2.imdecode(..., cv2.IMREAD_COLOR)` automatically inspects
  EXIF APP1 tags and rotates JPEG buffers on decode. Subsequent execution of
  `apply_exif_orientation` rotated the buffer a second time (90 + 90 = 180 degrees), turning
  the image back to horizontal. Thus, `y_span = 0.7333` and `x_span = 0.92`, causing
  `assert 0.7333 > 0.92` to fail.
- **Fix:** Decoded raw image buffer with `cv2.IMREAD_COLOR | cv2.IMREAD_IGNORE_ORIENTATION` in
  `backend/app/raw_mode.py`. This ensures OpenCV performs raw pixel decoding without implicit
  rotation, allowing `apply_exif_orientation` to be the sole, authoritative orientation transform
  applied strictly before the 1600 px downscaling and edge detection stages.
  The assertion `assert y_span > x_span` now succeeds deterministically.

### 5. Test: `test_b2_07_f13_improve_pass_does_not_overwrite_equation_graph`
- **Decision:** Test framework issue.
- **Root Cause:** Test used `@pytest.mark.asyncio` which was unawaited in the absence of
  `pytest-asyncio`.
- **Fix:** Converted to synchronous `def test_...` executing `asyncio.run(_run())`. Confirmed
  that `_run_improve_pass_locked` in `backend/app/main.py` checks existing cache entries and
  newly generated scenes to prevent replacing equation graphs with crude polylines.

### 6. Test: `test_b2_09_openai_provider_downscales_large_image`
- **Decision:** Test issue (precondition byte size and downscale dimension assertions).
- **Root Cause:** A 400x400 synthetic gradient image compressed to only ~2.8 KB as PNG,
  failing the precondition assertion `assert len(png_bytes) > 20_000` (`assert 2864 > 20000`).
  In addition, dimensions were below the provider's inline limit (1024 px).
- **Fix:** Updated `test_b2_09_openai_provider_downscales_large_image`:
  1. Generated a 3000x3000 seeded random RGB image (`np.random.default_rng(42)`) encoded as
     high-quality JPEG (quality 90, ~6.5 MB), guaranteeing `len(image_bytes) > 20_000` and
     `len(image_bytes) > provider.inline_limit`.
  2. Executed `OpenAIProvider.extract` with lowered `inline_limit = 20_000`.
  3. Asserted both payload byte size downscaling (`len(fitted_bytes) <= provider.inline_limit`
     and `len(fitted_bytes) < len(image_bytes)`) and dimension downscaling (decoded fitted image
     has `max(h, w) <= 1024` and `max(h, w) <= 1600`, down from 3000x3000).
  4. Test executes synchronously via `asyncio.run(_run())` deterministically in <0.2 seconds.

### 7. Code & Test: `test_f14_cancellation_aimed_at_handler_is_reraised`
- **Decision:** Both code bug in `backend/app/main.py` and test framework issue.
- **Root Cause:**
  1. In Python `asyncio`, calling `asyncio.current_task().cancelled()` inside an executing task's
     coroutine evaluates to `False` (a task's status is "cancelling", and becomes "cancelled"
     only after completion). The check in `main.py` swallowed cancellations aimed at the handler,
     causing `process_scene` to fall back into raw mode and return HTTP 200 instead of re-raising.
  2. The test used `@pytest.mark.asyncio`.
- **Fix:** Updated `process_scene` and `ask_question_route` in `backend/app/main.py` to record
  `handler_cancelled = True` when `except asyncio.CancelledError:` catches a handler cancellation,
  and re-raise `asyncio.CancelledError()` in `finally` (also checking `.cancelling() > 0` where
  supported). Converted test to synchronous `asyncio.run(_run())` and verified that both the
  global semaphore and client in-flight permit are cleanly released.

---

## Detailed Findings Analysis and Fixes

### B2-01: Absolute Remaining Deadline Calculation
- **Re-verification in Current Code:** Confirmed. In `main.py`, `ai_budget` was calculated from
  `total_deadline - RAW_MODE_RESERVE_SECONDS` (12.5s) and passed into `asyncio.timeout(ai_budget)`.
  Because `asyncio.timeout` is relative to execution start, time spent waiting for
  `_scene_semaphore` and streaming multipart chunks pushed the timeout past
  `SCENE_TIMEOUT_SECONDS` (15s total budget), resulting in starved raw mode fallback budgets and
  premature 504 Gateway Timeouts.
- **Fix:** Computed absolute deadline `ai_deadline = start_time + ai_budget`. In `process_scene`,
  dynamically calculated `remaining = ai_deadline - now`. If `remaining <= 0`, AI extraction is
  skipped immediately with `fallback_reason = "timeout"`, and `asyncio.wait` polling uses
  `min(ASK_DISCONNECT_POLL_SECONDS, remaining)`.
- **Regression Test:** `test_b2_01_ai_timeout_uses_absolute_deadline_without_overrun` validates
  that when provider is slow, timeout triggers against configured `SCENE_TIMEOUT_SECONDS` without
  waiting for provider completion.

### B2-02: Client Disconnect Watcher During In-Flight Scene Model Call
- **Re-verification in Current Code:** Confirmed. `POST /api/v1/scene` only checked
  `request.is_disconnected()` before vision processing and before raw mode. If a client
  disconnected while Gemini or OpenAI was computing, the model call ran to completion, wasting
  paid tokens and holding the 2-slot `_scene_semaphore` and per-client in-flight limiter permit.
- **Fix:** Wrapped `attempt_ai()` inside an `asyncio.create_task` with a cooperative polling loop
  matching `POST /api/v1/ask`. Polling every `ASK_DISCONNECT_POLL_SECONDS` (0.25s) checks
  `await request.is_disconnected()`. On disconnect, cancels the worker task and returns
  `Response(status_code=499)`. The outer `finally` block of `process_scene` guarantees immediate
  release of `scene_in_flight` and `sem`.
- **Regression Test:** `test_b2_02_client_disconnect_cancels_vision_call_and_frees_slot` tests mock
  disconnecting request, verifying HTTP 499, task cancellation, and slot/permit release back to
  capacity.

### B2-03: OpenCV Internal Error Handling (`cv2.error`)
- **Re-verification in Current Code:** Confirmed. In `raw_mode.py`, operations including
  `cv2.GaussianBlur`, `cv2.Canny`, and `cv2.findContours` did not catch `cv2.error`. On malformed
  or extreme aspect ratio inputs, OpenCV assertion failures bubbled out of `run_raw_mode` and
  raised HTTP 500 Internal Server Error.
- **Fix:** Wrapped all OpenCV processing in `build_raw_scene` with
  `try ... except cv2.error as exc: raise RawModeError(f"OpenCV processing error: {exc}") from exc`.
  In `main.py`, caught `(RawModeError, cv2.error)` and mapped to clean HTTP 422 ("Could not
  process image. Please upload a clear diagram photo.").
- **Regression Test:** `test_b2_03_cv2_error_becomes_clean_422_not_500` monkeypatches
  GaussianBlur to raise `cv2.error` and asserts `RawModeError` from `build_raw_scene` and HTTP 422
  from `POST /api/v1/scene`.

### B2-04: EXIF Orientation in Raw Mode
- **Re-verification in Current Code:** Confirmed. Phone camera portrait photos carrying EXIF
  orientation 6 (90 CW) require rotation before contour extraction.
- **Fix:** Added `get_exif_orientation` in `image_utils.py` and `apply_exif_orientation` in
  `raw_mode.py`. Decoded buffer with `cv2.IMREAD_COLOR | cv2.IMREAD_IGNORE_ORIENTATION` and
  applied `apply_exif_orientation` before downscaling, grayscale conversion, and edge detection.
  Fixed APP1 segment loop to preserve parsed orientation across multiple APP1 segments (B2-11).
- **Regression Test:** `test_b2_04_exif_orientation_applied_before_raw_mode`,
  `test_b2_04_dual_app1_orientation_not_overwritten`, and
  `test_b2_04_apply_exif_orientation_all_tags`.

### B2-07 / F13: Function Graph Equation Route Preservation
- **Re-verification in Current Code:** Confirmed. Background improve pass could overwrite
  equation-route function graphs with crude polylines.
- **Fix:** In `_run_improve_pass_locked`, inspected existing cache entry and candidate scene; if
  either is `function_graph`, cache overwrite is skipped to preserve the analytic curve.
- **Regression Test:** `test_b2_07_f13_improve_pass_does_not_overwrite_equation_graph`.

### B2-08: Vision Provider Timeout Classification
- **Re-verification in Current Code:** Confirmed. Fast provider failures must return
  `provider_error`, while real deadline overruns return `timeout`.
- **Fix:** Classify as `timeout` only when `time.monotonic() >= ai_deadline` or when
  `"deadline reached"` appears in the error reason.
- **Regression Test:** `test_b2_08_provider_timeout_sets_reason_timeout`,
  `test_b2_08_deadline_reached_sets_reason_timeout`, and
  `test_b2_08_provider_error_quick_failure_sets_reason_provider_error`.

### B2-09: OpenAI Provider Image Downscaling
- **Re-verification in Current Code:** Confirmed. Large uploads generated base64 payloads >14 MB,
  risking upload timeouts.
- **Fix:** Added `fit_image_for_inline` call in worker thread (`asyncio.to_thread`) before base64
  encoding in `OpenAIProvider.extract`, enforcing `INLINE_LIMIT = 1_500_000` bytes.
- **Regression Test:** `test_b2_09_openai_provider_downscales_large_image`.

### F14: Re-Raise Cancellation Aimed at Handler
- **Re-verification in Current Code:** Confirmed. Cancellations aimed at request handler must
  propagate cleanly rather than being swallowed.
- **Fix:** Tracked `handler_cancelled = True` and re-raised `asyncio.CancelledError` in `finally`.
- **Regression Test:** `test_f14_cancellation_aimed_at_handler_is_reraised`.

### F16: Generic Error Messages
- **Re-verification in Current Code:** Confirmed. Error responses must not echo unvalidated input
  or internal server details.
- **Fix:** Sanitized 415, 422, and `/validate` error responses.
- **Regression Test:** `test_f16_validate_image_bytes_does_not_echo_raw_mime` and
  `test_f16_scene_headers_expose_ai_or_raw_only`.

---

## Retained Invariants
- `PAID_CALLS_PER_DAY` budget accounting intact and verified.
- `X-Vision-Provider` exposes `ai` or `raw` only.
- Per-client rate limit and in-flight permits released on all normal, disconnect, and cancel paths.
- Raw Mode 1600 px downscaling and cooperative cancellation checks preserved.

---

## Files Touched
- `backend/app/main.py`
- `backend/app/raw_mode.py`
- `backend/app/image_utils.py`
- `backend/app/vision/openai_provider.py`
- `backend/tests/test_k4_scene_pipeline.py`
- `docs/reports/agy-k4-scene-pipeline-report.md`
- `docs/BUILD_LOG.md`
