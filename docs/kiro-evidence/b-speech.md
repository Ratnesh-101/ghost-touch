# Evidence: speech integrity fixes (task 93.5, Requirement 53.19 to 53.23)

Source: `docs/reports/wb-playwright-probe.md` (emulated phone, speech spied). Spec text came first (requirements 53.19 to 53.23, task 93.5), then the code and tests. Nothing was tried on a phone or with TalkBack.

| Defect | Cause | Fix | Test (`frontend/tests/b.speech.test.tsx` unless noted) |
|---|---|---|---|
| 1 Build next step cut off | `App.openBuild` spoke `build.prompt`, then `Build` spoke `build.title` on mount; `speak()` cancels the earlier line | `App` no longer speaks; `Build` speaks `joinAnnouncements([title, prompt])` once | "speaks title and prompt together"; "App does not speak build.prompt"; `semantics.a11y` and `build.wire` updated to the combined line |
| 2 Correct intro twice | `App.handleCorrect` and `Correct` both spoke `correct.intro` | `App` no longer speaks it; the screen does on mount | "App.handleCorrect does not speak correct.intro" |
| 3 Raw notice twice | notice had `role="status"` while the entry line says the same | `role="status"` and `aria-live` only when `drivers.speech.canSpeak` is false (StatusText convention) | "plain text when the app speaks" and "live region only when it cannot"; `explore.lab` and `a11y.screens` updated |
| 4 Teach Back to Start | `handleTeachBack` fell back to `start` | falls back to `capture` and speaks `host.capture.next` | "Teach Back ... Capture, not Start" (checks the source of the else branch; no render test for the hash route) |
| Minor: debug text | `.gt-explore__debug` always rendered | rendered only with `showDebug` (default off, nothing sets it) | "Debug cursor text is hidden by default" |
| Minor: Settings title | `lab.settings.opened` was "Lab settings opened" | "Settings opened" (en only; hi and gu unchanged) | "Settings spoken title matches"; `lab.i18n`, `labSettings`, `lab.settingsSpeech` updated |

Not done: a next-step hint after "Settings opened" and after the Saved heading (probe items 5 and 6, minor, need wording and keys in three languages).
Tests 1 to 3 are render-level (jsdom or static markup). Tests 2 and 4 on `App` read source text, because rendering the whole app route is heavy; they would not catch a rewritten but still wrong handler.
