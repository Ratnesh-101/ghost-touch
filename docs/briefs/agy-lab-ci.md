# Lane lab-ci: workflows should only cancel superseded runs on pull requests

CONTEXT (verified by the supervisor via the public GitHub API): the latest runs on `main` are all green (Release Drafter, Submission Guard, Gitleaks, CodeQL, CI, nightly Property Tests Soak). Nothing is red. The owner's problem: pushing several commits to `main` back to back cancels the earlier runs because the workflows use `cancel-in-progress: true`, so badges can show "cancelled".

## Allowed files
`.github/workflows/*.yml` and `docs/reports/agy-lab-ci-report.md` only.

## Forbidden
Everything else. Never touch secrets or `.env*`. No git state changes.

## Do
1. List every file in `.github/workflows/` and, for each one, show its `concurrency` block.
2. Change every `cancel-in-progress: true` to `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` so runs are cancelled only when a newer commit lands on the SAME pull request, never on pushes to `main`. Keep the `group:` expressions unchanged. If a workflow has no concurrency block, leave it alone. For schedule-only workflows (the nightly soak) leave them unchanged as well.
3. Do not change anything else: no action versions, no triggers, no steps, no permissions. Keep indentation and quoting style identical to the surrounding file. The expression must be valid GitHub Actions syntax (`${{ ... }}` as an unquoted YAML scalar value is valid).
4. Re-read every file you edited to confirm the YAML is still valid (same indentation, no tabs).
5. Also verify (read only) that every workflow that sets up Node uses Node 22, and that none of them references a secret that is not documented in `docs/BOTS.md`; list anything odd in the report but do NOT change it.

## Done
The report lists each file with the before and after concurrency block. Run NO commands except `git diff` and `git status`. End with **Commit groups** (one commit is fine: `ci: only cancel superseded runs on pull requests`).
