# Session handoff, night of 2026-11-09 (Claude Code). Read the "RESUME HERE" section first.

## RESUME HERE
Repo `C:\Users\Admin\Downloads\ghost-touch-main\ghost-touch-main`, branch main, local commits only, NOTHING pushed (owner decides).
Rules unchanged: agy builds, Claude gates and merges; every agy prompt starts with the HARD RULE "no shell commands"; small separate commits (`git commit -m ... -- <paths>` in one command, never leave files staged); no co-author lines; never open `.env*`; **never close terminals or kill processes** (memory note dont-close-terminals); Kiro owns `frontend/src/core/` and `.kiro/` and commits its own work (do not touch its files).
Helpers in `C:\Users\Admin\Downloads\ghost-touch-main\`: `gatelane.sh <lane> <out>` (ruff+pytest+tsc+vitest+build in a lane; run in background), `reviewed.txt`, `cleanup-lanes.sh` (owner ran it; lists merged lanes to remove, junctions first). Launch pattern for a lane: worktree from main, `mklink /J` for `frontend\node_modules` and `backend\.venv` (agy exits 127 without them), prompt = HARD RULE + brief, `bash scripts/agy-run.sh ../gt-p-<lane>.txt agy-<lane>` from inside the worktree with node and agy on PATH. Watch with the Monitor tool on `/tmp/agy-<lane>.out` ("agy exit status").

## Merged today (all gated green before commit)
n1 backend round 4, m2 test quality, m1 a11y, m3 shared-link gate, n2 frontend round 4 (M4-10 un-skipped by Kiro T35), p1 backend audit fixes. Kiro committed T34 (Ghostwriter core addPoint/addSegment, P54-P57) and T35 (angle wording per language).

## Round-5 audits (all on main in docs/reports/audit-r5-*.md)
backend, saved-api, share-a11y, kiro-glue, docs-claims. Fix lanes: p1 (merged), p2 saved diagrams, p3 share/a11y, p4 docs claims, p5 backend ask ids. See the STATE AT STOP section below for what finished.

## Open work, in order
1. Anything listed under STATE AT STOP as not merged.
2. **Kiro prompt for core findings (owner asks for it)**: `addPoint` must reserve id `title` and cap at 500 points; `parseFacts` hi/gu and the `localizedFindingTarget` English fallback in `core/verify.ts`; tighten the vacuous 18.2 and P56 property tests. Also pending for Kiro: commit Req 20 + task 36 (written, uncommitted), then Requirement 21 properties (test-first for the R5 HIGH findings) in `docs/reviews/kiro-round5.md`. NOTE: one Kiro window was opened on the wrong folder (mtah-starter); make sure Kiro is on the ghost-touch-main folder.
3. agy frontend lane after p2/p3 are merged: `caveatForQuestion` must use the caller's language (flow/ask.ts), Explore status/speech must follow a mid-session language switch, caveat must match single-letter vertex questions, then App.tsx items: ShareError double speech (App.tsx ~339) and `resolveShareRoute` default `honest` true (~126).
4. agy lane g1 Ghostwriter UI (brief `docs/briefs/agy-g1-ghostwriter-ui.md`; spec = Requirement 20 / task 36): start only after Kiro's core fixes (item 2) and after p2/p3 merged (Correct.tsx and i18n overlap).
5. **Recount LAST**: test counts for the `[RECOUNT]` markers in BLOG, KIRO_WRITEUP, SOCIAL, STEMERGENT_SUBMISSION. The uncommitted s1-recount diff in `gt-lane-s1-recount` is STALE (do not apply it; counts changed). Redo with the final numbers after everything merged (brief: `docs/briefs/agy-s1-recount.md`, update the numbers in it first).
6. Cleanup: remove merged lane worktrees (`cleanup-lanes.sh`, add the new lanes; junctions first; keep b1, b5, b6, f4 until verified).

## Owner-only items (unchanged)
Spend caps on Gemini/OpenAI/Nebius dashboards; confirm Render X-Forwarded-For shape and pin TRUSTED_PROXY_HOPS; fix render.yaml service name vs CSP host; phone test of Guide/Share/TalkBack; native review of hi/gu strings incl. "कोण"/"ખૂણા" for angle and the new share.honesty wording; fill `[FILL]` markers; whether to push; STEMergent submit Nov 14 (hard stop Nov 16 09:00 IST), Kiroween Dec 5.
Decision made tonight: the hardware-tuning sentence stays (haptic values WERE tuned by hand on the owner's OnePlus Nord CE6 in the prototype) but must say full-app phone testing is still pending.

## STATE AT STOP
(filled in at the end of the session)
