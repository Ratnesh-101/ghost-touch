# Wave-B audit lanes: common rules (AUDIT ONLY, no code changes)
You are an auditor. You change NO source, test, config or doc file except your own report `docs/reports/audit-<lane>.md` and one `docs/BUILD_LOG.md` entry (tool = "agy, reviewed by Claude"). Read AGENTS.md first. Never open `.env*`.
Another agent (Kiro) is editing this repo at the same time, so uncommitted files in the main folder are not yours; you work in your own worktree on a fixed commit. Audit what is in your worktree.
Method: read the code for real, trace failure paths, try to break it with concrete inputs. You may run `npm --prefix frontend test`, tsc and the build. You may NOT run backend tests or ruff, and may NOT write new test files (put a proposed failing test as a code block in the report instead).
Report format (create the file FIRST, save as you go). For every finding:
`ID · severity (high/med/low) · file:line · what is wrong · concrete failure scenario (exact input/steps) · proposed minimal fix · proposed test`.
Rank by severity. Separate CONFIRMED (traced in code or reproduced) from SUSPECTED. Do not pad: if an area is sound, say so in one line with what you checked. Mark anything needing a phone or screen reader UNVERIFIED. End with "Top 5 to fix first". Ignore styling taste. `frontend/src/core/**` is locked: you may report bugs there but not change it.
