# Lane T13b: Saved diagrams, wiring and UI (Task 13.6 to 13.9, Requirement 11)

Kiro started Task 13 and its credits ran out mid-way. Spec: `.kiro/specs/ghost-touch/{requirements,design,tasks}.md` (Requirement 11, the SavedDiagram model and DiagramStore, sub-tasks 13.6 to 13.9). Kiro's draft files are in the tree: `frontend/src/core/savedDiagrams.ts`, `frontend/src/drivers/diagramStore.ts`, `frontend/src/screens/SavedDiagrams.tsx`. Kiro also made uncommitted edits to `App.tsx`, `drivers/index.ts`, `i18n/index.ts`, `screens/Capture.tsx` and six test files, but against an OLD base. That diff is in `docs/kiro-wip/kiro-t13-wip.patch`: use it as a reference only and re-apply the ideas by hand onto the CURRENT files (which now contain the voice lane, the Correct mode and the accessibility lane). Do not try to apply the patch mechanically.

Another lane (`agy/savedcore`) is finishing `core/savedDiagrams.ts` and `drivers/diagramStore.ts` in parallel. Compile against their exported names and signatures; do not edit those two files.

## Allowed files
- `frontend/src/screens/SavedDiagrams.tsx`, `frontend/src/screens/Capture.tsx`, `frontend/src/App.tsx`
- `frontend/src/drivers/index.ts` (add `diagramStore` to the `Drivers` interface and `createBrowserDrivers`; export what is needed)
- `frontend/src/i18n/index.ts` (add `saved.*` and any new `capture.*` keys to the en, hi AND gu tables; the parity test must pass)
- `frontend/src/styles/saved.css` (new; do not edit global.css or correct.css)
- every existing test file that builds a fake `Drivers` object (add `diagramStore: new MemoryDiagramStore()`), plus `frontend/tests/screens.render.test.ts` and `tests/polish.test.ts` for the new Capture prop, plus new `frontend/tests/saved.*.test.ts`
- `.kiro/specs/ghost-touch/tasks.md` (tick 13.6 to 13.9 only when really done)
- `docs/reports/agy-savedui-report.md`

## Forbidden
`core/**`, `drivers/diagramStore.ts`, property tests, backend, the Explore screen and its gestures, the haptic engine, tuned values.

## Do
1. `Drivers` gets `diagramStore` (a `DiagramStore`). Every fake `Drivers` in tests gets a `MemoryDiagramStore` so tsc stays clean.
2. App: after every successful scene load (photo, upload, PDF; NOT the built-in samples, which are already offline), save it: generate a small thumbnail (canvas toDataURL in a driver or the screen layer, never in core), a spoken title via `savedTitle`, then `diagramStore.put`. A failed save must never block exploring: say so by voice and continue. Keep the Correct mode route and photo state that already exist.
3. Capture gets a "Saved diagrams" button (accessible name, at least 48x48 px, spoken state) that opens the SavedDiagrams screen; the screen lists saved diagrams (title announced, open, delete, pin if the spec says so), works with no network, and says "No saved diagrams yet" when empty. Opening one goes to Explore. Delete asks for confirmation by voice or button before removing.
4. Offline: opening a saved diagram must make no network call (assert in a test with a fetch spy).
5. Tests: render tests for the new screen and Capture button, a flow test for save-on-load including the failure path (store throws), an offline-open test, i18n parity for every new key.

## Done
tsc, `npm --prefix frontend test` (all existing tests still pass), `npm --prefix frontend run build` pass with real counts. The report ends with a section **"Commit groups"**: an ordered list of logical commits (conventional-commit message plus the exact files for each; for example one for the Drivers interface and test fakes, one for i18n, one for the screen, one for App wiring, one for tests), so the reviewer can commit them separately.

## Shared rules
Read AGENTS.md first. The owner explicitly authorised agents to write code that AGENTS.md normally reserves for Kiro because Kiro's credits ran out; state plainly in your report what came from Kiro's draft and what is yours. No git state changes (you cannot run git add, commit or push), no installs, no `.env` access, no new dependencies. Every user-facing string through `t()` with en, hi and gu entries. Browser APIs only in `frontend/src/drivers/`, except the canvas drawing already done in screens. node and npm are on your PATH. Run the commands for real and record true results, including failures.
