# Lane lab-ci, pass 2: finish the concurrency change in the remaining workflows

Pass 1 changed ONLY `.github/workflows/a11y.yml` (`cancel-in-progress: ${{ github.event_name == 'pull_request' }}`) and then stopped without a report. Read `docs/briefs/agy-lab-ci.md` for the full task, then finish it.

## Do
1. Apply the SAME one-line change (`cancel-in-progress: true` becomes `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`) in every remaining workflow that has it: `ci.yml`, `codeql.yml`, `dependency-review.yml`, `gitleaks.yml`, `labeler.yml`, `release-drafter.yml`, `submission-guard.yml`. For `pbt-soak.yml` (the nightly soak): open it first; if it triggers on `schedule` and `workflow_dispatch` only, leave it unchanged; if it also triggers on `push` or `pull_request`, apply the same change. State which in the report.
2. Edit nothing else in those files (no versions, triggers, steps, permissions). Keep the exact indentation and the `group:` lines.
3. Re-read each edited file to confirm the YAML is valid.
4. `grep`-style check with the file tools: list the final `concurrency` block of all nine files in the report (before and after for each).
5. Read-only observations (do NOT change): any workflow not on Node 22, any secret not documented in `docs/BOTS.md`.
6. Write `docs/reports/agy-lab-ci-report.md`. Run only `git diff` and `git status`. End with **Commit groups** (one commit: `ci: only cancel superseded runs on pull requests`, listing all files changed).
