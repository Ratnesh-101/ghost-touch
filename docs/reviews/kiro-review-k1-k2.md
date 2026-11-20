# Kiro review: K1 compass helpers and K2 corner re-entry fix

Date: 2026-11-15. Reviewer: Kiro (independent, read-only; this file is the only thing written to the repo).
Scope: `cbdca97` (T43, Requirement 26, P88-P95) and `0f104a1..a87499c` (T50, Requirement 4.9, P96), on `main`.
Checked against: `.kiro/steering/tech.md`, the pure-core rule, the spec text, and `docs/reports/fable-blind-user-plan.md` sections 2.3, 2.5, 7 K1 and K2.

## Verdict: FIX FIRST

The code does what the spec says, and no tuned value changed. One real hole in the P96 tests lets a regression of the exact bug K2 fixes pass. It is a small test addition. Two more medium findings are about compass property strength. Nothing below needs a code change to `compass.ts`, and none of it blocks the Nov 16 deadline on its own, but the P96 hole should be closed before anyone builds A3/A4 on this engine.

## What I ran

- `npx vitest run` (frontend, full): 183 files, 2262 tests, all pass. This matches the number in tasks.md 50.5.
- `npx tsc --noEmit`: 0 errors.
- Mutation checks in a throwaway copy under `%TEMP%` (outside the repo; repo status afterwards shows only the three untracked files that were already there):
  - Old engine (`0f104a1`) against the new P96 and regression tests: 7 tests fail (2 in the prop file, 5 of 6 seeds in the regression file). The new tests do detect the original bug.
  - 19 hand-made mutants of `compass.ts` against `compass.prop.test.ts`, and one of the new engine rule against the P96, P3-P6 and regression tests. Results are under findings 1 and 2.

## What checks out

- **Tuned values:** `DEFAULT_HAPTICS` and the `tech.md` table are not in either diff. `quietMs` is the only constant the fix uses. `.kiro/steering/` is untouched.
- **Pure core:** `compass.ts` imports types only from `./geometry` and `./scene`, no `guide/` import (Req 26.9), no `any`, named exports only. `hapticEngine.ts` adds no import.
- **Spec before code:** requirements, design and P-numbers for both tasks are in the commits that precede or accompany the code (`0f104a1` is spec-only for T50). The spec text matches the shipped behaviour, with the exception in finding 5.
- **Engine reachability after `quietMs`:** I traced this specifically.
  - Re-entry at `t >= quietUntil` fires (half-open window, like rule 3). Tested by P96(b), including exactly `t = quietMs`.
  - A different vertex always fires, also inside the window and also when returning to the first vertex after a second one (`lastCornerId` moves to the second). Tested by P96(c) and the V, W, V example.
  - A lift calls `initialState()`, which clears `lastCornerId`. Tested.
  - A suppressed re-entry does not touch `quietUntil` or `lastCornerId`, so a vertex cannot be locked out past its own window. Line buzz stays suppressed until the same `quietUntil`, as before.
  - `lastCornerId` is optional, so existing state literals still type-check. `{ ...state }` copies it.
  - No path makes a vertex unreachable after `quietMs`. One narrow behaviour difference is listed as finding 4.
- **Fable plan K2:** the requirement, the three property groups (a)-(c) and the regression replay (leave A along AC at 30 px/s, 60 Hz, seeded 2 px jitter, one pattern, first buzz within `quietMs + retriggerMs`) are all present. The regression test also asserts that the trace flaps across the boundary, so it is not vacuous.
- **Fable plan K1:** all four functions have the planned signatures, the arrival edge is left to the shell (Req 26.3), `lineEnds` is segments only, and "skips the edge I arrived on" is correctly not in the core. P88-P95 cover every property idea in the plan.
- **tasks.md encoding:** `9fba5f6` did damage the file (26 mojibake sequences, 77 non-ASCII characters against 27 before). `a87499c` restores it. I compared `a87499c` against `0f104a1` line by line: the only differences are the five checkbox ticks and the 50.5 gate text. Both files are valid UTF-8, LF only, no U+FFFD, same 27 non-ASCII characters as `0e8b405`. No lasting damage. See finding 6 for the leftover history problem.

## Findings

### 1. MEDIUM, `frontend/tests/hapticEngine.reentry.prop.test.ts` (whole P96 block): a regression of the corner-repeat bug passes

Mutant: keep the vertex memory but move `next.lastVertexId = target.id` (`hapticEngine.ts:144`) out of the suppression branch so it is set only when the pulse fires. The suppressed re-entry then leaves `lastVertexId` at `null`.
Effect: finger jitters back onto the vertex inside the window (silent), stays on it, and the next move after `quietUntil` fires the corner pattern and the label a second time, because `lastVertexId !== id` again. That is the stutter K2 exists to stop, only delayed to 450 ms.
Result: P96 (all tests), the regression file and the existing `hapticEngine.prop.test.ts` all pass (33 of 33). Cause: every P96 trace ends at or before the window end, or re-enters after a `none` hop, so no test keeps the finger on the vertex across `quietUntil` after a suppressed re-entry. The regression replay moves away from A at 30 px/s, so the finger is off the vertex by then.
Fix: add one property to P96: trace V (fires), leave, re-enter inside the window (suppressed), then stay on V with `move` inputs spanning past `t0 + quietMs`. Expect exactly one corner pattern and one label for the whole trace. Mutation-check it against the mutant above. Mention it in design.md P96 as clause (e) so the spec matches.

### 2. MEDIUM, `frontend/tests/compass.prop.test.ts` (P92, P94): two nearest-element mutants survive

- Dropping the last piece of every polyline (`compass.ts:255`, loop bound `pts.length - 1`) passes all of P88-P95.
- Dropping one bar edge (`compass.ts:291`, the right edge) passes all of P88-P95.
Both mean the "no element is nearer" claim in P92 and the "four edges per bar" rule in Req 26.5 are not pinned for those elements. A caller that asks "what is nearest" (A5, where am I) could be wrong near the end of a curve or the right side of a bar, and no test would say so.
Fix: in P92, bias the finger generator towards the far end of the last polyline piece and towards each of the four bar edges, or add example tests with the finger placed beside each of those two pieces.
Note: tasks.md 43.3 says "mutation-checked with four mutants". These two were not among them.

### 3. LOW, `compass.ts:90` (`findPoint`), `compass.ts:192` (tie-break): documented rules with no test

- "First point with an id wins" (design.md, Req 26.3, matches `hitTest`): changing `findPoint` to return the last match passes the tests.
- "The first candidate wins a tie" in the order vertices, segments, polylines, axes, bars (design.md Rules): changing `<` to `<=` at line 192 passes.
Fix: one example test each (two points sharing an id; a finger exactly equidistant from a vertex and a segment end, or a polyline and an axis).

### 4. LOW, `hapticEngine.ts:144-151`: suppressed re-entry does not emit `tone(null)`

Rule 1 emits `tone(null)` with the corner pulse. The suppressed path emits nothing. If the finger leaves the vertex onto a polyline (which starts a theremin tone) and comes back to the vertex inside the window, the tone keeps playing while the finger is on the vertex. Before the change it was silenced. This needs a vertex next to a curve in one scene, which the current samples and the Raw Mode output do not produce, and the window is under 450 ms, so impact is small. Req 4.9 says "no effects" explicitly, so this is a spec-level choice.
Fix (pick one): amend 4.9 to allow `tone(null)` on the suppressed re-entry and add it to the code and to P96(a)'s "no effects at all" test; or note the exception in design.md. Either is fine. I would emit `tone(null)` only, because it is silent-safe and does not touch the corner pulse or the window.

### 5. LOW, `.kiro/specs/ghost-touch/requirements.md:355` (Req 26.2): the text claims more than the code or tests guarantee

"SHALL NOT change when every point is scaled by one positive factor and translated by one vector" is not true in floating point for arbitrary factors, because `(a + t) - (b + t)` is not `a - b` exactly, so a vector near a sector boundary can change word. P90 tests only integer grids, power-of-two scaling and integer translation, and the design says so. The spec sentence should say that too.
Fix: qualify 26.2 ("exactly, for coordinates and factors that are exactly representable; otherwise only for vectors more than a rounding error from a sector boundary"), or restrict the claim to the cases P90 tests.

### 6. LOW, history: `9fba5f6` is a broken intermediate commit

`9fba5f6` carries the damaged `tasks.md` and the engine change; `a87499c` repairs the file. Anyone bisecting or checking out `9fba5f6` gets mojibake in the spec. The code is fine at both. Do not rewrite history for this; keep `a87499c` where it is. Process point: stage `.kiro/specs/*.md` with an editor that keeps UTF-8 (or `git diff --stat` before commit, which would have shown the 10-line file change as larger).

### 7. LOW, unrequested change, `frontend/src/core/hapticEngine.ts:1`

The commit removed the UTF-8 byte order mark at the start of the file (`ef bb bf` before `/**`, now absent). It is invisible, harmless, and not in the task, and it probably came from the same editor round trip that damaged `tasks.md`. The diff of the file is therefore not exactly "only the fix". I would leave it (the other core files may carry a BOM; restoring would add noise), but say so in the BUILD_LOG entry.

### 8. INFO, `compass.ts:166-293` (`nearestElement`): a finger beside a corner usually gets `segment`, not `vertex`

A vertex is the end of its segments, so a segment is nearer or equal to the vertex whenever the finger projects onto the segment. `vertex` wins only for fingers outside the corner's angle (or on an exact tie, where floating-point rounding in the clamped projection can go either way). This is correct for "nearest", and the design says nearest is not "under the finger". For A5 ("where am I") and A3, use `hitTest` for "on a corner" and `nearestElement` only when `hitTest` says `none`. Worth one line in the A5 brief. No code change.

## Unrequested content

Nothing beyond finding 7. T43 adds exactly the files and functions in the plan and the spec. T50 adds the engine change, the two test files and spec text. No UI, i18n, `flow/` or `guide/` change, no new dependency, no secret, no `.env` access.

## Order of fixes

1. Finding 1: add P96(e) plus mutation check (test and design.md line only).
2. Finding 2: strengthen P92 generators (test only).
3. Findings 3, 4, 5: small tests and spec wording, same commit if convenient.
4. Findings 6-8: no code action; record 7 in BUILD_LOG.

After 1 and 2 pass with the mutants killed, this is MERGE.
