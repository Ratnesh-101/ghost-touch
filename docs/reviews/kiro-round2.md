# Kiro round 2: verification record
Reviewer: Kiro | Started: 2026-11-07 | Branch: main (nothing pushed)

Source reports: `docs/reports/audit-a6-security-fullstack.md` (A6), `docs/reports/audit-a7-bughunt-core.md` (CORE, NEEDS-KIRO), `docs/reports/audit-a4-backend-ask.md` and the f4 lane (A4/f4).
Rule: every finding is reproduced (a failing test or a direct check) before it is fixed. Status is FIXED, NOT REPRODUCED, SKIPPED (with the reason), or OPEN while work is in progress.
Contract decisions A2 SEC-01, A2 SEC-04 and A5-05 were not touched. No haptic constant was changed.

## Process notes
- **Step 0 (audit reports):** `audit-a6-security-fullstack.md` and `audit-a7-bughunt-core.md` were already committed on main (`a3d3171`, `194efec`). The lane copies are identical once line endings are normalised, so there was nothing to copy or commit.
- **f4 lane:** `agy/f4-fix-backend-ask` points at `4a43004`, an ancestor of main, so it has no commits. The lane's work is uncommitted in `..\gt-lane-f4-fix-backend-ask` (modified `ask.py`, `limits.py`, `main.py`, `BUILD_LOG.md`; new `test_fix_ask_regression.py`, `agy-f4-fix2.md`, report). `git merge --squash` of that branch would add nothing, so the working-tree diff is applied to main as a patch. The lane worktree is left unchanged.

## Findings

| ID | Severity | Task | Status | Evidence / reason |
|---|---|---|---|---|
| f4-1 | high | 24 | FIXED | Reproduced: HEAD returned fact answers unclamped (no `clamp_answer` on that path). Fixed in the f4 lane; `test_facts_lookup_clamped_to_max_chars_and_sentences` passes. Test only needed converting from `@pytest.mark.asyncio` (plugin not installed) to `asyncio.run`. |
| f4-2 | high | 24 | FIXED | Reproduced: HEAD had no `is_disconnected` check and no `get_ask_semaphore` (the new test module cannot even be imported on HEAD). Lane added both; `test_ask_route_disconnect_returns_499` passes after the same async-marker conversion. |
| f4-3 | med | 24 | FIXED (Kiro) | Reproduced: the lane only sanitised the element-id list, but the raw `</user_question>` still reached the prompt through the scene JSON (labels, title, facts, ids). Now the whole scene JSON is sanitised. `test_closing_tag_in_any_scene_string_never_reaches_the_prompt` covers label, title, fact and id; mutation (remove the sanitising) fails 4 of 4. |
| f4-4 | med | 24 | FIXED (Kiro) | Reproduced: lane raised the shared polyline cap to 2000, so `/validate` accepted 1001 points. `_check_scene_size` now takes `max_polyline_points`; `/ask` uses 2000, `/validate` uses `MAX_VALIDATE_POLYLINE_POINTS = 1000`. Side effect (owner instruction): a Teacher scene with 1001 to 2000 points opens from a share link but cannot be saved in Correct mode. |
| f4-5 | med | 24 | FIXED (Kiro) | Reproduced: "What is it in cm?" returned "AC = 4 cm. BC = 3 cm. AB = 5 cm." because the unit token counted as a content word. Unit tokens no longer count; "How long is AB in cm?" still matches through the identifier. Mutation (restore old behaviour) fails the test. |
| CORE-04 | high | 24 | FIXED | Reproduced on HEAD (period-only strip, reference phrase kept its danda). Lane strips `.` and `।` on both sides; Kiro added `॥` and spaces via `_TRAILING_PUNCT`. Note: the long phrases are matched as substrings, so the double danda only matters for the exact-match short answers ("unknown", "I don't know"); tests cover both paths and a mutant without the marks fails 21 tests. |
| CORE-05 | high | 24 | FIXED | Reproduced on HEAD (no clamp on the facts path). Fixed in the f4 lane; covered by f4-1. |
| CORE-06 | high | 24 | FIXED | Reproduced on HEAD (`MAX_POLYLINE_POINTS = 1000`). `/ask` now accepts 2000, matching `frontend/src/share/limits.ts`; `test_ask_accepts_polyline_up_to_2000_points` and `test_ask_rejects_polyline_over_2000_points` pass. `/validate` is intentionally 1000 (see f4-4). |
| CORE-11 | med | 24 | FIXED | Reproduced on HEAD (point "A" skipped unconditionally). Lane skips "A" only when no element is named "A"; `test_facts_lookup_query_point_a` and the no-point-A counter-test pass. |
| CORE-12 | med | 24 | FIXED | Reproduced on HEAD (`str(parsed["answer"])`). Lane rejects non-string answers (dict, list, null); `test_parse_model_ask_output_rejects_dict_answer` passes. |
| A6-01 | high | 25 | FIXED | Reproduced: HEAD read the leftmost `X-Forwarded-For` entry, which the client writes. New pure `client_key(peer, xff, trusted_hops)`: no trusted proxy gives the peer address; behind n trusted hops it takes the n-th entry from the right. `TRUSTED_PROXY_HOPS` sets n; unset means 1 when `RENDER` is set, else 0. Header shorter than n falls back to the peer; key length is capped. Tests: forged header cannot buy a new budget off Render or behind a proxy; real clients behind the proxy keep separate budgets. Mutation (leftmost entry) fails 2 tests. Not verifiable here: Render's actual proxy chain length (task 21.10 for the owner: confirm one hop). |
| A6-02 | high | 25 | FIXED | Reproduced: HEAD never deleted an emptied window (the f4 lane added a sweep only when the table exceeded 1000 keys). Now a sweep runs at most every 5 s or when the table exceeds 1000, and deletes every client whose newest hit is older than the window. Test: 300 clients expire, one new client leaves exactly one key and no empty window. Mutation (no sweep) fails. |
| A6-03 | high | 25 | FIXED | The cap itself came from the f4 lane. Reproduced two gaps there: (1) `asyncio.wait_for(sem.acquire(), timeout=0)` raises even when a slot is free, so a queue wait of 0 meant always-busy, on /ask and on /scene; (2) a client that hung up mid model call kept its slot and the paid call ran on. Added `acquire_slot` (a free slot is always taken) and a watcher that cancels the call and answers 499. Tests: 503 with Retry-After under load, 499 within 2 s of a hang-up during a 5 s call. Mutation (old acquire) fails. |
| A6-04 | high | 25 | FIXED | Reproduced: no CSP anywhere. Frontend: CSP, HSTS (2 years, includeSubDomains, no preload) and Permissions-Policy added to `frontend/vercel.json`; `vite preview` serves the same headers from that file so the policy is testable locally. API: `default-src 'none'; frame-ancestors 'none'` and `X-Frame-Options: DENY` on every response except the interactive docs paths. `style-src` keeps 'unsafe-inline' (React inline styles); scripts stay 'self' only. Browser check: production build (with the Render API URL) served by `vite preview`, driven by headless Edge through Start, sample diagram, Explore, Teach route, a PDF upload (pdf.js worker) and the debug page: 0 CSP violations. Not exercised: the Teacher QR image (Teach is feature-flagged off), camera capture and live speech recognition (need a device). The probe blocked requests to onrender.com, so no live backend call was made. |
| A6-05 | high | 25 | FIXED | Reproduced, with a smaller impact than reported: POST to a slashed path skipped the guards on the first hop, but the framework answers 307 to the clean path and the client then hits the guards, so there was no unguarded model call. The first hop itself was not size- or rate-checked (a 600 KB body to `/api/v1/ask/` got a 307, not a 413), so `normalize_path` now collapses repeated and trailing slashes before the limit lookup. Tests: 8 path cases; a 600 KB body to `/api/v1/ask/` is refused 413 on the first hop; slashed requests count against the rate limit. Mutation (no normalisation) fails 2 tests. |
| A6-06 | med | 25 | FIXED | Added HSTS and Permissions-Policy (camera and microphone to self; geolocation, payment, usb, serial, bluetooth denied) to `vercel.json`. Tests in `security.headers.test.ts`. `preload` was left out on purpose: it is a hard-to-undo commitment for the owner. |
| A6-07 | med | 25 | NOT REPRODUCED | Built a spec-conformant extended WebP (VP8X, then ICCP, then the image chunk): `sniff_image_dimensions` returns the right size. Simple lossless/lossy WebP also fine. The audit's example puts ICCP before VP8X with no VP8X header, which the WebP container spec does not allow; that file does return None. Left unchanged: relaxing the parser to accept non-conformant files was not justified by a real photo. |
| A6-08 | med | 25 | FIXED | Reproduced and measured: a 200x200 noise image sent 6 136 candidate segments into the quadratic de-duplication (1.9 s); 400x400 sent 24 328 (21.6 s, over the 15 s request budget). Now the candidates are sorted longest first and cut to 1000 before de-duplication. After: 0.18 s, 0.22 s, 0.60 s (1000x1000), 1.95 s (2000x2000); still 300 segments. Tests: candidate cap on a noisy photo, and a long line survives clutter. |
| A6-09 | med | 25 | FIXED (partly NOT REPRODUCED) | The `@v7` action tags DO exist (checked against the GitHub tag lists for checkout, setup-node, setup-python, upload-artifact), so that part is NOT REPRODUCED. The missing top-level `permissions: contents: read` in `ci.yml` was real and is fixed; the file keeps its CRLF endings. Test: `security.headers.test.ts`. |
| A6-10 | med | 25 | FIXED | Reproduced by test: 8 simultaneous improve passes put 8 provider calls in flight. `run_improve_pass` now takes a slot from a semaphore (`IMPROVE_MAX_CONCURRENCY`, default 1) and skips when none is free, because the pass is best effort. Mutation (no cap) fails both tests. |
| A6-15 | med (suspected) | 25 | FIXED | Reproduced, but the symptom differs from the audit: a streamed body over the limit returned HTTP 400, not 500, because FastAPI turns any `Exception` raised while reading the body into a 400. `_BodyTooLarge` is now a `BaseException` so the guard can answer 413. Test: 640 KB streamed without Content-Length gives 413. Mutation (plain Exception) fails. |
| A6-11, A6-12, A6-13, A6-14, A6-16 | low | 25 | OPEN | not requested; decision recorded at the end |
| CORE-01 | high | 26 | OPEN | |
| CORE-02 | high | 26 | OPEN | |
| CORE-03 | high | 26 | OPEN | |
| CORE-07 | med | 26 | OPEN | |
| CORE-08 | med | 26 | OPEN | |
| CORE-09 | med | 26 | OPEN | |
| CORE-10 | med | 26 | OPEN | |
| CORE-13 | med | 25 | FIXED | Duplicate of A6-01 and A6-02 (same code); see those rows. |
| NEEDS-KIRO-01 | high | 26 | OPEN | |
| NEEDS-KIRO-02 | med | 26 | OPEN | |
| CORE-14, CORE-15, CORE-16 | low | 26 | OPEN | not requested; decision recorded at the end |

## New findings from Kiro's own checks

| ID | Severity | Task | Status | Evidence / reason |
|---|---|---|---|---|
| K2-01 | high | 26 | OPEN | Opening #/debug while the app runs crashes React with error #300 (App returned <Debug /> before a later useCallback). Found by the CSP browser check. |
