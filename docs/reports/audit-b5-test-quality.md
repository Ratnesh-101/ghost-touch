# Lane b5-test-quality Audit Report: Test Quality & Property Realness

**Auditor:** agy, reviewed by Claude  
**Scope:** Property tests (`frontend/tests/*.prop.test.ts`, `backend/tests/*_props.py`), unit tests, test runners, coverage, property numbering vs `design.md` (P1..P46).  
**Method:** Static code audit of all test generators, predicates, assertions, mock structures, and test runner configurations; runtime execution of `npm --prefix frontend test`, `npm --prefix frontend run build`, and `tsc --noEmit`.

---

## Executive Summary

The Ghost Touch property testing suite demonstrates substantial architectural rigor in fast-check state-machine testing (`correct.prop.test.ts`, `hapticEngine.prop.test.ts`, `savedDiagrams.prop.test.ts`). However, a deep audit of the test suite reveals critical vulnerabilities, test quality illusions, and significant specification drift:
1. **Active Test Failure on HEAD:** `frontend/tests/guide.geometry.prop.test.ts` actively fails in `npm --prefix frontend test` due to strict boundary floating-point precision in dead-zone calculation.
2. **Missing Properties (P40–P46):** Seven properties documented in `design.md` (P40–P46, Task 27) have zero test implementations anywhere in the codebase.
3. **Sham / Tautological Tests:** `backend/tests/test_hardening.py` contains a test titled `test_client_disconnect_returns_499` that never invokes an endpoint and only asserts that an `AsyncMock` returns what it was mocked to return.
4. **Pseudo-Property Tests / Static Linters:** P18, P19, and P20 in `frontend/tests/labTheme.prop.test.ts` wrap `fc.property` around tiny, static on-disk arrays (e.g. 4 hardcoded animation objects sampled 100 times).
5. **Re-implemented Logic in Tests:** P38 (`frontend/tests/explore.gesture.prop.test.ts`) re-implements the exact boolean clauses of `checkTwoFingerSwipeDown` in a test helper, verifying the function against a clone of itself.
6. **Mocked-Away Failure Modes:** `IDBDiagramStore` tests use an in-memory mock lacking IndexedDB transaction completion lifecycle hooks (`tx.oncomplete`, `tx.onabort`), masking transaction commit quota failures.
7. **Hypothesis Sample Size Violations:** Backend properties P21–P30 in `backend/tests/test_infra_props.py` run with `max_examples=100`, and `backend/tests/test_semantic_props.py` runs with `max_examples=50`, violating the >= 200 case invariant mandated by the design specification.

---

## Section 1 — Property Inventory & Numbering vs `design.md` (P1..P46)

| Property | Requirement | File | Status | Notes |
|---|---|---|---|---|
| P1 | 4.3, 4.6 | `frontend/tests/hitTest.prop.test.ts` | CONFIRMED | Pass. Generator restricted to points/segments; misses bar/polyline priorities. |
| P2 | 4.6 | `frontend/tests/hitTest.prop.test.ts` | CONFIRMED | Pass. Tests only segment vs vertex; does not test polyline/axis vs vertex. |
| P3 | 4.5, 4.2 | `frontend/tests/hapticEngine.prop.test.ts` | CONFIRMED | Pass. Sound independent quiet-until tracking. |
| P4 | 4.4 | `frontend/tests/hapticEngine.prop.test.ts` | CONFIRMED | Pass. Verifies exact single corner emission on repeated vertex moves. |
| P5 | 4.1 | `frontend/tests/hapticEngine.prop.test.ts` | CONFIRMED | Pass. Verifies continuous buzz intervals and quiet-window recovery. |
| P6 | 4.7 | `frontend/tests/hapticEngine.prop.test.ts` | CONFIRMED | Pass. Weak assertion: only checks `some()`, ignores state reset. |
| P7 | 5.1, 5.2 | `frontend/tests/pitch.prop.test.ts` | CONFIRMED | Pass. Tested on [0, 1]; does not check monotonicity outside [0, 1]. |
| P8 | 3.2 | `frontend/tests/geometry.prop.test.ts` | CONFIRMED | Pass. Coordinate round-trip within 1e-9. Uses 32-bit `fc.float`. |
| P9 | 3.2, 3.3, 3.5 | `backend/tests/test_validate_props.py` | CONFIRMED | Pass. Invariants hold across valid and garbage inputs. |
| P10 | 8.2 | `backend/tests/test_raw_mode_props.py` | CONFIRMED | Pass. Segment count <= 300, normalized coords. |
| P11 | 6.2 | `frontend/tests/pitch.prop.test.ts` | CONFIRMED | Pass. Tested; `pitchForValue` strict increasing test hardcodes `max = 100`. |
| P12 | 13.2 | `frontend/tests/explore.p12.test.ts` | **MISMATCH** | Pure integration test with `vi.fn()` mocks; 0 fast-check runs. Excluded by `npm run test:prop`. |
| P13 | 3.6 | `backend/tests/test_validate_props.py` | CONFIRMED | Pass, but generator only tests 1–3 uppercase letters on points, never segments/bars. |
| P14 | 11.1 | `frontend/tests/savedDiagrams.prop.test.ts` | CONFIRMED | Pass. Full serialise/deserialise round-trip across all 4 scene kinds. |
| P15 | 11.5, 11.6 | `frontend/tests/savedDiagrams.prop.test.ts` | CONFIRMED | Pass. Eviction invariants and pin protection verified. |
| P16 | 9.2, 9.3 | `frontend/tests/correct.prop.test.ts` | CONFIRMED | Pass. Sequential edit invariant preservation. |
| P17 | 9.2 | `frontend/tests/correct.prop.test.ts` | CONFIRMED | Pass. Undo/redo round-trip and history stack consistency. |
| P18 | 14.5 | `frontend/tests/labTheme.prop.test.ts` | **PSEUDO-PBT** | Static file regex check wrapped in `fc.property` over 4 hardcoded animation specs. |
| P19 | 14.1, 14.6 | `frontend/tests/labTheme.prop.test.ts` | **PSEUDO-PBT** | Static file linter wrapped in `fc.property` over directory file list. |
| P20 | 14.1, 14.6 | `frontend/tests/labTheme.prop.test.ts` | **PSEUDO-PBT** | Static file regex linter wrapped in `fc.property` over parsed CSS hex list. |
| P21–P24 | 15 | `backend/tests/test_infra_props.py` | **DEFICIENT** | Image sniffing properties. Configured with `max_examples=100` (spec mandates >= 200). |
| P25–P28 | 15 | `backend/tests/test_infra_props.py` | **DEFICIENT** | Scene cache properties. Configured with `max_examples=100` (spec mandates >= 200). |
| P29–P30 | 15 | `backend/tests/test_infra_props.py` | **DEFICIENT** | Rate limiter properties. `max_examples=100`; P29 is vacuous. |
| P31 | 9.2 | `frontend/tests/correct.prop.test.ts` | CONFIRMED | Pass. Total, local, and bounded edits with NaN/Infinity inputs. |
| P32 | 9.2, 9.3 | `frontend/tests/correct.prop.test.ts` | CONFIRMED | Pass. Invariant checker detects 14 injected defect categories. |
| P33 | 11.1, 11.3 | `frontend/tests/savedDiagrams.prop.test.ts` | CONFIRMED | Pass. Display order and spoken title rules. |
| P34 | 11.5, 11.6 | `frontend/tests/savedDiagrams.prop.test.ts` | CONFIRMED | Pass. In-place replacement on re-save. |
| P35 | 11.7 | `frontend/tests/savedDiagrams.prop.test.ts` | CONFIRMED | Pass. Resilient deserialisation on arbitrary and corrupted payloads. |
| P36 | 13.3 | `frontend/tests/explore.gesture.prop.test.ts` | CONFIRMED | Pass. Centre tick fires once per excursion and re-arms outside 1.5x radius. |
| P37 | 13.3, 4.5 | `frontend/tests/explore.gesture.prop.test.ts` | CONFIRMED | Pass. Centre tick never merges with corner buzz; single "Centre." speech. |
| P38 | 13.5, 13.6 | `frontend/tests/explore.gesture.prop.test.ts` | CONFIRMED | Pass, but re-implements function logic in test assertion predicate. |
| P39 | 9.3 | `backend/tests/test_validate_props.py` | CONFIRMED | Pass. Validator idempotence and fixed-point on accepted scenes. |
| P40 | 16.1 | `backend/tests/` | **MISSING** | Gap: Rate-limit identity spoof-resistance property not implemented (Task 27.1). |
| P41 | 16.2 | `backend/tests/` | **MISSING** | Gap: Rate-limit bounded memory property not implemented (Task 27.1). |
| P42 | 16.5 | `backend/tests/` | **MISSING** | Gap: Guards path-normalisation invariance property not implemented (Task 27.2). |
| P43 | 17.1 | `frontend/tests/` | **MISSING** | Gap: Back navigation totality and spoken destination property not implemented (Task 27.3). |
| P44 | 17.2 | `frontend/tests/` | **MISSING** | Gap: Announcement joining order without loss property not implemented (Task 27.4). |
| P45 | 16.10 | `backend/tests/` | **MISSING** | Gap: Facts answer length and sentence bounding property not implemented (Task 27.5). |
| P46 | 16.10 | `backend/tests/` | **MISSING** | Gap: "Don't know" punctuation invariance property not implemented (Task 27.5). |

### Unnumbered Property Tests
- `frontend/tests/guide.geometry.prop.test.ts` — 10 property tests for Guide geometry (includes 1 active failure).
- `frontend/tests/guide.machine.prop.test.ts` — 4 property tests for Guide state machine.
- `backend/tests/test_semantic_props.py` — 3 property tests for semantic peak/trough/bars (configured with `max_examples=50`).

---

## Section 2 — Five Concrete Deliberate Bugs That Existing Tests Miss

The audit brief requires identifying 5 properties and describing a concrete deliberate bug in the code that the existing property test would NOT catch:

### 1. Property P1 — Every point is reachable (`frontend/tests/hitTest.prop.test.ts`)
- **Deliberate Bug:** In `frontend/src/core/hitTest.ts`, reorder target priority so that bar interior hit testing executes *before* vertex hit testing:
  ```ts
  // In hitTest(): evaluate bars before vertices
  const barHit = hitTestBars(scene.bars, finger, view);
  if (barHit.kind === 'bar') return barHit;
  // then evaluate vertices...
  ```
- **Why P1 Misses It:** P1’s generator (`sceneArb`, lines 43–107) only generates scenes with points and segments: `const scene: DiagramScene = { kind: 'geometry', points, segments };`. It NEVER generates `bars`, `polylines`, or `axes`. If a vertex is placed inside a bar's bounding box and `hitTest` returns `{ kind: 'bar' }` instead of `{ kind: 'vertex' }` (violating Requirement 4.6), P1 remains 100% green.

### 2. Property P2 — Vertex beats line (`frontend/tests/hitTest.prop.test.ts`)
- **Deliberate Bug:** In `frontend/src/core/hitTest.ts`, check polyline hits or coordinate axis line hits *before* checking vertices:
  ```ts
  // In hitTest(): check polylines and axes before vertices
  for (const pl of scene.polylines ?? []) { ... return { kind: 'line', elementKind: 'polyline', id: pl.id }; }
  // then check vertices...
  ```
- **Why P2 Misses It:** P2’s generator (`scenarioArb`, lines 180–207) explicitly constructs a scene containing only a single segment between points P and Q: `segments: [{ id: 'PQ', a: 'P', b: 'Q' }]`. It never generates a polyline or an axis. If a finger is within 22px of a vertex on a function curve or axis crossing, returning `line` instead of `vertex` violates Requirement 4.6, but P2 will never detect it.

### 3. Property P6 — Lift silences everything (`frontend/tests/hapticEngine.prop.test.ts`)
- **Deliberate Bug:** In `frontend/src/core/hapticEngine.ts`, when handling `{ kind: 'lift' }`, corrupt the engine state by setting `quietUntil = Infinity` and append a rogue speech effect:
  ```ts
  if (input.kind === 'lift') {
    return {
      state: { ...initialState(), quietUntil: Number.POSITIVE_INFINITY },
      effects: [{ kind: 'vibrate', pattern: 0 }, { kind: 'tone', hz: null }, { kind: 'speak', text: 'Touch ended' }],
    };
  }
  ```
- **Why P6 Misses It:** The test predicate in `P6` (lines 342–347) only checks:
  ```ts
  effects.some((e) => e.kind === 'vibrate' && e.pattern === 0) &&
  effects.some((e) => e.kind === 'tone' && e.hz === null)
  ```
  The test completely ignores `next.state` (never checks that `quietUntil` or `lastBuzz` was reset) and ignores other effects in `effects`. Subsequent touches would be permanently silenced by the infinite quiet window, yet P6 passes.

### 4. Property P7 / P11 — Bar pitch order / pitchForValue (`frontend/tests/pitch.prop.test.ts`)
- **Deliberate Bug:** In `frontend/src/core/pitch.ts`, completely ignore the `max` parameter in `pitchForValue`:
  ```ts
  export function pitchForValue(v: number, _max: number): number {
    // Deliberate bug: hardcode normalization assuming max is always 100
    const ratio = Math.max(0, Math.min(1, v / 100));
    return Math.round(200 + ratio * 800);
  }
  ```
- **Why P7/P11 Misses It:** 
  In P11 (lines 90–105), the monotonicity test compares `pitchForValue(v1, max)` and `pitchForValue(v2, max)` using the *same* `max` for both calls; if `v1 > v2`, `(v1 / 100) >= (v2 / 100)` remains true. Furthermore, the strict increasing test (lines 107–121) hardcodes `max = 100`:
  `return pitchForValue(v2, 100) > pitchForValue(v1, 100);`.
  If a chart has `max = 5000` or `max = 5`, `pitchForValue` behaves completely erroneously, yet P7 and P11 remain 100% green.

### 5. Property P13 — Validator rejects colour- or shape-only labels (`backend/tests/test_validate_props.py`)
- **Deliberate Bug:** In `backend/app/validate.py`, omit checking colour/shape words on segments, polylines, and bars, validating points only:
  ```ts
  # In validate_scene(): check point.label only; ignore seg.label, poly.label, bar.label
  ```
- **Why P13 Misses It:** Both `test_p13_rejects_colour_shape_only_labels` (lines 202–216) and `test_p13_accepts_non_colour_shape_labels` (lines 218–234) only construct test scenes containing points:
  `data = {"kind": "geometry", "points": [{"id": "A", "x": 0.5, "y": 0.5, "label": label}]}`.
  Neither test ever generates a segment, polyline, or bar with a label. If a vision model returns a scene with `segment.label = "blue line"` or `bar.label = "red bar"`, Requirement 3.6 is violated, but P13 passes.

---

## Section 3 — Detailed Audit Findings

### CONFIRMED FINDINGS

#### TQ-01 · high · `frontend/tests/guide.geometry.prop.test.ts:122-135` · Floating-point boundary flakiness causes reproducible failure in directionHint dead-zone test
- **What is wrong:** Running `npm --prefix frontend test` immediately fails on `tests/guide.geometry.prop.test.ts > Guide Geometry Properties (>= 200 runs) > directionHint: within dead-zone always returns here`.
- **Concrete failure scenario:** Fast-check generates radius `r = 0.05` and `theta = -0.00015687218779903724`. Computing `dx = r * Math.cos(theta)` and `dy = r * Math.sin(theta)` yields floating-point inaccuracy where `Math.hypot(dx, dy)` evaluates to `0.05000000000000001 > 0.05`. Because `directionHint` checks `if (dist <= deadZone)` without tolerance, it classifies the point as outside the dead-zone and returns `'right'` instead of `'here'`.
- **Proposed minimal fix:** In `frontend/src/guide/geometry.ts:346`, add floating-point epsilon matching `hasArrived`:
  ```ts
  const dist = Math.hypot(dx, dy);
  if (dist <= deadZone + 1e-9) {
    return 'here';
  }
  ```
- **Proposed test:**
  ```ts
  it('directionHint returns here at exact deadZone boundary', () => {
    expect(directionHint(0.05, 0.0, 0.05)).toBe('here');
    expect(directionHint(0.05 * Math.cos(0.001), 0.05 * Math.sin(0.001), 0.05)).toBe('here');
  });
  ```

#### TQ-02 · high · `backend/tests/test_hardening.py:409-424` · Sham / tautological test asserting mock identity rather than route disconnect behaviour
- **What is wrong:** `test_client_disconnect_returns_499` claims in its docstring: "Simulated disconnected request returns HTTP 499 before heavy processing." In reality, it instantiates a dummy ASGI `Request`, replaces `is_disconnected` with an `AsyncMock(return_value=True)`, and asserts `assert await mock_request.is_disconnected() is True`. It never invokes `client.post()`, never calls `app.main`, and never validates HTTP 499.
- **Concrete failure scenario:** Delete the entire client-disconnect handling logic in `backend/app/main.py`. This test remains 100% green because it tests nothing but `unittest.mock.AsyncMock`.
- **Proposed minimal fix:** Remove the sham test or replace it with a real invocation of the route with a disconnected request transport (as done in `test_fix_ask_regression.py:310`).
- **Proposed test:**
  ```python
  def test_scene_route_disconnect_returns_499():
      client = TestClient(app)
      with unittest.mock.patch("fastapi.Request.is_disconnected", new_callable=AsyncMock) as mock_disc:
          mock_disc.return_value = True
          resp = client.post("/api/v1/scene", files={"image": ("a.png", b"fake", "image/png")})
          assert resp.status_code == 499
  ```

#### TQ-03 · high · `design.md:177-183` vs `backend/tests/` & `frontend/tests/` · Numbering gap: Properties P40 through P46 are completely missing from the test suite
- **What is wrong:** `design.md` explicitly specifies properties P40 to P46 as part of the core contract (Round 2 Security and Robustness). Task 27 in `tasks.md` was never implemented. No test files exist for P40 (rate-limit identity resists spoofing), P41 (rate-limit state bounded), P42 (guards path normalisation invariant), P43 (back navigation total and spoken), P44 (announcements join without loss), P45 (fact answers bounded), or P46 ("don't know" punctuation invariance).
- **Concrete failure scenario:** A regression in `limits.py` path normalisation or `client_key` proxy calculation cannot be caught by any property test suite because no property tests were ever written.
- **Proposed minimal fix:** Implement property tests for P40–P42 in `backend/tests/test_round2_props.py` and P43–P44 in `frontend/tests/flow.prop.test.ts`.
- **Proposed test:** Implement the 7 property tests defined in Task 27.1–27.5.

#### TQ-04 · med · `backend/tests/test_infra_props.py:36,52,73,104,157,178,207,247,286,303` · Backend property tests violate the >= 200 case rule with max_examples=100
- **What is wrong:** Properties P21 through P30 all specify `@settings(max_examples=100)`. Both `design.md` (§Testing Strategy) and the project rules require: "Each property maps to requirements and runs with fast-check (frontend) or Hypothesis (backend), ≥200 cases."
- **Concrete failure scenario:** Rare edge cases in EXIF header permutations (P24) or rate limit window boundaries (P30) have 50% less coverage than required by the project testing specification.
- **Proposed minimal fix:** Update `@settings(max_examples=200)` across all properties in `test_infra_props.py` (and `test_semantic_props.py` which currently uses 50).
- **Proposed test:** Assert that all Hypothesis tests in `backend/tests/*_props.py` declare `max_examples >= 200`.

#### TQ-05 · med · `frontend/tests/explore.gesture.prop.test.ts:240-254` · Property P38 re-implements function under test in test assertion
- **What is wrong:** In `P38`, `checkTwoFingerSwipeDown` is tested by replicating its exact implementation inside the test file:
  ```ts
  const ok = (f: { dx: number; dy: number; dt: number }): boolean =>
    f.dy >= 80 && f.dt <= 600 && Math.abs(f.dx) <= f.dy * 0.5;
  expect(fires).toBe(ok(a) && ok(b));
  ```
  This is a tautological re-implementation test. Furthermore, the test hardcodes start positions `(100, 100)` and `(200, 100)` and start timestamps `t = 1000` for both fingers, never testing staggered start times or inverted horizontal finger order.
- **Concrete failure scenario:** If the requirements for swipe distance or drift ratio change in `design.md` (e.g. minDistance 100px), a bug in `checkTwoFingerSwipeDown` that matched the test's `ok()` helper would pass unnoticed.
- **Proposed minimal fix:** Test invariants independently of the implementation: test downward monotonicity, invariant to uniform spatial translation, and rejection of upward/horizontal motion.
- **Proposed test:**
  ```ts
  it('P38: exit swipe is invariant under uniform screen translation', () => {
    fc.assert(fc.property(validSwipeArb, fc.integer(-500, 500), fc.integer(-500, 500), (swipe, tx, ty) => {
      expect(checkTwoFingerSwipeDown(translate(swipe.p1, tx, ty), translate(swipe.p2, tx, ty))).toBe(true);
    }));
  });
  ```

#### TQ-06 · med · `frontend/tests/drivers.diagramStore.test.ts:191-250` · Mocked-away logic hides transaction lifecycle and quota commit failures
- **What is wrong:** `IDBDiagramStore` tests use `createFakeIdb()`, which implements a synchronous in-memory store. The fake `transaction()` object has no `oncomplete` or `onabort` event handlers. IndexedDB quota errors and storage commit errors occur on `tx.oncomplete` / `tx.onabort`, not when the individual request succeeds.
- **Concrete failure scenario:** A device with full storage reports success on `store.put()`, but fails when committing the transaction. The app speaks "Saved" while the diagram was dropped. The unit tests cannot catch this because `createFakeIdb` mocks away the entire transaction lifecycle.
- **Proposed minimal fix:** Implement `tx.oncomplete` and `tx.onabort` in the test harness mock, and test error rejection when `tx.onabort` fires.
- **Proposed test:**
  ```ts
  it('IDBDiagramStore returns ok: false when transaction aborts with QuotaExceededError', async () => {
    const quotaAbortFactory = createAbortingIdbFactory('QuotaExceededError');
    const store = new IDBDiagramStore(quotaAbortFactory);
    const res = await store.put(sample);
    expect(res.ok).toBe(false);
  });
  ```

#### TQ-07 · med · `frontend/tests/labTheme.prop.test.ts:254,303,427` · Pseudo-property tests wrapping fast-check around static finite files
- **What is wrong:** P18, P19, and P20 are presented as property-based tests, but they are static linters wrapped in `fc.property`. In P18, `fc.constantFrom(...aliveAnimations)` picks from 4 static targets 100 times. In P19, `fc.constantFrom(...cssFileNames)` picks from on-disk CSS files. In P20, `fc.constantFrom(...allOccurrences)` picks from extracted hex regex matches.
- **Concrete failure scenario:** If a developer adds a new CSS animation with a dangerous 15 Hz strobe to `explore.css`, P18 will not fail because `aliveAnimations` targets are hardcoded to 4 names (`gt-spark-arc-play`, `gt-spark-glow-play`, `gt-alive-border-pulse`, `gt-alive-hud-pulse`).
- **Proposed minimal fix:** Dynamically discover all `@keyframes` in all stylesheets in `src/styles/*.css` rather than hardcoding targets.
- **Proposed test:**
  ```ts
  const allKeyframes = extractAllKeyframes(stylesDir);
  fc.assert(fc.property(fc.constantFrom(...allKeyframes), (kf) => ...));
  ```

#### TQ-08 · low · `backend/tests/test_infra_props.py:286-301` · Property P29 rate-limiter fresh key test is vacuous
- **What is wrong:** `test_p29_limits_fresh_key_always_allowed` calls `reset_rate_limits()` at every iteration and makes exactly one call to `middleware._allow(client_id, path, per_minute)`. It tests an empty dictionary lookup against an AsyncMock app. It never tests multiple keys, concurrent clients, or non-empty tables.
- **Concrete failure scenario:** A bug where the rate limiter rejects fresh keys if another client is currently throttled would never be caught.
- **Proposed minimal fix:** Test fresh key allowance in the presence of arbitrary existing active and throttled client keys.
- **Proposed test:**
  ```python
  @given(st.lists(st.text(min_size=1, max_size=10)), st.text(min_size=11, max_size=20))
  def test_p29_fresh_key_allowed_with_active_clients(existing_clients, fresh_client):
      for c in existing_clients: middleware._allow(c, "/api/v1/scene", 5)
      assert middleware._allow(fresh_client, "/api/v1/scene", 5) is True
  ```

#### TQ-09 · low · `frontend/tests/geometry.prop.test.ts:17-23` · Use of 32-bit fc.float instead of fc.double in P8
- **What is wrong:** P8 uses `fc.float({ min: 0, max: 1, noNaN: true })`. `fc.float` produces 32-bit single-precision floats, whereas JavaScript numbers and coordinates in `toScreen`/`toNorm` are 64-bit IEEE 754 doubles. (Tracked in `tasks.md` Task 20.9).
- **Concrete failure scenario:** Sub-pixel precision round-trip drift on 64-bit coordinate spaces is untested.
- **Proposed minimal fix:** Replace `fc.float` with `fc.double`.
- **Proposed test:** Update `geometry.prop.test.ts` to `fc.double`.

#### TQ-10 · low · `package.json:13` · test:prop runner excludes P12 integration test
- **What is wrong:** `package.json` defines `"test:prop": "vitest run .prop.test"`. The file `frontend/tests/explore.p12.test.ts` is omitted because it lacks `.prop.test` in its filename, despite being specified as Property 12 in `design.md`.
- **Concrete failure scenario:** Running the property test suite (`npm run test:prop`) skips P12 entirely.
- **Proposed minimal fix:** Either rename `explore.p12.test.ts` to `explore.p12.prop.test.ts` (if property-based) or update `design.md` to classify P12 as an integration test.

---

### SUSPECTED FINDINGS

#### TQ-11 · med · `frontend/tests/guide.geometry.prop.test.ts:165-177` · Dormant flakiness in hasArrived property test
- **What is wrong:** In `guide.geometry.prop.test.ts`:
  ```ts
  expect(arrived).toBe(dist <= radius);
  ```
  However, `hasArrived` in `frontend/src/guide/geometry.ts:387` returns:
  ```ts
  return dist <= radius + 1e-9;
  ```
  If fast-check generates `dist` such that `radius < dist <= radius + 1e-9`, `hasArrived` returns `true` while the test expectation evaluates `dist <= radius` as `false`, causing a sudden flake.
- **Proposed minimal fix:** Align the test predicate with the epsilon: `expect(arrived).toBe(dist <= radius + 1e-9);`.

---

## Section 4 — Top Ten Code Paths With No Tests by Risk

1. **`frontend/src/drivers/diagramStore.ts` (IDBDiagramStore transaction failure & abort handling):**
   *Risk:* Quota errors and aborts surface on transaction commit, not request success. Handled by return values in code, but tested only against a synchronous in-memory fake without transaction lifecycle.
2. **`frontend/src/App.tsx:319-322` (`saveDiagram` eviction failure path):**
   *Risk:* The eviction logic deletes the oldest diagram *before* writing the new entry. If `diagramStore.put` fails, an existing diagram is permanently destroyed with no replacement. Zero tests exercise this branch.
3. **`frontend/src/screens/Explore.tsx` (Pointer capture rejection):**
   *Risk:* `setPointerCapture` throwing a `DOMException` on mobile browsers or during rapid multi-touch drag transitions.
4. **`frontend/src/screens/SavedDiagrams.tsx` (Async load race on unmount):**
   *Risk:* Component unmounting while `diagramStore.list()` is pending; state setting or speech on unmounted component.
5. **`frontend/src/core/hitTest.ts` (Non-finite coordinate inputs - NEEDS-KIRO-01):**
   *Risk:* Passing `NaN`, `Infinity`, or `-Infinity` into `hitTest` can cause `Math.hypot` to propagate `NaN` into comparisons.
6. **`frontend/src/screens/Correct.tsx` (Unsaved Teacher edits dirty state navigation):**
   *Risk:* Navigating away via system Back without a confirmation dialog discards complex manual teacher repairs (Requirement 17.1).
7. **`frontend/src/drivers/pdf.ts` (Worker loading and corrupted PDF canvas fallback):**
   *Risk:* `pdfjs-dist` worker failure or canvas drawing context allocation exhaustion on memory-constrained devices.
8. **`backend/app/main.py` & `limits.py` (Streamed overflow without Content-Length - A6-15):**
   *Risk:* Streaming request bodies exceeding byte limit without `Content-Length` header mid-stream on ASGI connection.
9. **`backend/app/raw_mode.py` (Malformed WebP extended RIFF chunk walk):**
   *Risk:* Non-standard WebP files with unusual chunk layouts causing dimension sniffing failures.
10. **`frontend/src/drivers/speech.ts` (Missing voice fallback on Android):**
    *Risk:* When Android lacks Hindi (`hi-IN`) or Gujarati (`gu-IN`) TTS voice data, speech fails silently without fallback to English or text.

---

## Section 5 — Requirements With No Tests

- **Requirement 11.3 (Voice control of Saved Diagrams):** "let the user open or delete any entry by touch or by voice" — Voice command parsing and execution for saved diagrams has no tests and is not implemented in `flow/commands.ts`.
- **Requirement 16.12 (Hit test non-finite distance):** "THE hit test SHALL treat a non-finite distance as a miss." — No test exists in `hitTest.prop.test.ts`.
- **Requirement 17.1 (Back navigation destination announcement & dirty confirmation):** Spoken destination prompts across `#/teach` and `#/share` and unsaved changes confirmation have no tests.
- **Requirement 17.2 (Announcement order and integrity):** Single pointer move joining axis crossings and vertex announcements without speech truncation has no tests.
- **Requirement 17.3 (Unmount safety during async operations):** No tests verifying unmount safety in `SavedDiagrams.tsx`.
- **Requirement 7.4 (Text input fallback):** Text input fallback when speech recognition is unavailable has no end-to-end integration test.
- **Requirement 9.2 (Deleting polylines and bars in Teacher mode):** Only points and segments can be deleted; deleting polylines/bars is untested and unimplemented.

---

## Section 6 — Sound Areas

The following test suites were thoroughly reviewed and found sound, robust, and meaningful:
- `frontend/tests/correct.prop.test.ts`: Outstanding coverage of invariant validation (P32 injected violations), immutability, undo/redo round-trips (P17), and total edit bounds with `NaN`/`Infinity` (P31).
- `frontend/tests/savedDiagrams.prop.test.ts`: Strong property testing for eviction order, pin protection (P15), serialization round-trip (P14), display order (P33), and corrupt JSON resilience (P35).
- `frontend/tests/explore.gesture.prop.test.ts`: Comprehensive state-machine testing for centre tick excursion re-arming (P36) and corner quiet-window mutual exclusion (P37).
- `backend/tests/test_validate_props.py`: P9 and P39 provide excellent validation fixed-point guarantees.

---

## Top 5 to Fix First

1. **Fix active test failure TQ-01 in `frontend/src/guide/geometry.ts:346`:** Add `+ 1e-9` epsilon to `directionHint` deadZone comparison to restore green test suite.
2. **Implement missing Round 2 property tests TQ-03 (P40–P46, Task 27):** Complete the missing properties in `backend/tests/test_round2_props.py` and `frontend/tests/flow.prop.test.ts`.
3. **Replace sham test TQ-02 in `backend/tests/test_hardening.py`:** Delete or properly implement `test_client_disconnect_returns_499` to actually test the endpoint.
4. **Implement realistic IndexedDB transaction lifecycle mock TQ-06:** Test `IDBDiagramStore` error paths when `tx.onabort` fires on storage quota exhaustion.
5. **Raise Hypothesis property test sample sizes TQ-04:** Increase `max_examples` to at least 200 in `backend/tests/test_infra_props.py` and `backend/tests/test_semantic_props.py`.

> **Supervisor note (2026-11-08):** this lane was checked out BEFORE commits 1ca4cdb..9b60d21. Its finding TQ-03 (missing P40-P46 backend properties) is STALE: they now exist in backend/tests/test_round2_props.py. TQ-01 (a failing test in guide/geometry.ts) is NOT REPRODUCED on main (frontend suite green: 1585 tests). Treat the other findings as unverified.
