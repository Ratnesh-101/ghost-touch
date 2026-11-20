# Independent diagnosis: T58 sticky.ts and P117

Reviewer: Kiro. Read-only. No source or test was edited.

**Verdict: TEST BUG.** No product bug found in `followTarget`.

## What fails

"expected 19 to be greater than 20" and "expected 14 to be greater than 20" are not property counterexamples. They come from the coverage guards that run after `fc.assert` returns:

- `frontend/tests/sticky.prop.test.ts:~207` `expect(seen.stuck).toBeGreaterThan(20)` (P117, 400 runs)
- `:~208` `expect(seen.released).toBeGreaterThan(20)`
- `:~164` `expect(lines).toBeGreaterThan(20)` (P116, 250 runs)

Every one of the 400 property runs passed. The numbers differ per run because fast-check is unseeded.

## Why the count is low (worked estimate)

A "stuck" sample needs all of these:

1. The finger lies in the band `radii.line < d <= s`. `aim()` draws the offset `r` uniformly in [0, 50) px, and `s = radii.line + extra`, where `extra` comes from `fc.double({min: 0.5, max: 40})`. That distribution is biased toward small values, so the band is usually a few px wide. P(in band) is about 5 to 20%.
2. `hitTest` returns none or bar. The scene always has 2 segments, 1 to 2 polylines, 2 axes and 1 to 2 bars, all random over the unit square. That is dense, so another line is often within `radii.line` of the finger. P(no other line) is roughly 30 to 50%.
3. The tie-guard `|d - s| > 1e-6` (negligible).

Combined, that is about 2 to 5% of 400 runs, or 8 to 20 hits. A threshold of 20 therefore fails at random. It is a flaky coverage guard, not a logic failure.

## Product review of `core/sticky.ts` (no defects)

- **Held vs nearest.** `base` is computed first. A vertex or line from `hitTest` returns immediately (`sticky.ts:75`), so nearest wins and vertex wins. This matches Requirements 4.6, 5.5 and 33.4.
- **Radius comparison.** `stickyRadiusPx > radii.line` is required (`:78`). The reduced `hitTest` uses `dist <= radius`, so the boundary is inclusive and consistent with acquisition.
- **Vertex radius -1** (`:82`). `findVertex` does `dist > radius` for every point, so a vertex can never be reported. The points are kept only for segment endpoint lookup.
- **Element kinds.** `reduceToHeld` filters by `elementKind` as well as id. A segment and a polyline that share an id therefore cannot be confused. The axis ids and bar-edge ids work. For a held bar-edge, a finger inside the bar gives base `bar`, then the reduced `hitTest` gives a line within 24 px of the edge. That is the intended outcome.
- **Polyline-beats-axis.** The held target is only consulted when `base` is none or bar, so nothing within 14 px exists. Axes cannot outrank a held polyline inside the reduced scene.
- **Stale or junk `prevTarget`** (id missing, unknown `elementKind`). The reduced scene is empty, `hitTest` returns none, and the function returns `base`. P119 covers this.
- **Nits, not defects:**
  - `heldMs` and the feature switch are caller-owned. Nothing here proves the caller resets `heldMs` on a target change. That belongs to the wiring task.
  - `sticky.ts:77` accepts any `prevTarget.kind === 'line'`, even if the returned id was not the one held for 200 ms. This depends on the caller, so it is a wiring risk and not a bug here.

## Is P117's brute force the same function the product uses?

No for the logic. Yes for the primitive.

- Piece enumeration (`pieces()`, `:~70-110`) is written independently of `reduceToHeld` and `findLine`: its own point lookup, polyline walk, axis spans and four bar edges.
- It shares only `distToSegmentXY`, the geometry primitive. That is acceptable. It is not a re-implementation of `followTarget`, and a drift in the reduced-scene trick would be caught.
- The header comment ("Nothing in sticky.ts is reused") is true.
- Gap: the oracle skips `|d - s| <= 1e-6`, and it always draws the held line from the scene. No case has a segment sharing endpoints with another segment, and no case has an id shared across kinds. P119 covers junk but not these two.

## Minimal fix (T60)

Do not weaken the property. Fix the generator so the coverage is reliable, and drop the unseeded threshold.

1. In P117, aim into the band deliberately. Add a second finger mode to `aim()` or the case, with offset `r = line + 0.5 + u * (s - line - 1)`, on the normal of a piece, so about half of the runs are band samples. `d` is then in the band by construction, and only the "another line within 14 px" rejection remains.
2. Run the P117 scene with fewer competing lines. Either use a lean scene arbitrary (one held kind plus 0 to 1 distractor), or run each of the four kinds as its own scene so axis, polyline and bar-edge are isolated from segments.
3. Lower the guards to what the generator guarantees (e.g. `> 5` for stuck and released, and per-kind `stuck >= 1` using `fc.constantFrom` per kind). Alternatively, seed the run (`{ seed, numRuns }`) for a stable count. An unseeded `> 20` over a 2 to 5% event is the cause.
4. Same cause for P116's `lines > 20`: raise `numRuns` or bias the finger to within `radii.line` of the held piece.

No change to `core/sticky.ts` is needed. Do not touch the tuned haptic values.
