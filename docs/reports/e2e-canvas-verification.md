# E2E canvas verification (Claude Code, 2026-11-11)

Spec: `frontend/e2e/explore.canvas-stable.spec.ts` (agy lane e2e-canvas-stable), run with `npx playwright test` in two projects: Galaxy S24 384x832 DPR 3 and S24+ 412x915 DPR 3.5 (touch, Android Chrome UA, service workers blocked).

| Build | Result |
|---|---|
| `5616cd5~1` (8c8677d, in-flow canvas, before PR #34) | 8 passed, 2 failed (both projects, test "viewport height resize during hold": Ask bottom edge 898.8 px, past the 859 px viewport after the 56 px shrink) |
| `main` with Kiro's T42 fix (c25a5cf) | 10 passed |

## What this does and does not prove
- The reported bug (canvas grows for about 7 s after "First hold: dx=-74.4px, dy=-47.2px from centre") did NOT reproduce in desktop Chromium emulation, even on the pre-#34 build. A probe with the owner's exact first-touch offset showed the same status text and a canvas that stayed at 530.2 px for 8 s at DPR 3.
- So the plain 5 s and 10 s hold-and-drag tests pass on broken and fixed code: they guard against regressions but cannot prove the S24+ bug is fixed.
- The viewport-resize scenario is the only one that separated the builds: before the fix, buttons stayed below the new viewport edge after it shrank (the URL-bar or navigation-bar case). After the fix it passes.
- The S24+ bug was reported in the installed PWA, which keeps a service-worker cache. A build from before PR #34 may still be running there. Close the app fully and reopen it twice, then retest.

## Re-check on the S24+ (Kiro's steps are in docs/kiro-evidence/canvas-resize-bug.md)
Hold-drag for 10 s with TalkBack off and on, then rotate once; confirm the canvas, the status line and Ask / Correct / Back do not move.
