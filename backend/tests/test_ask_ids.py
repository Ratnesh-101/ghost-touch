"""Tests for point identifiers (including P1..P99) in app.ask facts_lookup.

Covers:
- Recognition of P-prefixed numeric point IDs ('P1'..'P999') in _is_point_id.
- Preservation of existing behavior for letter IDs, units, and NON_ID_UPPERCASE tokens.
- Resolution of known point IDs (e.g. 'P1') in facts_lookup.
- Unknown point ID rejection (e.g. 'P99') returning None from facts_lookup.
- Fact matching behavior for point questions vs segment-style facts ('P1P2 = 3 cm').
- Regression verification for letter segment queries ('AB = 3 cm', 'BA').
- Hypothesis property: questions naming an ID not in the scene never receive an answer.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from hypothesis import given, settings
from hypothesis import strategies as st

from app.ask import _is_point_id, facts_lookup
from app.main import app, get_provider_chain
from app.schema import DiagramScene, Point, Segment
from app.vision.chain import ProviderChain

ALL_LETTER_IDS: list[str] = [chr(c) for c in range(ord("A"), ord("Z") + 1)]
ALL_P_IDS: list[str] = [f"P{i}" for i in range(1, 100)]
ALL_POINT_IDS: list[str] = ALL_LETTER_IDS + ALL_P_IDS
# 'A' and 'I' are in NON_ID_UPPERCASE (English article/pronoun), so they are excluded
# from candidate unknown point IDs that must trigger unknown-id rejection in questions.
CANDIDATE_UNKNOWN_IDS: list[str] = [pid for pid in ALL_POINT_IDS if pid not in ("A", "I")]


# ---------------------------------------------------------------------------
# 1. Unit tests for _is_point_id
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("pid", ["P1", "P2", "P9", "P10", "P99", "P100", "P999"])
def test_is_point_id_accepts_p_numeric_ids(pid: str) -> None:
    """_is_point_id accepts 'P' followed by 1 to 3 digits."""
    assert _is_point_id(pid) is True


@pytest.mark.parametrize("lid", ["B", "C", "D", "Z", "AB", "BC", "ABC"])
def test_is_point_id_accepts_uppercase_letter_ids(lid: str) -> None:
    """_is_point_id continues to accept 1-3 uppercase letters."""
    assert _is_point_id(lid) is True


def test_is_point_id_accepts_single_letter_p() -> None:
    """Single uppercase letter 'P' is a standard 1-letter point identifier."""
    assert _is_point_id("P") is True


@pytest.mark.parametrize(
    "invalid",
    [
        "p1",  # lowercase
        "p99",  # lowercase
        "P1000",  # 4 digits (exceeds 3 digits)
        "P12345",  # more than 3 digits
        "A",  # NON_ID_UPPERCASE
        "I",  # NON_ID_UPPERCASE
        "cm",  # UNIT_TOKENS
        "mm",  # UNIT_TOKENS
        "deg",  # UNIT_TOKENS
        "ABCD",  # 4 letters
        "P-1",  # punctuation
        "1P",  # reversed
    ],
)
def test_is_point_id_rejects_non_ids(invalid: str) -> None:
    """_is_point_id rejects lowercase, non-id words, units, and over-length strings."""
    assert _is_point_id(invalid) is False


# ---------------------------------------------------------------------------
# 2. Known P1 in scene resolves normally
# ---------------------------------------------------------------------------


def test_facts_lookup_known_point_p1_resolves() -> None:
    """A scene with points A, B, C, P1: a question about 'P1' resolves normally."""
    scene = DiagramScene(
        kind="geometry",
        title="Scene with P1",
        points=[
            Point(id="A", x=0.0, y=0.0, label="A"),
            Point(id="B", x=1.0, y=0.0, label="B"),
            Point(id="C", x=0.0, y=1.0, label="C"),
            Point(id="P1", x=0.5, y=0.5, label="P1"),
        ],
        segments=[
            Segment(id="AB", a="A", b="B", label="AB"),
        ],
        facts=[
            "P1 = 5 cm",
            "AB = 3 cm",
        ],
    )

    ans_length = facts_lookup(scene, "What is the length of P1?")
    assert ans_length is not None
    assert "5 cm" in ans_length

    ans_how_long = facts_lookup(scene, "How long is P1?")
    assert ans_how_long is not None
    assert "5 cm" in ans_how_long

    ans_direct = facts_lookup(scene, "P1")
    assert ans_direct is not None
    assert "5 cm" in ans_direct


# ---------------------------------------------------------------------------
# 3. Unknown point P99 returns None from facts_lookup
# ---------------------------------------------------------------------------


def test_facts_lookup_unknown_point_p99_returns_none() -> None:
    """A scene with points A, B, C, P1: 'length of P99' returns None (unknown point)."""
    scene = DiagramScene(
        kind="geometry",
        title="Scene without P99",
        points=[
            Point(id="A", x=0.0, y=0.0, label="A"),
            Point(id="B", x=1.0, y=0.0, label="B"),
            Point(id="C", x=0.0, y=1.0, label="C"),
            Point(id="P1", x=0.5, y=0.5, label="P1"),
        ],
        facts=[
            "length of AB is 5 cm",
            "P1 = 3 cm",
        ],
    )

    # Question specifically asking for "length of P99"
    assert facts_lookup(scene, "length of P99") is None
    assert facts_lookup(scene, "What is the length of P99?") is None
    assert facts_lookup(scene, "Where is P99?") is None
    assert facts_lookup(scene, "P99") is None


# ---------------------------------------------------------------------------
# 4. "P1" with fact "P1P2 = 3 cm" style: existing matching rules apply
# ---------------------------------------------------------------------------


def test_facts_lookup_p1_with_segment_style_fact() -> None:
    """Question 'P1' with a fact in 'P1P2 = 3 cm' style follows existing matching rules."""
    scene = DiagramScene(
        kind="geometry",
        title="Scene with P1 and P1P2 segment fact",
        points=[
            Point(id="A", x=0.0, y=0.0, label="A"),
            Point(id="B", x=1.0, y=0.0, label="B"),
            Point(id="C", x=0.0, y=1.0, label="C"),
            Point(id="P1", x=0.5, y=0.5, label="P1"),
        ],
        facts=[
            "P1P2 = 3 cm",
        ],
    )

    # Asking about point "P1" does not match segment fact "P1P2 = 3 cm"
    assert facts_lookup(scene, "P1") is None
    assert facts_lookup(scene, "What is P1?") is None
    assert facts_lookup(scene, "length of P1") is None

    # Parallel behavior: asking about point "A" does not match segment fact "AB = 3 cm"
    scene_letter = DiagramScene(
        kind="geometry",
        title="Scene with A and AB segment fact",
        points=[
            Point(id="A", x=0.0, y=0.0, label="A"),
            Point(id="B", x=1.0, y=0.0, label="B"),
            Point(id="C", x=0.0, y=1.0, label="C"),
        ],
        facts=[
            "AB = 3 cm",
        ],
    )
    assert facts_lookup(scene_letter, "A") is None
    assert facts_lookup(scene_letter, "What is A?") is None
    assert facts_lookup(scene_letter, "length of A") is None


# ---------------------------------------------------------------------------
# 5. Regression test: "AB = 3 cm" questions still work
# ---------------------------------------------------------------------------


def test_facts_lookup_regression_ab_questions_work() -> None:
    """Regression test: 'AB = 3 cm' questions and reversals continue to work."""
    scene = DiagramScene(
        kind="geometry",
        title="Triangle ABC",
        points=[
            Point(id="A", x=0.0, y=0.0, label="A"),
            Point(id="B", x=1.0, y=0.0, label="B"),
            Point(id="C", x=0.0, y=1.0, label="C"),
        ],
        facts=[
            "AB = 3 cm",
            "BC = 4 cm",
        ],
    )

    ans_ab = facts_lookup(scene, "What is the length of AB?")
    assert ans_ab is not None
    assert "3 cm" in ans_ab

    # Reversed segment BA matches AB via _with_reversals
    ans_ba = facts_lookup(scene, "How long is BA?")
    assert ans_ba is not None
    assert "3 cm" in ans_ba

    # Direct query
    ans_direct = facts_lookup(scene, "AB")
    assert ans_direct is not None
    assert "3 cm" in ans_direct


# ---------------------------------------------------------------------------
# 6. End-to-end POST /api/v1/ask integration test
# ---------------------------------------------------------------------------


def test_api_ask_p1_and_p99_integration() -> None:
    """POST /api/v1/ask returns source='facts' for P1 and source='unknown' for P99."""
    scene = DiagramScene(
        kind="geometry",
        title="Ask Integration Scene",
        points=[
            Point(id="A", x=0.0, y=0.0, label="A"),
            Point(id="B", x=1.0, y=0.0, label="B"),
            Point(id="C", x=0.0, y=1.0, label="C"),
            Point(id="P1", x=0.5, y=0.5, label="P1"),
        ],
        facts=[
            "P1 = 5 cm",
            "AB = 3 cm",
        ],
    )

    client = TestClient(app)
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])

    try:
        # Known point P1 resolves to facts
        resp_p1 = client.post(
            "/api/v1/ask",
            json={
                "scene": scene.model_dump(),
                "question": "What is the length of P1?",
                "lang": "en",
            },
        )
        assert resp_p1.status_code == 200
        data_p1 = resp_p1.json()
        assert data_p1["source"] == "facts"
        assert "5 cm" in data_p1["answer"]

        # Unknown point P99 falls through to unknown
        resp_p99 = client.post(
            "/api/v1/ask",
            json={
                "scene": scene.model_dump(),
                "question": "What is the length of P99?",
                "lang": "en",
            },
        )
        assert resp_p99.status_code == 200
        data_p99 = resp_p99.json()
        assert data_p99["source"] == "unknown"
        assert data_p99["answer"] == "I don't know from this diagram."
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 7. Hypothesis Property Test
# ---------------------------------------------------------------------------


@given(
    scene_id_sample=st.sets(st.sampled_from(ALL_POINT_IDS), min_size=1, max_size=15),
    data=st.data(),
)
@settings(max_examples=200)
def test_hypothesis_unknown_id_never_gets_answer(
    scene_id_sample: set[str], data: st.DataObject
) -> None:
    """Hypothesis property:

    For any scene point ids drawn from letters and P1..P99, a question naming
    an id NOT in the scene never gets an answer from facts_lookup.
    """
    available_unknowns = [pid for pid in CANDIDATE_UNKNOWN_IDS if pid not in scene_id_sample]
    if not available_unknowns:
        return

    unknown_id = data.draw(st.sampled_from(available_unknowns))

    points = [
        Point(
            id=pid,
            x=min(1.0, max(0.0, float(i) / 20.0)),
            y=min(1.0, max(0.0, float(i * 2) / 30.0)),
            label=pid,
        )
        for i, pid in enumerate(sorted(scene_id_sample))
    ]
    facts = [f"{pid} = {i + 1} cm" for i, pid in enumerate(sorted(scene_id_sample))]

    scene = DiagramScene(
        kind="geometry",
        title="Hypothesis Test Scene",
        points=points,
        facts=facts,
    )

    question_template = data.draw(
        st.sampled_from(
            [
                "What is the length of {id}?",
                "How long is {id}?",
                "What is {id}?",
                "Where is {id}?",
                "Find {id}",
                "length of {id}",
                "{id}",
            ]
        )
    )
    question = question_template.format(id=unknown_id)

    result = facts_lookup(scene, question)
    assert result is None, (
        f"Expected None for unknown id {unknown_id} (not in {sorted(scene_id_sample)}), "
        f"got '{result}' for question '{question}'"
    )
