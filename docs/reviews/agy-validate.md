# Review: lane T11b (POST /api/v1/validate), branch agy/validate
Reviewer: Claude Code. Builder: Antigravity (agy). Date: 2026-11-04.

**Verdict: APPROVE**

- Scope: `backend/app/main.py`, `backend/app/limits.py`, new `backend/tests/test_validate_endpoint.py`. `validate.py` and `schema.py` read-only and unchanged; no property tests, no frontend.
- Contract matches the brief exactly: request `{"scene": object}`, response `{"ok": bool, "scene": DiagramScene|null, "errors": string[]}`; the validator's repaired scene is returned on success; failures return `ok: false` with the validator's errors (fallback message "Invalid scene").
- Hardening: its own rate limit (`RATE_LIMIT_VALIDATE_PER_MIN`, default 40) and a 512 KB body cap, same patterns as `/ask`. Nothing cached or stored.
- Verified by me: `pytest backend` 346 passed, 1 skipped (git-ignored schema file in a fresh worktree); `ruff check` and `ruff format --check` clean.
- Note: the lane monitor flagged it "BLOCKED" only because its keyword filter matched "rate limit" in the agent's summary; the run was healthy.
