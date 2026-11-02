"""Unit tests for the DiagramScene schema and its validators (Task 2.1).

Covers Requirement 3.1 (kind classification), 3.2 (coordinates in [0, 1]), and
3.5 (unique ids and valid segment references). Concrete scenes mirror the
three sample diagrams so these double as construction smoke tests.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schema import Axes, Bar, DiagramScene, Point, Polyline, Segment

# --- happy paths -----------------------------------------------------------


def test_triangle_scene_is_valid() -> None:
    """A minimal geometry scene (triangle ABC) builds with version 1."""
    scene = DiagramScene(
        kind="geometry",
        title="Triangle ABC",
        points=[
            Point(id="A", x=0.2, y=0.2, label="A"),
            Point(id="B", x=0.8, y=0.2, label="B"),
            Point(id="C", x=0.5, y=0.8, label="C"),
        ],
        segments=[
            Segment(id="AB", a="A", b="B"),
            Segment(id="BC", a="B", b="C"),
            Segment(id="CA", a="C", b="A"),
        ],
        facts=["AB = 5 cm", "angle C = 90°"],
    )
    assert scene.version == 1
    assert scene.kind == "geometry"
    assert {p.id for p in scene.points} == {"A", "B", "C"}


def test_sine_graph_scene_is_valid() -> None:
    """A function_graph scene uses polylines + axes."""
    scene = DiagramScene(
        kind="function_graph",
        title="y = sin(x)",
        polylines=[
            Polyline(
                id="curve",
                points=[(0.1, 0.5), (0.3, 0.8), (0.5, 0.5), (0.7, 0.2), (0.9, 0.5)],
                label="sin(x)",
            )
        ],
        axes=Axes(x_axis_y=0.5, y_axis_x=0.1),
    )
    assert scene.kind == "function_graph"
    assert scene.axes is not None
    assert scene.axes.x_axis_y == 0.5


def test_bar_chart_scene_is_valid() -> None:
    """A bar_chart scene uses bars with required labels and values."""
    scene = DiagramScene(
        kind="bar_chart",
        title="Sales by quarter",
        bars=[
            Bar(id="q1", x0=0.1, x1=0.3, y_top=0.2, y_base=0.9, label="Q1", value=10),
            Bar(id="q2", x0=0.4, x1=0.6, y_top=0.1, y_base=0.9, label="Q2", value=25),
        ],
    )
    assert scene.kind == "bar_chart"
    assert scene.bars[1].value == 25


def test_unknown_kind_with_empty_scene_allowed() -> None:
    """An empty scene is schema-valid; the empty/usable policy lives in
    validate.py (Task 8.3), not in the schema."""
    scene = DiagramScene(kind="unknown")
    assert scene.points == []
    assert scene.segments == []
    assert scene.version == 1


def test_default_version_is_one() -> None:
    scene = DiagramScene(kind="geometry")
    assert scene.version == 1


# --- Requirement 3.2: coordinates in [0, 1] ---------------------------------


@pytest.mark.parametrize("bad", [-0.0001, -1.0, 1.0001, 2.0])
def test_point_out_of_range_rejected(bad: float) -> None:
    with pytest.raises(
        ValidationError, match=r"greater than or equal to 0|less than or equal to 1"
    ):
        Point(id="A", x=bad, y=0.5)
    with pytest.raises(
        ValidationError, match=r"greater than or equal to 0|less than or equal to 1"
    ):
        Point(id="A", x=0.5, y=bad)


def test_point_boundary_coordinates_accepted() -> None:
    """0.0 and 1.0 are valid (closed interval)."""
    Point(id="A", x=0.0, y=0.0)
    Point(id="A", x=1.0, y=1.0)


def test_polyline_point_out_of_range_rejected() -> None:
    with pytest.raises(
        ValidationError, match=r"greater than or equal to 0|less than or equal to 1"
    ):
        Polyline(id="l", points=[(0.5, 1.5)])


def test_bar_coordinate_out_of_range_rejected() -> None:
    with pytest.raises(
        ValidationError, match=r"greater than or equal to 0|less than or equal to 1"
    ):
        Bar(id="b", x0=0.0, x1=1.2, y_top=0.2, y_base=0.9, label="x", value=1)


def test_axes_out_of_range_rejected() -> None:
    with pytest.raises(
        ValidationError, match=r"greater than or equal to 0|less than or equal to 1"
    ):
        Axes(x_axis_y=1.5, y_axis_x=0.5)


def test_axes_none_coordinates_allowed() -> None:
    """Axes with all-None fields is valid."""
    axes = Axes()
    assert axes.x_axis_y is None
    assert axes.y_axis_x is None


# --- Requirement 3.5: unique ids & valid references ------------------------


def test_duplicate_point_id_rejected() -> None:
    with pytest.raises(ValidationError, match="duplicate element id: 'A'"):
        DiagramScene(
            kind="geometry",
            points=[Point(id="A", x=0.1, y=0.1), Point(id="A", x=0.9, y=0.9)],
        )


def test_duplicate_id_across_kinds_rejected() -> None:
    """Ids are unique across every element kind, not just within a list."""
    with pytest.raises(ValidationError, match="duplicate element id: 'X'"):
        DiagramScene(
            kind="geometry",
            points=[Point(id="X", x=0.1, y=0.1)],
            polylines=[Polyline(id="X", points=[(0.0, 0.0), (1.0, 1.0)])],
        )


def test_dangling_segment_reference_rejected() -> None:
    with pytest.raises(ValidationError, match="references unknown point 'Z'"):
        DiagramScene(
            kind="geometry",
            points=[Point(id="A", x=0.1, y=0.1)],
            segments=[Segment(id="s1", a="A", b="Z")],
        )


def test_valid_segment_references_accepted() -> None:
    """A segment referencing two existing points (even the same point) is
    accepted — only endpoint existence is checked, not distinctness."""
    DiagramScene(
        kind="geometry",
        points=[Point(id="A", x=0.5, y=0.5)],
        segments=[Segment(id="s1", a="A", b="A")],
    )


# --- Requirement 3.1: kind classification -----------------------------------


def test_kind_literal_enforced() -> None:
    with pytest.raises(ValidationError):
        DiagramScene(kind="pie_chart")  # type: ignore[arg-type]


def test_bar_label_is_required() -> None:
    with pytest.raises(ValidationError):
        Bar(id="b", x0=0.0, x1=0.5, y_top=0.2, y_base=0.9, value=1)  # type: ignore[call-arg]
