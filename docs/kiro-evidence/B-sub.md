# Lane B-sub: A6-01..A6-05, A6-07

Files touched: `submission/demo_script.md`, `submission/checklist.md`, `submission/devpost_description.md`, `submission/built_with.txt`, `docs/DEMO_SCRIPT.md`.

- A6-01: `submission/demo_script.md` is declared the single script (banner at top). `docs/DEMO_SCRIPT.md` is marked SUPERSEDED, its Kiro shot no longer gated on "recorded evidence", and it mirrors the new clip. `checklist.md:40` now points to the submission script.
- A6-02/A6-07: new 0:25-0:35 clip, Ghost Host greeting plus Capture next-step line (wording copied from `host.start.greeting` and `host.capture.next`), with Requirement 53 criteria 1 and 3 inset. The "need" shot was cut to 10 s and "photo to diagram" to 10 s, so total stays 2:50 and Kiro shots keep 1:20 to 2:40 (about 80 s). The joke line is a `[PLACEHOLDER]`: the shipped greeting has no joke, and none was invented.
- A6-03: video URL stays `[PLACEHOLDER]`; needs recording by the owner.
- A6-05: "Before and after Kiro" paragraph and "Kiro features used" line in `devpost_description.md`. The concrete caught-bug example is a `[PLACEHOLDER]` (no recorded one was found, none invented).
- A6-04 is README (lane B-comm), not touched.
- built_with.txt: Kiro split into separate tags (Kiro, specs, hooks, steering, custom agents); Antigravity and Claude Code added (also fixes A6-10/A6-11).

Not done, outside this lane's write scope (index lane map: B-sub writes only `submission/**` and `docs/DEMO_SCRIPT.md`; `.kiro/**` is not mine):
- No edit to Requirement 53 or tasks: not needed, the existing criteria 1 and 3 cover the greeting and next-step line.
- No new hook and no `tech.md` change: the demo shows the existing `prop-tests-on-save.json` and the existing haptic table. A hook for the greeting clip, if wanted, belongs to the `.kiro` owner (B-host / owner).
- Nothing run (docs only); nothing committed.
