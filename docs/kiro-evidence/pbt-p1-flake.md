# P1 flake: a property test found a flaw, and it is in the test generator, not in hitTest

Captured by Claude Code on 2026-11-01. **Nothing was edited**: the test (`frontend/tests/hitTest.prop.test.ts`, owned by Kiro) and `frontend/src/core/hitTest.ts` are unchanged. This is for Kiro to fix and for the Kiroween write-up (the plan asks for a real bug caught by a property test, reported honestly).

## What fails
Property **P1 "Every point is reachable"** (Requirements 4.3, 4.6): for any scene and any letterboxed viewport, `hitTest` at a point's exact screen position returns that point's vertex.

Failure rate: **6 of 30 isolated runs** of `npx vitest run tests/hitTest.prop.test.ts` (20%). In the full suite it failed in roughly 1 run in 4 to 7 across the session (about 3 of 15 early runs, 3 of 5 later). An independent reviewer ran 6 full suites and saw 0 failures, which fits a 20% rate.

## Captured failures (fast-check seed, path, minimal counterexample)
All six shrink to the same shape: **two points whose normalised coordinates differ by about 1e-45 (the smallest 32-bit float step), in a viewport about 1 px wide.**

| Run | Seed | Failed after | Minimal counterexample (`[scene, {w, h}]`) |
|---|---|---|---|
| 2 | `-732699702` | 23 tests, shrunk 58× | p0 `(0.9999992847442627, 0)`, p1 `(0.9999992847442627, 1.401298464324817e-45)`; `w=1, h=1.0000001192092896` |
| 10 | `326257879` | 134, shrunk 73× | p0 `(0, 3.08e-44)`, p1 `(1.401298464324817e-45, 3.08e-44)`; `w=1.0000001192092896, h=1` |
| 12 | `493083374` | 114, shrunk 60× | p0 `(1.54e-44, 0)`, p1 `(1.54e-44, 1.401298464324817e-45)`; `w=1, h=1.0000001192092896` |
| 13 | `-1373570835` | 169, shrunk 39× | p0 `(2.38e-44, 0)`, p1 `(2.38e-44, 1.401298464324817e-45)`; `w=1, h=1.0000001192092896` |
| 23 | `807260825` | 109, shrunk 82× | p0 `(1.401298464324817e-45, 0)`, p1 `(0, 0)`; `w=1.0000001192092896, h=1` |
| 27 | `-662044129` | 146, shrunk 59× | p0 `(1.40e-44, 0)`, p1 `(1.40e-44, 1.401298464324817e-45)`; `w=1, h=1.0000001192092896` |

Failure message (every time): `expected { kind: 'vertex', id: 'p0' } to deeply equal ObjectContaining{ kind: 'vertex', id: 'p1' }`: the second point is looked up at its own screen position and `hitTest` returns the first.

Full path for run 2, for exact replay with `fc.assert(..., { seed: -732699702, path })`:
```
seed: -732699702
path: "22:31:31:62:61:61:61:61:61:61:61:61:61:61:61:61:61:61:61:61:61:61:61:61:61:61:61:61:61:62:62:0:1:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0"
```
Other paths (same format): run 10 seed `326257879` path `"133:1:1:6:6:7:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:6:12:13:12:14:15:13:13:13:12:13:14:12:12:12:12:13:12:13:12:12:12:12:12:12:12:12:12:12:12:12:12:12:12:12:12:12:12:12:12:12"`; run 12 seed `493083374` path `"113:1:5:5:5:10:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:10:0:1:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0"`; run 13 seed `-1373570835` path `"168:7:6:6:12:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:12:12:0:1:0:0:0:0"`; run 27 seed `-662044129` path `"145:1:0:5:10:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:9:10:0:1:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0"`; run 23 seed `807260825` (long path in the raw run output).

## Replay without touching the suite
`cd frontend && npx vite-node ../docs/kiro-evidence/pbt-p1-replay.ts` prints, for the run-2 counterexample:
```
viewport {"canvasWidth":1,"canvasHeight":1.0000001192092896,"scale":1,"offsetX":0,"offsetY":5.960464477539063e-8}
screen positions [{"x":0.9999992847442627,"y":5.960464477539063e-8},{"x":0.9999992847442627,"y":5.960464477539063e-8}]
same pixel: true
hitTest at p0 -> {"kind":"vertex","id":"p0"}
hitTest at p1 -> {"kind":"vertex","id":"p0"}
```

## Diagnosis: test-generator bug, not a hitTest bug
- The two points are different in normalised space (`y = 0` vs `y = 1.4e-45`) but land on **exactly the same screen position**. The viewport is letterboxed with an offset of `5.96e-8`; adding that offset to a value of `1e-45` rounds the difference away in double precision, so `toScreen` returns identical coordinates.
- At identical screen positions, "return the vertex under the finger" has no single right answer: both points are at distance 0. `hitTest` keeps the first of equal-distance candidates (`dist < prev.dist`, strict), which is a sound, deterministic rule. A correct implementation cannot satisfy the property for the second point.
- The test's own comment says it avoids ties by making points unique in **normalised** space (`selector: ${x}|${y}`). Uniqueness before projection does not imply uniqueness after projection, so the property over-claims. That is the bug: the generator, not `hitTest`.
- Contributing: `fc.float` gives 32-bit values including denormals (1e-45), and the viewport range allows a 1 px canvas (real phones are 300+ px). Both make the collision likely; neither is the root cause.
- Checked: well-separated but close points (`1e-9` apart in a 1 px viewport) pass: `hitTest` returns `a` for `a` and `b` for `b`. So `hitTest` behaves correctly whenever the points are distinguishable on screen.

## Suggested fix (Kiro owns the test)
1. In the scene generator, require points to be **distinct after projection**: filter (or build with `fc.uniqueArray`) on the screen position computed by `toScreen`, or require a minimum separation in pixels (for example, at least 1 px, which is also what a real finger can resolve). Keep the normalised-uniqueness selector as well.
2. Optionally use realistic canvas sizes (for example 200 to 2000 px) and `fc.double`, but keep the separation filter: it is the actual fix.
3. State the property precisely in the comment: "when no other point shares its screen position, `hitTest` at a point returns that point".
4. Add a **fixed-seed regression example** from run 2 (`fc.assert(property, { examples: [[scene, dims]] })` with the counterexample above) so the case stays covered, and add a separate small unit test documenting the tie rule ("two points on one pixel: the first one wins").
5. Product side (optional, not a bug): `validate.py` could merge or reject points that coincide within about a pixel, since an LLM can output near-duplicate points; then no scene reaches `hitTest` with an unresolvable tie.

## For the write-up (honest framing)
- A property-based test **did** catch something real, but about its own assumption, not about product behaviour: the generator treated "distinct normalised points" as "distinct screen points". fast-check found and shrank it to a 1e-45 difference automatically; it took 6 of 30 runs to show up, which is also a lesson about running properties more than once and logging seeds.
- Do not present this as a defect in `hitTest`. No product code changed because of it.


## Outcome (2026-11-04)

### Generator fix and regression test
The root cause in the property test generator has been resolved in `frontend/tests/hitTest.prop.test.ts`:
- **Screen-space separation filter**: The generator now enforces a minimum screen separation `minSep = DEFAULT_RADII.vertex` (22 CSS px). Generated coordinates are projected through `toScreen({ x, y }, view)` and filtered so that every pair of points satisfies `Math.hypot(si.x - sj.x, si.y - sj.y) > minSep`. This prevents two points from sharing the same pixel or falling within each other's vertex hit radius, ensuring that every point is uniquely reachable at its own screen position.
- **Realistic viewport and double precision**: Viewport dimensions now generate realistic canvas sizes `fc.double({ min: 200, max: 2000, noNaN: true })`, and point coordinates use `fc.double({ min: 0, max: 1, noNaN: true })` instead of 32-bit `fc.float`, avoiding subnormal float precision collisions.
- **Tie-rule regression unit test**: A dedicated regression test block (`describe('P1 — Tie rule (regression from flake)')`) was added with `it('two points on the same pixel: the first one wins')`. It replays the exact minimal counterexample from run 2 (seed `-732699702`, viewport `1 × 1.0000001192092896`, `p0` at `(0.9999992847442627, 0)` and `p1` at `(0.9999992847442627, 1.401298464324817e-45)`). Both points project to the identical screen position, and `hitTest` deterministically returns `{ kind: 'vertex', id: 'p0' }`, codifying and asserting the first-candidate tie-breaking rule.

### Verification
- **Prior observation**: Claude Code observed 25 of 25 isolated passes of the P1 test file on 2026-11-03.
- **Three-run verification (2026-11-04 by Antigravity)**: The full frontend test suite (`npm --prefix frontend test`) was executed three consecutive times with all tests passing:
  - Run 1: 30 test files passed, 313 tests passed (duration 1.29 s; `tests/hitTest.prop.test.ts` passed 3 tests in 96 ms).
  - Run 2: 30 test files passed, 313 tests passed (duration 1.15 s; `tests/hitTest.prop.test.ts` passed 3 tests in 77 ms).
  - Run 3: 30 test files passed, 313 tests passed (duration 1.21 s; `tests/hitTest.prop.test.ts` passed 3 tests in 78 ms).
- **CI clean-up**: With 0 flakes observed across repeated runs, the single-retry workaround (`|| (echo ... && npm test)`) in `.github/workflows/ci.yml` has been removed.
