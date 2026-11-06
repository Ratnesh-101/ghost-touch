# Security Audit Report: Lane a6-security-fullstack

**Lane:** `a6-security-fullstack`  
**Auditor:** Antigravity (`agy`, headless audit)  
**Date:** 2026-11-06  
**Status:** COMPLETE (Audit Only — zero source, test, or config code modified)  
**Scope:** Full-stack application security:
- Backend: `backend/app/**`, `backend/requirements.lock`, `backend/pyproject.toml`, `render.yaml`
- Frontend: `frontend/vercel.json`, `frontend/index.html`, `frontend/vite.config.ts`, `frontend/src/api/**`, `frontend/src/drivers/**`, `frontend/src/share/**`, `frontend/src/screens/**`
- Repository & Workflows: `.github/workflows/*`, `.gitignore`, `scripts/**`
- Verification against `docs/briefs/guide-share-contract.md`, `docs/briefs/audit-common.md`, and `docs/briefs/audit-a6-security-fullstack.md`

---

## Executive Summary

A comprehensive full-stack security review was conducted across the Ghost Touch application, covering the vision pipeline, question answering (`/ask`), diagram validation, teacher verify-and-share, driver integrations, hosting configs (Vercel & Render), and CI pipelines.

Baseline verification confirmed strong architectural discipline in core areas:
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or dynamic code execution in frontend components.
- Zero cookies, zero auth tokens or secrets stored in `localStorage` or `IndexedDB`.
- Pure AST mathematical parsing (`backend/app/graphs/expr.py`) without `eval`/`exec`.
- Strict stripping of prompt delimiters (`<user_question>`) and JSON escaping of element IDs in `ask.py`.
- No server-side request forgery (SSRF) or path traversal vulnerabilities in routes or provider calls.

However, the audit identified **5 High**, **5 Medium**, and **4 Low** confirmed vulnerabilities, alongside **2 Suspected** issues. Critical findings include:
1. **`X-Forwarded-For` spoofing in `limits.py`**: Rate limits can be trivially bypassed by supplying arbitrary client IP headers, leaving paid LLM endpoints vulnerable to cost exhaustion.
2. **Unbounded memory leak in `_HITS`**: Empty rate-limit deques are never pruned, causing monotonic memory growth and risk of OOM on Render.
3. **Uncapped concurrency on `POST /api/v1/ask`**: Unlike `/scene` (semaphore=2), `/ask` allows unbounded parallel LLM completions.
4. **Missing Content-Security-Policy (CSP)**: Completely absent from `frontend/vercel.json`, `frontend/index.html`, and `backend/app/middleware.py`.
5. **Trailing slash rate limit bypass**: Requests to `/api/v1/scene/` or `/api/v1/ask/` bypass `RequestGuardMiddleware` body and rate checks due to unnormalized path lookup.

---

## Baseline Verification Commands
All required whitelisted commands were executed from the repo root and passed cleanly:
- `npm --prefix frontend test`: **110 test files passed (1518 tests)**
- `npm --prefix frontend exec -- tsc -p frontend --noEmit`: **Clean (0 errors)**
- `npm --prefix frontend run build`: **Built clean in 224ms** (`dist/` assets, PWA sw.js and workbox generated)
- `backend/.venv/Scripts/python -m pytest backend`: **474 passed, 1 skipped (0 failures)**
- `backend/.venv/Scripts/python -m ruff check backend`: **All checks passed**
- `backend/.venv/Scripts/python -m ruff format --check backend`: **63 files formatted**

---

## Sound Areas (Verified Clean)

- **SSRF and Outbound URL Control**: Outbound calls in `_openai_compat.py`, `openai_provider.py`, and `nebius.py` construct URLs exclusively from server-side environment variables (`OPENAI_BASE_URL`, `NEBIUS_BASE_URL`). No user-controlled parameters influence hostnames or protocols.
- **Path Traversal**: No backend routes accept file paths or perform filesystem operations based on request data. The frontend sample diagram loader (`frontend/src/api/scene.ts`) strictly constrains sample IDs to the constant tuple `['triangle', 'sine', 'barchart']`.
- **XSS & DOM Sink Hygiene**: Zero occurrences of `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval`, or `new Function` across all frontend screens and components (`VerifiedBanner`, `TeachCanvas`, `SharePanel`, `VerifyForm`, `StatusText`, `Explore`, `Correct`). All text is rendered as React text children with `<bdi>` isolation.
- **Prompt Injection & Delimiter Escaping**: In `backend/app/ask.py`, student question strings are sanitized via `QUESTION_TAG_PATTERN` to strip `<user_question>` tags before prompt construction. Element IDs are escaped via `json.dumps()`, and system instructions explicitly command the model to treat scene strings as untrusted data.
- **Target Extraction and Schema Invariants**: `validate_ask_target` strictly requires `set(raw_target.keys()) == {"elementId"}` or `{"x", "y"}`. Extra keys are rejected. Coordinates outside `[0.0, 1.0]` and non-finite floats are discarded. `target` is unconditionally set to `None` on all fallback and "don't know" paths.
- **No Cookie Usage**: No cookies are set, read, or expected in frontend or backend code.
- **Browser Storage Hygiene**: Neither `localStorage` nor `IndexedDB` stores tokens, credentials, or PII. Storage is strictly limited to UI preferences (`gt_language`, `gt_speech_rate`, feature flags) and local diagram vector scenes.
- **Service Worker Scoping**: Workbox in `frontend/vite.config.ts` runtime caching is strictly scoped to `/\/assets\/pdf.*/`. API responses (`/api/v1/*`) and student open data are never cached by the service worker.
- **Mathematical Expression Safety**: `backend/app/graphs/expr.py` implements a pure recursive-descent AST parser without `eval` or `exec`, bounded by strict length (200), depth (24), node count (200), and exponent magnitude (12.0) limits.
- **Secrets Management**: No secret keys exist in git. `.gitignore` excludes `.env` and `.env.*` while committing `.env.example`. `scripts/agy-run.sh` explicitly unsets all Google and Gemini API keys before invoking the agent.
- **Prototype Pollution Prevention**: `decodeShare` in `frontend/src/share/codec.ts` strips `__proto__`, `constructor`, and `prototype` via a JSON reviver, and pre-checks bracket nesting depth (`checkNestingDepth(json, 32)`) prior to parsing.

---

## Confirmed Findings

### CONFIRMED · HIGH

#### A6-01 · high · `backend/app/limits.py:118-124`
- **What is wrong**:
  `RequestGuardMiddleware._client_key` takes the leftmost IP from `X-Forwarded-For` (`forwarded.split(",")[0].strip()`). In standard reverse proxy configurations (such as Render's reverse proxy and load balancers), the proxy appends the real client IP to the incoming `X-Forwarded-For` header. The leftmost IP is completely attacker-controlled. An attacker can supply an arbitrary IP address on each request (or rotate fake IPs), granting themselves an infinite request budget and completely bypassing rate limits on `/api/v1/scene` and `/api/v1/ask`.
- **Concrete failure scenario**:
  1. An attacker wants to abuse `/api/v1/scene` or `/api/v1/ask` without hitting the 20 or 40 req/min limits.
  2. Request 1: `curl -H "X-Forwarded-For: 1.1.1.1" -F "image=@diagram.png" https://.../api/v1/scene`. Handled by bucket `("1.1.1.1", "/api/v1/scene")`.
  3. After 20 requests, bucket 1 is exhausted.
  4. Attacker changes header: `X-Forwarded-For: 1.1.1.2`. Middleware sees new client `"1.1.1.2"`, resetting the budget to 0/20.
  5. The attacker loops over `1.1.1.X`, making thousands of unauthenticated requests per minute to paid vision LLMs.
- **Proposed minimal fix**:
  When running behind Render, configure Uvicorn with `--proxy-headers` and trusted proxy IPs so that `scope["client"]` is securely populated by Uvicorn. In `limits.py`, do not blindly trust the leftmost `X-Forwarded-For` header; instead, inspect `scope["client"]` or parse the rightmost trusted proxy hop.
- **Proposed test**:
  ```python
  def test_x_forwarded_for_spoofing_does_not_bypass_rate_limit(client):
      for i in range(25):
          r = client.post(
              "/api/v1/ask",
              headers={"X-Forwarded-For": f"10.0.0.{i}"},
              json={"scene": triangle_scene().model_dump(), "question": "What is AB?"},
          )
      assert r.status_code == 429
  ```

#### A6-02 · high · `backend/app/limits.py:33, 125-134`
- **What is wrong**:
  `_HITS: dict[tuple[str, str], deque[float]] = defaultdict(deque)` accumulates a `(client, path)` key for every unique client IP that makes a request. In `_allow()`, while expired timestamps are popped from `window` via `window.popleft()`, the empty `deque` is never removed from `_HITS`. Over time (or under an IP-rotating crawler/attacker), `_HITS` retains millions of empty deque entries, causing monotonic memory growth and eventually an Out-Of-Memory (OOM) crash on Render's 512 MB memory limit.
- **Concrete failure scenario**:
  1. Service runs continuously for several weeks or receives traffic from web bots and mobile clients on dynamic IPs.
  2. 500,000 distinct IP addresses connect over time.
  3. `_HITS` retains 500,000 keys with empty deques.
  4. Memory consumption grows continually until the Render web service crashes with `OOMKilled`.
- **Proposed minimal fix**:
  When `window` becomes empty after popping expired timestamps, clean up the dictionary key:
  ```python
  while window and now - window[0] > RATE_WINDOW_SECONDS:
      window.popleft()
  if not window:
      _HITS.pop((client, path), None)
  ```
- **Proposed test**:
  ```python
  def test_rate_limit_prunes_empty_windows_after_expiry():
      from app.limits import _HITS, RequestGuardMiddleware
      # Verify that after expiry, key (client, path) is deleted from _HITS
      ...
  ```

#### A6-03 · high · `backend/app/main.py:622-632`
- **What is wrong**:
  `/api/v1/scene` uses `_scene_semaphore = asyncio.Semaphore(parse_scene_max_concurrency())` (default 2) to limit concurrent heavy model and processing calls. In contrast, `/api/v1/ask` has **zero concurrency semaphore**. A flood of concurrent requests (or 50 browser tabs) will dispatch 50 simultaneous LLM text-completion calls to Gemini / OpenAI / Nebius, exhausting provider concurrency limits (HTTP 429), blowing through paid token quotas, and overloading server resources.
- **Concrete failure scenario**:
  1. An anonymous attacker or automated script fires 50 concurrent `POST /api/v1/ask` requests at the exact same instant (e.g. using `curl --parallel` or `asyncio`).
  2. All 50 requests bypass any concurrency guard and invoke `chain.complete(prompt, ...)`.
  3. The vision/language provider immediately rejects requests with 429 quota exhaustion or runs up massive API token charges.
- **Proposed minimal fix**:
  Introduce `_ask_semaphore` (configurable via `ASK_MAX_CONCURRENCY`, default e.g. 4) or a shared semaphore for all paid model calls. Acquire with a short timeout (`ASK_QUEUE_WAIT_SECONDS`), returning HTTP 503 if busy.
- **Proposed test**:
  ```python
  @pytest.mark.asyncio
  async def test_ask_concurrency_cap_rejects_when_busy():
      # Verify 503 is returned when concurrency limit is exceeded
      ...
  ```

#### A6-04 · high · `frontend/vercel.json:6-23`, `frontend/index.html:1-33`, `backend/app/middleware.py:15-50`
- **What is wrong**:
  Neither `frontend/vercel.json`, nor `frontend/index.html`, nor `backend/app/middleware.py` configures a `Content-Security-Policy` (CSP) header.
  - On the frontend (Vercel): `vercel.json` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`, but has **zero CSP**. If any XSS vulnerability is introduced via a third-party dependency, service worker, or extension, there is no CSP to prevent execution of unauthorized scripts, exfiltration of camera frames/audio, or unauthorized network calls.
  - On the backend (FastAPI): `SecurityHeadersMiddleware` sets only `x-content-type-options: nosniff` and `cache-control: no-store`. It does not set `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, nor does it set `X-Frame-Options: DENY` on API responses.
- **Concrete failure scenario**:
  1. A user visits the app on a browser where a rogue extension or injected script attempts to exfiltrate captured diagram canvas images or microphone audio to an external server `https://evil-analytics.com`.
  2. Because `connect-src` is not defined in CSP, the browser freely allows the exfiltration fetch request to `https://evil-analytics.com`.
- **Proposed minimal fix**:
  1. In `frontend/vercel.json`, add CSP to `/(.*)`:
     ```json
     {
       "key": "Content-Security-Policy",
       "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.onrender.com https://*.vercel.app; font-src 'self' data:; worker-src 'self' blob:; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none';"
     }
     ```
  2. In `backend/app/middleware.py`, add `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` and `X-Frame-Options: DENY` on all responses.
- **Proposed test**:
  ```ts
  test('vercel.json includes Content-Security-Policy header', () => {
    const vercelConfig = JSON.parse(fs.readFileSync('frontend/vercel.json', 'utf8'));
    const headers = vercelConfig.headers.find((h: any) => h.source === '/(.*)').headers;
    expect(headers.some((h: any) => h.key.toLowerCase() === 'content-security-policy')).toBe(true);
  });
  ```

#### A6-05 · high · `backend/app/limits.py:71-76`
- **What is wrong**:
  `RequestGuardMiddleware` inspects `path: str = scope.get("path", "")` and attempts direct dictionary lookup: `limit = self.body_limits.get(path)` and `rate = self.rate_limits.get(path)`.
  If a client sends `POST /api/v1/scene/` or `POST /api/v1/ask/` (with a trailing slash), both `limit` and `rate` evaluate to `None`.
  The middleware executes:
  `if limit is None and rate is None: await self.app(scope, receive, send); return`
  Starlette/FastAPI's router handles trailing slashes with an automatic HTTP 307 temporary redirect to the route without slash (preserving POST method and body). The client automatically follows the redirect, but the initial request completely bypasses rate limit accounting and body-size guards.
- **Concrete failure scenario**:
  1. Attacker sends a 100 MB body via `POST /api/v1/scene/`.
  2. `limits.py` checks `self.body_limits.get("/api/v1/scene/")`, which is `None`.
  3. The body size guard does NOT reject with 413.
  4. The request bypasses the guard and is passed to `self.app`.
- **Proposed minimal fix**:
  Normalize `path = scope.get("path", "").rstrip("/")` before looking up in `body_limits` and `rate_limits`.
- **Proposed test**:
  ```python
  def test_trailing_slash_is_guarded_by_middleware(client):
      r = client.post("/api/v1/scene/", data=b"x" * (11 * 1024 * 1024))
      assert r.status_code == 413
  ```

---

### CONFIRMED · MEDIUM

#### A6-06 · med · `frontend/vercel.json:6-23`, `backend/app/middleware.py:30-48`
- **What is wrong**:
  Neither frontend (`vercel.json`) nor backend (`middleware.py`) sets:
  1. `Strict-Transport-Security` (`HSTS: max-age=63072000; includeSubDomains; preload`). Without HSTS, initial requests or users on hostile Wi-Fi networks can be downgraded to HTTP via SSL stripping.
  2. `Permissions-Policy`. Ghost Touch requires access to the camera and speech, but does not use geolocation, payment, USB, or accelerometer. A missing `Permissions-Policy` leaves device hardware APIs unrestricted.
- **Concrete failure scenario**:
  A user on an insecure public Wi-Fi network navigates to `http://ghosttouch.app`. Without HSTS, the initial plaintext HTTP request is vulnerable to an active man-in-the-middle attacker intercepting traffic before the redirect to HTTPS.
- **Proposed minimal fix**:
  Add to `frontend/vercel.json` headers:
  ```json
  { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
  { "key": "Permissions-Policy", "value": "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" }
  ```
- **Proposed test**:
  Verify presence of `Strict-Transport-Security` and `Permissions-Policy` in `vercel.json`.

#### A6-07 · med · `backend/app/image_utils.py:79-103`
- **What is wrong**:
  In `sniff_image_dimensions`, WebP detection assumes the very first chunk at byte offset 12 is `VP8 `, `VP8L`, or `VP8X`:
  `chunk = data[12:16]`
  According to the WebP container specification (RFC 6386 / Google WebP specs), chunks can appear in arbitrary order. Files containing an `ICCP` (color profile) or `EXIF` metadata chunk before the image bitstream chunk have `data[12:16] == b"ICCP"` or `b"EXIF"`.
  When this occurs, `sniff_image_dimensions` returns `None`.
  `validate_image_bytes` immediately raises `HTTPException(422, "Image file header is corrupted or truncated")`, rejecting completely valid photos uploaded by students.
- **Concrete failure scenario**:
  1. A student exports a diagram photo as a WebP image from an Android photo app that embeds an ICC profile chunk before the image data.
  2. Bytes 0-11: `RIFF <size> WEBP`
  3. Bytes 12-15: `ICCP` (ICC color profile chunk, followed by VP8L chunk at offset 120).
  4. The student uploads the image to `POST /api/v1/scene`.
  5. `sniff_image_dimensions` checks `data[12:16]` which is `b"ICCP"`, not `b"VP8 "`/`b"VP8L"`/`b"VP8X"`. It returns `None`.
  6. Backend returns HTTP 422 "Image file header is corrupted or truncated", rejecting the valid diagram.
- **Proposed minimal fix**:
  Walk the RIFF chunks sequentially by reading 4-byte FourCC and 4-byte little-endian chunk size (`struct.unpack('<I', data[offset+4:offset+8])[0]`) until reaching a `VP8 `, `VP8L`, or `VP8X` chunk.
- **Proposed test**:
  ```python
  def test_webp_with_leading_iccp_chunk_parses_dimensions():
      # WebP file where ICCP chunk precedes VP8X
      raw = b"RIFF\x30\x00\x00\x00WEBPICCP\x04\x00\x00\x00testVP8X\x0a\x00\x00\x00\x00\x00\x00\x00\x63\x00\x00\x63\x00\x00"
      dims = sniff_image_dimensions(raw)
      assert dims == (100, 100)
  ```

#### A6-08 · med · `backend/app/raw_mode.py:23-43, 107-110`
- **What is wrong**:
  `build_raw_scene` passes all contour segments extracted by OpenCV to `_dedupe_segments(extracted_segments, tol=merge_tol)`.
  In `_dedupe_segments`, every segment is compared against every already accepted segment in a nested loop in pure Python bytecode ($O(N^2)$).
  If an uploaded 10 MB image has dense textures, high noise, or intricate patterns, OpenCV generates 10,000 to 30,000 contour segments.
  A pairwise loop over 20,000 segments performs up to $2 \times 10^8$ operations, blocking a CPU worker thread for up to 10+ seconds and starving the CPU on Render's shared single-core instance.
  Furthermore, after this expensive loop, only the top 300 segments are kept (`top_segments = deduped_segments[:300]`).
- **Concrete failure scenario**:
  1. Attacker generates a high-contrast 12 MP image with a fine noise or checkerboard pattern.
  2. Attacker posts the image to `POST /api/v1/scene`.
  3. OpenCV Canny and `findContours` detect 25,000 segments.
  4. `_dedupe_segments` runs $25,000 \times 25,000 / 2 \approx 312,500,000$ hypotenuse calculations in Python.
  5. The CPU core runs at 100% for 12 seconds until the request timeout is approached.
- **Proposed minimal fix**:
  Pre-filter `extracted_segments` by length before deduplicating, or sort and take the longest 1,000 segments before running `_dedupe_segments`, since at most 300 segments are ever retained.
- **Proposed test**:
  ```python
  def test_raw_mode_dedupe_caps_candidate_segments_before_quadratic_comparison():
      noisy_segments = [(float(i), float(i), float(i+1), float(i+1)) for i in range(10000)]
      # Execution must complete in < 50ms rather than several seconds
      ...
  ```

#### A6-09 · med · `.github/workflows/ci.yml:1-75`
- **What is wrong**:
  1. The workflow lacks a top-level `permissions:` block. By default, GitHub Actions grants write access to repository contents, packages, and pull requests depending on organization defaults.
  2. Actions use unpinned tags with invalid/fictitious version numbers (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-python@v7`). These actions currently do not have a v7 release. If triggered on GitHub Actions, the workflow runner fails to resolve `@v7` and aborts.
- **Concrete failure scenario**:
  A pull request triggers the CI workflow on GitHub Actions. The runner fails immediately with `Unable to resolve action actions/checkout@v7: not found`.
- **Proposed minimal fix**:
  Add `permissions: contents: read` and pin actions to verified commit SHAs or valid major versions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-python@v5`).
- **Proposed test**:
  Verify valid action versions and `permissions: contents: read` in `.github/workflows/ci.yml`.

#### A6-10 · med · `backend/app/main.py:607-619`
- **What is wrong**:
  In `POST /api/v1/scene`, `sem = get_scene_semaphore()` guards the primary request. When an AI scene succeeds, `background_tasks.add_task(run_improve_pass, ...)` is enqueued, and `sem.release()` is executed in the `finally` block before the background task runs.
  Because background tasks run outside the semaphore, if multiple scene requests are processed in succession, numerous background improve-pass calls to `GEMINI_IMPROVE_MODEL` execute concurrently without any concurrency cap. This can exhaust provider quotas and cause unexpected billing spikes.
- **Concrete failure scenario**:
  1. `GEMINI_IMPROVE_MODEL` is enabled.
  2. 10 requests arrive for different diagrams and finish their primary AI pass over 15 seconds.
  3. 10 background improve tasks run concurrently against Google GenAI SDK.
  4. Gemini returns 429 ResourceExhausted on the background tasks and burns unnecessary API quota.
- **Proposed minimal fix**:
  Introduce a dedicated semaphore or queue for background improve tasks, or restrict improve tasks to execute sequentially (semaphore of 1).
- **Proposed test**:
  ```python
  @pytest.mark.asyncio
  async def test_improve_pass_respects_background_concurrency_limit():
      ...
  ```

---

### CONFIRMED · LOW

#### A6-11 · low · `backend/app/ask.py:51-61, 401-448`
- **What is wrong**:
  `_check_scene_size` allows up to 100 facts, each up to 300 characters (`MAX_SCENE_FACTS = 100`, `MAX_TEXT_CHARS = 300`).
  This allows a scene to contain 30,000 characters of facts alone, plus 50 polylines, 100 bars, and 500 points.
  When serialized into `build_ask_prompt`, the prompt can reach 40,000+ characters (over 10,000 tokens).
  Because `/api/v1/ask` is unauthenticated and bills the API owner per token, an anonymous visitor can submit maximum-size scenes to force high-token LLM calls at low rate-limit cost.
- **Concrete failure scenario**:
  An attacker submits an `AskRequest` with 100 facts of 300 characters each. The prompt sent to Gemini or OpenAI contains 35,000 characters, consuming ~10,000 input tokens per call.
- **Proposed minimal fix**:
  Tighten `MAX_SCENE_FACTS` to 30, and in `compact_scene`, cap the total facts character budget in prompts to 3,000 characters.
- **Proposed test**:
  ```python
  def test_compact_scene_caps_total_facts_prompt_length():
      ...
  ```

#### A6-12 · low · `backend/app/vision/gemini.py:34-38` vs `backend/app/vision/_openai_compat.py:20-30`
- **What is wrong**:
  `_openai_compat.py` uses multi-layered secret redaction:
  `_BEARER = re.compile(r"Bearer\s+[A-Za-z0-9_\-\.]+")`
  `_SK_KEY = re.compile(r"(?:sk|nvapi|csk)-[A-Za-z0-9_\-]{8,}")`
  plus exact substring replacement of `secret`.
  In contrast, `gemini.py` only implements simple exact replacement: `text.replace(secret, "[REDACTED]")`.
  If an exception message from the Google GenAI SDK contains an authorization header, URL-encoded key, or Bearer token, it is not caught by `gemini.py`'s `_redact_secrets` if the formatting diverges slightly from `self.api_key`.
- **Concrete failure scenario**:
  An HTTP error from Google GenAI SDK includes an authorization bearer token or URL-encoded key `AIzaSy%2...`. `_redact_secrets` in `gemini.py` fails to match the unencoded `AIzaSy...`, and the token leaks into `VisionError.reason` and application logs.
- **Proposed minimal fix**:
  Align `gemini.py`'s `_redact_secrets` with `_openai_compat.py` by adding regex scrubbing for Google API keys (`AIza[0-9A-Za-z-_]{35}`) and Bearer tokens.
- **Proposed test**:
  ```python
  def test_gemini_redact_secrets_scrubs_bearer_and_aiza_keys():
      msg = "Error connecting with AIzaSyD123456789012345678901234567890"
      assert "AIza" not in _redact_secrets(msg, None)
  ```

#### A6-13 · low · `frontend/vite.config.ts:9-28`
- **What is wrong**:
  The PWA manifest in `vite.config.ts` specifies `start_url: '/'`, but omits the explicit `scope: '/'` property. While most modern browsers infer the scope from `start_url`, the W3C Web App Manifest specification recommends explicit `scope` definition to prevent navigation outside the PWA context on certain mobile web engines and standalone webview wrappers.
- **Concrete failure scenario**:
  On some Android browser distributions, launching a shared URL hash or navigating across history without an explicit `scope` can cause the browser to break out of standalone PWA display mode into full browser chrome.
- **Proposed minimal fix**:
  Add `scope: '/'` to `manifest` in `frontend/vite.config.ts`.
- **Proposed test**:
  Check that `pwaOptions.manifest.scope === '/'`.

#### A6-14 · low · `backend/app/image_utils.py:13, 165, 207-214`
- **What is wrong**:
  In `image_utils.py`, line 165 states:
  `Raises HTTPException(422) on truncated/corrupt image or if resolution > 40 MP.`
  However, line 13 defines `MAX_IMAGE_PIXELS = 12_000_000` (12 MP), and line 207 enforces `total_pixels > MAX_IMAGE_PIXELS`.
  The error message on line 212 correctly reports 12 MP, but the docstring claims 40 MP.
- **Concrete failure scenario**:
  Developers or operators expecting 40 MP diagrams (as documented in `image_utils.py` and some earlier specs) find valid 20 MP diagrams rejected with 422.
- **Proposed minimal fix**:
  Update the docstrings in `image_utils.py` and `main.py` to consistently state 12 MP.
- **Proposed test**:
  Verify docstring consistency with `MAX_IMAGE_PIXELS`.

---

## Suspected Findings

#### A6-15 · med (suspected) · `backend/app/limits.py:101-116`
- **What is wrong**:
  In `RequestGuardMiddleware`, when a streamed body exceeds `limit`, `guarded_receive()` raises `_BodyTooLarge` (inheriting from `Exception`).
  In Starlette, `ServerErrorMiddleware` wraps user middleware and catches all unhandled `Exception` instances, transforming them into HTTP 500 responses (`tracking_send` records `started = True`).
  When `_BodyTooLarge` bubbles out to line 114, `if not started:` evaluates to `False`, so `_reject(send, 413, ...)` is skipped.
  The client therefore receives an opaque **HTTP 500 Internal Server Error** instead of **HTTP 413 Payload Too Large**.
- **Concrete failure scenario**:
  A client streams a chunked body without `Content-Length` that exceeds 512 KB to `POST /api/v1/ask`.
  The connection triggers `_BodyTooLarge`.
  The client receives `500 Internal Server Error` rather than `413 Request body is too large`.
- **Proposed minimal fix**:
  Catch `_BodyTooLarge` within an explicit Starlette exception handler on `app_instance`, or make `_BodyTooLarge` an `HTTPException(413, "Request body is too large.")`.
- **Proposed test**:
  ```python
  def test_streamed_oversize_body_returns_413_not_500(client):
      ...
  ```

#### A6-16 · low (suspected) · `backend/app/main.py:319-323`, `render.yaml:73-74`
- **What is wrong**:
  `render.yaml` sets `ALLOWED_ORIGINS: https://ghost-touch-iota.vercel.app`.
  `create_app()` passes `allow_origins=origins` to `CORSMiddleware` without configuring `allow_origin_regex`.
  When preview deployments are generated for pull requests on Vercel (e.g. `https://ghost-touch-iota-git-*.vercel.app` or `https://ghost-touch-*-ratnesh.vercel.app`), browser requests from those previews to the backend are rejected by CORS.
- **Concrete failure scenario**:
  A tester opens a Vercel PR preview deployment and attempts to scan a diagram. The browser blocks the fetch to `https://ghost-touch-backend.onrender.com/api/v1/scene` due to a CORS origin mismatch.
- **Proposed minimal fix**:
  Add `allow_origin_regex=os.environ.get("ALLOWED_ORIGIN_REGEX", r"https://ghost-touch-.*\.vercel\.app")` to `CORSMiddleware`.
- **Proposed test**:
  ```python
  def test_cors_allows_vercel_preview_domains(client):
      ...
  ```

---

## Top 5 to Fix First

1. **A6-01 (`backend/app/limits.py`)**: Fix `X-Forwarded-For` spoofing. An attacker can currently bypass all rate limits and drain LLM quotas by supplying arbitrary client IP headers.
2. **A6-02 (`backend/app/limits.py`)**: Prune empty deque windows in `_HITS` on expiry to prevent monotonic memory leaks and server OOM crashes.
3. **A6-03 (`backend/app/main.py`)**: Add a concurrency semaphore to `POST /api/v1/ask` to cap concurrent LLM token generation calls and prevent provider 429 exhaustion.
4. **A6-04 (`frontend/vercel.json`, `backend/app/middleware.py`)**: Implement strict `Content-Security-Policy` headers across Vercel and FastAPI responses.
5. **A6-05 (`backend/app/limits.py`)**: Strip trailing slashes in route path lookups so `/api/v1/scene/` and `/api/v1/ask/` cannot bypass request guards.
