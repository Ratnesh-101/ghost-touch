# Kiro prompt: T37, delete polylines and bars (core), fc.double cleanup, validator parity test

Paste this into Kiro chat.

---

Three of your own open items from tasks.md task 20, as one spec-first task "37". Spec first (requirements.md, design.md, tasks.md), then code, then tick. Commit when done, one commit per sub-task, no push, `git add <file>` then `git commit -m ... -- <same files>` in one command.

37.1 = task 20.5 (Req 9.2): Correct mode cannot delete polylines or bars.
- Write the acceptance criteria (Requirement 21, EARS) for `deletePolyline(scene, id)` and `deleteBar(scene, id)` in `frontend/src/core/correct.ts`: remove exactly that element, touch nothing else, an unknown id returns the SAME scene object, never mutate the input, result still passes `validateSceneInvariants`, undoable through the existing history with no new action type. Deleting a polyline that is the only drawable element is allowed in core (the validators decide what a share link accepts); say so.
- Implement both (pure, immutable, same style as `deleteSegment`).
- Property tests P62 onward, at least 200 runs, mutation-checked as you did for P54-P57: delete keeps invariants and removes exactly one element; unknown id returns the same object; delete then undo restores the scene exactly; the other element kinds are byte-for-byte unchanged.
- Do NOT edit `Correct.tsx` or any screen: the wiring is a later agy lane. Note in the design which control names and spoken strings that lane must add (list the i18n keys, en/hi/gu placeholders).

37.2 = task 20.9: replace the four remaining `fc.float` uses in `frontend/tests/*.prop.test.ts` with `fc.double` (keep the same ranges; add `noNaN: true` where the old float generator could not produce NaN). Tests must stay green with the same run counts. Do not change any test that agy lanes p1, p2, p3 or g1 are editing right now: if `git status` or `git log -5 -- <file>` shows a file was changed in the last hour by a non-Kiro commit, skip that file and say so.

37.3 = task 20.10: `frontend/src/share/validate.ts` and `backend/app/validate.py` are hand-mirrored. Add a parity test with a shared fixture: create `backend/fixtures/validator_parity.json` (a list of named scenes, each with the expected verdict `accept` or `reject` and, for rejects, a short reason key) covering at least: coordinates exactly at 1.02 / just over, NaN-like values encoded as strings, duplicate ids across kinds, dangling segment endpoints, a segment with a == b, empty scene, more than 300 points, an aspect of 0 and of 1e200, a very long label. Add one pytest that runs the fixture through `validate_scene` and one vitest that runs it through the frontend validator. Where the two disagree, DO NOT change either validator: record each mismatch in `docs/reports/validator-parity.md` (scene name, backend verdict, frontend verdict, which side looks right and why) and mark that fixture entry `"known_mismatch": true` so both tests still pass but list the mismatches. Backend note: the 0.02 clamp tolerance is the spec; the share-limit cap (300) is deliberately lower than the backend cap (500).

Rules: keep `core/` pure; do not touch the tuned haptic values, `hitTest`, `App.tsx`, `Explore.tsx`, `Correct.tsx`, `Teach.tsx` or `flow/`; add one BUILD_LOG line per sub-task (tool = Kiro).

Done when: tasks 37.1-37.3 are ticked and committed, tasks 20.5, 20.9, 20.10 are ticked with a pointer to 37, `npm test` and `pytest` are green, `tsc --noEmit` has 0 errors, and `docs/reports/validator-parity.md` lists every mismatch found (or says there are none).
