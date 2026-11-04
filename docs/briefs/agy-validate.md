# Lane T11b: POST /api/v1/validate (backend, for Teacher Correct mode, Requirement 9.3)

## Contract (the frontend lane codes against exactly this)
Request JSON: `{"scene": <object>}`.
Response 200 JSON: `{"ok": true, "scene": <normalised DiagramScene>, "errors": []}` when the existing validator accepts it (return the validator's repaired scene), or `{"ok": false, "scene": null, "errors": ["<short message>", ...]}` when it rejects it.
Malformed body or missing "scene": 422 (FastAPI default). Body size limited like the other JSON endpoints.

## Allowed files
- `backend/app/main.py`
- `backend/app/limits.py` (only to add this route to the rate limits the same way `/api/v1/ask` is)
- `backend/tests/test_validate_endpoint.py` (new, example-based)
- `docs/reports/agy-validate-report.md`

## Forbidden
`backend/app/validate.py` and `schema.py` (read-only: import `validate_scene` and use it as is), all property tests, `frontend/**`, `.kiro/**`.

## Do
1. Add the route using the same dependency and limits patterns as `/api/v1/ask`. Nothing is cached or stored.
2. Tests (example-based): a valid triangle fixture is accepted (ok true, scene equals the validated scene); a dangling segment is repaired or rejected exactly as the real validator does; coordinates beyond the tolerance are rejected with an error; colour-only labels such as "blue polygon" are rejected; an empty scene is rejected; garbage JSON gives 422; an oversize body is rejected; rate-limit behaviour matches `/ask`.

## Done
`backend/.venv/Scripts/python -m pytest backend`, `... -m ruff check backend`, `... -m ruff format --check backend` all pass, with real counts in the report.

## Shared rules
Read AGENTS.md first. The owner explicitly authorised this lane (2026-11-04) to write code that AGENTS.md normally reserves for Kiro; touch only the files listed here, and say plainly in your report that this is agent-written, not Kiro-written. Do not change the tuned haptic values or the haptic engine. No git state changes, no installs, no `.env` access, no new dependencies. Run the commands for real and record true results, including failures.
