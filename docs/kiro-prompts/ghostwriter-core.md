# Kiro prompt: Ghostwriter cut-down, core half (addPoint, addSegment)

Paste this into Kiro chat.

---

Spec-first task (new Requirement 19, "Ghostwriter: add what the AI missed", Teach mode only). Write the requirement, design and tasks BEFORE code, then implement, then tick tasks.md.

Why: when the vision model misses a corner or an edge, a teacher can today only move, rename or delete things in `frontend/src/core/correct.ts` (`movePoint`, `renameLabel`, `deletePoint`, `deleteSegment`). They cannot add what was missed. This adds the two missing pure edits. No new screen and no new gesture: the UI hook-up is a separate agy lane that comes after this lands.

Requirement 19 (write it in EARS form in requirements.md):
- 19.1 `addPoint` adds one point with a unique id, coordinates clamped to [0,1], optional label; adding never changes any existing element.
- 19.2 `addSegment` adds one segment between two EXISTING distinct points; unknown endpoints, a == b, or an already existing segment between the same two points (either direction) returns the scene unchanged.
- 19.3 Every result passes `validateSceneInvariants` whenever its input did (unique ids across points/segments/polylines/bars, no dangling endpoints, all coordinates finite and in [0,1]).
- 19.4 Non-finite coordinates (NaN, Infinity) are rejected: the scene is returned unchanged, never a NaN point.
- 19.5 Both are undoable through the existing history (`applyEdit` / `historyReducer`) with no new action type needed.
- 19.6 Honesty: an added element is the teacher's, so Spec Ghost wording must not claim the scene is "verified" or "correct" after an edit (no change to `VERIFY_WORDING`; add a test only if you find a path that could).

Implement in `frontend/src/core/correct.ts` (pure core: no React, no browser APIs):
- `addPoint(scene, x, y, label?, id?)`: when `id` is missing or taken, generate the next free id (a letter A..Z not in use, then `P1`, `P2`, ...). Return a NEW scene object; never mutate.
- `addSegment(scene, a, b, id?)`: id defaults to `${a}${b}` made unique with a numeric suffix.
Follow the existing style (immutable returns, original scene returned on a no-op).

Property tests (fast-check, at least 200 runs each, in `frontend/tests/correct.prop.test.ts` or a new `correct.ghostwriter.prop.test.ts`), number them P54 onward:
- P54: for any valid scene and any finite x, y, `addPoint` keeps `validateSceneInvariants` ok and grows `points` by exactly one.
- P55: for any valid scene and any two distinct existing point ids, `addSegment` keeps invariants ok; for unknown ids, a == b, or a duplicate pair it returns the same scene object.
- P56: `addPoint` then `undo` through `historyReducer` restores the previous scene exactly; same for `addSegment`.
- P57: a generator with NaN, Infinity, huge and negative coordinates never yields a scene that fails invariants.
Include one example test: add a missing corner `D` and the edge `CD` to `triangle.json`-like data and assert the new scene's point and segment counts.

Rules to keep:
- Do not touch the tuned haptic values or `hitTest` priorities.
- `frontend/src/core` stays pure; do not add imports from React, `window`, `navigator`, `document`, audio or speech.
- Do not edit `Correct.tsx`, `Teach.tsx` or any `flow/` file: the UI half is agy's next lane.
- Update the README/steering only if a rule changes; add one line to `docs/BUILD_LOG.md` (tool = Kiro).

Done when: tasks.md ticked, `npm test` green (the 3 skipped M4-10 tests are expected until the M4-10 prompt is done), `tsc --noEmit` has 0 errors, and `frontend/src/core` has no new browser API use.
