# Validator parity: `share/validate.ts` vs `backend/app/validate.py` (Kiro, task 37.3)

Fixture: `backend/fixtures/validator_parity.json` (32 named scenes). Tests:
- `backend/tests/test_validator_parity.py` runs it through `validate_scene`.
- `frontend/tests/validator.parity.test.ts` runs it through `validateShareScene`.

`expected` is the verdict both sides should give. A case marked `"known_mismatch": true` also records what each side gives today (`backend`, `frontend`), so both suites pass. If either validator changes, the matching test fails and this file needs updating. Neither validator was changed.

Result: 18 cases agree. **14 known mismatches**: 12 differ in verdict and 2 only in the reason.

## Why most mismatches happen
The two validators were mirrored by hand, but they guard different doors:
- `validate.py` repairs **model output**. It silently drops an element it cannot repair, and rejects only when the dropped element mattered: a segment uses it, or a fact names it (F5).
- `validate.ts` checks a **shared link** a person built. It rejects anything malformed instead of dropping it.

So "drop vs reject" on a bad element is a design difference, not a bug. The rows below say which side looks right *for the input it sees*.

## Mismatches
| Case | Backend | Share (frontend) | Which looks right |
|---|---|---|---|
| `coord_just_over_1_02_unused` (x = 1.0201, unused point) | accept (point dropped) | reject `coord_out_of_range` | Both, for their input. Dropping a stray model point is fine; a shared link should not lose a point silently. |
| `coord_just_over_1_02_used` (same, point used by a segment) | reject `dropped_referenced` | reject `coord_out_of_range` | Same verdict; reason only. |
| `nan_string_unused` (x = "NaN") | accept (dropped) | reject `coord_out_of_range` | As above. |
| `infinity_string_unused` (x = "Infinity") | accept (dropped) | reject `coord_out_of_range` | As above. |
| `numeric_string_unused` (x = "0.5") | accept (dropped) | reject `coord_out_of_range` | As above. Neither parses a numeric string; both are fine. |
| `nan_string_used` (x = "NaN", point used) | reject `dropped_referenced` | reject `coord_out_of_range` | Same verdict; reason only. |
| `dangling_endpoint_named_in_facts` (segment CZ to a missing Z, fact "CZ = 5 cm") | reject `dropped_referenced` | accept (segment dropped) | **Backend.** The share validator drops a segment the facts talk about, so Ask and Spec Ghost would refer to an edge the student cannot feel. |
| `points_301` | accept | reject `too_many_points` | Deliberate: share cap 300, backend cap 500. |
| `bars_61` | accept | reject `too_many_bars` | Same pattern: share cap 60, backend cap 100. Deliberate, as with points. |
| `colour_only_label` (point label "red") | reject `colour_only_label` | accept | **Backend.** Requirement 3.6 forbids colour-only labels. A shared link can bring one back. |
| `polyline_one_point` | accept (curve dropped) | reject `polyline_too_short` | Both, for their input (drop vs reject, as above). |
| `polyline_1001_points` (one curve) | reject `polyline_too_long` (1000 per curve) | accept (2000 in total) | Different limits: per curve vs in total. A shared scene that passes here would be refused by `/ask` (B2-06), so Ask fails on it. **Backend's limit should be mirrored**, or `/ask` should match the share cap. |
| `bar_value_nan_string_only_bar` (value "NaN") | reject `no_drawable` (bar dropped) | accept, value set to 0 | **Backend.** The share validator turns a broken value into 0, and the student is told the bar is 0. |
| `facts_101` | reject `too_many_facts` (over 100) | accept (keeps the first 50) | Both are defensible. Silently dropping facts 51 and later can hide a fact that Spec Ghost or Ask would use. |

## Agreed (no mismatch)
- Coordinates at 1.02 and -0.02 (clamped).
- Duplicate ids across kinds and within points (both rename to `_2`).
- A dangling endpoint nothing names (dropped).
- A segment with a == b (**neither rejects it**; see below).
- Empty scene and empty arrays (`no_drawable`).
- 300 points (accepted) and 501 points (`too_many_points`).
- aspect 0, 1e200 and -2 (both accept).
- A 500-character label (both cut it to 60).
- Unknown kind, version 2, and an empty point id.

## Differences in the output, not the verdict (not covered by the fixture's verdicts)
- **`aspect` is dropped by the share validator.** `validateShareScene` builds its result without `aspect`, so every shared scene opens with aspect 1. The backend keeps it (clamped to [0.05, 20]). Since Requirement 18.6, Spec Ghost measures with `aspect`, so a wide diagram that is honest can be flagged when it arrives by a shared link. **The share side looks wrong**; it should keep a finite positive `aspect`, clamped as the backend does. This is the most important finding here.
- Titles: share cuts to 60 characters, backend to 120.
- Label clean-up: the backend collapses whitespace and strips Unicode format characters by category; the share side strips a fixed list. The text that comes out can differ in spacing.
- Reserved ids (`__proto__`, `title`, ...) are renamed `el_...` by the share side and kept by the backend.
- A segment from a point to itself (`a == b`) passes both. It draws nothing to feel. If it should be rejected, both sides need the rule.

## Suggested follow-ups (not done; each changes a validator, so it needs a decision)
1. Keep `aspect` in `validateShareScene` (clamp as the backend does).
2. Mirror the colour-only-label rule (Requirement 3.6) and the "dropped element named in a fact" rule (F5) in the share validator.
3. Drop a bar with a non-finite value instead of setting it to 0.
4. Align curve limits (1000 per curve vs 2000 in total) and the facts limit (reject over 100 vs keep 50).
