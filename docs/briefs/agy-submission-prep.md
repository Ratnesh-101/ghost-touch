# Lane submission-prep (DOCS ONLY)
Read AGENTS.md first. Never open `.env*`. Edit only `docs/STEMERGENT_SUBMISSION.md`, `docs/DEMO_SCRIPT.md`, and add one `docs/BUILD_LOG.md` entry (tool = "agy, reviewed by Claude"). Create a short `docs/reports/agy-submission-prep-report.md` first. No source edits.
1. Fill `docs/STEMERGENT_SUBMISSION.md` (problem, who it helps, STEM connection, how it works, AI tools used, what's next) from README, `docs/WIN_PLAN.md`, `docs/BUILD_LOG.md`, `docs/KIRO_WRITEUP.md`.
   - Use `[FILL]` only for items only the owner can supply (names, school, links, student feedback, video URL).
   - Use `[RECOUNT]` for every test count or coverage number; do not invent numbers.
   - NEVER claim TalkBack, Guide my finger or Share were verified on hardware (see `docs/OWNER_CHECKLIST.md`; those are unverified, and their feature flags may be OFF).
   - Credit Kiro, agy and Claude Code honestly exactly as BUILD_LOG records them; do not attribute agy or Claude work to Kiro. Disclose Gemini as the vision model.
   - No claims such as "bug free" or "secure"; an open security/bug audit is in progress.
2. Create/overwrite `docs/DEMO_SCRIPT.md`: a Kiroween video script of at most 3:00 with timestamps, narration and on-screen actions, using only features that work today (samples, photo to scene, haptic tracing, theremin graph, Ask, Raw Mode, Hindi/Gujarati if verified in the repo). Mark any step that depends on an unverified feature as OPTIONAL.
Keep it concise and plain. Output copy-paste ready.
