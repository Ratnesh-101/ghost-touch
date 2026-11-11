# Lane r7-flow (fixes for the Nov 12 Kiro audit: app flow, Correct, Teach, share)
Read AGENTS.md first. Never open `.env*`. Do NOT edit `frontend/src/core/`, `.kiro/`, Kiro property tests, `screens/Explore.tsx` (another lane owns it), `flow/a11yFeatures.ts`, or the tuned haptic values. No shell commands. Report first: docs/reports/agy-r7-flow-report.md (Status IN PROGRESS, DONE at the end, DEFERRED list). One BUILD_LOG entry (tool = "agy, reviewed by Claude"). Real tests only (each fails on the old code and passes on the new).

Source: docs/reviews/kiro-audit-2026-11-12-flow.md (and -core.md for CORE-A9). Fix exactly these:

- FLOW-01 (Medium) Correct.tsx handleSave and App.tsx handleSaveCorrect: a save still validating when the user leaves Correct with system Back (and confirms discard) later calls onSave, forces Explore with the edited scene and writes it to the saved list. Ignore a completed save when Correct is no longer the active screen (an active ref in Correct and/or a check in handleSaveCorrect), and abort or ignore the validate result. Test as described in the audit.
- FLOW-03 (Medium) ShareError.tsx: on a cold open with a broken share link nothing is spoken and nothing is focused. Focus the heading or message (tabIndex -1) on mount and/or render the message with role="alert"; keep the existing behaviour on a later hashchange.
- FLOW-04 (Medium) App.tsx handleOpenSharedDiagram: reset `lastSavedDiagramId.current = null` and call `updatePhotoUrl(null)` like handleScene does, so Save after Correct on a shared diagram cannot overwrite another saved entry.
- FLOW-05 (Medium) Teach.tsx handleLoadScene: if the editor has unsaved edits, ask for confirmation before replacing it (reuse the existing confirm-leave style and string; add an i18n key in en, hi and gu only if needed, with rows in docs/user-test/translation-review.csv and .md); declining keeps the current work.
- CORE-A9 (Low) components/teach/LoadModal.tsx: show the language-aware title (savedTitle(entry.scene, current language)) like the Saved screen does.

Skip FLOW-02 (share Back history; it needs a real browser to verify) and the Low findings. Done when tsc 0 errors, the whole vitest suite is green and the build is ok.
