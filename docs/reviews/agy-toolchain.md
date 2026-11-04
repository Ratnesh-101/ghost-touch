# Review: lane TC (toolchain bump), branch agy/toolchain
Reviewer: Claude Code. Builder: Antigravity (agy). Date: 2026-11-04.

**Verdict: APPROVE.** Closes Dependabot PRs #11 (vitest 5), #14 (plugin-react 6) and #17 (coverage-v8 5); vite is bumped to 8 because plugin-react 6 requires it.

- Why the PRs were red: they were coupled (vitest and coverage-v8 peer-pin each other; plugin-react 6 needs vite 8) and Vitest 5 needs Node 22 or newer while CI ran Node 20.
- Scope: two test files (mock typings only, assertions unchanged) and the `node-version` line of three workflows (20 to 22). No source, config, property-test or backend change was needed.
- Verified by me: `tsc` clean (TypeScript 7.0.2), 418 tests pass (same count), `npm run build` OK with `sw.js` and `manifest.webmanifest` generated (14 precache entries).
