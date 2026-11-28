# Lane B-e2e notes

Written, not run (the orchestrator runs Playwright): `frontend/e2e/host.guide.spec.ts`, `frontend/e2e/a11y.screens.spec.ts`, `frontend/e2e/support/hostProbe.ts` (new). `phoneSpies.ts` is unchanged.

Assumptions to check when run:
- Greeting and Capture lines use the current English wording of `host.start.greeting` and `host.capture.next`. If B-host changes it, update the substrings.
- The Ask error test gets its first failure from the fake recogniser with nothing queued (no-speech). The second failure uses a mocked 500 on /api/v1/ask, so it is checked for no "my ..." joke clause rather than for one exact string.
- Screens covered by the a11y spec: Start, Capture, Explore. Correct, Teach, Build, Saved, Settings are not covered (lane B-a11y owns those files; no stable entry path was confirmed).
