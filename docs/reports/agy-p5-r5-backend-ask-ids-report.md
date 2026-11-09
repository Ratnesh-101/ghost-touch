# Lane p5-r5-backend-ask-ids Report: Point IDs P1..P99 in /ask facts_lookup

Status: DONE
Lane: p5-r5-backend-ask-ids
Auditor & Implementer: Antigravity (agy, reviewed by Claude)
Date: 2026-11-09

---

## 1. Executive Summary

This report documents the resolution of the MED finding from `docs/reports/audit-r5-kiro-glue.md`
regarding point identifier parsing in `backend/app/ask.py` and regression testing in `backend/tests/`.

Frontend's `addPoint` (Kiro T34, Requirement 19) generates point IDs `P1`, `P2`, `P3`, ... once
single-letter identifiers `A`..`Z` are exhausted. In `backend/app/ask.py:412-420`, `_is_point_id`
previously checked `word.isalpha()`, which evaluated to `False` for numeric-suffixed IDs such as
`P1` or `P99`. Consequently, questions referring to non-existent points (e.g. "What is the length of
P99?") were not recognized as containing a point ID, bypassing `unknown_ids` detection in
`facts_lookup`. Instead of returning `None` to let `/ask` fall through to the model or return
"I don't know from this diagram.", `facts_lookup` would match on generic content words (like
"length") and return unrelated facts from the diagram.

The issue has been resolved by updating `_is_point_id` to accept `P` followed by 1 to 3 digits
(`r"^P\d{1,3}$"`), while strictly preserving existing behavior for uppercase letter IDs, units, and
`NON_ID_UPPERCASE` words. A comprehensive test suite (`backend/tests/test_ask_ids.py`) has been
implemented, covering unit tests, all required scene query variations, end-to-end API behavior, and
a 100-example Hypothesis property test.

---

## 2. Root Cause & Architectural Analysis

### 2.1 The Vulnerability
In `backend/app/ask.py`:
```python
def _is_point_id(word: str) -> bool:
    """True for 1-3 uppercase letters such as 'A', 'AB', 'ABC' (not a unit or 'I'/'A')."""
    return (
        1 <= len(word) <= 3
        and word.isalpha()
        and word.isupper()
        and word not in NON_ID_UPPERCASE
        and word.lower() not in UNIT_TOKENS
    )
```
In `facts_lookup` (lines 550-572):
```python
for w in q_raw:
    wl = w.lower()
    if wl in UNIT_TOKENS:
        continue
    if w in NON_ID_UPPERCASE and wl not in known_ids:
        continue
    if _is_point_id(w) or (w.isupper() and wl in known_ids):
        (q_ids if wl in known_ids else unknown_ids).add(wl)
    elif wl in known_ids and wl not in QUESTION_STOPWORDS:
        q_ids.add(wl)
...
if unknown_ids:
    return None
```

When a student asked `"What is the length of P99?"`:
1. `w = "P99"`, `wl = "p99"`.
2. `_is_point_id("P99")` returned `False` because `"P99".isalpha()` is `False`.
3. `known_ids` does not contain `"p99"`.
4. Therefore, `"p99"` was never added to `unknown_ids`.
5. `if unknown_ids: return None` was bypassed.
6. `"p99"` became an unclassified content token in `q_content`.
7. `facts_lookup` then matched other question tokens (e.g. `"length"`) against diagram facts (such
   as `"length of AB is 5 cm"`), returning an answer about an entirely different geometric element.

---

## 3. Implementation Details

### 3.1 `backend/app/ask.py`
Updated `_is_point_id` with a pre-compiled pattern matching `P` followed by 1 to 3 digits:
```python
POINT_P_ID_PATTERN = re.compile(r"^P\d{1,3}$")


def _is_point_id(word: str) -> bool:
    """True for 1-3 uppercase letters ('B', 'AB', 'ABC') or 'P' + 1-3 digits ('P1', 'P99')."""
    if POINT_P_ID_PATTERN.match(word):
        return True
    return (
        1 <= len(word) <= 3
        and word.isalpha()
        and word.isupper()
        and word not in NON_ID_UPPERCASE
        and word.lower() not in UNIT_TOKENS
    )
```

Key characteristics:
- Matches `P1`..`P999`, covering all auto-generated IDs from Ghostwriter (up to `MAX_SCENE_POINTS = 500`).
- Rejects lowercase `p1`, `p99` so questions must use uppercase `P` like other IDs.
- Rejects over-length identifiers (`P1000`, `P12345`).
- Preserves single uppercase letter `P` via the standard letter ID path.
- Preserves existing rejection of `NON_ID_UPPERCASE` (`{"A", "I"}`) and `UNIT_TOKENS`.
- In `facts_lookup`, `known_ids` collects `point.id.lower()` (e.g. `"p1"`). When a known point `P1`
  is queried, `wl in known_ids` is `True`, adding `"p1"` to `q_ids` and keeping `unknown_ids` empty.
- When an unknown point `P99` is queried, `_is_point_id("P99")` is `True` and `wl in known_ids` is
  `False`, adding `"p99"` to `unknown_ids` and safely returning `None`.

---

## 4. Test Suite Verification (`backend/tests/test_ask_ids.py`)

A new dedicated test suite `backend/tests/test_ask_ids.py` was created containing:

1. **Unit tests for `_is_point_id`:**
   - `test_is_point_id_accepts_p_numeric_ids`: Verifies `P1`, `P2`, `P9`, `P10`, `P99`, `P100`, `P999`.
   - `test_is_point_id_accepts_uppercase_letter_ids`: Verifies `B`, `C`, `D`, `Z`, `AB`, `BC`, `ABC`.
   - `test_is_point_id_accepts_single_letter_p`: Verifies single letter `P`.
   - `test_is_point_id_rejects_non_ids`: Verifies rejection of lowercase (`p1`, `p99`), 4-digit
     tokens (`P1000`), non-ID uppercase (`A`, `I`), units (`cm`, `mm`, `deg`), 4-letter tokens
     (`ABCD`), punctuation (`P-1`), and reversals (`1P`).

2. **Brief Requirement 1 — Known point P1 resolves normally:**
   - `test_facts_lookup_known_point_p1_resolves`: Scene with points A, B, C, P1 and facts
     `["P1 = 5 cm", "AB = 3 cm"]`.
   - "What is the length of P1?" -> returns `"P1 = 5 cm."`.
   - "How long is P1?" -> returns `"P1 = 5 cm."`.
   - "P1" -> returns `"P1 = 5 cm."`.

3. **Brief Requirement 2 — Unknown point P99 returns None:**
   - `test_facts_lookup_unknown_point_p99_returns_none`: Scene with points A, B, C, P1 and fact
     `"length of AB is 5 cm"`.
   - "length of P99" -> returns `None`.
   - "What is the length of P99?" -> returns `None`.
   - "Where is P99?" -> returns `None`.
   - "P99" -> returns `None`.

4. **Brief Requirement 3 — Point "P1" with fact "P1P2 = 3 cm" style:**
   - `test_facts_lookup_p1_with_segment_style_fact`: Verifies that under existing matching rules,
     querying point "P1" does not match segment fact "P1P2 = 3 cm" (returns `None`), exactly
     mirroring the behavior where querying point "A" does not match segment fact "AB = 3 cm".

5. **Brief Requirement 4 — Regression test that "AB = 3 cm" still works:**
   - `test_facts_lookup_regression_ab_questions_work`: Verifies that "What is the length of AB?",
     reversed "How long is BA?", and direct query "AB" resolve accurately to `"AB = 3 cm."`.

6. **End-to-end API integration:**
   - `test_api_ask_p1_and_p99_integration`: Uses FastAPI `TestClient` to verify that `POST /api/v1/ask`
     returns HTTP 200 with `source="facts"` for known P1, and HTTP 200 with `source="unknown"`
     ("I don't know from this diagram.") for unknown P99.

7. **Brief Requirement 5 — Hypothesis Property Test:**
   - `test_hypothesis_unknown_id_never_gets_answer`: Draws 100 test examples using Hypothesis:
     - Point pool: single letters `A`..`Z` and numeric IDs `P1`..`P99` (125 total point IDs).
     - Generates valid scenes with 1 to 15 points and associated facts.
     - Selects an unknown ID not present in the scene (from candidate set excluding English
       stopwords `"A"` and `"I"`).
     - Tests question templates ("What is the length of {id}?", "How long is {id}?",
       "What is {id}?", "Where is {id}?", "Find {id}", "length of {id}", "{id}").
     - Verifies `facts_lookup(scene, question) is None` for every single execution.

---

## 5. Invariant & Governance Adherence

- **Ownership Rule 1:** Zero edits to Kiro-owned files (`frontend/src/core/**`, `test_*_props.py`,
  `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts`, `.kiro/**`).
- **Rule 4 & 5:** No git commands run; no `.env` files read or touched.
- **Rule 6:** `backend/app/validate.py` `CLAMP_TOLERANCE` remains strictly `0.02` (unaltered).
- **Rule 7:** No `any`, no `print()`, no `console.log`.
- **Formatting:** All lines strictly <= 100 columns and ruff-format style.
- **Rule 8:** Proof recorded in `docs/BUILD_LOG.md` under tool `"agy, reviewed by Claude"`.

---

## 6. Files Touched

1. `backend/app/ask.py` — Updated `_is_point_id` with `POINT_P_ID_PATTERN` to support `P1`..`P999`.
2. `backend/tests/test_ask_ids.py` — New test suite with 10 unit/integration tests and Hypothesis PBT.
3. `docs/BUILD_LOG.md` — Appended entry for lane `p5-r5-backend-ask-ids`.
4. `docs/reports/agy-p5-r5-backend-ask-ids-report.md` — This completion report.
