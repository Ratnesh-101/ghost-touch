"""Property-based tests for the DiagramScene schema invariants (Task 2.1).

These exercise the model-level validators in ``app/schema.py`` directly:
coordinates in [0, 1], unique ids across the scene, and valid segment
references (Requirements 3.2 and 3.5). They are distinct from property P9
(Task 8.6), which tests ``validate.py`` repair and garbage-input handling
through the validator pipeline rather than the bare model.
"""

from __future__ import annotations

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st
from hypothesis.strategies import composite
from pydantic import ValidationError

from app.schema import DiagramScene

# **Validates: Requirements 3.2, 3.5**


def coord() -> st.SearchStrategy[float]:
    """A coordinate strictly inside the valid [0, 1] range."""
    return st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)


def bad_coord() -> st.SearchStrategy[float]:
    """A coordinate strictly outside [0, 1] (either below 0 or above 1)."""
    below = st.floats(min_value=-5.0, max_value=-1e-4, allow_nan=False, allow_infinity=False)
    above = st.floats(min_value=1.0001, max_value=5.0, allow_nan=False, allow_infinity=False)
    return below | above


def any_id() -> st.SearchStrategy[str]:
    """A non-empty string id (numeric, for fast generation)."""
    return st.integers(min_value=1, max_value=10000).map(str)


@composite
def valid_scene_dict(draw) -> dict:
    """Build a dict that always satisfies every DiagramScene invariant.

    Ids use distinct prefixes (p/s/l/b) so they are globally unique; segment
    endpoints are drawn from the generated point ids so references always exist.
    Labels are omitted (they default to None) because they do not affect the
    invariants under test, keeping generation fast.
    """
    n_points = draw(st.integers(min_value=0, max_value=3))
    points = [{"id": f"p{i}", "x": draw(coord()), "y": draw(coord())} for i in range(n_points)]

    n_segs = draw(st.integers(min_value=0, max_value=3)) if n_points >= 1 else 0
    segments = []
    for i in range(n_segs):
        a = draw(st.integers(min_value=0, max_value=n_points - 1))
        b = draw(st.integers(min_value=0, max_value=n_points - 1))
        segments.append({"id": f"s{i}", "a": f"p{a}", "b": f"p{b}"})

    polylines = [
        {
            "id": f"l{i}",
            "points": [
                [draw(coord()), draw(coord())]
                for _ in range(draw(st.integers(min_value=0, max_value=3)))
            ],
        }
        for i in range(draw(st.integers(min_value=0, max_value=2)))
    ]

    bars = [
        {
            "id": f"b{i}",
            "x0": draw(coord()),
            "x1": draw(coord()),
            "y_top": draw(coord()),
            "y_base": draw(coord()),
            "label": f"bar{i}",
            "value": draw(st.floats(min_value=0.0, max_value=1000.0)),
        }
        for i in range(draw(st.integers(min_value=0, max_value=2)))
    ]

    axes = None
    if draw(st.booleans()):
        axes = {"x_axis_y": draw(coord()), "y_axis_x": draw(coord())}

    return {
        "kind": draw(st.sampled_from(["geometry", "function_graph", "bar_chart", "unknown"])),
        "points": points,
        "segments": segments,
        "polylines": polylines,
        "bars": bars,
        "axes": axes,
    }


def _assert_invariants(scene: DiagramScene) -> None:
    """Re-check every invariant the model promises, independently of the model."""
    ids = [e.id for e in (*scene.points, *scene.segments, *scene.polylines, *scene.bars)]
    assert len(ids) == len(set(ids)), "ids must be unique across the scene"

    point_ids = {p.id for p in scene.points}
    for s in scene.segments:
        assert s.a in point_ids, f"segment {s.id} references unknown point {s.a}"
        assert s.b in point_ids, f"segment {s.id} references unknown point {s.b}"

    for p in scene.points:
        assert 0.0 <= p.x <= 1.0
        assert 0.0 <= p.y <= 1.0
    for poly in scene.polylines:
        for x, y in poly.points:
            assert 0.0 <= x <= 1.0
            assert 0.0 <= y <= 1.0
    for bar in scene.bars:
        for c in (bar.x0, bar.x1, bar.y_top, bar.y_base):
            assert 0.0 <= c <= 1.0
    if scene.axes is not None:
        if scene.axes.x_axis_y is not None:
            assert 0.0 <= scene.axes.x_axis_y <= 1.0
        if scene.axes.y_axis_x is not None:
            assert 0.0 <= scene.axes.y_axis_x <= 1.0


# --- Requirement 3.2 & 3.5: valid scenes construct and hold invariants -------
# Building a full scene is a multi-draw composite, so we relax the too_slow
# health check; the test's correctness does not depend on generation speed.


@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(valid_scene_dict())
def test_valid_scene_constructs_holds_invariants_and_round_trips(data: dict) -> None:
    scene = DiagramScene(**data)
    _assert_invariants(scene)

    # A scene serialised to JSON-compatible data must reconstruct identically.
    dumped = scene.model_dump(mode="json")
    rebuilt = DiagramScene(**dumped)
    _assert_invariants(rebuilt)


# --- Requirement 3.2: out-of-range coordinates are rejected ----------------


@given(bad_coord())
def test_point_coordinate_out_of_range_rejected(bad: float) -> None:
    with pytest.raises(ValidationError, match="out of range"):
        DiagramScene(kind="geometry", points=[{"id": "p0", "x": bad, "y": 0.5}])
    with pytest.raises(ValidationError, match="out of range"):
        DiagramScene(kind="geometry", points=[{"id": "p0", "x": 0.5, "y": bad}])


@given(bad_coord())
def test_polyline_coordinate_out_of_range_rejected(bad: float) -> None:
    with pytest.raises(ValidationError, match="out of range"):
        DiagramScene(
            kind="function_graph",
            polylines=[{"id": "l0", "points": [[bad, 0.5]]}],
        )


@given(bad_coord())
def test_bar_coordinate_out_of_range_rejected(bad: float) -> None:
    with pytest.raises(ValidationError, match="out of range"):
        DiagramScene(
            kind="bar_chart",
            bars=[
                {
                    "id": "b0",
                    "x0": 0.0,
                    "x1": bad,
                    "y_top": 0.2,
                    "y_base": 0.9,
                    "label": "x",
                    "value": 1,
                }
            ],
        )


@given(bad_coord())
def test_axes_coordinate_out_of_range_rejected(bad: float) -> None:
    with pytest.raises(ValidationError, match="out of range"):
        DiagramScene(kind="geometry", axes={"x_axis_y": bad, "y_axis_x": 0.5})


# --- Requirement 3.5: unique ids and valid references -----------------------


@given(any_id())
def test_duplicate_point_id_rejected(dup_id: str) -> None:
    with pytest.raises(ValidationError, match="duplicate element id"):
        DiagramScene(
            kind="geometry",
            points=[
                {"id": dup_id, "x": 0.1, "y": 0.1},
                {"id": dup_id, "x": 0.9, "y": 0.9},
            ],
        )


@given(any_id())
def test_dangling_segment_reference_rejected(missing_id: str) -> None:
    # Numeric ids can never equal the existing point id "p0", so this endpoint
    # always dangles.
    assert missing_id != "p0"
    with pytest.raises(ValidationError, match="references unknown point"):
        DiagramScene(
            kind="geometry",
            points=[{"id": "p0", "x": 0.5, "y": 0.5}],
            segments=[{"id": "s0", "a": "p0", "b": missing_id}],
        )
