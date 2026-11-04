# Lane C — Repo Bots (T11) Report

**Builder**: Antigravity (`agy`)  
**Date**: 2026-11-03  
**Status**: Complete  
**Scope**: Configuration and documentation only (no application or test code modified).

---

## 1. What was built

1. **CodeQL Workflow** (`.github/workflows/codeql.yml`):
   - Scans both `javascript-typescript` and `python`.
   - Triggers on pushes to `main`, PRs targeting `main`, and scheduled weekly runs (Mondays at 06:30 UTC).
   - Enforces least-privilege permissions (`actions: read`, `contents: read`, `security-events: write`).
   - Pinning: `actions/checkout@v4`, `github/codeql-action/init@v3`, `github/codeql-action/analyze@v3`.

2. **Dependency Review Workflow** (`.github/workflows/dependency-review.yml`):
   - Executes `actions/dependency-review-action@v4` on PRs targeting `main`.
   - Blocks vulnerable dependency introductions and incompatible licenses.
   - Read-only contents permission (`contents: read`).

3. **Secret Scanning Workflow** (`.github/workflows/gitleaks.yml`):
   - Runs `gitleaks/gitleaks-action@v2` with `fetch-depth: 0` to scan commit histories on push and PRs.
   - Enforces strict secret protection for public repository status; no secrets needed.

4. **Accessibility Audit Workflow** (`.github/workflows/a11y.yml`):
   - Node 20 LTS environment matching `ci.yml`.
   - Builds frontend production bundle (`npm ci && npm run build`).
   - Runs Lighthouse CI / Axe (`@lhci/cli collect --staticDistDir=frontend/dist`) against built preview with headless flags (`--no-sandbox --headless`).
   - Marked non-blocking (`continue-on-error: true`).
   - Uploads report bundle as an artifact (`actions/upload-artifact@v4`) under `a11y-report` with 14-day retention.

5. **Property-Based Testing Soak Workflow** (`.github/workflows/pbt-soak.yml`):
   - Triggers nightly at 02:00 UTC and on manual dispatch (`workflow_dispatch`).
   - Runs existing frontend test suite repeatedly (`npm test` in a configurable loop, default 10 iterations).
   - Runs existing backend test suite with Hypothesis soak (evaluates `HYPOTHESIS_PROFILE` if supplied, else plain `pytest`, default 5 iterations).
   - Strictly read-only (`contents: read`); does not write or edit any test files.

6. **Kiroween Submission Guard Workflow** (`.github/workflows/submission-guard.yml`):
   - Triggers on push and PR to `main`.
   - Validates that `.kiro/` directory exists and is populated in the tree.
   - Validates that `.gitignore` does not ignore `.kiro/` (via `git check-ignore` and pattern matching).
   - Validates that root `LICENSE` file exists.

7. **PR & Issue Automation**:
   - **Labeler**: `.github/workflows/labeler.yml` + `.github/labeler.yml` (`actions/labeler@v5`) categorizing `frontend`, `backend`, `docs`, `ci`, `specs`, `scripts`, `prototypes`.
   - **Release Drafter**: `.github/workflows/release-drafter.yml` + `.github/release-drafter.yml` (`release-drafter/release-drafter@v6`) with categorization for features, fixes, accessibility, maintenance, and docs.
   - **Dependabot**: `.github/dependabot.yml` configured for weekly scans of `npm` (`/frontend`), `pip` (`/backend`), and `github-actions` (`/`).
   - **CODEOWNERS**: `.github/CODEOWNERS` declaring `@Ratnesh-101` as owner, with explicit path listings for Kiro-owned directories and test patterns (`frontend/src/core/`, `*.prop.test.ts`, `backend/app/schema.py`, `backend/app/validate.py`, `.kiro/`).
   - **PR Template**: `.github/pull_request_template.md` featuring mandatory "AI tools used" checkbox list (`Kiro`, `Antigravity`, `Claude Code`, `Gemini`), accessibility checklist (48×48px targets, spoken states, i18n), and verification commands.
   - **Issue Templates**: `.github/ISSUE_TEMPLATE/bug_report.md` (with TalkBack and tactile impact sections) and `.github/ISSUE_TEMPLATE/feature_request.md`.

8. **Bot Reference Documentation** (`docs/BOTS.md`):
   - Table detailing bot names, configuration files, triggers, blocking status, and step-by-step remediation procedures when checks fail.

9. **README Badges** (`README.md`):
   - Added workflow status badges for CI, CodeQL, and Gitleaks directly beneath the title header.

---

## 2. Files Touched

### Created
- `.github/workflows/codeql.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/gitleaks.yml`
- `.github/workflows/a11y.yml`
- `.github/workflows/pbt-soak.yml`
- `.github/workflows/submission-guard.yml`
- `.github/workflows/labeler.yml`
- `.github/workflows/release-drafter.yml`
- `.github/labeler.yml`
- `.github/release-drafter.yml`
- `.github/dependabot.yml`
- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `docs/BOTS.md`
- `docs/reports/agy-bots-report.md`

### Modified
- `README.md` (added badges lines only; no other lines changed)

---

## 3. Definition of Done & Verification Results

All allowable verification commands were executed:

```powershell
backend/.venv/Scripts/python -m pytest backend
# Output: 269 passed, 1 skipped, 1 warning in 35.39s
# Status: EXIT 0

backend/.venv/Scripts/python -m ruff check backend
# Output: All checks passed!
# Status: EXIT 0

backend/.venv/Scripts/python -m ruff format --check backend
# Output: 49 files already formatted
# Status: EXIT 0

npm --prefix frontend test
# Output: CommandNotFoundException (npm is not installed on host Windows system per docs/BUILD_LOG.md line 234)
# Status: EXIT 1 (host tool missing; CI workflow runs in ubuntu-latest with setup-node@v4)

git diff --stat
# Output:
#  README.md | 4 ++++
#  1 file changed, 4 insertions(+)
# Status: EXIT 0
```

---

## 4. Forbidden Checks & Ownership Compliance

- **No Kiro-owned files edited**: `frontend/src/core/**`, `*.prop.test.ts`, `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts`, `.kiro/**` remained untouched.
- **No forbidden commands run**: No `git add`, `git commit`, `git push`, or network install commands were executed.
- **No secrets exposed**: No `.env` files were read, displayed, created, or committed.

---

## 5. Needs from Kiro / Owner

None. All bot configurations and documentation items required by the Lane C brief are fully built and consistent.
