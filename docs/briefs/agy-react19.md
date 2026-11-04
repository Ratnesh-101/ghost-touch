# Lane R19: React 19 migration for Dependabot PRs #15 and #16

React, react-dom and the type packages are already merged and installed in this worktree (`frontend/package.json`: react ^19.3.1, react-dom ^19.3.1, @types/react ^19.3.0, @types/react-dom ^19.3.0). All 418 tests already PASS. What is broken: `tsc --noEmit` (so `npm run build` too).

## Allowed files
`frontend/src/**` EXCEPT `frontend/src/core/**` and `frontend/src/types/scene.gen.ts`; `frontend/tests/**` EXCEPT `*.prop.test.ts` (typing fixes only); `docs/reports/agy-react19-report.md`

## Forbidden
`frontend/src/core/**`, `scene.gen.ts`, property tests, `package.json` and `package-lock.json` (already final; you cannot install), backend, `.kiro/**`, tuned haptic values, any behaviour change.

## Do
1. React 19 removed the global `JSX` namespace. Replace `JSX.Element` return types with `React.JSX.Element`, `ReactElement` (type import) or `import type { JSX } from 'react'`; pick ONE consistent pattern across the repo (the repo uses `import { ... } from 'react'` named imports; keep that style).
2. `useRef<HTMLInputElement>(null)` now returns `RefObject<HTMLInputElement | null>`; fix `AccessibleButton` and `Capture.tsx` and any other component so ref props accept `RefObject<T | null>`, without weakening types elsewhere.
3. Fix every remaining `tsc` error the same way (types only). Do not change any runtime behaviour, markup, aria attributes, accessible names or styles. React 19 also changes some defaults (for example `ref` as a prop, no `defaultProps` on function components, stricter `act` warnings in tests): check for these in `src/` and tests and handle them only if they actually occur.
4. Confirm `npm --prefix frontend test` still passes with the SAME 418 tests and `npm --prefix frontend run build` succeeds.

## Done
tsc, `npm --prefix frontend test`, `npm --prefix frontend run build` pass with real counts. Report lists each change. End with a **"Commit groups"** section (ordered logical commits: conventional message plus exact files each, for example: JSX type migration; ref typings; test typings).

## Shared rules
Read AGENTS.md first. No git state changes (you cannot run add, commit or push), no installs, no `.env` access, no new dependencies. Run the commands for real and record true results including failures.
