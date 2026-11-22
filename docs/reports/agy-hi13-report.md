# Antigravity Lane Report: hi13 (Ghost Hand Wiring & Navigation - Follow-up 3)

**Date:** 2026-11-22  
**Lane:** hi13 follow-up 3  
**Tool:** Antigravity (agy)

---

## 1. Summary of Changes

This follow-up resolved the two failing tests identified by orchestrator gates:

1. **`tests/app.hooksOrder.test.ts` (Hooks Order Test Fix)**
   - **Root cause:** The test searches for `export function App(` and finds the first `{` following the first `)` to extract the function body and assert hook call order. In follow-up 2, two overload lines (`export function App(props: AppProps): JSX.Element;` and `export function App(): JSX.Element;`) were placed before the real implementation. The test matched the first overload, finding an empty/non-existent body (0 hooks found).
   - **Fix:** Removed the overload signatures from `frontend/src/App.tsx`. Preserved a single declaration: `export function App({ watcher, drivers: initialDrivers }: AppProps = {}): JSX.Element {` with `drivers?: Drivers` in `AppProps`. Confirmed that no other `export function App(` text appears earlier in the file. The test now parses the real parameter list and full component body.

2. **`tests/build.wire.test.tsx` ("Feel mode Back returns to form and speaks build.backToForm without confirmation")**
   - **Root cause:** In `frontend/src/screens/Build.tsx`, `handleFeelBack` was setting `mode = 'form'` and speaking `build.backToForm` locally with only one argument (`drivers.speech.speak(t('build.backToForm'))`), bypassing the application's Back navigation path in `App.tsx`. In `App.tsx`, `leaveByBack('build', { ..., buildFeel: true })` computes `{ next: 'build', announceKey: 'build.backToForm', needsConfirm: false }`, but App had no mechanism to command `Build` to return to form, and `handleFeelBack` did not invoke `onBack()`.
   - **Fix:**
     - In `frontend/src/screens/Build.tsx`, updated `handleFeelBack` to switch mode to `'form'` and invoke `onBack()` (delegating to App's `handleBuildBack`).
     - Added optional `onRegisterBackToForm?: (backToForm: () => void) => void` to `BuildProps` so external Back paths in `App.tsx` (popstate / hash changes) can command Build to return to form mode via `buildBackToFormRef`.
     - In `frontend/src/App.tsx`, when `step.next === 'build'`, App sets `buildFeel.current = false`, calls `buildBackToFormRef.current?.()`, and speaks `t(step.announceKey)` with `LANG_BCP47[currentLang]` without triggering `window.confirm`.

---

## 2. Files Changed

- `frontend/src/App.tsx`
- `frontend/src/screens/Build.tsx`
- `docs/reports/agy-hi13-report.md`
- `docs/BUILD_LOG.md`

---

## 3. What Could Not Be Verified

- **Local shell execution:** In strict adherence to UX rules ("Do NOT run any shell command. No npm, npx, node, python, pytest, ruff, git, curl. The orchestrator runs all gates."), commands were not executed locally and are left for orchestrator validation.
- **Physical TalkBack & Touchscreen:** System TalkBack gestures and hardware capacitive multi-touch haptic feedback on physical devices.

---

## 4. Needs from Kiro

- None. Both failures have been addressed within allowed lane files.
