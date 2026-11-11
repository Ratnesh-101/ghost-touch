# Lane Report: z4-test-flake (App-import tests must not time out under load)

**Status:** DONE
**Tool:** agy, reviewed by Claude
**Lane:** z4-test-flake

## 1. Problem Description
During full `npx vitest run` executions while concurrent processes (Kiro, Playwright, Chromium)
were executing, `frontend/tests/q2.round5.test.tsx` failed intermittently as a whole suite (12
tests skipped).

The failure was caused by Vitest's hook timeout expiring:
```typescript
beforeAll(async () => {
  const app = await import('../src/App');
  resolveShareRoute = app.resolveShareRoute;
  speakShareAnnouncements = app.speakShareAnnouncements;
});
```
Because no timeout argument was provided, Vitest defaulted to 10,000 ms (10 s). Under heavy
concurrent CPU/memory load during test execution across multiple processes, the dynamic
compilation, transpilation, and module graph resolution of `App.tsx` and its transitive
dependencies exceeded 10 s, causing the hook to abort and skipping the entire 12-test suite.

## 2. Codebase Audit
A thorough audit across all test files in `frontend/tests/` was performed searching for
dynamic `import('../src/App')`, `import("../src/App")`, and large modules (`pdf`, `share`):

1. **`frontend/tests/q2.round5.test.tsx` (Offending file):**
   - Had uncached dynamic `import('../src/App')` in `beforeAll` with default 10 s timeout.
2. **`frontend/tests/z3.appMergedFixes.test.tsx` (Reference pattern):**
   - Already cached `App` via `loadAppModule()` and specified `beforeAll(..., 60_000)`.
3. **`frontend/tests/correct.back.test.tsx` (Reference pattern):**
   - Already cached `App` via `getAppModule()` and specified `beforeAll(..., 60_000)`.
4. **Static import suites (Node / SSR server render):**
   - `share.open.routing.test.tsx`, `teach.routing.test.tsx`, `m3.sharedLinkGate.test.ts`,
     `screens.render.test.ts`, `fix.runtime.test.tsx`, `h6.nav.test.ts`, `k1.verifyWiring.test.ts`,
     `lang.rerender.test.tsx`.
   - These statically import `App` at top-level; they do not perform dynamic imports in hooks
     or test cases.
5. **Component and unit tests:**
   - `a3.savedTitleLang.test.tsx`, `z1.frontend.fixes.test.tsx`, `ghostwriter.teach.test.tsx`,
     `teach.editor.test.tsx`, `teach.canvas.pointer.test.tsx`, `capture.cancel.test.tsx`,
     `capture.lifecycle.test.tsx`, `w3.buzzFallback.test.tsx`, `k6.pwa-offline.test.ts`,
     `k7.perf.test.tsx`, `k8.i18n.test.ts`, `alive.lab.test.tsx`, `settingsLauncher.test.tsx`,
     `explore.layout.test.tsx`, `explore.lab.test.tsx`.
   - None dynamically import `App` or heavy modules in hooks or test cases.

## 3. Remediation Details
In `frontend/tests/q2.round5.test.tsx`:
1. Introduced module-level caching matching the pattern used in `z3.appMergedFixes.test.tsx`:
   ```typescript
   let appModuleCache: typeof import('../src/App') | null = null;
   async function loadAppModule(): Promise<typeof import('../src/App')> {
     if (!appModuleCache) {
       appModuleCache = await import('../src/App');
     }
     return appModuleCache;
   }
   ```
2. Updated `beforeAll` to use `loadAppModule()` and supplied an explicit generous timeout of
   `60_000` ms (60 s):
   ```typescript
   beforeAll(async () => {
     const app = await loadAppModule();
     resolveShareRoute = app.resolveShareRoute;
     speakShareAnnouncements = app.speakShareAnnouncements;
   }, 60_000);
   ```
3. Ensured no assertions were changed or weakened. All 12 test assertions remain identical.
4. Maintained strict line lengths within 100 columns and ruff-format style.

## 4. Before / After Timeouts

| Metric | Details |
|---|---|
| **File** | `frontend/tests/q2.round5.test.tsx` |
| **Location** | `beforeAll` hook (lines 125–129) |
| **Mechanism** | Module-level `appModuleCache` via `loadAppModule()` |
| **Before Timeout** | 10,000 ms (Vitest hook default) |
| **After Timeout** | 60,000 ms (explicit 60s timeout parameter) |

## 5. Files Touched
- `frontend/tests/q2.round5.test.tsx`
- `docs/reports/agy-z4-test-flake-report.md`
- `docs/BUILD_LOG.md`
