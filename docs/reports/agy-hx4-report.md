# Lane HX4 Report — Antigravity (agy)

## Overview
Lane HX4 focuses on hardening CI/CD pipelines to catch drift between backend and frontend definitions, prevent script injection vulnerabilities, enforce strict workflow permissions, run Playwright E2E tests, automate security dependency audits, and register Hypothesis profiles for CI and soak testing.

## Files Changed

| File | Change Type | Description |
|---|---|---|
| `.github/workflows/ci.yml` | Modified | Pinned Python to `3.11.10`, installed backend dependencies via `requirements.lock` followed by `pytest hypothesis ruff`, keyed pip cache on `requirements.lock`, set 20-minute timeouts on all jobs, added `schema-drift` validation job, and added `e2e` Playwright test job with artifact upload on failure. |
| `.github/workflows/audit.yml` | Created | Added weekly/push/dispatch dependency audit workflow running `pip-audit` against `backend/requirements.lock` and `npm audit --omit=dev --audit-level=high` in `frontend` with `contents: read` permissions. |
| `.github/workflows/pbt-soak.yml` | Modified | Moved workflow inputs into `env` (`ITERS`, `HYPOTHESIS_PROFILE`), added bash `case` statement validation to ensure `ITERS` contains digits only, defaulted `HYPOTHESIS_PROFILE` to `"soak"`, exported `FC_RUNS_MULT=10` in the frontend soak job, and added job timeouts. |
| `.github/workflows/release-drafter.yml` | Modified | Set top-level permissions to `contents: read`, granted `contents: write` and `pull-requests: write` exclusively to the job, and restricted job execution to `github.event_name == 'push'`. |
| `.github/workflows/labeler.yml` | Modified | Added security warning comment: `# pull_request_target: never add a checkout of the PR head to this workflow`. |
| `.github/workflows/a11y.yml` | Modified | Added explicit comment documenting that the workflow is report-only and non-blocking (`continue-on-error: true`). |
| `backend/tests/conftest.py` | Modified | Registered Hypothesis profiles `"ci"` (`print_blob=True`) and `"soak"` (`max_examples=1000, deadline=None`), loading the profile specified by `HYPOTHESIS_PROFILE` when present. |
| `backend/tests/test_hx4_schema_contract.py` | Created | Added contract tests validating that `frontend/src/types/scene.gen.ts` matches `DiagramScene.model_json_schema()` (top-level and `$defs` properties) and includes all 4 `kind` literals (`"geometry"`, `"function_graph"`, `"bar_chart"`, `"unknown"`), skipping gracefully if the generated file is missing. |

## Tests Added
- `backend/tests/test_hx4_schema_contract.py`:
  - `test_hx4_schema_contract_top_level_properties`: Verifies that every top-level property declared in `DiagramScene.model_json_schema()` appears in the TypeScript `DiagramScene` interface in `frontend/src/types/scene.gen.ts`.
  - `test_hx4_schema_contract_defs_models_properties`: Verifies that every property across all `$defs` sub-models (`Axes`, `Bar`, `Point`, `Polyline`, `Segment`) is present in the corresponding TypeScript interface.
  - `test_hx4_schema_contract_kind_literals`: Verifies that all 4 kind enum literals (`"geometry"`, `"function_graph"`, `"bar_chart"`, `"unknown"`) are declared in `scene.gen.ts`.
  - Included skip logic with clear diagnostic message if `scene.gen.ts` is absent.

## What Could Not Be Verified
- Per the headless run rules for lane HX ("Do NOT run any shell command. No npm, npx, python, pytest, ruff, git, curl. The orchestrator runs all gates"), no shell commands were executed in this environment.
- Local execution of `pytest`, `ruff check`, `npm test`, `git diff`, and GitHub Actions workflow runners could not be executed directly and will be verified by the orchestrator CI gates.
- All YAML syntax, shell scripts, Python syntax, and import sorting were verified via careful static inspection.
