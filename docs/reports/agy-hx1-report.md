# Agend Report: Lane hx1 — Crash Guard & Error Boundary

**Lane**: `hx1`  
**Role**: Antigravity (agy), Builder  
**Objective**: Last line of defence for a blind user when the app crashes. Cease sensory feedback immediately (vibration and audio/speech), announce the crash once without spamming, provide an accessible full-screen recovery surface, and attach global handlers.

---

## 1. Files Changed

### Created (New)
1. [crashGuard.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx1/frontend/src/drivers/crashGuard.ts)
   - `stopEverything()`: cancels `navigator.vibrate(0)` and `window.speechSynthesis.cancel()` inside `try/catch`. Safe against undefined browser hosts.
   - `announceCrash(text, lang)`: speaks once via `SpeechSynthesisUtterance` and throttles repeated calls within 5 seconds so repeated errors remain silent.
   - `installGlobalHandlers()`: registers `window` `'error'` and `'unhandledrejection'` listeners; `'error'` triggers `stopEverything()`, while unhandled promise rejections remain inaudible.
   - `reloadApp()`: wraps `window.location.reload()` safely in `try/catch` within the driver layer.
   - Zero dependencies on the app's `Drivers` object.

2. [CrashScreen.tsx](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx1/frontend/src/components/CrashScreen.tsx)
   - Component with container `role="alert"`.
   - Displays the crash sentence as visible text: `t('crash.message')`.
   - Renders one full-screen button with accessible name `t('crash.restart')` and class `gt-control` (minimum 48×48 px touch target).
   - Automatically focuses the restart button on mount via React ref.
   - Invokes `reloadApp()` on button click.

3. [ErrorBoundary.tsx](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx1/frontend/src/components/ErrorBoundary.tsx)
   - React class component implementing `componentDidCatch` and `getDerivedStateFromError`.
   - On error: calls `stopEverything()`, calls `announceCrash(t('crash.message'))`, and renders `<CrashScreen />`.

4. [crashGuard.test.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx1/frontend/tests/crashGuard.test.ts)
   - Unit tests for `stopEverything()`, `announceCrash()`, `installGlobalHandlers()`, and `reloadApp()`.

5. [crashBoundary.test.tsx](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx1/frontend/tests/crashBoundary.test.tsx)
   - Integration tests verifying React error boundary catching, screen rendering, `vibrate(0)` call, accessible button name, 48 px class, 5-second silence throttling, and resilience to undefined/throwing Web APIs.

### Modified
1. [main.tsx](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx1/frontend/src/main.tsx)
   - Calls `installGlobalHandlers()` once at bootstrap.
   - Wraps `<App />` in `<ErrorBoundary>`.

2. [i18n/index.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx1/frontend/src/i18n/index.ts)
   - Added translations for `crash.message` ("Something went wrong. Double tap the screen to start again.") and `crash.restart` across English (`en`), Hindi (`hi`), and Gujarati (`gu`).

3. [global.css](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx1/frontend/src/styles/global.css)
   - Added `.gt-crash-screen`, `.gt-crash-message`, and `.gt-crash-button` styles enforcing minimum 48×48 px targets, high-contrast palette, and visible focus indicators (`outline: 3px solid var(--gt-cyan)`).

---

## 2. Tests Added

### `frontend/tests/crashGuard.test.ts`
- **`stopEverything`**:
  - Calls `navigator.vibrate(0)` and `speechSynthesis.cancel()` inside `try/catch`.
  - Works safely when `speechSynthesis` and `navigator.vibrate` are undefined.
  - Catches and ignores thrown exceptions from `navigator.vibrate` or `speechSynthesis.cancel`.
- **`announceCrash`**:
  - Speaks once using `SpeechSynthesisUtterance`.
  - Enforces 5 s silence: ignores repeat calls within 5000 ms, speaks again after 5000 ms.
  - Safe against missing `speechSynthesis` or `speak` throwing.
- **`installGlobalHandlers`**:
  - Adds window `'error'` and `'unhandledrejection'` listeners.
  - `'error'` triggers `stopEverything()` (`vibrate(0)` and `cancel()`).
  - `'unhandledrejection'` does nothing audible (neither vibrate nor speech cancel/speak called).
  - Returns cleanup unregistering listeners.
- **`reloadApp`**:
  - Invokes `window.location.reload()` safely in `try/catch`.

### `frontend/tests/crashBoundary.test.tsx`
- **Normal render**: Renders children normally without activating error boundary or speech.
- **Error catching**: Boundary shows `<CrashScreen />` with `role="alert"` and speaks `t('crash.message')` once when child component throws.
- **Sensory cutoff**: `navigator.vibrate(0)` and `speechSynthesis.cancel()` called on error.
- **Accessibility & Controls**: Button has accessible name (`t('crash.restart')`), has the 48 px touch-target class (`gt-control`), and is focused on mount.
- **Throttle**: Second crash inside 5 s is silent; subsequent crash after 5 s speaks again.
- **Resilience**: Boundary handles errors gracefully when `window.speechSynthesis` and `navigator.vibrate` are undefined.
- **CrashScreen standalone**: Renders alert, message, 48 px button, and invokes restart handler on click.

---

## 3. What Could Not Be Verified
- **Shell gates**: In strict adherence to HX RULES ("Do NOT run any shell command. No npm, npx, python, pytest, ruff, git, curl. The orchestrator runs all gates."), `npm test`, `tsc`, and `vite build` were not executed directly by agy; the orchestrator will run these gates.
- **Physical device hardware**: Real TalkBack gesture activation and physical motor vibration cancellation on an Android phone (simulated via standard DOM/browser mocks in Vitest/JSDOM).
- **Native browser reload**: Full HTTP document reload in a live browser session (verified via mock inspection).
