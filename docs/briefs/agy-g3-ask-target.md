# Lane g3-ask-target (agy)
Read `docs/briefs/guide-share-contract.md` (Global rules + Ask-target contract) and AGENTS.md first.
Goal: the Ask endpoint can return an optional guide target, validated server-side.
Allowed files: `backend/app/ask.py`, new `backend/tests/test_ask_target.py`, new `backend/tests/test_ask_target_props.py`, `frontend/src/api/ask.ts`, `frontend/tests/api.ask.target.test.ts` (new), `docs/reports/agy-g3-ask-target-report.md`, `docs/BUILD_LOG.md`.
Forbidden: `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/core/**`, `.kiro/**`, `.env*`, existing prop tests.
Requirements:
- `AskResponse.target: AskTarget | None = None` where AskTarget is either `{elementId: str}` or `{x: float, y: float}` (Pydantic model; x,y in [0,1]). Old fields unchanged; existing tests keep passing.
- Prompt (`build_ask_prompt`): add a section listing every element id in the scene and instruct the model to optionally return `"target"` ONLY for requests like "where is / take me to / find ...", choosing an id from that list; otherwise omit. Keep the answer <= 2 short sentences and the exact "I don't know from this diagram." rule. Parse the model's JSON tolerantly: if the model output is plain text, behave as today.
- Server-side validation: drop unknown elementId, drop x/y outside [0,1] or non-finite => `target: None`. Never raise because of a bad target.
- Frontend `parseAskResponse`: map to `GuideTarget` per contract; malformed => undefined; never throws.
Tests: pytest example tests (valid id kept, unknown id dropped, out-of-range xy dropped, plain-text model reply unchanged, facts path has no target); Hypothesis: for arbitrary dict/target junk the validated target is None or refers to an existing id / in-range point. Vitest for the client parser incl. junk.
Do NOT run pytest or ruff (supervisor does). You may run the frontend tests and tsc. Write the report first.
