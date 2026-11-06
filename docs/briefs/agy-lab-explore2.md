# Lane lab-explore, pass 2: fix the failing tests and remove scope creep

Read `docs/briefs/lab-spec.md` and `docs/briefs/agy-lab-explore.md`. Pass 1 left this worktree with `tsc` clean and the build passing, but the new file `frontend/tests/explore.lab.test.tsx` has 10 FAILING tests (it was never run, because node_modules was not linked; it IS linked now, so the frontend commands work). Current result: `Test Files 1 failed | 42 passed (43)`, `Tests 10 failed | 483 passed (493)`.

## Allowed files
`frontend/tests/explore.lab.test.tsx`, `frontend/src/screens/Explore.tsx`, `frontend/src/styles/explore.css`, `docs/reports/agy-lab-explore-report.md`

## Do
1. Run `npm --prefix frontend test` and read the failures. Causes seen so far: the tests read the CSS in a way that returns an empty string (`global.css` only `@import`s `explore.css`; read `explore.css` itself with `node:fs` and a `new URL('../src/styles/explore.css', import.meta.url)` like `tests/a11y.contrast.test.ts` does), min-size assertions that parse to NaN (the rules use `min-height: 52px` or `var(--gt-target, 48px)`; write the helper so it resolves a `var(--x, 48px)` fallback and plain px), a markup assertion that does not match the real rendered HTML, and a regex that expects properties in a fixed order. Fix the TESTS so they assert the real behaviour correctly. Do NOT weaken what they protect: the canvas element, its `aria-label`, `touch-action: none` and pointer handlers are unchanged; the frame and rivets are `aria-hidden` and `pointer-events: none`; every control around the canvas has an accessible name and a CSS target of at least 48px; the reduced-motion block disables the frame animations. If a test exposes a REAL bug in `Explore.tsx` or `explore.css` (for example a control under 48px or missing reduced-motion rules), fix that code instead.
2. Remove the unrequested `onSave` prop and its Save button from `Explore.tsx` (the brief did not ask for a new action, nothing passes it, and the Save flow belongs to another screen). Keep `onCorrect`, `onBack`, `onAsk` exactly as they were.
3. Confirm with `git diff --stat` that `Explore.tsx` changes are only classes, wrapper markup and the Raw Mode notice.
4. Run `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` and `npm --prefix frontend run build`. All three must pass with ZERO failing tests. Record the real counts. Do not run the backend commands; they are not relevant to this lane.
5. Update `docs/reports/agy-lab-explore-report.md` with the corrected facts (the earlier version claimed frontend commands could not run) and end with a **Commit groups** section.

## Rules
No git state changes. Never open `.env*`. No other files.
