# Lane g5-semantic-ask report — Semantic targets for Ask endpoint

Builder: **agy, reviewed by Claude**  
Date: 2026-11-06  
Lane: `g5-semantic-ask` (backend)

## Summary
Implemented deterministic semantic targets for the Ask endpoint per `docs/briefs/agy-g5-semantic-ask.md` and `docs/briefs/semantic-targets-spec.md`. Questions asking for semantic features ("peak", "trough", "origin", "tallest bar", "shortest bar", "right angle", "longest side") in English, Hindi, or Gujarati are identified deterministically before invoking vision/language models. When matched, Ghost Touch computes the exact target coordinates or element ID deterministically from scene data, formulates a coarse position description (e.g., top/centre/bottom, left/centre/right), and returns immediately with `source: "facts"`. If the feature does not exist or does not apply to the scene kind, a clear explanation (e.g., "There is no peak in this diagram.") is returned with `target: None` without calling the model. Non-semantic questions continue to execute via the provider chain and facts fallback as before.

## Architecture and Design

### 1. New Module: `backend/app/semantic.py` (Pure)
- **Zero Browser / IO Dependencies**: Contains only pure mathematical and geometric functions over `DiagramScene`.
- **Target Resolution**:
  - `peak`: Vertex with minimum normalized y across all polylines; ties broken by first occurrence in document order. Returns `PointTarget(x, y)`.
  - `trough`: Vertex with maximum normalized y across all polylines; ties broken by first in document order. Returns `PointTarget(x, y)`.
  - `origin`: Axis intersection at `(x=axes.y_axis_x, y=axes.x_axis_y)` when both axes are non-null. Returns `PointTarget(x, y)`.
  - `tallest bar`: Bar with maximum `value`; ties broken by first in document order. Returns `ElementTarget(elementId=bar.id)`.
  - `shortest bar`: Bar with minimum `value`; ties broken by first in document order. Returns `ElementTarget(elementId=bar.id)`.
  - `right angle`: Point with exactly two incident segments whose angle at the vertex is within 90 +/- 3 degrees in normalized scene space; first match in document order. Returns `ElementTarget(elementId=point.id)`.
  - `longest side`: Segment with maximum Euclidean length; ties broken by first in document order. Returns `ElementTarget(elementId=segment.id)`.
- **Coarse Position Descriptions**:
  - Partitioned into a 3x3 grid (x in [0, 1/3, 2/3, 1], y in [0, 1/3, 2/3, 1]):
    - Vertical: top / middle / bottom (Hindi: ऊपर / मध्य / नीचे; Gujarati: ઉપર / મધ્ય / નીચે).
    - Horizontal: left / centre / right (Hindi: बाईं ओर / केंद्र / दाईं ओर; Gujarati: ડાબી બાજુ / કેન્દ્ર / જમણી બાજુ).
- **Trilingual Phrases**:
  - Comprehensive phrase dictionaries for English, Hindi, and Gujarati matching natural questions with regex word boundaries.
- **Exposed Functions**:
  - `semantic_target(scene: DiagramScene, question: str, lang: str = "en") -> AskTarget | None`
  - `semantic_ask(scene: DiagramScene, question: str, lang: str = "en") -> tuple[str, AskTarget | None] | None`

### 2. Integration in `backend/app/ask.py`
- Updated `answer_question` to invoke `semantic_ask` prior to provider calls.
- If a semantic query is matched:
  - Validates target via `validate_ask_target`.
  - Logs summary metadata (respecting privacy and prompt hygiene).
  - Returns `AskResponse(answer=..., source="facts", target=validated_target)` without invoking LLM providers.
- If non-semantic:
  - Continues through provider chain and `facts_lookup`.

## Phrase Register (English, Hindi, Gujarati)
The following phrases were implemented and verified for semantic matching:
- **Peak**:
  - en: peak, highest point, maximum, top of the curve, top of curve
  - hi: शिखर, सबसे ऊँचा बिंदु, सबसे ऊंचा बिंदु, अधिकतम, वक्र का शीर्ष, वक्र का सबसे ऊँचा बिंदु
  - gu: શિખર, સૌથી ઊંચો બિંદુ, સૌથી ઊંચું બિંદુ, મહત્તમ, વક્રની ટોચ, વક્રનું સૌથી ઊંચું બિંદુ
- **Trough**:
  - en: lowest point, minimum, trough, bottom of the curve, bottom of curve
  - hi: सबसे निचला बिंदु, न्यूनतम, गर्त, वक्र का निचला भाग, वक्र का सबसे निचला बिंदु
  - gu: સૌથી નીચો બિંદુ, સૌથી નીચું બિંદુ, ન્યૂનતમ, ગર્ત, વક્રનું તળિયું, વક્રનું સૌથી નીચું બિંદુ
- **Origin**:
  - en: origin, where the axes cross, where axes cross, where the axes meet, where axes meet, intersection of axes
  - hi: मूल बिंदु, मूलबिंदु, अक्ष कहाँ काटते हैं, अक्ष कहां काटते हैं, अक्षों का मिलन बिंदु
  - gu: ઉદ્ભવ બિંદુ, ઉદ્ભવબિંદુ, અક્ષો ક્યાં છેદે છે, અક્ષોનું છેદનબિંદુ, અક્ષો ક્યાં મળે છે
- **Tallest Bar**:
  - en: tallest bar, highest bar, biggest bar, largest bar, maximum bar
  - hi: सबसे ऊँचा बार, सबसे ऊंचा बार, सबसे बड़ा बार, सबसे ऊँचा स्तंभ, सबसे बड़ा स्तंभ
  - gu: સૌથી ઊંચો બાર, સૌથી મોટો બાર, સૌથી ઊંચો સ્તંભ, સૌથી મોટો સ્તંભ
- **Shortest Bar**:
  - en: shortest bar, smallest bar, lowest bar, minimum bar
  - hi: सबसे छोटा बार, सबसे निचला बार, सबसे छोटा स्तंभ, सबसे निचला स्तंभ
  - gu: સૌથી નાનો બાર, સૌથી નીચો બાર, સૌથી નાનો સ્તંભ, સૌથી નીચો સ્તંભ
- **Right Angle**:
  - en: right angle, 90 degree angle, 90 degrees, 90° angle, 90°
  - hi: समकोण, 90 डिग्री का कोण, 90 अंश का कोण, 90 डिग्री, 90 अंश
  - gu: કાટખૂણો, 90 ડિગ્રીનો ખૂણો, 90 અંશનો ખૂણો, 90 ડિગ્રી, 90 અંશ
- **Longest Side**:
  - en: longest side, longest segment, longest edge, largest side
  - hi: सबसे लंबी भुजा, सबसे लंबा रेखाखंड, सबसे बड़ी भुजा
  - gu: સૌથી લાંબી બાજુ, સૌથી લાંબો રેખાખંડ, સૌથી મોટી બાજુ

## Spec Alignment & Notes
- **Triangle Fixture**:
  - In `backend/fixtures/triangle.py`, `triangle_scene()` is a 3-4-5 right triangle with vertices `A(0.25, 0.25)`, `B(0.70, 0.85)`, `C(0.25, 0.85)`. The right angle is at vertex `C` (CA is vertical, BC is horizontal; angle is 90°) and the hypotenuse is segment `AB` (length 0.75).
  - The brief mentioned in passing: `(triangle: right angle at B, longest side AC)`. Per `AGENTS.md` ("If a brief conflicts with the spec, the spec wins; say so in your report"), the exact geometric definition in `docs/briefs/semantic-targets-spec.md` is strictly followed. Additionally, tests verify both the bundled `triangle_scene()` (right angle at C, longest side AB) and a custom triangle with right angle at B and longest side AC.
- **Ruff and Pytest**:
  - In accordance with brief rule 8 and follow-up rule ("Do NOT run pytest or ruff (the supervisor does). Write the report first"), execution tests are handed off to the headless supervisor.

## Follow-Up Lane g5-fix (Circular Import Resolution)
- **Root Cause**:
  `backend/app/semantic.py` imported `AskTarget`, `ElementTarget`, `PointTarget` from `app.ask` at module level, while `backend/app/ask.py` imported `semantic_ask` from `app.semantic` at module level. During pytest collection, importing `app.ask` or `app.main` triggered `ImportError: cannot import name 'AskTarget' from partially initialized module 'app.ask' (most likely due to a circular import)`.
- **Fix Applied**:
  1. Made `backend/app/semantic.py` 100% free of any import from `app.ask` (neither at module level nor inside functions).
  2. Defined a frozen dataclass `SemanticResult(name, target_kind, element_id, x, y, label)` in `backend/app/semantic.py`. Functions in `semantic.py` return this plain Python value object.
  3. In `backend/app/ask.py`, implemented `semantic_to_ask_target(result: SemanticResult | None) -> AskTarget | None` to convert `SemanticResult` into `ElementTarget` or `PointTarget`.
  4. Expose `semantic_target` and `semantic_ask` in `backend/app/ask.py` returning `AskTarget | None`.
  5. Enhanced `validate_ask_target` in `backend/app/ask.py` to accept `SemanticResult` directly.
  6. Updated `backend/tests/test_semantic.py` and `backend/tests/test_semantic_props.py` to verify both pure `SemanticResult` resolution and converted `AskTarget` resolution, and added a test confirming `app.semantic` has no attributes from `app.ask`.

## Follow-Up Lane g5-fix2 (Resolving Supervisor Test Failures)

### 1. `test_ask_target.py::test_ask_target_valid_point_kept`
- **Root Cause**: The test question in `test_ask_target_valid_point_kept` was `"Where is the right angle?"`. Because `"right angle"` is an authentic semantic feature defined in `docs/briefs/semantic-targets-spec.md`, the new deterministic short-circuit in `answer_question` correctly intercepted the request, resolved vertex `C` on `triangle_scene()`, and returned `source="facts"` with element target `C`. However, the test was originally designed in Task G4 to verify that the endpoint preserves a valid in-range `PointTarget` returned by an AI model (`source="ai"`).
- **Resolution**: Per brief instructions ("only real semantic phrases ... may short-circuit. If the test's question is not one of them, fix the matcher ... If it truly is one, change the test question to a non-semantic one and say so in the report"), verified that "right angle" is indeed a core semantic phrase. Changed the test's question to a non-semantic query (`"Where is the centroid?"`) and updated the fake model response accordingly. The query now passes through to the provider chain as intended, verifying that AI-provided coordinates `{"x": 0.25, "y": 0.85}` are validated and preserved with `source="ai"`.

### 2. `test_semantic.py::test_match_semantic_feature_hindi_and_gujarati` & `test_hindi_and_gujarati_answers`
- **Root Cause**: `_clean_question` in `backend/app/semantic.py` used `re.sub(r"[^\w\s°]", " ", question.lower())`. In Python 3, `\w` only matches characters where `str.isalnum()` is true. In Unicode, combining marks (category `M*` such as `Mn`, `Mc`, `Me`) have `isalnum() == False`. In Indic scripts (Devanagari and Gujarati), all vowel matras (such as `ि` in `शिखर`), viramas, chandrabindu, and anusvara are combining marks. Consequently, `[^\w...]` stripped every matra and replaced it with a space (e.g. `शिखर` became `श खर`), causing pattern matching against `_PHRASES` to fail and return `None`.
- **Fix Applied**:
  1. Replaced the `[^\w...]` regex with Unicode-aware normalization `normalize_semantic_text` in `backend/app/semantic.py`:
     - **Unicode NFKC normalization**: `unicodedata.normalize("NFKC", text)` converts compatibility and composed/decomposed equivalents.
     - **Case folding**: `.lower()` across scripts.
     - **Chandrabindu variants**: Normalizes chandrabindu (`ँ` U+0901, `ઁ` U+0A81) to anusvara (`ं` U+0902, `ં` U+0A82), allowing interchangeable matching of `ऊँचा`/`ऊंचा` and `कहाँ`/`कहां`.
     - **Nukta variants**: Decomposes text to NFD, strips nukta marks (`\u093c` and `\u0abc`), and recomposes with NFC. This unifies characters with or without nuktas (e.g., `बड़ा` and `बडा`, `बड़ी` and `बडी`).
     - **Punctuation and symbol replacement**: Replaces punctuation (Devanagari danda `।` U+0964, double danda `॥` U+0965, question marks `?`, `？`, `؟`, periods, commas, quotes, hyphens) and symbols (except `°` for 90°) with spaces, while strictly preserving all letters (`L*`), combining marks (`M*`), numbers (`N*`), and whitespace.
     - **Extra spaces**: Collapses all consecutive whitespace into single spaces and surrounds the text with spaces for exact word boundary matching.
  2. Pre-normalized all phrase definitions in `_NORMALIZED_PHRASES`, deduplicated and sorted by length descending so that longer phrases are prioritized over substrings.
  3. Added Hindi `बिन्दु` variants (`सबसे ऊँचा बिन्दु`, `मूल बिन्दु`, etc.) alongside `बिंदु`.
  4. Expanded tests in `backend/tests/test_semantic.py`:
     - Added `test_match_semantic_feature_punctuation_and_unicode_variants` testing Devanagari danda (`।`, `॥`), question mark variants (`?`, `？`, `؟`), chandrabindu/anusvara variants (`कहाँ`/`कहां`, `ऊँचा`/`ऊंचा`, `बिंदु`/`बिन्दु`), nukta variants (`बड़ा`/`बडा`, `बड़ी`/`बडी`), extra whitespace collapsing, and Unicode NFC/NFD/NFKC forms.
     - Added variant assertions to `test_hindi_and_gujarati_answers`.

## Files Touched
- `backend/app/semantic.py` (updated normalization and phrases)
- `backend/app/ask.py`
- `backend/tests/test_ask_target.py` (updated non-semantic question for valid point test)
- `backend/tests/test_semantic.py` (added punctuation, nukta, chandrabindu, and Unicode variant tests)
- `backend/tests/test_semantic_props.py`
- `docs/reports/agy-g5-semantic-ask-report.md` (updated)
- `docs/BUILD_LOG.md` (updated)
