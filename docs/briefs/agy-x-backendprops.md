# Lane x-backendprops: Hypothesis property tests for backend modules with only example tests

Create `docs/reports/agy-x-backendprops-report.md` FIRST and save as you go. Do NOT run the backend suite or ruff (the supervisor does, because it takes ~35 s and ends your turn). Add tests only, in ONE new file `backend/tests/test_infra_props.py`. Do not edit source files; if a property exposes a real bug, keep the test failing-free by NOT weakening it silently: write the bug into the report (file:line, input, proposed fix) and mark the single test with `pytest.mark.xfail(strict=True, reason=...)`.

Read `backend/app/image_utils.py`, `backend/app/scene_cache.py`, `backend/app/limits.py` and the existing tests that mention them (`backend/tests/`) and copy their style (Hypothesis settings profile, markers). Properties to cover (adapt names to the real API; read the code first):
- image_utils: dimension sniffing never raises on arbitrary bytes (returns None or a sane tuple), for valid generated PNG/JPEG headers returns the encoded size, EXIF orientation 5-8 swaps width/height (build tiny JPEGs with Pillow only if Pillow is already a dependency, else hand-built headers; no new dependencies).
- scene_cache: same image bytes give the same key; different bytes give different keys; size bound is never exceeded after any sequence of puts; a get after a put returns the stored scene unless evicted; TTL/expiry behaves monotonically if the module has one (use an injected clock if present).
- limits: the rate limiter never allows more than N requests per window for any generated request-time sequence; a fresh key is always allowed first; (use the real class with an injected clock if available, otherwise skip with a note).
Use `@settings(max_examples=100, deadline=None)` unless the repo profile says otherwise. Name tests `test_p21_...`, `test_p22_...` etc. and add one line per property to the report.

End with **Commit groups** (one commit: `test: property tests for image_utils, scene_cache and rate limiting`) and list anything you could not verify.
