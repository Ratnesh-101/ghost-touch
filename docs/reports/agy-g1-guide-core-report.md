# Lane g1-guide-core Report

**Tool:** agy, reviewed by Claude  
**Lane:** g1-guide-core (Guide Core Module)  
**Status:** Complete & Verified  

---

## 1. Summary of Built Components

Implemented the pure "Guide my finger" core module in `frontend/src/guide/` exactly matching the contract defined in `docs/briefs/guide-share-contract.md` and requirements in `docs/briefs/agy-g1-guide-core.md`:

1. **`frontend/src/guide/config.ts`**:
   - `GuideConfig` interface: `farMs`, `nearMs`, `arriveRadius`, `hintEveryMs`, `timeoutMs`, `pitchLoHz`, `pitchHiHz`.
   - `DEFAULT_GUIDE`: Own constants (`farMs: 600`, `nearMs: 120`, `arriveRadius: 0.05`, `hintEveryMs: 2500`, `timeoutMs: 20000`, `pitchLoHz: 200`, `pitchHiHz: 800`). Untouched core haptics.

2. **`frontend/src/guide/geometry.ts`**:
   - `NormPoint`, `GuideTarget`, `ResolvedTarget`, `HintKey` types.
   - `resolveTarget(scene, target)`:
     - Unknown element id => `null`
     - Point => normalized coordinates and label (or id fallback)
     - Segment => midpoint between endpoints `a` and `b` (rejects missing endpoints or out-of-range endpoints)
     - Polyline => point from `points` nearest to the polyline's centroid
     - Bar => geometric centre `((x0 + x1)/2, (y_base + y_top)/2)`
     - Out-of-range coordinates outside `[0, 1]` => `null`
   - `vectorTo(finger, target)`: returns `{ dx, dy, dist }` in normalized scene coordinates.
   - `pulseIntervalMs(dist, cfg)`: monotone non-decreasing in `dist`, strictly clamped within `[nearMs, farMs]`.
   - `pitchFor(dy, cfg)`: vertical relative distance (`y=0` is top of screen; target above finger `dy < 0` produces pitch >= target below `dy > 0`), clamped within `[pitchLoHz, pitchHiHz]`.
   - `panFor(dx)`: stereo pan strictly in `[-1, 1]` whose sign matches `dx` (target left => negative).
   - `directionHint(dx, dy, deadZone)`: distance <= dead-zone returns `'here'`, otherwise returns one of the 8 compass directions (`'up'`, `'down'`, `'left'`, `'right'`, `'up-left'`, `'up-right'`, `'down-left'`, `'down-right'`).
   - `hasArrived(dist, cfg)`: returns `true` when `dist <= arriveRadius`.

3. **`frontend/src/guide/machine.ts`**:
   - `GuideState`, `GuideInput`, `GuideEffect` types and `initialGuideState()`.
   - `guideStep(state, input, cfg)`:
     - Spoken direction hint emitted immediately on direction change, or throttled to not more often than `hintEveryMs` otherwise.
     - Pulses throttled by `pulseIntervalMs`.
     - `tick` at or after `timeoutMs` => emits `toneOff` + `stopped` effect + speaks `guide.stopped`, transitions phase to `'stopped'`.
     - `cancel` with reason (`'voice'`, `'back'`, `'timeout'`, `'user'`) => emits `toneOff` + `stopped` effect + speaks `guide.stopped`, transitions phase to `'stopped'`.
     - `lift` => emits `toneOff`, phase remains `'guiding'`.
     - `move` within arrival radius => emits `toneOff` + `arrive` effect (with target label) + speaks `guide.arrived`, transitions phase to `'arrived'`.
     - `arrive` effect is emitted exactly once; once in terminal phase (`'arrived'` or `'stopped'`), all subsequent moves/lifts/cancels/ticks produce zero effects.

4. **`frontend/src/guide/index.ts`**:
   - Clean public re-export surface for all types, constants, and functions.

5. **Pure Architecture & Zero Driver/DOM Imports**:
   - Strictly pure TypeScript: does not import React, `window`, `navigator`, `document`, or any drivers. Verified by automated source inspection tests.

---

## 2. Emitted i18n Keys

These keys are emitted in plain data effects (`{ type: 'speak', key: ... }`) by the guide core:
- `guide.hint.left`
- `guide.hint.right`
- `guide.hint.up`
- `guide.hint.down`
- `guide.hint.up-left`
- `guide.hint.up-right`
- `guide.hint.down-left`
- `guide.hint.down-right`
- `guide.hint.here`
- `guide.arrived`
- `guide.stopped`
- `guide.start`

---

## 3. Files Created / Touched

- `frontend/src/guide/config.ts` (created)
- `frontend/src/guide/geometry.ts` (created)
- `frontend/src/guide/machine.ts` (created)
- `frontend/src/guide/index.ts` (created)
- `frontend/tests/guide.geometry.prop.test.ts` (created)
- `frontend/tests/guide.machine.prop.test.ts` (created)
- `frontend/tests/guide.unit.test.ts` (created)
- `docs/reports/agy-g1-guide-core-report.md` (created)
- `docs/BUILD_LOG.md` (updated)

No forbidden files were touched (0 edits to `frontend/src/core/**`, `.kiro/**`, `.env*`, etc.).

---

## 4. Acceptance Tests Proof (Vitest + fast-check, >= 200 runs)

### Property Tests:
1. `pulseIntervalMs monotone non-decreasing in dist, always within [nearMs, farMs]`:
   - Monotonicity verified across arbitrary non-negative distances (200 runs).
   - Bounds verified across arbitrary positive, zero, negative, and extreme inputs in `[-1000, 1000]` (200 runs).
   - Bounds verified across arbitrary generated `GuideConfig` instances (200 runs).
2. `pitchFor: target above gives pitch >= target below; always within [pitchLoHz, pitchHiHz]`:
   - Verified that `dy1 <= dy2 => pitchFor(dy1) >= pitchFor(dy2)` for arbitrary normalized coordinate pairs (200 runs).
   - Verified bounds `[pitchLoHz, pitchHiHz]` across arbitrary inputs `[-1000, 1000]` (200 runs).
3. `panFor within [-1, 1], sign matches dx`:
   - Verified bounds in `[-1, 1]` and strict sign agreement with `dx` for arbitrary inputs (200 runs).
4. `directionHint: dead-zone => 'here'; the 8 compass cases; y=0 is top`:
   - Verified that all points inside dead-zone radius return `'here'` (200 runs).
   - Verified all 8 compass directions across arbitrary radial distances outside dead-zone (200 runs per direction = 1600 runs total).
5. `resolveTarget`:
   - Verified point target, segment midpoint, polyline nearest-to-centroid, and bar centre.
   - Verified out-of-range coordinates (< 0 or > 1 or NaN) return `null`.
   - Verified missing endpoints and unknown IDs return `null`.
6. `guideStep`:
   - Hint spoken on direction change immediately, and not more often than `hintEveryMs` otherwise (200 runs).
   - `arrive` emitted exactly once upon entering arrival radius (200 runs).
   - `tick` after `timeoutMs` => emits `toneOff`, `stopped`, and speaks `guide.stopped` (200 runs).
   - `cancel` for each reason (`'voice'`, `'back'`, `'timeout'`, `'user'`) => emits `toneOff`, `stopped`, and speaks `guide.stopped` (200 runs).
   - `lift` => emits `toneOff`, phase stays `'guiding'` (200 runs).
   - No effects emitted after `'stopped'` or `'arrived'` (200 runs).
   - Scripted trace test: finger starts far, walks toward target through 5 waypoints, pulse interval strictly shrinks monotonically, continuous tone updates, and arrival effect is emitted upon landing inside `arriveRadius`.
   - Module purity test: asserts no imports of React, `window`, `navigator`, `document`, or drivers in any guide file.

---

## 5. Verification Commands Output

### Frontend Vitest Suite:
```
$ npm --prefix frontend test

> ghost-touch-frontend@0.1.0 test
> vitest run

 RUN  v5.1.0 C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-g1-guide-core/frontend

 Test Files  85 passed (85)
      Tests  1229 passed (1229)
   Start at  14:58:52
   Duration  1.27s (transform 55%, import 24%, tests 16%, worker 5%)
```
*(All 85 test files and 1229 tests passed, including all 26 new guide tests and property tests).*

### Backend Pytest Suite:
```
$ backend/.venv/Scripts/python -m pytest backend
421 passed, 1 skipped, 1 warning in 35.85s
```

### Backend Ruff Checks:
```
$ backend/.venv/Scripts/python -m ruff check backend
All checks passed!

$ backend/.venv/Scripts/python -m ruff format --check backend
58 files already formatted
```

---

## 6. Findings / Note for Planner & Reviewer

1. **Pre-existing `@ts-expect-error` in 31 unrelated frontend test files:**
   When running `npm --prefix frontend exec -- tsc -p frontend --noEmit` or `npm --prefix frontend run build`, TypeScript emits error `TS2578: Unused '@ts-expect-error' directive` on 31 pre-existing test files in `frontend/tests/` (e.g. `AccessibleButton.test.tsx`, `a11y.contrast.test.ts`, etc.).
   - **Root cause:** Those files contain `// @ts-expect-error Node.js runtime fs module in Vitest node environment` before `import fs from 'node:fs'`. In the current environment, `@types/node` is present under `frontend/node_modules/@types/node` (pulled by Vite/Vitest dependencies), so `import fs from 'node:fs'` is valid and generates no TypeScript error; hence TypeScript flags the `@ts-expect-error` comments as unused directives.
   - **Isolation:** All newly built guide files (`frontend/src/guide/**`) and new test files (`frontend/tests/guide.*`) have **0 TypeScript errors** and 0 unused directives.
   - **Action taken:** Per strict lane boundary rules ("Edit only the files your task names"), agy did not touch any of those 31 pre-existing test files. They can be cleaned up in a dedicated housekeeping pass by the reviewer or owner.
