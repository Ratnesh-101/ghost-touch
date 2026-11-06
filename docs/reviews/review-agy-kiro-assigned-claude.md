# Review of the agy-built work that was written for Kiro (prompts 4 to 7)

Reviewer: **Claude Code** (not Kiro). Date: 2026-11-06. Kiro credits are not available, so this review stands in for the Kiro review that the work is labelled "awaiting". It does NOT count as Kiro usage and must not be described as such in the submission.

Scope: merged commits for Requirement 14 and Task 17 (P18 to P20), Requirement 15 and Task 18, the three new hooks, the Explore fixes for Findings 5 and 14, and the property tests P21 to P30.

**Verdict: FIX FIRST (two real defects in the hooks and one weak property), everything else ships.**

| Severity | File:line | Problem | Fix |
|---|---|---|---|
| High | `.kiro/hooks/css-guard-on-save.json:11`, `.kiro/hooks/a11y-on-save.json:11` | Both commands are `npx vitest run tests/...` with no working directory. The repo root has no `package.json` or vitest config, so every save would fail or run nothing. The hooks have never run inside Kiro, and `kiro.hooks.test.ts` only checks JSON shape, not that the command works. | Use `npm --prefix frontend exec -- vitest run tests/... --reporter=dot` (same style as `run-tests-on-core-save.json`). |
| High | `.kiro/hooks/prop-tests-on-save.json` (command) | Pre-existing: hard-coded `WORKSPACE="c:/Users/Admin/Documents/ghost-touch"`, but the repo lives in `Downloads/ghost-touch-main/ghost-touch-main`, and it calls `py -3.11`. This hook cannot work on this machine. | Resolve paths relative to the workspace (`npm --prefix frontend exec -- vitest run ...`, and `backend/.venv/Scripts/python -m pytest backend/tests/test_validate_props.py -q`). |
| Medium | `frontend/tests/labTheme.prop.test.ts:48-87` | P18 is partly tautological. The animation list (`durationMs: 950`, `pulseCount: 2`, keyframe percentages) is hard-coded in the test, so lengthening a keyframe animation in `lab.css` or `explore.css` would NOT fail the test. Only `--gt-spark-duration` and the `Spark.tsx` timeout are really parsed. | Parse `animation:` durations and `@keyframes` stops from the real CSS for the four named animations and derive peaks and frequency from them. |
| Low | `frontend/tests/labTheme.prop.test.ts:225-236` | P20 passes through an 8-entry legacy hex allow-list. It is documented, which is honest, but these should be migrated to `var(--gt-*)` tokens. | Track as a task; do not widen the list. |
| Low | `frontend/src/screens/Explore.tsx` (aria-label) | Finding 5 removes the canvas accessible name whenever speech is active, using both state and an imperative `removeAttribute`. If speech is "supported" but no voice speaks (missing voice data), TalkBack announces nothing. | Phone test first (`docs/reports/phone-test-checklist-agy.md`). Revert that part if TalkBack is silent on entering Explore. |
| Info | `.kiro/specs/ghost-touch/tasks.md` | Items 17.x and 18.1 to 18.3 are ticked "(agy)". Item 18.4 to 18.10 are ticked because the code exists; verified against `main` (concurrency cap, 12 MP, disconnect check, EXIF, validate bounds, headers, docs hiding). | None. |

## Checked and fine
- `frontend/src/core` has a zero-line diff against the pre-batch base. Tuned haptic values untouched.
- Pointer promotion (Finding 14): `onPointerUp`, `onPointerCancel` and `onLostPointerCapture` all use `handlePointerLift` (`Explore.tsx:996-998`), the oldest surviving pointer (Map insertion order) becomes primary, engine state is reset and the first move is processed. Matches Requirement 4.8.
- Requirement numbering: agy's new Explore criterion was renumbered 13.8 because 13.7 already existed.
- Honesty labels: every spec, test and doc written by agy says "agy, awaiting Kiro review"; nothing claims Kiro work.
- Gates on `main` (895bdc6): `tsc` clean, 1203 frontend tests, build OK, 422 backend tests, ruff clean.

## Needs from the owner
- Phone test for Finding 5 (see above).
- When Kiro credits return: Kiro should review this work and the hooks in its own panel.
