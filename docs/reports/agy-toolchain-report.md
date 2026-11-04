# Lane TC: Toolchain Bump Report (Vitest 5, Vite 8, React Plugin 6, PWA 2)

**Lane / Task**: Toolchain bump for Dependabot PRs #11, #14, #17  
**Builder**: Antigravity (agy)  
**Date**: 2026-11-04  

---

## 1. Executive Summary

This worktree integrates the major frontend toolchain bump across:
- `vitest` ^5.0.5
- `@vitest/coverage-v8` ^5.0.5
- `vite` ^8.0.0
- `@vitejs/plugin-react` ^6.1.2
- `vite-plugin-pwa` ^2.0.0
- `typescript` ~7.0.2

All 418 tests in 38 test files pass. Prior to this pass, `tsc --noEmit` and `npm run build` failed due to Vitest 5 mock typing changes, and GitHub Actions workflows were pinned to Node 20 (Vitest 5 requires Node `^22.12.0 || ^24.0.0 || >=26.0.0`).

All TypeScript compilation errors and workflow engine requirements have been resolved while strictly adhering to repository constraints:
- Zero edits to Kiro-owned files (`frontend/src/**`, `*.prop.test.ts`, `.kiro/**`, backend schema/validator).
- Zero changes to test assertions.
- Exact PWA manifest configuration (`#0b0b10` theme and background colors, required icons) preserved and verified in production build output.

---

## 2. Changes Made & Rationale

### A. Test Mock Typings (`frontend/tests/`)
- **`frontend/tests/drivers.audio.earcons.test.ts`**
- **`frontend/tests/drivers.audio.test.ts`**
- **Rationale**: In Vitest 5, `vi.fn()` without explicit type arguments defaults to `Mock<Constructable | Procedure>` rather than `Mock<Procedure>`. The resulting type includes constructable call signatures (`new (...args: any[]) => any`) and lacks a plain callable signature, making it incompatible with function-typed interface properties such as `AudioContextLike['resume']` (`() => Promise<void>`), `ParamLike['setTargetAtTime']`, and `OscillatorLike['start']` / `OscillatorLike['stop']`.
- **Fix**:
  - Imported `type { Mock }` from `vitest`.
  - Added explicit generics:
    - `fakeParam()`: `ParamLike & { setTargetAtTime: Mock<ParamLike['setTargetAtTime']> }` using `vi.fn<ParamLike['setTargetAtTime']>()`.
    - `FakeContext`: `resume: Mock<AudioContextLike['resume']>`, `oscillators: Array<OscillatorLike & { start: Mock<OscillatorLike['start']>; stop: Mock<OscillatorLike['stop']> }>`.
    - `fakeContext()`: `resume: vi.fn<AudioContextLike['resume']>()`, `start: vi.fn<OscillatorLike['start']>()`, `stop: vi.fn<OscillatorLike['stop']>()`.
  - No assertions were altered.

### B. Vite 8 / Vitest 5 / PWA Config Review
- Reviewed `frontend/vite.config.ts`, `frontend/vitest.config.ts`, and `frontend/tsconfig.json`.
- The existing split configuration between `vite.config.ts` (production bundling + VitePWA) and `vitest.config.ts` (test environment + v8 coverage) functions cleanly under Vite 8 and Vitest 5.
- The build generates `dist/sw.js` and `dist/manifest.webmanifest`.
- Verified `dist/manifest.webmanifest`:
  - `theme_color`: `"#0b0b10"`
  - `background_color`: `"#0b0b10"`
  - Icons: `icons/icon-192.png` (192x192), `icons/icon-512.png` (512x512, regular + maskable).

### C. GitHub Actions Node Version Bump
- **`.github/workflows/ci.yml`** (line 27: `node-version: 22`)
- **`.github/workflows/a11y.yml`** (line 25: `node-version: 22`)
- **`.github/workflows/pbt-soak.yml`** (line 38: `node-version: 22`)
- **Rationale**: Vitest 5 requires Node engine `^22.12.0 || ^24.0.0 || >=26.0.0`. Running CI or soak tests on Node 20 causes engine check failures.
- **Constraint**: ONLY `node-version:` lines were updated in `.github/workflows/*.yml`. No other job configuration or step was modified.

---

## 3. Definition of Done: Real Verification Proof

### 1. TypeScript Compilation Check
```bash
$ npm --prefix frontend exec -- tsc -p frontend --noEmit
Exit code: 0
Output: (clean, 0 errors)
```

### 2. Frontend Unit & Property Test Suite
```bash
$ npm --prefix frontend test
Exit code: 0
Output:
> ghost-touch-frontend@0.1.0 test
> vitest run

 RUN  v5.1.0 C:/Users/Admin/AppData/Local/Temp/claude/34e8f85f16ba9e56/46bd362f-c077-477e-84ae-0e23b88d0f53/scratchpad/lane-toolchain/frontend

 Test Files  38 passed (38)
      Tests  418 passed (418)
   Start at  20:09:38
   Duration  705ms (transform 44%, import 27%, tests 20%, worker 9%)
```

### 3. Production Build & PWA Generation
```bash
$ npm --prefix frontend run build
Exit code: 0
Output:
> ghost-touch-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 55 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                           0.13 kB
dist/manifest.webmanifest                    0.48 kB
dist/index.html                              0.70 kB │ gzip:   0.40 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs  1,264.34 kB
dist/assets/index-BFMwNWQW.css              20.72 kB │ gzip:   4.41 kB
dist/assets/index-BUMlXjMv.js              238.17 kB │ gzip:  73.65 kB
dist/assets/pdf-ULJPBbF3.js                430.16 kB │ gzip: 129.27 kB

✓ built in 196ms

PWA v2.0.0
mode      generateSW
precache  14 entries (286.22 KiB)
files generated
  dist/sw.js
  dist/workbox-9c191d2f.js
```

### 4. Backend Environment Note
```bash
$ backend/.venv/Scripts/python -m pytest backend
Exit code: 1
Output: backend/.venv/Scripts/python not found (the virtual environment is absent in this isolated frontend toolchain worktree).
```

---

## 4. Modified Files Summary (`git diff --stat`)

```text
 .github/workflows/a11y.yml                   |  2 +-
 .github/workflows/ci.yml                     |  2 +-
 .github/workflows/pbt-soak.yml               |  2 +-
 frontend/tests/drivers.audio.earcons.test.ts | 16 ++++++++--------
 frontend/tests/drivers.audio.test.ts         | 16 ++++++++--------
 5 files changed, 19 insertions(+), 19 deletions(-)
```

---

## Commit groups

### Group 1: Test Mock Typings
- **Message**: `test(frontend): type audio driver mock functions for vitest 5 compatibility`
- **Files**:
  - `frontend/tests/drivers.audio.earcons.test.ts`
  - `frontend/tests/drivers.audio.test.ts`

### Group 2: GitHub Actions Node Version
- **Message**: `ci: bump node version to 22 for vitest 5 compatibility`
- **Files**:
  - `.github/workflows/ci.yml`
  - `.github/workflows/a11y.yml`
  - `.github/workflows/pbt-soak.yml`

### Group 3: Toolchain Documentation & Report
- **Message**: `docs: add report for vitest 5 and vite 8 toolchain bump`
- **Files**:
  - `docs/reports/agy-toolchain-report.md`
