# Lane T11a: Teacher Correct mode (frontend), Task 11, Requirement 9

Spec-first, small steps. Read `.kiro/specs/ghost-touch/{requirements,design,tasks}.md` (Requirement 9 and the Correct component in the design), `.kiro/steering/*.md`, and `docs/handoffs/kiro-prompts.md` (Prompt 2 holds the detailed intent).

## Allowed files
- `.kiro/specs/ghost-touch/{requirements,design,tasks}.md`: add Correct-mode acceptance criteria, add P16 and P17 to the properties table in design.md, add sub-tasks 11.1 onward; tick only what you finish.
- `frontend/src/core/correct.ts` (NEW, pure module)
- `frontend/tests/correct.prop.test.ts` (NEW, fast-check) and `frontend/tests/correct.*.test.ts`
- `frontend/src/api/validate.ts` (NEW), `frontend/src/flow/correct.ts` (NEW), `frontend/src/screens/Correct.tsx` (NEW)
- `frontend/src/styles/correct.css` (NEW, imported by Correct.tsx; do not edit global.css)
- `frontend/src/App.tsx` (route, and keep the last captured photo URL in state)
- `frontend/src/screens/Explore.tsx` (add ONE clearly labelled "Correct" button outside the canvas; do NOT touch gesture handling)
- `frontend/src/screens/Capture.tsx` and `frontend/src/flow/capture.ts` (only to hand the original photo Blob or URL to onScene)
- `frontend/src/i18n/index.ts` (add keys with en, hi and gu entries; the i18n parity test must pass)
- `docs/reports/agy-correct-report.md`

## Forbidden
`frontend/src/core/hapticEngine.ts`, `pitch.ts`, `hitTest.ts`, `geometry.ts`, existing property tests, `backend/**`, `frontend/src/types/scene.gen.ts`.

## Do
1. `core/correct.ts`: pure immutable functions on DiagramScene: `movePoint` (clamp to [0,1]), `renameLabel` (trim, reject empty), `deletePoint` (also removes every segment and polyline reference to it), `deleteSegment`, and an undo/redo history reducer. No window, document or navigator.
2. P16 (fast-check, at least 200 runs): any sequence of edits on a valid scene yields a scene with unique ids, no dangling segment references, and all coordinates in [0,1]. P17: undo after any edit restores the previous scene exactly; redo re-applies it. Reuse the existing scene arbitraries if there are any (see hitTest.prop.test.ts).
3. `api/validate.ts`: client for `POST /api/v1/validate` with the contract `{"scene": obj}` -> `{"ok": bool, "scene": obj|null, "errors": string[]}`. The backend lane builds the endpoint in parallel; test with a mocked fetch in the same style as `api/ask.ts`. Base URL from `VITE_API_URL` like the other clients.
4. `Correct.tsx` (a sighted teacher UI, but still accessible: accessible names, 48x48 px targets, spoken state changes, keyboard operable): a canvas showing the original photo (if any; the samples have none) with the scene drawn over it; drag a point with pointer events; edit a label through a labelled text input; delete the selected point or segment; Undo; Redo; Save. Save calls the validate API: on `ok: true` use the returned scene and go back to Explore; on `ok: false` show and speak the errors and stay. Never silently save an invalid scene.
5. Explore gets the "Correct" button. Keep the App and flow wiring minimal. Do not change what the finger does on the canvas.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all existing tests still pass) and `npm --prefix frontend run build` pass, with real counts. The report lists the files touched, what cannot be verified without a phone, and states that this is agent-written.

## Shared rules
Read AGENTS.md first. The owner explicitly authorised this lane (2026-11-04) to write code that AGENTS.md normally reserves for Kiro (a core module, property tests, spec files); touch only the files listed here, and say plainly in your report that this is agent-written, not Kiro-written. Do not change the tuned haptic values or the haptic engine. No git state changes, no installs, no `.env` access, no new dependencies. Every user-facing string through `t()` with en, hi and gu entries. Browser APIs only in `frontend/src/drivers/`. Run the commands for real and record true results, including failures.
