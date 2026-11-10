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
As of 2026-11-10 ~02:10 (session B, Claude). All local commits, nothing pushed.

MERGED by session B tonight, each gated green before commit: n1, m2, m1, m3, n2, p1 (backend audit fixes), p2 (saved diagrams), p4 (docs claims), p5 (backend P-numbered ids), v1 (Ghostwriter UI audit fixes). p3 and g1 (Ghostwriter UI, Kiro task 36) were merged by session A; p3's patch was already on main.
Round-5 and u1 audits are in docs/reports/audit-r5-*.md and audit-u1-g1.md. Every HIGH finding from them is fixed on main, EXCEPT what is listed below.

NOT MERGED, owned by session A (do not duplicate; read docs/handoffs/LOOP-CLAIMS.md first): q2-frontend-round5 (Explore language switch, caveatForQuestion language, ShareError double speech, resolveShareRoute default), r1-correct-delete-curves (Correct UI for deletePolyline/deleteBar), r2-share-aspect (share validator keeps aspect), t1 (Kiro oracles P74, P76, P77). q2, r1, r2 finished with exit 0 before the quota hit; q1 was merged by A after the reset.
Full frontend gate on main at the last run: tsc 0 errors, 1929 tests pass, 3 fail. The 3 failures are Kiro's oracles P74 (failed delete must not report ok:true over the cap), P76 (updating an existing id keeps pinned and createdAt) and P77 (no share.* string may contain 'verified' / सत्यापित / પ્રમાણિત; the merged share.honesty wording 'Ghost Touch has not verified it' contains it, so reword it, e.g. 'has not been checked by Ghost Touch', in en, hi, gu, and send hi/gu to native review). These are what t1 is for.
Backend: 783 pytest pass, ruff clean (last run after p5).

KNOWN, not done:
- agy quota: 429 RESOURCE_EXHAUSTED hit at 00:57 (reset about 01:48). It is shared by all sessions; a lane that exits with status 3 and an IN PROGRESS report did no work: rerun it with a new run name.
- The Ghostwriter duplicate-position question (two points at the same place) is a product decision for the owner; v1 did not change it.
- Kiro: still has uncommitted .kiro/specs edits and docs/reviews/session-review-latest.md; also owes the core fixes (addPoint reserved id 'title' and 500 cap are partly handled by the UI cap of 300; parseFacts hi/gu; localizedFindingTarget English fallback; vacuous 18.2 and P56 tests) and a stray tests/zz_replay.tmp.test.ts with a tsc error if it still exists.
- Final test recount for the [RECOUNT] markers has NOT been done and the old s1-recount diff in gt-lane-s1-recount is stale: do the recount last, after everything above merges.
- Old worktrees: cleanup-lanes.sh (owner ran it once). New merged lanes to add to its list: p1, p2, p4, p5, v1, u1-g1-audit, r5-*, plus the duplicate q1-frontend-lang (its run was stopped on purpose; it has no useful work).
- Memory pressure: a gate run was killed once by the memory reaper; run one gate at a time, and do not restart a reaped job until memory is free.

