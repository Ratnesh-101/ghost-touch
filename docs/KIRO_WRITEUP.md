# Ghost Touch: how Kiro was used

This is an honest account of Kiro's part in Ghost Touch. The longer earlier draft is kept as an appendix: `docs/kiro-evidence/KIRO_WRITEUP_LONG.md`.

**The unusual story:** Kiro wrote the specification, every module in `frontend/src/core` and every property test; other agents may not edit those files (`AGENTS.md` rule 1). Kiro did not build most of the screens. Kiro was the *specifier and judge* of other agents. It wrote the requirements, design properties and test-first oracles; faster builders (Antigravity, "agy", supervised by Claude Code) had to turn those tests green.

On 2026-11-17 (at main 8eda0ac): frontend tests 2,700 passed (plus 1 expected fail and 1 todo) in 213 files; backend tests 908 passed; Playwright 22 passed; requirements 36; properties numbered to P136 (P109 to P113 specified, not yet tested); tasks 66; commits 898, of which 88 carry the kiro: prefix. Two known gaps are pinned in the suite as an expected failure and a todo. P109 to P113 are specified and not yet tested (task 56).

| Area | Kiro | Antigravity (agy) | Claude Code |
|---|---|---|---|
| Specs | requirements, design, tasks in `.kiro/specs/ghost-touch/` | marked sections "awaiting Kiro review" (Req 14, 15) | briefs, plans |
| Pure core | haptic engine, geometry, hit test, pitch, validator, Ghostwriter and delete edits | saved-diagram core and tests (P14/P15), Teacher Correct, Spec Ghost module (P47-P50) | backend properties P40-P42, P45-P46 |
| App and backend | round-2 backend fixes, Explore canvas fix | Lab redesign, screens, drivers, vision providers, Raw Mode, Ask, Ghostwriter UI | supervision, gating, reviews |

Basis: `docs/BUILD_LOG.md` (each entry names its tool), `docs/reviews/`, `git log`. Git authorship does not separate the tools: of 898 commits (2026-11-17), 88 carry the `kiro:` prefix. The Lab redesign, most screens and the backend vision pipeline were **not** built by Kiro; BUILD_LOG says agents took over when Kiro's credits ran out (2026-11-04).

## 1. Vibe coding

The first haptics spike (`prototypes/haptics-test.html`) was tuned by hand on the owner's phone before any spec existed; its values became the `tech.md` table. [OWNER: describe any Kiro chat sessions that were not spec-driven, what you asked, and how they compared with spec-driven work. I cannot verify these from the repo, so none are claimed.]

The best bug stories started as loose reports and became a requirement and a property before any code changed.

**A. A failed save could lose an older saved diagram (P83).** Requirement 22.14, task 40.2, commit `b8566f9`, `frontend/tests/saved.writeOrder.prop.test.ts` (300 runs). An audit claimed "the delete succeeds, then the put fails". Kiro could not reproduce that: both paths put before they delete. The property, with one injected failure at any call, found a different real loss. BUILD_LOG counterexample: cap 2, store `d0`-`d3`, update `d0`, third call fails; `put d0` ok, `delete d1` ok, `delete d2` fails, rollback removes only the new entry, and `d1` is gone while the save reports failure. Kiro fixed `MemoryDiagramStore.putWithEviction` (delete the victim first, never evict the entry being saved). The multi-victim fallback in `flow/saved.ts` went to an agy lane; two P83 tests stayed red until it merged.

**B. The canvas that grew on a Galaxy S24+ (Requirement 25).** The owner filmed the installed app: after the first double-tap-and-hold the canvas grew for about 7 s and pushed Ask, Correct and Back off screen. Spec first: Requirement 25, P86 (canvas size derived from the container is stable under any interaction sequence, 300 runs), P87 (layout rules declared in both stylesheets), task 42. Commits `c25a5cf` (code and tests) and `80f5bed` (BUILD_LOG). Root cause was found by reading the code, not reproducing it: the canvas bitmap fed back into layout (the canvas was measured and observed itself, and the bitmap reset on every pointer down), and the status lines had only `min-height` (`docs/kiro-evidence/canvas-resize-bug.md`). P86 was mutation-checked: a deliberately wrong comparison failed 2 of 5 tests.
What the tests show: jsdom does no layout, so unit tests model the rule, not the browser. An agy lane added a Playwright test (`frontend/e2e/explore.canvas-stable.spec.ts`, S24 and S24+ emulation); 10 tests passed in a Claude Code run on 2026-11-11. Plainly: it separated the pre-fix build from the post-fix build only in the viewport-resize scenario. The plain hold-and-drag tests pass on both builds, because desktop Chromium did not reproduce the growth. The owner confirmed on the phone that it is fixed. [OWNER: attach the video or a note to `docs/kiro-evidence/`; the repo does not record it.]

**C. Four defects in Kiro's own draft (P14, P15).** Kiro specified P14/P15 and drafted the saved-diagram core before credits ran out. Antigravity finished it, and its tests found four defects (BUILD_LOG 2026-11-04; `docs/reviews/agy-savedcore.md`): `applyAdd` evicted an entry when merely updating an existing id at the cap; `deserialise` rejected JSON strings; `IDBDiagramStore` leaked its database connection on transaction errors; a `NaN` `createdAt` was accepted. Those tests are agy's, not Kiro's.

## 2. Specs

Counted in `.kiro/specs/ghost-touch/` today: 36 numbered requirements (EARS acceptance criteria), properties numbered to P136 in `design.md` (P109 to P113 specified, not yet tested; task 56), and 66 numbered tasks. Several parent tasks stay open on purpose (deploy, phone tests, submission) because they need the owner or a device.

Later requirements (19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36) say they were written before the code. Requirement 18 (Spec Ghost) says in its first lines that it was written *after* the code.

**Kiro as judge.** P66-P78 (Requirement 22) were written as test-first oracles for round-5 audit findings. The first run is in `docs/reviews/kiro-round5.md`: 13 properties, 6 failed and 7 passed, because most fixes had already merged, so the failures were gaps those fixes left. After agy fixes all 13 passed (task 39.0). Round 6 repeated the pattern: P83, P84 and an amended P43 waited red for their lanes. `AGENTS.md` rule 1 stops agent lanes editing Kiro's property tests, so a builder cannot go green by weakening a test.

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

## 3. Kiro CLI agents

Disclosure: three earlier Kiro CLI runs on 2026-11-11 (worktree audit, K1 BUILD_LOG recovery, K2 truth pass) used `--trust-all-tools`; from the S24+ canvas job on, every Kiro CLI run used an allow-listed agent config (`.kiro/agents/gt-fixer.json`, `gt-writer.json`, `gt-reviewer.json`, `gt-auditor.json`).

The four Kiro CLI agents and their allow-lists:

1. **`gt-fixer` (`.kiro/agents/gt-fixer.json`):** Spec-first bug fixer with property tests.
   - **Allowed write paths:** `frontend/src/**`, `frontend/tests/**`, `frontend/e2e/**`, `.kiro/specs/**`, `docs/kiro-evidence/**`, `docs/BUILD_LOG.md`.
   - **Allowed shell commands:** `npx tsc --noEmit`, `npx vitest run( .*)?`, `npm run build`, `npx playwright test( .*)?`, `git status( .*)?`, `git diff( .*)?`, `git add( .*)?`, `git commit( .*)?`.
   - **Denied:** `**/.env*`, `git push`, `git reset`, `git clean`, `git checkout`, `git stash`, `rm`, `del`.

2. **`gt-writer` (`.kiro/agents/gt-writer.json`):** Ghost Touch write-up author for `docs/KIRO_WRITEUP.md` (read-only on code).
   - **Allowed write paths:** `docs/KIRO_WRITEUP.md`, `docs/kiro-evidence/**`, `docs/BUILD_LOG.md`.
   - **Allowed shell commands:** `git status( .*)?`, `git diff( .*)?`, `git log( .*)?`, `git show( .*)?`, `git add( .*)?`, `git commit( .*)?`.
   - **Denied:** `**/.env*`, `git push`, `git reset`, `git clean`, `git checkout`, `git stash`, `rm`, `del`.

3. **`gt-reviewer` (`.kiro/agents/gt-reviewer.json`):** Read-only PR reviewer.
   - **Allowed write paths:** Temporary scratchpad directory only (`.../scratchpad/**`).
   - **Allowed shell commands:** `gh pr view( .*)?`, `gh pr diff( .*)?`, `gh pr checks( .*)?`, `gh pr list( .*)?`, `git status( .*)?`, `git diff( .*)?`, `git log( .*)?`, `git show( .*)?`.
   - **Denied:** GitHub PR mutations (`gh pr merge/comment/review/close`), `git push`, `git add`, `git commit`, `git reset`, `git clean`, `git checkout`, `git stash`, `rm`, `del`, `**/.env*`.

4. **`gt-auditor` (`.kiro/agents/gt-auditor.json`):** Read-only code auditor reporting real defects with concrete reproduction scenarios.
   - **Allowed write paths:** Temporary scratchpad directory only (`.../scratchpad/**`).
   - **Allowed shell commands:** `npx tsc --noEmit`, `npx vitest run( .*)?`, `git status( .*)?`, `git diff( .*)?`, `git log( .*)?`, `git show( .*)?`, `backend/.venv/Scripts/python.exe -m pytest( .*)?`, `cd backend && .venv/Scripts/python.exe -m pytest( .*)?`.
   - **Denied:** `git push`, `git add`, `git commit`, `git reset`, `git clean`, `git checkout`, `git stash`, `rm`, `del`, `**/.env*`.

## 4. Agent hooks

`.kiro/hooks/` holds 9 files: `a11y-on-save`, `css-guard-on-save`, `pre-commit-build-log`, `prop-tests-on-save`, `regenerate-scene-types`, `review-builder-handoff`, `review-on-stop`, `run-tests-on-core-save`, `verify-tests-on-save`. Five run checks on save; four ask the agent to review or regenerate.

Authorship is mixed: one commit authored "Kiro" added review and prop-test hooks (`390d3ce`), Kiro added the verify hook in task 29 (`5c2cd29`), and agy added three (tasks.md 18.3). [OWNER: confirm per-hook authorship if you want a number; none is claimed.]

**The hooks are defined and their patterns are checked by tests, but a recorded run is not yet captured.** `docs/kiro-evidence/hooks-check.md` says no firing was observed. [OWNER: a screenshot of the Kiro hooks panel and one hook firing, saved to `docs/kiro-evidence/`.]

## 5. Steering

`.kiro/steering/` has five files: `product.md`, `tech.md`, `structure.md`, `review.md` (manual) and `verify.md` (file match). The most useful is `tech.md`: it fixes the tuned haptic table (line 80 ms retriggered every 70 ms, corner `[50, 90, 50]` with a 450 ms quiet window, hit radii 22 and 14 px) and the pure-core rule (no browser APIs in `frontend/src/core/`). Reviews checked agent diffs against those rules. I cannot point to a recorded case where a steering file changed Kiro's output, so I do not claim one.

## 6. MCP

**No MCP server exists in this repo yet**, and there is no MCP configuration under `.kiro/settings/`. A small stdio server is planned (win-plan item W15): `validate_scene` wrapping `backend/app/validate.py` and `raw_outline` wrapping `backend/app/raw_mode.py`, to be used for real once and recorded. Until then this heading has nothing to show.

No student has used the app, and the full app has had no recorded phone test beyond the canvas confirmation above.
