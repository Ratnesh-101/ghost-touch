# Kiro prompts (paste into Kiro chat, one at a time)

Written by Claude Code, 2026-11-04. Open the folder that contains `.kiro/` (this repo root) in Kiro first. Kiro should do these **spec-first**: extend `requirements.md`, `design.md` and `tasks.md`, then implement, then write the property tests. Claude Code does not implement these tasks; it reviews them afterwards.

Why Kiro and not agy: these are the spec-driven, property-tested pieces that carry the Kiroween entry. agy lanes G (accessibility and mascot, `agy/a11y`) and H (README and `svara` driver fix, `agy/readme`) run in parallel and avoid these files, so conflicts should be small.

Current state: `main` has 313 frontend and 337 backend tests passing. New voice, language and storage code exists in `frontend/src/drivers/storage.ts`, `frontend/src/i18n/index.ts` (en, hi, gu tables; a test requires every key in all three languages).

---

## Prompt 1: Task 13, Saved diagrams and offline exploring (Requirement 11)

```
Read #product, #tech, #structure and #review. Then work spec-first on Task 13 (Requirement 11: saved diagrams).

1. Update requirements.md (acceptance criteria for: save on every successful scene load with a thumbnail and a spoken title; list saved diagrams by voice and by touch; open one while offline with no network call; delete one; a cap of 20 saved diagrams, oldest evicted first, never evicting one the user pinned), design.md (components, data model, error handling for storage-full and storage-unavailable) and tasks.md (sub-tasks 13.2 onward).
2. Keep the pure-core rule. Put ONLY pure logic in frontend/src/core/savedDiagrams.ts: serialise/deserialise a SavedDiagram {id, createdAt, title, thumbnailDataUrl, scene, pinned}, spoken-title generation from the scene (name, else kind plus the first labelled points, in the active language key), ordering, eviction choice, id generation from an injected clock/rng. No window, indexedDB or navigator in core.
3. Put IndexedDB in frontend/src/drivers/diagramStore.ts behind an interface (list, get, put, delete) with an in-memory fake for tests. Wrap every call in try/catch; if storage is unavailable the app must keep working and say so by voice.
4. Screen: a Saved list reachable from Capture ("Saved diagrams" button, 48x48 px, accessible name, spoken state changes). Every string through t() with en, hi and gu entries (the i18n parity test must pass).
5. Property tests (fast-check, in frontend/tests/savedDiagrams.prop.test.ts), add them to the P-list in design.md as P14 and P15: P14 serialise then deserialise returns an identical DiagramScene for any valid scene; P15 eviction never exceeds the cap, never removes a pinned entry, and always removes the oldest unpinned one.
6. Do not change the tuned haptic values. Do not touch the haptic engine. Run tsc, npm test and npm run build, tick tasks.md only for what is really done, and add a BUILD_LOG.md entry with tool = Kiro, including any real bug a property caught.
```

## Prompt 2: Task 11, Teacher Correct mode (Requirement 9)

```
Read #product, #tech, #structure and #review. Then work spec-first on Task 11 (Requirement 9: teacher correction).

1. Update requirements.md, design.md and tasks.md: Correct mode is for a SIGHTED teacher (so a visual overlay is fine, but every control still needs an accessible name and a 48x48 px target): show the detected scene on top of the original photo, drag points, edit labels, delete a point or segment, undo/redo, save. The original photo must be kept in memory (and in the saved diagram from Task 13 if present) so the overlay can be drawn.
2. Pure core: frontend/src/core/correct.ts with immutable edit functions on DiagramScene: movePoint (clamps to [0,1]), renameLabel (trims, rejects empty), deletePoint (also removes every segment and polyline reference to it), deleteSegment, plus an undo/redo history reducer. No browser APIs.
3. Saving: validate against the schema before use. The backend already has validate.py (do not weaken it); add a small POST /api/v1/validate endpoint if needed that runs the existing validator, or reuse the generated TypeScript types plus a client-side check, whichever the design justifies. A scene that fails validation must be refused with a spoken and visible reason, never silently saved.
4. Screen: frontend/src/screens/Correct.tsx, reached from Explore through a clearly labelled "Correct" button that is NOT part of the blind exploration gestures (do not change the Explore gesture handling or the haptic engine). All strings through t() with en, hi and gu entries.
5. Property tests (frontend/tests/correct.prop.test.ts), add as P16 and P17 in design.md: P16 any sequence of edit operations on a valid scene yields a scene that either passes the validator invariants (unique ids, no dangling segment references, all coordinates in [0,1]) or is explicitly rejected; P17 undo after any edit restores the previous scene exactly (and redo re-applies it).
6. Do not change the tuned haptic values. Run tsc, npm test and npm run build; tick tasks.md only for what is done; add a BUILD_LOG.md entry with tool = Kiro, including any real bug a property caught.
```

## Prompt 3: Housekeeping that only Kiro should do (short)

```
Read #review. (1) Tick the parent tasks in tasks.md that are truly complete (7, and any sub-tasks of 12 and 14 that the agy lanes finished; check the code, don't assume). (2) The P1 generator now enforces a minimum screen separation and passed 25 of 25 isolated runs: confirm, and add the outcome to docs/kiro-evidence/pbt-p1-flake.md. (3) Remove the "retry once" workaround in .github/workflows/ci.yml frontend test step once you agree P1 is stable. (4) Check the three hooks in .kiro/hooks appear in the hooks panel and fire; save a screenshot or log excerpt to docs/kiro-evidence/. Log it in BUILD_LOG.md with tool = Kiro.
```

---

## When Kiro finishes
Tell Claude Code "review Kiro T13" (or T11). It will read the diff against the spec and these prompts, run the full suites, check the haptic values and the ownership rules, and write `docs/reviews/`.
