# AGENTS.md — rules for Antigravity (agy), the builder

You build what a brief in `docs/briefs/` tells you to build. Claude Code plans and reviews (Kiro, the other builder, is paused until credits return; see `docs/handoffs/KIRO-PAUSE.md`). Read the brief, `.kiro/steering/*.md`, and the spec in `.kiro/specs/ghost-touch/` first. If a brief conflicts with the spec, the spec wins; say so in your report.

1. **Ownership.** Never edit Kiro-owned files: `frontend/src/core/**`, any `*.prop.test.ts` / `test_*_props.py`, `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts`, `.kiro/**`. If one needs a change, put it under "Needs from Kiro" in your report.
2. **Never wait.** If something you need isn't built, don't stop and don't ask. Use rule 3.
3. **TEMP stubs.** When a Kiro-owned module you depend on doesn't exist yet:
   - Create a stub outside the owned folders: `frontend/src/_temp/<name>.stub.ts` or `backend/app/_temp/<name>_stub.py`.
   - First line: `// TEMP-STUB: replaced by <real path> (Task N, Kiro). Do not extend.`
   - Match the names and signatures in `design.md` exactly, so Kiro's real module drops in by changing one import.
   - Keep it minimal and obviously throwaway. Don't tune or invent haptic values; use the `tech.md` table. A stub is not a claim to have done the task, and it gets no property tests.
   - Import the stub from as few places as possible (one import line per consumer).
   - Add a row to the "TEMP stub register" in `docs/handoffs/KIRO-PAUSE.md`, and list the stubs in your report.
4. **No git.** Don't commit, push, branch or open PRs. Don't tick checkboxes in `tasks.md`.
5. **Secrets.** Never open, print or copy any `.env` file. Keys come from environment variables only. Only `.env.example` is committed.
6. **Ask first** (put it in the report, don't block): new dependencies, stack changes, deleting files, paid services. Don't change the tuned haptic values in `tech.md`.
7. **Architecture.** Browser APIs only in `frontend/src/drivers/`. Every user-facing string through `t()`. Every control has an accessible name and a target of at least 48×48 CSS px. Every state change is spoken. No `any`, no `console.log` / `print()`.
8. **Finish with proof.** Run the brief's Definition of Done commands and record the real results, including failures. Write `docs/handoffs/TNN-report.md` last. Add a `docs/BUILD_LOG.md` entry (tool = Antigravity) listing what you built, what broke, and files touched.
