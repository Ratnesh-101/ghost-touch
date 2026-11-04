# Lane C — Repo bots (T11), config only

## Goal
Add GitHub automation for Ghost Touch. Config and docs only, no application code.

## Files you may create or edit (only these)
- `.github/workflows/*.yml` (new files; you may extend `ci.yml` but keep every existing step)
- `.github/dependabot.yml`, `.github/CODEOWNERS`, `.github/labeler.yml`, `.github/release-drafter.yml`
- `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/*.md`
- `docs/BOTS.md`, `docs/reports/agy-bots-report.md` (your report, last)
- the "Badges" line(s) at the top of `README.md` (add only; change nothing else)

## Forbidden
Everything else. Especially: `.kiro/**`, `frontend/src/**`, `backend/app/**`, all tests, `*.prop.test.ts`, `test_*_props.py`, `frontend/package*.json`, `backend/pyproject.toml`, any `.env`. If something there needs a change, list it under "Needs from Kiro/owner" in your report.

## What to build
1. `codeql.yml`: CodeQL for javascript-typescript and python (push/PR to main + weekly).
2. `dependency-review.yml`: dependency-review-action on PRs.
3. `gitleaks.yml`: gitleaks scan on push/PR (use the gitleaks-action; no secrets needed for public repos).
4. `a11y.yml`: build the frontend and run axe/Lighthouse CI against the built preview on PRs; non-blocking (continue-on-error) for now; upload the report as an artifact.
5. `pbt-soak.yml`: nightly (cron) + manual; runs the EXISTING property tests many times (`npm test` in frontend repeated, and pytest with a larger Hypothesis profile via env var if one exists, else plain pytest). It must not write or edit tests. Open an issue only on failure is optional.
6. `submission-guard.yml`: fails a PR/push if `.kiro/` is missing from the tree, if `.gitignore` ignores `.kiro`, or if `LICENSE` is missing (Kiroween requirement).
7. `labeler.yml` config + workflow, `release-drafter` config + workflow, `dependabot.yml` (npm in /frontend, pip in /backend, github-actions in /; weekly), `CODEOWNERS` (owner `@Ratnesh-101`; Kiro-owned paths `frontend/src/core/`, property tests, `backend/app/schema.py`, `backend/app/validate.py`, `.kiro/` also list `@Ratnesh-101`), PR and issue templates (bug, feature; PR template has an "AI tools used" checkbox list: Kiro / Antigravity / Claude Code / Gemini).
8. `docs/BOTS.md`: one table: bot, file, trigger, blocking or not, what to do when it fails.
9. README badges: CI, CodeQL, gitleaks (shields.io or workflow badge URLs for `Ratnesh-101/ghost-touch`).

## Rules
- Pin actions to a major tag (e.g. `actions/checkout@v4`). Least-privilege `permissions:` on every workflow. Node 20, Python 3.11 (match `ci.yml`).
- No secrets, tokens or personal contact details anywhere.
- Valid YAML. Do not try to run YAML tools; the reviewer validates.

## Done definition
All files above exist and are consistent; `docs/BOTS.md` lists every workflow; report written at `docs/reports/agy-bots-report.md` listing files touched and anything left undone. You cannot run git commands that change state; do not try.
