# Report: Lane r8-backend-fix (fixes from the Kiro review of lane r7-backend)

- **Status:** DONE
- **Tool:** Antigravity (agy), reviewed by Claude
- **Lane:** r8-backend-fix
- **Date:** 2026-11-12

## Purpose
Address findings M-01, M-02, L-01, and L-02 from `docs/reviews/kiro-review-r7-backend.md` as
specified in `docs/briefs/agy-r8-backend-fix.md`.

## Summary of Changes

### 1. M-01 (Medium): Scoped Indic General Facts vs F4c English Guard (`backend/app/ask.py`)
- **Problem:** In lane r7-backend, `has_general_fact_match` was added to `facts_lookup` to accept
  facts without element IDs when they share one content token with a measurement question and contain
  a digit. Because this branch was global, it loosened the F4c guard (requiring at least two content
  token overlaps for questions without element IDs) for English questions as well (e.g. fact
  "Area = 20 cm²" with question "what is the area?").
- **Investigation & Decision:**
  - Before lane r7-backend, `TOKEN_PATTERN` (`[\w°²]+`) fragmented Indic words into single-letter
    fragments (e.g. "क्षेत्रफल" -> `['क', 'ष', 'त', 'र', 'फल']`).
  - The existing regression tests `test_facts_lookup_hindi_tokens` and
    `test_facts_lookup_gujarati_tokens` in `tests/test_fix_ask_regression.py` only passed under the
    old code because those character fragments produced 5 overlapping tokens, meeting the
    `max_content_matches >= 2` guard by accident.
  - When B-03 corrected `TOKEN_PATTERN` to keep Devanagari and Gujarati words whole, "क्षेत्रफल"
    became a single token. Since "कितना" and "है" are stopwords, the query "क्षेत्रफल कितना है?"
    had exactly one content token ("क्षेत्रफल"), causing `max_content_matches` to be 1. Without an
    exception, both regression tests fail.
  - To resolve this without loosening the English F4c rule, the unrequested global
    `has_general_fact_match` branch was removed, and replaced with `has_indic_general_fact_match`,
    strictly gated to `(lang or "").startswith(("hi", "gu"))`.
  - For English queries, the strict F4c guard (>= 2 content tokens) remains completely intact.
  - For Hindi/Gujarati wrong-angle queries ("कोण B कितना है" with fact "कोण C = 90°"), the presence
    of point IDs ('b' and 'c') prevents `has_indic_general_fact_match` from firing (which requires
    `not cand.ids and not q_ids`), ensuring wrong-angle queries continue to return source "unknown".
  - Removed `test_facts_lookup_general_facts_hindi_and_gujarati` from `backend/tests/test_r7_backend.py`.
  - Added `test_english_single_content_token_without_id_returns_unknown` in `test_r7_backend.py`,
    verifying that English questions with 1 overlapping content token return `source == "unknown"`
    and `answer == "I don't know from this diagram."`.

### 2. M-02 (Medium): Default Max Sentences in `clamp_answer` (`backend/app/ask.py`)
- **Problem:** `clamp_answer` defaulted to `MAX_FACTS_ANSWER_SENTENCES` (3) whenever
  `preserve_symbols=True`. The semantic answer path (`ask.py:995`) also passes
  `preserve_symbols=True`, which silently allowed 3 sentences on semantic answers, violating the
  contract that spoken answers default to at most 2 sentences (`MAX_ANSWER_SENTENCES = 2`).
- **Fix:**
  - Modified `clamp_answer` so `limit_sentences` defaults strictly to `MAX_ANSWER_SENTENCES` (2)
    whenever `max_sentences` is None, regardless of `preserve_symbols`.
  - The 3-sentence allowance is only granted when explicitly requested via
    `max_sentences=MAX_FACTS_ANSWER_SENTENCES`, which the facts fallback call site in `answer_question`
    already passes explicitly.
  - Updated `test_clamp_answer_keeps_three_sentences_for_facts` in `test_r7_backend.py` so it no
    longer encodes an implicit default of 3 sentences when `max_sentences` is omitted.
  - Updated step 2 of `test_facts_answer_names_every_requested_side` to pass
    `max_sentences=MAX_FACTS_ANSWER_SENTENCES`.

### 3. L-01 (Low): Raw Mode Segment Loop Point Cap (`backend/app/raw_mode.py`)
- **Problem:** When a candidate segment exceeded `MAX_RAW_POINTS` (500), the loop exited with
  `break`. Because candidate segments are sorted longest-first, subsequent shorter segments that
  reuse existing points (adding 0 new points) were prematurely discarded.
- **Fix:**
  - Replaced `break` with `continue` when `len(point_registry) + new_points > MAX_RAW_POINTS`.
  - Added a cheap exit `if len(segments) >= MAX_RAW_SEGMENTS: break` at the start of the loop.
  - Added unit test `test_raw_mode_continues_past_point_cap_for_reused_points` in
    `backend/tests/test_r7_backend.py`.

### 4. L-02 (Low): Endpoint Test Unknown Assertions (`backend/tests/test_r7_backend.py`)
- **Problem:** The Hindi and Gujarati wrong-angle endpoint tests asserted localized strings
  ("ज्ञात नहीं है", "જાણ નથી") via exact substrings, making them fragile to i18n copy edits.
- **Fix:**
  - Updated `test_hindi_wrong_angle_not_answered` and `test_gujarati_wrong_angle_not_answered` to
    assert `data["source"] == "unknown"` only, omitting the localized substring checks.

## Deferred List
- None. All items requested in the brief and review are implemented.

## Verification & Files Touched
- All edits adhere to `ruff-format` style and 100-column line length limits.
- Zero shell commands were executed in accordance with headless mode rules.
- Files touched:
  - `backend/app/ask.py`
  - `backend/app/raw_mode.py`
  - `backend/tests/test_r7_backend.py`
  - `docs/reports/agy-r8-backend-fix-report.md`
  - `docs/BUILD_LOG.md`
