# Lane B-host evidence (Ghost Host wiring), Kiro

Spec first: Requirement 53.15 to 53.18 and task 93 in `.kiro/specs/ghost-touch/`. No commit was made (wa-index: lanes do not commit). `.env` files not opened. Tuned haptic values and `frontend/src/core/**` untouched (`hostPolicy.ts` is used, not changed).

## Gate
- `npx tsc --noEmit`: exit 0, no output.
- `npx vitest run`: 267 files passed, 3419 tests passed, 1 todo, 0 failed (baseline before the lane: 264 files, 3384 tests; the difference includes `host.flow.prop.test.ts`, `host.wiring.test.ts` and files other lanes added).
- Not run: `npm run build`, Playwright (orchestrator runs them). Nothing tried on a phone or with TalkBack.

## Findings
| Finding | Status | Where |
|---|---|---|
| W1 next-step lines | Explore, Raw Mode, Back to Start, Back to Capture: done. Correct, Teach, Saved, Settings, Ask: OPEN (screens are lane B-a11y files or in `Explore.tsx`; helper `hostNextKey(screen)` is ready). Build already speaks its own next step in `build.prompt`; left as is | `flow/navigation.ts`, `App.tsx`, `flow/host.ts` |
| W2 policy wired | `flow/host.ts` (`createHostFlow`, `hostFlows`) used by `askErrorMessage` and `captureErrorMessage`; success and leave reset; Capture unmount leaves the flow; `AskManager.abort()` leaves the ask flow. Save flow: not wired | `flow/ask.ts`, `flow/capture.ts`, `screens/Capture.tsx` |
| W3 joke baked into plain string | Fixed: plain keys carry no joke; jokes are `<key>.joke` in `ENGLISH_ONLY` (joke last, 8 words or fewer) | `i18n/index.ts` |
| W4 three causes | `ask.errorBusy`, `ask.errorServer` (http), `ask.errorBadResponse` in en, hi, gu | `i18n/index.ts`, `flow/ask.ts` |
| W5 text box location | `ask.errorUnsupported`, `ask.errorEmpty` in en, hi, gu, added to the oracle list | `i18n/index.ts`, `tests/host.i18n.oracle.test.ts` |
| W6 action word | `capture.errorType`, `errorSize`, `errorPdfPassword`, `errorPdf` in en, hi, gu; every `ask.error*` and `capture.error*` en line is linted with an action word | `tests/host.wiring.test.ts` |
| W7 voice notice | Read from `ENGLISH_ONLY` in every language; hi and gu rows removed | `drivers/speech.ts`, `i18n/index.ts` |
| W8 Back wording | `leaveByBack` and `App.tsx` speak `host.start.next` and `host.capture.next`; `host.explore.next` replaces the gesture hint | `flow/navigation.ts`, `App.tsx` |
| A3-01 warm backend | Already present in `App.tsx` and `Capture.tsx` when this lane started; a source test now pins it | `tests/host.wiring.test.ts` |
| A3-02 online but unreachable | New `capture.errorServer` for network (online), http and bad-response; only an offline device says "offline" | `flow/capture.ts` |
| A8 wording table | Jokes taken from the table where they are 8 words or fewer and about the creature, as separate joke keys. Not taken: jokes baked into plain lines, jokes on every next-step line (breaks 53.6, one joke per three lines), and rewrites of lines outside the capture and ask flows (saved.*, share.*, teach.*, correct.validationFailed: those are W9 or other lanes). No joke on `ask.errorDenied` or `ask.errorUnsupported` (protected) | `i18n/index.ts` |

## Design choice to review
Joke clauses live in `ENGLISH_ONLY`, outside `tables`, because three existing tests (`k8.i18n`, `lab.i18n`, `correct`) require identical key sets in en, hi and gu, and Requirement 53.11 says hi and gu carry no joke. This also means a Hindi or Gujarati user can never hear one.

## Tests changed (intended behaviour only)
- Back announce keys (`host.*.next`): `correct.back`, `h6.nav`, `m3.sharedLinkGate`, `build.wire`, `build.navigation.oracle`, `round2.navigation.prop`, `navigation.hint`.
- Explore and Raw entry contain `host.explore.next` / `host.raw.next`: `navigation.hint`, `overview`, `flow.explore`, `k1.verifyWiring`, `q2.round5`.
- Failure lines carry a joke on the first failure only: `flow.ask`, `flow.ask.abort`, `hx5.askResilience`, `ask.errors`, `flow.capture`, `capture.warm`, `k6.pwa-offline`, `n2.round4`.
- Voice notice: `round2.sources`. New: `host.flow.prop.test.ts` (P199, mutants killed: no failure count, jokeless ignored, success and leave not resetting, joke id not recorded), `host.wiring.test.ts`.

## Open for the owner or other lanes
- Spoken `host.correct.next`, `host.teach.next`, `host.saved.next`, `host.settings.next`, `host.ask.next` need edits in `Correct.tsx`, `Teach.tsx`, `SavedDiagrams.tsx`, the Settings screen and `Explore.tsx`.
- Save-flow joke wiring (`flow/saved.ts`), W9 to W14.
- `docs/user-test/translation-review.csv` and `.md`: add rows for the new hi and gu keys (`ask.errorBusy`, `ask.errorBadResponse`, `capture.errorServer`, and the reworded `ask.errorServer`, `ask.errorUnsupported`, `ask.errorEmpty`, `capture.errorType`, `errorSize`, `errorPdfPassword`, `errorPdf`) and remove the `speech.noVoiceNotice` hi and gu rows. All new Hindi and Gujarati text is machine-written and needs a native reader.