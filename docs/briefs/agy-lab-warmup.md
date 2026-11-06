# Lane lab-warmup: survive the Render cold start

PROBLEM (measured by the supervisor): the backend on Render's free tier took 32 s to answer its first `/api/v1/health` after idling, but the frontend gives a scene request only `SCENE_TIMEOUT_MS = 20_000` (see `frontend/src/api/scene.ts`). So the first photo after the backend has gone idle fails with a timeout and the user is left with an error.

## Allowed files
- `frontend/src/api/health.ts` (new), `frontend/src/api/scene.ts` (the timeout constant only, unless a test shows more is needed), `frontend/src/App.tsx` (ONE `useEffect` that calls the warm-up once on mount; no other change, and do not touch routing or the screen state machine)
- `frontend/tests/api.health.test.ts` (new), `frontend/tests/api.scene.test.ts` (only to follow the new constant), a new test for the App effect if the existing screen render tests make that easy
- `docs/reports/agy-lab-warmup-report.md`

## Forbidden
Other screens, `flow/**`, `core/**`, `drivers/**`, `i18n/**`, backend, `.env*`, prop tests. No speech and no sound in the warm-up: it must be invisible.

## Do
1. `frontend/src/api/health.ts`: export `warmBackend(options?)` that fires a single `GET {base}/api/v1/health` using the SAME base-URL logic as `requestScene` (reuse its helper; read `scene.ts` first; keep same-origin behaviour when `VITE_API_URL` is unset), fire-and-forget, with its own `AbortController` timeout of 60 seconds, swallowing every error (never throws, never logs with `console`, never speaks). It must only run once per page load (module-level guard) and must not run when the page is offline (`navigator` access is only allowed in `drivers/`: instead accept an optional `isOnline?: () => boolean` and an injectable `fetch`, and let `App.tsx` pass `drivers`-level information if such a helper exists; if no such helper exists, skip the offline check and rely on the swallowed error). Return a promise so tests can await it.
2. Call it once from `App.tsx` on mount, so the backend is already waking while the user hears the intro and taps through Start.
3. Raise `SCENE_TIMEOUT_MS` so a cold backend can still answer the first scene request: 45 seconds. Update every test and doc comment that mentions 20 seconds. The existing "Reading your diagram" spoken message and 1.5 s progress tone already cover the wait.
4. Tests: `warmBackend` calls the health URL exactly once even if invoked twice; it swallows network errors and non-200 answers; it uses the configured base URL; the timeout constant is 45 s.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all old tests pass, plus yours, real counts), `npm --prefix frontend run build` pass. Run NO backend commands. Report with the diff stat and **Commit groups**; write it even if something failed.
