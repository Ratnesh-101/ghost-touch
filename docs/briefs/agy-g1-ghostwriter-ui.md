# Lane g1-ghostwriter-ui (Teach-only UI for Requirement 19)
Read AGENTS.md first. Never open `.env*`. Do NOT edit anything under `frontend/src/core/` (Kiro's pure core) or the tuned haptic values. Create `docs/reports/agy-g1-ghostwriter-ui-report.md` first (Status IN PROGRESS, DONE at the end).

Goal: let a teacher in Teach / Correct mode add a point the vision model missed and connect two points with a segment, using the pure functions already in `frontend/src/core/correct.ts`: `addPoint(scene, x, y, label?, id?)` and `addSegment(scene, a, b, id?)`. Both return the SAME object on a no-op (bad input, duplicate, same endpoints), so "nothing changed" is `next === scene`. Apply edits through the existing history (`applyEdit` / `historyReducer` action `apply`) so undo/redo work with no new action type.

Scope: Teach-only. Student Explore mode must not change. Read how Correct.tsx, Teach.tsx, flow/correct.ts, flow/correctCanvas.ts and flow/teach.ts already handle move / rename / delete and follow the same pattern (flow logic in `flow/`, screens thin).

Requirements:
1. "Add point": a clearly labelled button (min 48x48 px, accessible name, spoken label) that arms add mode. The next tap on the canvas calls `addPoint` at the tapped normalized position (use the existing screen-to-scene conversion). Then offer an optional label text field (blank allowed; blank is spoken as "Point D" by the existing vertex.unlabelled logic). Speak a confirmation that includes the new point's id and label.
2. "Add edge": a button that arms a two-step pick: choose first existing point, then second; call `addSegment`. If the result is unchanged (`next === scene`), speak a short reason (same point, or already joined) instead of silently doing nothing.
3. Undo/redo must revert each add; announce what was undone.
4. After any add, re-run the existing Spec Ghost check if Correct/Teach already does so for other edits, and do not special-case or soften its wording. A scene that was silent may now report a disagreement: that is intended; do not suppress it. Never add the words "verified", "correct", "checked" or "approved" to any new string.
5. i18n: add every new string in en, hi and gu in `frontend/src/i18n/index.ts` (use the existing key style, e.g. `correct.addPoint...`), plus matching rows appended to `docs/user-test/translation-review.csv` and `.md` marked for native review. No English leaking into hi/gu.
6. Respect the point limit: the backend caps a scene at 500 points (see backend/app/validate.py MAX_SCENE_POINTS); refuse to add past it with a spoken message rather than letting the scene become invalid.
7. Tests (vitest, in the style of tests/correct.flow.test.ts and tests/correct.lab.test.tsx): flow-level tests for add point, add edge, no-op reasons, undo, the 500-point cap, and an i18n completeness test that every new key exists in en/hi/gu. Keep every test meaningful (no always-true assertions).
Do not edit the already-merged files' behaviour outside this feature. One BUILD_LOG entry (tool = "agy, reviewed by Claude").
