# T05 report — Browser drivers

Builder: **Claude Code (builder stand-in for agy)**, 2026-10-31. `agy --print` exists, but headless mode auto-denies any shell command that is not allow-listed ("a tool required the command permission that headless mode cannot prompt for"). Two attempts (with and without `--settings` allow-rules) produced no files. The only remaining option was `--dangerously-skip-permissions`, which I did not use without approval. Per the session plan I built T05 myself, following `AGENTS.md` exactly (ownership, TEMP stub, no new dependencies, no router, no `.env`, no git).

## Files changed
New:
- `frontend/src/_temp/hapticTypes.stub.ts` (TEMP stub: `Effect`, `HapticConfig`, `DEFAULT_HAPTICS`; types and constants only)
- `frontend/src/drivers/haptics.ts`, `audio.ts`, `speech.ts`, `index.ts` (`runEffects`, `createBrowserDrivers`), `hashRoute.ts`
- `frontend/src/screens/Debug.tsx`
- `frontend/tests/drivers.haptics.test.ts`, `drivers.audio.test.ts`, `drivers.speech.test.ts`, `drivers.runEffects.test.ts`

Edited:
- `frontend/src/App.tsx` (renders `Debug` when the hash is `#/debug`)
- `frontend/src/i18n/index.ts` (new `debug.*` strings)
- `frontend/src/styles/global.css` (`.gt-debug*` styles, appended)
- `docs/handoffs/KIRO-PAUSE.md` (stub registered), `docs/BUILD_LOG.md`

No Kiro-owned file was touched.

## Commands and real results (run from `frontend/`)
| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run build` | OK (12 precache entries) |
| `npx vitest run tests/drivers` | 4 files, 36 tests, all pass |
| `npm test` (7 runs) | 80 tests. **Passes in 6 of 7 runs; 1 run failed in `tests/hitTest.prop.test.ts` (P1)**, a Kiro-owned property test. See "Needs from Kiro" 1. My tests passed in every run. |
| architecture grep (`navigator`, `AudioContext`, `speechSynthesis`, `SpeechRecognition`, `window.`, `document.`) in `src/` | hits only in `drivers/` and the pre-existing `main.tsx` (`document.getElementById`) |
| `console.log` / `any` in `src/` | none |

## DoD checklist
- [x] `npm test` passes, new driver tests included (with the flaky Kiro P1 caveat above).
- [x] `tsc --noEmit` clean. [x] `npm run build` succeeds.
- [x] Tests: unsupported vibrate returns false; `runEffects` dispatches each kind; `speak` cancels first; `listen` rejects `timeout` at exactly 6000 ms and stops the recogniser; `setTone(null)` before `unlock` does not throw. Plus edge cases (throwing host, double unlock, resume refused, settle-once, bad beep input, fade-out maths).
- [x] Browser APIs only in `drivers/` (and `main.tsx`).
- [ ] **`#/debug` on the Nord CE6 over HTTPS: NOT DONE** (needs your phone). `Debug` renders in a server-render smoke test (status text and all 8 control labels present), but no real device was tested. Vibration, audio unlock, speech and `listen` are unverified on hardware.
- [x] No edits outside "Files you own" (plus the listed shared files `i18n`, `global.css`, `BUILD_LOG`).

## Deviations from the brief
1. **Added `drivers/hashRoute.ts`.** The brief allowed a hash check in `App.tsx`; I moved `window.location`/`hashchange` into `drivers/` and used `useSyncExternalStore` in `App.tsx`, so `App.tsx` has no browser API calls and the page appears even when you change only the hash.
2. `ListenFailure` has a fifth value, **`'failed'`** (network, aborted, `start()` throwing), beyond the four in the brief, so errors are not mislabelled as "no speech".
3. `AudioDriver` also exposes `state`, and `SpeechDriver` exposes `canSpeak`, for the debug page.
4. The fade-out is a time constant (0.03 s). After 100 ms the gain is about 3.6% of the tone level (about -29 dB), which I judge inaudible; it is not an exact zero. Documented in `audio.ts` and covered by a test.

## Needs from Kiro
1. **P1 (`frontend/tests/hitTest.prop.test.ts`) is flaky, failing roughly 1 run in 4 to 7.** Seed `1149324890`; counterexample: two points at `x = 4.2e-45`, with `y` of `0` and `1.4e-45`, in a 1 × 1.0000001 viewport. They land on the same pixel, so `hitTest` returns `p0` for `p1` (a distance-0 tie). Fix the generator to make points distinct on screen (for example, require a minimum separation or filter on the screen positions), not `hitTest`. Not edited by me (Kiro-owned).
2. Replace the TEMP stub with the real `core/hapticEngine.ts` exports (three import lines; see the register in `KIRO-PAUSE.md`).
3. Open from earlier reviews (unchanged): bar-edge hits in `hitTest.ts`; `Polyline.points` schema typing.

## For you to test on the phone (Chrome, HTTPS)
1. Open `<site>/#/debug`. Check "Vibration API: supported".
2. Tap "Line buzz", "Corner pattern" and "Stop vibration"; each should buzz as in `prototypes/haptics-test.html` and the message shows `returned true`.
3. Tap "Tone low", "Tone high", "Tone off"; "Beep". Sound should start after your first tap.
4. "Speak sample" speaks "Point B. This is a speech test." "Listen" should hear a phrase and show it (or say why not).
5. Repeat with TalkBack on, using double-tap on each button.

## Independent review and fixes (added after `docs/reviews/T05-review.md`, verdict SHIP)
- Review findings 1 and 2 (uncommitted edits in `frontend/tests/hitTest.prop.test.ts` and `.kiro/specs/ghost-touch/tasks.md`): **not made by T05.** Both were already in the working tree when this session started, after commit `f5de39d`: the `!` non-null assertions fixed a `tsc` error in the P1 test, and Task 3.4 was reset from `[-]` to `[ ]`. They are recorded at the top of `docs/handoffs/KIRO-PAUSE.md`. Kiro should adopt or revert them.
- Finding 3 (phone test) stays open: it needs your phone.
- Low findings fixed: unmount cleanup in `Debug` (tone and motor stopped), a throwing `AudioContext` constructor is now treated as "unavailable", and a second `listen()` now ends the first session. Two new tests cover the last two. Findings 4 (audio status text can lag after an async resume) and 8 (fade-out time constant) are left as they are; changing the fade needs your approval.
- After the fixes: `tsc` clean, `npm run build` OK, 82 tests. The Kiro-owned P1 flake showed up in 2 of my 10 full-suite runs, and in 0 of the reviewer's 6, so it is intermittent.
