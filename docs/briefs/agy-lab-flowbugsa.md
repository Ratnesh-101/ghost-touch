# Lane lab-flowbugsa: navigation, memory and double-tap bugs from the bug audit

Read `docs/reports/audit-bugs.md` (in this worktree) and fix ONLY findings 3, 4, 9 and 16. The redesign of Start, Capture and Explore is already merged.

## Findings
- Finding 3 (HIGH): the Android Back button and the TalkBack back gesture are broken or trapped on the secondary screens (Capture, Explore, Saved, Correct). Read `drivers/navigation.ts`, `drivers/hashRoute.ts`, `flow/navigation.ts` and `App.tsx` (and the tests `tests/drivers.navigation*.test.ts`, `tests/flow*.test.ts`) first. Make the system Back return to the previous screen (Explore to Capture, Saved to Capture, Correct to Explore, Capture to Start is NOT required: leaving the app from Start is fine) using the existing navigation driver and history handling; keep the two-finger swipe-down gesture and the spoken announcements unchanged. Keep the existing suppress logic tests passing.
- Finding 4 (HIGH): the raw photo object URLs are never revoked (memory leak on repeated camera captures). Revoke them when they are replaced or when the screen that owns them unmounts, without breaking the Correct overlay that uses the photo.
- Finding 9 (MEDIUM): double-tap vulnerability on the sample buttons and the Start button (two taps start two flows). Guard with the existing `busy` state or a ref so a second tap during a load or a transition is ignored (and, where the screen already speaks `capture.busy`, keep that behaviour).
- Finding 16 (LOW): the camera file input has no cancel handling (the screen stays "busy" or focus is lost after cancel). Handle the `cancel` event (and the empty-selection case) by restoring idle state and focus to the Take photo button, silently.

## Allowed files
`frontend/src/App.tsx` (small, targeted changes only; do not restructure the state machine), `frontend/src/screens/Capture.tsx`, `frontend/src/screens/Start.tsx`, `frontend/src/screens/Correct.tsx` (object-URL ownership only), `frontend/src/flow/navigation.ts`, `frontend/src/flow/capture.ts` (only if the object URL lifecycle lives there; do NOT change its progress tone or spoken messages), `frontend/src/drivers/navigation.ts`, `frontend/src/drivers/hashRoute.ts`, their tests (extend, never weaken), new tests `frontend/tests/nav.back.test.ts(x)`, `frontend/tests/capture.lifecycle.test.tsx`, `docs/reports/agy-lab-flowbugsa-report.md`.

## Forbidden (hard)
`core/**`, haptic values and `drivers/haptics.ts`, `drivers/audio.ts`, `drivers/speech.ts` (another lane edits them), the TalkBack relative-cursor logic and the Explore pointer and canvas code, `screens/Explore.tsx`, i18n strings, backend, `.env*`, prop tests.

## Do
Reproduce each finding in a unit test first (fakes for history, URL, file input), then fix. Where a finding cannot be reproduced with the available fakes, say so and make the minimal safe change. Existing tests must pass unchanged.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all old tests pass, plus yours, real counts), `npm --prefix frontend run build` pass. Run NO backend commands. Report per finding: what was wrong, what changed, the proving test; then **Commit groups**; write the report even if something failed.
