# Ghost Touch — Repository Automation & Bots (T11)

This document catalogs every automated GitHub workflow, security bot, and maintenance scanner configured for Ghost Touch.

## Automation Matrix

| Bot / Workflow | Config / Workflow File | Trigger | Blocking? | What to do when it fails |
| :--- | :--- | :--- | :---: | :--- |
| **CI** | `.github/workflows/ci.yml` | Push & PR to `main` | **Yes** | Check which job failed. For frontend, run `npm test`, `npm run build`, and `npx tsc --noEmit`. For backend, run `pytest`, `ruff check .`, and `ruff format --check .`. Fix type errors, test failures, or lint issues before merging. Note: The historical 1x retry workaround for `hitTest.prop.test.ts` (P1) was removed on 2026-11-03 after Kiro fixed the generator separation logic in `pbt-p1-flake.md`. |
| **CodeQL** | `.github/workflows/codeql.yml` | Push & PR to `main`, Weekly schedule (Mon 06:30 UTC) | **Yes** | Navigate to the GitHub "Security" tab → "Code scanning alerts". Review flagged vulnerability locations in JavaScript/TypeScript or Python code (e.g. untrusted inputs, unsafe regex, prototype issues). Fix the vulnerability or dismiss if it is a validated false positive. |
| **Dependency Review** | `.github/workflows/dependency-review.yml` | PR to `main` | **Yes** | Check the PR comments/checks for flagged vulnerable dependencies or license violations in newly introduced npm/pip packages. Bump the package version to a secure release in `frontend/package.json` or `backend/pyproject.toml`, or select an alternative library. |
| **Gitleaks** | `.github/workflows/gitleaks.yml` | Push & PR to `main` | **Yes** | Review the Gitleaks step output to identify the leaked secret/credential and commit hash. **Immediately revoke and rotate the secret**. Remove the secret from Git history (if committed) and ensure API keys are accessed solely via process environment variables, never from `.env` files. |
| **Accessibility Audit (A11y)** | `.github/workflows/a11y.yml` | PR to `main` | **No** (`continue-on-error`) | Download the `a11y-report` artifact from the workflow run. Inspect the Axe / Lighthouse audit scores, contrast ratios, and touch target sizes. Verify that interactive elements have minimum 48×48 CSS px touch targets (`.gt-control`) and proper ARIA labels. |
| **Property Tests Soak** | `.github/workflows/pbt-soak.yml` | Nightly cron (`0 2 * * *`), manual `workflow_dispatch` | **No** (Nightly monitoring) | Check the workflow log for the iteration, seed, and shrunk counterexample from `fast-check` or `Hypothesis`. Replay locally with the seed. If the failure is in a Kiro-owned module (`frontend/src/core/**` or `*.prop.test.ts`), file an evidence report in `docs/kiro-evidence/` for Kiro. |
| **Submission Guard** | `.github/workflows/submission-guard.yml` | Push & PR to `main` | **Yes** | Check which Kiroween gate failed: <br>1. `.kiro/` directory missing or empty: ensure `.kiro/` is committed.<br>2. `.gitignore` ignores `.kiro`: remove the pattern from `.gitignore`.<br>3. `LICENSE` missing: restore the root MIT license file. |
| **PR Labeler** | `.github/workflows/labeler.yml`<br>`.github/labeler.yml` | PR opened, synchronized, reopened | **No** | Verify that `.github/labeler.yml` contains valid glob patterns. Check that the workflow has `pull-requests: write` permission. Re-run the action manually or push an update to the PR branch. |
| **Release Drafter** | `.github/workflows/release-drafter.yml`<br>`.github/release-drafter.yml` | Push to `main`, PR activity | **No** | Inspect draft release notes on GitHub Releases. If the workflow failed, check GitHub Actions permissions (`contents: write`, `pull-requests: write`). Edit the draft release manually via the GitHub Releases page if needed. |
| **Dependabot** | `.github/dependabot.yml` | Weekly schedule | **No** | Check the repository "Settings" → "Code security and analysis" → "Dependabot". If an update fails, check `frontend/package.json` or `backend/pyproject.toml` for syntax errors or mutually conflicting version constraints. |

---

## Best Practices & Policies

1. **Least-Privilege Permissions**: Every workflow declares explicit top-level `permissions:` (e.g. `contents: read`).
2. **Action Pinning**: Third-party GitHub Actions are pinned to major tags (e.g., `actions/checkout@v4`).
3. **Reproducibility**: Environment configurations align with production runtimes (Node 20 LTS, Python 3.11).
4. **Secret Isolation**: Workflows do not require or expose production API keys or tokens; Gitleaks enforces that no `.env` files or credentials enter the commit log.
