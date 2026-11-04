# Review: lane D (voice, languages, earcons, Explore commands), branch agy/voice
Reviewer: Claude Code. Builder: Antigravity (agy). Date: 2026-11-04.

**Verdict: APPROVE (second pass). First pass: CHANGES**

- First pass failed: `tsc` about 45 errors (test mocks missing `playEarcon`, unused imports, a type mismatch in `svara.ts`), 4 failing tests, failing build, and `localStorage` used outside `drivers/`. The agent could not run frontend checks because `node` was not on its PATH. It was sent back with `docs/briefs/agy-voice-fix.md` and node on PATH.
- Second pass, verified by me: `tsc --noEmit` clean; `vitest` 313 passed (30 files); `npm run build` OK; `localStorage` moved to `drivers/storage.ts`.
- Scope: `drivers/{speech,audio,index,storage}`, `i18n`, `flow/{commands,svara,ask,start}`, `screens/{Explore,Capture}`, `components/{LanguageSelector,RateSelector}`, styles, tests, `public/voice/manifest.json` (no audio shipped). One file outside the allowed list: `App.tsx` (3 lines passing the language to speech; accepted).
- Kiro-owned: nothing touched. `flow/commands.ts` imports only the public `toScreen` and the scene types from `core`; the haptic engine is not called or edited; tuned haptic values unchanged.
- Follow-ups (not blocking): (1) `flow/svara.ts:90` still builds `new Audio(src)` as a default factory; per AGENTS.md rule 7 it belongs in `drivers/`. (2) Hindi and Gujarati strings are machine-translated and must be reviewed by a native speaker before the school session. (3) Voice commands, earcons and the language selector are untested on a phone, and the SVARA slot ships no audio.
