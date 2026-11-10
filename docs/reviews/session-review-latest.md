# Session review (Kiro, T37: delete curves/bars, fc.float check, validator parity): 2026-11-09

**Verdict: SHIP** (committed as `ad0dd9c`, `316a97a`, `88035f9`; the spec landed in `aed5e3d`; nothing pushed)

Kiro-owned files changed this session: `frontend/src/core/correct.ts` (`deletePolyline`, `deleteBar`), `frontend/tests/correct.deleteKinds.prop.test.ts` (new, P62-P65) and `.kiro/specs/ghost-touch/{requirements,design,tasks}.md` (Requirement 21, its design section, P62-P65, task 37, and the 20.5/20.9/20.10 ticks). Not Kiro-owned: the parity fixture, its two tests, `docs/reports/validator-parity.md` and `docs/BUILD_LOG.md`. `backend/app/main.py` also changed in this range, from agy lane p1 (`0da7a82`, image/jpg uploads), not from this session.

1. **Architecture:** pass. The two new functions are pure, immutable and import nothing new; no browser API or React in `frontend/src/core` (the one grep hit is a comment). `Correct.tsx`, `flow/` and the other screens were not touched. Neither validator was changed.
2. **Tuned haptic values:** pass. No diff to `hapticEngine.ts`, `hitTest.ts` or `pitch.ts`.
3. **Properties:** pass. P1-P13 present; no `numRuns` below 200 in any `*.prop.test.ts`. P62-P65 run 250 cases each; 7 mutants killed, each property kills at least one. No `fc.float` left (replaced by agy m2 in `22a64e4`).
4. **TEMP stubs:** pass. None in `frontend/src` or `backend/app`.
5. **tasks.md:** pass. 37 and 37.1-37.3 are ticked and match the commits. 20.5 (core half), 20.9 and 20.10 are ticked with pointers to 37. Task 36 is still unticked, which is correct: the agy lane has not built it.

Gate: frontend `tsc` 0 errors, 136 files, 1884 passed, 0 skipped, build ok; backend 750 passed, `ruff check` and `ruff format --check` clean.

Findings (not blocking this session; each needs an owner decision, see `docs/reports/validator-parity.md`):
- **High:** `validateShareScene` drops `aspect`, so Spec Ghost checks every shared scene at aspect 1 (against Requirement 18.6).
- The share validator accepts a colour-only label (Requirement 3.6), drops a segment named in a fact (F5) and speaks a NaN bar value as 0.
- 20.5's screen half (curve and bar selection and delete on Correct) is still open for an agy lane; design.md lists the controls and 5 i18n keys.
