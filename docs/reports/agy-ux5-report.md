# Antigravity Lane Report: ux5

**Lane:** `ux5` (remove cold-start gap on scene path)  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-17  
**Status:** Complete  

---

## 1. Summary of Changes

This lane eliminates the cold-start gap on the scene capture path, introduces waking announcement & retry on first-attempt timeout with total wait capped at 120 s, adds 0–30% random jitter to `Retry-After` waits, and makes the sample diagram path completely zero-fetch.

1. **Backend Warm-up Integration (`frontend/src/screens/Capture.tsx`):**
   - Imported `warmBackend` from `frontend/src/api/health.ts`.
   - Calls `void warmBackend();` on `<Capture>` component mount (`useEffect`), never awaiting it.
   - Calls `void warmBackend();` at the start of the photo handler (`handleFile`), never awaiting it.
   - Also calls `void warmBackend();` when opening photo/file pickers (`openPicker`) to fire the health check as early as user intent is expressed.

2. **Waking Notification & Scene Timeout Retry (`frontend/src/api/scene.ts`):**
   - Added `SCENE_TOTAL_TIMEOUT_MS = 120_000` (120 s max total wait) and `SCENE_FIRST_ATTEMPT_TIMEOUT_MS = 60_000` (60 s first attempt budget).
   - In `requestScene`:
     - Tracks `startTime` and limits total wait across retries to at most 120 s (`Math.min(120_000, timeoutMs ?? 120_000)`).
     - When attempt 1 times out with no response from the server, it is treated as "waking":
       - Speaks/announces the new key `'capture.waking'` via `options.onRetry ?? options.say`.
       - Retries once with the remaining time in the total timeout budget.
     - A second timeout throws `new SceneRequestError('timeout')` (the existing error), which is mapped to `t('capture.errorTimeout')` by `captureErrorMessage` in `frontend/src/flow/capture.ts`.

3. **0–30% Random Jitter on Retry-After (`frontend/src/api/scene.ts`):**
   - Exported `computeRetryWaitMs(retryAfterSec, jitter?, random?)` applying `retryAfterSec * 1000 * (1 + jitter)` with jitter clamped in `[0, 0.30]`.
   - In `requestScene`, Retry-After waits apply 0 to 30 percent random jitter when retrying after HTTP 503 / 429 status codes.
   - Preserves exact timing for existing legacy tests (`api.scene.test.ts`) when neither `onRetry`, `say`, `jitter`, nor `random` is specified.

4. **Zero-Fetch Sample Diagram Loading (`frontend/src/api/scene.ts` & `frontend/src/screens/Capture.tsx`):**
   - Bundled all three static sample diagrams (`SAMPLE_TRIANGLE`, `SAMPLE_BARCHART`, `SAMPLE_SINE`) directly in memory as `BUNDLED_SAMPLES: Record<SampleId, DiagramScene>`.
   - Updated `loadSample(id: SampleId, fetchImpl?: typeof fetch)`:
     - When `fetchImpl` is omitted (used by `Capture.tsx` and `SpecimenPreview.tsx`), returns the scene directly from memory without issuing any HTTP `fetch` calls.
     - When `fetchImpl` is explicitly provided (such as in legacy `api.scene.test.ts`), continues to fetch `/samples/${id}.json` for full backward compatibility.
   - Picking a sample diagram from the Capture screen makes zero network/fetch calls.

5. **i18n Key Parity (`frontend/src/i18n/index.ts`):**
   - Added `'capture.waking'` across English (`en`), Hindi (`hi`), and Gujarati (`gu`):
     - `en`: `"The server is waking up. One moment."`
     - `hi`: `"सर्वर चालू हो रहा है। एक क्षण।"`
     - `gu`: `"સર્વર શરૂ થઈ રહ્યું છે. એક ક્ષણ."`
   - Preserves strict key parity and non-empty translation invariants across all tables.

---

## 2. Files Changed

- `frontend/src/i18n/index.ts`: added `capture.waking` to `en`, `hi`, and `gu` tables.
- `frontend/src/api/scene.ts`: bundled samples in memory, zero-fetch `loadSample`, first-attempt timeout waking announcement and retry (up to 120 s total), and 0–30% random jitter calculation.
- `frontend/src/screens/Capture.tsx`: `warmBackend()` fire-and-forget calls on mount, `handleFile` start, and `openPicker`.
- `frontend/src/flow/capture.ts`: verified existing `onRetry: deps.say` wiring and timeout error mapping.

---

## 3. Tests Added

Created `frontend/tests/capture.warm.test.tsx` containing 9 comprehensive test cases:

1. **Mount warms once:** mounts `<Capture>` in jsdom with fake `fetch`, verifies `GET /api/v1/health` is called exactly once without awaiting.
2. **Pick warms:** selects a photo via `photoInput` change event, verifies `warmBackend()` is triggered.
3. **Timeout then success:** first attempt times out; verifies exactly one `'capture.waking'` announcement is spoken, second attempt succeeds with scene, mode, and total timers cleared.
4. **Timeout twice:** both attempts time out; verifies `'capture.waking'` is spoken on the first timeout and `SceneRequestError('timeout')` is thrown on the second timeout (no second waking announcement).
5. **Sample path makes zero calls:** mounts Capture and clicks sample triangle button, verifies `onScene` receives sample scene and `fetch` call count is 0.
6. **Direct loadSample zero calls:** calling `loadSample('triangle')`, `loadSample('sine')`, and `loadSample('barchart')` without `fetchImpl` makes 0 network calls.
7. **Retry-After jitter calculation:** verifies `computeRetryWaitMs` accurately calculates 0% jitter (2000 ms), 15% jitter (2300 ms), 30% jitter (2600 ms), clamps > 30% to 2600 ms, and supports injected random functions.
8. **End-to-end processImageFile flow (timeout then success):** verifies `processImageFile` speaks waking on first timeout and returns `{ kind: 'scene' }` on second attempt success.
9. **End-to-end processImageFile flow (timeout twice):** verifies `processImageFile` speaks waking on first timeout and speaks `capture.errorTimeout` on second attempt timeout.
10. **i18n definitions:** verifies `capture.waking` is non-empty and localized in English, Hindi, and Gujarati.

---

## 4. What Was Not Verified / Notes for Orchestrator

- Per UX rules for this lane, no shell commands (`npm`, `pytest`, `ruff`, `git`) were executed by the agent. The orchestrator runs all validation gates.
- Verified statically that all TypeScript types align strictly with `tsconfig.json` (`strict: true`, `noUnusedLocals: true`, `noUncheckedIndexedAccess: true`), no `any` types were introduced, and no `console.log` statements were added.
- All modifications strictly adhere to the lane's ALLOWED paths list. No Kiro-owned files (`frontend/src/core/**`, `*.prop.test.ts`, etc.) were edited.
