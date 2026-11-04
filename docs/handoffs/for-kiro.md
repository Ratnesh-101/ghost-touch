# For Kiro: items that need a Kiro-owned change

Written by Claude Code, 2026-11-03. Kiro owns `frontend/src/core/**`, all property tests (`*.prop.test.ts`, `test_*_props.py`), `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts` and `.kiro/**`. Agents and Claude Code do not edit these. Anything they find goes here.

## Checked today (state of `main`)
| Item | State | Evidence |
|---|---|---|
| TEMP stubs (`frontend/src/_temp`, `backend/app/_temp`) | **Gone.** `flow/explore.ts` imports `../core/hapticEngine` and `../core/pitch`. | `ls` shows no `_temp` dirs |
| Requirement 13 (TalkBack) in the spec | **Present** in `requirements.md`. | grep |
| P1 flake | **Looks fixed.** The generator now requires minimum screen separation. 25 of 25 isolated runs passed (it used to fail about 1 in 5). | `frontend/tests/hitTest.prop.test.ts:31-59` |
| Full suites | 313 frontend, 337 backend, tsc, build and ruff clean. | run 2026-11-04 |

## Asks for Kiro
1. **Tick task checkboxes.** In `.kiro/specs/ghost-touch/tasks.md`, parent tasks 7, 10, 13 and 16 are unticked. Confirm whether 7 is complete (its listed sub-tasks 7.1-7.4 are ticked) and tick it.
2. **Remove the CI retry** for the old P1 flake: `.github/workflows/ci.yml` step "Run frontend tests" (`npm test || ... npm test`). It is no longer needed if you agree P1 is fixed. Claude Code left it in place because the P1 test is yours to sign off.
3. **Record the P1 finding as evidence.** `docs/kiro-evidence/pbt-p1-flake.md` explains the flake (a generator bug, not a `hitTest` bug). Add the final outcome (fixed, with the commit) for the write-up in `docs/KIRO_WRITEUP.md`.
4. **Hooks:** confirm the three hooks in `.kiro/hooks/` appear in Kiro's hooks panel and fire (screenshot or log for the write-up).
5. **Agent-lane notes (fill in as lanes land):**
   - Lane D (voice) is merged. It imports only `toScreen` and the scene types from `core` and never touches the engine; nothing is needed from Kiro. Follow-up for agents: `flow/svara.ts:90` default `new Audio()` should move to `drivers/`.
   - Nothing else from lanes A, B, C needs a Kiro change.

## Context
- Kiro's credits ran out on 2026-11-02 during spec hygiene; see `docs/BUILD_LOG.md` for which follow-ups an Antigravity agent finished instead. That work is logged as agent work, not as Kiro's.
- Do not change the tuned haptic values in `.kiro/steering/tech.md` without the owner's approval.
