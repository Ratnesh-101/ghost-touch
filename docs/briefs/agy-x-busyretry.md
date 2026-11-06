# Lane x-busyretry: handle "server busy" (HTTP 503 / 429 with Retry-After) in the frontend

Create `docs/reports/agy-x-busyretry-report.md` FIRST. You may run the frontend test, tsc and build commands. Do NOT run backend tests or ruff.

## Problem
The hardened backend now answers `POST /api/v1/scene` with HTTP 503 plus a `Retry-After` header when its concurrency queue is full, and HTTP 429 when rate-limited. `frontend/src/api/scene.ts` turns every non-OK response into `SceneRequestError('http')` (lines ~98 and ~123), so a blind student just hears a generic failure. Read `backend/app/main.py` (search `queue_timeout`, `Retry-After`) and `backend/app/limits.py` to see the exact responses.

## Do
1. In `frontend/src/api/scene.ts` add a distinct error kind `busy` (for 503 and 429). Parse `Retry-After` (seconds; ignore HTTP-date and invalid values; clamp to 1..10 s; default 3 s).
2. For `busy` only, retry the upload ONCE automatically after the wait (respect the existing abort signal / timeout and do not exceed the overall scene timeout logic; if time is short, skip the retry). A second `busy` surfaces as the `busy` error.
3. Find where `SceneRequestError` kinds are turned into spoken/visible messages (search `SceneRequestError` in `frontend/src/screens`) and add a `busy` message through `t()`. Add the new key(s) to ALL THREE language tables in `frontend/src/i18n/index.ts` (en, hi, gu) because a test requires full parity; write natural spoken Hindi and Gujarati and flag them in the report as machine-written, needing a native check. The message should tell the student the service is busy and that they can try again in a moment; it must be announced like the existing failure messages (same speech/aria-live path), and the retry button must stay reachable.
4. Tests: extend `frontend/tests/api.scene.test.ts` (503 with Retry-After then success; 503 twice then `busy`; 429; invalid header uses default; Retry-After clamped; non-busy errors NOT retried; use fake timers) and add a screen-level test only if an existing screen test pattern makes it cheap.
5. Do not touch `frontend/src/core`, haptic values, Explore, or other i18n keys. Do not change the existing Raw Mode fallback behaviour for backend `mode: "raw"` responses.

Run `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test`, `npm --prefix frontend run build` and report real numbers. Add a BUILD_LOG entry (tool = Antigravity (agy)). End with **Commit groups** (one commit: `feat(api): handle server-busy 503/429 with one Retry-After retry and a spoken message`).
