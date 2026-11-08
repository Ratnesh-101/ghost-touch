# Audit Report: b2-scene-pipeline (Backend Scene Path End-to-End)

**Lane:** `b2-scene-pipeline`  
**Auditor:** Antigravity (agy, reviewed by Claude)  
**Date:** 2026-11-08  
**Scope:** Backend scene path end to end: `backend/app/main.py` (scene, improve pass, cache), `backend/app/vision/` (providers, base, chain, prompts), `backend/app/validate.py`, `backend/app/raw_mode.py`, `backend/app/schema.py`, image decoding (`image_utils.py`: PNG, JPEG, WebP, dimensions, EXIF rotation, decompression limits), cache keys & eviction (`scene_cache.py`), timeouts & cancellation, error mapping, and malformed/adversarial inputs / prompt injection.

---

## Executive Summary
This audit conducted an exhaustive line-by-line tracing of the backend scene pipeline. 17 findings were catalogued (5 High, 7 Medium, 5 Low). All findings are CONFIRMED by code inspection and concrete trace analysis. Key structural vulnerabilities include:
1. `ai_budget` timeout calculation in `main.py` ignoring semaphore queue waiting times, violating the 15-second total deadline (Requirement 3.4) and precipitating premature 504 Gateway Timeouts.
2. Complete absence of client disconnect cancellation during in-flight model inference in `POST /api/v1/scene` (violating Requirement 15.3 / SEC-03), which burns paid API tokens and holds the scarce 2-slot concurrency semaphore.
3. Uncaught `cv2.error` exceptions in `build_raw_scene` causing HTTP 500 crashes on 1x1, 2x1, or extreme aspect ratio images.
4. Total omission of EXIF orientation rotation in `raw_mode.py` (violating Requirement 15.4 / SEC-04), causing phone camera portrait photos to have Raw Mode tactile lines rotated 90° away from the visual diagram.
5. Inverted bar coordinates (`x0 > x1` or `y_top > y_base`) passing validation but resulting in permanently unhittable, dead bars on the touch canvas.

---

## Confirmed Findings (Ranked by Severity)

### High Severity

#### B2-01 · high · `backend/app/main.py:713` (vs `main.py:486, 644`)
- **What is wrong:** Total request deadline overrun and premature 504 Gateway Timeouts caused by relative `asyncio.timeout(ai_budget)` ignoring time spent waiting in the concurrency queue and streaming upload bytes.
- **Concrete failure scenario:**
  1. Concurrency limit is saturated (`_scene_semaphore` held by prior requests). A new request arrives at `t = 0.0s` (`start_time = time.monotonic()`).
  2. The request waits 5.5s in `acquire_slot(sem, 6.0)`.
  3. Slot is acquired at `t = 5.5s`. At line 644, `ai_budget = 15.0 - 2.5 = 12.5s`.
  4. At line 713, `async with asyncio.timeout(ai_budget):` is executed. Because `asyncio.timeout(12.5)` is relative to invocation time (`t = 5.5s`), it permits `attempt_ai()` to run until `t = 5.5 + 12.5 = 18.0s`.
  5. Total elapsed time is now 18.0s, exceeding the 15-second total budget (Requirement 3.4).
  6. If AI fails or times out at 18.0s, line 579 executes: `remaining = max(0.5, 15.0 - 18.0) = 0.5s`.
  7. `build_raw_scene` gets only 500ms in `asyncio.to_thread`. If edge detection takes 600ms, `asyncio.wait_for` raises `TimeoutError` and lines 587-590 raise HTTP 504 Gateway Timeout instead of delivering a Raw Mode scene.
- **Proposed minimal fix:**
  Compute remaining AI timeout dynamically against the absolute deadline:
  ```python
  remaining_ai = max(0.1, ai_deadline - time.monotonic())
  async with asyncio.timeout(remaining_ai):
      payload, fallback_reason = await attempt_ai()
  ```
- **Proposed test:**
  ```python
  @pytest.mark.asyncio
  async def test_scene_budget_accounts_for_queue_wait(client, monkeypatch):
      sem = get_scene_semaphore()
      await sem.acquire()  # Force queue wait
      asyncio.get_event_loop().call_later(4.0, sem.release)
      start = time.monotonic()
      resp = await client.post("/api/v1/scene", files={"image": ("test.png", PNG_BYTES, "image/png")})
      elapsed = time.monotonic() - start
      assert elapsed <= 15.2
      assert resp.status_code == 200
  ```

---

#### B2-02 · high · `backend/app/main.py:712-739` (vs `app/ask.py:771-785`)
- **What is wrong:** Missing client disconnect watcher during in-flight vision model calls in `POST /api/v1/scene` (Requirement 15.3 / SEC-03 violation), leaking paid model tokens and holding the 2-slot concurrency semaphore when a mobile client navigates away or cancels.
- **Concrete failure scenario:**
  1. A student taps "Choose image" or takes a photo. The request arrives at `/api/v1/scene` and enters `attempt_ai()` calling Gemini.
  2. While Gemini is processing (taking ~8-10 seconds), the student clicks Back or closes the browser tab.
  3. In `/api/v1/scene`, `await request.is_disconnected()` is checked only before vision processing (line 561) and before raw mode (line 574), but never during `attempt_ai()`.
  4. The model call runs to completion, spending paid tokens.
  5. Crucially, `_scene_semaphore` (default capacity: 2) remains locked until `attempt_ai()` completes and `finally: sem.release()` is reached. If two students cancel rapid uploads, all other users receive HTTP 503 ("Server is busy") for up to 15 seconds.
  6. Note that `POST /api/v1/ask` already implements this correctly via `ASK_DISCONNECT_POLL_SECONDS` task polling (Requirement 16.9).
- **Proposed minimal fix:**
  Wrap `attempt_ai()` in an `asyncio.create_task` with a disconnect polling loop matching `POST /api/v1/ask`:
  ```python
  work = asyncio.create_task(attempt_ai())
  try:
      while True:
          done, _ = await asyncio.wait({work}, timeout=0.25)
          if done:
              payload, fallback_reason = work.result()
              break
          if await request.is_disconnected():
              logger.info("Client disconnected during scene vision call; cancelling")
              work.cancel()
              return Response(status_code=499)
  finally:
      if not work.done():
          work.cancel()
          with contextlib.suppress(asyncio.CancelledError):
              await work
  ```
- **Proposed test:**
  ```python
  @pytest.mark.asyncio
  async def test_scene_aborts_on_client_disconnect(client, mock_chain):
      mock_chain.extract = slow_extract_5s
      # Disconnect after 0.5s
      resp = await client.post("/api/v1/scene", ..., disconnect_after=0.5)
      assert resp.status_code == 499
      assert get_scene_semaphore()._value == DEFAULT_SCENE_MAX_CONCURRENCY
  ```

---

#### B2-03 · high · `backend/app/raw_mode.py:65-82` & `backend/app/main.py:591-596`
- **What is wrong:** Uncaught `cv2.error` crashes `build_raw_scene` with HTTP 500 on 1x1, 2x1, or extreme aspect ratio images.
- **Concrete failure scenario:**
  1. A user uploads a 1x1 or 2x1 PNG image, or a valid 4000x2 banner diagram.
  2. `validate_image_bytes` passes (`dims=(1, 1)`, pixels <= 12 MP).
  3. AI fails or no provider is configured, invoking `build_raw_scene(image_bytes)`.
  4. In `build_raw_scene`, `cv2.GaussianBlur(gray, (5, 5), 0)` or `cv2.Canny` fails an internal OpenCV assertion (`src.rows >= ksize.height`), raising `cv2.error`.
  5. `build_raw_scene` has no try/except block around OpenCV operations; it only raises `RawModeError` on explicit dimension checks.
  6. In `main.py` line 586-595, `run_raw_mode` catches only `TimeoutError` and `RawModeError`.
  7. The uncaught `cv2.error` escapes `run_raw_mode` and `process_scene`, bubbling up to FastAPI as an unhandled exception and returning HTTP 500 Internal Server Error instead of HTTP 422.
- **Proposed minimal fix:**
  In `raw_mode.py`:
  ```python
  try:
      gray = cv2.cvtColor(decoded, cv2.COLOR_BGR2GRAY)
      if min(height, width) < 5:
          raise RawModeError("Image dimensions too small for contour extraction")
      blurred = cv2.GaussianBlur(gray, (5, 5), 0)
      edges = cv2.Canny(blurred, 50, 150)
      contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
  except cv2.error as exc:
      raise RawModeError(f"OpenCV processing error: {exc}") from exc
  ```
- **Proposed test:**
  ```python
  def test_raw_mode_1x1_raises_raw_mode_error():
      # 1x1 PNG bytes
      img_1x1 = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
      with pytest.raises(RawModeError):
          build_raw_scene(img_1x1)
  ```

---

#### B2-04 · high · `backend/app/raw_mode.py:65-72` & `backend/app/image_utils.py:121`
- **What is wrong:** EXIF orientation metadata is completely ignored in `build_raw_scene`, rotating tactile outlines 90° away from the photo shown on screen (Requirement 15.4 / SEC-04 violation).
- **Concrete failure scenario:**
  1. A student takes a portrait photo on an Android phone. The camera sensor writes raw landscape pixels (4032x3024) with EXIF Orientation tag 6 (rotate 90° CW).
  2. The frontend renders the photo in portrait orientation (3024x4032) using standard browser CSS `image-orientation: from-image`.
  3. When Raw Mode executes, `cv2.imdecode` reads the unrotated landscape buffer (4032x3024).
  4. All contour detection, approxPolyDP simplification, and normalized coordinates `(rx / width, ry / height)` are computed relative to the landscape orientation.
  5. The student explores the portrait diagram on the phone screen: horizontal lines on the screen vibrate as vertical lines, and vertices are rotated 90° into wrong positions.
  6. Note: `_parse_exif_orientation` was written in `image_utils.py` for dimension sniffing, but was never wired into `raw_mode.py`.
- **Proposed minimal fix:**
  In `raw_mode.py`, extract EXIF orientation and rotate `decoded` before running Canny:
  ```python
  from app.image_utils import _parse_exif_orientation, sniff_image_format
  # After cv2.imdecode:
  if sniff_image_format(image) == "image/jpeg":
      # Inspect APP1 orientation
      orientation = ... # parse orientation tag
      if orientation == 6:
          decoded = cv2.rotate(decoded, cv2.ROTATE_90_CLOCKWISE)
      elif orientation == 8:
          decoded = cv2.rotate(decoded, cv2.ROTATE_90_COUNTERCLOCKWISE)
      elif orientation == 3:
          decoded = cv2.rotate(decoded, cv2.ROTATE_180)
      height, width = decoded.shape[:2]
  ```
- **Proposed test:**
  ```python
  def test_raw_mode_respects_exif_orientation(jpeg_with_exif_orientation_6):
      scene = build_raw_scene(jpeg_with_exif_orientation_6)
      # Assert aspect ratio of detected points matches portrait orientation
      ys = [p.y for p in scene.points]
      xs = [p.x for p in scene.points]
      assert max(ys) > max(xs)
  ```

---

#### B2-05 · high · `backend/app/validate.py:129-147` & `frontend/src/core/hitTest.ts:229`
- **What is wrong:** Inverted bar coordinates (`x0 > x1` or `y_top > y_base`) pass backend validation, creating permanently unhittable, dead bars in `hitTest`.
- **Concrete failure scenario:**
  1. A vision model outputs a bar chart where a bar has `x0 = 0.6, x1 = 0.4` or `y_top = 0.8, y_base = 0.2` (origin top-left).
  2. `validate_scene` clamps the coordinates to [0, 1] but does not normalize order: `bar["x0"] = x0; bar["x1"] = x1; bar["y_top"] = y_top; bar["y_base"] = y_base`.
  3. `validate_scene` returns `ok=True`.
  4. On the frontend, `frontend/src/core/hitTest.ts` line 229 tests:
     `if (fn.x >= bar.x0 && fn.x <= bar.x1 && fn.y >= bar.y_top && fn.y <= bar.y_base)`
  5. Because `x0 > x1`, this condition is mathematically impossible to satisfy for any pointer coordinate `fn.x`.
  6. The bar cannot be touched or interacted with by the blind student.
  7. Note: `frontend/src/share/validate.ts` already fixed this for shared links (SEC-07); `backend/app/validate.py` was never updated.
- **Proposed minimal fix:**
  In `backend/app/validate.py` line 140:
  ```python
  if all(v is not None for v in (x0, x1, y_top, y_base)):
      bar["x0"] = min(x0, x1)
      bar["x1"] = max(x0, x1)
      bar["y_top"] = min(y_top, y_base)
      bar["y_base"] = max(y_top, y_base)
      kept_bars.append(bar)
  ```
- **Proposed test:**
  ```python
  def test_validate_normalizes_inverted_bars():
      raw = {
          "kind": "bar_chart",
          "bars": [{"id": "b1", "x0": 0.6, "x1": 0.4, "y_top": 0.8, "y_base": 0.2, "label": "Sales", "value": 10}],
      }
      res = validate_scene(raw)
      assert res.scene is not None
      b = res.scene.bars[0]
      assert b.x0 <= b.x1
      assert b.y_top <= b.y_base
  ```

---

### Medium Severity

#### B2-06 · med · `backend/app/validate.py:257-312` vs `backend/app/ask.py:511-525`
- **What is wrong:** `POST /api/v1/scene` does not enforce structural scene size bounds (`_check_scene_size`), generating scenes that fail `POST /api/v1/ask` with HTTP 422.
- **Concrete failure scenario:** A model returns a dense diagram with 600 points or 1100 segments (or 150 facts). `validate_scene` accepts it without cap enforcement. The scene is delivered to the student. When the student asks a question, `POST /api/v1/ask` runs `_check_scene_size(scene)`, which raises `ValueError("scene has too many points (600 > 500)")`, returning HTTP 422. The student cannot use Ask on a scene the backend just created.
- **Proposed minimal fix:** In `validate_scene`, enforce `_check_scene_size(data)` (or truncate elements exceeding limits) before constructing `DiagramScene`.
- **Proposed test:** Pass a scene with 501 points to `validate_scene`; verify it is capped or flagged.

---

#### B2-07 · med · `backend/app/main.py:323-328` vs `main.py:672-676`
- **What is wrong:** Asynchronous background improve pass (`run_improve_pass`) overwrites high-quality equation-sampled function graphs with raw traced polylines in `scene_cache`.
- **Concrete failure scenario:** A user uploads a function graph. The primary pipeline detects `kind == "function_graph"`, runs `sampled_graph_scene()`, and caches the precise sampled curve. In the background, `run_improve_pass` executes with `GEMINI_IMPROVE_MODEL`. It extracts the scene via `build_prompt()`, validates it, and puts the raw traced polyline directly into `scene_cache`. On the next request or demo, the cache serves the crude traced polyline instead of the smooth equation-sampled curve.
- **Proposed minimal fix:** In `_run_improve_pass_locked`, if `val_result.scene.kind == "function_graph"`, skip overwriting the cache or run equation sampling before storing.
- **Proposed test:** Cache an equation-sampled scene. Run `_run_improve_pass_locked` with a traced scene. Assert cache preserves the equation-sampled curve.

---

#### B2-08 · med · `backend/app/main.py:717-719` & `backend/app/vision/gemini.py:180-182` & `backend/app/vision/chain.py:105`
- **What is wrong:** Vision provider timeouts are misclassified as `fallback_reason = "provider_error"` instead of `"timeout"` (Requirement 3.4 violation).
- **Concrete failure scenario:** A vision model call exceeds its timeout. `GeminiProvider` or `OpenAIProvider` catches `TimeoutError` and raises `VisionError(self.name, "request timed out after 8.0s")`. In `main.py` line 717, `except VisionError` catches it and sets `fallback_reason = "provider_error"`. When Raw Mode returns, `reason` is `"provider_error"`, violating Requirement 3.4 ("THE backend SHALL respond within 15 seconds, or return a Raw Mode scene with a timeout reason").
- **Proposed minimal fix:** In `main.py` line 717, inspect `exc.reason` for `"timed out"` or `"deadline reached"`, and set `fallback_reason = "timeout"`.
- **Proposed test:** Mock `chain.extract` to raise `VisionError("gemini", "request timed out after 8.0s")`. Assert `POST /api/v1/scene` returns `mode="raw"` and `reason="timeout"`.

---

#### B2-09 · med · `backend/app/vision/openai_provider.py:85-90`
- **What is wrong:** `OpenAIProvider` uploads uncompressed 10 MB base64 images in JSON body, causing payload bloat (~14 MB) and frequent 8-second upload timeouts.
- **Concrete failure scenario:** A user uploads a 10 MB JPEG. `OpenAIProvider.extract` encodes `image` directly into a base64 data URL (`13.98 MB`). The resulting JSON payload sent to `https://api.openai.com/v1/chat/completions` is ~14 MB. On typical mobile/cloud uplink speeds (5-10 Mbps), uploading 14 MB takes 11-22 seconds, guaranteed to exceed the 8.0s `call_timeout`. In contrast, `NebiusProvider` calls `fit_image_for_inline(image, 1_500_000)` before sending.
- **Proposed minimal fix:** In `OpenAIProvider.extract`, call `fit_image_for_inline(image)` before base64 encoding.
- **Proposed test:** Assert `OpenAIProvider.extract` on a 9 MB image downscales the payload before making the HTTP POST.

---

#### B2-10 · med · `backend/app/validate.py:79-86`
- **What is wrong:** `_clamp_coord` fails to check `math.isnan()`, silently converting `NaN` coordinates into `1.0` instead of dropping invalid elements.
- **Concrete failure scenario:** A provider returns `{"id": "A", "x": NaN, "y": 0.5}`. In `_clamp_coord`, `v = float(value)`. Comparisons with NaN evaluate to False (`NaN < -0.02` is False, `NaN > 1.02` is False). Then `min(1.0, float('nan'))` returns `1.0`, and `max(0.0, 1.0)` returns `1.0`. The NaN coordinate is silently accepted and moved to `x = 1.0` rather than being rejected or dropped.
- **Proposed minimal fix:** In `_clamp_coord`, add `if not math.isfinite(v): return None`.
- **Proposed test:** Pass `{"id": "A", "x": float("nan"), "y": 0.5}` to `_repair_coords` and verify the point is dropped.

---

#### B2-11 · med · `backend/app/image_utils.py:121`
- **What is wrong:** `sniff_image_dimensions` overwrites parsed EXIF orientation if a secondary APP1 segment (e.g. XMP) is present.
- **Concrete failure scenario:** A smartphone JPEG contains an Exif APP1 segment (orientation 6) followed by an XMP APP1 segment. At line 121, `orientation = _parse_exif_orientation(...)` parses orientation 6 on the first segment. When the loop encounters the second APP1 (XMP), `_parse_exif_orientation` returns `None`. Line 121 overwrites `orientation` with `None`. When SOF is parsed, orientation is lost, causing dimensions not to be swapped and EXIF rotation to be lost.
- **Proposed minimal fix:** At line 121: `parsed_ori = _parse_exif_orientation(...); if parsed_ori is not None: orientation = parsed_ori`.
- **Proposed test:** Test `sniff_image_dimensions` on a JPEG with dual APP1 segments (Exif orientation 6 + XMP) and verify swapped dimensions.

---

#### B2-12 · med · `backend/app/validate.py:260-265` & `backend/app/vision/_openai_compat.py:34-36`
- **What is wrong:** Markdown fence stripping anchors strictly to `^`, failing on code blocks preceded by conversational prose and causing unnecessary Raw Mode fallbacks.
- **Concrete failure scenario:** A vision model returns: `"Here is the diagram scene:\n```json\n{\"kind\": \"geometry\", ...}\n```"`. The regex in `_openai_compat.strip_fences` and `gemini.py` uses `^```(?:json)?`, which fails to match because of leading prose. In `validate_scene`, `cleaned.startswith("```")` is False. `json.loads` fails on the leading prose with `JSONDecodeError`, causing the first extraction and retry to fail and falling back to Raw Mode.
- **Proposed minimal fix:** In `strip_fences` and `validate_scene`, extract the JSON block using `re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)` or slice from the first `{` to the last `}`.
- **Proposed test:** Pass conversational text with embedded ````json {...} ```` to `validate_scene`; verify it parses successfully.

---

### Low Severity

#### B2-13 · low · `backend/app/validate.py:212-218`
- **What is wrong:** `_is_colour_shape_only` fails when labels contain trailing punctuation or hyphens (e.g. `"blue polygon."`), bypassing Requirement 3.6.
- **Concrete failure scenario:** An AI model returns a label `"blue polygon."` with a trailing full stop. `label.lower().strip().split()` yields `["blue", "polygon."]`. Because `"polygon."` has a period, it is not in `COLOUR_SHAPE_WORDS`. The check fails to reject the label, violating Requirement 3.6.
- **Proposed minimal fix:** Strip punctuation before checking: `words = re.sub(r"[^\w\s]", "", label.lower()).split()`.
- **Proposed test:** Pass label `"blue polygon."` to `_is_colour_shape_only`; verify it returns True.

---

#### B2-14 · low · `backend/app/main.py:598-607`
- **What is wrong:** Raw scene with 1 isolated point and 0 segments is not rejected as an empty scene.
- **Concrete failure scenario:** An image produces only micro-segments (< merge_tol) where both endpoints collapse into a single point (`p_a == p_b`). `segments` is empty, but `point_registry` contains 1 point. `main.py` checks `len(points) == 0 and len(segments) == 0 ...`, so the check passes. A scene with 1 point and 0 segments is returned as Raw Mode, providing zero tactile vibration lines.
- **Proposed minimal fix:** In `main.py` line 598, require `len(raw_scene.segments) == 0 and len(raw_scene.polylines) == 0` for Raw Mode to be considered empty.
- **Proposed test:** Test `run_raw_mode` with a scene containing 1 point and 0 segments; verify it raises 422.

---

#### B2-15 · low · `backend/app/validate.py:165-185`
- **What is wrong:** `_drop_dangling_segments` runs before `_dedupe_ids`, allowing duplicate point IDs to become degenerate zero-length segments (`a == b`).
- **Concrete failure scenario:** A model returns two points with duplicate id `"A"` and a segment with endpoints `a: "A", b: "A"`. `_drop_dangling_segments` keeps the segment. Then `_dedupe_ids` renames the second point to `"A_2"`. The segment remains connecting point `"A"` to itself.
- **Proposed minimal fix:** Run `_dedupe_ids` before `_drop_dangling_segments`, and drop segments where `s["a"] == s["b"]`.
- **Proposed test:** Pass a scene with duplicate point ID and segment connecting them to `validate_scene`; verify `a != b` or degenerate segment dropped.

---

#### B2-16 · low · `backend/app/vision/_openai_compat.py:67-77`
- **What is wrong:** Safety refusals in OpenAI-compatible API responses are reported as `"empty content in response"` rather than capturing `message.get("refusal")`.
- **Concrete failure scenario:** OpenAI returns `{"message": {"role": "assistant", "content": null, "refusal": "Safety violation"}}`. `parse_chat_response` checks `not content` and raises `VisionError("openai", "empty content in response")`. The true reason is lost from logs.
- **Proposed minimal fix:** Check `refusal = message.get("refusal")` and raise `VisionError(name, f"refusal: {refusal}", status_code=status, transient=False)`.
- **Proposed test:** Pass a response dictionary with `content=None` and `refusal="Refused"` to `parse_chat_response`; verify `exc.reason` contains `"refusal"`.

---

#### B2-17 · low · `backend/app/main.py:249, 730`
- **What is wrong:** `get_improve_provider()` instantiates a new `GeminiProvider` and `genai.Client` on every request.
- **Concrete failure scenario:** Each time `process_scene` runs with `GEMINI_IMPROVE_MODEL` configured, `get_improve_provider` creates a fresh `genai.Client`, creating new connection pools rather than reusing an existing client across requests.
- **Proposed minimal fix:** Cache the improve provider instance similar to `_cached_chain`.
- **Proposed test:** Call `get_improve_provider()` twice in succession and assert identical instance or shared client.

---

## Sound Areas (Verified)
- **Magic byte sniffing & dimension capping (`image_utils.py`):** Verified sound against PNG (IHDR), JPEG (SOF0..SOF15), and WebP (VP8/VP8L/VP8X) header extraction, rejecting files >12 MP before OpenCV decode.
- **Body size limits & streaming guard (`limits.py`):** Verified sound with `RequestGuardMiddleware` rejecting uploads >10 MB + 256 KB overhead with HTTP 413 before multipart buffering.
- **Mathematical expression parser & evaluator (`graphs/expr.py`):** Verified sound with recursive descent parser, depth cap (24), length cap (200), node cap (200), exponent cap (12), zero eval/exec, and safe float/nan handling.
- **Equation sampling & graph spec parser (`graphs/sample.py`):** Verified sound with range checking, asymptote jump splitting, and strict bounds on sample counts (2..400).
- **Scene cache concurrency & LRU TTL eviction (`scene_cache.py`):** Verified sound with `threading.Lock`, deepcopy protection, and strict `mode == 'ai'` requirement preventing caching of raw fallback or failed scenes.
- **Rate limiting & peer identity resolution (`limits.py`):** Verified sound with trusted proxy hop counting from the right of `X-Forwarded-For` and automatic sweep of expired client buckets.
- **Secret redaction in error messages and logs (`base.py`, `gemini.py`, `_openai_compat.py`):** Verified sound with regex replacement of Bearer tokens and literal API key strings across all provider logs.

---

## Top 5 to Fix First
1. **B2-01 (`main.py:713`):** Fix AI timeout calculation to use absolute remaining deadline (`ai_deadline - time.monotonic()`) instead of relative `ai_budget`, preventing 15s budget overrun and premature 504 errors.
2. **B2-02 (`main.py:712-739`):** Implement client disconnect cancellation loop in `POST /api/v1/scene` matching `/ask` to immediately abort in-flight Gemini/OpenAI calls and release the 2-slot semaphore.
3. **B2-03 (`raw_mode.py:65-82`):** Wrap OpenCV calls in `raw_mode.py` with `try ... except cv2.error` to convert OpenCV internal assertion failures on tiny/malformed images into HTTP 422 instead of crashing with HTTP 500.
4. **B2-04 (`raw_mode.py:65-72`):** Apply EXIF orientation rotation in `raw_mode.py` so Raw Mode vibration outlines align with mobile camera portrait photos (Requirement 15.4 / SEC-04).
5. **B2-05 (`validate.py:129-147`):** Normalize inverted bar coordinates (`min/max` on `x0/x1` and `y_top/y_base`) in `validate.py` so bar chart bars are hittable on touch screens.
