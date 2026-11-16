# agy-hx8 Lane Report: Page Header Tightening & Production Smoke Check

**Lane:** hx8  
**Builder:** Antigravity (agy)  
**Date:** 2026-11-16  

---

## 1. Summary of Changes

In accordance with lane hx8 instructions:
1. **`frontend/vercel.json`**:
   - Appended `; upgrade-insecure-requests` to the production Content-Security-Policy (CSP) on `/(.*)`.
   - Added header `Cross-Origin-Opener-Policy: same-origin`.
   - Extended `Permissions-Policy` with `accelerometer=(), gyroscope=(), magnetometer=(), display-capture=()`, while preserving `camera=(self), microphone=(self)`.
   - Kept `connect-src 'self' https://ghost-touch-api.onrender.com` unchanged.
2. **`frontend/tests/security.headers.test.ts`**:
   - Updated CSP tests to assert `upgrade-insecure-requests` directive.
   - Added assertion that `Cross-Origin-Opener-Policy` is set to `same-origin`.
   - Extended `Permissions-Policy` assertions to verify that `accelerometer`, `gyroscope`, `magnetometer`, and `display-capture` are disabled (`=()`), alongside existing camera and microphone assertions.
   - Retained strict assertions that `script-src 'self'` has no `'unsafe-inline'` or `'unsafe-eval'` and `frame-ancestors 'none'`.
3. **`scripts/smoke-deployed.mjs`**:
   - Implemented standalone Node 22 ESM smoke script (`node scripts/smoke-deployed.mjs <frontend-url> <api-url>`) without external dependencies using native global `fetch`, `FormData`, and `Blob`.
   - Implemented 9 distinct checks, each outputting `PASS` or `FAIL`:
     1. `GET <frontend>/` returns HTTP 200 with `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
     2. CSP `connect-src` contains the origin of `<api-url>`.
     3. `GET <api>/api/v1/health` returns `{"ok":true}` within 70s (handling free-tier cold starts) and has `x-content-type-options: nosniff`.
     4. `OPTIONS <api>/api/v1/ask` with `Origin: <frontend-url>` and `Access-Control-Request-Method: POST` returns that origin in `access-control-allow-origin`.
     5. `OPTIONS <api>/api/v1/ask` with `Origin: https://example.invalid` does not return that origin.
     6. `GET <api>/docs` is HTTP 404 in production mode.
     7. `POST <api>/api/v1/scene` with a 10-byte text file as `image` returns HTTP 415 without sending a real image or invoking vision providers.
     8. `GET <frontend>/samples/triangle.json` parses as JSON with `kind: "geometry"`.
     9. `GET <frontend>/sw.js` returns HTTP 200 with `no-cache` in `Cache-Control`.
   - Exits with code 1 if any check fails, or code 0 if all pass.
4. **`docs/DEPLOY.md`**:
   - Added a clear "After every deploy" section documenting the one-command smoke test script and describing each verification check.

---

## 2. Files Changed

- `frontend/vercel.json` (modified)
- `frontend/tests/security.headers.test.ts` (modified)
- `scripts/smoke-deployed.mjs` (created)
- `docs/DEPLOY.md` (modified)

---

## 3. Tests Added & Updated

- **`frontend/tests/security.headers.test.ts`**:
  - `it('forbids framing, plugins and foreign base URLs and upgrades insecure requests')`: asserts `frame-ancestors: ['none']`, `object-src: ['none']`, `base-uri: ['self']`, and `upgrade-insecure-requests`.
  - `it('grants camera and microphone to the app only and denies the rest')`: asserts `camera=(self)`, `microphone=(self)`, and denies `geolocation`, `payment`, `usb`, `serial`, `bluetooth`, `interest-cohort`, `accelerometer`, `gyroscope`, `magnetometer`, and `display-capture`.
  - `it('sets Cross-Origin-Opener-Policy to same-origin')`: asserts `Cross-Origin-Opener-Policy: same-origin`.
- **`scripts/smoke-deployed.mjs`**:
  - 9 automated post-deployment checks verifying response codes, security headers, CORS isolation, API cold start resiliency, input rejection, sample asset loading, and service worker caching.

---

## 4. What Could Not Be Verified

- **Shell commands**: Per HX headless run rule ("Do NOT run any shell command. No npm, npx, python, pytest, ruff, git, curl. The orchestrator runs all gates."), no terminal commands were executed by agy. All gate checks (`npm test`, `npm run build`, `tsc`, `pytest`, `ruff`) will be executed by the orchestrator.
- **Live production deployment**: Live network verification against production Vercel and Render instances was not run, as this headless lane operates offline in the workspace. The smoke test script is fully ready for owner execution via `node scripts/smoke-deployed.mjs <frontend-url> <api-url>`.
