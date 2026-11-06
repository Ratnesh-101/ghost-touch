# Session handoff, 2026-11-06 night (Claude Code). Read after `SESSION-2026-11-06-evening.md`.

## Done (merged to main, built by agy, reviewed by Claude; flags OFF)
- **Guide my finger**: `frontend/src/guide/` (pure), `flow/guide.ts`, guide tone in `drivers/audio.ts`, voice commands, "Guide me" button on Ask answers with a `target` (backend `AskResponse.target`, validated server-side).
- **Teacher verify & share**: `frontend/src/share/` (lz-string codec, client validator, QR), `#s=...` student open with "Verified by" banner, `#/teach` editor (reuses Correct pipeline).
- P20 hex allow-list emptied. Contract: `docs/briefs/guide-share-contract.md`. Reviews: `docs/reviews/agy-*.md`.
- Numbers: frontend 1420 tests / 105 files, backend all pass, tsc/build/ruff clean, precache 531.6 to 639.4 KiB, core zero diff.

## Flags (owner decides after the phone test)
Vercel env: `VITE_FEATURE_GUIDE=1`, `VITE_FEATURE_SHARE=1`; then turn on the toggles in Settings. Defaults stay OFF until the phone test passes.

## Phone test before flags ON (OnePlus Nord CE6)
1. Guide, TalkBack OFF: Explore a sample, Ask "where is the right angle?", tap Guide me. Pulses speed up near the target, spoken hints (left/up...) arrive every ~2.5 s, arrival buzz plus label. Repeat with "take me to B", "find the peak", "next corner".
2. Guide, TalkBack ON (double-tap-hold-drag): same, plus say "stop", press Back, and wait 20 s (each must say "guide stopped").
3. Speaker vs headphones: hints must be audible on the speaker; stereo pan only on headphones.
4. Share: on a laptop open `/#/teach`, fix a label, Mark verified, copy link/scan QR. On the phone open the link cold: hears scene then "Verified by <name>". Open again in airplane mode (after first load). Open a truncated link: friendly spoken error and "Go to start".
5. Check the Explore canvas still gets a TalkBack name on entry (earlier open item).

## Open / notes
- Client validator `share/validate.ts` mirrors `backend/app/validate.py` by hand; if the backend rules change, update both.
- Add new i18n keys already appended to `docs/user-test/translation-review.*` for the native check.
- `@types/qrcode` must NOT be installed (breaks test typings); see BUILD_LOG.
- Kiro is still unused for these features; list them in the Kiro review queue (`docs/handoffs/kiro-prompts.md`).
