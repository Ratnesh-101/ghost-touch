# Lane x-kiroprompts: Kiro prompts so Kiro can own spec-first work when its credits return

Documentation only. DO NOT edit `docs/BUILD_LOG.md`. Create your report `docs/reports/agy-x-kiroprompts-report.md` FIRST as a short skeleton and update it as you go. Allowed commands: `git status`, `git diff`. No other commands, no tests.

WHY: the project is entered in Kiroween 2026, where "insufficient use of Kiro" can disqualify the entry. Kiro ran out of credits during Task 13, and all of the Lab redesign (see `docs/briefs/lab-spec.md`, `docs/design/LAB_THEME.md`, `docs/BUILD_LOG.md`) was built by agy lanes with no spec in `.kiro/`. When Kiro's credits return, the owner wants Kiro to do real, spec-first, property-tested work and to review what agents built, so its contribution is genuine and visible. You prepare the copy-paste prompts. You do NOT write the spec yourself (that would be agy pretending to be Kiro): you write the PROMPTS that make Kiro do it.

## Read
`docs/handoffs/kiro-prompts.md` (match its format exactly: each prompt is a numbered heading followed by ONE fenced code block the owner pastes into Kiro chat; it begins "Read #product, #tech, #structure and #review."), `.kiro/steering/*.md`, `.kiro/specs/ghost-touch/requirements.md`, `design.md`, `tasks.md` (note the last requirement, property and task numbers so new ones continue the sequence), `.kiro/hooks/*.json` (the hook format), `docs/design/LAB_THEME.md`, `docs/briefs/lab-spec.md`, `docs/reports/review-lab-final.md`, `docs/reports/audit-*.md`.

## Allowed files
`docs/handoffs/kiro-prompts.md` (APPEND new prompts at the end; do not edit or reorder Prompts 1 to 3, but you MAY update the "Current state" paragraph near the top if its numbers are stale: frontend 1049 tests and 348 backend tests passing on 2026-11-06), `docs/reports/agy-x-kiroprompts-report.md`.

## Forbidden
`.kiro/**` (never edit it), any code or test, other docs.

## Do: append these prompts (each specific, referencing requirement, property and task numbers, files and commands, like the existing ones)
- Prompt 4, "Requirement for the Lab theme, spec-first, retroactive and honest": Kiro writes EARS acceptance criteria in `requirements.md` for the theme (contrast, 48x48 targets, fonts self-hosted and precached, reduced motion, the alive animation at most 1.2 s and 3 flashes per second, no decorative texture inside the Explore canvas, every string translated, brand assets), a design section in `design.md`, tasks in `tasks.md`, and tells Kiro to mark the existing agent-built implementation explicitly as "implemented by Antigravity, verified by Kiro" rather than claiming it, and to write the new correctness properties as fast-check tests: one for the alive animation's declared durations and frequency (parse `explore.css`), one that every `@import` precedes all rules and every referenced CSS file exists (the bug that dropped the Explore frame styles), one that every colour in the screen CSS comes from a token. Kiro owns those property tests.
- Prompt 5, "Kiro reviews the agent-built redesign against the steering docs": a read-only review of the Lab redesign diffs for risks to the tuned haptic values, the TalkBack relative-cursor behaviour, the pure-core rule and the accessibility requirements; output a findings file under `docs/kiro-evidence/` and update `docs/kiro-evidence` notes; no code edits without a spec change.
- Prompt 6, "New hooks": hooks in the exact JSON format of the existing ones for (a) running the new CSS guard test when any file in `frontend/src/styles/` is saved, (b) running the screen accessibility tests when a file in `frontend/src/screens/` or `frontend/src/components/` is saved, (c) a pre-commit style review hook that reminds the agent to record which tool built what in `docs/BUILD_LOG.md`.
- Prompt 7, "Fix the audit findings spec-first": Kiro turns the highest-severity open findings of `docs/reports/audit-backend.md` (when it exists), `audit-bugs.md` findings 5 and 14 (investigation only so far), and the TalkBack double-announcement question into requirements and tasks, implements the ones that are safe, and leaves the phone-dependent ones as explicit open items for the owner's phone test.
- Each prompt ends with the standing instructions already used in Prompts 1 to 3 (do not change tuned haptic values; run tsc, tests and the build; tick `tasks.md` only for what is really done; log in `docs/BUILD_LOG.md` with tool = Kiro; commit nothing unless asked).
- Add a short "Order and value" note at the end ranking the prompts by how much Kiroween credit they earn per Kiro credit spent (the owner has limited credits).

## Done
The report lists what you appended and the facts you relied on. Never describe agent work as Kiro's. End with **Commit groups**.
