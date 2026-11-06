# Lane x-reviewfix: fix the defects found in Claude Code's review of the Kiro-assigned work

Create `docs/reports/agy-x-reviewfix-report.md` FIRST. You may run the frontend test, tsc and build commands. Do NOT run backend tests or ruff. Keep each fix independent (separate files) so the supervisor can commit them one by one.

## Fix 1: new hooks run from the wrong directory (High)
`.kiro/hooks/css-guard-on-save.json` and `.kiro/hooks/a11y-on-save.json` use `npx vitest run tests/...` with no working directory; the repo root has no package.json. Change ONLY the `command` strings to the form used by `.kiro/hooks/run-tests-on-core-save.json`:
- css guard: `npm --prefix frontend exec -- vitest run tests/labTheme.prop.test.ts tests/css.imports.test.ts --reporter=dot`
- a11y: `npm --prefix frontend exec -- vitest run tests/a11y.contrast.test.ts tests/a11y.targets.test.ts tests/a11y.motion.test.ts tests/screens.render.test.ts --reporter=dot`
Then run exactly those two commands yourself? You cannot (exact-match allow-list). Instead run `npm --prefix frontend test` and confirm `frontend/tests/kiro.hooks.test.ts` still passes, and add one assertion to that test: every hook whose action.type is `command` and mentions `vitest` must contain `--prefix frontend` (so this class of bug is caught).

## Fix 2: pre-existing hook with a hard-coded wrong workspace (High)
`.kiro/hooks/prop-tests-on-save.json` hard-codes `WORKSPACE="c:/Users/Admin/Documents/ghost-touch"` and uses `py -3.11`. The real repo is elsewhere. Rewrite ONLY its `command` so it works from the workspace root with relative paths: backend case runs `backend/.venv/Scripts/python -m pytest backend/tests/test_validate_props.py -q --tb=short`; frontend case runs `npm --prefix frontend exec -- vitest run tests/hapticEngine.prop.test.ts tests/pitch.prop.test.ts tests/hitTest.prop.test.ts --reporter=dot`. Keep the matcher, the exit-code behaviour (exit 2 on failure) and the file-path detection logic. Keep valid JSON (escape newlines as before). Note in the report that this is a Kiro-authored hook edited by agy.

## Fix 3: P18 is partly tautological (Medium)
In `frontend/tests/labTheme.prop.test.ts` the `aliveAnimations` array hard-codes `durationMs: 950`, `pulseCount: 2` and keyframe percentages, so editing the real CSS cannot fail P18. Replace the hard-coded table with values PARSED from `frontend/src/styles/lab.css`, `explore.css` and `tokens.css`: for each of the four named animations (`gt-spark-arc-play`, `gt-spark-glow-play`, `gt-alive-border-pulse`, `gt-alive-hud-pulse`) find the `animation:` / `animation-duration` that uses it (resolving `var(--gt-spark-duration)` through tokens.css) and parse its `@keyframes` stops; derive the duration and the number of peaks from the keyframes (a peak = a stop where the animated opacity/box-shadow value is higher than both neighbours, or if that is too fragile, count the non-zero interior stops and say so in a comment). Keep the temporal-sampling property using the parsed values. If parsing exposes a real violation, do NOT weaken: report it. Do not change any CSS.

## Rules
Edit only the files named above plus the report and `docs/BUILD_LOG.md` (tool = Antigravity (agy), fixes from a Claude Code review). Run `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test`, `npm --prefix frontend run build` and report real numbers. End with **Commit groups**: three commits, one per fix, listing the files of each.
