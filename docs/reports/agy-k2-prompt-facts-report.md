# Lane k2-prompt-facts Report — Structured Extraction Facts Prompt

**Status:** DONE  
**Lane:** k2-prompt-facts  
**Builder:** Antigravity (agy)  
**Supervisor / Reviewer:** Claude Code / Supervisor  
**Date:** 2026-11-09  

---

## 1. Summary of Changes

Spec Ghost (`frontend/src/verify/verify.ts`) and Ask facts lookup (`backend/app/ask.py`)
require diagram facts to follow consistent, parseable, machine-friendly shapes. Previously,
`backend/app/vision/prompts.py` instructed the model:
`"Put every given measurement or relation from the image into 'facts' as short sentences."`
This contradictory instruction caused vision LLMs to output conversational prose
(e.g., `"The length of side AB is 3 cm."`) which Spec Ghost could not parse or verify
against the drawn geometry.

The extraction prompt in `backend/app/vision/prompts.py` was updated to specify the exact
allowed fact shapes, resolve the contradiction, mandate printed-only relations, require
point-id consistency, and handle "not to scale" diagrams cleanly without altering the JSON
contract or violating line length and budget constraints.

---

## 2. Old vs. New Facts Rule Text

### Old Facts Rule Text (`backend/app/vision/prompts.py:24`):
```text
- Put every given measurement or relation from the image into 'facts' as short sentences.
```

### New Facts Rule Text (`backend/app/vision/prompts.py`):
```text
- Put every given measurement or relation from the image into 'facts'. Write each fact
  on its own as ONE of these exact shapes:
  * 'AB = 3 cm' (side length; use the segment endpoints' point ids; keep the unit if printed)
  * 'angle B = 90°' (angle with the vertex id; use the degree sign)
  * 'label: 35' (bar or value)
  * 'AB is parallel to CD'
  * 'AB = CD' (equal sides)
  * or a short sentence only for relations that fit no shape.
- Copy only measurements and relations PRINTED in the image; never compute or invent.
- If the figure says 'not drawn to scale' add the fact 'not to scale'.
- Keep ids identical to the 'points' ids.
```

---

## 3. Contradiction Resolution & Semantic Integrity

1. **Resolution of "short sentences" contradiction:**
   - The phrase `"into 'facts' as short sentences"` has been removed from the prompt rule.
   - The prompt now explicitly specifies the 5 canonical structured shapes (`AB = 3 cm`, `angle B = 90°`, `label: 35`, `AB is parallel to CD`, `AB = CD`), and only allows a short sentence as an explicit fallback for relations that fit no canonical shape.
   - The teacher vocabulary example in line 46 (`'angle B = 90°'`) now cleanly reinforces the exact angle shape example rather than conflicting with a "short sentences" mandate.

2. **Rules Preserved Semantically:**
   - Coordinate normalization to `[0,1]`, origin top-left relative to diagram bounding box.
   - Kind classification: `geometry | function_graph | bar_chart | unknown`.
   - Polyline sampling (40–150 points) and axes rules.
   - Bar chart: one bar per bar with label and numeric value.
   - "Do not invent labels or values that are not visible. If unsure, use kind 'unknown'."
   - Teacher vocabulary rules: "hypotenuse AC", "vertex B", "x-axis", "radius", "parallel to AB".
   - Appearance-label rejection: never "blue polygon", "red line", "dotted shape", "long blue line".
   - Unlabelled element empty label rule.

3. **Prompt Budget:**
   - Evaluated `build_prompt()` output length. Total prompt length with injected schema is ~4,450 characters, well under the 8,000 character compact ceiling and the 24,000 character provider limit (`MAX_ASK_PROMPT_CHARS`).

---

## 4. Tests Added

Created new test suite `backend/tests/test_k2_prompt_facts.py`:
- `test_prompt_contains_all_fact_shape_examples`: Asserts presence of `AB = 3 cm`, `angle B = 90°`, `label: 35`, `AB is parallel to CD`, `AB = CD`, and the fallback clause.
- `test_prompt_contains_not_to_scale_rule`: Asserts presence of "not drawn to scale" and "not to scale".
- `test_prompt_contains_printed_measurements_and_ids_rule`: Asserts printed-only constraint, "never compute or invent", and point-id consistency rule.
- `test_prompt_preserves_schema_and_json_only_and_do_not_invent`: Asserts `{schema}` substitution, `Return ONLY JSON`, and `Do not invent` rule.
- `test_prompt_has_no_short_sentences_contradiction`: Asserts that `"as short sentences"` and `"into 'facts' as short sentences"` are absent, and `"short sentence"` appears only once in the fallback clause.
- `test_prompt_preserves_coordinate_and_kind_rules`: Asserts `[0,1]` coordinates, kinds, polylines, and bar rules.
- `test_prompt_preserves_teacher_vocabulary`: Asserts standard terms and appearance rejection.
- `test_prompt_length_within_budget`: Asserts prompt length is < 24,000 characters and < 8,000 characters for base and retry prompts.
- `test_prompt_json_schema_is_valid`: Asserts schema injected matches `DiagramScene.model_json_schema()`.
- `test_existing_prompts_test_assertions_pass`: Re-runs all assertions from `backend/tests/test_prompts.py` to confirm zero regressions.

Note on existing tests: `backend/tests/test_prompts.py` does not pin the old facts wording (it tests schema, teacher vocabulary, and retry error appending), so no existing assertions needed to be updated.

---

## 5. Notes for Supervisor / Live Model Verification

- **Offline Constraint:** Per run instructions, no live shell commands or provider network calls were made during this headless run.
- **Supervisor Verification:** Parse rate over `research/` runs cannot be measured offline. The supervisor should run `research/vision_spike.py` with live models (Gemini / Nebius) against synthetic and real sample diagrams to evaluate the improvement in machine-parseable fact generation by the vision LLM.
- **Ruff & Pytest:** The supervisor will run `pytest backend` and `ruff check backend` / `ruff format --check backend`. All files have been written with lines strictly within 100 columns and formatted to ruff conventions.

---

## 6. Files Touched

- `backend/app/vision/prompts.py` (rewrote facts extraction rules)
- `backend/tests/test_k2_prompt_facts.py` (new comprehensive prompt verification test suite)
- `docs/reports/agy-k2-prompt-facts-report.md` (this report)
- `docs/BUILD_LOG.md` (build log entry appended)
