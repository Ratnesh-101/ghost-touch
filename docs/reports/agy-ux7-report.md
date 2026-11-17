# Lane ux7 Report: Kiro Write-Up and README Sync

**Lane:** ux7  
**Agent:** Antigravity (agy)  
**Date:** 2026-11-17  
**Gate Baseline Commit:** 8eda0ac (orchestrator gate run on 2026-11-17)

---

## 1. Files Changed

1. `README.md` (the "Built with" table and "Project structure" list only)
2. `docs/KIRO_WRITEUP.md`

*(Forbidden paths `frontend/src/core/**`, `*.prop.test.ts`, `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts`, `.kiro/**`, `.gitignore`, `.env*`, and all `[OWNER]` slots were preserved strictly untouched.)*

---

## 2. Tests Added

**Zero test files added or modified.** Per the UX rules for this lane, no code or test files outside the ALLOWED documentation list were touched. No shell commands were run.

---

## 3. What Could Not Be Verified

- Hardware test execution on physical devices (Samsung Galaxy S24+, OnePlus Nord CE6) could not be executed by this agent directly; documentation honestly notes confirmed vs pending items.
- Live hook execution in the Kiro IDE UI (documented honestly as defined with patterns tested, but live run not yet captured).
- Features P109–P113 are specified in `design.md` but not yet tested (task 56).
- Two known gaps remain pinned in the test suite as an expected failure (`it.fails` in `frontend/tests/explore.wiring.guards.test.tsx` for promotion on corner during Ask) and a todo (`it.todo` in `frontend/tests/share.decodeBound.test.ts` for 2 MB share expansion bound).

---

## 4. Detailed Sentence Changes (Old and New)

### File: `README.md`

1. **Project structure list (`.kiro/agents/` added)**
   - **Old:**
     ```text
     ├── .github/          # CI, CodeQL, Gitleaks workflows, Dependabot config
     ├── .kiro/            # Specs (requirements, design, tasks), steering docs, hooks
     ├── backend/          # FastAPI, multi-provider vision pipeline, OpenCV edge detection, pytest
     ```
   - **New:**
     ```text
     ├── .github/          # CI, CodeQL, Gitleaks workflows, Dependabot config
     ├── .kiro/            # Specs (requirements, design, tasks), steering docs, hooks
     ├── .kiro/agents/     # Allow-listed Kiro CLI agent configs (gt-fixer, gt-writer, gt-reviewer, gt-auditor)
     ├── backend/          # FastAPI, multi-provider vision pipeline, OpenCV edge detection, pytest
     ```

2. **"Built with" table cells shortened to one sentence plus link to write-up**
   - **Old:**
     - Large multi-bullet paragraphs spanning 10–15 lines per tool.
   - **New:**
     ```markdown
     | Tool | Role & Contributions | Evidence / Key Files |
     |---|---|---|
     | **Kiro** (IDE & CLI) | Authored the specification, steering rules, pure core mathematics, and property test suites that governed other agents; see [docs/KIRO_WRITEUP.md](docs/KIRO_WRITEUP.md). | `.kiro/specs/`<br>`.kiro/steering/`<br>`.kiro/hooks/`<br>`frontend/src/core/`<br>`docs/kiro-evidence/` |
     | **Antigravity** (agy) | Built the Frankenstein Laboratory redesign, screens, browser drivers, and backend vision pipeline; see [docs/KIRO_WRITEUP.md](docs/KIRO_WRITEUP.md). | `docs/BUILD_LOG.md`<br>`frontend/src/`<br>`backend/app/`<br>`docs/reports/` |
     | **Claude Code** (Anthropic) | Supervised development lanes, authored briefs, reviewed diffs, and gated integration; see [docs/KIRO_WRITEUP.md](docs/KIRO_WRITEUP.md). | `docs/briefs/`<br>`docs/reviews/`<br>`scripts/agy-run.sh` |
     ```

---

### File: `docs/KIRO_WRITEUP.md`

1. **Reorder opening and replace counts paragraph with numbers block from lane ux6**
   - **Old:**
     ```markdown
     **The unusual story:** Kiro did not build most of the app. Kiro was the *specifier and judge* of other agents. It wrote the requirements, design properties and test-first oracles; faster builders (Antigravity, "agy", supervised by Claude Code) had to turn those tests green. Test counts were last counted on 2026-11-12 (2,231 frontend tests in 181 files, 834 backend tests) and will be re-checked on submission day.
     ```
   - **New:**
     ```markdown
     **The unusual story:** Kiro wrote the specification, every module in `frontend/src/core` and every property test; other agents may not edit those files (`AGENTS.md` rule 1). Kiro did not build most of the screens. Kiro was the *specifier and judge* of other agents. It wrote the requirements, design properties and test-first oracles; faster builders (Antigravity, "agy", supervised by Claude Code) had to turn those tests green.

     On 2026-11-17 (at main 8eda0ac): frontend tests 2,700 passed (plus 1 expected fail and 1 todo) in 213 files; backend tests 908 passed; Playwright 22 passed; requirements 36; properties numbered to P136 (P109 to P113 specified, not yet tested); tasks 66; commits 898, of which 88 carry the kiro: prefix. Two known gaps are pinned in the suite as an expected failure and a todo. P109 to P113 are specified and not yet tested (task 56).
     ```

2. **Basis commit counts synchronized**
   - **Old:**
     ```markdown
     Git authorship does not separate the tools: of 841 commits (2026-11-12), 814 carry the owner's identity and 4 are authored "Kiro". The `kiro:` prefix is the better signal: `git log --oneline | grep -c "kiro:"` gives 69.
     ```
   - **New:**
     ```markdown
     Git authorship does not separate the tools: of 898 commits (2026-11-17), 88 carry the `kiro:` prefix.
     ```

3. **Section 2 specification and test counts updated, tasks 58 to 66 added**
   - **Old:**
     ```markdown
     Counted in `.kiro/specs/ghost-touch/` today: 25 numbered requirements (EARS acceptance criteria), properties numbered P1 to P87 in `design.md` (some numbers cover a group, such as P21-P24), and 42 numbered tasks.
     ...
     Weak point: the P1 "flake" was a bug in the test generator, not the product (`docs/kiro-evidence/pbt-p1-flake.md`), so it is not the lead. Tests: 2,231 frontend in 181 files, 834 backend.
     ```
   - **New:**
     ```markdown
     Counted in `.kiro/specs/ghost-touch/` today: 36 numbered requirements (EARS acceptance criteria), properties numbered to P136 in `design.md` (P109 to P113 specified, not yet tested; task 56), and 66 numbered tasks. Several parent tasks stay open on purpose (deploy, phone tests, submission) because they need the owner or a device.
     ...
     **Tasks 58 to 66 (read from `tasks.md`):**
     - **Task 58:** Sticky line helper in `core/sticky.ts`
     - **Task 59:** Corner heartbeat helper in `core/heartbeat.ts`
     - **Task 60:** Fix flaky P117 coverage gate in `sticky.prop.test.ts` (recorded as `kiro: T60` in BUILD_LOG)
     - **Task 61:** `core/sceneGuard.ts` and its use in `deserialise`
     - **Task 62:** Deterministic coverage, one run-count knob, and a five-run flake census
     - **Task 63:** Measure the worst input that fits `maxHashChars`
     - **Task 64:** Chaos property P132-P136 in `frontend/tests/touch.chaos.prop.test.ts`
     - **Task 65:** Mount the real `Explore` with fake drivers and prove each guard
     - **Task 66:** Restore Requirement 25 in Explore and settle the actions-layout threshold

     Weak point: the P1 "flake" was a bug in the test generator, not the product (`docs/kiro-evidence/pbt-p1-flake.md`), so it is not the lead. Tests: 2,700 frontend passed (plus 1 expected fail and 1 todo) in 213 files, 908 backend.
     ```

4. **Added Section 3: Kiro CLI agents and their allow-lists, keeping `--trust-all-tools` disclosure**
   - **Added:**
     - Disclosure of earlier runs on 2026-11-11 using `--trust-all-tools` before transition to allow-listed configs.
     - Details of `gt-fixer`, `gt-writer`, `gt-reviewer`, and `gt-auditor` and their respective path and shell command allow-lists and deny-lists.

5. **`[OWNER]` slots preserved intact**
   - All four `[OWNER: ...]` placeholders in `docs/KIRO_WRITEUP.md` preserved verbatim.
