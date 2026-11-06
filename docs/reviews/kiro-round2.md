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
| A6-01 | high | 25 | OPEN | |
| A6-02 | high | 25 | OPEN | |
| A6-03 | high | 25 | OPEN | |
| A6-04 | high | 25 | OPEN | |
| A6-05 | high | 25 | OPEN | |
| A6-06 | med | 25 | OPEN | |
| A6-07 | med | 25 | OPEN | |
| A6-08 | med | 25 | OPEN | |
| A6-09 | med | 25 | OPEN | |
| A6-10 | med | 25 | OPEN | |
| A6-15 | med (suspected) | 25 | OPEN | |
| A6-11, A6-12, A6-13, A6-14, A6-16 | low | 25 | OPEN | not requested; decision recorded at the end |
| CORE-01 | high | 26 | OPEN | |
| CORE-02 | high | 26 | OPEN | |
| CORE-03 | high | 26 | OPEN | |
| CORE-07 | med | 26 | OPEN | |
| CORE-08 | med | 26 | OPEN | |
| CORE-09 | med | 26 | OPEN | |
| CORE-10 | med | 26 | OPEN | |
| CORE-13 | med | 25 | OPEN | duplicate of A6-01 and A6-02 |
| NEEDS-KIRO-01 | high | 26 | OPEN | |
| NEEDS-KIRO-02 | med | 26 | OPEN | |
| CORE-14, CORE-15, CORE-16 | low | 26 | OPEN | not requested; decision recorded at the end |
