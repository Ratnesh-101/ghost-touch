# Follow-up lane g5-fix (agy), continue in this worktree
Supervisor ran `pytest backend`: 16 collection errors, all
`ImportError: cannot import name 'AskTarget' from partially initialized module 'app.ask' (most likely due to a circular import)`.
Cause: `backend/app/semantic.py` and `backend/app/ask.py` import each other at module level.
Fix: make `semantic.py` free of any import from `app.ask`. It should return plain Python values (for example a small frozen dataclass `SemanticResult(name, target_kind, element_id, x, y, label)` or a dict), and `ask.py` converts that into `ElementTarget` / `PointTarget`. No lazy imports as a workaround. Keep the behaviour and the tests; adjust the tests only if they import `AskTarget` from semantic.
Do NOT run pytest or ruff (the supervisor does). Edit only `backend/app/semantic.py`, `backend/app/ask.py`, `backend/tests/test_semantic*.py`, your report. Update your report with the fix.
