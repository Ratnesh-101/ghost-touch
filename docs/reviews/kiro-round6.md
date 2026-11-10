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
