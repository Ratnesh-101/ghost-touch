# Lane TC: toolchain bump (Vitest 5, coverage-v8 5, Vite 8, plugin-react 6) for Dependabot PRs #11, #14, #17

The dependencies are already merged and installed in this worktree (see `frontend/package.json`: vitest ^5.0.5, @vitest/coverage-v8 ^5.0.5, @vitejs/plugin-react ^6.1.2, vite ^8.0.0, vite-plugin-pwa ^2.0.0, typescript ~7.0.2). All 418 tests already PASS. What is broken: `tsc --noEmit` (so `npm run build` too) and CI.

## Allowed files
- `frontend/tests/**` EXCEPT any `*.prop.test.ts` (fix typing of mocks only; do not change what a test asserts)
- `frontend/vite.config.ts`, `frontend/vitest.config.ts`, `frontend/tsconfig.json`
- `.github/workflows/*.yml`: ONLY the Node version (`node-version:`) lines and nothing else
- `docs/reports/agy-toolchain-report.md`

## Forbidden
`frontend/src/**`, `frontend/package.json` and `package-lock.json` (already final; you cannot install anything), property tests, backend, `.kiro/**`, tuned haptic values.

## Do
1. `npm --prefix frontend exec -- tsc -p frontend --noEmit` currently fails in `tests/drivers.audio.earcons.test.ts` (and maybe other test files): Vitest 5 changed the `Mock` types so `vi.fn()` values no longer satisfy function-typed interface members (`AudioContextLike`, `FakeContext`, the `AudioContextFactory`). Fix the TYPES in the tests (for example give `vi.fn<(...args) => ret>()` explicit function generics, or cast through a typed helper). Do not change assertions. Fix every similar error.
2. After tsc is clean, run `npm --prefix frontend test` and `npm --prefix frontend run build`. If the Vite 8 or plugin-react 6 build or the PWA plugin needs config changes (renamed options, plugin API), fix them in `vite.config.ts` / `vitest.config.ts` and explain each change. The PWA must still build `sw.js` and `manifest.webmanifest` with the same icons and theme colour `#0b0b10`.
3. Vitest 5 requires Node `^22.12.0 || ^24.0.0 || >=26.0.0`; CI uses Node 20 and fails for that reason. Change every `node-version: 20` (and `'20'`) in `.github/workflows/*.yml` to `22`. Do not touch anything else in those files.
4. If `npm --prefix frontend run test:prop` or the coverage config referenced in the repo breaks under Vitest 5, fix the config (not the tests).

## Done
tsc, `npm --prefix frontend test` (418 tests still pass, same count), `npm --prefix frontend run build` pass with real counts. Report lists each change and why. End with a **"Commit groups"** section (ordered logical commits: conventional message plus exact files each, for example: test typings; vite/vitest config; workflow Node version).

## Shared rules
Read AGENTS.md first. No git state changes (you cannot run add, commit or push), no installs, no `.env` access, no new dependencies. Run the commands for real and record true results including failures.
