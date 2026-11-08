# Session review (latest)
Reviewer: Kiro | Date: 2026-11-07 | Verdict: **FIX FIRST** (the working tree is mid-task; nothing here should ship until T24 passes its gate)

Scope: round 2, Phase 2 of 2026-11-07, in `C:\Users\Admin\Downloads\ghost-touch-main\ghost-touch-main`. Kiro-owned files changed: `.kiro/specs/ghost-touch/requirements.md`, `design.md`, `tasks.md` (committed as `kiro: T23`, `2b11b4e`). No file in `frontend/src/core/` or any `*.prop.test.ts` changed this session.

## Checks
- [x] Architecture: no `core/` change; spec text keeps new pure logic in `flow/` and `backend/app/limits.py`, not in `core/`.
- [x] Haptic values unchanged (no diff in `core/` since T19; values last verified: lineMs 80, retriggerMs 70, cornerPattern [50,90,50], quietMs 450, vertexRadius 22, lineRadius 14, pitch 200 to 1000 Hz).
- [x] P1 to P13: no test file changed this session; last verified at 200 or more cases each.
- [x] No TEMP stubs (`frontend/src/_temp` does not exist).
- [x] tasks.md matches: task 23 ticked (spec, design, review skeleton all exist and its gate passed: tsc clean, 1542 frontend tests, build OK, 477 backend tests, ruff clean). Tasks 24 to 28 are open and correctly unticked.

## Findings
| # | Severity | Where | Problem | Next step |
|---|---|---|---|---|
| 1 | High (blocks shipping) | working tree: `backend/app/ask.py`, `limits.py`, `main.py` plus `tests/test_fix_ask_regression.py` | The f4 lane diff is applied but uncommitted, and 6 tests fail: 3 use `@pytest.mark.asyncio` (no `pytest-asyncio` installed), 1 raw `</user_question>` reaches the prompt through the scene JSON, 1 `/validate` polyline cap was raised together with `/ask`, 1 a lone unit word selects a fact. | Task 24; waiting on the owner's choice of how to edit the f4 test file (my scripted edit was rejected). |
| 2 | Medium | process | `agy/f4-fix-backend-ask` has no commits, so `git merge --squash` adds nothing; the work was taken as a patch from the lane worktree, which is untouched. | Recorded in `docs/reviews/kiro-round2.md`. |
| 3 | Low | `/validate` vs share contract | Keeping `/validate` at 1000 polyline points (as instructed) means a Teacher scene with 1001 to 2000 points opens from a share link but fails to save in Correct mode. | Noted for task 24.3; owner decision stands. |

## Needs from the owner
- Pick how to fix the three async tests (targeted edits, add `pytest-asyncio`, or leave them).
