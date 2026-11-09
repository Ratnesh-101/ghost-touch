"""Regression tests for lane h2-ask-accuracy.

Verifies fixes for:
- F1: maximum/minimum/peak fallback on bar charts and geometry.
- F3: clamp_answer markdown preservation on fact and semantic answers.
- F4a-c: facts_lookup point-id token dropping, numeric boosting, decimal tokenization,
  and 'don't know' for unrelated single-noun questions.
- F10: tie reporting and value vs height order mismatch reporting for bar charts.
- F11: right angle questions naming point IDs bypass semantic path to facts/LLM.
- F12 part: control character sanitization (Cf, Cc, Zl, Zp) and 300-char clamp.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.ask import DONT_KNOW_PHRASE, clamp_answer, facts_lookup
from app.main import app, get_provider_chain
from app.schema import Bar, DiagramScene, Point, Segment
from app.semantic import (
    semantic_ask as pure_semantic_ask,
)
from app.semantic import (
    semantic_target as pure_semantic_target,
)
from app.vision.chain import ProviderChain
from fixtures.barchart import barchart_scene
from fixtures.triangle import triangle_scene


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# F1: maximum/minimum/peak on bar charts and geometry
# ---------------------------------------------------------------------------


def test_f1_barchart_maximum_value_does_not_say_no_peak(client: TestClient) -> None:
    """F1: 'What is the maximum value?' on a bar chart must not answer 'There is no peak'."""
    scene = barchart_scene()
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": scene.model_dump(),
                "question": "What is the maximum value?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "no peak" not in data["answer"].lower()
        # Should identify the tallest bar Q4
        assert "Q4" in data["answer"]
        assert data["target"] is not None
        assert data["target"]["elementId"] == "q4"
    finally:
        app.dependency_overrides.clear()


def test_f1_barchart_peak_falls_back_to_tallest_bar() -> None:
    """F1: 'Where is the peak?' on a bar chart falls back to the tallest bar."""
    scene = barchart_scene()
    res = pure_semantic_ask(scene, "Where is the peak?", "en")
    assert res is not None
    ans, target = res
    assert target is not None
    assert target.element_id == "q4"
    assert "no peak" not in ans.lower()
    assert "Q4" in ans


def test_f1_barchart_minimum_falls_back_to_shortest_bar() -> None:
    """F1: 'Where is the minimum?' on a bar chart falls back to the shortest bar."""
    scene = barchart_scene()
    res = pure_semantic_ask(scene, "Where is the minimum?", "en")
    assert res is not None
    ans, target = res
    assert target is not None
    assert target.element_id == "q1"
    assert "no lowest point" not in ans.lower()
    assert "Q1" in ans


def test_f1_geometry_maximum_returns_none_so_next_stage_answers() -> None:
    """F1: 'What is the maximum?' on geometry without polylines/bars returns None from semantic."""
    scene = triangle_scene()
    # Semantic check should return None so ask.py proceeds to facts / LLM
    res = pure_semantic_ask(scene, "What is the maximum value?", "en")
    assert res is None


def test_f1_geometry_highest_vertex_falls_back_to_points() -> None:
    """F1: 'Where is the highest vertex?' on geometry falls back to scene.points."""
    scene = triangle_scene()  # A is at y=0.15, B is at y=0.75, C is at y=0.75
    res = pure_semantic_ask(scene, "Where is the highest vertex?", "en")
    assert res is not None
    ans, target = res
    assert target is not None
    assert target.element_id == "A"
    assert "highest point" in ans.lower()
    assert "A" in ans


# ---------------------------------------------------------------------------
# F3: clamp_answer markdown preservation for fact and semantic answers
# ---------------------------------------------------------------------------


def test_f3_clamp_answer_preserves_multiplication_and_symbols_for_facts() -> None:
    """F3: clamp_answer must not strip *, _, # from fact answers (preserve_symbols=True)."""
    fact_text = "Area is 3*4 = 12 cm² and #1 side is AB_1."
    clamped = clamp_answer(fact_text, preserve_symbols=True)
    assert "3*4" in clamped
    assert "#1" in clamped
    assert "AB_1" in clamped

    # Backwards compatibility check with is_model=False
    clamped_compat = clamp_answer(fact_text, is_model=False)
    assert "3*4" in clamped_compat
    assert "#1" in clamped_compat
    assert "AB_1" in clamped_compat


def test_f3_clamp_answer_strips_markdown_by_default_and_for_model_text() -> None:
    """F3: clamp_answer strips *, _, # by default and for model text."""
    model_text = "The **hypotenuse** `AB` is *5 cm* long with #hash."
    clamped_default = clamp_answer(model_text)
    assert "*" not in clamped_default
    assert "`" not in clamped_default
    assert "#" not in clamped_default
    assert "hypotenuse AB is 5 cm long with hash" in clamped_default

    clamped_model = clamp_answer(model_text, is_model=True)
    assert "*" not in clamped_model
    assert "`" not in clamped_model
    assert "#" not in clamped_model
    assert "hypotenuse AB is 5 cm long with hash" in clamped_model


# ---------------------------------------------------------------------------
# F4a-c: facts_lookup tokenization, numeric boost, and don't know
# ---------------------------------------------------------------------------


def test_f4a_point_id_tokens_dropped_numeric_fact_boosted() -> None:
    """F4a/b: 'How long is AB?' selects numeric fact 'AB = 5 cm' over non-numeric fact."""
    scene = DiagramScene(
        kind="geometry",
        points=[
            Point(id="A", x=0.1, y=0.1),
            Point(id="B", x=0.5, y=0.5),
            Point(id="C", x=0.1, y=0.5),
        ],
        segments=[
            Segment(id="s1", a="A", b="B", label="AB"),
            Segment(id="s2", a="B", b="C", label="BC"),
        ],
        facts=[
            "AB is adjacent to BC",
            "AB is a straight segment",
            "AB is rendered in blue",
            "AB = 5 cm",
        ],
    )
    ans = facts_lookup(scene, "How long is AB?")
    assert ans is not None
    assert "5 cm" in ans


def test_f4b_decimal_numbers_tokenized_together() -> None:
    """F4b: Decimal '2.5' is tokenized as '2.5', not '2' and '5'."""
    scene = DiagramScene(
        kind="geometry",
        points=[Point(id="A", x=0.0, y=0.0), Point(id="B", x=1.0, y=1.0)],
        segments=[Segment(id="s1", a="A", b="B", label="AB")],
        facts=["AB = 2.5 cm", "BC = 2 cm"],
    )
    ans = facts_lookup(scene, "Is the length of AB 2.5 cm?")
    assert ans is not None
    assert "2.5 cm" in ans


def test_f4c_unrelated_single_noun_question_returns_dont_know(client: TestClient) -> None:
    """F4c: 'What colour is the triangle?' must return 'I don't know from this diagram.'"""
    scene = triangle_scene()
    # Ensure facts_lookup alone returns None
    assert facts_lookup(scene, "What colour is the triangle?") is None

    # When providers fail/are absent, /ask must return DONT_KNOW_PHRASE with source='unknown'
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])
    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": scene.model_dump(),
                "question": "What colour is the triangle?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "unknown"
        assert data["answer"] == DONT_KNOW_PHRASE
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# F10: Ties and value vs height order mismatch in bar charts
# ---------------------------------------------------------------------------


def test_f10_tie_in_tallest_bar_reported() -> None:
    """F10: Tie in tallest bar value is explicitly reported."""
    scene = DiagramScene(
        kind="bar_chart",
        bars=[
            Bar(id="b1", x0=0.1, x1=0.3, y_top=0.3, y_base=0.8, label="Alpha", value=50),
            Bar(id="b2", x0=0.4, x1=0.6, y_top=0.3, y_base=0.8, label="Beta", value=50),
            Bar(id="b3", x0=0.7, x1=0.9, y_top=0.5, y_base=0.8, label="Gamma", value=20),
        ],
    )
    res_en = pure_semantic_ask(scene, "Which is the tallest bar?", "en")
    assert res_en is not None
    ans_en, target_en = res_en
    assert "tie for the tallest bar between Alpha and Beta" in ans_en
    assert target_en is not None
    assert target_en.element_id == "b1"

    # Hindi tie
    res_hi = pure_semantic_ask(scene, "सबसे ऊँचा बार कौन सा है?", "hi")
    assert res_hi is not None
    ans_hi, _ = res_hi
    assert "बराबरी है" in ans_hi

    # Gujarati tie
    res_gu = pure_semantic_ask(scene, "સૌથી ઊંચો બાર કયો છે?", "gu")
    assert res_gu is not None
    ans_gu, _ = res_gu
    assert "બરાબરી છે" in ans_gu


def test_f10_tie_in_shortest_bar_reported() -> None:
    """F10: Tie in shortest bar value is explicitly reported."""
    scene = DiagramScene(
        kind="bar_chart",
        bars=[
            Bar(id="b1", x0=0.1, x1=0.3, y_top=0.6, y_base=0.8, label="Alpha", value=15),
            Bar(id="b2", x0=0.4, x1=0.6, y_top=0.6, y_base=0.8, label="Beta", value=15),
            Bar(id="b3", x0=0.7, x1=0.9, y_top=0.2, y_base=0.8, label="Gamma", value=60),
        ],
    )
    res = pure_semantic_ask(scene, "Which is the shortest bar?", "en")
    assert res is not None
    ans, _ = res
    assert "tie for the shortest bar between Alpha and Beta" in ans


def test_f10_value_order_versus_height_order_mismatch_reported() -> None:
    """F10: When a bar with highest value is visually shorter, report the mismatch."""
    scene = DiagramScene(
        kind="bar_chart",
        bars=[
            # b1 has higher value (100) but is shorter on screen (height = 0.8 - 0.6 = 0.2)
            Bar(id="b1", x0=0.1, x1=0.4, y_top=0.6, y_base=0.8, label="Apples", value=100),
            # b2 has lower value (50) but is taller on screen (height = 0.8 - 0.2 = 0.6)
            Bar(id="b2", x0=0.6, x1=0.9, y_top=0.2, y_base=0.8, label="Oranges", value=50),
        ],
    )
    res_en = pure_semantic_ask(scene, "Which is the tallest bar?", "en")
    assert res_en is not None
    ans_en, target_en = res_en
    assert "Apples" in ans_en
    assert "Oranges" in ans_en
    assert "tallest bar by value is Apples" in ans_en
    assert "Oranges is tallest in height" in ans_en


def test_f10_subnormal_near_zero_values_not_treated_as_ties() -> None:
    """F10: Bars with values 0.0 and 1e-254 must not tie; 1e-254 > 0.0 strictly."""
    scene = DiagramScene(
        kind="bar_chart",
        bars=[
            Bar(id="b_zero", x0=0.1, x1=0.3, y_top=0.5, y_base=0.8, label="Zero", value=0.0),
            Bar(id="b_tiny", x0=0.4, x1=0.6, y_top=0.3, y_base=0.8, label="Tiny", value=1e-254),
        ],
    )
    # Tallest bar must be b_tiny (1e-254 > 0.0)
    res_tall = pure_semantic_ask(scene, "Which is the tallest bar?", "en")
    assert res_tall is not None
    ans_tall, target_tall = res_tall
    assert target_tall is not None
    assert target_tall.element_id == "b_tiny"
    assert "tie" not in ans_tall.lower()

    target_tall_pure = pure_semantic_target(scene, "Which is the tallest bar?", "en")
    assert target_tall_pure is not None
    assert target_tall_pure.element_id == "b_tiny"

    # Shortest bar must be b_zero (0.0 < 1e-254)
    res_short = pure_semantic_ask(scene, "Which is the shortest bar?", "en")
    assert res_short is not None
    ans_short, target_short = res_short
    assert target_short is not None
    assert target_short.element_id == "b_zero"
    assert "tie" not in ans_short.lower()

    target_short_pure = pure_semantic_target(scene, "Which is the shortest bar?", "en")
    assert target_short_pure is not None
    assert target_short_pure.element_id == "b_zero"

    # Reversed document order: b_tiny first, b_zero second
    scene_rev = DiagramScene(
        kind="bar_chart",
        bars=[
            Bar(id="b_tiny", x0=0.1, x1=0.3, y_top=0.3, y_base=0.8, label="Tiny", value=1e-254),
            Bar(id="b_zero", x0=0.4, x1=0.6, y_top=0.5, y_base=0.8, label="Zero", value=0.0),
        ],
    )
    target_tall_rev = pure_semantic_target(scene_rev, "Which is the tallest bar?", "en")
    assert target_tall_rev is not None
    assert target_tall_rev.element_id == "b_tiny"

    target_short_rev = pure_semantic_target(scene_rev, "Which is the shortest bar?", "en")
    assert target_short_rev is not None
    assert target_short_rev.element_id == "b_zero"

    # Falsifying case from Hypothesis: -1.098e-254 < 0.0
    scene_neg = DiagramScene(
        kind="bar_chart",
        bars=[
            Bar(id="b_zero", x0=0.1, x1=0.3, y_top=0.5, y_base=0.8, label="Zero", value=0.0),
            Bar(
                id="b_neg",
                x0=0.4,
                x1=0.6,
                y_top=0.6,
                y_base=0.8,
                label="Neg",
                value=-1.098164511039338e-254,
            ),
        ],
    )
    target_tall_neg = pure_semantic_target(scene_neg, "Which is the tallest bar?", "en")
    assert target_tall_neg is not None
    assert target_tall_neg.element_id == "b_zero"

    target_short_neg = pure_semantic_target(scene_neg, "Which is the shortest bar?", "en")
    assert target_short_neg is not None
    assert target_short_neg.element_id == "b_neg"


# ---------------------------------------------------------------------------
# F11: Right angle questions naming point IDs bypass semantic path
# ---------------------------------------------------------------------------


def test_f11_question_naming_point_id_does_not_return_first_right_angle() -> None:
    """F11: 'Is angle A 90 degrees?' must not return vertex C from semantic resolver."""
    scene = triangle_scene()  # Right angle is at C; A is acute (36.87 deg)
    res = pure_semantic_ask(scene, "Is angle A 90 degrees?", "en")
    assert res is None  # Bypassed to facts / LLM

    target = pure_semantic_target(scene, "Is angle A 90 degrees?", "en")
    assert target is None


def test_f11_perpendicular_with_point_ids_bypasses_semantic() -> None:
    """F11: 'Is AB perpendicular to BC?' bypasses semantic path."""
    scene = triangle_scene()
    res = pure_semantic_ask(scene, "Is AB perpendicular to BC?", "en")
    assert res is None


def test_f11_right_angle_without_point_id_still_resolves() -> None:
    """F11: General query 'Where is the right angle?' still resolves to vertex C."""
    scene = triangle_scene()
    res = pure_semantic_ask(scene, "Where is the right angle?", "en")
    assert res is not None
    ans, target = res
    assert target is not None
    assert target.element_id == "C"
    assert "point C" in ans


# ---------------------------------------------------------------------------
# F12 part: Control characters cleaned and 300-char clamp on semantic answers
# ---------------------------------------------------------------------------


def test_f12_semantic_and_clamp_strip_control_characters() -> None:
    """F12 part: Cf, Cc, Zl, Zp control characters are stripped from spoken answers."""
    # U+202E (RIGHT-TO-LEFT OVERRIDE), U+200B (ZERO WIDTH SPACE), U+FEFF (BOM), U+2028 (LINE SEP)
    dirty_text = "The \u202epeak\u200b is at \ufeffthe top \u2028centre."
    clean = clamp_answer(dirty_text, preserve_symbols=True)
    assert "\u202e" not in clean
    assert "\u200b" not in clean
    assert "\ufeff" not in clean
    assert "\u2028" not in clean
    assert "peak" in clean

    clean_default = clamp_answer(dirty_text)
    assert "\u202e" not in clean_default
    assert "\u200b" not in clean_default
    assert "\ufeff" not in clean_default
    assert "\u2028" not in clean_default
    assert "peak" in clean_default


def test_f12_semantic_answer_clamped_to_max_chars(client: TestClient) -> None:
    """F12 part: Semantic answers returned by /ask endpoint are clamped to <= 300 chars."""
    scene = barchart_scene()
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": scene.model_dump(),
                "question": "Which is the tallest bar?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["answer"]) <= 300
    finally:
        app.dependency_overrides.clear()
