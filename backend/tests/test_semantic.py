"""Unit tests for semantic targets and Ask endpoint integration (Lane g5).

Tests:
1. Feature identification and phrase matching across English, Hindi, and Gujarati.
2. Coarse position descriptions.
3. Targets on bundled sample fixtures (sine peak/trough, barchart tallest/shortest, triangle right angle/longest side).
4. Custom triangle fixture with right angle at B and longest side AC.
5. Plain explanation and None target when a feature does not exist or apply.
6. Verification that NO model call is made for semantic questions (provider.call_count == 0).
7. Verification that non-semantic questions behave exactly as before.
"""

from __future__ import annotations

import unicodedata

import pytest
from fastapi.testclient import TestClient

from app.ask import (
    ElementTarget,
    PointTarget,
    semantic_ask,
    semantic_target,
    semantic_to_ask_target,
    validate_ask_target,
)
from app.main import app, get_provider_chain
from app.schema import DiagramScene, Point, Segment
from app.semantic import (
    FEATURE_LONGEST_SIDE,
    FEATURE_ORIGIN,
    FEATURE_PEAK,
    FEATURE_RIGHT_ANGLE,
    FEATURE_SHORTEST_BAR,
    FEATURE_TALLEST_BAR,
    FEATURE_TROUGH,
    SemanticResult,
    coarse_position,
    match_semantic_feature,
)
from app.semantic import (
    semantic_ask as pure_semantic_ask,
)
from app.semantic import (
    semantic_target as pure_semantic_target,
)
from app.vision.chain import ProviderChain
from fixtures.barchart import barchart_scene
from fixtures.sine import sine_scene
from fixtures.triangle import triangle_scene


class FakeAskProvider:
    """Fake vision/text provider for asserting zero model calls on semantic queries."""

    def __init__(self, name: str = "fake", response: str = "ok") -> None:
        self.name = name
        self.response = response
        self.call_count = 0
        self.prompts_received: list[str] = []

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        raise NotImplementedError("extract not used in text-only ask tests")

    async def complete(self, prompt: str, *, timeout: float) -> str:
        self.call_count += 1
        self.prompts_received.append(prompt)
        return self.response


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# 1. Feature phrase matching
# ---------------------------------------------------------------------------


def test_match_semantic_feature_english() -> None:
    assert match_semantic_feature("Where is the peak?") == FEATURE_PEAK
    assert match_semantic_feature("Show the highest point of the curve") == FEATURE_PEAK
    assert match_semantic_feature("Find the maximum") == FEATURE_PEAK
    assert match_semantic_feature("What is at the top of the curve?") == FEATURE_PEAK

    assert match_semantic_feature("Where is the trough?") == FEATURE_TROUGH
    assert match_semantic_feature("Find the lowest point") == FEATURE_TROUGH
    assert match_semantic_feature("Locate the minimum") == FEATURE_TROUGH
    assert match_semantic_feature("What is at the bottom of the curve?") == FEATURE_TROUGH

    assert match_semantic_feature("Where is the origin?") == FEATURE_ORIGIN
    assert match_semantic_feature("Where do the axes cross?") == FEATURE_ORIGIN
    assert match_semantic_feature("Show where the axes meet") == FEATURE_ORIGIN

    assert match_semantic_feature("Which is the tallest bar?") == FEATURE_TALLEST_BAR
    assert match_semantic_feature("Where is the highest bar?") == FEATURE_TALLEST_BAR
    assert match_semantic_feature("Find the biggest bar") == FEATURE_TALLEST_BAR

    assert match_semantic_feature("Which is the shortest bar?") == FEATURE_SHORTEST_BAR
    assert match_semantic_feature("Where is the smallest bar?") == FEATURE_SHORTEST_BAR
    assert match_semantic_feature("Find the lowest bar") == FEATURE_SHORTEST_BAR

    assert match_semantic_feature("Where is the right angle?") == FEATURE_RIGHT_ANGLE
    assert match_semantic_feature("Find the 90 degree angle") == FEATURE_RIGHT_ANGLE
    assert match_semantic_feature("Is there a 90° angle?") == FEATURE_RIGHT_ANGLE

    assert match_semantic_feature("Which is the longest side?") == FEATURE_LONGEST_SIDE
    assert match_semantic_feature("Find the longest segment") == FEATURE_LONGEST_SIDE


def test_match_semantic_feature_hindi_and_gujarati() -> None:
    # Hindi baseline
    assert match_semantic_feature("शिखर कहाँ है?") == FEATURE_PEAK
    assert match_semantic_feature("सबसे ऊँचा बिंदु कौन सा है?") == FEATURE_PEAK
    assert match_semantic_feature("सबसे निचला बिंदु कहाँ है?") == FEATURE_TROUGH
    assert match_semantic_feature("मूल बिंदु कहाँ है?") == FEATURE_ORIGIN
    assert match_semantic_feature("सबसे ऊँचा बार कौन सा है?") == FEATURE_TALLEST_BAR
    assert match_semantic_feature("सबसे छोटा बार कहाँ है?") == FEATURE_SHORTEST_BAR
    assert match_semantic_feature("समकोण कहाँ है?") == FEATURE_RIGHT_ANGLE
    assert match_semantic_feature("सबसे लंबी भुजा कौन सी है?") == FEATURE_LONGEST_SIDE

    # Gujarati baseline
    assert match_semantic_feature("શિખર ક્યાં છે?") == FEATURE_PEAK
    assert match_semantic_feature("સૌથી ઊંચો બિંદુ કયો છે?") == FEATURE_PEAK
    assert match_semantic_feature("સૌથી નીચો બિંદુ ક્યાં છે?") == FEATURE_TROUGH
    assert match_semantic_feature("ઉદ્ભવ બિંદુ ક્યાં છે?") == FEATURE_ORIGIN
    assert match_semantic_feature("સૌથી ઊંચો બાર કયો છે?") == FEATURE_TALLEST_BAR
    assert match_semantic_feature("સૌથી નાનો બાર ક્યાં છે?") == FEATURE_SHORTEST_BAR
    assert match_semantic_feature("કાટખૂણો ક્યાં છે?") == FEATURE_RIGHT_ANGLE
    assert match_semantic_feature("સૌથી લાંબી બાજુ કઈ છે?") == FEATURE_LONGEST_SIDE


def test_match_semantic_feature_punctuation_and_unicode_variants() -> None:
    """Verify punctuation (danda, question marks), nuktas, chandrabindu, and Unicode NFC/NFKC."""
    # 1. Devanagari danda (।) and double danda (॥)
    assert match_semantic_feature("शिखर कहाँ है।") == FEATURE_PEAK
    assert match_semantic_feature("शिखर।") == FEATURE_PEAK
    assert match_semantic_feature("शिखर॥") == FEATURE_PEAK
    assert match_semantic_feature("मूल बिंदु।") == FEATURE_ORIGIN
    assert match_semantic_feature("समकोण।") == FEATURE_RIGHT_ANGLE

    # 2. Question mark variants: standard ?, fullwidth ？, arabic ؟
    assert match_semantic_feature("शिखर कहाँ है?") == FEATURE_PEAK
    assert match_semantic_feature("शिखर कहाँ है？") == FEATURE_PEAK
    assert match_semantic_feature("शिखर कहाँ है؟") == FEATURE_PEAK

    # 3. Chandrabindu variants: ँ vs ं (anusvara) and बिन्दु vs बिंदु
    assert match_semantic_feature("शिखर कहाँ है?") == FEATURE_PEAK
    assert match_semantic_feature("शिखर कहां है?") == FEATURE_PEAK
    assert match_semantic_feature("सबसे ऊँचा बिंदु कौन सा है?") == FEATURE_PEAK
    assert match_semantic_feature("सबसे ऊंचा बिंदु कौन सा है?") == FEATURE_PEAK
    assert match_semantic_feature("सबसे ऊँचा बिन्दु कौन सा है?") == FEATURE_PEAK
    assert match_semantic_feature("सबसे ऊंचा बिन्दु कौन सा है?") == FEATURE_PEAK
    assert match_semantic_feature("मूल बिन्दु कहाँ है?") == FEATURE_ORIGIN

    # 4. Nukta variants: with nukta (ड़) vs without nukta (ड)
    assert match_semantic_feature("सबसे बड़ा बार कौन सा है?") == FEATURE_TALLEST_BAR
    assert match_semantic_feature("सबसे बडा बार कौन सा है?") == FEATURE_TALLEST_BAR
    assert match_semantic_feature("सबसे बड़ी भुजा कौन सी है?") == FEATURE_LONGEST_SIDE
    assert match_semantic_feature("सबसे बडी भुजा कौन सी है?") == FEATURE_LONGEST_SIDE

    # 5. Extra spaces and whitespace collapsing
    assert match_semantic_feature("  शिखर    कहाँ   है ?  ") == FEATURE_PEAK
    assert match_semantic_feature("सबसे   ऊँचा   बिंदु   कौन   सा   है ?") == FEATURE_PEAK
    assert match_semantic_feature("\tशिखर\nकहाँ\tहै?\n") == FEATURE_PEAK

    # 6. Unicode NFC / NFD / NFKC forms
    assert match_semantic_feature(unicodedata.normalize("NFD", "शिखर कहाँ है?")) == FEATURE_PEAK
    assert match_semantic_feature(unicodedata.normalize("NFC", "शिखर कहाँ है?")) == FEATURE_PEAK
    assert match_semantic_feature(unicodedata.normalize("NFKC", "शिखर कहाँ है?")) == FEATURE_PEAK

    # 7. Gujarati variants (periods, extra spaces, NFC/NFD)
    assert match_semantic_feature("શિખર ક્યાં છે.") == FEATURE_PEAK
    assert match_semantic_feature("  શિખર    ક્યાં   છે ?  ") == FEATURE_PEAK
    assert match_semantic_feature(unicodedata.normalize("NFD", "શિખર ક્યાં છે?")) == FEATURE_PEAK
    assert match_semantic_feature(unicodedata.normalize("NFC", "શિખર ક્યાં છે?")) == FEATURE_PEAK
    assert match_semantic_feature(unicodedata.normalize("NFKC", "શિખર ક્યાં છે?")) == FEATURE_PEAK
    assert match_semantic_feature("સૌથી ઊંચું બિંદુ કયો છે?") == FEATURE_PEAK
    assert match_semantic_feature("સૌથી નીચું બિંદુ ક્યાં છે?") == FEATURE_TROUGH


def test_non_semantic_questions_not_matched() -> None:
    assert match_semantic_feature("What is the length of AB?") is None
    assert match_semantic_feature("What colour is the triangle?") is None
    assert match_semantic_feature("What is angle C?") is None
    assert match_semantic_feature("Tell me about bar Q1") is None
    assert match_semantic_feature("Is point B on the right?") is None
    assert match_semantic_feature("Who created this diagram?") is None


# ---------------------------------------------------------------------------
# 2. Coarse position
# ---------------------------------------------------------------------------


def test_coarse_position_descriptions() -> None:
    # (x, y) coordinates: y=0 top, x=0 left
    assert coarse_position(0.1, 0.1, "en") == "top left"
    assert coarse_position(0.5, 0.1, "en") == "top centre"
    assert coarse_position(0.9, 0.1, "en") == "top right"
    assert coarse_position(0.1, 0.5, "en") == "middle left"
    assert coarse_position(0.5, 0.5, "en") == "centre"
    assert coarse_position(0.9, 0.5, "en") == "middle right"
    assert coarse_position(0.1, 0.9, "en") == "bottom left"
    assert coarse_position(0.5, 0.9, "en") == "bottom centre"
    assert coarse_position(0.9, 0.9, "en") == "bottom right"

    # Hindi
    assert "ऊपर" in coarse_position(0.1, 0.1, "hi")
    assert "नीचे" in coarse_position(0.1, 0.9, "hi")

    # Gujarati
    assert "ઉપર" in coarse_position(0.1, 0.1, "gu")
    assert "નીચે" in coarse_position(0.1, 0.9, "gu")


# ---------------------------------------------------------------------------
# 3. Bundled fixtures: Sine curve (peak, trough, origin)
# ---------------------------------------------------------------------------


def test_sine_curve_peak_trough_origin() -> None:
    scene = sine_scene()

    # Peak
    t_peak = semantic_target(scene, "Where is the peak?", "en")
    assert isinstance(t_peak, PointTarget)
    # In sine_scene: amplitude 0.30 around x_axis_y 0.50 => min y = 0.20
    assert abs(t_peak.y - 0.20) < 0.02
    assert validate_ask_target(t_peak, scene) is not None

    # Trough
    t_trough = semantic_target(scene, "Where is the lowest point?", "en")
    assert isinstance(t_trough, PointTarget)
    # max y = 0.80
    assert abs(t_trough.y - 0.80) < 0.02
    assert validate_ask_target(t_trough, scene) is not None

    # Origin
    t_origin = semantic_target(scene, "Where is the origin?", "en")
    assert isinstance(t_origin, PointTarget)
    assert t_origin.x == 0.08
    assert t_origin.y == 0.50
    assert validate_ask_target(t_origin, scene) is not None

    # Spoken answers
    ans_peak, _ = semantic_ask(scene, "Where is the peak?", "en")
    assert "peak" in ans_peak.lower()
    assert "top" in ans_peak.lower()

    ans_trough, _ = semantic_ask(scene, "Where is the lowest point?", "en")
    assert "lowest point" in ans_trough.lower()
    assert "bottom" in ans_trough.lower()


# ---------------------------------------------------------------------------
# 4. Bundled fixtures: Bar chart (tallest, shortest)
# ---------------------------------------------------------------------------


def test_barchart_tallest_and_shortest() -> None:
    scene = barchart_scene()

    # Tallest bar: Q4 (value = 32)
    t_tall = semantic_target(scene, "Which is the tallest bar?", "en")
    assert isinstance(t_tall, ElementTarget)
    assert t_tall.elementId == "q4"
    assert validate_ask_target(t_tall, scene) is not None

    # Shortest bar: Q1 (value = 10)
    t_short = semantic_target(scene, "Which is the shortest bar?", "en")
    assert isinstance(t_short, ElementTarget)
    assert t_short.elementId == "q1"
    assert validate_ask_target(t_short, scene) is not None

    # Spoken answer describes label and position
    ans_tall, _ = semantic_ask(scene, "Which is the tallest bar?", "en")
    assert "Q4" in ans_tall
    assert "right" in ans_tall.lower()

    ans_short, _ = semantic_ask(scene, "Which is the shortest bar?", "en")
    assert "Q1" in ans_short
    assert "left" in ans_short.lower()


# ---------------------------------------------------------------------------
# 5. Bundled fixtures: Right triangle (angle at C, longest side AB)
# ---------------------------------------------------------------------------


def test_triangle_scene_bundled() -> None:
    scene = triangle_scene()

    # Right angle: in triangle_scene, angle at C is 90 degrees
    t_angle = semantic_target(scene, "Where is the right angle?", "en")
    assert isinstance(t_angle, ElementTarget)
    assert t_angle.elementId == "C"
    assert validate_ask_target(t_angle, scene) is not None

    # Longest side: hypotenuse AB has length 0.75
    t_side = semantic_target(scene, "Which is the longest side?", "en")
    assert isinstance(t_side, ElementTarget)
    assert t_side.elementId == "AB"
    assert validate_ask_target(t_side, scene) is not None


# ---------------------------------------------------------------------------
# 6. Triangle variant with right angle at B and longest side AC
# ---------------------------------------------------------------------------


def test_triangle_variant_right_angle_at_b_longest_side_ac() -> None:
    """Explicitly verify brief mention: triangle with right angle at B, longest side AC."""
    # B at (0.2, 0.8), A at (0.2, 0.2), C at (0.8, 0.8)
    # BA is vertical (length 0.6), BC is horizontal (length 0.6)
    # Angle at B is exactly 90 degrees.
    # AC is hypotenuse with length sqrt(0.36 + 0.36) ≈ 0.8485 > 0.6
    scene = DiagramScene(
        kind="geometry",
        title="Triangle with right angle at B",
        points=[
            Point(id="A", x=0.20, y=0.20, label="A"),
            Point(id="B", x=0.20, y=0.80, label="B"),
            Point(id="C", x=0.80, y=0.80, label="C"),
        ],
        segments=[
            Segment(id="BA", a="B", b="A", label="BA"),
            Segment(id="BC", a="B", b="C", label="BC"),
            Segment(id="AC", a="A", b="C", label="AC"),
        ],
    )

    t_angle = semantic_target(scene, "Where is the right angle?", "en")
    assert isinstance(t_angle, ElementTarget)
    assert t_angle.elementId == "B"
    assert validate_ask_target(t_angle, scene) is not None

    t_side = semantic_target(scene, "Which is the longest side?", "en")
    assert isinstance(t_side, ElementTarget)
    assert t_side.elementId == "AC"
    assert validate_ask_target(t_side, scene) is not None


# ---------------------------------------------------------------------------
# 7. Absence handling: Name does not apply or nothing matches
# ---------------------------------------------------------------------------


def test_missing_feature_returns_plain_explanation_and_none_target() -> None:
    triangle = triangle_scene()

    # Asking for peak in a triangle scene with no polylines
    res_peak = semantic_ask(triangle, "Where is the peak?", "en")
    assert res_peak is not None
    ans, target = res_peak
    assert target is None
    assert ans == "There is no peak in this diagram."

    # Asking for bars in a sine curve
    sine = sine_scene()
    res_bar = semantic_ask(sine, "Where is the tallest bar?", "en")
    assert res_bar is not None
    ans_bar, target_bar = res_bar
    assert target_bar is None
    assert ans_bar == "There are no bars in this diagram."

    # Asking for right angle in a sine curve
    res_ra = semantic_ask(sine, "Find the right angle", "en")
    assert res_ra is not None
    ans_ra, target_ra = res_ra
    assert target_ra is None
    assert ans_ra == "There is no right angle in this diagram."

    # Asking for origin on a scene without axes
    no_axes_scene = DiagramScene(
        kind="geometry",
        points=[Point(id="p1", x=0.1, y=0.1)],
    )
    res_origin = semantic_ask(no_axes_scene, "Where is the origin?", "en")
    assert res_origin is not None
    ans_orig, target_orig = res_origin
    assert target_orig is None
    assert ans_orig == "There is no origin in this diagram."


# ---------------------------------------------------------------------------
# 8. Hindi and Gujarati answers
# ---------------------------------------------------------------------------


def test_hindi_and_gujarati_answers() -> None:
    sine = sine_scene()
    triangle = triangle_scene()

    # Hindi peak on sine
    ans_hi_peak, target_hi_peak = semantic_ask(sine, "शिखर कहाँ है?", "hi")
    assert isinstance(target_hi_peak, PointTarget)
    assert "शिखर" in ans_hi_peak
    assert "ऊपर" in ans_hi_peak

    # Hindi with danda, extra spaces, and chandrabindu variant
    ans_hi_danda, target_hi_danda = semantic_ask(sine, "  शिखर    कहां   है ।  ", "hi")
    assert isinstance(target_hi_danda, PointTarget)
    assert "शिखर" in ans_hi_danda

    # Hindi missing peak on triangle
    ans_hi_missing, target_hi_missing = semantic_ask(triangle, "शिखर कहाँ है?", "hi")
    assert target_hi_missing is None
    assert ans_hi_missing == "इस आरेख में कोई शिखर नहीं है।"

    # Gujarati peak on sine
    ans_gu_peak, target_gu_peak = semantic_ask(sine, "શિખર ક્યાં છે?", "gu")
    assert isinstance(target_gu_peak, PointTarget)
    assert "શિખર" in ans_gu_peak
    assert "ઉપર" in ans_gu_peak

    # Gujarati with NFD normalization
    ans_gu_nfd, target_gu_nfd = semantic_ask(
        sine, unicodedata.normalize("NFD", "શિખર ક્યાં છે?"), "gu"
    )
    assert isinstance(target_gu_nfd, PointTarget)
    assert "શિખર" in ans_gu_nfd

    # Gujarati missing peak on triangle
    ans_gu_missing, target_gu_missing = semantic_ask(triangle, "શિખર ક્યાં છે?", "gu")
    assert target_gu_missing is None
    assert ans_gu_missing == "આ આકૃતિમાં કોઈ શિખર નથી."


# ---------------------------------------------------------------------------
# 9. Endpoint integration: No model call is made for semantic queries
# ---------------------------------------------------------------------------


def test_endpoint_no_model_call_for_semantic_questions(client: TestClient) -> None:
    sine = sine_scene()
    fake = FakeAskProvider("gemini", response="AI should never be called")
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": sine.model_dump(),
                "question": "Where is the peak?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "facts"
        assert data["target"] is not None
        assert "x" in data["target"] and "y" in data["target"]
        assert "peak" in data["answer"].lower()
        # Assert the fake provider was NEVER invoked
        assert fake.call_count == 0
    finally:
        app.dependency_overrides.clear()


def test_endpoint_no_model_call_when_feature_absent(client: TestClient) -> None:
    triangle = triangle_scene()
    fake = FakeAskProvider("gemini", response="AI should never be called")
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "Where is the peak?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "facts"
        assert data["target"] is None
        assert data["answer"] == "There is no peak in this diagram."
        # Fake provider was NEVER invoked
        assert fake.call_count == 0
    finally:
        app.dependency_overrides.clear()


def test_endpoint_non_semantic_questions_unchanged(client: TestClient) -> None:
    triangle = triangle_scene()
    fake = FakeAskProvider("gemini", response="This is a right-angled triangle.")
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "What kind of triangle is this?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "ai"
        assert "right-angled" in data["answer"]
        # Model WAS invoked for non-semantic question
        assert fake.call_count == 1
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 10. Pure semantic resolution decoupled from app.ask
# ---------------------------------------------------------------------------


def test_pure_semantic_target_returns_plain_dataclass() -> None:
    scene = sine_scene()
    res = pure_semantic_target(scene, "Where is the peak?", "en")
    assert isinstance(res, SemanticResult)
    assert res.name == FEATURE_PEAK
    assert res.target_kind == "point"
    assert res.y is not None and abs(res.y - 0.20) < 0.02
    assert res.element_id is None

    # Conversion to AskTarget
    converted = semantic_to_ask_target(res)
    assert isinstance(converted, PointTarget)
    assert abs(converted.y - 0.20) < 0.02

    # Direct validation of SemanticResult
    validated = validate_ask_target(res, scene)
    assert isinstance(validated, PointTarget)


def test_pure_semantic_ask_returns_plain_values() -> None:
    scene = triangle_scene()
    res = pure_semantic_ask(scene, "Where is the right angle?", "en")
    assert res is not None
    ans, sem_target = res
    assert isinstance(sem_target, SemanticResult)
    assert sem_target.target_kind == "element"
    assert sem_target.element_id == "C"
    assert sem_target.elementId == "C"

    # Conversion to AskTarget
    converted = semantic_to_ask_target(sem_target)
    assert isinstance(converted, ElementTarget)
    assert converted.elementId == "C"


def test_semantic_module_has_no_app_ask_import() -> None:
    import app.semantic

    # Module must not import any classes from app.ask
    assert not hasattr(app.semantic, "AskTarget")
    assert not hasattr(app.semantic, "ElementTarget")
    assert not hasattr(app.semantic, "PointTarget")
