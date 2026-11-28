# Evidence: next-step lines on Correct, Teach, Saved diagrams, Settings and Ask (task 93.3a, Requirement 53.24)

Spec first: Requirement 53.24 and task 93.3a in `.kiro/specs/ghost-touch/`. Sources: `b-host.md` (open items), `b-speech.md` (not done: next-step hint after "Settings opened" and after the Saved heading), `docs/reports/wb-playwright-probe.md` items 5 and 6. No commit was made. `.env` files not opened. Tuned haptic values, `core/` and `.kiro/agents` untouched. Nothing was tried on a phone or with TalkBack, and Playwright was not run.

## What changed
| Screen | Before | Now (one utterance) | Code |
|---|---|---|---|
| Correct | `correct.intro` (already a next step) | `correct.title` + `host.correct.next`; `correct.intro` stays as visible status text | `screens/Correct.tsx` |
| Teach | `teach.intro` | `teach.intro` + `host.teach.next` | `screens/Teach.tsx` |
| Settings | "Settings opened" | "Settings opened" + `host.settings.next` (spoken title already matched the sheet title since 93.5; hi and gu unchanged) | `components/LabSettings.tsx` |
| Saved diagrams | `App` spoke the heading, then the screen's list cut it off | `saved.heading` + `host.saved.next` + titles; the empty or error view speaks the heading and the notice only | `flow/saved.ts` (`savedEntryAnnouncement`), `screens/SavedDiagrams.tsx`, `App.tsx` (heading speech removed) |
| Ask | typing box opens after an error line | no code change, see below | none |

Shared helper: `hostEntryAnnouncement(screen, ...lead)` in `flow/host.ts`, built on `joinAnnouncements`. Each line is joined with `joinAnnouncements`, so `speak()` never cancels one half. All status text already goes through `StatusText`, so no live region repeats a spoken line (the Settings e2e checks the dialog for live regions).

## Decisions to review
- **Ask is not changed.** Every path that opens the typing box (`handleVoiceAsk` unsupported, every `askErrorMessage` failure, `onFallbackNeeded`) already speaks one line that says where the box is and names an action (Requirement 53.16b, linted in `tests/host.wiring.test.ts`). Adding `host.ask.next` would be a second next-step line, and its "press Ask to speak" is false when the browser cannot listen. No path opens the box silently today, so `host.ask.next` has no caller; Requirement 53.24d records this. A test pins that the lines name the box.
- **Empty Saved list has no next-step line.** `host.saved.next` says "Choose a saved diagram to open", which is false with no entries. The notice is the line. An empty-state hint would need a new key in en, hi and gu, so I left it for the owner.
- **Correct drops `correct.intro` from speech** because 53.3 allows one next step and the intro already names one.
- Hindi and Gujarati `host.*.next` text is machine-written and needs a native reader (task 21.8).

## Tests
- New `frontend/tests/b.nextlines.test.tsx` (jsdom; en, hi, gu): Correct, Teach and Settings speak exactly one utterance equal to `joinAnnouncements([lead, next])` and it is the last spoken line; Saved with entries speaks heading, then next step, then a title, once, and never the heading alone; Saved empty has no next-step line; `savedEntryAnnouncement` for list, empty and error; `hostEntryAnnouncement`; Ask box lines name the box.
- Updated for the intended new wording: `lab.settingsSpeech.test.tsx` (opened line, and the "language change does not re-announce" filter now also matches the new line), `saved.focus.test.tsx`, `b.speech.test.tsx` (Correct spoken once via `hostEntryAnnouncement`; App speaks neither `correct.intro` nor `host.correct.next`).
- `frontend/e2e/host.guide.spec.ts`: five new tests, one per screen (Settings, Teach, Correct, Saved empty list, Ask without recognition). **Written and type-checked, not run.** Teach depends on the Settings sheet showing "Open Teacher Editor" in the build under test (teacher tools seeded with `gt_teacher_enabled`); if that button is behind a flag the test fails for that reason, not because of speech. The Saved list case is not in e2e (needs seeded IndexedDB); it is covered in jsdom.
- No mutation check was run on the new tests this time.

## Gate
- `npx tsc --noEmit`: exit 0, no output.
- `npx vitest run`: 269 files passed, 3444 tests passed, 1 todo, 0 failed. Raw output: `docs/kiro-evidence/b-next-lines.vitest.txt`.
- Not run: `npm run build`, Playwright.

## Task state
93.3a ticked. 93.3 stays open for: leaving the ask flow from the Explore shell, save-flow jokes, and W9 to W14.
