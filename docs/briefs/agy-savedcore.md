# Lane T13a: Saved diagrams, core and storage driver (Task 13.2 to 13.5, Requirement 11)

Kiro started Task 13 and its credits ran out mid-way. Its spec is already in `.kiro/specs/ghost-touch/{requirements,design,tasks}.md` (Requirement 11 criteria 11.1 to 11.7, the SavedDiagram data model and DiagramStore driver in design.md, properties P14 and P15, sub-tasks 13.2 to 13.9). Its draft code is already in the tree: `frontend/src/core/savedDiagrams.ts` and `frontend/src/drivers/diagramStore.ts`. Copies of Kiro's drafts and its raw diff are in `docs/kiro-wip/` for reference. Read the spec first. Treat Kiro's drafts as the starting point: review them against the spec, fix what is wrong, finish what is missing.

## Allowed files
- `frontend/src/core/savedDiagrams.ts`, `frontend/src/drivers/diagramStore.ts`
- `frontend/tests/savedDiagrams.test.ts`, `frontend/tests/savedDiagrams.prop.test.ts`, `frontend/tests/drivers.diagramStore.test.ts` (all new)
- `.kiro/specs/ghost-touch/tasks.md` (tick 13.2, 13.3, 13.4, 13.5 only when really done)
- `docs/reports/agy-savedcore-report.md`

## Forbidden
Everything else. In particular do NOT edit `frontend/src/drivers/index.ts`, `App.tsx`, any screen, `i18n`, or any existing test (another lane, `agy/savedui`, wires those in parallel; it compiles against the exported names and signatures of your two files, so do not rename or change exported signatures. If one must change, say exactly what in your report). Never touch the haptic engine or tuned values.

## Do
1. `core/savedDiagrams.ts` stays PURE (no window, document, indexedDB, navigator, crypto globals): `SavedDiagram` type, `savedTitle` (spoken title from the scene: its title, else kind plus the first labelled points), `makeId` (from an injected clock and rng), `chooseEviction`, `capExceeded` (cap 20), `orderForDisplay`, serialise and deserialise. Check each against the spec text; fix bugs.
2. Property tests (fast-check, 200+ runs each) in `tests/savedDiagrams.prop.test.ts`: **P14** `deserialise(serialise(entry))` returns an identical DiagramScene for any valid scene (reuse the scene arbitraries from existing prop tests if they exist, or build a small one); **P15** after any sequence of saves into a store at the cap, the count never exceeds the cap, a pinned entry is never evicted, and the removed entry is always the oldest unpinned one. Add example-based tests for titles, ordering and ids.
3. `drivers/diagramStore.ts`: the `DiagramStore` interface (list, get, put, delete), `IDBDiagramStore` (IndexedDB; every call in try/catch; if IndexedDB is unavailable fall back or report unavailability cleanly without throwing) and `MemoryDiagramStore` for tests. Test `MemoryDiagramStore` thoroughly; test the IDB class against a minimal fake `indexedDB` if feasible, otherwise test its unavailable and error paths.
4. If a property finds a real bug in Kiro's draft or in your code, fix it and say so in the report with the failing example. Do not weaken a property to make it pass.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test`, `npm --prefix frontend run build` pass; report real counts. The report must end with a section **"Commit groups"**: an ordered list of logical commits (a conventional-commit message plus the exact files for each; for example one for the pure core, one for P14, one for P15, one for the driver, one for the driver tests), so the reviewer can commit them separately.

## Shared rules
Read AGENTS.md first. The owner explicitly authorised agents to write code that AGENTS.md normally reserves for Kiro (a core module and property tests) because Kiro's credits ran out; say plainly in your report which parts came from Kiro's draft and which are yours. No git state changes (you cannot run git add, commit or push), no installs, no `.env` access, no new dependencies. Every user-facing string through `t()`; browser APIs only in `frontend/src/drivers/`. node and npm are on your PATH. Run the commands for real and record true results, including failures.
