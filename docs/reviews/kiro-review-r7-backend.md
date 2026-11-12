# Review: agy/r7-backend vs main (Kiro)

Scope: one commit, 3c217e7. Files: backend/app/ask.py, backend/app/raw_mode.py, backend/tests/test_r7_backend.py (new), docs/BUILD_LOG.md, docs/reports/agy-r7-backend-report.md. I read the full diff and the new test file with `git diff` and `git show`.

NOT DONE: I did not run pytest, ruff check or ruff format --check. My tool policy blocked `git checkout` of the branch, and I am not allowed to modify the working tree. I also did not run the new tests against main's code. Every "would fail on old code" statement below comes from reading the code and the audit's reproductions, not from running it. Run `ruff check`, `ruff format --check` and the full pytest suite on the branch before merging.

## Ownership, haptics, Requirement 25, secrets
- Kiro-owned files untouched: no changes to frontend/src/core, .kiro, schema.py, validate.py, any *_props.py or *.prop.test.ts, or scene.gen.ts. OK.
- Tuned haptic values (tech.md): not touched. No frontend files changed at all. OK.
- Requirement 25 (flow/canvasSize.ts, layout overlays): not affected, backend only. OK.
- Secrets: no .env file, no key-shaped strings in the diff or tests. OK.
- No existing test file was modified or deleted (only the new test_r7_backend.py is added). OK, but see M-01 about existing tests that I could not confirm still pass.

## Per-finding assessment

### B-01 (raw_mode.py:270-310) — fix is correct
The cap is a pre-check. For each candidate segment it counts how many NEW points the segment would add, using the same merge radius as `get_or_create_point`. It stops before the registry would pass `MAX_RAW_POINTS = 500`. The count is right in all four cases (both ends existing, one existing, both new, both new but within merge_tol of each other, which collapses to one point). `validate.py` is untouched, as the brief required. The segment ids now use `len(segments)`, so they stay contiguous.
Test strength: `test_raw_mode_scene_always_passes_validator_point_cap` uses the audit scenario (500 random 60 px lines on 1200x1200) and checks `<= 500` points and `validate_scene(...).scene is not None`. It should fail on the old code if this seed reproduces the audit's 510 points. The audit used its own random lines, so a different seed might stay under 500 on old code. Check this by running the test on main.

### B-02 (ask.py clamp_answer, answer_question) — works, but with side effects (see M-02)
Tied facts are now kept up to 3 sentences, and the test fails on old code (old default was 2). The endpoint test asserts AB, BC and AC all appear. OK for the finding itself.

### B-03 (ask.py TOKEN_PATTERN) — fix is correct
`[\w\u0900-\u097F\u0A80-\u0AFF°²]+` matches the audit's suggested fix. The token tests use the audit's own examples. The Hindi and Gujarati wrong-angle endpoint tests would fail on old code according to the audit's reproduction. OK.
Caveat: the range also includes Devanagari and Gujarati danda and digit characters. That is harmless here.

## Issues

### M-01 · Medium · backend/app/ask.py (diff hunk at ~line 626-648, `has_general_fact_match`) — unrequested change to the answer rule
Problem: the brief said "make sure the English behaviour and every existing test are unchanged" and listed only a regex change for B-03. The lane also added a new acceptance branch to `facts_lookup`. A fact with no element ids is now answered whenever it shares ONE content token with a measurement question and contains a digit. Before, that case needed two matching content tokens (the F4c rule, which the audit relies on to say English correctly answers "I don't know"). The new branch is not language-specific, so English questions are loosened too. Example: fact "Area = 20 cm²" with the question "what is the area?" used to need 2 content-token overlaps and now needs 1. This is a behaviour change to a guard that exists to prevent wrong answers, and no audit finding asks for it. The report claims it was needed for the Hindi tests, which I could not verify.
Fix: remove `has_general_fact_match` and the test `test_facts_lookup_general_facts_hindi_and_gujarati`, then run the suite. If an existing test truly needs it, report that under "Needs from" and let Kiro decide. If it stays, restrict it to non-English `lang` and add a test that an English question with one overlapping token still returns unknown (the guard the F4c rule protects).

### M-02 · Medium · backend/app/ask.py:~456 (`limit_sentences` default) — semantic path also gets 3 sentences
Problem: `clamp_answer` now defaults to 3 sentences whenever `preserve_symbols=True`. `preserve_symbols=True` is also used on the semantic path (ask.py:995, `clamp_answer(spoken_ans, preserve_symbols=True)`). That path now silently allows 3 sentences too, which the brief did not ask for. The facts path already passes `max_sentences=MAX_FACTS_ANSWER_SENTENCES` explicitly (ask.py:~1067), so the implicit default is redundant as well as risky. `MAX_ANSWER_SENTENCES = 2` is a spoken-answer contract (Req ask: at most two short sentences).
Fix: make the default `MAX_ANSWER_SENTENCES` always, and rely only on the explicit `max_sentences=3` at the facts call site. Update `test_clamp_answer_keeps_three_sentences_for_facts`, whose first assertion currently encodes the implicit behaviour.

### L-01 · Low · backend/app/raw_mode.py (`break` in the segment loop)
Problem: `break` stops at the first segment that would pass the cap. Segments are sorted longest first, so later shorter segments that only reuse existing points (0 new points) are dropped even though they would fit.
Fix: `continue` instead of `break` (keep a cheap exit when `len(segments)` reaches the segment cap, which `top_segments` probably already enforces). Optional.

### L-02 · Low · backend/tests/test_r7_backend.py — some tests cannot fail on old code
`test_raw_mode_small_image_endpoint_returns_200` (10x10 image), `test_english_behavior_remains_unchanged`, and the `clamp_answer(text) == "AC = 4 cm. BC = 3 cm."` assertion pass on old code. They are fine as regression guards, but the brief asked for tests that each fail on the old code. Also, the Hindi and Gujarati endpoint tests assert the localized strings "ज्ञात नहीं है" and "જાણ નથી" by exact substring; if those strings change in the i18n tables the tests break for the wrong reason. Prefer asserting `source == "unknown"` only. Low priority.

### L-03 · Low · docs/BUILD_LOG.md
The brief asked for tool = "agy, reviewed by Claude". I did not verify the label in the new entry. Check it before merge.

## Verdict
FIX FIRST — B-01 and B-03 are correct and in scope, but the lane also loosened the facts-matching rule (M-01) without being asked, which can make English answers wrong and contradicts the brief's "English behaviour unchanged". The sentence-limit default (M-02) widens the semantic path too. Remove M-01, scope M-02 to the facts call site, then run ruff check, ruff format --check and the full backend pytest on the branch (I did not run them), and re-review the small delta.

REVIEW-COMPLETE
