# Audit Report: Lane a4-backend-ask

- **Lane**: `a4-backend-ask`
- **Auditor**: Antigravity (`agy`, headless audit)
- **Date**: 2026-11-06
- **Status**: COMPLETE (Audit Only — zero source code files edited)
- **Scope**:
  - `backend/app/ask.py` (target parsing & validation, prompts, facts lookup, size checks, TTS answer clamp)
  - `backend/app/main.py` (`POST /api/v1/ask` route, concurrency, middleware integration)
  - `backend/app/middleware.py` (security headers, caching)
  - `backend/app/limits.py` (request body caps, IP rate limiting)
  - `backend/tests/test_ask.py`, `backend/tests/test_ask_target.py`
  - Cross-contract verification against `docs/briefs/guide-share-contract.md`, `frontend/src/api/ask.ts`, and `frontend/src/guide/geometry.ts` (`resolveTarget`)

---

## Executive Summary
The Ask pipeline (`POST /api/v1/ask`) and Guide target resolution represent a clean, robust design with strict fallback guarantees (a target never survives a fallback or "don't know" answer, and privacy logging is strictly adhered to). However, the audit revealed **3 High**, **4 Medium**, and **4 Low** confirmed issues. Key among them are:
1. Hindi "don't know" detection failure when an ASCII period is returned (due to Devanagari danda unstripped in `is_dont_know`), causing hallucinated targets to survive;
2. `facts_lookup` answers completely bypassing spoken answer length and sentence caps (`MAX_ANSWER_CHARS`);
3. Discrepancy between the `/ask` polyline point cap (1000) and the Teacher Share contract (2000), causing valid shared diagrams to fail on `/ask` with HTTP 422;
4. Point "A" being unqueryable by name in `facts_lookup` due to `NON_ID_UPPERCASE`.

---

## Areas Checked and Sound

- **Delimiter Escaping**: `<user_question>` and `</user_question>` tags in user questions are stripped via `QUESTION_TAG_PATTERN` before prompt interpolation, preventing prompt delimiter breakout.
- **Element ID Prompt Escaping**: `extract_scene_element_ids(scene)` is formatted via `json.dumps(element_ids)`, ensuring quotes, newlines, and special characters inside IDs are safely JSON-escaped.
- **Target Extraction Strictness**: `validate_ask_target` strictly requires `set(raw_target.keys()) == {"elementId"}` or `{"x", "y"}`. Extra keys (such as `nested`, `label`, `extra`) and invalid types (strings, lists, booleans for coordinates, NaN, infinity) are safely discarded to `None`.
- **Target Coordinate Boundaries**: Coordinates in `PointTarget` must be finite numbers in `[0.0, 1.0]`. Boundaries at exactly `0.0` and `1.0` work correctly. `bool` coordinates (`True`/`False`) are explicitly rejected.
- **Fallback Target Invariant**: Across all fallback branches (`facts_lookup`, `is_dont_know`, provider errors, timeouts), `target` is explicitly set to `None`; no target ever survives a fallback response.
- **Privacy & Logging**: Question text and diagram scene contents are never logged at INFO or WARNING levels; only lengths, providers, and latency are recorded (`test_ask_never_logs_question_or_scene` verified).
- **Client / Server Model Alignment**: `AskResponse` in `backend/app/ask.py` and `frontend/src/api/ask.ts` maintain 100% field parity (`answer`, `source`, `target`).
- **Frontend Target Resolution**: `resolveTarget` in `frontend/src/guide/geometry.ts` cleanly resolves all four scene element types (points, segments, polylines, bars) as well as normalized point targets.
- **Backwards Compatibility**: Older clients that do not parse `target` ignore the optional field and remain fully functional without error.

---

## Confirmed Findings

### CONFIRMED · HIGH

#### A4-01 · high · `backend/app/ask.py:148-151`
- **What is wrong**: Hindi "don't know" detection in `is_dont_know()` fails when the model response terminates with an ASCII period `.` or lacks trailing punctuation. `DONT_KNOW_RESPONSES["hi"]` ends with the Devanagari danda `।` (`"मुझे इस आरेख से यह ज्ञात नहीं है।"`). `rstrip(".")` only strips ASCII period `.`, leaving the danda attached to the reference phrase. If the model outputs `"मुझे इस आरेख से यह ज्ञात नहीं है."` (standard for multilingual LLMs) or `"मुझे इस आरेख से यह ज्ञात नहीं है"`, `cleaned` strips the ASCII dot, and `phrase.lower().rstrip(".") in cleaned` evaluates to `False`. The response is incorrectly marked as `source: "ai"`, any hallucinated `target` is kept instead of dropped, and the fallback canonical message is not returned.
- **Concrete failure scenario**:
  1. Call `POST /api/v1/ask` with `lang: "hi"`, question "यह किस रंग का है?".
  2. Model returns `{"answer": "मुझे इस आरेख से यह ज्ञात नहीं है.", "target": {"elementId": "A"}}`.
  3. `is_dont_know` returns `False`.
  4. Response is returned with `source: "ai"` and `target: {"elementId": "A"}` instead of `source: "unknown"` and `target: null`.
- **Proposed minimal fix**:
  Strip both ASCII period and Devanagari danda in `is_dont_know`:
  ```python
  cleaned = text.strip().lower().replace("’", "'").replace("‘", "'").rstrip(".।")
  ...
  for phrase in DONT_KNOW_RESPONSES.values():
      if phrase.lower().rstrip(".।") in cleaned:
          return True
  ```
- **Proposed test**:
  ```python
  def test_is_dont_know_hindi_with_ascii_period():
      assert is_dont_know("मुझे इस आरेख से यह ज्ञात नहीं है.") is True
      assert is_dont_know("मुझे इस आरेख से यह ज्ञात नहीं है") is True
  ```

---

#### A4-02 · high · `backend/app/ask.py:713`
- **What is wrong**: `facts_lookup` answers completely bypass `clamp_answer()` length capping, sentence capping, and sanitization. When `facts_lookup` matches up to 3 candidate facts (line 387), each fact can be up to 300 characters (`MAX_TEXT_CHARS = 300`), allowing the answer to reach ~900+ characters without sentence or character caps. Furthermore, control characters or raw formatting in scene facts are spoken directly to the student without sanitization.
- **Concrete failure scenario**:
  1. A scene has 3 facts of 250 characters each matching a query, e.g. "AB = 5 cm ...".
  2. The LLM fails or is unconfigured. `facts_lookup` matches all 3 facts and joins them into an 800-character string.
  3. `answer_question` returns `AskResponse(answer=fact_answer, source="facts", target=None)`.
  4. The frontend speaks an 800-character wall of text to the blind student, violating the 2-sentence / 300-char spoken answer constraint (`MAX_ANSWER_CHARS = 300`, `MAX_ANSWER_SENTENCES = 2`).
- **Proposed minimal fix**:
  Wrap `fact_answer` in `clamp_answer` before returning in `answer_question`:
  ```python
  return AskResponse(answer=clamp_answer(fact_answer), source="facts", target=None)
  ```
- **Proposed test**:
  ```python
  @pytest.mark.asyncio
  async def test_facts_lookup_clamped_to_max_chars():
      scene = DiagramScene(
          kind="geometry",
          facts=["Fact 1: " + "a" * 200, "Fact 2: " + "a" * 200, "Fact 3: " + "a" * 200],
      )
      resp = await answer_question(AskRequest(scene=scene, question="Fact 1", lang="en"), ProviderChain([]))
      assert len(resp.answer) <= 301
  ```

---

#### A4-03 · high · `backend/app/ask.py:46, 432-433` vs `docs/briefs/guide-share-contract.md:64`
- **What is wrong**: Size limit drift between `/ask` and Teacher Share contract: `MAX_POLYLINE_POINTS` is set to 1000 in `backend/app/ask.py:46`, but the Share contract allows up to 2000 points (`validateShareScene`: `<=2000 polyline points`). A valid shared diagram with a 1500-point curve created and verified by a teacher will be successfully opened by a student, but `POST /api/v1/ask` will reject any question with HTTP 422: `"a polyline has more than 1000 points"`.
- **Concrete failure scenario**:
  1. Teacher verifies and shares a function graph diagram with a polyline of 1200 points.
  2. Student opens the link via `#s=...`; client-side `validateShareScene` passes (limit is 2000).
  3. Student asks "What is the peak?"; client sends the scene to `POST /api/v1/ask`.
  4. Backend `_check_scene_size` raises `ValueError: a polyline has more than 1000 points` and returns HTTP 422 Unprocessable Entity.
- **Proposed minimal fix**:
  Align `MAX_POLYLINE_POINTS` in `backend/app/ask.py` to 2000:
  ```python
  MAX_POLYLINE_POINTS = 2000
  ```
- **Proposed test**:
  ```python
  def test_ask_accepts_polyline_up_to_2000_points(client: TestClient):
      poly_pts = [[i / 1500.0, 0.5] for i in range(1500)]
      scene = DiagramScene(kind="function_graph", polylines=[Polyline(id="c", points=poly_pts)])
      resp = client.post("/api/v1/ask", json={"scene": scene.model_dump(), "question": "What is this?"})
      assert resp.status_code == 200
  ```

---

### CONFIRMED · MEDIUM

#### A4-04 · med · `backend/app/ask.py:59, 359-360`
- **What is wrong**: Point "A" can never be queried by name alone in `facts_lookup`. `NON_ID_UPPERCASE` includes `"A"`, intended to avoid treating the English article "a" as an element id. However, line 359 skips any token where `w in NON_ID_UPPERCASE`. When a student asks "What is A?" or "Where is A?", the token "A" is discarded from `q_ids`, and "a" is in `QUESTION_STOPWORDS` so it is discarded from `q_content`. `q_ids` and `q_content` are both empty, causing `facts_lookup` to return `None` (whereas "What is B?" matches point B).
- **Concrete failure scenario**:
  1. Scene has points A (0.1, 0.1), B (0.5, 0.5) and fact "A is the apex".
  2. Provider chain is unavailable (fallback mode).
  3. Student asks "What is B?": returns fact for B.
  4. Student asks "What is A?": `w in NON_ID_UPPERCASE` triggers, "A" is skipped, returns `None` -> "I don't know from this diagram."
- **Proposed minimal fix**:
  Only skip "A" in `NON_ID_UPPERCASE` if "a" is NOT in `known_ids`:
  ```python
  if wl in UNIT_TOKENS:
      continue
  if w in NON_ID_UPPERCASE and wl not in known_ids:
      continue
  ```
- **Proposed test**:
  ```python
  def test_facts_lookup_query_point_a(triangle: DiagramScene):
      # Triangle has point A and facts mentioning A
      ans = facts_lookup(triangle, "What is A?")
      assert ans is not None
  ```

---

#### A4-05 · med · `backend/app/ask.py:560-563`
- **What is wrong**: `parse_model_ask_output` does not check that `parsed["answer"]` is a string. If the model outputs a structured answer object like `{"answer": {"description": "Point A is at top"}, "target": ...}` or `{"answer": null}`, `ans = str(parsed["answer"])` converts it into Python string representations like `"{'description': 'Point A is at top'}"` or `"None"`. These raw dictionary / null representations are clamped and passed directly to the TTS driver to be spoken aloud.
- **Concrete failure scenario**:
  1. Vision LLM outputs JSON: `{"answer": {"description": "Vertex at the top"}, "target": {"elementId": "A"}}`.
  2. `parse_model_ask_output` extracts `ans = "{'description': 'Vertex at the top'}"`.
  3. Spoken answer to blind student: "Left brace quote description quote colon quote Vertex at the top quote right brace."
- **Proposed minimal fix**:
  Validate that `parsed["answer"]` is a non-empty string:
  ```python
  if isinstance(parsed, dict) and "answer" in parsed:
      raw_ans = parsed["answer"]
      if isinstance(raw_ans, str) and raw_ans.strip():
          return raw_ans.strip(), parsed.get("target")
  ```
- **Proposed test**:
  ```python
  def test_parse_model_ask_output_rejects_non_string_answer():
      ans, target = parse_model_ask_output('{"answer": {"nested": "value"}, "target": {"elementId": "A"}}')
      assert not ans.startswith("{'nested'")
  ```

---

#### A4-06 · med · `backend/app/ask.py:311-370`
- **What is wrong**: `facts_lookup` parameter `lang` is unused, and tokenizer only matches ASCII regex `[a-zA-Z0-9°²]+`. For pure Hindi or Gujarati questions (e.g. "क्षेत्रफल क्या है?"), `q_raw` is empty, causing `facts_lookup` to immediately fail with `None`. Furthermore, when a Hindi/Gujarati question contains an ASCII point name like "AB का मान क्या है?", `facts_lookup` matches the English fact and returns English text ("AB = 5 cm.") to a Hindi/Gujarati student.
- **Concrete failure scenario**:
  1. Client sends Hindi question "क्षेत्रफल क्या है?" for a diagram with fact "क्षेत्रफल = 20 cm²".
  2. `re.findall(r"[a-zA-Z0-9°²]+", question)` finds zero tokens because Devanagari characters are not in `a-zA-Z`.
  3. `facts_lookup` returns `None` even though the fact is present in the diagram.
- **Proposed minimal fix**:
  Use Unicode-aware word matching `re.findall(r"[\w°²]+", question, re.UNICODE)` and recognize language-appropriate matching.
- **Proposed test**:
  ```python
  def test_facts_lookup_hindi_tokens():
      scene = DiagramScene(kind="geometry", facts=["क्षेत्रफल = 20"])
      ans = facts_lookup(scene, "क्षेत्रफल कितना है?", lang="hi")
      assert ans is not None
  ```

---

#### A4-07 · med · `backend/app/main.py:622-632`
- **What is wrong**: Lack of concurrency control and disconnect awareness on `POST /api/v1/ask`. While `/api/v1/scene` enforces `SCENE_MAX_CONCURRENCY` via `_scene_semaphore` and checks `request.is_disconnected()`, `/api/v1/ask` has no semaphore and does not inspect client disconnect. Concurrent requests from a classroom of students will all hit the upstream LLM API concurrently, causing upstream 429 quota exhaustion, and aborted requests continue executing LLM completions.
- **Concrete failure scenario**:
  1. Multiple students in a classroom ask questions simultaneously.
  2. 10 concurrent requests to `/api/v1/ask` fire simultaneously against Gemini/OpenAI free-tier API.
  3. Provider returns 429 quota exhausted for all students.
  4. If a student leaves the screen (aborting fetch at 12s), backend keeps polling the provider until server timeout (10s), burning paid tokens.
- **Proposed minimal fix**:
  Add an `ask_semaphore` (e.g. concurrency 4) and check `if await request.is_disconnected()` before provider calls.
- **Proposed test**:
  ```python
  def test_ask_route_concurrency_bounded():
      # Verify that ask semaphore restricts concurrent provider invocations
      pass
  ```

---

### CONFIRMED · LOW

#### A4-08 · low · `backend/app/ask.py:294-301`
- **What is wrong**: Spoken answer in `clamp_answer` does not filter out ASCII control characters (`\x00-\x1f`) or markdown markup (asterisks, backticks, headings). If the vision LLM replies with markdown formatting or control characters, native TTS engines can glitch or pronounce punctuation symbols aloud (e.g. "asterisk asterisk").
- **Concrete failure scenario**:
  1. LLM returns `{"answer": "The hypotenuse **AB** is `5 cm`."}`.
  2. `clamp_answer` leaves `**` and ``` unchanged.
  3. Android Web Speech API reads aloud "The hypotenuse asterisk asterisk AB asterisk asterisk is backtick five cm backtick."
- **Proposed minimal fix**:
  Strip markdown symbols (`*`, `_`, `` ` ``, `#`) and non-printable control characters in `clamp_answer`:
  ```python
  clamped = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", clamped)
  clamped = re.sub(r"[*_`#]", "", clamped)
  ```
- **Proposed test**:
  ```python
  def test_clamp_answer_strips_markdown_and_control_chars():
      raw = "Point **A** is at `(0, 0)`.\x00"
      assert clamp_answer(raw) == "Point A is at (0, 0)."
  ```

---

#### A4-09 · low · `backend/app/limits.py:33, 127-133`
- **What is wrong**: In-memory rate limiting state `_HITS` leak. `_HITS` stores `(client, path) -> deque[float]`. While expired timestamps within each deque are popped on hit, the key `(client, path)` itself is never removed from `_HITS`. Long-running servers receiving requests from varied IP addresses or spoofed `X-Forwarded-For` headers will accumulate dictionary entries indefinitely.
- **Concrete failure scenario**:
  1. Attackers or varied NAT clients send requests with 100,000 distinct `X-Forwarded-For` IPs over hours.
  2. `_HITS` dictionary retains all 100,000 keys with empty deques.
  3. Memory consumption grows monotonically.
- **Proposed minimal fix**:
  Prune empty deques periodically or delete key when `not window`.
- **Proposed test**:
  ```python
  def test_rate_limiter_prunes_empty_client_keys():
      # Verify that expired client entries are deleted from _HITS
      pass
  ```

---

#### A4-10 · low · `backend/app/ask.py:544`
- **What is wrong**: Code block markdown regex in `parse_model_ask_output` lacks `re.IGNORECASE`. If a model returns ````JSON` (uppercase), candidate 1 captures `JSON\n{...}` which fails `json.loads`. While candidate 3 can salvage it if there is a single JSON object with outer braces, if multiple code blocks or trailing explanations exist, JSON parsing fails and falls back to plain text, dropping the target.
- **Concrete failure scenario**:
  1. Model returns:
     ````
     ```JSON
     {"answer": "Here is point A.", "target": {"elementId": "A"}}
     ```
     Extra note: {not json}
     ````
  2. Candidate 1 fails on `JSON\n...`.
  3. Candidate 2 fails on markdown backticks.
  4. Candidate 3 captures from first `{` to last `{not json}` and fails.
  5. Response falls back to plain text with `target=None`.
- **Proposed minimal fix**:
  Add `re.IGNORECASE` to markdown code block regex:
  ```python
  match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
  ```
- **Proposed test**:
  ```python
  def test_parse_model_ask_output_handles_uppercase_json_fence():
      ai_text = "```JSON\n{\"answer\": \"Here.\", \"target\": {\"elementId\": \"A\"}}\n```\nExtra: {junk}"
      ans, target = parse_model_ask_output(ai_text)
      assert ans == "Here."
      assert target == {"elementId": "A"}
  ```

---

#### A4-11 · low · `backend/app/ask.py:434-438`
- **What is wrong**: `_check_scene_size` does not cap element ID lengths. Labels, facts, and titles are checked against `MAX_TEXT_CHARS = 300`, but element `id` attributes are omitted from `texts`. An attacker could supply 10,000-character element IDs in `points` or `segments`, which bypasses `_check_scene_size` and is dumped directly into the prompt via `element_ids_formatted = json.dumps(element_ids)`.
- **Concrete failure scenario**:
  1. Client sends scene with point `id = "A" * 5000`.
  2. `_check_scene_size` checks `title`, `facts`, and `labels`, but not `ids`.
  3. Request passes validation, and 5000-char ID is injected into LLM prompt.
- **Proposed minimal fix**:
  Include element IDs in `texts` check in `_check_scene_size`:
  ```python
  texts += extract_scene_element_ids(scene)
  ```
- **Proposed test**:
  ```python
  def test_check_scene_size_rejects_giant_element_id():
      scene = DiagramScene(kind="geometry", points=[Point(id="A" * 301, x=0.5, y=0.5)])
      with pytest.raises(ValueError, match="longer than 300 characters"):
          _check_scene_size(scene)
  ```

---

## Top 5 to Fix First

1. **A4-01 (High · `backend/app/ask.py:148-151`)**: Fix Hindi "don't know" detection by stripping Devanagari danda `।` (`rstrip(".।")`). Prevents hallucinated targets from surviving when the model admits it does not know the answer in Hindi.
2. **A4-02 (High · `backend/app/ask.py:713`)**: Route `facts_lookup` answers through `clamp_answer(fact_answer)` before returning. Prevents multiple combined facts from delivering an 800+ character spoken monologue to a blind student.
3. **A4-03 (High · `backend/app/ask.py:46, 432`)**: Align `MAX_POLYLINE_POINTS` to 2000 to match the Teacher Share contract. Prevents legitimate teacher-verified diagrams from crashing with HTTP 422 on `/ask`.
4. **A4-04 (Medium · `backend/app/ask.py:59, 359`)**: Allow Point "A" to be matched in `facts_lookup` when "A" is a known scene element ID, instead of unconditionally treating uppercase "A" as an indefinite article.
5. **A4-05 (Medium · `backend/app/ask.py:560-563`)**: Enforce that `parsed["answer"]` is a string before extracting it in `parse_model_ask_output`, preventing Python dict string representations (e.g. `"{'description': ...}"`) from being spoken to students.
