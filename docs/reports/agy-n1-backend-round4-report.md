# Implementation Report: Lane n1-backend-round4 (FIX, backend)

**Status: DONE**  
**Engineer:** agy, reviewed by Claude  
**Date:** 2026-11-09  

---

## 1. Executive Summary

This lane addressed backend audit findings from `docs/reports/audit-m4-round4.md`
(M4-01, M4-05, M4-06, M4-07, M4-08, M4-11, M4-12) according to the brief `docs/briefs/agy-n1-backend-round4.md`.
All scoped files were verified against current repository code, minimal fixes applied, and
a comprehensive regression test suite implemented in `backend/tests/test_n1_backend.py`.

---

## 2. Findings Verification & Fix Status

| Finding | Severity | Description | Status | Evidence / Notes |
|---|---|---|---|---|
| **M4-01** | HIGH | In-flight permit leak on semaphore queue cancellation/timeout | **FIXED** | Structured with `try...finally` immediately after permit acquisition in `process_scene` and `ask_question_route`. Tested cancellation while waiting for slot returns permit count to 0 and admits new requests. |
| **M4-05** | HIGH | Unbounded aspect ratio in schema/validator and semantic crash | **FIXED** | Bound `aspect` to `[0.05, 20.0]` in `schema.py` and `validate.py`; clamped aspect and protected dot product math in `semantic.py`; wrapped `_semantic_ask` in `ask.py` to fall through without 500 or leaked errors. |
| **M4-06** | MED | IPv6 zone identifier / port normalization in client key | **FIXED** | Stripped zone IDs (`%...`) in `_normalize_ip_key` in `limits.py`; link-local clients on varying ports now normalize cleanly to `/64` network key. |
| **M4-07** | MED | Client disconnect polling during vision model extraction | **NOT REPRODUCED** | Already implemented in current code by lane k4 (`main.py:824-846`); disconnect polling loop cancels extraction and returns 499. Verified by test. |
| **M4-08** | MED | CLAMP_TOLERANCE 2% too tight causing dropped referenced points | **SKIPPED (REVERTED TO SPEC)** | Reverted `CLAMP_TOLERANCE` to `0.02` (2%) in `validate.py:38` per project spec (+/-0.02) and supervisor direction. Verified 0.02 tolerance in regression tests. |
| **M4-11** | LOW | Unbounded wait on worker raw task cancellation | **FIXED** | Added `asyncio.wait_for(asyncio.shield(raw_task), timeout=0.5)` on timeout/exception paths in `run_raw_mode`. |
| **M4-12** | LOW | Docstring pixel limit alignment (12 MP vs 40 MP) | **FIXED** | Aligned docstrings in `main.py` and `image_utils.py` to document `12 MP` matching `MAX_IMAGE_PIXELS = 12_000_000`. |

---

## 3. Detailed Changes by Finding

### M4-01 (HIGH) — Per-Client In-Flight Permit Leaks
- **Issue:** In `backend/app/main.py`, `await acquire_slot(sem, wait_seconds)` occurred outside the
  `try...finally` block that released the per-client in-flight limiter permit. If the client disconnected
  or the request coroutine was cancelled while waiting in the semaphore queue, `asyncio.CancelledError`
  bypassed permit release, permanently consuming the client's concurrency quota and locking out the IP
  with HTTP 429.
- **Fix:** Structured both `process_scene` and `ask_question_route` with `try...finally` immediately
  following `limiter.acquire(client_key_val)`. Tracked `slot_acquired = True` so `sem.release()` is only
  invoked if the slot was obtained, while `limiter.release(client_key_val)` runs on every exit path.
- **Regression Tests:**
  - `test_m4_01_scene_in_flight_permit_released_on_cancellation_waiting_for_semaphore`
  - `test_m4_01_ask_in_flight_permit_released_on_cancellation_waiting_for_semaphore`
  - `test_m4_01_scene_queue_timeout_releases_in_flight_permit`
  - `test_m4_01_ask_queue_timeout_releases_in_flight_permit`

### M4-05 (HIGH) — Bounded Aspect Ratio & Defensive Semantic Fall-Through
- **Issue:** `DiagramScene.aspect` lacked upper bound validation. Extremely large aspect ratios
  (e.g. `1e200`) caused float overflow in vector coordinates, producing `nan` in cosine calculations
  and unhandled `ValueError: math domain error` in `math.acos` inside `_find_right_angle`. Furthermore,
  `_semantic_ask` in `/ask` had no exception handler, turning unexpected errors into HTTP 500s.
- **Fix:**
  - In `backend/app/schema.py`, tightened `aspect` to `ge=0.05, le=20.0, allow_inf_nan=False`.
  - In `backend/app/validate.py`, clamped aspect to `max(0.05, min(20.0, asp))` (defaulting to 1.0).
  - In `backend/app/semantic.py`, clamped aspect in `_find_right_angle` and `_find_longest_side`,
    and added `math.isfinite` guards on `dot`, `denom`, and `ratio` before `math.acos`.
  - In `backend/app/ask.py`, wrapped `_semantic_ask` in `try...except Exception:` to log a single
    warning and fall through cleanly to the model/facts stages without leaking error details in responses.
- **Regression Tests:**
  - `test_m4_05_schema_bounds_aspect`
  - `test_m4_05_validator_clamps_extreme_aspect`
  - `test_m4_05_semantic_calculations_safe_with_boundary_aspect`
  - `test_m4_05_semantic_ask_unexpected_exception_falls_through_in_ask`

### M4-06 (MED) — IPv6 Zone/Scope Identifier Normalization
- **Issue:** In `backend/app/limits.py:_normalize_ip_key`, link-local IPv6 addresses containing
  zone identifiers (e.g. `[fe80::1%eth0]:5000` or `fe80::1%12`) caused `ipaddress.ip_address` to
  raise `ValueError`, returning the raw string with ephemeral port intact. Every new TCP connection
  received a different key, completely bypassing rate limits and concurrency caps.
- **Fix:** Stripped zone IDs (`%...`) prior to `ipaddress.ip_address` parsing, and returned
  `cleaned[:MAX_CLIENT_KEY_CHARS]` on fallback.
- **Regression Tests:**
  - `test_m4_06_ipv6_zone_id_and_port_normalizes_to_64_network`
  - `test_m4_06_client_key_with_ipv6_zone_id`

### M4-07 (MED) — Client Disconnect Polling in Scene Vision Pipeline
- **Issue:** Audit suspected missing disconnect polling during vision model execution in `process_scene`.
- **Finding:** Current code in `backend/app/main.py:824-846` already implemented task polling with
  `min(ASK_DISCONNECT_POLL_SECONDS, remaining)` and `if await request.is_disconnected(): work.cancel(); return Response(status_code=499)`.
  This was introduced by lane k4 and tested by `test_b2_02`.
- **Status:** NOT REPRODUCED in current code. Added regression test `test_m4_07_scene_vision_aborts_on_client_disconnect`.

### M4-08 (MED) — Coordinate Clamp Tolerance
- **Issue:** Audit suggested widening `CLAMP_TOLERANCE` from 0.02 to 0.05.
- **Resolution:** SKIPPED / REVERTED TO SPEC. The project spec strictly defines clamping within +/-0.02. Widening tolerance to 0.05 broke existing hardening tests (`test_k3_validate_hardening.py` and `test_validate_endpoint.py`). In follow-up pass 2, `CLAMP_TOLERANCE = 0.02` was reinstated in `backend/app/validate.py:38` per supervisor direction.
- **Regression Tests:**
  - `test_m4_08_clamp_tolerance_is_0_02`
  - `test_m4_08_minor_boundary_overshoot_clamps_without_invalidating_referenced_point`
  - `test_m4_08_overshoot_beyond_tolerance_still_dropped`

### M4-11 (LOW) — Bounded Wait on Raw Task Cancellation
- **Issue:** In `backend/app/main.py:676-681` and `691-697`, when `build_raw_scene` timed out,
  `cancel_event.set()` was followed by an unbounded `await raw_task`. If worker thread was blocked
  inside OpenCV C++ routines, the coroutine could delay client response and hold concurrency slots.
- **Fix:** Bounded the worker termination wait to 0.5s:
  `await asyncio.wait_for(asyncio.shield(raw_task), timeout=0.5)`.
- **Regression Test:**
  - `test_m4_11_bounded_wait_on_raw_task_timeout`

### M4-12 (LOW) — Docstring Pixel Limit Alignment
- **Issue:** Docstrings in `main.py:539` and `image_utils.py:219` stated `<=40 MP`, whereas code
  enforces `MAX_IMAGE_PIXELS = 12_000_000` (12 MP).
- **Fix:** Aligned docstrings in both files to specify 12 MP.
- **Regression Test:**
  - `test_m4_12_docstrings_match_12_mp_limit`

### Follow-Up Pass 2 Gating Resolutions
- **Issue 1 (`backend/app/validate.py:38`):** `CLAMP_TOLERANCE` was reverted from 0.05 back to 0.02
  per the project spec (+/-0.02) and supervisor direction, without touching any other tolerance or
  clamp logic. This resolved the 3 gating test failures in `tests/test_k3_validate_hardening.py`
  (two F5 tests) and
  `tests/test_validate_endpoint.py::test_coordinates_beyond_tolerance_rejected_with_error`.
- **Issue 2 (`backend/tests/test_n1_backend.py::test_m4_05_validator_clamps_extreme_aspect`):**
  Added two valid points and one segment connecting them
  (`A` at `(0.1, 0.1)`, `B` at `(0.9, 0.9)`, segment `AB`) to each of the four test input dicts.
  This satisfies the drawable element requirement so `validate_scene` returns a valid scene and
  reaches the aspect clamping assertions (`20.0`, `0.05`, `1.0`, `1.0`).
- **Test Alignment (`backend/tests/test_n1_backend.py`):** Updated M4-08 regression tests to assert
  `CLAMP_TOLERANCE == 0.02` per project spec.
- **Status:** **DONE**. All backend tests and lint checks pass cleanly.

---

## 4. Needs from Planner

The following non-backend findings from audit `m4-round4` require frontend fix lane n2 attention:
1. **M4-02 (HIGH):** Update `frontend/src/App.tsx:367-372` (`saveDiagram`) to call `saveDiagramWithEviction`
   from `flow/saved.ts` so IndexedDB diagram eviction is atomic and prevents diagram loss on storage errors.
2. **M4-03 (HIGH):** Update `frontend/src/App.tsx:430-435` (`handleSaveCorrect`) to call `saveDiagram(scene)`
   and update `lastExploreScene.current` so teacher corrections persist across page reloads.
3. **M4-04 (HIGH):** In `frontend/src/api/scene.ts:76-78`, exclude HTTP 504 from retry so diagram timeouts
   throw `SceneRequestError('timeout')` immediately rather than re-submitting expensive AI calls.
4. **M4-09 (LOW):** Exclude heavy PDF worker from initial precache in `frontend/vite.config.ts` (`globIgnores: ['**/pdf*']`).
5. **M4-10 (LOW):** Strip `"angle "` prefix in `frontend/src/verify/verify.ts:571` to prevent English word leak
   in Hindi and Gujarati TTS announcements.

---

## 5. Files Touched

- `backend/app/schema.py`
- `backend/app/validate.py`
- `backend/app/semantic.py`
- `backend/app/ask.py`
- `backend/app/limits.py`
- `backend/app/main.py`
- `backend/app/image_utils.py`
- `backend/tests/test_n1_backend.py` (new)
- `docs/reports/agy-n1-backend-round4-report.md` (this report)
- `docs/BUILD_LOG.md` (entry added)
