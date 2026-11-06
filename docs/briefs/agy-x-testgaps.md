# Lane x-testgaps: unit tests for four untested frontend modules

Create `docs/reports/agy-x-testgaps-report.md` FIRST. You may run the frontend test, tsc and build commands. Do NOT run backend tests or ruff. Add tests only; do not change source files unless a test exposes a real bug (then do NOT fix it: record it in the report with file:line and a proposed fix).

A graph scan found no test mentions these modules:
- `frontend/src/components/AccessibleButton.tsx`
- `frontend/src/components/RateSelector.tsx`
- `frontend/src/drivers/audioElement.ts`
- `frontend/src/drivers/hashRoute.ts`

For each, read the module and an existing test of a similar module (for example `frontend/tests/a11y.screens.test.tsx` for DOM tests, and tests under `frontend/tests/` for drivers) and copy its style, environment pragmas and mocking approach. Write one new file per module in `frontend/tests/` named `<module>.test.ts(x)`. Cover: accessible name, 48x48 px target (the `--gt-target` token or inline style, whichever the module uses), keyboard/click handling, disabled state, and for drivers: normal path, unsupported-API path, error path, and cleanup. Do not touch `frontend/src/core`, haptic values, or existing tests. Use fast-check only where a real property exists (for example a route parse/format round trip in hashRoute).

Run `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test`, `npm --prefix frontend run build` and report the real numbers (test count before and after). End with **Commit groups** (one commit: `test: cover AccessibleButton, RateSelector, audioElement and hashRoute`).
