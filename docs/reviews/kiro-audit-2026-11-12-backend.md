# Backend audit (backend/app/*.py, backend/tests) - Kiro

Scope read: main.py, limits.py, middleware.py, image_utils.py, schema.py, validate.py, raw_mode.py, ask.py, scene_cache.py, paid_budget.py, graphs/*, vision/* (chain, base, gemini, openai, nebius, _openai_compat, prompts), render.yaml, validator-parity.md. semantic.py was read in part (phrase table, normaliser, peak finder), not line by line.
Ran: the full backend pytest suite (passes) plus probe scripts against the real FastAPI app via TestClient. Nothing in the repo was changed; probes live in the scratchpad.

Checked and found OK (no finding): body-size cap before multipart parsing (a 12 MB chunked upload gets 413), Content-Length parsing, MIME sniffing and the 12 MP header cap, rate-limit key derivation and table bounds, CORS ordering (429/413 from the guard still carry CORS headers), secret redaction in provider errors, the budget counter, the cache (stores only validated "ai" payloads, deep-copies), and /ask 422s for malformed bodies. No key-shaped strings outside test fakes.

---

## B-01 · High · backend/app/raw_mode.py:22,265 with backend/app/validate.py:41 (and main.py run_raw_mode)
**Problem:** Raw Mode can emit up to 300 segments but, because endpoints merge only within a small radius, up to about 600 points, while `validate_scene` rejects scenes with more than 500 points; `run_raw_mode` then returns 422 instead of the outline.
**Failing scenario:** The AI chain is unavailable or times out (the exact case Raw Mode exists for) and the student photographs a busy page, such as hatching, graph paper with many separate dashes, or a cluttered figure. I drew 500 random 60 px lines on a 1200x1200 PNG. `build_raw_scene` returned 510 points and 300 segments, and `POST /api/v1/scene` with no providers returned `422 "Extracted outline could not be validated: scene has too many points (510 > 500). Please upload a clearer photo."` The student gets an error, not outlines. The README promises "students are never left with an empty screen".
**Suggested failing test:** `test_raw_mode_scene_always_passes_validator_point_cap`: build several noisy images (many disjoint short lines), call `build_raw_scene`, and assert `len(scene.points) <= 500` and that `validate_scene(scene.model_dump()).scene is not None`. Also an endpoint test: with `chain.providers == []`, upload that image and assert 200 with `mode == "raw"`.
**Fix suggestion:** Cap points as well as segments (stop adding segments when the point count would pass 500, or take at most 250 segments).
**Who fixes:** agy (raw_mode.py is not Kiro-owned). If the fix is to raise the limit in the validator, that is Kiro.
**Confidence:** high (reproduced).

## B-02 · Medium · backend/app/ask.py:634-635 plus clamp_answer (~line 472), used by the answer_question facts fallback
**Problem:** `facts_lookup` collects up to three tied facts, but `clamp_answer` then keeps only the first two sentences, so the third is silently dropped with no hint that anything was left out.
**Failing scenario:** With no model available (budget spent, timeout, no key), triangle fixture: "How long are AB, BC and AC?" returns `facts: "AC = 4 cm. BC = 3 cm."`. AB = 5 cm, the hypotenuse the student probably cares about, is never spoken, and the answer reads as complete.
**Suggested failing test:** `test_facts_answer_names_every_requested_side`: scene with facts AB, BC, AC; question naming all three; assert all three facts appear in `answer` (or the answer says there are more). Ensure `clamp_answer` for the facts path does not cut tied winners.
**Who fixes:** agy (ask.py is not in the Kiro-owned list).
**Confidence:** high (reproduced).

## B-03 · Medium · backend/app/ask.py:479 (TOKEN_PATTERN) feeding facts_lookup
**Problem:** `[\w°²]+` does not match Devanagari or Gujarati vowel signs, so Hindi and Gujarati words are cut into single-letter fragments; stopwords (which are listed in those scripts) never match, and unrelated facts overlap on fragments.
**Failing scenario:** `TOKEN_PATTERN.findall("AB की लंबाई कितनी है")` gives `['AB','क','ल','ब','ई','क','तन','ह']`. With facts `["कोण C = 90°"]` and lang `hi`, the question "कोण B कितना है" ("what is angle B?") with no model available answers `facts: "कोण C = 90°."`, which is the wrong angle. The English equivalent correctly says "I don't know from this diagram." because only one content token overlaps; in Hindi the fragments `क` and `ण` give two overlaps and pass the F4c rule. The same question for angle A also answers with C.
**Suggested failing test:** `test_token_pattern_keeps_indic_words_whole` asserts `TOKEN_PATTERN.findall("कितनी") == ["कितनी"]` (same for Gujarati "કેટલી"). `test_hindi_wrong_angle_not_answered`: facts `["कोण C = 90°"]`, question "कोण B कितना है" returns source `unknown`.
**Fix suggestion:** include combining marks, e.g. `[\w\u0900-\u097F\u0A80-\u0AFF°²]+`.
**Who fixes:** agy.
**Confidence:** high (reproduced; the fallback path only runs when no model answered).

## B-04 · Low · backend/app/main.py:~981 (ValidateRequest._validate_scene_size) and ask.py `_check_scene_size` (~line 660-700)
**Problem:** `_check_scene_size` assumes the dict fields are lists; a non-list value makes `len()` or iteration raise `TypeError`, which pydantic does not turn into a 422, so the route returns 500.
**Failing scenario:** `POST /api/v1/validate {"scene": {"points": 5}}` returns `500 Internal Server Error`. Same for `{"polylines": 5}`, `{"facts": 5}`, `{"bars": 5}`, and `{"polylines":[{"id":"p","points":5}]}` (all five reproduced). `validate_scene` itself handles these ("never raises"), but it is never reached.
**Suggested failing test:** `test_validate_route_rejects_wrong_field_types_with_422_or_ok_false`: parametrize the five bodies and assert status is 200 with `ok == false` or 422, never 500.
**Who fixes:** agy (main.py). The shared helper in ask.py is also agy's.
**Confidence:** high (reproduced). Severity Low because only a hostile or buggy client sends this; no data loss.

## B-05 · Low · backend/app/validate.py:157 vs backend/app/ask.py `_check_scene_size` (MAX_TEXT_CHARS = 300)
**Problem:** `validate_scene` caps labels (60), titles and facts but not element ids, while `/ask` rejects any scene with an id longer than 300 characters.
**Failing scenario:** A model returns a point with a 400-character id (a sentence used as an id). The scene passes `validate_scene`, is returned as `mode: "ai"`, and then every Ask on it gets 422, so the student can never ask a question about that diagram and only hears a generic failure. Unlikely, but nothing in the pipeline prevents it.
**Suggested failing test:** `test_validated_scene_is_always_accepted_by_ask`: property or example test; take a scene with a 400-char id, run `validate_scene`, and if it returns a scene, assert `AskRequest(scene=..., question="x")` constructs without error (or that validate rejects/truncates the id).
**Who fixes:** Kiro (validator).
**Confidence:** medium (mismatch is certain from the code; real-world likelihood is low).

## B-06 · Low · backend/app/ask.py facts_lookup (segment candidates, ~line 534) and the Segment/semantic fallback
**Problem:** The deterministic fallback has no navigation or location handling and answers a length or location question with a non-answer, instead of "I don't know".
**Failing scenario:** Triangle with facts for AB and angle C only (no model available). "How long is BC?" returns `facts: "Segment BC."`. "take me to C" returns `"angle C = 90 degrees"` with `target: null`. "where is B" returns "I don't know from this diagram." even though B is a labelled point (the Guide feature then has nothing to steer to).
**Suggested failing test:** `test_length_question_without_length_fact_is_unknown` (assert source `unknown`, not "Segment BC."), and `test_navigation_phrase_with_known_point_returns_element_target` (assert `target.elementId == "C"` for "take me to C" even with no provider).
**Who fixes:** agy (ask.py/semantic.py).
**Confidence:** medium (reproduced; low impact because Guide is off by default and the model normally answers).

---

Not reported (judged by-design or too speculative): the global PAID_CALLS_PER_DAY budget lets one abusive client use up the AI quota for everyone until UTC midnight (counter is per-process, so it also resets on every Render cold start); app `logger.info` lines are never emitted because no logging config sets the root level (only warnings show); a shape word such as "circle" on a polyline rejects the whole scene by Requirement 3.6; Raw Mode scenes keep `aspect = 1.0` for non-square photos (frontend geometry ignores `aspect`, so this matches how AI scenes are drawn).

SUMMARY: 1 high, 2 medium, 3 low
AUDIT-DONE
