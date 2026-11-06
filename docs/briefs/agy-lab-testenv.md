# Lane lab-testenv: make the frontend tests independent of the developer's local env files

BUG (found by the supervisor): on the owner's machine `frontend/.env.local` sets `VITE_API_URL=http://localhost:8000` (you cannot and must not open that file; it only exists in the main checkout, not in your worktree). `frontend/tests/api.health.test.ts` test "calls GET /api/v1/health using default base URL (same-origin)" expects `'/api/v1/health'` but receives `'http://localhost:8000/api/v1/health'` there. The test passes in CI and in worktrees without that file, so it is not hermetic.

## Allowed files
`frontend/tests/api.health.test.ts`, any other test under `frontend/tests/` that depends on `import.meta.env.VITE_API_URL` or on the default base URL, `frontend/vitest.config.ts` ONLY if a global fix is cleaner, `docs/reports/agy-lab-testenv-report.md`.

## Forbidden
`frontend/src/**`, `.env*` (never open them), backend, prop tests, weakening any assertion.

## Do
1. Search all tests (`frontend/tests/*.ts*`) for anything that reads `import.meta.env`, `VITE_API_URL`, `defaultBaseUrl`, or builds URLs with the default base. List them in the report.
2. Make every such test hermetic: use `vi.stubEnv('VITE_API_URL', '')` (and `vi.unstubAllEnvs()` in `afterEach`) so the "unset" case is really unset, and a second explicit case that stubs `VITE_API_URL` to a value such as `https://api.example.test` and asserts the health URL uses it (with a trailing slash stripped). Check how `defaultBaseUrl` in `src/api/scene.ts` reads the variable (read only) so the stub actually takes effect (Vitest may need `vi.resetModules()` and a dynamic import if the value is read at module load).
3. Optional global safety net, only if simple and safe: in `vitest.config.ts` set `test.env: { VITE_API_URL: '' }` so no developer-specific value can ever leak into tests. If you add it, confirm that no existing test relied on the old value.
4. You cannot recreate the owner's `.env.local`, so prove hermeticity differently: the new tests must set the variable themselves to BOTH an empty and a non-empty value and pass either way.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all pass, real counts), `npm --prefix frontend run build` pass. Run NO backend commands. Report and **Commit groups**; write the report even if something failed.
