# T05 review
Reviewer: Claude Code subagent | Verdict: SHIP

Ship the code. Two process items need the owner's attention (F1, F2). The phone test is still pending.

## Findings
| # | Severity | File:line | Problem | Fix |
|---|---|---|---|---|
| 1 | Medium | `frontend/tests/hitTest.prop.test.ts:70-71` (working tree vs HEAD) | This Kiro-owned file has an uncommitted edit (`points[s.aIdx]!.id`, `points[s.bIdx]!.id`). The report says "No Kiro-owned file was touched" and the BUILD_LOG entry says P1 was "Not edited". The edit is harmless, but I cannot attribute it to T05 or to an earlier session. | Confirm who made the edit. If it was T05, list it under "Deviations" in the report. If an earlier session made it, say so in BUILD_LOG. Kiro should adopt or revert it. |
| 2 | Medium | `.kiro/specs/ghost-touch/tasks.md:25` (working tree vs HEAD) | Task 3.4 changed from `[-]` to `[ ]`. AGENTS.md rule 4 and the brief forbid builders from touching `tasks.md`, and the report does not mention this edit. | Confirm who made it. Restore `[-]`, or let Kiro set the status. |
| 3 | Medium | Brief DoD item "`#/debug` verified on the Nord CE6 over HTTPS" | Not done. Vibration, audio unlock, TTS and `listen()` are unverified on hardware. The report states this honestly. | The user runs the 5-step phone list in the report. Include TalkBack double-tap and a check that audio actually starts. |
| 4 | Low | `frontend/src/screens/Debug.tsx:35-38,69` | The "Audio" status line is read once per render. `unlock()` sets only a re-render counter, and `ctx.resume()` finishes asynchronously. The page can keep showing `suspended` after audio is running. | After `resume()` resolves, trigger a refresh, for example by returning a promise from `unlock`. Or leave it, since it is a debug page. |
| 5 | Low | `frontend/src/screens/Debug.tsx:28-33` | There is no unmount cleanup. If the hash changes while a tone is on, the oscillator keeps playing at gain 0.15 and the next `createBrowserDrivers()` makes a second context. | Add `useEffect(() => () => { drivers.audio.setTone(null); drivers.haptics.stop(); }, [drivers])`. |
| 6 | Low | `frontend/src/drivers/audio.ts:88` | `factory()` runs `new AudioContext()` unguarded. On some browsers it throws (too many contexts, or blocked by policy), which would break the tap handler. | Wrap it in try/catch and set `unavailable = true`. |
| 7 | Low | `frontend/src/drivers/speech.ts:109-115` | Calling `listen()` twice runs two recognisers at once, and nothing cancels the first. The Debug button can trigger this by double-tapping. | Keep a single active session and abort it when `listen` is called again, or reject with `busy`. |
| 8 | Low | `frontend/src/drivers/audio.ts:57` (Req 5.3) | The fade is a time constant, so the gain at 100 ms is about 3.6% (about -29 dB), not zero. The brief says "inaudible within 100 ms". The maths are documented and tested, and I judge this acceptable. | Optional: use τ = 0.02 (0.7% at 100 ms), but only if it still sounds smooth on the phone. Do not change it without the user's approval. |
| 9 | Low | `frontend/src/screens/Debug.tsx:75-77` | The status message is announced through `role=status`. The static support table (`dl`) is not a live region, which is acceptable. A screen-reader user gets the result of each press, but not the changed audio state (see 4). | Covered by 4. |

## DoD check
- [x] `npm test`: 6 consecutive runs, each 9 files and 80 tests passed. The flaky P1 test did not fail in any of my runs. The report says it failed once in 7. I could not reproduce that.
- [x] `npx tsc --noEmit`: clean, no output.
- [x] `npm run build`: succeeded (PWA, 12 precache entries).
- [x] Required unit tests exist and pass in `tests/drivers.*.test.ts`:
  - unsupported vibrate returns false
  - `runEffects` dispatches each kind
  - `speak` cancels first
  - `listen` rejects `timeout` at 6000 ms with fake timers and stops the recogniser (`speech.test.ts` lines 100-109)
  - settle-once (line 145)
  - `setTone(null)` before `unlock` does not throw
- [x] Architecture grep for `navigator|AudioContext|speechSynthesis|SpeechRecognition|window.|document.|localStorage` in `src/` outside `drivers/`: only `main.tsx:6` (`document.getElementById`), which is allowed. `App.tsx` has no browser API. The hash code was moved into `drivers/hashRoute.ts`, which is a justified deviation from the brief.
- [x] No `any`, no `console.log` in `src/`. No new dependencies. No router.
- [x] Stub: `_temp/hapticTypes.stub.ts` has the correct first line. It matches the `design.md` and `tech.md` shapes. It holds types and constants only. Haptic values are unchanged (80 / 70 / [50,90,50] / 450 / 22 / 14). It is imported in exactly two places: `drivers/index.ts:9` and `screens/Debug.tsx:10`.
- [ ] `#/debug` on a real phone: not done (finding 3).
- [~] "No edits outside files you own": T05's own files are clean. See findings 1 and 2 for the Kiro-owned modifications I cannot attribute.

## Other checks
- **Ownership:** `git status` shows `frontend/src/core/**`, `backend/app/schema.py`, `validate.py` and `scene.gen.ts` untouched. The only Kiro-owned changes are findings 1 and 2.
- **Interfaces:** they match `design.md` and the brief. `Effect` is switched exhaustively with a `never` check. `runEffects` is pure dispatch with no state or timers. `speak` passes `lang` and defaults to `en-IN`.
- **listen():** it settles exactly once (guard flag). It clears the timer, nulls the handlers and calls `stop()` in try/catch. `start()` throwing is handled. `onend` without a result gives `no-speech`. There is no timer leak and no handler left attached.
- **Audio:**
  - There is a single oscillator, created once.
  - `setTone` before `unlock` is a no-op.
  - Redundant `unlock` calls only resume.
  - `beep` uses a separate auto-stopped oscillator and does not touch the main tone.
- **TalkBack:** `Debug.tsx:63` unlocks on both `pointerdown` and `click` in the capture phase. A TalkBack double-tap fires `click`, so unlock runs before the button handler. Chrome grants user activation on click, not on touch `pointerdown`. The `pointerdown` unlock can therefore leave the context suspended, and the `click` unlock then resumes it. This works.
- **Accessibility:** buttons use `AccessibleButton` (`.gt-control`, min 48 px, visible text as accessible name). Strings go through `t()`. The status line uses `role=status`, `aria-live=polite`.
- **Scope creep:** none. The extra `ListenFailure` value `'failed'` and the extra `state` and `canSpeak` getters are reported and reasonable.

## Needs from Kiro (core changes I should make)
- Swap the TEMP stub for the real `core/hapticEngine.ts` exports (two import lines, registered in `KIRO-PAUSE.md`).
- Make P1 generate points that are distinct on screen. The report documents the counterexample, seed 1149324890.
- Decide on the uncommitted edits in findings 1 and 2.
