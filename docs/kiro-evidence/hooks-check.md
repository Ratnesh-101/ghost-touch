# Kiro Agent Hooks Check

Static inspection of `.kiro/hooks/*.json` conducted on 2026-11-04 by Antigravity (headless agent run).

> [!IMPORTANT]
> **Kiro IDE Verification Required**: As a headless CLI agent, I cannot confirm whether these hooks appear in Kiro's graphical Hooks panel or whether they fire upon file save events. Verifying panel visibility and live firing requires running the Kiro IDE desktop environment. The repository owner must open the project in Kiro, verify the hooks panel, test save events, and attach a screenshot or log excerpt to `docs/kiro-evidence/`.

---

## 1. Regenerate scene types

- **Configuration file**: `.kiro/hooks/regenerate-scene-types.json`
- **Name**: `Regenerate scene types`
- **Trigger**: `PostFileSave`
- **Matcher regex**: `backend[\\/]app[\\/]schema\.py$`
- **Action type**: `agent`
- **Prompt**:
  > `backend/app/schema.py changed. In the backend folder, using the .venv Python, run `python -m app.export_schema`. Then in the frontend folder run `npm run gen:types`. Report whether frontend/src/types/scene.gen.ts changed, and flag any frontend code that no longer type-checks (run `npx tsc --noEmit` in frontend).`
- **Enabled**: `true`
- **Matcher verification**:
  - Matches cross-platform path separators (`/` or `\`).
  - **Example matching repo path**: `backend/app/schema.py` (real file present in repository).

---

## 2. Review builder handoff

- **Configuration file**: `.kiro/hooks/review-builder-handoff.json`
- **Name**: `Review builder handoff`
- **Trigger**: `PostFileSave`
- **Matcher regex**: `docs[\\/]handoffs[\\/].*-report\.md$`
- **Action type**: `agent`
- **Prompt**:
  > `A builder handoff report was just saved. Follow the review protocol in #review exactly. Read the matching brief in docs/briefs/, the report, and every file the report lists. Re-run the Definition of Done commands where possible instead of trusting the report. Write the result to docs/reviews/<TNN>-review.md, using the same TNN as the report. Do not edit any code during the review.`
- **Enabled**: `true`
- **Matcher verification**:
  - Matches cross-platform path separators (`/` or `\`) and wildcard report filenames.
  - **Example matching repo paths**: `docs/handoffs/T07-report.md`, `docs/handoffs/T05-report.md`, `docs/handoffs/T08-report.md` (real files present in repository).

---

## 3. Run tests on core save

- **Configuration file**: `.kiro/hooks/run-tests-on-core-save.json`
- **Name**: `Run tests on core save`
- **Trigger**: `PostFileSave`
- **Matcher regex**: `frontend[\\/]src[\\/]core[\\/].*\.ts$`
- **Action type**: `command`
- **Command**: `npm --prefix frontend test`
- **Timeout**: `120` seconds
- **Enabled**: `true`
- **Matcher verification**:
  - Matches cross-platform path separators (`/` or `\`) for any TypeScript file directly in `frontend/src/core/`.
  - **Example matching repo paths**: `frontend/src/core/hitTest.ts`, `frontend/src/core/geometry.ts`, `frontend/src/core/hapticEngine.ts`, `frontend/src/core/pitch.ts` (real files present in repository).

---

## Summary Matrix

| Hook Name | Trigger | Matcher Regex | Action Type | Action Target / Command | Matches Real Repo Path | Verified in IDE |
|---|---|---|---|---|---|---|
| `Regenerate scene types` | `PostFileSave` | `backend[\\/]app[\\/]schema\.py$` | `agent` | Prompt (export schema + gen:types + tsc) | `backend/app/schema.py` | Needs Owner (Kiro IDE) |
| `Review builder handoff` | `PostFileSave` | `docs[\\/]handoffs[\\/].*-report\.md$` | `agent` | Prompt (protocol in #review -> docs/reviews/) | `docs/handoffs/T07-report.md` | Needs Owner (Kiro IDE) |
| `Run tests on core save` | `PostFileSave` | `frontend[\\/]src[\\/]core[\\/].*\.ts$` | `command` | `npm --prefix frontend test` (timeout 120s) | `frontend/src/core/hitTest.ts` | Needs Owner (Kiro IDE) |
