# Antigravity Lane Report: lab-testenv

**Lane:** `lab-testenv`  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-06  
**Status:** Complete & verified  

---

## 1. Summary & Bug Diagnosis

### The Issue
On the repository owner's machine, `frontend/.env.local` sets `VITE_API_URL=http://localhost:8000`. In `frontend/tests/api.health.test.ts`, the test `"calls GET /api/v1/health using default base URL (same-origin)"` expected the requested URL to be `'/api/v1/health'`, but instead received `'http://localhost:8000/api/v1/health'`. While passing in CI and isolated worktrees lacking that file, the test was not hermetic because it leaked the developer's local environment.

### Diagnosis
In `frontend/src/api/scene.ts`, `defaultBaseUrl()` dynamically evaluates:
```ts
export function defaultBaseUrl(): string {
  const configured: unknown = import.meta.env['VITE_API_URL'];
  return typeof configured === 'string' ? configured.replace(/\/+$/, '') : '';
}
```
In `frontend/src/api/health.ts`, `warmBackend` defaults `baseUrl = defaultBaseUrl()`. When `VITE_API_URL` is populated by Vite from `.env.local`, `defaultBaseUrl()` returns the configured URL rather than `''`, causing the fetch target to be prefixed.

---

## 2. Codebase Audit (Requirement 1)

All test files under `frontend/tests/` were audited for usages of `import.meta.env`, `VITE_API_URL`, `defaultBaseUrl`, and default base URL constructions:

1. **`frontend/tests/api.health.test.ts`**:
   - Directly tested `warmBackend({ fetchImpl })` with no `baseUrl` argument, thus relying on `defaultBaseUrl()` and `import.meta.env['VITE_API_URL']`.
   - **Action:** Fixed to be hermetic using `vi.stubEnv` / `vi.unstubAllEnvs`.
2. **`frontend/tests/api.scene.test.ts`**:
   - Calls to `requestScene` all pass an explicit `baseUrl` (`baseUrl: 'https://api.example'` or `baseUrl: ''`).
   - Does not import or call `defaultBaseUrl` without explicit base URL.
3. **`frontend/tests/api.ask.test.ts`**:
   - Happy path tests supply explicit `baseUrl: 'https://api.example.com'`. Error tests (timeout, abort, network) test rejection reasons and do not assert the request URL.
4. **All other frontend tests** (`screens.*`, `flow.*`, `drivers.*`, `correct.*`, `saved.*`, `lab.*`, `polish.*`, `explore.*`, etc.):
   - Use fakes, mock drivers, or injected mock fetch functions with explicit arguments; none depend on `VITE_API_URL` or default base URL resolution.

`frontend/tests/api.health.test.ts` was the sole test relying on the un-stubbed ambient environment for URL resolution.

---

## 3. Hermetic Implementation & Global Safety Net (Requirements 2, 3, 4)

### 1. Test-Level Isolation (`frontend/tests/api.health.test.ts`)
- Added `beforeEach(() => { vi.stubEnv('VITE_API_URL', ''); resetWarmGuardForTesting(); });` to ensure every test in the suite starts with an empty `VITE_API_URL`.
- Added `afterEach(() => { vi.unstubAllEnvs(); });` to guarantee clean teardown between tests.
- Explicitly stubbed `vi.stubEnv('VITE_API_URL', '')` in the same-origin test case.
- Added a dedicated test case verifying that `VITE_API_URL` set in the environment (e.g. `'https://api.example.test/'`) is correctly used by `warmBackend` with trailing slashes stripped (`'https://api.example.test/api/v1/health'`).
- Added a test case confirming that explicit `baseUrl` options take precedence over `VITE_API_URL`.

### 2. Global Safety Net (`frontend/vitest.config.ts`)
- Added `env: { VITE_API_URL: '' }` to Vitest's `test` configuration.
- This ensures that even across any future test files, ambient environment variables from local `.env` files default to empty strings during test runs unless explicitly overridden.

### 3. Dual-State Hermeticity Verification
- To prove hermeticity against developer local env files without recreating `.env.local`:
  - Configured `vitest.config.ts` temporarily with `VITE_API_URL: 'http://localhost:8000'`.
  - Ran the complete test suite: all 56 test files and 798 tests passed cleanly without any failure.
  - Reset `vitest.config.ts` to `VITE_API_URL: ''`.
  - Ran the test suite again: all 56 test files and 798 tests passed cleanly.

---

## 4. Definition of Done & Verification Results

All required commands were executed from the repository root. Per brief instructions ("Run NO backend commands"), backend test commands were not run.

### 1. TypeScript Check
```
npm --prefix frontend exec -- tsc -p frontend --noEmit
Exit code: 0
Output: Clean (0 errors)
```

### 2. Frontend Vitest Suite
```
npm --prefix frontend test
Exit code: 0
Output:
 RUN  v5.1.0 C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-testenv/frontend

 Test Files  56 passed (56)
      Tests  798 passed (798)
   Start at  06:48:23
   Duration  799ms (transform 57%, import 21%, tests 16%, worker 6%)
```
*(All 56 test files passing; +2 new hermeticity tests added to `api.health.test.ts`, moving total from 796 to 798)*

### 3. Frontend Production Build
```
npm --prefix frontend run build
Exit code: 0
Output:
> ghost-touch-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 61 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                                                     0.13 kB
dist/manifest.webmanifest                                              0.49 kB
dist/index.html                                                        1.59 kB │ gzip:   0.61 kB
dist/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2     17.20 kB
dist/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2     17.52 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs                            1,264.34 kB
dist/assets/index-q8dqENg8.css                                        40.22 kB │ gzip:   6.91 kB
dist/assets/index-rnEZZVWx.js                                        337.02 kB │ gzip: 101.51 kB
dist/assets/pdf-ULJPBbF3.js                                          430.16 kB │ gzip: 129.27 kB

✓ built in 154ms

PWA v2.0.0
mode      generateSW
precache  22 entries (457.49 KiB)
files generated
  dist/sw.js
  dist/workbox-9c191d2f.js
```

---

## 5. Git Diff Stat

```
 frontend/tests/api.health.test.ts | 31 ++++++++++++++++++++++++++++++-
 frontend/vitest.config.ts         |  3 +++
 2 files changed, 33 insertions(+), 1 deletion(-)
```

---

## 6. Commit Groups

Suggested logical commits for the reviewer:

### Commit 1: `test(api): make api.health.test.ts hermetic against local env files`
- **Files:**
  - `frontend/tests/api.health.test.ts`
  - `frontend/vitest.config.ts`
- **Description:** Isolates tests from developer-specific `VITE_API_URL` values via `vi.stubEnv`/`vi.unstubAllEnvs`, adds tests for both unset and configured environment variables with trailing slash stripping, and adds global `test.env.VITE_API_URL = ''` safety net in Vitest config.

### Commit 2: `docs(lab-testenv): add lane report and build log entry`
- **Files:**
  - `docs/reports/agy-lab-testenv-report.md`
  - `docs/BUILD_LOG.md`
- **Description:** Records environment hermeticity audit findings, verification proof, and build log entry for lane `lab-testenv`.
