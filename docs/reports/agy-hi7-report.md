# Antigravity Lane Report: hi7

**Lane:** `hi7`  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-20  
**Status:** Complete  

---

## 1. Summary of Changes

GitHub Actions workflows using `actions/setup-python` with Python 3.11 failed because the default `ubuntu-latest` runner image shifted to Ubuntu 26.04, where prebuilt Python 3.11 binaries (e.g. `3.11.10`) are unavailable.

To restore CI and workflow functionality while keeping all other jobs on `ubuntu-latest`, the runner for every job configuring Python 3.11 was updated from `ubuntu-latest` to `ubuntu-24.04`, accompanied by an explanatory YAML comment (`# ubuntu-latest is 26.04 and has no Python 3.11 build`).

### Jobs Changed:
1. **`.github/workflows/ci.yml`**:
   - `backend` (`Backend (Python 3.11)`): `runs-on: ubuntu-24.04`
   - `schema-drift` (`Schema Drift`): `runs-on: ubuntu-24.04`
   *(Other jobs `frontend` and `e2e` left untouched on `ubuntu-latest`)*
2. **`.github/workflows/audit.yml`**:
   - `audit` (`Dependency Audit`): `runs-on: ubuntu-24.04`
3. **`.github/workflows/pbt-soak.yml`**:
   - `backend-pbt-soak` (`Backend PBT Soak (Python 3.11)`): `runs-on: ubuntu-24.04`
   *(Job `frontend-pbt-soak` left untouched on `ubuntu-latest`)*

`docs/DEPLOY.md` was inspected and contains no reference to the GitHub Actions runner, so it was left unchanged per instructions.

---

## 2. Files Changed

- `.github/workflows/ci.yml`
- `.github/workflows/audit.yml`
- `.github/workflows/pbt-soak.yml`
- `docs/reports/agy-hi7-report.md` (this report)

---

## 3. Tests Added

- No new automated tests were added (configuration-only change to GitHub Actions runner environments).

---

## 4. What Could Not Be Verified

- In accordance with the headless run UX rules for lane `hi7`, no shell commands were run locally (`npm`, `python`, `pytest`, `git`, etc. are disallowed in this lane; all gates are executed by the orchestrator).
- Real GitHub Actions runner execution on Ubuntu 24.04 will be validated when the workflow runs on GitHub.
