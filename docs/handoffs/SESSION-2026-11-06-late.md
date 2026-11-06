# Session handoff, 2026-11-06 late (Claude Code). Read after `SESSION-2026-11-06-night.md`.

Owner: Ratnesh Singh. Repo `Ratnesh-101/ghost-touch`. Main folder `C:\Users\Admin\Downloads\ghost-touch-main\ghost-touch-main`; lane worktrees sit next to it as `gt-lane-<name>`.
Standing rules are unchanged (see the evening handoff): agy builds, Claude supervises; no Claude co-author lines; no force-push; never open `.env*`; `frontend/src/core` zero-line diff; label agy work "built by agy, reviewed by Claude" and never call it Kiro work.

## NEW standing rule from the owner
**Squash-merge lanes** (`git merge --squash agy/<lane>` then ONE commit per lane) to keep the commit count small. The owner had 219 commits in a day and asked to reduce it. Reverting or rewriting pushed history was declined (revert adds commits; rewrite needs a force-push; the history is evidence for the Kiroween submission). Squash merging from now on is the agreed answer. Resolve `docs/BUILD_LOG.md`, `frontend/src/i18n/index.ts` and `docs/user-test/translation-review.csv` conflicts by keeping both sides.

## State of `main` (merged)
- Guide my finger, Teacher verify & share, P20 hex migration, owner checklist: pushed earlier (`d995a8b`). Both features are flagged OFF (`VITE_FEATURE_GUIDE`, `VITE_FEATURE_SHARE` must be "1" AND the Settings toggle on).
- Merged after that (local `main`, 14 commits ahead of origin at the time of writing; push them): `g4-semantic-voice` (frontend: voice phrases for peak, lowest point, origin, tallest/shortest bar, right angle, longest side; `frontend/src/guide/semantic.ts`; green: 1459 frontend tests, tsc clean), the five audit reports `docs/reports/audit-a1..a5-*.md`, and the briefs (`docs/briefs/semantic-targets-spec.md`, `audit-*.md`, `fix-common.md`, `agy-f1/f2/f3-*.md`).

## IN FLIGHT: NOT merged, NOT reviewed. Do not assume any of this is done.
Worktrees at `..\gt-lane-<name>`, branches `agy/<name>`. Check `logs/agy/agy-<name>.agy.log` age: quiet for 7+ minutes means finished.
1. **g5-semantic-ask** (backend: deterministic answers for "where is the peak / right angle..." with no model call; `backend/app/semantic.py`). After the circular-import fix it still FAILS 3 tests when last run:
   - `test_ask_target.py::test_ask_target_valid_point_kept` returns source "facts" instead of "ai": the semantic short-circuit intercepts a question that used to reach the model. Fix the matcher so only real semantic phrases match, or update the test if its question really is a semantic one (decide by the spec).
   - `test_semantic.py::test_match_semantic_feature_hindi_and_gujarati`: `match_semantic_feature('शिखर कहाँ है?')` returns None (Hindi phrase not matched; check normalisation of the danda/question mark and Devanagari matching).
   - `test_semantic.py::test_hindi_and_gujarati_answers`: TypeError "cannot unpack non-iterable NoneType" (same root cause).
   Send these back to agy as a follow-up lane (brief template: `docs/briefs/agy-g5-fix.md`), then run pytest and ruff yourself (agy must not), then squash-merge.
2. **f1-fix-runtime**, **f2-fix-share**, **f3-fix-teach** (frontend fixes from the audits; briefs `docs/briefs/agy-f1/f2/f3-*.md`, common rules `docs/briefs/fix-common.md`). Each lane was running and had edited 12 to 16 files; none reviewed. For each: read the report `docs/reports/agy-<lane>-report.md` (FIXED / NOT REPRODUCED / SKIPPED per finding), run `tsc`, `vitest`, `npm run build` in the lane, check `frontend/src/core` zero diff, then squash-merge. Watch for `i18n/index.ts` conflicts (three lanes append keys).
3. **f4-fix-backend-ask** was NOT started. Create it AFTER g5 is merged (both edit `backend/app/ask.py`). Findings from `docs/reports/audit-a4-backend-ask.md`: A4-01 Hindi danda in "don't know" detection (`rstrip(".।")`), A4-02 route `facts_lookup` answers through `clamp_answer`, A4-03 `MAX_POLYLINE_POINTS` 2000 to match share limits, A4-04 point "A" treated as an article, A4-05 enforce `answer` is a string in `parse_model_ask_output`, plus any other confirmed high/medium. Backend lanes must not run pytest/ruff themselves.

## Findings deliberately NOT being implemented (contract decisions)
- A2 SEC-01 (remove the hash-length check before decompress): rejected; the pre-decompress size cap is the zip-bomb guard. Only the fragment is measured.
- A2 SEC-04 (coordinate handling): stays identical to `backend/app/validate.py` (clamp within 0.02, reject beyond).
- A5-05 (CI action tags "@v7"): not changed; CI has been green with them. Verify with `gh run list` before ever touching `.github/workflows`.

## Audit items the lanes must prove before fixing (auditors can be wrong)
A1 G-RUN-02 (theremin not suppressed while guiding) and G-RUN-04 (Android Back corrupting history) contradict what the G2 review saw; the fix lane was told to re-verify each finding first and record NOT REPRODUCED where false.

## Tooling notes learned this session
- Shell heredocs with Hindi/Gujarati text or many quotes broke the Bash tool (parse error, nothing ran). Write briefs with the Write tool and keep launchers in files: scratchpad scripts `launch7.sh <lane...>` (starts agy lanes from worktrees) and `waitq.sh <quiet-seconds> <lane...>` (blocks until logs are quiet). They live in the session scratchpad and may be gone; recreate from the lane recipe in `SESSION-2026-11-06.md`.
- The watcher needs lane names as arguments; with none it exits immediately.
- Lane recipe order matters: create the worktree from `main` AFTER the brief is committed on `main`, or merge `main` into the lane branch.
- `npm i @types/qrcode` must NOT be installed (pulls `@types/node`, breaks 31 tests' `@ts-expect-error`).
- 81 `agy/*` branches exist; the merged ones can be deleted later (ask first).

## For the demo video (owner is recording now)
- The deployed app has Guide and Share OFF unless Vercel has `VITE_FEATURE_GUIDE=1` and `VITE_FEATURE_SHARE=1` and the Settings toggles are on. Neither feature has been tested on a phone yet; record only what you have actually seen work. Safe to show: samples, line buzz, corners, theremin, voice commands, Ask, Raw Mode, saved diagrams, Hindi/Gujarati.
- If you show Guide or the teacher link flow, run steps 4 and 5 of `docs/OWNER_CHECKLIST.md` first.
- "Find the peak" voice command is merged (frontend). The Ask-by-voice version of the same question depends on g5 (not merged); in the video use the voice command, not Ask.
- Keep the "FAH" meme sound out of the video (licence not free).
- Do not claim TalkBack is verified until the phone test passes.

## Owner to-do (nothing an agent can do): `docs/OWNER_CHECKLIST.md`
Phone test, Hindi/Gujarati native check (new guide/share/semantic phrases are in `docs/user-test/translation-review.*`), remaining `[FILL]` markers, flags decision. Deadlines (IST): feature freeze Nov 13; STEMergent Nov 14 (hard limit Nov 16 09:00); Kiro credits request before Dec 1; Kiroween Dec 5 03:30.
