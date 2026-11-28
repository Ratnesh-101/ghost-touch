# WA-A4 review of the uncommitted diff

Scope: `git diff` (35 modified files) and the untracked files, checked against `.kiro/steering/review.md` and `tech.md`. Read-only. I did not run the test suites. I read `playwright-full.txt`, which ends "188 passed".

## Findings

| ID | Severity | File:line | Problem | Suggested fix (owner) |
|---|---|---|---|---|
| A4-1 | Med | `.kiro/agents/gt-auditor.json`, `gt-reviewer.json`, `gt-writer.json`, `gt-fixer.json` (new `permissions.rules`, last entries) | Each file now ends its rule list with unconditional `fs_read allow`, `fs_write allow` and `shell allow` entries that have no `match`. The agents are described as read-only (auditor, reviewer) or path-scoped (fixer, writer). In `gt-fixer.json` the `shell` allow list also adds bare `git add` and `git commit`, with no path scope. The prompt says commits must be path-scoped. I could not confirm how Kiro orders rules. If a later allow overrides an earlier narrow allow, the path limits are gone. The files carry a `kiroUpgrade` fingerprint, so a Kiro upgrade probably generated them. | Do not commit these four files as they are. Either restore the committed versions or delete the three blanket allow entries and re-test that the auditor cannot write outside `docs/reports/`. Owner: Kiro, `.kiro/agents`. |
| A4-2 | Low | `.kiro/agents/*` (all four) | `tasks.md` task 92 says not to edit `.kiro/agents`, and the Ghost Host change does not need them. They are unrelated to the diff's purpose. | Commit them separately, or leave them out. Owner: Kiro. |
| A4-3 | Low | `playwright-full.txt` (repo root, untracked, 85 KB) | A raw Playwright run log. It is not ignored by git and is a build artifact. | Delete it, or add it to `.gitignore` (never `.kiro`). Owner: the person committing. |
| A4-4 | Low | `docs/user-test/translation-review.*`, `i18n/index.ts` `host.*` hi and gu | The Hindi and Gujarati host lines are machine-translated, and `tasks.md` 92.5 says native review is still open. | This is already tracked. Keep it open before the final claim of full Hindi and Gujarati support. Owner: owner/native reviewer. |

## Checks you asked for

- **Pure core:** `frontend/src/core/hostPolicy.ts` has no imports and no DOM, React or i18n access. All its functions are total: they take `unknown` junk and return a fixed result. It has no `any`, uses named exports only, and makes no vibrate, tone or earcon effect. Good. The only other `core` file touched is that new one, and `tasks.md` task 92.2 permits it.
- **Browser APIs:** the new speech work (`voiceLangName`, `onEnd`, `speakEpoch`) is in `drivers/speech.ts`. `flow/start.ts` only passes an `onEnd` callback. Good.
- **Tuned haptic values:** the diff has no changes to `vibrate`, `[50, 90, 50]`, `80`, the 70 ms and 450 ms timings, the hit radii, the proximity, sticky or heartbeat constants, or any `core` haptic file. `hapticEngine.ts` and `hitTest.ts` are unmodified. Good.
- **Weakened tests:** none found.
  - Every changed assertion follows an intentional copy or behavior change: host greeting, a short Start button name, the lang-offer flag written only after speech `end`, `GH-06` language name, and shorter error lines.
  - Several tests are stronger than before. `locale.firstRun.test.ts` now also checks that the flag is not set before `end`. `speech.voice.test.ts` adds three `onEnd` tests and a `voiceLangName` test. `host.screen.oracle` and `hostPolicy.prop` are new.
  - No `.skip`, `.fails` or removed test showed up in the diff. The `.fails` markers on P192 to P196 were meant to come out, and `tasks.md` says they did.
- **Accessibility:** the Start button's accessible name is now short ("Ghost Touch, Begin"), and the long greeting is spoken instead. The `height: 48px` removal in `explore.css` keeps `min-height: var(--gt-target, 48px)`, so the 48 px target stays. After a failed voice ask, focus now goes to the typing box (`openTextFallback`). Every call site sits inside a `try` whose `finally` (lines 1392 to 1405) resets the flag, so it cannot leak into a later ask. The `handleVoiceAsk` catch/return paths at lines 1188 and 1228 also lead into that outer `finally`.
- **Race handling:** `speakEpoch` is bumped on cancel, replacement, page hide, visibility hide, `stopSpeaking` and dispose, so a cancelled utterance cannot fire `onEnd`. Queued utterances keep theirs. This is correct, and the tests cover it.
- **Scope creep:** no new dependencies and no deleted files. `CONTRIBUTING.md`, `SUBMISSION_AUDIT.md` and the reports are untracked docs. They are harmless.

## Good areas

Ghost Host policy and its tests, the speech driver change, the flow and Explore wiring, and the test updates are sound.

## Verdict

**BLOCK**, only because of A4-1 and A4-2: the `.kiro/agents/*.json` changes must not ship. The source, test and doc changes (everything except `.kiro/agents/` and `playwright-full.txt`) are SHIP-quality. Once the four agent files are reverted or fixed and the log file is dropped, the verdict is SHIP.
