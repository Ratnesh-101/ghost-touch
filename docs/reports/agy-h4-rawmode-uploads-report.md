# Antigravity Lane Report: h4-rawmode-uploads

**Lane:** `h4-rawmode-uploads`  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-08  
**Status:** DONE  

---

## 1. Scope & Findings Summary

Source: `docs/reports/audit-claude-redteam-backend.md` Findings A3 and A5; Lane brief `docs/briefs/agy-h4-rawmode-uploads.md`.

| ID | Sev | Location | Problem Statement | Status | Resolution |
|---|---|---|---|---|---|
| **A3** | HIGH | `raw_mode.py`, `main.py` | Raw Mode edge detection ran on full images (up to 12 MP); all contours/edges were turned into Python objects & sorted before candidate cap; on timeout the request freed its semaphore slot while worker thread kept consuming 100% CPU invisibly. | **FIXED** | Pre-edge downscaling to <= 1600 px (`MAX_RAW_DIMENSION = 1600`); contour list capped to ~2000 longest before Python loop (`MAX_RAW_CONTOURS = 2000`); segment candidate list capped to 2000 with `heapq.nlargest`; cooperative cancellation flag checked between all OpenCV stages; in `main.py`, worker thread is signaled via `cancel_event.set()` and awaited so slot stays held until thread finishes. |
| **A5** | MED | `main.py` | Upload bytes (~20 MB, chunks list plus joined copy) were held in memory while waiting up to 6 s for a slot. | **FIXED** | Concurrency slot (`get_scene_semaphore()`) is acquired before reading upload stream; stream is buffered into a single `bytearray` (`buf.extend(chunk)`) and converted to `bytes` once (`del buf`), eliminating dual-copy overhead. All status codes (413, 415, 422) and size caps preserved. |

---

## 2. Investigation & Current Code State Analysis

1. **Finding A3 Verification:**
   - In round 2 (commit `dabd499`, Task 25), a deduplication candidate cap (`candidates = extracted_segments[:MAX_DEDUPE_CANDIDATES]`, 1000) was introduced to bound quadratic deduplication.
   - However, the root vulnerabilities remained:
     - Edge detection still ran on unscaled images up to the 12 MP limit (e.g. 4000x3000), consuming massive memory (36 MB for RGB + 12 MB for grayscale + Gaussian blur + Canny buffers).
     - Every contour found by `cv2.findContours` was approximated and turned into Python 4-tuples `(x1, y1, x2, y2)` in `extracted_segments` before sorting. In high-frequency noise, 50,000+ Python objects were allocated and sorted.
     - In `main.py:582-590`, `asyncio.wait_for(asyncio.to_thread(build_raw_scene, image_bytes), timeout=remaining)` threw `TimeoutError` and immediately exited `post_scene`. The `finally: sem.release()` freed the slot immediately, while the background worker thread in Python's thread pool continued running OpenCV operations to completion, piling up background CPU usage on a 512 MB instance.

2. **Finding A5 Verification:**
   - In `main.py:512-527`, the upload stream was read into `chunks: list[bytes]` and then joined via `b"".join(chunks)`. During `b"".join`, both the list of chunk buffers and the contiguous bytes object existed simultaneously in memory (~20 MB for a 10 MB upload).
   - Furthermore, this buffering occurred *before* `await acquire_slot(sem, wait_seconds)` at line 551. If multiple uploads queued for slots, every waiting connection held full upload bodies in memory.

---

## 3. Changes Made

### `backend/app/raw_mode.py`
1. **Pre-edge Downscaling (`MAX_RAW_DIMENSION = 1600`):**
   - After decode, if `max(height, width) > 1600`, the image is downscaled to at most 1600 px on the long side using `cv2.resize(..., interpolation=cv2.INTER_AREA)`.
   - Downscaling is performed on the 1-channel grayscale image (`gray`) rather than 3-channel BGR, saving ~3x memory and CPU.
   - Decoded 3-channel buffer is freed immediately (`del decoded`).
2. **Contour and Edge Capping (`MAX_RAW_CONTOURS = 2000`):**
   - If `len(contours) > 2000`, contours are sorted by perimeter (`cv2.arcLength(c, True)`) in C++ and capped to the top 2000 before entering the Python loop.
   - In the Python loop, at most 2000 contours are converted to segments.
   - If `len(extracted_segments) > 2000`, `heapq.nlargest` keeps only the 2000 longest segments before deduplication.
   - Deduplication continues to process the top 1000 candidates, and output is capped to `MAX_RAW_SEGMENTS = 300`.
3. **Cooperative Cancellation:**
   - Added `_check_cancel(cancel_check: threading.Event | Callable[[], bool] | None)`.
   - Checked between all OpenCV stages: decode, resize, blur, Canny, findContours, contour sorting, inside the contour loop, and inside `_dedupe_segments`.
   - Raises `RawModeError("Raw mode processing cancelled")` to stop execution within milliseconds when signaled.
4. **Boundary & Small Image Protection:**
   - Images < 3x3 (e.g. 1x1) safely return an empty `DiagramScene` (0 points, 0 segments) without OpenCV assertion crashes or kernel errors.
   - All coordinates are normalized via `nx = max(0.0, min(1.0, rx / proc_w))` and `ny = max(0.0, min(1.0, ry / proc_h))`, strictly within `[0.0, 1.0]`.

### `backend/app/main.py`
1. **Concurrency Slot Before Reading Stream (A5):**
   - Moved `acquire_slot(sem, wait_seconds)` before reading the upload body.
   - Requests waiting in queue hold 0 MB of upload body memory.
2. **Single-Copy Upload Buffer (A5):**
   - Replaced `chunks: list[bytes]` and `b"".join(chunks)` with a single `bytearray` (`buf.extend(chunk)`).
   - Created immutable `image_bytes = bytes(buf)` and immediately freed `del buf`.
   - Preserved all status codes: 415 (unsupported MIME), 413 (exceeds 10 MB limit), 422 (empty/unparseable).
3. **Slot Retention and Worker Cancellation on Timeout (A3):**
   - In `run_raw_mode`, instantiated `cancel_event = threading.Event()`.
   - Wrapped thread task in `asyncio.shield(raw_task)`.
   - On `TimeoutError`, sets `cancel_event.set()` and awaits `raw_task` (suppressing exceptions) before raising HTTP 504.
   - Handled `(Exception, asyncio.CancelledError)` identically to ensure client disconnects also abort the worker thread.
   - Outer `finally: sem.release()` is only reached after `raw_task` has completely finished, ensuring the concurrency slot is held until the worker thread exits.

### `backend/tests/test_h4_rawmode_uploads.py`
Created comprehensive test suite with 16 test cases:
- `test_h4_constants_configured`: Verifies `MAX_RAW_DIMENSION == 1600`, `MAX_RAW_CONTOURS == 2000`, `MAX_RAW_SEGMENTS == 300`.
- `test_h4_blank_image_returns_empty_raw_scene`: Solid black image returns 0 points and 0 segments.
- `test_h4_all_white_image_returns_empty_raw_scene`: Solid white image returns 0 points and 0 segments.
- `test_h4_1x1_image_returns_empty_raw_scene`: 1x1 image handled safely without crashing.
- `test_h4_extreme_aspect_ratio_wide`: 3000x30 image downscales to 1600x16, extracts valid segments in [0, 1].
- `test_h4_extreme_aspect_ratio_tall`: 30x3000 image downscales to 16x1600, extracts valid segments in [0, 1].
- `test_h4_12_megapixel_noisy_image_fast`: 4000x3000 (12 MP) noisy image finishes in < 3.0s, produces <= 300 segments.
- `test_h4_downscale_preserves_normalized_coordinate_bounds`: 3200x2400 image preserves [0, 1] coordinate bounds and relative geometry.
- `test_h4_dense_noise_contour_capping`: Dense noise grid capped to 2000 contours and finishes in < 3.0s.
- `test_h4_cooperative_cancel_event_aborts_immediately`: Pre-set `threading.Event` aborts immediately with `RawModeError`.
- `test_h4_cooperative_cancel_callback_stops_mid_stage`: Dynamic callback aborts between processing stages.
- `test_h4_scene_route_blank_image_returns_422`: POST `/api/v1/scene` with blank image returns 422.
- `test_h4_scene_route_1x1_image_returns_422`: POST `/api/v1/scene` with 1x1 image returns 422.
- `test_h4_scene_route_upload_status_codes_preserved`: Tests 415, 413, and 422 status codes.
- `test_h4_scene_route_takes_slot_before_reading_stream`: Exhausted semaphore returns 503 `queue_timeout` before stream buffering.
- `test_h4_scene_route_timeout_cancels_worker_and_holds_slot`: Route timeout sets cancel flag and holds slot until worker completes.

---

## 4. Verification & DoD Checks

Per lane brief instructions:
- "The supervisor runs pytest and ruff; do NOT run them yourself." (No pytest or ruff commands executed).
- Allowed files modified: `backend/app/raw_mode.py`, `backend/app/main.py` (scene route only), `backend/tests/test_h4_rawmode_uploads.py`, `docs/reports/agy-h4-rawmode-uploads-report.md`, `docs/BUILD_LOG.md`.
- No forbidden files modified (`backend/app/schema.py`, `backend/app/validate.py`, `.kiro/**`, `frontend/**`, workflows untouched; no `.env*` touched).
- Git status verified via allowed shell commands.

---

## 5. Follow-Up Fixes (Post-Run Review)

Following supervisor test and lint run:

1. **`test_raw_mode_runs_once_after_ai_timeout` Backward Compatibility:**
   - **Problem:** `test_review_fixes.py::test_raw_mode_runs_once_after_ai_timeout` mocks `main_mod.build_raw_scene` with `counting(image: bytes)`, taking only 1 argument. The lane's previous change passed `(image_bytes, cancel_event)` positionally, raising `TypeError: counting() takes 1 positional argument but 2 were given`.
   - **Fix:** Implemented `_call_raw_scene` in `backend/app/main.py`. It inspects the target callable's signature:
     - Passes `cancel_check=cancel_event` as an optional keyword argument if supported (or if `**kwargs` is accepted).
     - Passes positionally if 2 or more positional parameters or `*args` are accepted.
     - Calls with only `image` if the callable accepts only 1 positional argument.
   - Existing `test_review_fixes.py` passes unchanged without modifying any mock or weakening any assertion.
   - Added regression test `test_h4_scene_route_backward_compatible_with_one_arg_raw_builder` in `test_h4_rawmode_uploads.py`.

2. **Ruff E501 (Line Length):**
   - **Problem:** `backend/app/raw_mode.py` line 25 was 104 characters (`MAX_RAW_CONTOURS = 2000  # Cap contour/edge list to longest ~2000 before building objects & sorting (A3)`).
   - **Fix:** Wrapped by placing the comment on the preceding line (`# Cap contour/edge list to longest ~2000 before building objects & sorting (A3)`). All lines in `raw_mode.py` and `main.py` are strictly <= 99 characters.

3. **Ruff-Format Style Adherence:**
   - **Problem:** `ruff format --check` flagged `backend/app/raw_mode.py` due to multi-line call formatting and parenthesized ternary line collapse.
   - **Fix:**
     - Simplified `_check_cancel` from a parenthesized ternary to an explicit `if/else` block.
     - Added trailing commas to all multi-line calls (`RawModeError`, `sorted`, `extracted_segments.sort`).
     - Decoupled `sorted(...)` from slicing across statements.
     - Formatted strictly to repo conventions (line length <= 100, double quotes, trailing commas in multi-line calls).

4. **Deterministic Worker Timeout Test (Follow-Up 3):**
   - **Problem:** `test_h4_scene_route_timeout_cancels_worker_and_holds_slot` flaked with
     `assert False where False = is_set()` on `cancel_received`. In `main.py`,
     `remaining = max(0.5, total_deadline - elapsed)` clamped the deadline to at least 0.5s even
     when `SCENE_TIMEOUT_SECONDS="0.2"`. The test's fake worker loop ran for 50 iterations with
     0.01s sleep (0.50s); on runs where the worker finished in ~490ms, it exited its loop before
     `cancel_event.set()` was called, so `cancel_received` was never set. Furthermore, asserting
     `is_set()` immediately raced thread completion.
   - **Fix:**
     - Made the fake worker poll `cancel_check` for up to 500 iterations (5.0s) with 0.01s sleeps,
       ensuring it cannot exit before the route times out and exits promptly (within 10ms) once
       canceled.
     - Replaced immediate `is_set()` assertions with bounded waits:
       `assert cancel_received.wait(timeout=5.0)` and `assert thread_finished.wait(timeout=5.0)`.
     - In `main.py`, updated `remaining` to `max(0.05, total_deadline - elapsed)` so
       caller-configured timeouts (like 0.2s) are accurately respected rather than clamped to 0.5s.
     - Added `finally: cancel_event.set()` in `run_raw_mode` to ensure `cancel_event` is set
       before the concurrency slot is released and before response return.
     - Added `reset_scene_semaphore()` to `clean_overrides` fixture to keep test runs completely
       isolated.
