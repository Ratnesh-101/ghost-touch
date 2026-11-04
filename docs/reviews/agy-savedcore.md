# Review: lane T13a (saved diagrams core and storage driver), branch agy/savedcore
Reviewer: Claude Code. Builder: Antigravity (agy), finishing a draft by Kiro (Kiro's credits ran out mid-task). Date: 2026-11-04.

**Verdict: APPROVE.** Spec (Requirement 11, P14, P15, tasks 13.x) and first draft are Kiro's; the finished core, the property tests and the fixes below are agent work and must be described that way.

- Scope: `core/savedDiagrams.ts`, `drivers/diagramStore.ts`, three new test files, `tasks.md` ticks 13.2 to 13.5. The seed files `screens/SavedDiagrams.tsx` and `docs/kiro-wip/` in the lane worktree are not part of this lane and were not committed.
- Verified by me in the lane: `tsc` clean, 459 frontend tests pass (41 files), build OK. The core module has no browser APIs. P14 and P15 run 250 cases each and were not weakened.
- Real defects the agent found in Kiro's draft (documented in its report): `applyAdd` evicted an entry when merely updating an existing id at the cap; `deserialise` rejected JSON strings; `IDBDiagramStore` leaked the db connection on transaction errors; a `NaN` `createdAt` was accepted. Good write-up material: tests caught real bugs in a draft.
- Exported signatures are unchanged, so the UI lane (`agy/savedui`) compiles against them.
