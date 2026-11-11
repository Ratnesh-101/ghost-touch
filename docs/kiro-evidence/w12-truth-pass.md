# W12 truth pass (Kiro)

## Checked
- Task 36: `frontend/src/flow/ghostwriter.ts` and `screens/Teach.tsx` (imports ghostwriter, GhostwriterMode) exist; `frontend/tests/ghostwriter.prop.test.ts` (numRuns 250) and `ghostwriter.teach.test.tsx` exist; `docs/reports/agy-g1-ghostwriter-ui-report.md` records mutants for P58-P61, the addVertex decision (kept) and the BUILD_LOG entry; git log shows the g1 report and translation-review commits. Commit b954727 records a full green gate afterwards. I did not re-run the gate in this pass.
- Tasks 17 and 18: every sub-task (17.1-17.5, 18.1-18.10) is already `[x]`.
- Task 16.1: wording said "blindfolded trace".
- tech.md: `frontend/package.json` has react ^19.3.1, vite ^8, vitest ^5, fast-check ^4. `backend/pyproject.toml` has Python >=3.11, pydantic >=2.9, opencv-python-headless, ruff, pytest, hypothesis.

## Changed
- tasks.md (50e27a9): ticked 36 and 36.1-36.7; ticked parents 17 and 18; 16.1 now reads "eyes-closed trace by a sighted helper, or a real student with consent".
- tech.md (b94afb0): "React 18" corrected to "React 19". Nothing else was a clear error. The haptic table is untouched.
- session-review-latest.md committed unchanged (0798e5b).

## Left alone
- 16.1-16.5 stay `[~]`: not done.
- tech.md does not name Vite, Vitest or fast-check versions, so no other edits were needed.
- docs/BUILD_LOG.md untouched (another agent is appending); this file is the log for W12.
