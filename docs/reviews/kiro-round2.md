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
| f4-1 | high | 24 | OPEN | facts_lookup clamp (test_fix_ask_regression) |
| f4-2 | high | 24 | OPEN | ask disconnect gives 499 |
| f4-3 | med | 24 | OPEN | no raw `</user_question>` in element-id list |
| f4-4 | med | 24 | OPEN | /validate structural limits (test_hardening) |
| f4-5 | med | 24 | OPEN | lone unit word selects a fact (test_review_fixes) |
| CORE-04 | high | 24 | OPEN | |
| CORE-05 | high | 24 | OPEN | |
| CORE-06 | high | 24 | OPEN | |
| CORE-11 | med | 24 | OPEN | |
| CORE-12 | med | 24 | OPEN | |
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
