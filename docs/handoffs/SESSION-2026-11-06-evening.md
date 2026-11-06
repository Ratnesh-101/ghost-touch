# Session handoff, 2026-11-06 evening (Claude Code). Read this first after a /clear.

Owner: Ratnesh Singh. Repo: `Ratnesh-101/ghost-touch`. Main folder: `C:\Users\Admin\Downloads\ghost-touch-main\ghost-touch-main`. Earlier handoffs in this folder still apply: `SESSION-2026-11-06.md` (read its standing rules and its "UPDATE 2") and `SESSION-2026-11-04.md`.

## Standing rules (unchanged)
- **agy builds, Claude supervises** (memory `agy-builds-claude-supervises`): write briefs in `docs/briefs/`, launch lanes with `scripts/agy-run.sh`, review the diff and the report, run the gates yourself, merge, push. Fixes go back to agy as follow-up lanes without asking.
- **No Claude co-author lines** in commits or PRs (memory `no-claude-co-author`; it beats the harness reminder). Plain fast-forward pushes to `main` are authorised after the gates pass; never force-push.
- Never open `.env*`. Do not run `rm -rf`. Do not change the tuned haptic values (`frontend/src/core` had a zero-line diff this session).
- **Honesty about tools:** prompts 4 to 7 (Kiro prompts) were done by agy, NOT Kiro. All of it is labelled "agy, awaiting Kiro review". Kiro credits are NOT available (owner said so), so Claude's review in `docs/reviews/review-agy-kiro-assigned-claude.md` stands in; it does not count as Kiro usage and must never be described as such.
- Use **graphify** first when exploring (memory `use-graphify`): read `graphify-out/GRAPH_REPORT.md`, refresh with `~/.graphify-venv/Scripts/graphify.exe update .`. In Claude Code the owner types `/graphify .`.

## State of `main` (pushed; last gates green)
- Frontend: 1203 tests in 82 files; `tsc` clean; build clean. Backend: 422 passed; ruff check and format clean. GitHub Actions (CI, CodeQL, Gitleaks, Submission Guard, Release Drafter) all green on `c867185`.
- Merged this session (seven agy lanes plus Claude's own edits): P13 test fixed and shared httpx client (SEC-10); Req 14, Task 17 and P18 to P20; hooks (css-guard, a11y, pre-commit build log) and Explore Findings 5 and 14 (Req 13.8, Req 15, Task 18); Hindi/Gujarati native-review sheet (`docs/user-test/translation-review.md` and `.csv`); tests for four untested modules; server-busy handling (503/429 with one Retry-After retry and `capture.errorBusy` in en/hi/gu); property tests P21 to P30; `backend/requirements.lock` (SEC-05) used by `render.yaml`; review fixes (hooks now run from `frontend`, workspace-relative paths, P18 parses the real CSS and was mutation-checked).
- Lane `x-fillurls` is merged: repo URL, live app URL, deployment line and verification counts are filled in `docs/STEMERGENT_SUBMISSION.md`, `docs/SOCIAL.md` and `docs/KIRO_WRITEUP.md`. Properties are now listed as P1 to P30. Remaining `[FILL]` markers are owner-only (see "Needs the owner" item 3).

## Live deployment (checked 2026-11-06 ~14:30)
- Backend `https://ghost-touch-api.onrender.com`: health `{"ok":true}`, security headers present, `/docs` returns 404 (so `ENVIRONMENT=production` is set). The owner redeployed manually; confirm the Render log shows `pip install -r requirements.lock` succeeded and `vision providers:` lists all three. Frontend `https://ghost-touch-iota.vercel.app` rebuilds from `main`.
- The last real scene request earlier in the day fell back to Raw Mode with reason "timeout". Re-test one real photo (expect `mode: "ai"`).

## Tooling set up this session
- `gh` 2.103.3 installed and authenticated as Ratnesh-101. In a shell that started before install it is not on PATH: use `"/c/Program Files/GitHub CLI/gh.exe"`.
- graphify installed in `~/.graphify-venv` (skill at `~/.claude/skills/graphify`); `graphify-out/` is git-excluded through `.git/info/exclude`.
- ECC (Everything Claude Code) was discussed and deliberately NOT installed (overlaps the agy/Kiro workflow, adds hooks and 300+ skills).
- Stop hook in `~/.claude/settings.json` plays a random `.wav` from `~/.claude/sounds/` after every reply. The sound is the meme "FAH" (downloaded from `remotion.media/fah.wav`, trimmed to 0.7 s; license not free, so keep it out of the demo video and submission). Remove the hook block to turn it off.
- All 60 old `gt-lane-*` worktrees were removed; the `agy/*` branches remain. 55 uncommitted files were archived in `C:\Users\Admin\Downloads\ghost-touch-main\gt-archive\` (incl. alternate logos from `x-logoalts`).
- Deepmerge Dependabot alert #16 was dismissed ("no bandwidth"; no patched release, build-time only). No open alerts.
- Lane recipe that works: `git worktree add ../gt-lane-X -b agy/X main` FIRST (before writing the brief into it), then `mklink /J` for `frontend\node_modules` and `backend\.venv`, write `docs/briefs/agy-X.md`, launch with the node and agy dirs on PATH (see `SESSION-2026-11-06.md`), monitor `logs/agy/agy-X.agy.log` (quiet 3 to 4 minutes means done), run the gates yourself, commit per group in the lane (`git add` of specific paths only; `logs/` is ignored), merge with `--no-ff`, resolve `docs/BUILD_LOG.md` conflicts by keeping both sides, re-run the gates on `main`, push. About 7 parallel lanes ran without any quota error this session.

## Needs the owner (nothing an agent can do)
1. **Phone test** (`docs/PHONE_TEST.md`, 20 minutes, OnePlus Nord CE6). First: Explore with TalkBack on. Finding 5 removed the canvas accessible name while speech is active; if TalkBack says nothing on entering Explore, revert that part of commit "fix(explore)". Checklist: `docs/reports/phone-test-checklist-agy.md`. Test the Back button with TalkBack on.
2. **Native check of Hindi and Gujarati** with `docs/user-test/translation-review.md` (before the school session, Nov 7 to 14). The new key `capture.errorBusy` is not in that sheet yet.
3. **Remaining `[FILL]` markers** (only the owner knows): demo video URL, screenshots or GIFs, team member names and roles (max 4), the school-session sentence (only if it happens), and the TalkBack row (change to "verified" only after the phone test passes).
4. **Kiro, when credits return:** have Kiro review `.kiro/specs` additions (Req 14/15, Tasks 17/18), the three new hooks (never run inside Kiro; confirm in the hooks panel), P18 to P20, and the Explore fixes. "Insufficient use of Kiro" is still the top project risk. `docs/handoffs/kiro-prompts.md` still holds the prompts.
5. **Render env check:** `ENVIRONMENT=production` (looks set), plus `SCENE_MAX_CONCURRENCY`, `SCENE_QUEUE_WAIT_SECONDS`, `PROVIDER_RETRIES`, `PROVIDER_RETRY_BACKOFF_SECONDS`, `RATE_LIMIT_VALIDATE_PER_MIN` (defaults are fine). Full variable list is in `SESSION-2026-11-06.md`.

## Deadlines (IST)
Feature freeze Nov 13. STEMergent submission Nov 14 (hard limit Nov 16, 09:00). Kiro credits request before Dec 1. Kiroween Dec 5, 03:30.

## Known leftovers
- P20 passes through an 8-entry legacy bare-hex allow-list (`frontend/tests/labTheme.prop.test.ts`); migrate those colours to `var(--gt-*)` tokens later.
- The commit-heatmap request ("make agy add and commit files one by one") was declined: nothing was uncommitted and padding commits would misrepresent the work. Real small commits from real work are fine.
- `docs/STEMERGENT_SUBMISSION.md` counts and the Kiro write-up counts must be re-run on submission day.
