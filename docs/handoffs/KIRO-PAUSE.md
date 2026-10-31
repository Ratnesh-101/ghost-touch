# Kiro paused (credits) — state, queue, rules

Written by Claude Code, 2026-10-31. Kiro is out of credits; the hackathon credit request is pending (about 48 business hours from Sat 31 Oct, so expect an answer by Wed 4 Nov). Decision date: **Thu 5 Nov**.

Last commit: `f5de39d WIP: Kiro paused (credits)`. The git root is the parent folder, so paths in `git show` carry a `ghost-touch/` prefix. After that commit the tree has two small edits: `tasks.md` 3.4 changed from `[-]` to `[ ]`, and non-null assertions (`!`) added in `frontend/tests/hitTest.prop.test.ts` (a `tsc` fix).

Health right now (run today): frontend 44 tests pass in 5 files, `tsc --noEmit` clean; backend 58 tests pass, `ruff check` clean. Nothing is red.

## 1. What is done, half-done, left

| Task | State | Evidence / what is open |
|---|---|---|
| T1 Scaffold | **Done**, verified | build, PWA manifest, health endpoint OK |
| T2.1 schema | **Done**, follow-ups open | see "Open defects" 1–4 |
| T2.2 export + TS types | **Done**, follow-ups open | `Polyline.points` generates as `[unknown, unknown][]` |
| T2.3 fixtures | **Done**, notes | sine has 25 points over 2 periods (spec says about 100 over one); triangle right angle at C (design.md says "angle C = 90°", ground-truth set has B) |
| T3.1 geometry.ts | **Done**, verified | |
| T3.2 hitTest.ts | **Half-done: bar edges missing** | `design.md:54` and Req 6.3 need bar edges as line hits; not implemented |
| T3.3 P8 | **Done**, verified | 200 runs, passes |
| T3.4 P1 | **Test written and passing**, box says `[ ]` | `hitTest.prop.test.ts`, 200 runs; Kiro should tick on return |
| T3.5 P2 | **Not written** | vertex beats line |
| T4 haptic engine, pitch, P3–P7 | **Not started** | no `hapticEngine.ts`, no `pitch.ts` |
| T5, T6, T7 | Not started | briefs T05 and T06 written; T07 brief still to write |
| T8 | Not started | `validate.py`, `raw_mode.py`, `ask.py`, `vision/base.py` are docstring stubs; brief T08 written |
| T9 to T16 | Not started | |

## 2. Open defects (all in Kiro-owned files; fix when Kiro returns)
1. `Polyline.points` is a tuple, so `scene.gen.ts` has `Points1 = [unknown, unknown][]`. `core/scene.ts` hand-writes a second copy of `DiagramScene`/`Polyline` to work around it (breaks tech.md rule 3). Fix the schema (use `items`), regenerate, drop the override.
2. Every generated interface has `[k: string]: unknown` (additionalProperties). Typos compile.
3. The coordinate range lives only in Python validators; `scene.schema.json` has no `minimum`/`maximum`, so the LLM prompt's `{schema}` never shows [0,1]. `export_schema.py` docstring says otherwise.
4. `scene.schema.json` is gitignored, so `test_on_disk_artifact_is_in_sync_with_model` skips on a fresh clone. `ruff format --check` fails on 2 files.
5. `hitTest.ts`: no bar-edge hits (High). Bars with `x0 > x1` or `y_top > y_base` can never be hit (validate.py should reject them).
6. `package.json` `test:prop` finds nothing (`--dir tests -t prop`). Use `vitest run .prop.test`. Same line is in CLAUDE.md.
7. `BUILD_LOG.md` has no entries for T2 or T3.
8. Tests use `fc.float` (32-bit); `fc.double` is a better sample. P1 can in theory tie when two normalized points land on the same pixel in a tiny viewport (rare).

## 3. Reserved for Kiro — do not reassign without the owner's OK
- T2 follow-ups (defects 1–4), T3 (3.4 tick, 3.5, bar edges), **T4 entirely**, **8.3 `validate.py`, 8.6 (P9), 8.7 (P10)**.
- Always Kiro-owned files: `frontend/src/core/**`, all property tests (`*.prop.test.ts`, `test_*_props.py`), `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts`, `.kiro/**` (checkboxes included).
- Rationale: Kiroween requires the build to use Kiro in a real way; these are the spec-driven, property-tested core.

## 4. agy queue (it should never wait)
| # | Task | Brief | Kiro-owned dependency → TEMP stub |
|---|---|---|---|
| 1 | T05 drivers + `/debug` | `docs/briefs/T05-drivers.md` | `Effect`, `HapticConfig`, `DEFAULT_HAPTICS` → `frontend/src/_temp/hapticTypes.stub.ts` |
| 2 | T06 Start + Capture | `docs/briefs/T06-start-capture.md` | none (needs T05 and the existing sample JSON) |
| 3 | T07 Explore | to write | `step`/`initialState` and `pitch` → `frontend/src/_temp/hapticEngine.stub.ts`, `pitch.stub.ts` |
| 4 | T08.1, 8.2, 8.4, 8.5 | `docs/briefs/T08-scene-pipeline.md` | `validate_scene` → `backend/app/_temp/validate_stub.py` |
| 5 | T09 voice questions (9.1, 9.2) | to write | none |

Then T10 (deploy and STEMergent, deadline **Nov 16, 9:00 am IST**) once 1–5 are reviewed.

Stub rules are in `AGENTS.md` rule 3. Real `hitTest`, `geometry` and `scene.ts` types already exist; use them, and do not work around the known bar-edge gap in the Explore screen.

## 5. Reviews while Kiro is paused
- The Kiro review hook (`review-builder-handoff.json`) won't run. Claude Code reviews instead.
- When agy writes `docs/handoffs/TNN-report.md`, tell Claude Code "review TNN". The result goes to `docs/reviews/TNN-review.md` with `Reviewer: Claude Code (Kiro paused)`, using the protocol in `.kiro/steering/review.md`.
- Existing review: `docs/reviews/T01-T03-review.md`.
- When Kiro returns it should re-review anything shipped on a TEMP stub, and swap each stub for the real module.

## 6. Credit decision (Nov 5)
Claude Code cannot wake itself. On Nov 5 (or any session after that date), ask "credit check". If credits are denied or not received by Nov 5, Claude Code will report it and propose the plan below. **Nothing moves without the owner's OK.**

Draft contingency (not active): move T2 follow-ups, 3.5 and T4 to agy, with property tests P2–P7 written by agy.
- **Risk:** Kiroween can disqualify for "insufficient use of Kiro". Moving the haptic core and its property tests to another tool removes the strongest Kiro evidence (spec to tasks to property tests to the tuned haptic engine).
- **Mitigations:** keep Kiro for specs, steering and hooks (already done and committed under `.kiro/`); keep T4's design in Kiro's `design.md` and have Kiro review the result when credits return; log honestly in `BUILD_LOG.md`; re-ask for credits citing the hackathon rule; consider Kiro CLI or a free allowance for T4 alone.
- Ask the owner to choose between: (a) keep waiting, T7 on stubs; (b) move T4 only; (c) move T2–T4.

## 7. TEMP stub register (agy appends one row per stub)
| Stub file | Replaces (Kiro) | Imported by | Swap = change this import |
|---|---|---|---|
| `frontend/src/_temp/hapticTypes.stub.ts` (T05; types `Effect`, `HapticConfig` and constant `DEFAULT_HAPTICS` only, no logic) | `frontend/src/core/hapticEngine.ts` (Task 4) | `frontend/src/drivers/index.ts`, `frontend/src/screens/Debug.tsx`, `frontend/tests/drivers.runEffects.test.ts` | Change the `../_temp/hapticTypes.stub` import to `../core/hapticEngine` in those three files, then delete the stub folder |
| `frontend/src/_temp/pitch.stub.ts` (T07; `pitchForY`, `pitchForValue`) | `frontend/src/core/pitch.ts` (Task 4) | `frontend/src/_temp/hapticEngine.stub.ts`, `frontend/src/flow/explore.ts` | Change the `../_temp/pitch.stub` import to `../core/pitch` in `frontend/src/flow/explore.ts` |
| `frontend/src/_temp/hapticEngine.stub.ts` (T07; `EngineState`, `initialState()`, `Input`, `step`) | `frontend/src/core/hapticEngine.ts` (Task 4) | `frontend/src/flow/explore.ts` | Change the `../_temp/hapticEngine.stub` import to `../core/hapticEngine` in `frontend/src/flow/explore.ts` |

| `backend/app/_temp/validate_stub.py` (T08; contract `validate_scene(raw) -> ValidationResult(scene, errors)`, no repair rules and no vocabulary check) | `backend/app/validate.py` (Task 8.3, Kiro) | `backend/app/main.py` | Change the validator import in `main.py` to `app.validate`, then delete the `_temp` folder |
