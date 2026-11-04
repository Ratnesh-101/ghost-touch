# Review: lane B (graph / model pipeline), branch agy/graph
Reviewer: Claude Code. Builder: Antigravity (agy). Date: 2026-11-04.

**Verdict: APPROVE after one reviewer fix**

- Scope: `backend/app/main.py`, `scene_cache.py`, `vision/gemini.py`, `tests/test_graphs.py`, `tests/test_scene_cache.py`, new `tests/test_improve_pass.py`. No schema/validator/property-test/frontend/.kiro file touched. The agent's run ended before it wrote `docs/reports/agy-graph-report.md` (no report exists; this review is the record).
- Delivered: Gemini default model is now `gemini-3.5-flash-lite` (env `GEMINI_MODEL` still overrides); cache key takes a version; non-blocking "improve" pass (`run_improve_pass`) that stores a validated stronger-model scene under the same image hash, never fails or delays the primary response, never caches failures; extra safe-parser and cache tests.
- Reviewer fix: the improve pass defaulted to `gemini-3.8-flash`, which would spend a second Gemini request on EVERY successful scan, with the free tier at 20 requests/day/model. Changed to opt-in: it runs only when `GEMINI_IMPROVE_MODEL` is set. Added `test_improve_pass_is_off_by_default`.
- Verified by me: `pytest backend` 326 passed, 1 skipped (git-ignored schema file absent in a fresh worktree); `ruff check` and `ruff format --check` clean.
- Owner/config note: `render.yaml` sets `GEMINI_MODEL` explicitly, so the new code default only applies when that variable is unset. Flash-lite scored 0 of 5 on graphs in the vision spike; the graph-equation route is what covers graphs.
