"""Property-based tests for validate.py (P9, P13).

P9: any scene accepted by validate.py has unique ids, valid point references,
    and all coordinates in [0, 1]. Garbage input never raises.
P13: labels made only of colour/shape words are rejected; labels with any
    other word are accepted.

Validates: Requirements 3.2, 3.3, 3.5, 3.6
"""

from __future__ import annotations

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from app.validate import COLOUR_SHAPE_WORDS, validate_scene

# ---------------------------------------------------------------------------
# P9 — Validator invariants
# ---------------------------------------------------------------------------


@st.composite
def scene_or_garbage(draw):
    """Generate a valid-ish scene dict, a random dict, or a garbage string."""
    choice = draw(st.integers(min_value=0, max_value=2))
    if choice == 0:
        # Scene dict with coords that might be slightly out of range
        # (exercises clamping) and possibly duplicate ids (exercises dedupe).
        n = draw(st.integers(min_value=1, max_value=5))
        use_dup = draw(st.booleans())
        points = []
        for i in range(n):
            pid = "p0" if (use_dup and i > 0) else f"p{i}"
            points.append(
                {
                    "id": pid,
                    "x": draw(
                        st.floats(
                            min_value=-0.05, max_value=1.05, allow_nan=False, allow_infinity=False
                        )
                    ),
                    "y": draw(
                        st.floats(
                            min_value=-0.05, max_value=1.05, allow_nan=False, allow_infinity=False
                        )
                    ),
                }
            )
        segs = []
        for i in range(draw(st.integers(min_value=0, max_value=3))):
            a = draw(st.integers(min_value=0, max_value=n - 1))
            b = draw(st.integers(min_value=0, max_value=n - 1))
            segs.append({"id": f"s{i}", "a": f"p{a}", "b": f"p{b}"})
        return {
            "kind": draw(st.sampled_from(["geometry", "function_graph", "bar_chart", "unknown"])),
            "points": points,
            "segments": segs,
        }
    elif choice == 1:
        # Random dict (garbage)
        return draw(
            st.dictionaries(
                st.text(min_size=1, max_size=5),
                st.one_of(st.text(max_size=20), st.integers(), st.floats(allow_nan=False)),
                max_size=10,
            )
        )
    else:
        # Garbage string
        return draw(st.text(min_size=0, max_size=100))


@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(scene_or_garbage())
def test_p9_validate_scene_never_raises_and_accepted_scenes_have_invariants(raw):
    """P9: validate_scene never raises. Accepted scenes have unique ids,
    valid references, and coords in [0, 1].

    Validates: Requirements 3.2, 3.3, 3.5
    """
    try:
        result = validate_scene(raw)
    except Exception as exc:
        pytest.fail(f"validate_scene raised: {exc}")

    if result.scene is not None:
        scene = result.scene
        # Unique ids across all element kinds
        ids = [e.id for e in (*scene.points, *scene.segments, *scene.polylines, *scene.bars)]
        assert len(ids) == len(set(ids)), f"duplicate ids: {ids}"

        # Valid segment references
        point_ids = {p.id for p in scene.points}
        for seg in scene.segments:
            assert seg.a in point_ids, f"segment {seg.id} references unknown point {seg.a}"
            assert seg.b in point_ids, f"segment {seg.id} references unknown point {seg.b}"

        # All coordinates in [0, 1]
        for p in scene.points:
            assert 0.0 <= p.x <= 1.0, f"point {p.id} x={p.x} out of [0,1]"
            assert 0.0 <= p.y <= 1.0, f"point {p.id} y={p.y} out of [0,1]"
        for poly in scene.polylines:
            for x, y in poly.points:
                assert 0.0 <= x <= 1.0, f"polyline {poly.id} x={x} out of [0,1]"
                assert 0.0 <= y <= 1.0, f"polyline {poly.id} y={y} out of [0,1]"
        for bar in scene.bars:
            for c in (bar.x0, bar.x1, bar.y_top, bar.y_base):
                assert 0.0 <= c <= 1.0, f"bar {bar.id} coord={c} out of [0,1]"
        if scene.axes is not None:
            if scene.axes.x_axis_y is not None:
                assert 0.0 <= scene.axes.x_axis_y <= 1.0
            if scene.axes.y_axis_x is not None:
                assert 0.0 <= scene.axes.y_axis_x <= 1.0


def test_p9_garbage_strings_never_raise():
    """Specific garbage inputs that should not crash."""
    for garbage in [
        "",
        "not json",
        "{",
        "[]",
        "null",
        "true",
        "42",
        "```json\n```",
        "I cannot read this diagram",
        "\x00\x01\x02",
        '{"kind": "geometry"}',
    ]:
        result = validate_scene(garbage)
        # Should return errors, not raise
        assert result is not None


def test_p9_clamp_within_tolerance():
    """Coordinates within +/-0.02 are clamped, not rejected."""
    data = {
        "kind": "geometry",
        "points": [
            {"id": "A", "x": -0.01, "y": 0.5},  # clamp to 0
            {"id": "B", "x": 0.5, "y": 1.01},  # clamp to 1
        ],
        "segments": [{"id": "AB", "a": "A", "b": "B"}],
    }
    result = validate_scene(data)
    assert result.scene is not None
    assert result.scene.points[0].x == 0.0
    assert result.scene.points[1].y == 1.0


def test_p9_drop_beyond_tolerance():
    """Coordinates beyond +/-0.02 are dropped (element removed)."""
    data = {
        "kind": "geometry",
        "points": [
            {"id": "A", "x": 0.5, "y": 0.5},
            {"id": "B", "x": 0.5, "y": 1.5},  # beyond tolerance -> dropped
        ],
        "segments": [{"id": "AB", "a": "A", "b": "B"}],  # dangling after B dropped
    }
    result = validate_scene(data)
    # A is kept, B is dropped, segment AB is dangling and dropped
    assert result.scene is not None
    assert len(result.scene.points) == 1
    assert result.scene.points[0].id == "A"
    assert len(result.scene.segments) == 0


def test_p9_dedupe_ids():
    """Duplicate ids are renamed."""
    data = {
        "kind": "geometry",
        "points": [
            {"id": "A", "x": 0.2, "y": 0.2},
            {"id": "A", "x": 0.8, "y": 0.8},  # duplicate -> renamed to A_2
        ],
        "segments": [],
    }
    result = validate_scene(data)
    assert result.scene is not None
    ids = [p.id for p in result.scene.points]
    assert len(ids) == len(set(ids)), f"ids not unique: {ids}"


def test_p9_reject_zero_drawable_elements():
    """Scene with no drawable elements is rejected."""
    data = {"kind": "unknown"}
    result = validate_scene(data)
    assert result.scene is None
    assert any("no drawable elements" in e for e in result.errors)


# ---------------------------------------------------------------------------
# P13 — Validator rejects colour/shape-only labels
# ---------------------------------------------------------------------------


@given(st.lists(st.sampled_from(sorted(COLOUR_SHAPE_WORDS)), min_size=1, max_size=3))
def test_p13_rejects_colour_shape_only_labels(words):
    """Labels made only of colour/shape words are rejected (Req 3.6).

    Validates: Requirement 3.6
    """
    label = " ".join(words)
    data = {
        "kind": "geometry",
        "points": [{"id": "A", "x": 0.5, "y": 0.5, "label": label}],
    }
    result = validate_scene(data)
    assert result.scene is None
    assert any("colour or generic shape" in e for e in result.errors)


@given(
    st.text(alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ", min_size=1, max_size=3).filter(
        lambda s: s.lower() not in COLOUR_SHAPE_WORDS
    )
)
def test_p13_accepts_non_colour_shape_labels(label):
    """Labels with at least one non-colour/shape word are accepted."""
    data = {
        "kind": "geometry",
        "points": [{"id": "A", "x": 0.5, "y": 0.5, "label": label}],
    }
    result = validate_scene(data)
    # Should be accepted (filtered so 1-3 letter strings cannot collide with colour/shape words)
    assert result.scene is not None
    assert not any("colour or generic shape" in e for e in result.errors)
