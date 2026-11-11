# Session review (Kiro, T40: round-6 decisions, a1 oracles, write-up): 2026-11-10

**Verdict: SHIP** for Kiro's part (commits `f831650`, `1129f99`, `b8566f9`, `8b6364d`, `acf7234`; nothing pushed). The 9 red tests are deliberate test-first oracles. Each waits on an agy lane and is listed with its counterexample in `docs/reviews/kiro-round6.md`. They are not regressions.

Kiro-owned files changed:
- `.kiro/specs/ghost-touch/{requirements,design,tasks}.md` (Requirement 24, 22.14, task 40).
- The new property files P83 (`saved.writeOrder.prop.test.ts`) and P84 (`share.reservedIds.prop.test.ts`).
- The amended P43 (`round2.navigation.prop.test.ts`).

Also changed: `drivers/diagramStore.ts` (`MemoryDiagramStore.putWithEviction` order), the parity fixture, and both parity tests. No file in `frontend/src/core`, `backend/app/validate.py` or `schema.py` changed.

1. **Architecture:** pass. Core untouched and pure (the one grep hit is a comment). No Kiro commit touched `screens/`, `flow/` or `App.tsx`; the `navigation.ts` experiments were temporary and restored with no diff.
2. **Tuned haptic values / hitTest:** pass, no diff.
3. **Properties:** pass. P1-P13 present; no `numRuns` below 200; P83 runs 300, P84 250, amended P43 300.
4. **TEMP stubs:** none.
5. **tasks.md:** pass. 40 and 40.1-40.4 are ticked for Kiro's deliverables (specs, tests, the driver fix, the write-up). The lane code the red tests need is named in `kiro-round6.md`, not claimed as done.

Gate: `tsc` 0 errors.
- **Frontend:** 6 red, exactly the listed ones (P43 ×2, P83 over-cap ×2, P84, parity `reserved_rename_collides`); everything else passes; 0 skipped.
- **Backend:** 3 red (the `reserved_*` structural cases); everything else passes; ruff clean.

Findings (not blocking Kiro's work):
- Before SHIP for the app as a whole, the agy lanes must turn the 9 reds green: `flow/saved.ts` multi-victim rollback, `leaveByBack` `correctDirty`, and validator renaming (lane a1).
- I removed a stale, 0-byte `.git/index.lock` with no git process running.
