# Lane f4-fix-backend-ask (agy), backend
Read `docs/briefs/fix-common.md` (rules; the pytest/ruff rule below overrides it) and `docs/reports/audit-a4-backend-ask.md`.
Backend lane: do NOT run pytest or ruff (the supervisor does). Do not touch frontend files.
Findings to fix (re-verify each first, mark NOT REPRODUCED if false): ALL confirmed high/medium of the a4 audit, in particular:
- A4-01 Hindi "don't know" detection must strip the Devanagari danda (use `rstrip(".।")` or equivalent) so a Hindi "I don't know" answer never keeps a target.
- A4-02 `facts_lookup` answers go through `clamp_answer` before returning (no 800-character spoken monologues).
- A4-03 `MAX_POLYLINE_POINTS` must be 2000 to match the share limits (`frontend/src/share/limits.ts`), so teacher-verified diagrams are accepted by /ask.
- A4-04 a point whose id is "A" must be matchable in `facts_lookup` when "A" is a real element id in the scene (not always treated as the article "a").
- A4-05 `parse_model_ask_output`: `answer` must be a string; otherwise treat the output as plain text and never speak a Python dict repr.
- Plus any other confirmed high/medium (prompt-injection hardening of the element-id list, id escaping, answer sanitising of control characters, privacy logging of question text, target surviving a fallback answer).
Constraint: the new semantic short-circuit from lane g5 (`backend/app/semantic.py`) must keep working; do not change its behaviour except for bugs the audit proves.
Allowed files: `backend/app/ask.py`, `backend/app/semantic.py` (bugs only), `backend/app/main.py`/`limits.py`/`middleware.py` only if a finding requires it, new tests `backend/tests/test_fix_ask_*.py` (new files only; no edits to existing prop tests), report `docs/reports/agy-f4-fix-backend-ask-report.md` (create first), `docs/BUILD_LOG.md`.
Forbidden: `backend/app/schema.py`, `backend/app/validate.py`, `.kiro/**`, `.env*`.
