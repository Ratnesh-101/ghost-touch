# Audit Report: Lane m4-round4-audit

**Status: DONE**  
**Auditor:** agy, reviewed by Claude  
**Date:** 2026-11-09  
**Scope:** Deep security, reliability, and correctness audit of recent changes from lanes
h2, h3, h4, k1, k2, k3, k6, k7, and k8 across 16 scoped files:
`backend/app/paid_budget.py`, `backend/app/limits.py`, `backend/app/main.py`,
`backend/app/validate.py`, `backend/app/semantic.py`, `backend/app/ask.py`,
`backend/app/raw_mode.py`, `backend/app/vision/prompts.py`, `frontend/src/verify/verify.ts`,
`frontend/src/flow/ask.ts`, `frontend/src/flow/navigation.ts`, `frontend/src/flow/saved.ts`,
`frontend/src/api/scene.ts`, `frontend/src/drivers/diagramStore.ts`,
`frontend/src/screens/Correct.tsx`, `frontend/vite.config.ts`.

---

## 1. Executive Summary

This audit examined recent additions and modifications across the backend AI pipeline, cost
guards, rate limiting, validation rules, raw edge fallback, frontend verification (SPEC GHOST),
offline PWA precache, and IndexedDB persistence.

Key discoveries include:
1. **Critical in-flight permit leak (`M4-01`):** Client disconnects or task cancellations while
   waiting in the semaphore queue bypass the inner `try...finally` block, permanently leaking
   per-client concurrency permits and locking out the affected IP address with HTTP 429 forever.
2. **Teacher Correct persistence drop (`M4-03`):** Teacher corrections validate successfully
   and announce "Corrections saved", but `App.tsx` never calls `saveDiagram(scene)`, causing all
   teacher corrections to be lost upon page reload or navigation.
3. **Non-atomic IndexedDB eviction in `App.tsx` (`M4-02`):** `App.tsx` was not updated to use the
   atomic `saveDiagramWithEviction` helper from lane k6, deleting the victim diagram before putting
   the new one, leading to irrecoverable data loss on storage errors.
4. **Double-submission of paid AI calls on 504 timeouts (`M4-04`):** The frontend scene client
   retries HTTP 504 Gateway Timeout as if it were a 502 cold-start, double-spending paid tokens
   on complex diagrams that already exceeded the 25-second server budget.
5. **Unhandled 500 crash on extreme aspect ratios (`M4-05`):** Uncapped `aspect` values produce
   float overflow in dot products, raising an uncaught `ValueError: math domain error` in `/ask`.

---

## 2. CONFIRMED Findings

#### M4-01 · HIGH · backend/app/main.py:580,864
- **What is wrong:** In `/api/v1/scene` and `/api/v1/ask`, `acquire_slot(sem, wait_seconds)` is
  awaited outside the `try...finally` block that releases the per-client in-flight limiter permit.
  If the client disconnects or the request coroutine is cancelled while waiting in the semaphore
  queue, `asyncio.CancelledError` is raised. The `except TimeoutError:` does not catch it, and
  the inner `try:` block is never entered. The permit count for `client_key_val` is never
  decremented, causing a permanent permit leak.
- **Concrete failure scenario:** A client IP `10.0.0.1` submits two requests while all server
  concurrency slots are busy. Both requests enter `await acquire_slot(sem, wait_seconds)`. While
  waiting in the queue, the client closes the connection or navigates away. The ASGI server
  cancels the coroutines with `asyncio.CancelledError`. The client's count remains at 2
  (`DEFAULT_CLIENT_MAX_IN_FLIGHT`). From then on, every subsequent request from that IP is
  immediately rejected with HTTP 429 (`Too many concurrent diagram requests for this client`)
  until the backend server process restarts.
- **Proposed minimal fix:** In `backend/app/main.py`, wrap the semaphore queue wait in an outer
  `try...finally` block that guarantees `limiter.release(client_key_val)` is called on every
  exit path:
  ```python
  if not limiter.acquire(client_key_val):
      raise HTTPException(status_code=429, detail="Too many concurrent requests")
  try:
      sem = get_semaphore()
      await acquire_slot(sem, wait_seconds)
      try:
          # endpoint handling...
      finally:
          sem.release()
  finally:
      limiter.release(client_key_val)
  ```
- **Proposed test:**
  ```python
  async def test_in_flight_permit_released_on_cancellation():
      from app.limits import get_scene_in_flight_limiter, reset_in_flight_limits
      from app.main import get_scene_semaphore, process_scene
      reset_in_flight_limits()
      sem = get_scene_semaphore()
      await sem.acquire()
      await sem.acquire()  # exhaust slots
      limiter = get_scene_in_flight_limiter()
      task = asyncio.create_task(process_scene(mock_request, ...))
      await asyncio.sleep(0.05)
      assert limiter.count("test_client") == 1
      task.cancel()
      with contextlib.suppress(asyncio.CancelledError):
          await task
      assert limiter.count("test_client") == 0
      sem.release()
      sem.release()
  ```

#### M4-02 · HIGH · frontend/src/App.tsx:367-372
- **What is wrong:** In `frontend/src/App.tsx`, `saveDiagram` performs diagram save and eviction
  using two separate, non-atomic operations: `await drivers.diagramStore.delete(decision.evictedId)`
  followed by `await drivers.diagramStore.put(newEntry)`. Lane k6 implemented
  `saveDiagramWithEviction` and `IDBDiagramStore.putWithEviction` to solve this exact issue (B4-04),
  but `App.tsx` was never updated to consume the new atomic API.
- **Concrete failure scenario:** The saved diagram store is at its capacity of 10 diagrams. The
  user captures an 11th diagram. `applyAdd` selects an unpinned diagram to evict. `App.tsx:368`
  deletes the victim diagram from IndexedDB. Immediately afterward, line 371 calls `put(newEntry)`.
  If `put` fails (due to `QuotaExceededError`, device storage exhaustion, or browser termination),
  the victim diagram is already permanently deleted, and the new diagram was not saved. Two
  diagrams are lost instead of zero.
- **Proposed minimal fix:** Update `saveDiagram` in `frontend/src/App.tsx:361-377` to invoke
  `saveDiagramWithEviction` from `frontend/src/flow/saved.ts`:
  ```typescript
  const result = await saveDiagramWithEviction(
    drivers.diagramStore,
    existing,
    newEntry,
    SAVED_DIAGRAMS_CAP,
  );
  if (!result.ok) {
    const key = result.error === 'all_pinned'
      ? 'saved.errorAllPinned'
      : 'saved.errorSave';
    drivers.speech.speak(t(key), LANG_BCP47[currentLang]);
  }
  ```
- **Proposed test:**
  ```typescript
  it('does not delete victim diagram if put fails', async () => {
    const store = new MemoryDiagramStore();
    store.putWithEviction = async () => ({ ok: false, error: 'quota_exceeded' });
    const existing = [createSampleSavedEntry('victim-1')];
    const newEntry = createSampleSavedEntry('new-1');
    const res = await saveDiagramWithEviction(store, existing, newEntry, 1);
    expect(res.ok).toBe(false);
    expect((await store.get('victim-1')).value).toBeDefined();
  });
  ```

#### M4-03 · HIGH · frontend/src/App.tsx:430-435
- **What is wrong:** When a teacher saves edits in Teacher Correct mode, `handleSaveCorrect` in
  `frontend/src/App.tsx` navigates to `explore` and speaks the Explore announcement, but never calls
  `saveDiagram(scene)` to persist the corrected diagram to IndexedDB, nor does it update
  `lastExploreScene.current`.
- **Concrete failure scenario:** A teacher opens Teacher Correct mode (`#/correct`), repositions
  misaligned points, fixes labels, and clicks "Save". The screen announces "Corrections saved."
  (`correct.saved`) and loads the Explore screen. The teacher explores the corrected diagram. Later,
  the user closes the tab or navigates to "Saved diagrams". The corrected diagram was never saved
  to `diagramStore`; only the original erroneous AI scene remains in storage. All teacher edits are
  permanently lost. Additionally, pressing Android Back from Explore returns to the stale
  uncorrected `lastExploreScene.current`.
- **Proposed minimal fix:** In `frontend/src/App.tsx:430-435`, update `lastExploreScene.current`
  and invoke `saveDiagram(scene)`:
  ```typescript
  const handleSaveCorrect = (scene: DiagramScene): void => {
    leaveCorrectEntry();
    lastExploreScene.current = scene;
    const announced = exploreAnnouncement(scene, 'ai');
    drivers.speech.speak(announced, LANG_BCP47[currentLang]);
    setView({ screen: 'explore', scene, announced });
    void saveDiagram(scene);
  };
  ```
- **Proposed test:**
  ```typescript
  it('persists corrected scene to diagramStore upon saving in Teacher Correct mode', async () => {
    const store = new MemoryDiagramStore();
    // Simulate handleSaveCorrect call with corrected scene
    handleSaveCorrect(correctedScene);
    const list = await store.list();
    expect(list.value?.some(e => e.scene === correctedScene)).toBe(true);
  });
  ```

#### M4-04 · HIGH · frontend/src/api/scene.ts:76-78,180-212
- **What is wrong:** `isGatewayStatus` in `frontend/src/api/scene.ts` includes both HTTP 502 and
  HTTP 504. When the server times out processing a diagram (returning HTTP 504), the client assumes
  the server is in cold-start sleep, speaks "Waking up the server…", and re-submits the exact same
  image in a second POST request. Because failed scenes are never cached, this causes expensive
  paid AI model calls to be double-submitted.
- **Concrete failure scenario:** A student uploads a complex diagram. The backend vision pipeline
  spends 25 seconds attempting Gemini, validation retries, and Raw Mode before timing out and
  returning HTTP 504. The frontend receives 504, speaks `capture.wakingUp`, waits 3 seconds, and
  sends a second full upload request to `/api/v1/scene`. The server runs the entire 25-second AI
  extraction chain a second time, consuming double the daily paid token budget and taking another
  25 seconds before failing again with 504. The client then speaks `capture.errorGateway` ("The
  server is waking up. Please try again in a few seconds."), deceiving the user into retrying a
  third time.
- **Proposed minimal fix:** In `frontend/src/api/scene.ts:76-78`, restrict waking retry strictly to
  HTTP 502 (reverse proxy container boot). For HTTP 504 (timeout), throw `SceneRequestError('timeout')`
  immediately without retrying:
  ```typescript
  function isGatewayStatus(status: number): boolean {
    return status === 502;
  }
  ```
- **Proposed test:**
  ```typescript
  it('does not retry POST /scene on HTTP 504 Gateway Timeout', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response(JSON.stringify({ detail: 'timeout' }), { status: 504 });
    };
    await expect(requestScene(blob, { fetchImpl: mockFetch as any }))
      .rejects.toThrow('timeout');
    expect(callCount).toBe(1);
  });
  ```

#### M4-05 · HIGH · backend/app/semantic.py:675, backend/app/ask.py:951
- **What is wrong:** `DiagramScene.aspect` in `backend/app/schema.py` and `backend/app/validate.py`
  has no upper bound constraint. If a diagram contains a large aspect ratio (e.g. `aspect = 1e200`),
  scaling x-differences in `_find_right_angle` (`backend/app/semantic.py:667`) results in vector
  magnitudes of `inf`, producing `nan` in cosine calculations. `math.acos(nan)` raises an unhandled
  `ValueError: math domain error`, causing `POST /api/v1/ask` to crash with HTTP 500.
- **Concrete failure scenario:** A scene with `aspect: 1e200` is parsed by `validate_scene` (which
  allows any finite `asp > 0.0`). The user asks "Is there a right angle?". In `app/ask.py:951`,
  `_semantic_ask(scene, question, lang)` is called before model completion. In `_find_right_angle`:
  `v1[0] = (p1.x - p.x) * 1e200` overflows float multiplication in `dot` and `len1 * len2`.
  `dot / (len1 * len2)` evaluates to `nan`. `math.acos(nan)` raises `ValueError: math domain error`.
  Because line 951 has no `try...except`, the exception crashes the route with HTTP 500.
- **Proposed minimal fix:**
  1. In `backend/app/validate.py:284`, bound `aspect` to reasonable diagram dimensions ($[0.05, 20.0]$):
     ```python
     if math.isfinite(asp) and 0.05 <= asp <= 20.0:
         data["aspect"] = asp
     else:
         data["aspect"] = 1.0
     ```
  2. In `backend/app/semantic.py:674`, check `math.isfinite(dot)` and `len1 * len2 > 0` before `acos`.
  3. In `backend/app/ask.py:951`, wrap `_semantic_ask` in a defensive `try...except Exception:`.
- **Proposed test:**
  ```python
  def test_extreme_aspect_ratio_does_not_crash_semantic_ask():
      scene = DiagramScene(
          kind="geometry",
          aspect=1e200,
          points=[Point(id="A", x=0.0, y=0.0), Point(id="B", x=0.5, y=0.0), Point(id="C", x=0.0, y=0.5)],
          segments=[Segment(id="AB", a="A", b="B"), Segment(id="AC", a="A", b="C")],
      )
      res = semantic_ask(scene, "where is the right angle")
      assert res is not None
  ```

#### M4-06 · MED · backend/app/limits.py:90-93
- **What is wrong:** IPv6 addresses with zone/scope IDs (e.g. `fe80::1%eth0` or `[fe80::1%12]:8080`)
  fail standard `ipaddress.ip_address` parsing. `_normalize_ip_key` catches `ValueError` and falls
  back to returning `raw[:MAX_CLIENT_KEY_CHARS]`. Because `raw` retains the unstripped ephemeral
  client port, every new TCP connection from the same link-local client produces a different key,
  completely bypassing per-client rate limits and in-flight tracking.
- **Concrete failure scenario:** A client on a local link connects via `[fe80::1%eth0]:54321`.
  Brackets are stripped to `fe80::1%eth0`. `ipaddress.ip_address` raises `ValueError` on the `%` zone
  index. Line 93 returns `raw[:64]` (`"[fe80::1%eth0]:54321"`). The next request from the same client
  uses port 54322, returning `"[fe80::1%eth0]:54322"`. Because the keys differ on every port, the
  client can exceed rate limits and concurrency caps without restriction.
- **Proposed minimal fix:** In `backend/app/limits.py:_normalize_ip_key`, strip any zone identifier
  (`%...`) before calling `ipaddress.ip_address`, and return `cleaned[:MAX_CLIENT_KEY_CHARS]` on
  `ValueError`:
  ```python
  if "%" in cleaned:
      cleaned = cleaned.split("%")[0]
  ```
- **Proposed test:**
  ```python
  def test_ipv6_zone_id_and_port_normalizes_to_64_network():
      k1 = _normalize_ip_key("[fe80::1%eth0]:5000")
      k2 = _normalize_ip_key("[fe80::2%eth0]:6000")
      assert k1 == k2 == "fe80::/64"
  ```

#### M4-07 · MED · backend/app/main.py:627,760
- **What is wrong:** `/api/v1/scene` only checks `await request.is_disconnected()` before starting
  vision processing (line 627) and before running Raw Mode (line 640). While the model calls in
  `attempt_ai()` are executing (which can take 15–25 seconds across fallback providers), there is
  no disconnect polling.
- **Concrete failure scenario:** A user uploads a photo, but cancels the upload or closes the app
  after 1 second. In `/api/v1/ask`, `ASK_DISCONNECT_POLL_SECONDS` polls every 250ms and cancels the
  task. In `/api/v1/scene`, the server continues running Gemini, OpenAI, and Nebius requests and
  retries to completion over 15–25 seconds, consuming paid budget and holding a concurrency slot
  for a client that is no longer listening.
- **Proposed minimal fix:** Run `attempt_ai()` as a task and poll `request.is_disconnected()` every
  250 ms (matching the pattern in `/api/v1/ask:880-886`), cancelling the extraction task on disconnect.
- **Proposed test:**
  ```python
  async def test_scene_ai_cancelled_on_client_disconnect():
      # Start process_scene with slow provider, trigger disconnect, assert provider is cancelled
      ...
  ```

#### M4-08 · MED · backend/app/validate.py:38,401
- **What is wrong:** `CLAMP_TOLERANCE = 0.02` (2%) is overly tight for vision models. When an AI
  provider extracts a geometry vertex with coordinates slightly outside the diagram boundary
  (e.g. $x = 1.025$), `_clamp_coord` returns `None`. Because the point is used by diagram segments,
  `_check_dropped_references` invalidates the scene. Ordinary slightly-off AI scenes are rejected
  and fall back to degraded Raw Mode too frequently.
- **Concrete failure scenario:** An AI model extracts a triangle where point $B$ has coordinates
  $(0.5, 1.025)$ because the vertex touched the bottom edge of the diagram. With 2% tolerance,
  $1.025$ exceeds $1.02$ and is dropped. `_check_dropped_references` fails validation because $B$
  was used by segments $AB$ and $BC$. The user receives Canny edge outlines (Raw Mode) without
  labels or facts, even though the triangle was accurately detected.
- **Proposed minimal fix:** Widen `CLAMP_TOLERANCE` in `backend/app/validate.py:38` to `0.05` (5%),
  allowing minor coordinate overshoots to clamp smoothly to $1.0$ or $0.0$ while still rejecting
  hallucinated elements beyond 5%.
- **Proposed test:**
  ```python
  def test_minor_boundary_overshoot_clamps_without_invalidating_referenced_point():
      data = {
          "version": 1, "kind": "geometry",
          "points": [{"id": "A", "x": 0.0, "y": 0.0}, {"id": "B", "x": 1.03, "y": 0.5}],
          "segments": [{"id": "s1", "a": "A", "b": "B"}]
      }
      res = validate_scene(data)
      assert res.scene is not None
      assert res.scene.points[1].x == 1.0
  ```

#### M4-09 · LOW · frontend/vite.config.ts:45-64
- **What is wrong:** In `frontend/vite.config.ts`, `pdf-*.js` (~484 KiB) and `pdf.worker.min-*.mjs`
  (~1.26 MiB) were added to the initial PWA service worker precache, increasing the initial precache
  bundle size from ~659 KiB to ~2.4 MB. Simultaneously, lines 48-63 define a `runtimeCaching` rule
  for `/\/assets\/pdf.*/` which is rendered dead/shadowed because precached assets take precedence.
- **Concrete failure scenario:** Every student on a low-end phone or slow mobile network in India
  must download 2.4 MB on first install and on every application update, even if they never use the
  PDF upload feature. The `runtimeCaching` rule configured for PDF assets is never hit because
  Workbox serves the precached copies.
- **Proposed minimal fix:** Exclude the heavy PDF worker and bundle from initial precaching
  (`globIgnores: ['**/pdf*']`), allowing the configured `runtimeCaching` rule to lazily download
  and cache the PDF worker on demand only when a PDF file is selected.
- **Proposed test:** A build test verifying that precache entries count remains $\le 15$ and
  excludes `pdf.worker`.

#### M4-10 · LOW · frontend/src/verify/verify.ts:571
- **What is wrong:** In `frontend/src/verify/verify.ts:571`, angle discrepancy findings hardcode the
  English word `"angle "` into the target string (`targetName = angle ${angleFact.vertex}`).
  When `navigation.ts:28` interpolates `{name}` into Hindi or Gujarati strings, the English noun
  "angle" leaks into the speech output.
- **Concrete failure scenario:** A user with language set to Hindi explores a triangle where angle
  $C$ is disputed. The spoken caveat announces:
  `"तथ्य और चित्र angle C पर असहमत हैं। मैं नहीं बता सकता कि कौन सा सही है।"`
  The English word `"angle "` is spoken by the Hindi TTS voice instead of the native Hindi term
  "कोण" or simply the vertex identifier "C".
- **Proposed minimal fix:** Strip the `"angle "` prefix from the finding target so only the vertex
  identifier (e.g. `"C"`) is interpolated into the localized string template:
  ```typescript
  const targetName = angleFact.vertex.replace(/^angle\s+/i, '');
  ```
- **Proposed test:**
  ```typescript
  it('does not leak english word angle into hindi verify caveat', () => {
    setLang('hi');
    const caveat = verifyCaveatForScene(disputedAngleScene, 'ai');
    expect(caveat).not.toContain('angle');
  });
  ```

---

## 3. SUSPECTED Findings

#### M4-11 · LOW · backend/app/main.py:663-666
- **What is wrong:** In `backend/app/main.py:663-666`, when `build_raw_scene` times out,
  `except TimeoutError:` sets `cancel_event` and immediately performs an unbounded `await raw_task`.
  If OpenCV is blocked inside a long C++ native call (such as `cv2.findContours` on a large image),
  the thread cannot check `_check_cancel` immediately.
- **Concrete failure scenario:** A large or noisy image causes OpenCV contour finding to take 3
  seconds. The timeout triggers at 2.5 seconds. `await raw_task` holds the asyncio event loop
  coroutine for an additional 3 seconds before sending the HTTP 504 response, delaying client
  notification and holding the semaphore slot.
- **Proposed minimal fix:** Place a bounded timeout on waiting for worker termination:
  ```python
  try:
      await asyncio.wait_for(asyncio.shield(raw_task), timeout=0.5)
  except Exception:
      pass
  ```
- **Proposed test:** Mock a worker thread that delays exit after `cancel_event.set()` and assert
  `process_scene` returns 504 without waiting more than 600 ms.

#### M4-12 · LOW · backend/app/main.py:524, backend/app/image_utils.py:165
- **What is wrong:** Docstrings in `main.py` and `image_utils.py` describe a 40 MP image resolution
  cap (`<=40 MP`), but the code enforces `MAX_IMAGE_PIXELS = 12_000_000` (12 MP).
- **Concrete failure scenario:** A developer or user submits a valid 16 MP diagram expecting it to
  succeed per the docstring, but receives HTTP 422 (`resolution exceeds 12 MP limit`).
- **Proposed minimal fix:** Align docstrings to state `12 MP`.
- **Proposed test:** Regex docstring check asserting 12 MP is documented.

---

## 4. UNVERIFIED Areas (Requiring Phone / Screen Reader / Live Host)

1. **Physical TalkBack gesture interaction (UNVERIFIED):** The double-tap-and-hold pass-through
   gesture and relative cursor haptics require physical verification on an Android smartphone
   running Google TalkBack (`docs/OWNER_CHECKLIST.md`).
2. **Physical haptic vibration feel (UNVERIFIED):** Motor response to line buzz and corner patterns
   requires physical hardware verification.
3. **Live Render cold boot timing (UNVERIFIED):** The 65-second client timeout vs. real Render free
   tier cold starts (30–60 s) requires live probe on deployed infrastructure.

---

## 5. Sound Areas (Checked and Verified)

- **`paid_budget.py` date rollover and thread safety:** UTC date tracking is thread-locked and
  resets cleanly across day boundaries. Zero budget (`PAID_CALLS_PER_DAY=0`) immediately disables
  paid calls and triggers graceful fallback.
- **Spoken failure resilience:** When budget is exhausted, a blind student hears the spoken Raw
  Mode outline announcement or deterministic facts / "I don't know" answer; never silence.
- **`limits.py` rate limiter table management:** Sweep frequency is throttled to at most once per
  second; table size is hard-capped at 50,000 keys with LRU eviction.
- **Safe Content-Length parsing:** Validates ASCII digits and $\le 18$ characters; Latin-1
  superscripts and $>4300$ digit strings safely return 400/413 without raising 500.
- **`raw_mode.py` resource limits:** Downscales images to max 1600 px before edge detection;
  caps contours to ~2000 and deduplication to 1000 candidates; cooperative cancellation checked
  across all stages.
- **`verify.ts` phrasing integrity:** Never says "verified" or "trust the text"; unparsed facts
  are silently ignored without throwing or looping; announcements are joined into a single
  spoken utterance.

---

## 6. Top 5 to Fix First

1. **M4-01 (`backend/app/main.py:580,864`):** Wrap queue semaphore wait in `try...finally` to
   prevent permanent client IP lockout on connection cancellation.
2. **M4-02 (`frontend/src/App.tsx:367-372`):** Consume `saveDiagramWithEviction` in `App.tsx`
   to eliminate data loss when IndexedDB put fails during eviction.
3. **M4-03 (`frontend/src/App.tsx:430-435`):** Wire `saveDiagram(scene)` into `handleSaveCorrect`
   so teacher corrections are actually persisted to IndexedDB.
4. **M4-04 (`frontend/src/api/scene.ts:76,180`):** Exclude HTTP 504 from cold-start retries to
   stop double-submitting paid AI vision extraction calls.
5. **M4-05 (`backend/app/semantic.py:675`, `backend/app/ask.py:951`):** Bound `aspect` in
   `validate.py` and wrap `_semantic_ask` in try/except to prevent 500 crashes on extreme aspect ratios.

> **Supervisor note (2026-11-09):** M4-02 verified on main (`saveDiagramWithEviction` is defined in flow/saved.ts and never called, so the k6 atomic-save fix is not in effect in the app) and the 502/504 retry of M4-04 exists (`api/scene.ts:77`). The other findings are unverified until the fix lanes n1 (backend) and n2 (frontend) check them against the current code.
