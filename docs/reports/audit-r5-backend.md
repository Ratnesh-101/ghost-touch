# Audit Report: Lane r5-backend

**Status: DONE**  
**Auditor:** Antigravity (agy)  
**Date:** 2026-11-09  
**Scope:** `backend/app/ask.py`, `backend/app/image_utils.py`, `backend/app/limits.py`,
`backend/app/main.py`, `backend/app/schema.py`, `backend/app/semantic.py`,
`backend/app/validate.py`, and `backend/tests/test_n1_backend.py`.

---

## 1. Executive Summary

This read-only audit examined the backend codebase following the merge of lane `n1-backend`
(covering M4-01 permit release on cancellation, M4-05 bounded aspect ratios, M4-06 IPv6 zone ID
normalization, M4-07 client disconnect polling, M4-08 CLAMP_TOLERANCE 0.02 maintenance, M4-11
bounded OpenCV thread cancellation, and M4-12 docstring alignment).

Key takeaways:
1. **Core security and reliability invariants are SOUND:**
   - In-flight permits and concurrency semaphores are safely released on all exception,
     timeout, client disconnect, and `_BodyTooLarge` paths via outer `try...finally` blocks.
   - Aspect ratio is strictly bounded to `[0.05, 20.0]` in schema and validator; vector and
     cosine calculations defensively guard against NaN, inf, and zero division.
   - `CLAMP_TOLERANCE` is preserved at `0.02` (2%) per specification.
   - Decompression bombs and oversized uploads are blocked at header inspection before decoding.
   - Response bodies use static error details and never leak internal exception text.
2. **Vacuous assertion found in regression test suite:**
   - `test_n1_backend.py:382` uses a tautological `or` assertion
     (`assert coords is not None or res is None`) that evaluates to `True` for all possible
     return values of `_find_right_angle`, asserting nothing meaningful about whether right
     angles are detected.
3. **MIME type discrepancy in `main.py`:**
   - `ALLOWED_MIME_TYPES` in `main.py` rejects common `image/jpg` before `image_utils.py` can
     canonicalize it to `image/jpeg`.

---

## 2. Findings (Highest Severity First)

- **MED · `backend/tests/test_n1_backend.py:382` · Vacuous assertion passes on all outputs**
  - **Code quote:**
    ```python
    res, coords, lbl = _find_right_angle(scene_high)
    assert coords is not None or res is None
    ```
  - **Problem:** The statement `assert coords is not None or res is None` is a tautology for
    all possible return values of `_find_right_angle`. In `backend/app/semantic.py:646-696`,
    `_find_right_angle` returns either `(target, (float(p.x), float(p.y)), label)` where `coords`
    is never `None`, or `(None, None, None)` where `res is None` is `True`. If `_find_right_angle`
    fails to find the right angle and returns `(None, None, None)`, `res is None` evaluates to
    `True` and the test passes silently.
  - **Concrete failure scenario:** A regression in `_find_right_angle` (e.g. vector distortion
    or a bug in cosine calculation when `aspect == 20.0`) causes it to miss the 90° angle at
    vertex `A` and return `(None, None, None)`. The test runner reports success because `res is None`
    satisfies the assertion.
  - **Minimal fix:** Assert meaningful expected values for the test scene:
    ```python
    assert res is not None
    assert res.element_id == "A"
    assert coords == (0.0, 0.0)
    ```

- **LOW · `backend/app/main.py:551-556` · `image/jpg` Content-Type rejected prematurely**
  - **Code quote:**
    ```python
    content_type = (image.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image format. Please upload a JPEG, PNG, or WebP image.",
        )
    ```
  - **Problem:** `ALLOWED_MIME_TYPES` (`main.py:65`) only contains `{"image/jpeg", "image/png",
    "image/webp"}`. In `backend/app/image_utils.py:230-234`, `validate_image_bytes` explicitly
    normalizes `image/jpg` to `image/jpeg`. Because `process_scene` enforces `ALLOWED_MIME_TYPES`
    before calling `validate_image_bytes`, any upload declared as `image/jpg` is rejected with 415.
  - **Concrete failure scenario:** A mobile browser or third-party client uploads a camera photo
    with header `Content-Type: image/jpg`. The server returns HTTP 415, despite the file being a
    valid JPEG under 10 MB and `image_utils.py` possessing explicit normalization for `image/jpg`.
  - **Minimal fix:** Add `"image/jpg"` to `ALLOWED_MIME_TYPES` in `backend/app/main.py:65`:
    ```python
    ALLOWED_MIME_TYPES = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
    }
    ```

- **LOW · `backend/tests/test_n1_backend.py:488-490` · Disconnect test omits permit verification**
  - **Code quote:**
    ```python
    assert isinstance(resp, Response)
    assert resp.status_code == 499
    ```
  - **Problem:** `test_m4_07_scene_vision_aborts_on_client_disconnect` checks that polling
    disconnect returns HTTP 499, but never verifies that the client's in-flight permit was
    released back to `0`. Since M4-01 was a high-severity permit leak on cancellation/disconnect,
    regression coverage should assert that the permit count returns to 0 on HTTP 499.
  - **Concrete failure scenario:** If a future refactoring bypasses the finally block or modifies
    `client_key_val` on disconnect exit, the test passes while silently leaking permits.
  - **Minimal fix:** Add `assert get_scene_in_flight_limiter().count("10.0.0.88") == 0` at the end
    of the test.

---

## 3. Meaningless / Weak Test Audit

As mandated by the brief, `backend/tests/test_n1_backend.py` was inspected for always-true
assertions or tests that mock the unit under test:

1. **`test_m4_05_semantic_calculations_safe_with_boundary_aspect` (`line 382`):**
   - Assertion: `assert coords is not None or res is None`
   - Evaluation: Boolean expression `P or not Q` where $P \iff Q$ in `_find_right_angle`
     implementation. Always evaluates to `True`. Asserts nothing about calculation accuracy.
2. **`test_m4_07_scene_vision_aborts_on_client_disconnect` (`lines 488-490`):**
   - Asserts HTTP status code 499, but fails to assert the primary invariant of the in-flight
     limiter (`limiter.count(client_key_val) == 0`).
3. **Mocking review:**
   - `test_m4_05_semantic_ask_unexpected_exception_falls_through_in_ask` patches
     `app.ask._semantic_ask` to test fallback behavior in `answer_question`. The mock targets
     the dependency rather than the function under test, which is standard and valid.

---

## 4. Sound Areas (Checked and Verified)

- **Permits and semaphores release on cancellation and exception paths:**  
  `main.py:594-604, 894-897` and `922-934, 966-969` wrap semaphore wait and processing in outer
  `try...finally` blocks, reliably releasing both global semaphores and per-client in-flight permits
  on task cancellation, client disconnect (499), queue timeout (503), and `_BodyTooLarge` (413).
- **Aspect ratio constraints, NaN/inf guards, and zero-division prevention:**  
  `schema.py:95-101` and `validate.py:284-295` enforce `aspect` bounds $[0.05, 20.0]$;
  `semantic.py:651-684, 703-708` clamps aspect, guards vector lengths (`<= 1e-9`), checks
  `math.isfinite` on dot product and denominator, skips when `denom <= 0.0`, and clamps
  `ratio` to `[-1.0, 1.0]` before calling `math.acos`, eliminating all zero-division and math
  domain errors.
- **Validator clamp tolerance remains strictly 0.02:**  
  `validate.py:38` sets `CLAMP_TOLERANCE = 0.02` (2%), clamping slightly out-of-bounds coords in
  `[-0.02, 1.02]` to `[0.0, 1.0]`, while rejecting points beyond tolerance that break segment
  references per Rule F5.
- **Fall-through error handling without silent error swallowing:**  
  `ask.py:951-959` wraps `_semantic_ask` in a defensive try/except that logs a warning with the
  exception class and falls through to provider completion and facts lookup; `main.py:850-866` logs
  AI pipeline failures and falls back to OpenCV Raw Mode outlines per design.
- **Rate-limit bypass and IP normalization:**  
  `limits.py:90-93` strips IPv6 zone/scope indices before parsing, groups IPv6 on `/64` subnets,
  strips ports, joins duplicate `X-Forwarded-For` lines, ignores untrusted headers when
  `trusted_hops <= 0`, bounds table size to 50,000 keys, and throttles sweeps to $\ge 1.0$ s.
- **Upload size and decompression-bomb mitigation:**  
  `limits.py:460` and `main.py:567, 612` enforce 10 MB upload limits on declared headers and streamed
  chunks; `image_utils.py:13, 214-266` validates dimensions directly from image headers without pixel
  decoding, rejecting any image $> 12$ MP with HTTP 422 before OpenCV or AI models touch it.
- **Response bodies exception privacy:**  
  All route exception handlers in `main.py`, `ask.py`, `validate.py`, and `limits.py` return
  curated static error messages (`detail="..."`) and never interpolate internal exception strings
  or tracebacks into HTTP response bodies.
