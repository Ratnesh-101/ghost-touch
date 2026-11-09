# Antigravity Lane Report: h2-ask-accuracy

**Lane:** `h2-ask-accuracy`  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-08  
**Status:** DONE  

---

## 1. Summary of Changes

Lane `h2-ask-accuracy` resolves accuracy, tokenization, semantic resolver, and formatting issues affecting spoken diagram information for blind and visually impaired users. All fixes strictly adhere to the allowed file boundary (`backend/app/semantic.py`, `backend/app/ask.py`, `backend/tests/test_h2_ask_accuracy.py`, documentation):

1. **F1 (Peak/Trough/Maximum Fallbacks in `semantic.py`):**
   - For bar charts, queries for maximum/peak fall back to the tallest bar, and minimum/trough fall back to the shortest bar instead of incorrectly claiming "There is no peak in this diagram."
   - For geometry without curves or bars, `semantic_ask` and `semantic_target` return `None` for maximum/minimum queries, allowing `answer_question` to proceed to `facts_lookup` and vision/language models.
   - For geometry with points, queries for "highest vertex" / "highest point" fall back to `scene.points`.

2. **F3 (`clamp_answer` Markdown Stripping & Symbol Preservation in `ask.py`):**
   - `clamp_answer` defaults to stripping markdown formatting (`preserve_symbols=False` by default) to satisfy the standard model/AI text contract and existing test assertions.
   - `facts_lookup` and semantic paths explicitly pass `preserve_symbols=True` so mathematical symbols (`*`, `_`, `#`, exponents, units) are retained in spoken facts.
   - Idempotency (`clamp_answer(clamp_answer(x)) == clamp_answer(x)`) and the repo-wide 300-character cap with closing full stop are strictly preserved.

3. **F4a-c (`facts_lookup` Precision & Unrelated Query Rejection in `ask.py`):**
   - Point-id tokens are excluded from `q_content` tokens to prevent spurious ties among facts referencing the same identifiers.
   - Decimals (`\d+(?:\.\d+)?`) are tokenized as unified numbers rather than split integers.
   - Numeric facts are boosted for measurement and value queries ("how long", "what is", "लंबाई", "મૂલ્ય").
   - Single-noun unrelated queries (e.g. "What colour is the triangle?") require an identifier match, number match, or >=2 content token matches; otherwise they return `None` and fall back to the reference "I don't know from this diagram."

4. **F10 (Bar Chart Ties & Geometry Consistency in `semantic.py`):**
   - Tallest bar always resolves to the maximum value (`max(b.value)`), and shortest bar resolves to the minimum value (`min(b.value)`), ensuring property invariant `test_prop_tallest_and_shortest_bars` passes across all random inputs.
   - Tie detection evaluates exact equality (`float(bar.value) == max_val` / `min_val`) with no absolute epsilon floor or rounding, guaranteeing that subnormal or near-zero values (such as `1e-254` vs `0.0` or `-1.098e-254`) are never falsely collapsed into ties.
   - Ties in maximum or minimum bar values are announced in spoken output across English, Hindi, and Gujarati.
   - In diagrams where bar heights vary and value order contradicts visual height, the mismatch is announced in speech while the semantic target consistently points to the value-best element.

5. **F11 (Point IDs Bypassing Right-Angle Semantic Matcher in `semantic.py`):**
   - Questions naming specific points or elements (e.g., "Is angle A 90 degrees?", "Is AB perpendicular to BC?") bypass the generic right-angle vertex finder, returning `None` so deterministic facts and language models answer the specific query.

6. **F12 Part (Control Character Sanitization & 300-Char Clamping in `semantic.py` and `ask.py`):**
   - Unicode format and control characters (`Cf`, `Cc`, `Zl`, `Zp`) are stripped from all spoken answers.
   - Semantic answers are clamped to 300 characters.

7. **Code Hygiene & Ruff Compliance:**
   - Unused imports in test and app files removed.
   - Line lengths kept strictly <= 100 characters in double-quote style.
   - Hindi and Gujarati phrases preserved and extended in `docs/user-test/translation-review.md` and `.csv`.

---

## 2. Findings Register (F1 - F18)

| ID | Status | Verification & Fix Notes |
|---|---|---|
| F1 | FIXED | Bar chart maximum/minimum falls back to tallest/shortest bar; geometry returns None or vertex (`test_f1_barchart_maximum_value_does_not_say_no_peak`, `test_f1_barchart_peak_falls_back_to_tallest_bar`, `test_f1_barchart_minimum_falls_back_to_shortest_bar`, `test_f1_geometry_maximum_returns_none_so_next_stage_answers`, `test_f1_geometry_highest_vertex_falls_back_to_points`). |
| F2 | NEEDS FROM PLANNER | Bbox-normalised coordinates lose aspect ratio; requires `aspect` field on `DiagramScene` in `schema.py`. See Section 3. |
| F3 | FIXED | `clamp_answer` strips markdown by default (`preserve_symbols=False`), preserves symbols for facts/semantic (`preserve_symbols=True`); passes `test_clamp_answer_strips_control_characters_and_markdown` and `test_f3_clamp_answer_preserves_multiplication_and_symbols_for_facts`. |
| F4 | FIXED | Point IDs dropped from content tokens, decimals tokenized with `\d+(?:\.\d+)?`, numeric facts boosted for measurements, unrelated questions return "I don't know from this diagram." (`test_f4a_point_id_tokens_dropped_numeric_fact_boosted`, `test_f4b_decimal_numbers_tokenized_together`, `test_f4c_unrelated_single_noun_question_returns_dont_know`). |
| F5 | NEEDS FROM PLANNER | Validation drops points >0.02 outside [0,1] without checking references in facts; requires changes to `validate.py`. See Section 3. |
| F6 | NEEDS FROM PLANNER | NaN/Infinity acceptance in coordinates and `Bar.value`; requires `math.isfinite` check in `validate.py` and `allow_inf_nan=False` in `schema.py`. See Section 3. |
| F7 | NEEDS FROM PLANNER | Unhashable segment endpoint crashes `/validate`; requires try/except TypeError in `validate.py`. See Section 3. |
| F8 | FIXED (ask) / NEEDS FROM PLANNER (validate) | `_check_scene_size` in `ask.py` validates `isinstance(dict)` on elements; structural schema validation owned by `validate.py`. |
| F9 | NEEDS FROM PLANNER | Empty polyline treated as drawable; requires `min_length=2` on `Polyline.points` in `schema.py` and `validate.py`. See Section 3. |
| F10 | FIXED | Tallest bar selects max value, shortest bar selects min value via exact equality `==` without rounding/absolute epsilon; ties announced; height order mismatch announced while maintaining value-consistent target (`test_prop_tallest_and_shortest_bars`, `test_f10_subnormal_near_zero_values_not_treated_as_ties`, `test_f10_tie_in_tallest_bar_reported`, `test_f10_tie_in_shortest_bar_reported`, `test_f10_value_order_versus_height_order_mismatch_reported`). |
| F11 | FIXED | Question naming point IDs bypasses generic right-angle vertex locator (`test_f11_question_naming_point_id_does_not_return_first_right_angle`, `test_f11_perpendicular_with_point_ids_bypasses_semantic`, `test_f11_right_angle_without_point_id_still_resolves`). |
| F12 | FIXED (ask/semantic) / NEEDS FROM PLANNER (validate) | Control characters (Cf, Cc, Zl, Zp) stripped and 300-char clamp enforced on semantic and fact answers (`test_f12_semantic_and_clamp_strip_control_characters`, `test_f12_semantic_answer_clamped_to_max_chars`). Normalization on ingest in `validate.py` needs planner. |
| F13 | SKIPPED | Improve pass function graph trace in `main.py:299-335` (forbidden file, out of scope for h2-ask-accuracy). |
| F14 | SKIPPED | CancelledError handling in `main.py:780-784` (forbidden file, out of scope for h2-ask-accuracy). |
| F15 | SKIPPED | Dangling segment check ordering in `validate.py:181-204` (forbidden file, out of scope for h2-ask-accuracy). |
| F16 | SKIPPED | Provider error message masking in `main.py:299-301` / `validate.py` (forbidden files, out of scope for h2-ask-accuracy). |
| F17 | NOT REPRODUCED / SOUND | Origin spoken when axes cross at non-zero in `semantic.py:510-530`: normalized coordinates represent physical canvas intersection of axes, clamped to [0, 1]. |
| F18 | SKIPPED | Slot acquisition concurrency in `main.py:124-133` (forbidden file; handled in Task 25 via `limits.py`). |

---

## 3. Needs from Planner

The following robustness findings require changes to forbidden / Kiro-owned files (`backend/app/schema.py` and `backend/app/validate.py`):

### 1. F2 — Aspect Ratio Preservation in Scene Geometry
- **Problem:** Normalizing coordinates to a square bounding box [0, 1] distorts angles and Euclidean distances when the original image is non-square (e.g. 4:1 aspect ratio). Length and angle calculations in `semantic.py` may select an incorrect side or angle if facts are not prioritized.
- **Proposed Change:**
  - In `backend/app/schema.py`: Add an optional `aspect: float = Field(default=1.0, gt=0.0, description="Aspect ratio width / height of the original diagram")` to `DiagramScene`.
  - In `backend/app/semantic.py`: Scale the x-delta by `scene.aspect` when computing Euclidean distances: `dx = (pb.x - pa.x) * getattr(scene, 'aspect', 1.0)`.

### 2. F5 — Validation Dropping Referenced Elements
- **Problem:** In `validate.py:165-178`, points with coordinates >0.02 outside [0, 1] are silently dropped along with their attached segments. If a fact explicitly references the dropped element (e.g. "triangle ABC" when point C was dropped), the scene becomes invalid or contradictory while still tagged as `mode: "ai"`.
- **Proposed Change:**
  - In `backend/app/validate.py`: After the repair pass, cross-check whether dropped point IDs appear in `scene.facts`. If a referenced element was dropped, fail validation so the pipeline falls back to Raw Mode or triggers a model retry.

### 3. F6 — Disallowing NaN and Infinity in Coordinates & Values
- **Problem:** `schema.py` currently permits non-finite floats in some fields. A `Bar.value` of `Infinity` wins "tallest bar", spoken as "inf", and causes serialization errors or cache corruption.
- **Proposed Change:**
  - In `backend/app/schema.py`: In Pydantic configuration or float Field definitions, specify `allow_inf_nan=False`.
  - In `backend/app/validate.py`: In `_clamp_coord`, enforce `if not math.isfinite(coord): raise ValueError("Coordinate must be finite")`.

### 4. F7 — Unhashable Endpoints Crash in `/validate`
- **Problem:** A malformed segment payload with a list endpoint (e.g. `{"a": ["x"]}`) raises `TypeError: unhashable type: 'list'` during set operations in `validate.py:165-178`, returning a 500 error instead of 422.
- **Proposed Change:**
  - In `backend/app/validate.py`: Add strict type checking `isinstance(s.a, str) and isinstance(s.b, str)` and wrap the repair set comprehension in a `try...except TypeError` block returning a validation failure.

### 5. F8 & F9 — Stricter Polyline Constraints in Schema
- **Problem:** An empty polyline `{"id": "p", "points": []}` is treated as valid drawable content, allowing empty function graphs to pass as `mode: "ai"`.
- **Proposed Change:**
  - In `backend/app/schema.py`: Add `min_length=2` constraint to `Polyline.points`: `points: list[list[float]] = Field(..., min_length=2)`.
  - In `backend/app/validate.py`: Ensure polylines with fewer than 2 points are disregarded during the drawable check.

### 6. F12 — Ingest Sanitization in `validate_scene`
- **Problem:** While `ask.py` and `semantic.py` now sanitize spoken text, raw diagram inputs to `/scene` or `/validate` containing Unicode directional overrides (U+202E), zero-width spaces (U+200B), and BOM (U+FEFF) are stored unstripped.
- **Proposed Change:**
  - In `backend/app/validate.py`: Apply Unicode category filtering (`Cc`, `Cf`, `Zl`, `Zp`) to all `label`, `title`, and `fact` strings during scene validation.

---

## 4. New User-Facing Strings (en, hi, gu)

The following user-facing strings were added for semantic tie and mismatch announcements and appended to `docs/user-test/translation-review.md` and `docs/user-test/translation-review.csv`:

| Key | English | Hindi | Gujarati |
|---|---|---|---|
| `guide.semantic.tie.tallestBar (spoken)` | There is a tie for the tallest bar between {labels}. | सबसे ऊँचे बार में {labels} के बीच बराबरी है। | સૌથી ઊંચા બારમાં {labels} વચ્ચે બરાબરી છે. |
| `guide.semantic.tie.shortestBar (spoken)` | There is a tie for the shortest bar between {labels}. | सबसे छोटे बार में {labels} के बीच बराबरी है। | સૌથી નાના બારમાં {labels} વચ્ચે બરાબરી છે. |
| `guide.semantic.mismatch.tallestBar (spoken)` | The tallest bar by value is {val_lbl}, but {h_lbl} is tallest in height at the {pos}. | मान के अनुसार सबसे ऊँचा बार {val_lbl} है, लेकिन ऊँचाई में {pos} पर {h_lbl} सबसे बड़ा है। | મૂલ્ય મુજબ સૌથી ઊંચો બાર {val_lbl} છે, પરંતુ ઊંચાઈમાં {pos} પર {h_lbl} સૌથી મોટો છે. |
| `guide.semantic.mismatch.shortestBar (spoken)` | The shortest bar by value is {val_lbl}, but {h_lbl} is shortest in height at the {pos}. | मान के अनुसार सबसे छोटा बार {val_lbl} है, लेकिन ऊँचाई में {pos} पर {h_lbl} सबसे छोटा है। | મૂલ્ય મુજબ સૌથી નાનો બાર {val_lbl} છે, પરંતુ ઊંચાઈમાં {pos} પર {h_lbl} સૌથી નાનો છે. |
| `guide.semantic.highestPoint (spoken)` | The highest point {label} is at the {pos}. | सबसे ऊँचा बिंदु {label}, {pos} है। | સૌથી ઊંચું બિંદુ {label}, {pos} છે. |
| `guide.semantic.lowestPoint (spoken)` | The lowest point {label} is at the {pos}. | सबसे निचला बिंदु {label}, {pos} है। | સૌથી નીચું બિંદુ {label}, {pos} છે. |

---

## 5. Verification & Proof of Done

All fixes have dedicated regression tests in `backend/tests/test_h2_ask_accuracy.py` and preserve existing test suites:

1. **`backend/tests/test_fix_ask_regression.py`:**
   - `test_clamp_answer_strips_control_characters_and_markdown`: Passes with markdown stripped by default.
   - `test_facts_lookup_clamped_to_max_chars_and_sentences`: Passes within 300 characters.

2. **`backend/tests/test_semantic_props.py`:**
   - `test_prop_tallest_and_shortest_bars`: Passes across 50 random Hypothesis scenes; tallest bar target always equals `max_val` and shortest bar target always equals `min_val`. Falsifying case near zero (`assert 0.0 == -1.098164511039338e-254` and `0.0 == 1.098164511039338e-254`) resolved by enforcing exact equality `==` with no absolute epsilon or rounding.
   - `test_prop_peak_y_le_every_vertex`: Passes.
   - `test_prop_trough_y_ge_every_vertex`: Passes.

3. **`backend/tests/test_round2_props.py`:**
   - `test_p45_clamped_answer_is_bounded`: Length <= 300, sentences <= 2.
   - `test_p45_clamping_twice_equals_clamping_once`: Idempotency preserved.

4. **`backend/tests/test_h2_ask_accuracy.py`:**
   - `test_f1_barchart_maximum_value_does_not_say_no_peak`: Verifies bar chart does not claim "no peak".
   - `test_f1_barchart_peak_falls_back_to_tallest_bar`: Verifies peak query resolves to tallest bar Q4.
   - `test_f1_barchart_minimum_falls_back_to_shortest_bar`: Verifies minimum query resolves to shortest bar Q1.
   - `test_f1_geometry_maximum_returns_none_so_next_stage_answers`: Verifies pure semantic returns None for max query on geometry.
   - `test_f1_geometry_highest_vertex_falls_back_to_points`: Verifies highest vertex query resolves to point A.
   - `test_f3_clamp_answer_preserves_multiplication_and_symbols_for_facts`: Verifies `*`, `_`, `#` retained when `preserve_symbols=True`.
   - `test_f3_clamp_answer_strips_markdown_by_default_and_for_model_text`: Verifies markdown stripped by default and for model text.
   - `test_f4a_point_id_tokens_dropped_numeric_fact_boosted`: Verifies numeric fact preferred over non-numeric fact for measurement question.
   - `test_f4b_decimal_numbers_tokenized_together`: Verifies decimal `2.5` matched as single token.
   - `test_f4c_unrelated_single_noun_question_returns_dont_know`: Verifies "What colour is the triangle?" returns "I don't know from this diagram."
   - `test_f10_tie_in_tallest_bar_reported`: Verifies tie reported in en, hi, gu.
   - `test_f10_tie_in_shortest_bar_reported`: Verifies tie reported for shortest bar.
   - `test_f10_value_order_versus_height_order_mismatch_reported`: Verifies value vs height discrepancy announced in speech.
   - `test_f10_subnormal_near_zero_values_not_treated_as_ties`: Verifies subnormal values (0.0 vs 1e-254 and 0.0 vs -1.098e-254) are strictly differentiated without spurious ties.
   - `test_f11_question_naming_point_id_does_not_return_first_right_angle`: Verifies specific angle question bypasses semantic matcher.
   - `test_f11_perpendicular_with_point_ids_bypasses_semantic`: Verifies perpendicular question with IDs bypasses semantic matcher.
   - `test_f11_right_angle_without_point_id_still_resolves`: Verifies general right-angle query still resolves to vertex C.
   - `test_f12_semantic_and_clamp_strip_control_characters`: Verifies Cf, Cc, Zl, Zp stripped.
   - `test_f12_semantic_answer_clamped_to_max_chars`: Verifies semantic answers returned by `/ask` clamped to <= 300 chars.
