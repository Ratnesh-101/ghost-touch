# Lane x-backend2: flaky P13 test and SEC-10 shared HTTP client (backend only)

Create `docs/reports/agy-x-backend2-report.md` FIRST and update it as you go. Do NOT run the backend pytest suite or ruff (the supervisor does). Edit only files under `backend/` named here plus the report.

## 1. P13 flaky test
`backend/tests/test_validate_props.py::test_p13_accepts_non_colour_shape_labels` (around line 218) generates labels with `st.text(alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ", min_size=1, max_size=3)`. A 3-letter colour word (e.g. RED, TAN) can be generated and the validator correctly rejects it. Fix the generator by adding `.filter(lambda s: s.lower() not in COLOUR_SHAPE_WORDS)` (already imported) so 2-3 letter labels stay covered. Fix the misleading comment. Do not change `validate.py`. Note in the report that the test file is Kiro-owned and this is a minimal generator fix.

## 2. SEC-10 shared HTTP client
Today `backend/app/vision/_openai_compat.py::post_chat_completion` creates and closes a new `httpx.AsyncClient` per call when none is passed (TLS handshake every request). Read `docs/reports/audit-backend.md` (SEC-10) first.
- Add a lazily created, process-wide shared `httpx.AsyncClient` (module-level getter in `_openai_compat.py`, with sensible `limits`; per-request timeouts are still passed per call) and use it when no `client` is injected. Never close an injected client; do not close the shared one per call.
- Close it on app shutdown from the lifespan in `backend/app/main.py` (look at how `create_app()` and its lifespan are built; keep the change small).
- Keep every existing error mapping (timeouts, connect errors, status codes, secret redaction) exactly as is.
- Add tests in a new file `backend/tests/test_shared_http_client.py`: the getter returns the same instance twice; an injected client is used and not closed; the shared client is not closed after a call; the shutdown helper closes it and a later getter makes a fresh one. Use `httpx.MockTransport`; no network.
- Do not touch the Gemini provider.

End the report with **Commit groups** (two commits: `test: fix P13 generator so colour words are never generated`, and `perf(vision): share one httpx client across provider calls (audit SEC-10)`) listing files, and a note of anything you could not verify.
