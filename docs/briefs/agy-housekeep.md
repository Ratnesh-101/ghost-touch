# Lane HK: Kiro housekeeping (Prompt 3 in docs/handoffs/kiro-prompts.md), done by an agent at the owner's request

## Allowed files
- `.kiro/specs/ghost-touch/tasks.md` (checkbox state ONLY)
- `.github/workflows/ci.yml`
- `docs/kiro-evidence/pbt-p1-flake.md` (append an "Outcome" section)
- `docs/kiro-evidence/hooks-check.md` (NEW)
- `docs/reports/agy-housekeep-report.md`

## Do
1. **tasks.md:** tick a task or sub-task ONLY if you verify in the code and tests that it is truly complete. For parent task 7, check every sub-task against the code. Parents 10, 13 and 16 are NOT complete: leave them. Do not tick anything you cannot see evidence for. List each tick and its evidence in the report.
2. **P1:** run `npm --prefix frontend test` three times (the only allowed test command) and record the real results. Read `frontend/tests/hitTest.prop.test.ts` and describe the generator fix (minimum screen separation equal to the 22 px vertex radius, plus the tie-rule regression test). Append an "Outcome (2026-11-04)" section to `docs/kiro-evidence/pbt-p1-flake.md`. Cite that Claude Code observed 25 of 25 isolated passes of the P1 file on 2026-11-03; do not repeat that as your own run.
3. **ci.yml:** remove the "retry once" workaround in the frontend test step and the comment that explains it. Keep everything else unchanged. Do this only if all three runs in step 2 passed; otherwise leave it and say why.
4. **Hooks:** read the three files in `.kiro/hooks/*.json` and write `docs/kiro-evidence/hooks-check.md`: for each hook, its name, trigger, matcher regex, and command or prompt, and whether the matcher matches a real file path in the repo (give one example path each). State clearly that you cannot confirm the hooks appear in Kiro's hooks panel or fire, because that needs the Kiro IDE: the owner must do that and add a screenshot.

## Done
`npm --prefix frontend test` passes in three runs, and ci.yml is otherwise unchanged. The report lists the files touched.

## Shared rules
Read AGENTS.md first. The owner explicitly authorised this lane (2026-11-04) to edit files that AGENTS.md normally reserves for Kiro (`.kiro/specs/.../tasks.md`); touch only the files listed here, and say plainly in your report that this is agent work, not Kiro's. No git state changes, no installs, no `.env` access, no new dependencies. Run the commands for real and record true results, including failures.
