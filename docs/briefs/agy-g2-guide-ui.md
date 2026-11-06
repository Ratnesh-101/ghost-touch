# Lane g2-guide-ui (agy)
Read `docs/briefs/guide-share-contract.md` (Global rules, Guide contract, Ask-target contract) and AGENTS.md first.
Starts from a branch that already contains G1 (`frontend/src/guide/`) and G3 (`AskResponse.target`). Code against the contract; do not change `guide/` except to fix a real bug (report it).
Goal: "Guide my finger" in Explore, behind the flags.
Allowed files: `frontend/src/config/features.ts` (new), `frontend/src/flow/guide.ts` (new: glue that feeds pointer moves/ticks to `guideStep` and maps effects to drivers), `frontend/src/drivers/audio.ts` (add a guide tone with `StereoPanner`, falling back to no pan if unsupported; do NOT change the existing theremin, earcons or any tuned value), `frontend/src/drivers/index.ts` (effects wiring only), `frontend/src/screens/Explore.tsx`, `frontend/src/flow/commands.ts` (voice commands: "take me to <label>", "find <label>", "next corner", "stop", in en/hi/gu), `frontend/src/flow/ask.ts` + Ask UI (a "Guide me" button on an Ask answer that has a target), `frontend/src/components/LabSettings.tsx` (settings toggle), `frontend/src/i18n/index.ts`, `frontend/src/vite-env.d.ts`, new tests `frontend/tests/guide.ui.*.test.ts(x)`, `docs/user-test/translation-review.md` + `.csv` (append all new keys), report, BUILD_LOG.
Forbidden: `frontend/src/core/**` (zero diff; call the engine only through its public `step`), `.kiro/**`, `.env*`, tuned haptic values.
Requirements:
- Guide pulse uses the haptic driver's `vibrate(ms)` from guide effects (own constants from the guide module). While guiding, the theremin tone is suppressed and replaced by the guide tone (pitch from `pitchFor`, pan from `panFor`). Arrival: reuse the existing corner pattern + spoken label + `success` earcon, then end guide mode and restore normal Explore.
- SPOKEN HINT FALLBACK IS MANDATORY: hints are spoken via the speech driver regardless of stereo support; stereo is only a bonus (the phone speaker is mono). Test that hints are spoken when `StereoPanner` is unavailable.
- Cancel paths: voice "stop", Back button (stops guide first, does not leave Explore), 20 s timeout => speak "guide stopped". All three tested.
- Works with the relative cursor under TalkBack (the cursor norm position is the finger) and without TalkBack.
- Entry: (a) Ask answer `target` => "Guide me" button (48x48, accessible name) and spoken offer; (b) voice commands; (c) never auto-start.
- Flags: guide active only when `VITE_FEATURE_GUIDE === '1'` AND the setting is on; otherwise no button, voice commands fall through to existing behaviour, and the UI is unchanged (test both).
- All strings via `t()` in en, hi, gu.
Acceptance: new tests for flag off/on, cancel paths, spoken-hint-without-stereo, arrival once, voice parse en/hi/gu; whole frontend suite, tsc, build pass. Report real numbers and the bundle-size delta.
