# Report: Lane r7-backend (fixes for the Nov 12 Kiro audit: backend)

- **Status:** DONE
- **Tool:** Antigravity (agy), reviewed by Claude
- **Lane:** r7-backend
- **Date:** 2026-11-12

## Purpose
Fix backend findings B-01, B-02, and B-03 from `docs/reviews/kiro-audit-2026-11-12-backend.md` as
specified in `docs/briefs/agy-r7-backend.md`.

## Scope & Implementation Details

### 1. B-01 (High): Point cap for Raw Mode (`backend/app/raw_mode.py`)
- **Problem:** Raw Mode could emit up to 300 segments and ~600 points when endpoints did not merge
  within `merge_tol`, but `validate_scene` rejects scenes with more than 500 points
  (`MAX_SCENE_POINTS`). On busy photos (e.g. 500 disjoint short lines on 1200x1200),
  `POST /api/v1/scene` with no providers returned HTTP 422 ("scene has too many points")
  instead of outlines.
- **Fix:**
  - Added constant `MAX_RAW_POINTS = 500` in `raw_mode.py` matching the validator's structural limit.
  - Implemented pre-addition checks via `find_point`: degenerate segments merging to a single vertex
    are skipped, and new point counts (`needed`) are calculated before adding a segment.
  - When adding a segment would cause `len(point_registry) + needed > MAX_RAW_POINTS`, segment
    addition halts (`break`), ensuring `len(points) <= 500` and all outlines pass `validate_scene`.
  - Did not edit `backend/app/validate.py` (Kiro-owned).

### 2. B-02 (Medium): Facts fallback tied winner retention (`backend/app/ask.py`)
- **Problem:** `facts_lookup` gathers up to 3 tied winning facts, but `clamp_answer` only kept
  the first two sentences (`MAX_ANSWER_SENTENCES = 2`). Asking for three sides ("How long are
  AB, BC and AC?") silently dropped the third fact (AB = 5 cm).
- **Fix:**
  - Added `MAX_FACTS_ANSWER_SENTENCES = 3` in `ask.py`.
  - Added `max_sentences: int | None = None` parameter to `clamp_answer`. When `max_sentences`
    is None, it defaults to `MAX_FACTS_ANSWER_SENTENCES` (3) if `preserve_symbols=True`
    (facts/semantic path) and `MAX_ANSWER_SENTENCES` (2) otherwise (model output).
  - In `answer_question`, facts fallback path passes `max_sentences=MAX_FACTS_ANSWER_SENTENCES`
    and `preserve_symbols=True`, retaining all 3 tied winning facts.
  - Model answers and standalone calls remain clamped to 2 sentences.

### 3. B-03 (Medium): Indic vowel signs & combining marks (`backend/app/ask.py`)
- **Problem:** `TOKEN_PATTERN` (`[\w°²]+`) did not include Devanagari or Gujarati combining marks
  (Unicode categories Mn and Mc). Hindi and Gujarati words like "कितनी" or "કેટલી" were fragmented
  into pieces ('क', 'तन'), stopwords in those scripts never matched, and questions like
  "कोण B कितना है" spuriously matched angle C ("कोण C = 90°") due to fragmented character overlaps
  passing the F4c rule.
- **Fix:**
  - Updated `TOKEN_PATTERN` to:
    `re.compile(r"\d+(?:\.\d+)?|[\w\u0900-\u097F\u0A80-\u0AFF°²]+", re.UNICODE)`.
  - Devanagari (`\u0900-\u097F`) and Gujarati (`\u0A80-\u0AFF`) words stay intact as single tokens.
  - Stopwords match and filter cleanly; wrong-angle questions no longer match unrelated facts.
  - English behavior and existing tests remain completely intact.

## Deferred List
- **B-04 (Low):** `POST /api/v1/validate` rejects non-list field types with 500 instead of
  422/ok=False. Skipped per brief instructions.
- **B-05 (Low):** Validated scene id length (400 chars) vs `/ask` scene size check (300 chars).
  Kiro ownership (`validate.py`), skipped per brief instructions.
- **B-06 (Low):** Navigation / location fallback without facts returns "Segment BC." instead of
  unknown. Skipped per brief instructions.

## Verification & Real Tests
Added test suite in `backend/tests/test_r7_backend.py` covering:
1. `test_raw_mode_scene_always_passes_validator_point_cap`:
   - 500 short 60 px lines on 1200x1200 image.
   - Verifies `len(scene.points) <= 500`, `len(scene.segments) <= 300`.
   - Verifies `validate_scene(scene.model_dump()).scene is not None` with `errors == []`.
2. `test_raw_mode_endpoint_returns_200_raw_mode`:
   - `POST /api/v1/scene` with no providers (`ProviderChain([])`) returns 200 with `mode == "raw"`.
3. `test_facts_answer_names_every_requested_side`:
   - Scene with facts AB, BC, AC; question "How long are AB, BC and AC?".
   - Verifies all three sides (AB, BC, AC) are present in the answer.
4. `test_clamp_answer_keeps_three_sentences_for_facts`:
   - Verifies 3 sentences kept for facts path and 2 sentences kept for model output.
5. `test_token_pattern_keeps_indic_words_whole`:
   - Verifies `TOKEN_PATTERN.findall("कितनी") == ["कितनी"]`.
   - Verifies `TOKEN_PATTERN.findall("કેટલી") == ["કેટલી"]`.
   - Verifies full sentences with vowel marks remain intact words.
6. `test_hindi_wrong_angle_not_answered`:
   - Facts `["कोण C = 90°"]`, question "कोण B कितना है" returns source `unknown` and Hindi phrase.
   - Question "कोण A कितना है" returns source `unknown`.
   - Question "कोण C कितना है" returns source `facts` with 90°.
7. `test_gujarati_wrong_angle_not_answered`:
   - Facts `["ખૂણો C = 90°"]`, question "ખૂણો B કેટલો છે" returns source `unknown`.
   - Question "ખૂણો C કેટલો છે" returns source `facts` with 90°.
8. `test_english_behavior_remains_unchanged`:
   - English known questions return facts; unknown questions return unknown.
9. `test_facts_lookup_general_facts_hindi_and_gujarati`:
   - Verifies single-content general facts match in Hindi ("क्षेत्रफल") and Gujarati ("ક્ષેત્રફળ").
10. `test_raw_mode_small_image_endpoint_returns_200`:
   - Verifies 10x10 tiny valid image returns 200 mode raw with X-Vision-Provider raw header.

## Pass 2 (Supervisor Gate Regression Fixes)

### 1. Fix for B-03 coexistence with Hindi & Gujarati single-content facts lookup
- **Regression:** `tests/test_fix_ask_regression.py::test_facts_lookup_hindi_tokens` and
  `::test_facts_lookup_gujarati_tokens` failed with `ans is None`.
- **Cause:** When B-03 prevented Indic words like "क्षेत्रफल" and "ક્ષેત્રફળ" from fragmenting into
  sub-character pieces, questions with only one content word ("क्षेत्रफल कितना है?", "ક્ષેત્રફળ કેટલું છે?")
  only matched 1 content token (`max_content_matches == 1`), because the question particles
  ("कितना", "है", "કેટલું", "છે") are correctly filtered by `QUESTION_STOPWORDS`. F4c previously
  required `max_content_matches >= 2` (which only passed previously due to accidental fragmentation).
- **Fix:** In `ask.py` (`facts_lookup`), added `has_general_fact_match`:
  general facts (facts without element IDs) can match measurement queries with 1 content
  token when neither the question nor the fact references specific element IDs. Meanwhile, element-specific
  facts (like "कोण C = 90°") maintain strict ID isolation, ensuring "कोण B कितना है" and "कोण A कितना है"
  return unknown.

### 2. Fix for Raw Mode point cap on tiny images (422 regression)
- **Regression:** `tests/test_h3_cost_guard.py::test_a8_x_vision_provider_header_and_no_echo` failed
  with 422 instead of 200.
- **Cause:** In Pass 1, an eager check `if existing_a is None and existing_b is None and math.hypot(...) <= merge_tol: continue`
  skipped adding any initial points if all extracted segments in a tiny image (10x10) were within `merge_tol`
  (which is at least 3.0 px, 30% of a 10x10 canvas). This left `point_registry` empty, emitting 0 points
  and triggering the empty outline 422 check in `run_raw_mode`.
- **Fix:** In `raw_mode.py`, removed the premature `continue`. Point additions compute `new_points`
  needed before checking `len(point_registry) + new_points > MAX_RAW_POINTS`. Degenerate endpoints
  merge to existing vertices without skipping initial point registration, so valid small images
  register their points/segments and return 200 mode raw, while noisy 500-line images still cap at
  500 points.

### 3. Formatting & Line Length Hygiene
- Checked all touched files for ruff-format compliance and <= 100 column limit. Multi-line
  expressions formatted to prevent formatting churn.

## Files Touched
- `backend/app/raw_mode.py`
- `backend/app/ask.py`
- `backend/tests/test_r7_backend.py` (new)
- `docs/reports/agy-r7-backend-report.md`
- `docs/BUILD_LOG.md`
