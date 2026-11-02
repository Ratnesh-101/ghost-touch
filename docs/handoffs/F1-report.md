# F1 Report — Frontend Review Fixes (T06b + T07 Review Findings)

**Builder:** Antigravity (agy)  
**Reviewer:** Claude Code (Kiro paused)  
**Source Brief:** `docs/briefs/F1-frontend-review-fixes.md`  
**Review Fixed:** `docs/reviews/T06b-T07-review.md`  
**Date:** 2026-11-01  

---

## 1. Summary of Changes & Fixes

Followed `AGENTS.md` and user instructions strictly:
- **Frontend Only**: Owned and touched `frontend/**` only. Never touched `backend/`, `research/`, or `docs/reviews/`.
- **Kiro Ownership Preserved**: Never touched `frontend/src/core/**`, `*.prop.test.ts`, `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts`, or `.kiro/**`.
- **Read-only Git**: Zero state-changing git commands executed (`git status`, `git diff`, `git log` only).
- **Secrets & Environment**: Did not open, search, or print any `.env` file; no API keys touched.
- **Zero Real External API Calls**: No external network APIs contacted.
- **Zero New Dependencies**: Used existing `frontend/node_modules` exclusively.

### Implementation Details by Finding

1. **Stale history entry (Finding 1, Finding 9)**:
   - Updated `frontend/src/drivers/navigation.ts`:
     - Added `leaveExploreEntry()`: calls `history.back()` once when an Explore entry was pushed, setting a `suppressNextPop` guard so the resulting popstate event is not treated as a second exit.
     - Added double-push guard in `pushExploreEntry()`: checks if Explore history is already pushed, guarding against React StrictMode double effect runs in development.
     - Updated `onBack()`: checks `history.state` on pop, ignoring suppressed pops as well as forward navigation into `{ screen: 'explore' }`.
   - Updated `frontend/src/screens/Explore.tsx`:
     - Leaving Explore by either the on-screen Back button (`onClick={handleExit}`) or the two-finger swipe down calls `leaveExploreEntry()` followed by `onBack()`.
     - Added comprehensive unit tests in `frontend/tests/drivers.navigation.test.ts` and `frontend/tests/flow.explore.test.ts`.

2. **Centre tick skipped (Finding 2)**:
   - Added `rearmCentreTick(state: CentreTickState): CentreTickState` in `frontend/src/flow/explore.ts` to re-arm `{ ...state, armed: true }` while preserving `firstHoldSpoken`.
   - In `frontend/src/screens/Explore.tsx`: re-arms `centreTickState` on every new hold (`pointerdown` of the primary pointer).
   - Added unit test in `frontend/tests/flow.explore.test.ts`: a hold that ends within the 36 px re-arm radius followed by a new hold at the centre ticks again (with `speakCentre: false`, preserving one-time spoken announcement).

3. **Bar tone sticks & pitch guard & radii (Finding 3, Finding 14)**:
   - In `frontend/src/_temp/hapticEngine.stub.ts`:
     - When leaving a bar into empty space (`target.kind === 'none'`), if `state.lastBarId !== null`, emits `{ kind: 'tone', hz: null }` (design rule 5: leaving all targets silences the tone), and clears `next.lastBarId = null`.
     - Initialized `lastBuzz` and `quietUntil` to `-Infinity` in `initialState()` rather than `0`.
   - In `frontend/src/_temp/pitch.stub.ts`:
     - Hardened `pitchForValue`: guards against `max <= 0`, non-finite `max`, and negative/non-finite `v`, safely returning 200 Hz.
   - In `frontend/src/flow/explore.ts`:
     - Sourced `DEFAULT_RADII` directly from `DEFAULT_HAPTICS.vertexRadius` (22) and `DEFAULT_HAPTICS.lineRadius` (14) instead of duplicating magic numbers.
   - Added unit tests in `frontend/tests/flow.explore.test.ts` for bar-to-none tone silencing and pitch mapping edge cases.

4. **PDF resolution, abort signal, cleanup & extension (Finding 4, Finding 15)**:
   - In `frontend/src/drivers/pdf.ts`:
     - Scale calculation updated from 72 dpi clamping to `scale = maxSide / longest` where `longest = Math.max(unscaledViewport.width, unscaledViewport.height)`. For an A4 page (595×842 pt), renders at scale ≈ 1.90 so the longest side is 1600 px.
     - Added `signal?: AbortSignal` parameter to `renderFirstPage`. When aborted, cancels the active `renderTask` and `loadingTask`, throwing `DOMException('Aborted', 'AbortError')`.
     - Added a 30 s render timeout (`timeoutMs: 30000`) throwing `PdfError('timeout')`. Added `'capture.errorPdfTimeout'` to `i18n/index.ts` and `PDF_ERROR_KEYS` in `flow/capture.ts`.
     - In `finally`, calls `page.cleanup?.()` and `page.destroy?.()` in addition to document and loading task cleanup.
   - In `frontend/src/drivers/camera.ts`:
     - Added `isPdfFile()` recognizing files with empty MIME type `""` whose filename ends in `.pdf`. Updated `validateImageFile()` to accept them.
     - Fixed stale top-of-file comment stating PDFs are rejected; updated to describe validation and delegation to `drivers/pdf.ts`.
   - In `frontend/src/flow/capture.ts`: passed `deps.signal` into `renderPdf` / `renderFirstPage`.
   - Added unit tests in `frontend/tests/drivers.pdf.test.ts`, `frontend/tests/camera.test.ts`, and `frontend/tests/flow.capture.test.ts`.

5. **Stale viewport (Finding 5)**:
   - In `frontend/src/screens/Explore.tsx`:
     - Added a `ResizeObserver` observing the canvas element in `useEffect`, invoking `updateDimensions()` whenever container layout shifts (font load, status text wrapping, URL bar change).
     - Maintained `window.addEventListener('resize', ...)` for window-level resizes.
     - In `handlePointerDown`, invokes `updateDimensions()` to ensure live dimensions are synced before processing touches.

6. **Canvas focus & aria-label (Finding 6)**:
   - **Left as-is** as instructed by the brief ("Do NOT change: needs the owner's phone or approval; do not change the focus or the label; just note in your report what you left as is").
   - Canvas retains `role="img"`, `tabIndex={0}`, and `aria-label={canvasAriaLabel(scene)}`. Physical phone testing with TalkBack will evaluate if double announcement occurs.

7. **Axis crossing hysteresis & seeding (Finding 7)**:
   - Added `DEFAULT_AXIS_HYSTERESIS_NORM = 0.015` in `frontend/src/flow/explore.ts`.
   - Added `seedAxisState()`: seeds initial side (`'left' | 'right'`, `'above' | 'below'`) on `pointerdown` without speaking.
   - Updated `checkAxisCrossing()`: requires crossing beyond the dead band (`±0.015` normalized) to trigger speech. Jitter around an axis line remains within the dead band without repeating speech.
   - In `Explore.tsx`: resets and seeds `axisState.current` on each new hold (`pointerdown`).
   - Added unit tests in `frontend/tests/flow.explore.test.ts`.

8. **Weak tests replaced & missing tests added (Finding 8)**:
   - Replaced the local closure test in `flow.explore.test.ts` with real tests exercising `pushExploreEntry`, `leaveExploreEntry`, and `onBack`.
   - Added scripted triangle trace test in `flow.explore.test.ts`: line buzz → corner pattern at vertex → 450 ms silence (quiet window blocks line buzz) → line buzz returns.
   - Added quiet window test and vertex-to-empty space test.
   - Added test verifying `step(lift)` stops vibration (`vibrate: 0`), silences tone (`tone: null`), and resets engine state for `pointerup`, `pointercancel`, and `lostpointercapture`.
   - Added A4 PDF scale test asserting `scale > 1.8 && scale < 2.0` (failing if scale is 1.0).
   - Added PDF abort and timeout tests.

10. **Swipe exit once & clear pointers (Finding 10)**:
    - Added `leaving = useRef(false)` guard in `frontend/src/screens/Explore.tsx`.
    - In `handleExit()`: returns immediately if `leaving.current` is true, sets flag, clears `activePointers`, clears `primaryPointerId`, calls `leaveExploreEntry()`, and invokes `onBack()`.
    - `handlePointerMove` checks `leaving.current` and returns immediately.

11. **Second finger landing mid-drag (Finding 11)**:
    - Added `primaryPointerId = useRef<number | null>(null)` in `frontend/src/screens/Explore.tsx`.
    - On `pointerdown`: only the first pointer (`primaryPointerId.current === null`) resets engine state, re-arms centre tick, seeds axis state, and runs the move pipeline. Extra pointers only update `activePointers` for two-finger gestures (swipe down, long-press).
    - On `pointermove`: only the primary pointer drives the haptic/audio pipeline.
    - On `pointerup`/`pointercancel`/`lostpointercapture`: lifts the engine only when the primary pointer lifts.

12. **Redrawing jank & decoupled haptics (Finding 12)**:
    - Separated scene rendering into `renderStaticScene()`: draws glowing green lines (shadowBlur 12), faint centre cross, coordinate axes, segments, polylines, bars, and vertices onto an offscreen canvas (`offscreenCanvasRef`) once per resize / dimension change.
    - `draw()` only does `ctx.drawImage(offscreenCanvas, 0, 0)` plus the 5 px cursor dot.
    - Throttled cursor redraws with `requestAnimationFrame` (`scheduleDraw`); all haptics (`hitTest`, `step`, `vibrate`, `audio`) execute synchronously and immediately, never waiting for canvas drawing.

13. **Debug strings & unused keys (Finding 13)**:
    - In `frontend/src/i18n/index.ts`:
      - Removed unused keys `'explore.exitHint'` and `'explore.stubHint'`.
      - Added `'explore.debugWaiting': 'Relative cursor: waiting for touch'`.
      - Added `'explore.debugOffset': 'First hold: dx={dx}px, dy={dy}px from centre'`.
    - In `frontend/src/screens/Explore.tsx`: debug text initialized via `t('explore.debugWaiting')` and updated via `t('explore.debugOffset')`.

---

## 2. Unmeasured DoD Items

- **Physical Phone Verification**:
  - TalkBack double-reading spike (Finding 6) requires testing on a physical Android device.
  - Physical vibration feel of the 25 ms centre tick and two-finger gesture fluidity on touchscreen hardware.

---

## 3. Verification & Proof of DoD

All verification commands executed from `frontend/`:

### A. TypeScript Check (`npx tsc --noEmit`)
```
Command exited with code 0.
Clean (0 errors).
```

### B. Vitest Unit & Property Tests (`npm test` — 3 consecutive runs)
- **Run 1**:
  - Test Files: 19 passed (19)
  - Tests: 212 passed (212)
  - Duration: 1.15s
- **Run 2**:
  - Test Files: 19 passed (19)
  - Tests: 212 passed (212)
  - Duration: 1.22s
- **Run 3**:
  - Test Files: 19 passed (19)
  - Tests: 212 passed (212)
  - Duration: 1.12s
- *Note:* Flaky P1 property test did not fail during any run.

### C. Production Build (`npm run build`)
```
vite v6.4.5 building for production...
transforming...
✓ 57 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                           0.13 kB
dist/manifest.webmanifest                    0.49 kB
dist/index.html                              0.69 kB │ gzip:   0.40 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs  1,264.34 kB
dist/assets/index-NzojCy_T.css               4.07 kB │ gzip:   1.23 kB
dist/assets/index-CkrVFw4W.js              184.72 kB │ gzip:  59.70 kB
dist/assets/pdf-BtCWNl9F.js                483.74 kB │ gzip: 144.80 kB
✓ built in 1.22s

PWA v0.21.2
mode      generateSW
precache  12 entries (208.41 KiB)
files generated
  dist/sw.js
  dist/workbox-9c191d2f.js
```
- Main bundle: 184.72 kB (59.70 kB gzip).
- PDF chunk: 483.74 kB (lazy loaded, separate chunk).
- PDF worker: 1,264.34 kB.
- Precache: 12 entries (208.41 KiB).

---

## 4. Files Touched

Only assigned frontend files were touched:
- `frontend/src/_temp/hapticEngine.stub.ts`
- `frontend/src/_temp/pitch.stub.ts`
- `frontend/src/drivers/camera.ts`
- `frontend/src/drivers/navigation.ts`
- `frontend/src/drivers/pdf.ts`
- `frontend/src/flow/capture.ts`
- `frontend/src/flow/explore.ts`
- `frontend/src/i18n/index.ts`
- `frontend/src/screens/Explore.tsx`
- `frontend/tests/camera.test.ts`
- `frontend/tests/drivers.navigation.test.ts`
- `frontend/tests/drivers.pdf.test.ts`
- `frontend/tests/flow.capture.test.ts`
- `frontend/tests/flow.explore.test.ts`

Zero Kiro-owned files were touched.

---

## 5. BUILD_LOG Text (for manual append)

```markdown
### 2026-11-01 — Task F1 (Frontend Review Fixes) — Antigravity

- **What was built/fixed:**
  - Fixed stale history entry on Explore exit: `drivers/navigation.ts` now provides `leaveExploreEntry()` calling `history.back()` once, guarded against double-exit popstate and StrictMode double-push; Explore exit via Back button or two-finger swipe calls `leaveExploreEntry()`.
  - Fixed centre tick skip: added `rearmCentreTick()` in `flow/explore.ts` and re-arm on every new hold (`pointerdown`), keeping `firstHoldSpoken`.
  - Fixed bar tone sticking: `_temp/hapticEngine.stub.ts` emits `tone(null)` when transitioning from a bar to empty space (`target.kind === 'none'`).
  - Hardened `pitchForValue`: guards against zero, negative, and non-finite max values.
  - Sourced `DEFAULT_RADII` from `DEFAULT_HAPTICS` (22/14) instead of duplicating magic numbers.
  - Fixed PDF resolution: renders first page scaled so longest side is 1600 px (A4 scale ≈ 1.90) rather than 72 dpi scale 1.0; added abort signal support and 30 s render timeout; cleaned up `page.cleanup()` in `finally`; accepted empty MIME type with `.pdf` extension; updated stale comment in `camera.ts`.
  - Fixed stale viewport: added `ResizeObserver` on canvas element alongside window resize listener.
  - Fixed axis crossing jitter: added `DEFAULT_AXIS_HYSTERESIS_NORM` (0.015) dead band and `seedAxisState()` on `pointerdown` to eliminate false crossings and jitter repeat speech.
  - Fixed two-finger swipe exit: added `leaving` guard and cleared active pointers.
  - Multi-touch handling: only primary pointer drives engine and centre tick; extra pointers feed two-finger detectors.
  - Decoupled canvas drawing: pre-renders static diagram (shadowBlur 12) to offscreen canvas; cursor moves use rAF throttling; haptics run synchronously without waiting for drawing.
  - Moved debug strings to `i18n` (`explore.debugWaiting`, `explore.debugOffset`); removed dead keys (`explore.exitHint`, `explore.stubHint`).
  - Strengthened tests: added real navigation integration tests, scripted triangle trace test, quiet window blocking test, two-hold centre tick test, bar-to-none tone test, and lift cancellation test.
- **What broke:** None. All 19 test files (212 tests) pass across 3 consecutive runs; `tsc --noEmit` clean; production build clean.
- **Files touched:**
  - `frontend/src/_temp/hapticEngine.stub.ts`
  - `frontend/src/_temp/pitch.stub.ts`
  - `frontend/src/drivers/camera.ts`
  - `frontend/src/drivers/navigation.ts`
  - `frontend/src/drivers/pdf.ts`
  - `frontend/src/flow/capture.ts`
  - `frontend/src/flow/explore.ts`
  - `frontend/src/i18n/index.ts`
  - `frontend/src/screens/Explore.tsx`
  - `frontend/tests/camera.test.ts`
  - `frontend/tests/drivers.navigation.test.ts`
  - `frontend/tests/drivers.pdf.test.ts`
  - `frontend/tests/flow.capture.test.ts`
  - `frontend/tests/flow.explore.test.ts`
```
