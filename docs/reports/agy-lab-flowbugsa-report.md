# Lane lab-flowbugsa Report: Navigation, Memory, and Double-Tap Bug Fixes

**Agent:** Antigravity (agy)  
**Date:** 2026-11-06  
**Lane:** `lab-flowbugsa`  
**Reference:** `docs/briefs/agy-lab-flowbugsa.md` & `docs/reports/audit-bugs.md` (Findings 3, 4, 9, 16)

---

## 1. Summary of Changes

This lane addresses four high- and medium-impact flow and driver bugs identified during the mobile bug hunt audit, specifically targeting Android Chrome and TalkBack screen-reader behavior:

1. **Finding 3 (HIGH): Android Back button & TalkBack Back gesture on secondary screens.** Lifted navigation history and popstate management for secondary screens (`SavedDiagrams` and Teacher `Correct`) into `App.tsx` and `drivers/navigation.ts`, ensuring system Back returns smoothly to previous screens (Explore → Capture, Saved → Capture, Correct → Explore).
2. **Finding 4 (HIGH): Raw photo object URLs memory leak.** Implemented `createPhotoUrlTracker` in `flow/capture.ts` and wired it in `App.tsx` to automatically revoke Blob URLs via `URL.revokeObjectURL()` whenever replaced, when leaving Explore back to Capture, or on App unmount, while keeping the photo intact for Teacher Correct overlays.
3. **Finding 9 (MEDIUM): Double-tap vulnerability on Start and sample buttons.** Added `started = useRef(false)` debounce to `Start.tsx`, and a synchronous `busyRef = useRef(false)` guard to `Capture.tsx`'s `handleSample` and `handleFile` so rapid double-taps speak `capture.busy` and never trigger duplicate scene loads.
4. **Finding 16 (LOW): Camera file input missing cancel handling.** Added `handleCancel` to `Capture.tsx` wired to `onCancel` and native DOM `cancel` events, as well as empty-selection handling in `handleFile`, restoring idle state and focus to the "Take photo" button silently.

---

## 2. Findings Detail

### Finding 3 (HIGH): System Back Navigation on Secondary Screens
- **What was wrong:**
  Previously, navigation history entries (`pushExploreEntry`) and `popstate` listeners (`onBack`) were only implemented inside `Explore.tsx`. When navigating to secondary screens (Teacher Correct via `handleCorrect` or Saved Diagrams via `openSaved`), no history state was pushed, or existing popstate listeners were unmounted. Pressing the Android hardware Back button or performing the TalkBack back gesture trapped the user on the screen or popped past the PWA and exited to the browser home screen.
- **What changed:**
  - In `frontend/src/drivers/navigation.ts`:
    - Added `pushSavedEntry()`: pushes `{ screen: 'saved' }` with React StrictMode idempotence guard.
    - Added `leaveSavedEntry()`: calls `window.history.back()` once and arms suppression so the resulting popstate is ignored.
    - Added `onSavedBack(handler)`: listens for genuine popstate events away from `saved` and executes the back callback.
    - Added `replaceSavedEntry()`: replaces `{ screen: 'saved' }` with `{ screen: 'capture' }` when opening a diagram from Saved, ensuring Back from Explore returns directly to Capture.
    - Added `pushCorrectEntry()`: pushes `{ screen: 'correct' }` with StrictMode idempotence guard.
    - Added `leaveCorrectEntry()`: calls `window.history.back()` once with suppression for Save/Cancel actions.
    - Added `onCorrectBack(handler)`: listens for genuine popstate events away from `correct` back to `explore`.
    - Updated `_resetNavigationState()` to clear `savedPushed`, `correctPushed`, and suppression timers.
    - Added these methods to `NavigationDriver` interface and `createBrowserNavigation()`.
  - In `frontend/src/App.tsx`:
    - Subscribed to `onSavedBack` and `onCorrectBack` in a `useEffect` keyed on active `view`.
    - In `openSaved`: called `pushSavedEntry()`.
    - In `handleSavedBack`: called `leaveSavedEntry()` and spoken prompt.
    - In `handleSavedOpen`: called `replaceSavedEntry()` before navigating to Explore.
    - In `handleCorrect`: called `pushCorrectEntry()`.
    - In `handleSaveCorrect` and `handleCancelCorrect`: called `leaveCorrectEntry()`.
    - Preserved two-finger swipe down gesture and spoken announcements unchanged.
- **Proving test:**
  - `frontend/tests/nav.back.test.ts`: 14 tests verifying push, leave, popstate handlers, suppression guards, StrictMode idempotence, and screen transitions for Saved, Correct, and Explore.

---

### Finding 4 (HIGH): Raw Photo Object URLs Never Revoked
- **What was wrong:**
  `Capture.tsx` generates raw Blob URLs via `URL.createObjectURL(file)` when processing camera photos and file uploads, passing them to `App.tsx` state. The application never called `URL.revokeObjectURL(photoUrl)`. After multiple high-resolution camera captures (15–30 MB each), memory consumption caused tab crashes or abrupt reloads on low-memory Android devices.
- **What changed:**
  - In `frontend/src/flow/capture.ts`:
    - Implemented `createPhotoUrlTracker(revoke?)` producing `PhotoUrlTracker` with `getCurrent()`, `update(newUrl)`, and `dispose()`.
    - On `update(newUrl)`: if an active URL exists and differs from `newUrl`, invokes `revoke(activeUrl)`.
    - On `dispose()`: revokes any remaining active URL and clears internal reference.
    - Preserved progress tone intervals and spoken messages completely unchanged.
  - In `frontend/src/App.tsx`:
    - Initialized `photoTracker = useRef<PhotoUrlTracker>(createPhotoUrlTracker())`.
    - Wrapped photo URL updates in `updatePhotoUrl(newUrl)`: calls `photoTracker.current.update(newUrl)` and sets state.
    - In `handleScene`: calls `updatePhotoUrl(photo ?? null)`, releasing any previous photo URL.
    - In `handleBack`: calls `updatePhotoUrl(null)`, releasing active photo URL when returning to Capture.
    - In `handleSavedOpen`: calls `updatePhotoUrl(null)`.
    - In unmount cleanup effect: calls `photoTracker.current.dispose()`.
  - In `frontend/src/screens/Correct.tsx`:
    - Maintained object-URL ownership without prematurely revoking `photoUrl` during Explore ⇄ Correct transitions; cleaned up local `photoImgRef.current = null` on unmount.
- **Proving test:**
  - `frontend/tests/capture.lifecycle.test.tsx`: Unit tests verifying `createPhotoUrlTracker` revokes previous URLs on replacement, revokes on `update(null)`, and revokes on `dispose()`; component tests verifying Correct overlay renders with `photoUrl` without premature revocation.

---

### Finding 9 (MEDIUM): Double-Tap Vulnerability on Start and Sample Buttons
- **What was wrong:**
  1. In `Start.tsx`, `begin()` lacked click debounce. Rapid double-taps (especially common with TalkBack double-tap activation) triggered `handleStartTap` and `onBegin` twice.
  2. In `Capture.tsx`, `handleSample` checked `if (busy)` but did not set `busy = true` synchronously before `await loadSample(id)`. Because React `useState` updates are asynchronous, rapid double-taps passed the guard, triggering concurrent sample loads, duplicate success earcons, and overlapping speech announcements.
- **What changed:**
  - In `frontend/src/screens/Start.tsx`:
    - Added `started = useRef(false)`. In `begin()`, checks `if (started.current) return; started.current = true;` to ignore all secondary taps.
  - In `frontend/src/screens/Capture.tsx`:
    - Added `busyRef = useRef(false)`.
    - In `handleSample`: checks `if (busy || busyRef.current) { say(t('capture.busy')); return; }`. Synchronously sets `busyRef.current = true` and `setBusy(true)` before `loadSample`. Resets `busyRef.current = false` in error, abort, and completion paths.
    - In `handleFile`: checks `if (busy || busyRef.current) { say(t('capture.busy')); return; }` and synchronously sets `busyRef.current = true`.
    - In `openPicker`: checks `if (busy || busyRef.current) say(t('capture.busy'))`.
- **Proving test:**
  - `frontend/tests/capture.lifecycle.test.tsx`:
    - Verifies double-tap on Start only calls `onBegin` once.
    - Verifies rapid double-tap on sample button speaks `capture.busy` and calls `onScene` exactly once.

---

### Finding 16 (LOW): Camera File Input Missing Cancel Handling
- **What was wrong:**
  When a user opened the camera or file picker on mobile and dismissed it (via Android Back or system cancel), no `onChange` event fired. The inputs lacked `onCancel` listeners, leaving the screen in a potentially busy state and leaving focus lost to `document.body`. Empty selection (`files.length === 0`) in `handleFile` also returned without restoring idle state or focus.
- **What changed:**
  - In `frontend/src/screens/Capture.tsx`:
    - Added `handleCancel()`: sets `busyRef.current = false`, `setBusy(false)`, and calls `takeButton.current?.focus()`, restoring idle state and focus silently (no speech).
    - Attached `onCancel={handleCancel}` to both `<input type="file">` elements.
    - Attached native DOM `'cancel'` event listeners to `photoInput.current` and `fileInput.current` in `useEffect`.
    - In `handleFile`: if `file === undefined`, calls `handleCancel()` before returning.
    - Added TypeScript declaration module for `InputHTMLAttributes` to support `onCancel` without `any`.
- **Proving test:**
  - `frontend/tests/capture.lifecycle.test.tsx`:
    - Verifies `onCancel` prop is present on file inputs.
    - Verifies triggering `onCancel` restores idle state and focus silently (0 additional speech calls).
    - Verifies triggering `onChange` with empty file list restores idle state and focus silently.

---

## 3. Definition of Done Verification

All DoD commands executed cleanly from the repo root:

### 1. `npm --prefix frontend exec -- tsc -p frontend --noEmit`
- **Result:** Exit code 0 (clean, 0 type errors).

### 2. `npm --prefix frontend test`
- **Result:** Exit code 0 (clean).
- **Summary:** 61 test files passed (61), 858 tests passed (858). Duration: 840 ms.
- **New test suites:**
  - `frontend/tests/nav.back.test.ts` (14 passed)
  - `frontend/tests/capture.lifecycle.test.tsx` (7 passed)

### 3. `npm --prefix frontend run build`
- **Result:** Exit code 0 (clean).
- **Summary:**
  - Vite v8.3.5 production build transformed 73 modules.
  - PWA precache generated with 22 entries (499.46 KiB).
  - Production bundles: `dist/assets/index-CyvWE1So.js` (361.78 kB), `dist/assets/index-BQ5nFygH.css` (58.42 kB).

---

## 4. Commit Groups

### Group 1: Navigation Driver & App History Handling (Finding 3)
- **Message:** `fix(nav): handle system back on saved diagrams and teacher correct screens`
- **Files:**
  - `frontend/src/drivers/navigation.ts`
  - `frontend/src/App.tsx`
  - `frontend/tests/nav.back.test.ts`

### Group 2: Photo Object URL Lifecycle & Revocation (Finding 4)
- **Message:** `fix(capture): revoke raw photo blob URLs to prevent mobile memory leak`
- **Files:**
  - `frontend/src/flow/capture.ts`
  - `frontend/src/App.tsx`
  - `frontend/src/screens/Correct.tsx`

### Group 3: Double-Tap Debounce on Start & Sample Buttons (Finding 9)
- **Message:** `fix(flow): debounce start tap and guard sample diagram double taps`
- **Files:**
  - `frontend/src/screens/Start.tsx`
  - `frontend/src/screens/Capture.tsx`

### Group 4: File Input Cancel & Focus Restoration (Finding 16)
- **Message:** `fix(capture): restore idle state and focus silently on file picker cancel`
- **Files:**
  - `frontend/src/screens/Capture.tsx`
  - `frontend/tests/capture.lifecycle.test.tsx`
