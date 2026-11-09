# Lane s1-recount (DOCS ONLY)
Read AGENTS.md first. Never open `.env*`. Edit only the docs listed below plus one `docs/BUILD_LOG.md` entry (tool = "agy, reviewed by Claude") and `docs/reports/agy-s1-recount-report.md` (create it first, Status IN PROGRESS, DONE at the end). No source or test edits.
Task: replace every `[RECOUNT]` marker with the real number in: docs/BLOG.md, docs/KIRO_WRITEUP.md, docs/SOCIAL.md, docs/STEMERGENT_SUBMISSION.md. Do NOT touch handoffs, plans, BUILD_LOG history lines or agy report files (they are history).
Verified numbers as of main on 2026-11-09 (supervisor ran them):
- Frontend: 132 test files, 1828 tests passing, 3 skipped (deliberate, pending a decision).
- Backend: 716 tests passing.
- Total passing: 2544 tests.
- Property-test files: 18 frontend `*.prop.test.*` files and 7 backend files with `prop` in the name.
For "mathematical properties" or "properties verified": count the distinct P-numbered properties (P1, P2, ...) listed in .kiro/specs/ghost-touch/design.md and .kiro/specs/*/design.md, and state the count with the file you counted from. If the numbers cannot be established from the files, leave the marker and say why in the report. Do not write coverage percentages (none were measured): reword such sentences without a number.
Keep each sentence honest: say 3 tests are skipped where the surrounding text claims "all pass". Do not claim hardware verification of TalkBack, Guide my finger or Share. Do not change any [FILL] marker.
