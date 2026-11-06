# Lane Report: f4-fix-backend-ask

- **Lane**: `f4-fix-backend-ask`
- **Builder**: Antigravity (`agy`, headless run)
- **Reviewer**: Claude Code (Supervisor)
- **Date**: 2026-11-06
- **Status**: COMPLETED

---

## Executive Summary

All confirmed High and Medium findings (plus confirmed Low findings) from `docs/reports/audit-a4-backend-ask.md` have been re-verified in the codebase, diagnosed to root causes, fixed with minimal targeted changes, and paired with unit/regression tests in `backend/tests/test_fix_ask_regression.py`.

Per the lane brief (`docs/briefs/agy-f4-fix-backend-ask.md`), pytest and ruff were NOT run locally as the supervisor executes them. Frontend files were untouched. The semantic target short-circuit from lane g5 (`backend/app/semantic.py`) was preserved and remains intact.

---

## Detailed Findings & Fixes

### A4-01: Hindi "Don't Know" Detection Fails with ASCII Period / Danda
- **Severity**: HIGH
- **Files**: `backend/app/ask.py:171-195`
- **Re-verification**: CONFIRMED. `is_dont_know()` only stripped ASCII period `.` via `rstrip(".")`, leaving the Devanagari danda `।` attached to `DONT_KNOW_RESPONSES["hi"]` (`"मुझे इस आरेख से यह ज्ञात नहीं है।"`). When models returned an ASCII period or omitted trailing punctuation, substring comparison evaluated to `False`. This allowed hallucinated targets to survive and returned `source: "ai"` instead of fallback canonical `source: "unknown"`.
- **Root Cause**: Asymmetric punctuation stripping between response text and reference dictionary phrases.
- **Fix**: Updated `is_dont_know` to strip both ASCII period and Devanagari danda:
  ```python
  cleaned = text.strip().lower().replace("’", "'").replace("‘", "'").rstrip(".।").strip()
  ...
  for phrase in DONT_KNOW_RESPONSES.values():
      if phrase.lower().rstrip(".।").strip() in cleaned:
          return True
  ```
- **Regression Test**: `test_is_dont_know_hindi_variants` and `test_hindi_dont_know_drops_target_and_sets_unknown` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

### A4-02: `facts_lookup` Answers Bypass Length & Sentence Caps
- **Severity**: HIGH
- **Files**: `backend/app/ask.py:851`
- **Re-verification**: CONFIRMED. When `facts_lookup` matched multiple facts, up to 3 winners of up to 300 characters each were joined without clamping, resulting in answers up to 900+ characters being spoken to the student.
- **Root Cause**: `answer_question()` returned `AskResponse(answer=fact_answer, source="facts", target=None)` directly without running `fact_answer` through `clamp_answer()`.
- **Fix**: Wrapped `fact_answer` with `clamp_answer` in `answer_question()`:
  ```python
  return AskResponse(answer=clamp_answer(fact_answer), source="facts", target=None)
  ```
- **Regression Test**: `test_facts_lookup_clamped_to_max_chars_and_sentences` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

### A4-03: `MAX_POLYLINE_POINTS` Limit Drift (1000 vs 2000)
- **Severity**: HIGH
- **Files**: `backend/app/ask.py:55`
- **Re-verification**: CONFIRMED. Teacher Share contract (`frontend/src/share/limits.ts:18` and `docs/briefs/guide-share-contract.md:64`) allows curves up to 2000 polyline points. `backend/app/ask.py` enforced `MAX_POLYLINE_POINTS = 1000`, causing valid shared teacher diagrams with >1000 points to crash on `/api/v1/ask` with HTTP 422.
- **Root Cause**: Size cap constant drift in `/ask` validation.
- **Fix**: Updated `MAX_POLYLINE_POINTS = 2000` in `backend/app/ask.py`.
- **Regression Test**: `test_max_polyline_points_is_2000`, `test_ask_accepts_polyline_up_to_2000_points`, and `test_ask_rejects_polyline_over_2000_points` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

### A4-04: Point "A" Unmatchable in `facts_lookup`
- **Severity**: MEDIUM
- **Files**: `backend/app/ask.py:365-435`
- **Re-verification**: CONFIRMED. `NON_ID_UPPERCASE = {"A", "I"}` caused `facts_lookup` to unconditionally discard token "A". Even when point "A" was an element of the scene and present in facts (e.g. "A is the apex"), queries like "What is A?" discarded "A" as a stopword/non-id and returned `None`.
- **Root Cause**: Overbroad exclusion of "A" without checking whether "A" exists in `known_ids`.
- **Fix**:
  1. Extracted `known_ids` from scene elements before parsing facts.
  2. In candidate fact extraction, recognized uppercase words in `known_ids` as element IDs.
  3. In question tokenization, only treated "A" as non-ID if "a" was NOT in `known_ids`:
     ```python
     if w in NON_ID_UPPERCASE and wl not in known_ids:
         continue
     if _is_point_id(w) or (w.isupper() and wl in known_ids):
         (q_ids if wl in known_ids else unknown_ids).add(wl)
     ```
- **Regression Test**: `test_facts_lookup_query_point_a` and `test_facts_lookup_article_a_without_point_a_does_not_match` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

### A4-05: `parse_model_ask_output` Converts Non-String Answer to Python Dict Repr
- **Severity**: MEDIUM
- **Files**: `backend/app/ask.py:670-680`
- **Re-verification**: CONFIRMED. If the model output valid JSON where `"answer"` was a dict (`{"answer": {"description": "Point A"}}`), `ans = str(parsed["answer"])` converted it to `"{'description': 'Point A'}"`, which was spoken aloud by TTS.
- **Root Cause**: Absence of type check on `parsed["answer"]`.
- **Fix**: Validated that `raw_ans` is a non-empty string; otherwise fell through to plain-text fallback with `target = None`:
  ```python
  raw_ans = parsed["answer"]
  if isinstance(raw_ans, str) and raw_ans.strip():
      return raw_ans.strip(), parsed.get("target")
  ```
- **Regression Test**: `test_parse_model_ask_output_rejects_dict_answer` and `test_parse_model_ask_output_rejects_null_and_list_answer` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

### A4-06: Unicode-Aware Tokenization for Hindi & Gujarati Facts Lookup
- **Severity**: MEDIUM
- **Files**: `backend/app/ask.py:70-130, 360-420`
- **Re-verification**: CONFIRMED. `re.findall(r"[a-zA-Z0-9°²]+", ...)` discarded all Devanagari and Gujarati characters, producing empty question tokens and failing `facts_lookup` on valid multilingual queries.
- **Root Cause**: ASCII-only regex character classes in tokenizer.
- **Fix**:
  1. Switched token regexes in `facts_lookup` to `re.findall(r"[\w°²]+", ..., re.UNICODE)`.
  2. Added Hindi and Gujarati question words and functional particles to `QUESTION_STOPWORDS` (e.g. `क्या`, `कितना`, `कहाँ`, `છે`, `શું`, `કેટલું`).
  3. Adjusted scoring threshold to permit single distinctive content keyword match against facts (`best_score >= 3`).
- **Regression Test**: `test_facts_lookup_hindi_tokens` and `test_facts_lookup_gujarati_tokens` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

### A4-07: Concurrency & Disconnect Control on `POST /api/v1/ask`
- **Severity**: MEDIUM
- **Files**: `backend/app/main.py:63-68, 131-185, 686-715`
- **Re-verification**: CONFIRMED. Unlike `/api/v1/scene`, `/api/v1/ask` lacked a concurrency semaphore and disconnect check, risking API quota exhaustion under classroom bursts.
- **Root Cause**: Route lacked process-wide semaphore bounding and Starlette `Request.is_disconnected()` check.
- **Fix**: Added `get_ask_semaphore()` (default concurrency 4, bounded wait with HTTP 503 Retry-After) and checked `if await raw_request.is_disconnected(): return Response(status_code=499)` before invoking provider completion.
- **Regression Test**: `test_ask_semaphore_has_bounded_capacity` and `test_ask_route_disconnect_returns_499` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

### A4-08: TTS Control Character and Markdown Formatting Sanitization
- **Severity**: LOW
- **Files**: `backend/app/ask.py:338-348`
- **Re-verification**: CONFIRMED. Spoken text in `clamp_answer` did not strip non-printable ASCII control characters or markdown formatting (`*`, `_`, `` ` ``, `#`), which TTS engines pronounce aloud (e.g. "asterisk asterisk").
- **Root Cause**: `clamp_answer` only split sentences and truncated length.
- **Fix**: Sanitized control characters `[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]` and markdown delimiters `[*_`#]` before sentence splitting.
- **Regression Test**: `test_clamp_answer_strips_control_characters_and_markdown` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

### A4-09: RequestGuardMiddleware Stale Key Memory Leak
- **Severity**: LOW
- **Files**: `backend/app/limits.py:125-140`
- **Re-verification**: CONFIRMED. `_HITS` dictionary retained expired keys indefinitely as NAT clients or spoofed IPs connected.
- **Root Cause**: `popleft()` drained deques but dictionary keys were never removed.
- **Fix**: When `len(_HITS) > 1000`, stale keys with empty deques or timestamps older than `RATE_WINDOW_SECONDS` (excluding the current active key) are pruned from `_HITS`.
- **Regression Test**: `test_rate_limiter_prunes_stale_client_entries` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

### A4-10: Case-Insensitive Fenced JSON Parsing
- **Severity**: LOW
- **Files**: `backend/app/ask.py:655-660`
- **Re-verification**: CONFIRMED. Fenced code block regex `r"```(?:json)?\s*([\s\S]*?)\s*```"` lacked `re.IGNORECASE`, capturing `JSON\n{...}` when models returned ````JSON`, causing JSON parsing failure.
- **Root Cause**: Case-sensitive fence matching.
- **Fix**: Added `re.IGNORECASE` to code block search in `parse_model_ask_output`.
- **Regression Test**: `test_parse_model_ask_output_handles_uppercase_json_fence` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

### A4-11: Element ID Length Cap in `_check_scene_size`
- **Severity**: LOW
- **Files**: `backend/app/ask.py:505-515`
- **Re-verification**: CONFIRMED. `_check_scene_size` validated title, labels, and facts against `MAX_TEXT_CHARS = 300` but omitted element ID lengths.
- **Root Cause**: `texts` list did not include element IDs from points, segments, polylines, or bars.
- **Fix**: Added element IDs to the `texts` check in `_check_scene_size`, raising `ValueError` if any ID exceeds `MAX_TEXT_CHARS`.
- **Regression Test**: `test_check_scene_size_rejects_giant_element_id` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

### Additional Hardening: Prompt Delimiter Sanitization on Element IDs
- **Severity**: DEFENSE-IN-DEPTH
- **Files**: `backend/app/ask.py:284-288`
- **Description**: Added `QUESTION_TAG_PATTERN.sub("[tag removed]", eid)` to element IDs in `build_ask_prompt` so malicious diagram element IDs cannot attempt prompt delimiter breakouts.
- **Regression Test**: `test_prompt_delimiter_sanitized_in_element_ids` in `backend/tests/test_fix_ask_regression.py`.
- **Status**: FIXED

---

## Files Touched
- `backend/app/ask.py` (findings A4-01, A4-02, A4-03, A4-04, A4-05, A4-06, A4-08, A4-10, A4-11, delimiter escaping)
- `backend/app/main.py` (finding A4-07: ask semaphore concurrency and client disconnect)
- `backend/app/limits.py` (finding A4-09: stale client key pruning)
- `backend/tests/test_fix_ask_regression.py` (14 new regression tests covering all findings)
- `docs/reports/agy-f4-fix-backend-ask-report.md` (this report)
- `docs/BUILD_LOG.md` (build entry)
