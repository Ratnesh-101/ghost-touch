# Audit Report: Backend Security (Wave 2)

**Status:** DONE  
**Auditor:** Antigravity (agy)  
**Date:** 2026-11-10  
**Lane:** w2-backend-security-audit  
**Scope:** Whole backend (`backend/app/*.py`, `backend/app/vision/*`, `render.yaml`,
`backend/requirements.lock`, `backend/pyproject.toml`, `backend/.env.example`, `docs/PRIVACY.md`).

---

## 1. Executive Summary

This independent security and privacy audit evaluated the Ghost Touch backend across 12 core
security dimensions: CORS and origin validation; rate limiting, proxy hops, and IP spoofing;
per-client and global concurrency management; paid AI model cost guards and budget enforcement;
scene caching and isolation; prompt injection and equation parsing; schema and geometry validation;
logging and `docs/PRIVACY.md` compliance; error response masking; upload handling and decompression
bomb prevention; dependency lockfiles; and test suite assertion integrity.

The overall backend security posture is robust. Concurrency management, rate limiting tables,
geometric validation, memory bounds, and prompt sandboxing are thoroughly engineered. However, this
audit identified **1 HIGH**, **3 MEDIUM**, and **1 LOW** findings, along with **3 tests** that
assert vacuous or weak conditions.

---

## 2. Confirmed Sound Invariants (One-Line Verifications)

- **CORS & Origin Handling:** `CORSMiddleware` cleanly parses origins from `ALLOWED_ORIGINS` with
  trailing slashes stripped, enforces localhost fallbacks, and regex matches `ALLOWED_ORIGIN_REGEX`.
- **Rate Limiting & Table Bounds:** `RequestGuardMiddleware` enforces sliding-window bucket limits
  (20/min scene, 40/min ask/validate), throttles sweep to 1/s, and strictly bounds `_HITS` to 2000.
- **Client IP & Subnet Grouping:** IPv6 addresses are grouped into `/64` CIDRs, ports and brackets
  are stripped, and IPv4-mapped addresses (`::ffff:`) are canonicalized before keying.
- **Concurrency & Resource Protection:** Global semaphores (2 scene, 4 ask) and per-client limiters
  (1 scene, 2 ask) release permits on timeouts, cancellations, and client disconnects in `finally`.
- **Cost Guards & Budget Enforcement:** `paid_budget.py` enforces thread-safe UTC daily caps before
  any network request is dispatched, immediately triggering local Raw Mode or facts fallback.
- **Scene Cache Isolation:** Caches are keyed strictly by SHA-256 of `(image + prompt + version)`,
  contain zero PII/client keys, return deep copies, and evict via 64-entry LRU with 6-hour TTL.
- **Prompt Injection Defense:** Delimiters `<user_question>` isolate user input, question tag variants
  are stripped by regex, scene JSON is untrusted, and output answers are hard-clamped to 300 chars.
- **Safe Graph Evaluation:** Equation parsing uses a custom recursive-descent AST (`expr.py`) with
  capped depth (24) and length (200), strictly prohibiting `eval`, `exec`, or attribute lookup.
- **Schema & Geometry Validation:** `validate.py` enforces strict structural caps (300 points/segments),
  clamps out-of-bounds coordinates within ±0.02 tolerance, bounds aspect ratios, and rejects empty scenes.
- **Upload & Decompression Safety:** 10 MB upload stream cap is enforced chunk-by-chunk, and 12 MP
  resolution limits are verified from image headers (SOF/IHDR/VP8) prior to pixel decoding.
- **Ephemeral Processing & Metadata:** All uploads are processed strictly in RAM with zero temp files,
  and OpenCV decoding strips all camera EXIF metadata (GPS, serial numbers, timestamps).
- **Error Response Masking:** All endpoint handlers trap internal exceptions and return generic HTTP
  status codes (415, 422, 503, 504) without leaking stack traces or internal environment details.

---

## 3. Confirmed Findings (Highest Severity First)

### Finding 1: Incomplete API Key Scrubbing in Gemini Provider Violates PRIVACY.md
- **Severity:** HIGH
- **File & Line:** `backend/app/vision/gemini.py:35-39` (contradicting `docs/PRIVACY.md:128-129`)
- **Quoted Code:**
  ```python
  def _redact_secrets(text: str, secret: str | None) -> str:
      if not secret:
          return text
      return text.replace(secret, "[REDACTED]")
  ```
- **Problem:**
  `docs/PRIVACY.md` lines 128-129 explicitly asserts:
  > *"In backend/app/vision/_openai_compat.py and backend/app/vision/gemini.py, regex filters
  > (_BEARER, _SK_KEY, _redact_secrets) scrub API keys and authorization tokens from error text
  > before logging."*
  
  In reality, `gemini.py` does not contain `_BEARER` or `_SK_KEY` regexes. It only performs literal
  exact substring replacement: `text.replace(secret, "[REDACTED]")`. If `GEMINI_API_KEY` was not
  passed into `_redact_secrets`, or if the Google GenAI SDK returns an error message where the API
  key is URL-encoded (e.g. `key=AIzaSy...%3D`), percent-encoded, or embedded in an authorization
  header, literal string replacement fails to redact the key.
  
  Furthermore, in `backend/app/main.py:853`:
  ```python
  logger.warning("All vision providers failed: %s", exc)
  ```
  `main.py` logs the unredacted chain exception `exc` directly at `WARNING` level when vision
  extraction fails.
- **Concrete Failure Scenario:**
  A network timeout or DNS resolution failure occurs while calling Gemini. The Google GenAI SDK
  raises an exception containing the full request URL with query parameters including `key=AIzaSy...`.
  Because `_redact_secrets` in `gemini.py` does not regex-match `AIzaSy[A-Za-z0-9_-]{33}`, and if
  URL formatting alters character representation, the full Google API key is written in plaintext
  to server stdout logs in direct contradiction of `docs/PRIVACY.md`.
- **Minimal Fix:**
  Add standard key-scrubbing regexes (`_GEMINI_KEY = re.compile(r"AIza[0-9A-Za-z-_]{35}")`,
  `_BEARER = re.compile(r"Bearer\s+([A-Za-z0-9_\-\.]+)", re.IGNORECASE)`) to `gemini.py`, matching
  `_openai_compat.py`. Run all exception messages through these regex scrubbers before raising or
  logging.

---

### Finding 2: Multi-line XFF Mismatch Between Middleware and Route In-Flight Limiter
- **Severity:** MED
- **File & Line:** `backend/app/limits.py:382` vs `backend/app/limits.py:205`
- **Quoted Code:**
  In `backend/app/limits.py:196-207` (`RequestGuardMiddleware.__call__`):
  ```python
  xff_lines: list[str] = []
  for k, v in scope.get("headers", []):
      if k.lower() == b"x-forwarded-for":
          try:
              xff_lines.append(v.decode("latin-1"))
          except UnicodeDecodeError:
              pass
  if xff_lines:
      headers["x-forwarded-for"] = ", ".join(xff_lines)
  ```
  In `backend/app/limits.py:379-385` (`request_client_key`):
  ```python
  def request_client_key(request: Request) -> str:
      """Extract client key from a Starlette Request instance."""
      peer = request.client.host if request.client else None
      xff = request.headers.get("x-forwarded-for")
      hops = trusted_proxy_hops()
      return client_key(peer, xff, hops)
  ```
- **Problem:**
  `RequestGuardMiddleware` iterates through the ASGI scope and concatenates multiple
  `X-Forwarded-For` header lines with `", "`. In contrast, `request_client_key(request)` (called
  by `main.py:580` for `/scene` and `main.py:913` for `/ask` in-flight concurrency limiters) calls
  Starlette's `request.headers.get("x-forwarded-for")`. In Starlette, `Headers.get()` returns only
  the *first* occurrence of a duplicated header name.
  
  When multiple `X-Forwarded-For` headers are sent, `RequestGuardMiddleware` inspects the rightmost
  hop of the merged string, while `request_client_key` inspects the rightmost hop of the first line.
- **Concrete Failure Scenario:**
  An attacker sends a request with two `X-Forwarded-For` header lines:
  Line 1: `X-Forwarded-For: 203.0.113.1`
  Line 2: `X-Forwarded-For: 198.51.100.2`
  Behind a trusted reverse proxy (`TRUSTED_PROXY_HOPS=1`), the proxy appends the true client IP to
  Line 2. The rate limiter middleware computes the client key from the end of Line 2. However,
  `request_client_key` inspects only Line 1 and computes `client_key` as `203.0.113.1`. The attacker
  can vary the first header line on every request to compute arbitrary client keys for the
  in-flight concurrency limiter, bypassing the per-client in-flight concurrency caps.
- **Minimal Fix:**
  In `limits.py:request_client_key`, retrieve all header values using `request.headers.getlist()`:
  ```python
  def request_client_key(request: Request) -> str:
      peer = request.client.host if request.client else None
      xff_list = request.headers.getlist("x-forwarded-for")
      xff = ", ".join(xff_list) if xff_list else None
      hops = trusted_proxy_hops()
      return client_key(peer, xff, hops)
  ```

---

### Finding 3: Missing `--proxy-headers` and Access Log Anonymization in Production Server Command
- **Severity:** MED
- **File & Line:** `render.yaml:10`
- **Quoted Code:**
  ```yaml
  startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```
- **Problem:**
  1. `render.yaml` starts Uvicorn without `--proxy-headers` or `--forwarded-allow-ips='*'`. Without
     this flag, Uvicorn does not trust Render's reverse proxy headers to populate `scope["client"]`.
     If `TRUSTED_PROXY_HOPS` is set to 0 or unset, `request.client.host` falls back to the internal
     reverse proxy IP rather than the connecting client.
  2. Uvicorn's default access logger writes every HTTP request line to stdout including client IP:
     `INFO: 198.51.100.12:43210 - "POST /api/v1/scene HTTP/1.1" 200 OK`.
     This contradicts `docs/PRIVACY.md` lines 24-27:
     > *"client IP addresses are discarded or anonymised to /24 IPv4 / /48 IPv6 by the reverse
     > proxy before logging"*
- **Concrete Failure Scenario:**
  On Render, container stdout logs capture raw client IP addresses for all users of the app. Because
  the service is accessed by students and visually impaired individuals in educational settings,
  logging raw client IPs violates the project's zero-knowledge privacy policy.
- **Minimal Fix:**
  Update `startCommand` in `render.yaml` to include proxy headers and disable Uvicorn access logging:
  ```yaml
  startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*' --no-access-log
  ```

---

### Finding 4: Production Config Omissions in render.yaml (Budget & Origin Regex)
- **Severity:** MED
- **File & Line:** `render.yaml:32-38`
- **Quoted Code:**
  ```yaml
  envVars:
    - key: PYTHON_VERSION
      value: 3.11.9
    - key: GEMINI_API_KEY
      sync: false
    - key: GEMINI_MODEL
      value: gemini-2.5-flash
    - key: OPENAI_API_KEY
      sync: false
    - key: NEBIUS_API_KEY
      sync: false
  ```
- **Problem:**
  Two critical environment variables documented in `backend/.env.example` and required for
  production security and cost control are absent from `render.yaml`:
  1. `PAID_CALLS_PER_DAY`: Defaults to 2000 in `paid_budget.py:27`. For a production deployment with
     strict budget guardrails, failing to declare this allows up to 2000 paid calls per provider daily.
  2. `ALLOWED_ORIGIN_REGEX`: Omitted. In a Vercel frontend deployment with preview deployments,
     preview branches (`https://ghost-touch-*-team.vercel.app`) cannot pass CORS preflights without
     either a regex or explicit origin declaration.
- **Concrete Failure Scenario:**
  A burst of traffic or automated scraping uses up the entire daily paid quota (up to 2000 calls)
  because the deployment lacks an explicit budget cap in `render.yaml`. Additionally, Vercel PR
  previews cannot connect to the backend because CORS blocks their origin.
- **Minimal Fix:**
  Add `PAID_CALLS_PER_DAY` (e.g. 500) and `ALLOWED_ORIGIN_REGEX` to `render.yaml` `envVars`.

---

### Finding 5: WebP Header Sniffer Rejects Valid Extended WebP with Leading Metadata Chunks
- **Severity:** LOW
- **File & Line:** `backend/app/image_utils.py:133-154`
- **Quoted Code:**
  ```python
  chunk = data[12:16]
  if chunk == b"VP8 ":
      ...
  elif chunk == b"VP8L":
      ...
  elif chunk == b"VP8X":
      ...
  else:
      return None
  ```
- **Problem:**
  The RIFF container specification permits metadata chunks (such as `ICCP` or `EXIF`) to appear
  before or after the image bitstream chunks. `_sniff_webp_dimensions` strictly expects the 4 bytes
  at index 12-16 to be `VP8 `, `VP8L`, or `VP8X`. If a valid WebP image begins with another RIFF
  chunk (e.g. `ICCP`), the sniffer returns `None`, and `validate_image_bytes` rejects the valid image
  with HTTP 415/422.
- **Concrete Failure Scenario:**
  A user uploads an image exported from a mobile camera or graphics editor that prepended an ICC
  color profile chunk inside the WebP container. The upload is rejected with "Could not read image
  dimensions", even though the file is valid and completely safe.
- **Minimal Fix:**
  In `_sniff_webp_dimensions`, loop through RIFF chunks starting at offset 12, advancing by
  `8 + chunk_size + (chunk_size % 2)` until a `VP8 `, `VP8L`, or `VP8X` FourCC chunk is encountered.

---

## 4. Tests That Assert Nothing Meaningful (Vacuous / Weak Tests)

During inspection of `backend/tests/`, 3 test implementations were found to contain vacuous,
conditional, or non-functional assertions:

1. **Conditional Assertion Skips Entire Verification on Non-200 Status:**
   - **File & Line:** `backend/tests/test_h3_cost_guard.py:514-517`
   - **Quoted Code:**
     ```python
     resp = client.post(
         "/api/v1/scene",
         files={"image": ("diagram.png", png_bytes, "image/png")},
     )
     if resp.status_code == 200:
         assert resp.headers["X-Vision-Provider"] == "raw"
         assert resp.headers["X-Vision-Provider"] not in ("gemini", "openai", "nebius", "none")
     ```
   - **Why Meaningless:** The assertions are wrapped in `if resp.status_code == 200:`. If the
     endpoint returns a 422, 500, or 503 error, the body of the `if` statement is never executed,
     no assertion is evaluated, and `pytest` records a passing test despite complete failure.
   - **Fix:** Replace `if resp.status_code == 200:` with `assert resp.status_code == 200`.

2. **Test Mocks Out Header Parsing with Pre-Joined Dictionary:**
   - **File & Line:** `backend/tests/test_h3_cost_guard.py:639-643`
   - **Quoted Code:**
     ```python
     with patch.dict(os.environ, {"TRUSTED_PROXY_HOPS": "1"}):
         headers_dict = guard._client_key(
             scope_duplicate_xff,
             {"x-forwarded-for": "1.1.1.1, 2001:db8::1"},
         )
         assert headers_dict == "2001:db8::/64"
     ```
   - **Why Meaningless:** The test intended to verify that `RequestGuardMiddleware` merges duplicate
     `X-Forwarded-For` header lines from the ASGI scope. Instead, the test manually pre-joined the
     strings into `{"x-forwarded-for": "1.1.1.1, 2001:db8::1"}` and passed it to the helper,
     completely bypassing the ASGI header extraction loop in `__call__` and testing a tautology.
   - **Fix:** Invoke the middleware directly via `await guard(scope_duplicate_xff, receive, send)`
     and verify the client key computed internally.

3. **Docstring Text Inspection Rather Than Code Verification:**
   - **File & Line:** `backend/tests/test_n1_backend.py:622-632`
   - **Quoted Code:**
     ```python
     def test_m4_12_docstrings_match_12_mp_limit() -> None:
         assert process_scene.__doc__ is not None
         assert "12 MP" in process_scene.__doc__
         assert "40 MP" not in process_scene.__doc__
         assert validate_image_bytes.__doc__ is not None
         assert "12 MP" in validate_image_bytes.__doc__
         assert "40 MP" not in validate_image_bytes.__doc__
     ```
   - **Why Meaningless:** This test asserts that comments and docstrings contain the characters "12 MP".
     It tests zero code execution, zero image validation, and zero security boundaries.
   - **Fix:** Test the actual boundary enforcement with an image of 12,000,001 pixels asserting 422.

---

## 5. Remediation Priority Plan

1. **Priority 1 (Privacy):** Implement regex-based API key scrubbing in `gemini.py` and ensure all
   provider exceptions in `main.py` are scrubbed before logging (Finding 1).
2. **Priority 2 (Security):** Align `request_client_key` in `limits.py` to use `headers.getlist()`
   so duplicate `X-Forwarded-For` headers cannot circumvent in-flight concurrency caps (Finding 2).
3. **Priority 3 (Deployment):** Update `render.yaml` startCommand with `--proxy-headers` and
   `--no-access-log`, and declare `PAID_CALLS_PER_DAY` in `envVars` (Findings 3 & 4).
4. **Priority 4 (Test Suite):** Convert conditional assertion in `test_h3_cost_guard.py:514` to
   strict assertion and test real ASGI header concatenation (Section 4).
