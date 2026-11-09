"""Regression tests for lane k8-i18n (B3-04 Gujarati grammatical gender agreement).

Verifies:
- B3-04: Gujarati semantic response for lowest point (trough) uses neuter adjective
  ("સૌથી નીચું બિંદુ") rather than masculine ("સૌથી નીચો બિંદુ").
- Absence message in Gujarati uses neuter agreement ("આ આકૃતિમાં કોઈ નીચું બિંદુ નથી.").
- Colloquial question variant with masculine ("સૌથી નીચો બિંદુ") matches FEATURE_TROUGH
  and still returns the grammatically correct neuter answer.
- Lowest vertex element fallback in Gujarati uses neuter agreement.
- Hindi counterpart phrases remain correct and consistent.
"""

from __future__ import annotations

from app.schema import DiagramScene, Point, Segment
from app.semantic import (
    FEATURE_TROUGH,
    match_semantic_feature,
)
from app.semantic import (
    semantic_ask as pure_semantic_ask,
)
from app.semantic import (
    semantic_target as pure_semantic_target,
)
from fixtures.sine import sine_scene


def test_b3_04_gujarati_trough_phrase_matching() -> None:
    """Both neuter and masculine query variants in Gujarati resolve to FEATURE_TROUGH."""
    assert match_semantic_feature("સૌથી નીચું બિંદુ ક્યાં છે?") == FEATURE_TROUGH
    assert match_semantic_feature("સૌથી નીચો બિંદુ ક્યાં છે?") == FEATURE_TROUGH
    assert match_semantic_feature("વક્રનું સૌથી નીચું બિંદુ ક્યાં છે?") == FEATURE_TROUGH
    assert match_semantic_feature("ન્યૂનતમ બિંદુ ક્યાં છે?") == FEATURE_TROUGH


def test_b3_04_gujarati_trough_answer_neuter_gender() -> None:
    """Spoken answer for lowest point on a curve must use neuter 'સૌથી નીચું બિંદુ'."""
    scene = sine_scene()
    ans, target = pure_semantic_ask(scene, "સૌથી નીચું બિંદુ ક્યાં છે?", "gu")
    assert ans is not None
    assert target is not None
    assert "સૌથી નીચું બિંદુ" in ans
    assert "નીચો" not in ans
    assert "છે." in ans


def test_b3_04_gujarati_trough_colloquial_input_returns_neuter_answer() -> None:
    """Asking with masculine 'સૌથી નીચો' still returns the grammatically correct neuter output."""
    scene = sine_scene()
    ans, target = pure_semantic_ask(scene, "સૌથી નીચો બિંદુ ક્યાં છે?", "gu")
    assert ans is not None
    assert target is not None
    assert "સૌથી નીચું બિંદુ" in ans
    assert "નીચો" not in ans


def test_b3_04_gujarati_trough_absence_message_neuter_gender() -> None:
    """Absence message in Gujarati must use neuter 'કોઈ નીચું બિંદુ નથી'."""
    # Scene with no polylines, bars, or points where a trough cannot be found
    empty_scene = DiagramScene(kind="geometry", title="Empty scene")
    assert pure_semantic_target(empty_scene, "સૌથી નીચું બિંદુ ક્યાં છે?", "gu") is None

    ans, target = pure_semantic_ask(empty_scene, "સૌથી નીચું બિંદુ ક્યાં છે?", "gu")
    assert target is None
    assert ans == "આ આકૃતિમાં કોઈ નીચું બિંદુ નથી."
    assert "નીચો" not in ans


def test_b3_04_gujarati_trough_vertex_fallback_neuter_gender() -> None:
    """Geometry lowest vertex fallback in Gujarati must use neuter 'સૌથી નીચું બિંદુ'."""
    scene = DiagramScene(
        kind="geometry",
        title="Triangle with lowest vertex",
        points=[
            Point(id="A", x=0.2, y=0.2, label="A"),
            Point(id="B", x=0.8, y=0.8, label="B"),
            Point(id="C", x=0.2, y=0.5, label="C"),
        ],
        segments=[
            Segment(id="AB", a="A", b="B"),
            Segment(id="BC", a="B", b="C"),
            Segment(id="CA", a="C", b="A"),
        ],
    )
    ans, target = pure_semantic_ask(scene, "સૌથી નીચું બિંદુ ક્યાં છે?", "gu")
    assert target is not None
    assert target.element_id == "B"
    assert "સૌથી નીચું બિંદુ B" in ans
    assert "નીચો" not in ans


def test_b3_04_hindi_trough_baseline_preserved() -> None:
    """Verify Hindi lowest point and absence answers remain natural and correct."""
    scene = sine_scene()
    ans, target = pure_semantic_ask(scene, "सबसे निचला बिंदु कहाँ है?", "hi")
    assert target is not None
    assert "सबसे निचला बिंदु" in ans

    # Scene with no polylines, bars, or points where a trough cannot be found
    empty_scene = DiagramScene(kind="geometry", title="Empty scene")
    assert pure_semantic_target(empty_scene, "सबसे निचला बिंदु कहाँ है?", "hi") is None

    ans_abs, target_abs = pure_semantic_ask(empty_scene, "सबसे निचला बिंदु कहाँ है?", "hi")
    assert target_abs is None
    assert ans_abs == "इस आरेख में कोई निचला बिंदु नहीं है।"
