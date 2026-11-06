# Session handoff, 2026-11-07 02:15 IST (Claude Code). Read after `SESSION-2026-11-06-late.md`.

Owner: Ratnesh Singh. Repo `Ratnesh-101/ghost-touch`. Main folder `C:\Users\Admin\Downloads\ghost-touch-main\ghost-touch-main`; lane worktrees are next to it as `gt-lane-<name>`.
Standing rules unchanged: agy builds, Claude supervises (briefs in `docs/briefs/`, agy-run.sh only, never `--dangerously-skip-permissions`: the owner asked for it again and I declined; the lanes never needed it); no Claude co-author lines; no force-push or history rewrite; never open `.env*`; `frontend/src/core` zero-line diff; label agy work "built by agy, reviewed by Claude", never Kiro. **Squash-merge every lane (one commit per lane).**

## Status in one line
**Rounds 2 and 3 are NOT done. They must be run next.** Round 1 (the audits) finished; nothing from the two newest audits has been fixed or merged, and the Ask-backend fix lane still has failing tests.

## What is on `main` and pushed (verified green when merged)
- Guide my finger and Teacher verify & share (flags OFF), owner checklist, P20 hex migration.
- Semantic voice commands (frontend): peak, lowest point, origin, tallest/shortest bar, right angle, longest side.
- Squashed audit-fix lanes: runtime/guide (f1), share security (f2), teacher editor (f3).
- Semantic Ask (backend, g5): deterministic answers for the same questions, no model call; Hindi/Gujarati phrases.
- Numbers at last full check: frontend 1518 tests / 110 files, backend all passing, `tsc`, build and ruff clean, precache 659 KiB, core zero diff.
- Last pushed commit before this handoff: `4a43004`. Local `main` also holds one unpushed docs commit (`fdb7c08`, round-1 briefs) plus this handoff; push after committing.

## NOT merged: what is waiting in lane worktrees
1. **f4-fix-backend-ask** (`..\gt-lane-f4-fix-backend-ask`, branch `agy/f4-fix-backend-ask`). Ask backend fixes (Hindi danda in "don't know" detection, clamp `facts_lookup` answers, polyline cap 2000, point "A" matching, non-string `answer`). **Last pytest run: 5 failures**, so DO NOT MERGE as is:
   - `test_fix_ask_regression.py::test_facts_lookup_clamped_to_max_chars_and_sentences`
   - `test_fix_ask_regression.py::test_ask_route_disconnect_returns_499`
   - `test_fix_ask_regression.py::test_prompt_delimiter_sanitized_in_element_ids` (raw `</user_question>` still appears in the prompt's element-id list)
   - `test_hardening.py::test_validate_structural_limits` (expects 422, gets 200: an older `/validate` structural limit was loosened; only the `/ask` polyline cap should move)
   - `test_review_fixes.py::test_facts_unit_word_alone_does_not_select_a_fact` (a lone unit word now selects facts)
   Follow-up brief exists: `docs/briefs/agy-f4-fix2.md` (already run once; it did not fix everything). Send one more focused follow-up with the exact failures, then run pytest and ruff yourself (agy must not run them), then squash-merge.
2. **a6-security-fullstack** and **a7-bughunt-core**: audit reports only, finished but NOT committed or merged. Reports sit in `..\gt-lane-a6-security-fullstack\docs\reports\audit-a6-security-fullstack.md` and `..\gt-lane-a7-bughunt-core\docs\reports\audit-a7-bughunt-core.md`. Commit them in their lanes and merge (docs only) first so the fix lanes can read them from `main`.

## ROUND 2 (fix) — do this next
Verify each finding before fixing (auditors have been wrong before); fix lanes record FIXED / NOT REPRODUCED / SKIPPED. Keep at most 3 lanes running at once (the machine hit memory pressure and killed a watcher). Split by file so lanes don't collide.
- **Security (a6) top 5:** A6-01 `X-Forwarded-For` spoofing bypasses rate limits (`backend/app/limits.py`; trust only the proxy hop Render adds, fall back to the socket address); A6-02 empty rate-limit deques never pruned (memory leak); A6-03 no concurrency cap on `POST /api/v1/ask`; A6-04 no Content-Security-Policy on Vercel (`frontend/vercel.json`) or FastAPI responses (add a CSP that still allows the PWA, fonts and the API origin, and test the built app in a browser before shipping); A6-05 trailing slash (`/api/v1/scene/`) may bypass request guards. Read the rest of the report for medium items.
- **Bug hunt (a7) top 5:** CORE-01 hardware Back from `#/teach` is silent and discards unsaved edits (`App.tsx` ~249-261); CORE-02 axis-crossing speech is cancelled by a simultaneous vertex announcement (`Explore.tsx` ~950-1022; join into one utterance); CORE-03 Saved Diagrams speaks over Capture after a quick exit (`SavedDiagrams.tsx` ~54-72); CORE-04 Hindi danda "don't know" (same as f4 A4-01); CORE-06 polyline cap mismatch (same as f4 A4-03). Read the rest for medium items.
- Fold CORE-04 and CORE-06 into the f4 follow-up so they are fixed once.
- Backend lanes (limits.py, main.py, ask.py) must run one at a time or be one lane, because they all touch the same files.

## ROUND 3 (re-audit) — after round 2
Re-audit only what changed in round 2 (security headers, rate limiting, Back handling, speech joins) with fresh audit lanes (new briefs based on `docs/briefs/audit-common.md`), then fix what they confirm. Finish with full gates on `main`: `npx tsc --noEmit`, `npx vitest run`, `npm run build` in `frontend`; `pytest`, `ruff check`, `ruff format --check` in the backend; `git diff --stat <base> -- frontend/src/core` empty; then push and write the next handoff.

## Findings deliberately NOT implemented (contract decisions)
A2 SEC-01 (keep the size cap on the share hash before decompress), A2 SEC-04 (coordinate handling stays identical to `backend/app/validate.py`), A5-05 (CI action tags; CI has been green, check `gh run list` before ever touching workflows). Also skipped in f2: SEC-06 (clipboard failure swallowed in SharePanel, owned by the teacher-editor lane; not confirmed fixed there) and SEC-09 (QR cap fixed by contract at 2000).

## Tooling notes
- The watcher scripts (`launch7.sh`, `waitq.sh`, `waitone.sh`) were in the session scratchpad and may be gone. Recreate them: launcher = for each lane write the one-line prompt file and run `bash scripts/agy-run.sh <prompt> agy-<lane>` from inside the lane worktree with node and agy on PATH (paths in `SESSION-2026-11-06.md`); waiter = loop until `logs/agy/agy-<lane>.agy.log` has not changed for 5 to 7 minutes. Pass lane names as arguments (no arguments = exits at once). **Background watchers were killed once for memory pressure: do not restart them unless the owner asks.** Without a watcher, ask the owner to message you when lanes should be done.
- Write briefs with the Write tool (shell heredocs containing Hindi/Gujarati text or many quotes broke the Bash tool).
- Create each lane worktree from `main` AFTER its brief is committed on `main`.
- Never install `@types/qrcode` (breaks 31 test files' `@ts-expect-error node:fs`).
- 80+ `agy/*` branches and ~20 `gt-lane-*` worktrees exist; clean up later and ask first (worktrees contain junctions to `node_modules`; do not remove them with a recursive delete).

## Owner to-do (agents cannot do these): see `docs/OWNER_CHECKLIST.md`
Phone test of Guide and Share (steps 4 and 5), TalkBack check of the Explore canvas name, Hindi/Gujarati native check (translation sheets include all new phrases), `[FILL]` markers, deciding when to switch the feature flags ON. Deadlines (IST): feature freeze Nov 13; STEMergent Nov 14 (hard limit Nov 16 09:00); Kiro credits request before Dec 1; Kiroween Dec 5 03:30. Today is Nov 7: plenty of time, but the phone test should happen before more features land.

## Honest summary for the demo video / submission
Do not claim Guide, Share or TalkBack as verified on hardware. Round-1 audits found real issues (rate-limit bypass, missing CSP, silent Back, speech collisions) that are not yet fixed on `main`; fix round 2 before presenting security or "bug free" claims.
