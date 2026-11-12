# Report: Lane r8-explore-fix (fixes from the Kiro review of lane r7-explore)

- **Status:** DONE
- **Tool:** Antigravity (agy), reviewed by Claude
- **Lane:** r8-explore-fix
- **Date:** 2026-11-12

## Purpose
Address all findings from Kiro's review of lane r7-explore (`docs/reviews/kiro-review-r7-explore.md`)
per `docs/briefs/agy-r8-explore-fix.md`.

## Scope & Implementation Details

### 1. MEDIUM: Discriminating EX-01 Test (`frontend/tests/explore.askUnsupportedResetsGate.test.tsx`)
- **Problem:** In the r7-explore implementation of the EX-01 regression test, after clicking the Ask
  button with `canListen = false`, the test immediately dispatched a `pointerdown` directly on
  Vertex A. On the pre-r7 codebase, `handlePointerDown` was not gated by `askActive.current` (only
  `handlePointerMove` was gated). Therefore, a stuck `askActive.current` flag would still allow
  `handlePointerDown` to vibrate and speak, causing the test to pass on the buggy old code.
- **Fix:** Made the test discriminating: after pressing Ask with `canListen: false`, the test fires a
  `pointerdown` at a neutral, empty coordinate off the diagram `(10, 10)`, clears mock calls, and then
  fires `pointermove` onto Vertex A at `(100, 100)`.
- **Old Code Path Analysis:** On the old code path, the stuck `askActive.current = true` entered
  `handlePointerMove`'s gate (`if (askActive.current) return;`), silently updating engine/tick/axis
  state without invoking `applyMoveResult`. Consequently, zero vibration and zero speech were emitted
  on `pointermove`, failing the test. On the fixed code path, `handleVoiceAsk`'s outer `finally` block
  resets `askActive.current = false`, allowing `handlePointerMove` to execute `applyMoveResult`,
  triggering vertex corner vibration `[50, 90, 50]` and speech `'A'`.
- **Proof / Test:** `frontend/tests/explore.askUnsupportedResetsGate.test.tsx` now verifies both the
  neutral pointerdown and the subsequent move to Vertex A with discriminating assertions.

### 2. LOW: Return Unused Budget Back to Points in TalkBack Overlay (`frontend/src/flow/a11yFeatures.ts`)
- **Problem:** When multiple feature kinds existed, `pointQuota` was previously hard-capped at
  `Math.min(points.length, Math.floor(maxFeatures / 2))` (e.g. 30). For scenes with 80 points and 1
  segment, only 31 features were emitted despite the 60-feature ceiling, discarding 29 reachable points.
- **Fix:** In `buildA11yFeatures`, the 30-feature reservation is retained as a floor for other kinds
  (segments, bars, polylines, axes) during the water-fill allocation. After allocating other kinds,
  all unused budget is returned to points:
  `pointQuota = Math.min(points.length, maxFeatures - otherAllocatedTotal)`.
  Scenes with 80 points and 1 segment now yield 60 features (59 points and 1 segment). Scenes with
  dense non-point features (e.g. the 40/30/30 test) continue to guarantee fair share for all kinds.
- **Proof / Tests:**
  - Added test in `frontend/tests/flow.a11yFeatures.share.test.ts`:
    `gives unused budget back to points (80 points + 1 segment gives 60 features, 59 points)`.
  - Updated `includes all kinds for a scene with 80 points, 1 segment, 1 polyline, and 1 axis` in
    both `flow.a11yFeatures.share.test.ts` and `explore.talkback.test.tsx` to verify that points receive
    the unused budget (57 points + 3 other features = 60 features) while including all kinds.
  - Kept existing tests: points-only cap of 60 and the 40/30/30 multi-kind fairness test.

### 3. LOW: Filter Polyline Coordinates as Pairs (`frontend/src/flow/a11yFeatures.ts`)
- **Problem:** In `buildA11yFeatures`, polyline coordinates were previously filtered as separate `xs`
  and `ys` arrays. A point with one finite coordinate and one non-finite coordinate (e.g. `[0.1, NaN]`)
  would contribute an x without a y, causing coordinate misalignment between the two arrays.
- **Fix:** Polyline points are now filtered as complete pairs:
  `validPairs = poly.points.filter((pt) => Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))`.
  Bounding boxes and `yNorm` are derived strictly from valid coordinate pairs. If a polyline contains
  no valid pairs, it is skipped.
- **Proof / Test:** Added unit tests in `frontend/tests/flow.a11yFeatures.share.test.ts`:
  - `filters polyline points as pairs so single non-finite coordinates do not misalign`: verifies
    corrupt pairs are omitted, valid pairs are preserved, and bounding box / yNorm are correct.
  - `drops polyline if no pairs have finite coordinates`: verifies complete skip when no pairs are finite.

### 4. LOW: Drop Unused Boolean Overload from SpeechDriver (`frontend/src/drivers/speech.ts`)
- **Problem:** `SpeechDriver.speak` and `WebSpeechDriver.speak` supported an unused `boolean` shorthand
  in `options?: boolean | SpeakOptions`. Callers exclusively use `{ queue?: boolean }`.
- **Fix:** Removed the `boolean` type and runtime branch from `speech.ts`, keeping only
  `options?: SpeakOptions`. Removed the obsolete boolean shorthand test from
  `frontend/tests/drivers.speech.test.ts`. Default behavior (`synth.cancel()` unless `queue: true`)
  remains intact.
- **Proof / Test:** `frontend/tests/drivers.speech.test.ts` retains the cancel-by-default and
  `{ queue: true }` tests.

## Deferred List
- EX-04 (Low): Explore canvas redraw on scene prop change (deferred in r7).
- EX-06 (Low): Window blur mid-drag recovery (deferred in r7).
- Explore.tsx silentMove helper extraction (noted as optional low-priority cleanup in review).
- CORE-A1 (Medium): Right-angle regex word boundary in `frontend/src/core/verify.ts` (fixed by Kiro in K4).
- CORE-A4 (Low): Bar speech value rounding in `frontend/src/core/hapticEngine.ts` (fixed by Kiro in K4).
- CORE-A5 (Low): `clamp01` handling in `frontend/src/core/correct.ts` (fixed by Kiro in K4).
- CORE-A6 (Low): Zero-scale viewport handling in `frontend/src/core/geometry.ts` / `hitTest.ts` (fixed by Kiro in K4).
- CORE-A7 (Low): Missing ID deletion idempotency in `frontend/src/core/correct.ts` (fixed by Kiro in K4).
- CORE-A8 (Low): Mixed scene bar fact verification in `frontend/src/core/verify.ts` (skipped by Kiro).
- CORE-A9 (Low): LoadModal localized titles (deferred in r7).

## Constraint & Compliance Checklist
- **Tuned haptic values:** No tuned vibration or tone constants changed.
- **Kiro ownership:** Zero files under `frontend/src/core/**`, `*.prop.test.ts`, `.kiro/**`,
  `backend/app/schema.py`, `validate.py`, or `scene.gen.ts` were touched.
- **Requirement 25:** Canvas sizing rules in `canvasSize.ts` were untouched.
- **Architecture:** Browser APIs isolated to `drivers/`.
- **Shell commands:** Zero shell commands executed during headless run.
- **Formatting:** All lines maintained within 100 columns and ruff-format style.

## Files Touched
- `frontend/src/flow/a11yFeatures.ts`
- `frontend/src/drivers/speech.ts`
- `frontend/tests/explore.askUnsupportedResetsGate.test.tsx`
- `frontend/tests/flow.a11yFeatures.share.test.ts`
- `frontend/tests/explore.talkback.test.tsx`
- `frontend/tests/drivers.speech.test.ts`
- `docs/reports/agy-r8-explore-fix-report.md`
- `docs/BUILD_LOG.md`
