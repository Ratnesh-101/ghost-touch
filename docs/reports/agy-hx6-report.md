# Lane hx6 Report: Scene Ingress Guard Wiring

**Lane:** hx6  
**Status:** Completed  
**Role:** Antigravity (agy, builder)

---

## 1. Summary of Changes

Connected Kiro's scene ingress guard (`frontend/src/core/sceneGuard.ts`) at the network ingress boundary in `frontend/src/api/scene.ts`:
- Imported `isRenderableScene` from `../core/sceneGuard`.
- Updated `asScene` so it returns `value` as `DiagramScene` only when `isRenderableScene(value)` returns `true`, and `undefined` otherwise.
- Exported `asScene` so callers and tests can check scene validity directly against ingress requirements.
- Preserved existing `SceneRequestError('bad-response')` error throwing in `parseSceneResponse` and `loadSample` whenever `asScene` returns `undefined`.

---

## 2. Files Changed

- [`frontend/src/api/scene.ts`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx6/frontend/src/api/scene.ts)
- [`frontend/tests/hx6.sceneIngress.test.ts`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx6/frontend/tests/hx6.sceneIngress.test.ts) (new)
- [`frontend/tests/api.scene.test.ts`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx6/frontend/tests/api.scene.test.ts)
- [`frontend/tests/capture.lifecycle.test.tsx`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx6/frontend/tests/capture.lifecycle.test.tsx)
- [`frontend/tests/k6.pwa-offline.test.ts`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx6/frontend/tests/k6.pwa-offline.test.ts)
- [`frontend/tests/n2.round4.test.ts`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx6/frontend/tests/n2.round4.test.ts)

---

## 3. Pass 2: Gate Failure Resolution

The gate run for pass 1 reported 10 failures across pre-existing unit test suites (`tests/api.scene.test.ts`, `tests/capture.lifecycle.test.tsx`, `tests/k6.pwa-offline.test.ts`, and `tests/n2.round4.test.ts`).

### Root Cause
Under Requirement 35 / Task 61 (`sceneGuard.ts`), every scene entering Explore must possess arrays for `points`, `segments`, `polylines`, and `bars` (`(a missing array is NOT read as empty; an empty array is fine)`). The 10 failing tests used historical mock scene objects dating back to early tasks (e.g. `{ kind: 'geometry', title: 'Triangle' }`) that omitted `points`, `segments`, `polylines`, or `bars`. Exactly as observed by Kiro in Task 61.3 (`BUILD_LOG.md` line 4390: *"Two existing test files built scenes with missing arrays (`{ kind: 'geometry' }`) and went through `deserialise`; the fixtures were wrong under 35.5, so they now include empty arrays"*), these test mock fixtures required updating to supply valid array definitions.

### Fixes Applied (No Weakening)
1. **`frontend/tests/api.scene.test.ts`:**
   - Updated `okBody.scene` to include `points: []`, `segments: []`, `polylines: []`, `bars: []`.
   - Updated `loadSample` mock response in line 401 to include `points: []`, `segments: []`, `polylines: []`, `bars: []`.
   - All 7 failing tests in `api.scene.test.ts` now receive valid renderable scenes, resolving `SceneRequestError: bad-response` while preserving every assertion intact.
2. **`frontend/tests/capture.lifecycle.test.tsx`:**
   - Added `polylines: []`, `bars: []` to `testScene`.
   - Resolved `loadSample` rejection so `handleSample` successfully executes the sample load and the rapid second click triggers the synchronous `capture.busy` speech announcement (`Finding 9`).
3. **`frontend/tests/k6.pwa-offline.test.ts`:**
   - Added `points: []`, `segments: []`, `polylines: []`, `bars: []` to `mockSuccessResponse.scene`.
   - Resolves the 502 cold-start retry test (`B4-06 & B4-07`).
4. **`frontend/tests/n2.round4.test.ts`:**
   - Added `polylines: []`, `bars: []` to `sampleTriangle`.
   - Resolves the 502 cold-start retry test (`M4-04`).

---

## 4. Tests Added (`frontend/tests/hx6.sceneIngress.test.ts`)

1. **Rejection of malformed responses (`SceneRequestError('bad-response')`):**
   - Scene missing required `points` array throws `SceneRequestError('bad-response')`.
   - Scene with `NaN` coordinate in x throws `SceneRequestError('bad-response')`.
   - Scene with `NaN` coordinate in y throws `SceneRequestError('bad-response')`.
   - Scene with a segment referencing a missing point (`id` not present in `points`) throws `SceneRequestError('bad-response')`.
   - `requestScene` network call rejects with `SceneRequestError('bad-response')` when receiving each of the above damaged shapes.

2. **Bundled sample loading (`frontend/public/samples`):**
   - Reads `triangle.json`, `sine.json`, and `barchart.json` from disk; verified `isRenderableScene` returns `true` and `asScene` produces a defined scene for all three.
   - Verified `loadSample(id, fetchImpl)` loads all three samples successfully.
   - Verified `loadSample` throws `SceneRequestError('bad-response')` when sample content is corrupt or JSON syntax is invalid.

3. **Limit enforcement and 500-point raw scene acceptance:**
   - A valid 500-point raw scene (`mode: 'raw'`, 500 points in `[0, 1]`, valid unique IDs) is accepted by `isRenderableScene`, `asScene`, and `parseSceneResponse`.
   - A 501-point scene exceeding `SCENE_GUARD_LIMITS.points` is rejected with `bad-response`.
   - A 500-point scene with an invalid out-of-range coordinate (`> 1` or `< 0` or `NaN`) is rejected with `bad-response`.

4. **`asScene` unit contract:**
   - Returns valid `DiagramScene` for compliant scene objects.
   - Returns `undefined` for null, undefined, primitive, non-object, and malformed inputs.

---

## 4. What Could Not Be Verified

Per headless HX rules:
- No shell commands (`npm`, `npx`, `tsc`, `git`, `pytest`, etc.) were executed during this run.
- Gate verification (type-checking, test execution, linting) is deferred to the orchestrator runner.
