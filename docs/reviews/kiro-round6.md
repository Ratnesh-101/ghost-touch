# Kiro round 6: spec decisions and test-first oracles (task 40)

Tests written before the code they check. Each red test below waits on an Antigravity lane, because the code is in `flow/`, `App.tsx` or the validators, which Kiro was told not to edit this round. Every other test is green. To replay a property, pass its seed and path to `fc.assert(..., { seed, path, endOnFailure: true })`.

## Waiting on a lane

### 1. P43 (amended), Back from Correct: waits on the navigation lane (`flow/navigation.ts`, `App.tsx`)
- File: `frontend/tests/round2.navigation.prop.test.ts`, two tests: the amended property and "keeps the two editors apart".
- Counterexample: `["correct", dirty=false, correctDirty=true, fromShare=false, hasScene=false]`. Today `leaveByBack` returns `needsConfirm: false`; Requirement 24.1 needs `true`.
- Checked both ways by editing `navigation.ts` temporarily (restored, no diff):
  - The signature in design.md ("Round-6 decisions"), with a separate `correctDirty`, makes all 7 tests pass.
  - The audit's suggested fix, `needsConfirm: ctx.dirty`, still fails 2. `App.tsx` passes the Teacher flag as `dirty`, so that fix would let unsaved Teacher edits block leaving Correct.
- Lane work:
  - `BackContext.correctDirty?: boolean`, and `case 'correct'` returns `needsConfirm: ctx.correctDirty === true`.
  - `App.tsx` passes the Correct screen's dirty state.

### 2. P83, a failed save loses an older diagram: waits on the saved-diagrams lane (`flow/saved.ts`)
- File: `frontend/tests/saved.writeOrder.prop.test.ts`, two tests: "MemoryDiagramStore over the cap" and "fallback without putWithEviction over the cap".
- Counterexample (shrunk), seed `1120139535`, path `"1:3:0:2:2:2:2:2:2:2:2:2:2:2:2:2:5"`:
  - Starting state: cap 2, the store holds `d0`, `d1`, `d2`, `d3`, all unpinned (two over the cap, as a failed earlier save can leave it).
  - The save updates `d0` without `putWithEviction`, and the 3rd mutating call fails.
  - What happens:
    1. `put(d0)` succeeds.
    2. `delete(d1)` succeeds.
    3. `delete(d2)` fails.
    4. The rollback re-puts `d0`.
  - Result: `ok: false`, and **`d1` is gone**.
- Why both stores fail: with two or more victims, `saveDiagramWithEviction` skips `putWithEviction` (`evictedIds.length <= 1`), so the memory store takes the same fallback.
- What the audit and the prompt described:
  - The prompt's order ("the delete succeeds, then the put fails") does not happen. Both paths put before they delete, and the memory store checks for failure before it changes anything.
  - The audit's case (`evictedId === entry.id`) cannot come from `saveDiagramWithEviction`, which filters the saved id out of the victims. It did happen on a direct `MemoryDiagramStore.putWithEviction(e, e.id)` call; Kiro fixed that in `drivers/diagramStore.ts` (test "the audit case"; red when the fix is stashed).
- Green now: at the cap (at most one victim), both stores, any single failing call.
- Lane work: when a victim delete fails, re-put every victim already deleted before rolling back the new entry (Requirement 22.14, design.md).

### 3. Parity `reserved_*` cases: wait on lane a1 (both validators)
- Fixture: `backend/fixtures/validator_parity.json`, three new cases with `"structural": true`:
  - `reserved_title_with_segment`
  - `reserved_case_variants` (Title, TITLE, scene:title, __proto__, constructor, and a segment id valueOf)
  - `reserved_rename_collides` (title next to an existing el_title)
- Checks (Requirement 24.2): the scene is accepted, no reserved id is left, ids are unique, the segment count is the same, and every segment joins the same two points (matched by position).
- **Backend** (`backend/tests/test_validator_parity.py::test_backend_reserved_ids_renamed_and_segments_kept`): all 3 red. `validate.py` keeps the ids as they are, for example "reserved ids left: ['title']" and "['Title', 'TITLE', 'scene:title', '__proto__', 'constructor', 'valueOf']".
- **Share** (`frontend/tests/validator.parity.test.ts`, "reserved ids are renamed and segments kept"):
  - `reserved_rename_collides` is red. `title` becomes `el_title`, the existing `el_title` is renamed `el_title_2`, and both segments then use the first `el_title`. Segment `t2` now joins (0.5, 0.2) to B instead of (0.2, 0.6) to B.
  - The other two cases are green.

### 4. P84, share validator and reserved ids: waits on lane a1 (`share/validate.ts`)
- File: `frontend/tests/share.reservedIds.prop.test.ts`, 250 runs.
- Counterexample (shrunk), seed `855832413`, path `"3:3:5:5:6:5:5:5:5:5:9:0:0:3:3:3:3:3:3:3:4:0:2"`:
  - Points `el___proto__` (0.1, 0), `__proto__` (0.2, 0.3) and `title` (0.3, 0.6); one segment `__proto__`-`el___proto__`.
  - After the validator, `__proto__` is renamed to `el___proto__`, the same id as the point already there. The dedupe step then renames that original point, but the segment's endpoints are not rewritten to match.
  - Result: the segment joins (0.1, 0) to itself.
- **A first version of P84 passed.** With random letter case it almost never built a colliding pair, so it could not catch this bug. I added explicit collision pairs (`title`/`el_title` and others) to the generator before recording it.
- Lane work (24.2): rename every reserved id to an id not used anywhere in the scene, then rewrite segment endpoints from a map of old to new ids, before the dedupe step runs.

## Not red
- P83 "at the cap", P83 "the audit case", and every earlier parity case: green.
- `tsc --noEmit`: 0 errors.

## Full run after task 40 (2026-11-10)
The red tests are exactly the ones listed above; nothing else fails and nothing is skipped. `tsc --noEmit` has 0 errors; ruff is clean.
- **Frontend, 6 red:**
  - `round2.navigation.prop.test.ts` ×2 (section 1)
  - `saved.writeOrder.prop.test.ts` ×2 (section 2)
  - `share.reservedIds.prop.test.ts` ×1 (section 4)
  - `validator.parity.test.ts` `reserved_rename_collides` ×1 (section 3)
- **Backend, 3 red:** `test_backend_reserved_ids_renamed_and_segments_kept`, for the three `reserved_*` cases (section 3).
