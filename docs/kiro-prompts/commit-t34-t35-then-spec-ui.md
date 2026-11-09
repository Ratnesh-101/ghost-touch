# Kiro prompt: commit T34 and T35, then spec the Ghostwriter UI (Requirement 20)

Paste this into Kiro chat.

---

Two steps, in order.

STEP 1: commit your finished work as two separate commits, no push.
- Commit A, message `kiro: T34 Ghostwriter core: addPoint, addSegment, Requirement 19, P54-P57`. Include only: `frontend/src/core/correct.ts`, `frontend/tests/correct.ghostwriter.prop.test.ts`, and the T34 parts of `.kiro/specs/ghost-touch/requirements.md`, `design.md`, `tasks.md`.
- Commit B, message `kiro: T35 disputed-angle wording per language (M4-10)`. Include only: `frontend/src/core/verify.ts`, `frontend/src/flow/ask.ts`, `frontend/src/flow/navigation.ts`, `frontend/src/i18n/index.ts`, `frontend/tests/n2.round4.test.ts`, `docs/user-test/translation-review.csv` and `.md`, and the T35 parts of the spec files.
- `docs/BUILD_LOG.md` and `docs/reviews/session-review-latest.md`: put each in the commit it belongs to, or a third `kiro: log and review notes` commit.
- Use `git add <file>` then `git commit -m ... -- <same files>` in ONE command so nothing stays staged. If a spec file mixes T34 and T35 hunks, use `git add -p`. Do not touch any file not listed. Show me `git log --oneline -4` and `git status --short` when done.

STEP 2: spec only, NO code. Add Requirement 20, "Ghostwriter in Teach mode" (EARS form) to `.kiro/specs/ghost-touch/requirements.md`, a short design section, and a task 36 in `tasks.md` that an agy lane will implement (do not tick it). agy builds the UI to this spec, so make every line testable:
- 20.1 Teach mode only; student Explore mode is unchanged.
- 20.2 Add point: a labelled control (48x48 px minimum, accessible name, spoken label) arms add mode; the next canvas tap calls `addPoint` at the tapped normalized position; the optional label may be blank (spoken as "Point D"); speak a confirmation with the new id and label.
- 20.3 Add edge: pick one existing point, then another, then `addSegment`; if the result is the SAME scene object, speak the reason (same point, or already joined) instead of staying silent.
- 20.4 Every add goes through the existing history (`apply` action), so undo and redo work, and the undo is announced.
- 20.5 A scene may hold at most 500 points (backend limit, `MAX_SCENE_POINTS`); adding past it is refused with a spoken message.
- 20.6 Spec Ghost is re-run after an add exactly as for other edits; a scene that was silent may now report a disagreement, and that must not be suppressed or softened. No new string may contain "verified", "correct", "checked" or "approved".
- 20.7 Every new string exists in en, hi and gu in `frontend/src/i18n/index.ts` and is listed in the translation review sheets for native review.
- 20.8 The pure helper logic the lane adds (id/label handling, the cap check, the no-op reason) lives in `flow/` or `core/` with no browser APIs and gets a property test at 200 runs or more (name them P58 onward in the design).
Constraints: do not edit `Correct.tsx`, `Teach.tsx` or any other app code in this step; do not touch the tuned haptic values.

Done when: both commits exist, `git status` shows only agy's untracked files and nothing of yours, and requirements.md, design.md and tasks.md contain Requirement 20 and task 36 (unticked).
