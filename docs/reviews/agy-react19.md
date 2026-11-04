# Review: lane R19 (React 19 migration), branch agy/react19
Reviewer: Claude Code. Builder: Antigravity (agy). Date: 2026-11-04.

**Verdict: APPROVE.** Closes Dependabot PRs #15 (react, @types/react) and #16 (react-dom, @types/react-dom), which had to land together.

- Scope: type-only edits in 11 files under `frontend/src` (components and screens); 14 insertions, 11 deletions. No core, property test, package file or behaviour change. `AccessibleButton` still uses `forwardRef`; it only gains a typed optional `ref`.
- React 19 removed the global `JSX` namespace and made `useRef` return `RefObject<T | null>`; both are fixed with named type imports from `react`, consistently.
- Verified by me: `tsc` clean, 418 tests pass, `npm run build` OK.
- Combined with the toolchain lane (vitest 5, vite 8) before pushing; see the merge commit.
