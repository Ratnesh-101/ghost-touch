# Lane lab-bugsaudio: fix the audio and speech driver bugs from the bug audit

Read `docs/reports/audit-bugs.md` in the shared audit worktree: it is at `../gt-lane-audit/docs/reports/audit-bugs.md` relative to this worktree (read it with the file tools by that path; if it cannot be opened, work from the finding descriptions below). Fix ONLY findings 1, 2, 6 and 13, in the driver layer, with tests.

## Findings to fix
- Finding 1 (HIGH): the theremin tone can stay stuck on after an earcon ducks and restores it (a Web Audio timeline race). Make the duck and restore sequence cancel and re-schedule automation correctly so the tone is silent whenever the app asked for silence, including when an earcon ends after the finger has lifted.
- Finding 2 (HIGH): a speech-recognition session is orphaned when the user leaves the screen (microphone stays open, stale state). In `drivers/speech.ts` add a clean `cancelListen()` (idempotent, aborts the recogniser and resolves any pending `listen()` promise with the cancelled outcome) and make `listen()` abort automatically on `pagehide`/`visibilitychange` hidden. Do NOT change screens in this lane: another later lane wires `cancelListen()` into screen cleanup; export it and document it in the report.
- Finding 6 (HIGH): the `AudioContext` is suspended when the user switches to the camera app and never resumes, so the app is silent afterwards. Resume it on `visibilitychange` (visible) and on the next user gesture, without creating a second context and without starting any sound by itself.
- Finding 13 (MEDIUM): disconnect Web Audio nodes that are no longer used (earcon oscillators and gains), so the graph does not grow with every earcon.

## Allowed files
`frontend/src/drivers/audio.ts`, `frontend/src/drivers/audioElement.ts`, `frontend/src/drivers/speech.ts`, their existing tests (`tests/drivers.audio.test.ts`, `tests/drivers.audio.earcons.test.ts`, `tests/drivers.speech.test.ts`, `tests/speech.voice.test.ts`; extend them, never weaken an assertion), new tests `tests/drivers.audio.lifecycle.test.ts` and `tests/drivers.speech.cancel.test.ts`, `docs/reports/agy-lab-bugsaudio-report.md`.

## Forbidden (hard)
`drivers/haptics.ts` and every haptic value or pattern, `core/**`, `flow/**`, `screens/**`, `App.tsx`, the tone frequency mapping (`pitchForY`, `pitchForValue`) and the output of `getEarconSteps` (earcon frequencies, durations and timings must be unchanged: add a test that locks them), backend, `.env*`, prop tests. No `any`, no `console.*`. Browser APIs stay in `drivers/`.

## Do
For each finding: reproduce it in a unit test first (the existing audio tests use fakes: read `tests/drivers.audio.test.ts` for the fake `AudioContext` pattern), fix the driver, and keep every existing test passing unchanged. Where a finding cannot be reproduced with the fakes, say so in the report instead of guessing, and keep the fix minimal.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all old tests pass, plus yours, real counts), `npm --prefix frontend run build` pass. Run NO backend commands. Report: per finding what was wrong, what changed, the test that proves it, and anything that needs a screen change later. End with **Commit groups**; write the report even if something failed.
