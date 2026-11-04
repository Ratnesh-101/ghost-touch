# For Kiro: items that need a Kiro-owned change or review

Updated by Claude Code, 2026-11-04. Kiro owns `frontend/src/core/**` (haptic engine, hit-testing, pitch, geometry), the original property tests P1-P13, `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts` and `.kiro/**`. Because Kiro's credits ran out, agents (Antigravity) were authorised by the owner to write some code in those areas; it is logged as agent work in `docs/BUILD_LOG.md` and `docs/reviews/`.

## State of main
- 473 frontend and 347 backend tests pass; tsc clean (TypeScript 7), build OK, ruff clean.
- Kiro's own commits are merged with their authorship: the P1 generator fix (2026-11-03), hooks `prop-tests-on-save` and `review-on-stop`, `docs/kiro-evidence/step*.md`, and the Task 13 spec (P14, P15).
- Agent-written, not Kiro: `core/correct.ts` with P16 and P17 (Teacher Correct mode), `POST /api/v1/validate`, the Task 13 completion (`core/savedDiagrams.ts` with P14 and P15 tests, IndexedDB driver, Saved screen and wiring), accessibility, voice and Hindi/Gujarati, deploy prep, repo bots. Tests on Kiro's T13 draft found four real defects in it (details in `docs/KIRO_WRITEUP.md`).

## Asks for Kiro (when it has credits)
1. **Review the agent-written core modules** (`core/correct.ts`, `core/savedDiagrams.ts`) against your spec and steering; adopt, rewrite or reject them. This is the best way to restore Kiro's ownership of the core.
2. **Tick parent tasks** that are truly done (7, 10, 14, 15, 16 depend on the owner's phone test and deployment; 13 is ticked).
3. **Confirm the five hooks** appear in the hooks panel and fire; add a screenshot to `docs/kiro-evidence/`.
4. If you take new spec-first work, the natural next feature is anything the phone test reveals; keep the tuned haptic values in `.kiro/steering/tech.md` unchanged unless the owner approves.
5. Known follow-up from review: the centre reference tick (25 ms) is still "proposed, pending owner approval" in `tech.md`.
