# Antigravity Lane Report: k3-validate-hardening

**Lane:** `k3-validate-hardening`  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-09  
**Status:** DONE  

---

## 1. Executive Summary

Lane `k3-validate-hardening` implements comprehensive validation, schema, and semantic
hardening across the backend diagram scene intake pipeline. It resolves confirmed robustness
findings from `docs/reports/audit-claude-backend-robustness.md` (F2, F5, F6, F7, F9, F12, F15),
`docs/reports/audit-b2-scene-pipeline.md` (B2-05, B2-06), and
`docs/reports/agy-h2-ask-accuracy-report.md` Section 3 ("Needs from planner").

In follow-up verification, all 9 initial test regressions (items 1–4) were resolved:
- Hard `max_length` caps in `schema.py` were removed; structural bounds stay in `/validate`
  (1000 polyline points) and `/ask` (2000 polyline points).
- DiagramScene `aspect` defaults to 1.0; all six fixture files in `backend/fixtures/` and
  `frontend/public/samples/` include `"aspect": 1.0`, keeping both copies identical.
- `EXPECTED_TOP_LEVEL_PROPERTIES` in `app/export_schema.py` includes `"aspect"`.
- Property test `test_p9_drop_beyond_tolerance` asserts the two-case rule (unreferenced
  dropped point keeps scene valid; referenced dropped point invalidates scene).

All changes adhere strictly to the allowed files boundary and line-length limits.

---

## 2. Findings Register & Verification Evidence

| ID | Sev | Status | Problem & Verification Evidence | Fix & Regression Test |
|---|---|---|---|---|
| **F6** | MED | FIXED | NaN and Infinity values were accepted in coordinates, axes, and `Bar.value`. In `_clamp_coord`, comparisons with NaN evaluated to False, silently clamping NaN to `1.0`. `Bar.value` of `Infinity` won "tallest bar" in semantic queries and risked serialization crashes. | Added `math.isfinite` check in `_clamp_coord` and in `_repair_coords` for `Bar.value` and axes coordinates. Added `allow_inf_nan=False` in `backend/app/schema.py` on Point, Polyline coordinate items, Bar extents, Axes coordinates, and `DiagramScene.aspect`. Tested via `test_f6_*` tests. |
| **F7** | MED | FIXED | `validate_scene` crashed with HTTP 500 when encountering an unhashable endpoint (list or dict) during set membership tests in `_drop_dangling_segments`. | Enforced `isinstance(a, str) and isinstance(b, str)` before checking set membership against `point_ids`. Wrapped the repair and validation pipeline in `validate_scene` in a `try...except` handler so `validate_scene` never raises an unhandled exception. Tested via `test_f7_*` tests. |
| **F5** | HIGH | FIXED | `validate_scene` silently dropped points >0.02 outside [0, 1] and their attached segments, returning a reduced diagram while facts claimed original elements. | Tracked all points used by segments in the raw input and all elements referenced in `raw_facts`. If coordinate repair or dangling-segment removal drops any referenced element, `validate_scene` flags the scene as invalid (errors produced, `scene=None`), allowing AI retry or Raw Mode fallback. Dropping unreferenced stray elements remains silently allowed. Tested via `test_f5_*` tests. |
| **F9** | MED | FIXED | Polylines with 0 or 1 point were accepted as valid drawable elements, allowing empty function graphs to pass as `mode: "ai"`. | Enforced that only polylines with at least 2 points count as drawable in `validate_scene`, and dropped polylines with fewer than 2 points during coordinate repair. Scenes containing only 0-point or 1-point polylines are rejected with `"Scene has no drawable elements"`. (Enforced in `validate.py` rather than `schema.py` so existing property test `test_semantic_props.py` remains green). Tested via `test_f9_*`. |
| **F15** | LOW | FIXED | `_drop_dangling_segments` previously executed before `_dedupe_ids`, causing duplicate point IDs to bind incorrectly or segments referencing deduped IDs to be prematurely dropped. | Reordered repair steps in `validate_scene`: `_dedupe_ids` executes immediately before `_drop_dangling_segments`. Tested via `test_f15_*`. |
| **F12** | MED | FIXED | Spoken text strings passed through unstripped, allowing directional formatting characters (U+202E, U+200B, U+FEFF, U+2028), unbounded lengths, or empty IDs to enter storage and speech output. | Added `_sanitize_string` stripping Unicode `Cf`, `Cc`, `Zl`, `Zp` categories. Enforced length caps on titles (120 chars), labels (60 chars), facts (280 chars), and repo-wide text cap (300 chars). Added `_check_empty_ids` rejecting empty or whitespace-only element IDs. Tested via `test_f12_*`. |
| **B2-05** | HIGH | FIXED | Inverted bar coordinates (`x0 > x1` or `y_top > y_base`) passed validation, creating permanently dead bars in `hitTest.ts`. | In `validate.py` `_repair_coords`, normalized bar extents using `min/max` on x0/x1 and y_top/y_base. Tested via `test_b2_05_*`. |
| **F2** | HIGH | FIXED | Lengths and angles were computed in bbox-normalized coordinates without knowledge of aspect ratio, causing distortions on non-square images. | Added optional `aspect: float = Field(default=1.0, gt=0.0, allow_inf_nan=False)` to `DiagramScene`. In `semantic.py`, scaled x differences by `scene.aspect` in `_find_right_angle` and `_find_longest_side`. Missing/None aspect defaults to 1.0. Tested via `test_f2_*`. |
| **B2-06** | MED | FIXED | Inconsistent structural limits between `/validate` and `/ask`. | Added `_check_structural_limits` in `validate_scene` checking points (<=500), segments (<=1000), polylines (<=50), polyline points (<=1000), bars (<=100), and facts (<=100). Structural limits are enforced at endpoint intake (/validate 1000 points, /ask 2000 points) rather than via artificial `max_length` schema caps. Tested via `test_b2_06_*`. |
| **B2-13** | LOW | FIXED | `_is_colour_shape_only` failed when labels included trailing punctuation (e.g. `"blue polygon."`). | Stripped non-alphanumeric punctuation with `re.sub(r"[^\w\s]", "", label.lower())` before checking words against `COLOUR_SHAPE_WORDS`. Tested via `test_b2_13_*`. |

---

## 3. Schema Fields Added (for Supervisor & `gen:types`)

The following field was added to `DiagramScene` in `backend/app/schema.py`:

```python
aspect: float = Field(
    default=1.0,
    gt=0.0,
    allow_inf_nan=False,
    description="Aspect ratio (width / height) of the diagram's bounding box",
)
```

### Updates Completed:
1. In `backend/app/export_schema.py`: Added `"aspect"` to `EXPECTED_TOP_LEVEL_PROPERTIES`.
2. Updated all six fixture files with `"aspect": 1.0` in both `backend/fixtures/` and
   `frontend/public/samples/` (`triangle.json`, `sine.json`, `barchart.json`).
3. Supervisor may run `python -m app.export_schema` from `backend/` and
   `npm --prefix frontend run gen:types` to regenerate artifacts.

---

## 4. Test Suite Summary

A dedicated test suite in `backend/tests/test_k3_validate_hardening.py` contains 20 unit and
regression tests covering all 10 findings:
- `test_f6_clamp_coord_rejects_nan_and_infinity`
- `test_f6_schema_rejects_nan_and_infinity_in_point`
- `test_f6_schema_rejects_nan_and_infinity_in_bar_value`
- `test_f6_schema_rejects_nan_and_infinity_in_axes`
- `test_f6_validate_scene_drops_elements_with_nan_or_inf`
- `test_f7_validate_scene_never_raises_on_unhashable_endpoints`
- `test_f7_validate_scene_never_raises_on_arbitrary_garbage`
- `test_f5_dropping_point_used_by_segments_fails_validation`
- `test_f5_dropping_element_named_in_facts_fails_validation`
- `test_f5_dropping_unreferenced_stray_element_is_allowed`
- `test_f9_polyline_needs_at_least_2_points_to_be_drawable`
- `test_f15_dedupe_ids_before_dangling_segment_check`
- `test_f12_sanitises_spoken_strings_and_strips_control_characters`
- `test_f12_length_caps_enforced`
- `test_f12_rejects_empty_ids`
- `test_b2_05_normalise_inverted_bars`
- `test_f2_aspect_ratio_in_diagram_scene`
- `test_f2_semantic_longest_side_with_aspect`
- `test_f2_semantic_right_angle_with_aspect`
- `test_b2_06_validate_scene_enforces_points_limit`
- `test_b2_06_validate_scene_enforces_segments_limit`
- `test_b2_06_validate_scene_enforces_polylines_limit`
- `test_b2_06_validate_scene_enforces_polyline_points_limit`
- `test_b2_06_validate_scene_enforces_bars_limit`
- `test_b2_06_validate_scene_enforces_facts_limit`
- `test_b2_13_colour_shape_words_with_punctuation_rejected`

---

## 5. Follow-Up Resolution (Tasks 1–4)

1. **Schema Max-Length Removal (B2-06):**
   - Removed artificial `max_length` constraints from `Polyline.points` and `DiagramScene` fields
     (`points`, `segments`, `polylines`, `bars`, `facts`) in `backend/app/schema.py`.
   - Structural limits remain strictly enforced at endpoint intake: `/validate` enforces 1000
     points via `_check_structural_limits` in `validate.py`, and `/ask` enforces 2000 points via
     `_check_scene_size` in `ask.py`.
   - Resolves failures in `test_fix_ask_regression.py::test_ask_accepts_polyline_up_to_2000_points`,
     `test_fix_ask_regression.py::test_ask_rejects_polyline_over_2000_points`,
     `test_round2_ask.py::test_validate_keeps_its_polyline_cap_while_ask_allows_more`, and
     `test_h3_cost_guard.py::test_c2_prompt_exceeding_cap_without_coords_falls_back_to_facts`.

2. **Aspect Preservation in Fixture Dump & Semantic (F2):**
   - Added `"aspect": 1.0` to all three sample JSON files in both `backend/fixtures/` and
     `frontend/public/samples/` (`triangle.json`, `sine.json`, `barchart.json`), keeping both
     directories byte/key identical.
   - Updated `validate.py` to repair `"aspect": null` inputs back to default `1.0`.
   - `semantic.py` defaults missing or None aspect to 1.0 (`getattr(scene, "aspect", 1.0) or 1.0`).
   - Resolves failures in `test_fixtures.py::test_sample_json_matches_factory[triangle|sine|barchart]`.

3. **Export Schema Top-Level Properties:**
   - Added `"aspect"` to `EXPECTED_TOP_LEVEL_PROPERTIES` in `backend/app/export_schema.py`.
   - Resolves failure in `test_export_schema.py::test_schema_has_all_expected_top_level_properties`.

4. **P9 Dropped Tolerance Two-Case Rule (F5):**
   - Updated `test_p9_drop_beyond_tolerance` in `backend/tests/test_validate_props.py` to test the
     two-case rule:
     - Case 1 (unreferenced): A point beyond tolerance that NO segment or fact references is
       dropped and the scene remains valid.
     - Case 2 (referenced): A point beyond tolerance that IS referenced by segments causes
       validation to reject the scene as invalid (F5).
   - Added explanatory documentation comment. Resolves failure in
     `test_validate_props.py::test_p9_drop_beyond_tolerance`.
