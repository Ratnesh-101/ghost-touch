"""Regression tests for Lane k3-validate-hardening.

Verifies:
- F6: Reject NaN and Infinity in coordinates, polyline points, axes, and Bar.value.
- F7: validate_scene never raises on unhashable (list, dict) or malformed segment endpoints.
- F5: Validation dropping referenced elements (used by segments or named in facts)
      invalidates scene; unreferenced stray element drops remain silently allowed.
- F9: Polylines need at least 2 points to count as drawable.
- F15: Dedupe element IDs before dangling-segment check so segments bind to intended points.
- F12: Spoken string sanitization (strip Cf/Cc/Zl/Zp, collapse whitespace, cap lengths,
       reject empty ids).
- B2-05: Normalise inverted bars (min/max on x0/x1 and y_top/y_base).
- F2: Optional aspect ratio on DiagramScene and scaling in semantic.py distance and angle math.
- B2-06: Consistent structural bounds across validate_scene and schema.
- B2-13: Colour/shape words rejected even with trailing punctuation.
"""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from app.schema import Axes, Bar, DiagramScene, Point, Segment
from app.semantic import _find_longest_side, _find_right_angle
from app.validate import _clamp_coord, _is_colour_shape_only, validate_scene

# ===========================================================================
# F6: NaN and Infinity Rejection
# ===========================================================================


def test_f6_clamp_coord_rejects_nan_and_infinity() -> None:
    """_clamp_coord returns None for NaN and positive/negative Infinity."""
    assert _clamp_coord(float("nan")) is None
    assert _clamp_coord(float("inf")) is None
    assert _clamp_coord(float("-inf")) is None
    assert _clamp_coord(0.5) == 0.5


def test_f6_schema_rejects_nan_and_infinity_in_point() -> None:
    """Point model rejects NaN and Inf coordinates via allow_inf_nan=False."""
    with pytest.raises(ValidationError):
        Point(id="p1", x=float("nan"), y=0.5)
    with pytest.raises(ValidationError):
        Point(id="p1", x=0.5, y=float("inf"))
    with pytest.raises(ValidationError):
        Point(id="p1", x=0.5, y=float("-inf"))


def test_f6_schema_rejects_nan_and_infinity_in_bar_value() -> None:
    """Bar model rejects NaN and Inf values via allow_inf_nan=False."""
    with pytest.raises(ValidationError):
        Bar(id="b1", x0=0.1, x1=0.2, y_top=0.3, y_base=0.8, label="B1", value=float("nan"))
    with pytest.raises(ValidationError):
        Bar(id="b1", x0=0.1, x1=0.2, y_top=0.3, y_base=0.8, label="B1", value=float("inf"))


def test_f6_schema_rejects_nan_and_infinity_in_axes() -> None:
    """Axes model rejects NaN and Inf coordinates."""
    with pytest.raises(ValidationError):
        Axes(x_axis_y=float("nan"), y_axis_x=0.5)
    with pytest.raises(ValidationError):
        Axes(x_axis_y=0.5, y_axis_x=float("inf"))


def test_f6_validate_scene_drops_elements_with_nan_or_inf() -> None:
    """validate_scene drops stray elements with NaN or Inf coordinates and finite bar values."""
    raw: dict[str, Any] = {
        "kind": "geometry",
        "points": [
            {"id": "A", "x": 0.2, "y": 0.2},
            {"id": "B", "x": 0.8, "y": 0.8},
            {"id": "stray_nan", "x": float("nan"), "y": 0.5},
            {"id": "stray_inf", "x": 0.5, "y": float("inf")},
        ],
        "segments": [{"id": "s1", "a": "A", "b": "B"}],
    }
    res = validate_scene(raw)
    assert res.scene is not None
    point_ids = {p.id for p in res.scene.points}
    assert point_ids == {"A", "B"}


# ===========================================================================
# F7: validate_scene Never Raises
# ===========================================================================


def test_f7_validate_scene_never_raises_on_unhashable_endpoints() -> None:
    """Segment endpoint containing a list or dict does not crash validate_scene with TypeError."""
    raw_list_endpoint = {
        "kind": "geometry",
        "points": [{"id": "p1", "x": 0.2, "y": 0.2}],
        "segments": [{"id": "s1", "a": ["unhashable_list"], "b": "p1"}],
    }
    # Must not raise 500 / TypeError; returns ValidationResult
    res = validate_scene(raw_list_endpoint)
    assert isinstance(res.errors, list)

    raw_dict_endpoint = {
        "kind": "geometry",
        "points": [{"id": "p1", "x": 0.2, "y": 0.2}],
        "segments": [{"id": "s1", "a": "p1", "b": {"nested": "dict"}}],
    }
    res2 = validate_scene(raw_dict_endpoint)
    assert isinstance(res2.errors, list)


def test_f7_validate_scene_never_raises_on_arbitrary_garbage() -> None:
    """validate_scene handles non-dict/non-string inputs gracefully."""
    assert validate_scene(12345).scene is None  # type: ignore[arg-type]
    assert validate_scene(None).scene is None  # type: ignore[arg-type]
    assert validate_scene([{"kind": "geometry"}]).scene is None  # type: ignore[arg-type]
    assert validate_scene("invalid json {{{").scene is None


# ===========================================================================
# F5: Drop of Referenced Elements Fails Validation
# ===========================================================================


def test_f5_dropping_point_used_by_segments_fails_validation() -> None:
    """Triangle with out-of-tolerance point C (y=1.05) fails validation (not silent reduction)."""
    raw = {
        "kind": "geometry",
        "points": [
            {"id": "A", "x": 0.2, "y": 0.2},
            {"id": "B", "x": 0.8, "y": 0.2},
            {"id": "C", "x": 0.5, "y": 1.05},  # > 1.02, out of tolerance
        ],
        "segments": [
            {"id": "AB", "a": "A", "b": "B"},
            {"id": "BC", "a": "B", "b": "C"},
            {"id": "CA", "a": "C", "b": "A"},
        ],
        "facts": ["triangle ABC"],
    }
    res = validate_scene(raw)
    assert res.scene is None
    assert any("dropped point 'C'" in err for err in res.errors)


def test_f5_dropping_element_named_in_facts_fails_validation() -> None:
    """Dropping a bar named in facts invalidates the scene."""
    raw = {
        "kind": "bar_chart",
        "bars": [
            {
                "id": "b1",
                "x0": 0.1,
                "x1": 0.3,
                "y_top": 0.2,
                "y_base": 0.8,
                "label": "Apples",
                "value": 10,
            },
            {
                "id": "b2",
                "x0": 0.4,
                "x1": 0.6,
                "y_top": 1.05,  # out of bounds (> 1.02)
                "y_base": 0.8,
                "label": "Bananas",
                "value": 20,
            },
        ],
        "facts": ["Bananas sold 20 units"],
    }
    res = validate_scene(raw)
    assert res.scene is None
    assert any("dropped bar 'b2'" in err for err in res.errors)


def test_f5_dropping_unreferenced_stray_element_is_allowed() -> None:
    """Dropping an unreferenced stray point out of tolerance succeeds silently."""
    raw = {
        "kind": "geometry",
        "points": [
            {"id": "A", "x": 0.2, "y": 0.2},
            {"id": "B", "x": 0.8, "y": 0.8},
            {"id": "stray", "x": 1.15, "y": 0.5},  # unreferenced stray point
        ],
        "segments": [{"id": "s1", "a": "A", "b": "B"}],
        "facts": ["line segment AB"],
    }
    res = validate_scene(raw)
    assert res.scene is not None
    assert {p.id for p in res.scene.points} == {"A", "B"}


# ===========================================================================
# F9: Polyline Minimum 2 Points
# ===========================================================================


def test_f9_polyline_needs_at_least_2_points_to_be_drawable() -> None:
    """Empty polyline or 1-point polyline is not drawable; scene with only empty polyline fails."""
    # 0 points
    raw_empty = {
        "kind": "function_graph",
        "polylines": [{"id": "p1", "points": []}],
    }
    res_empty = validate_scene(raw_empty)
    assert res_empty.scene is None
    assert "Scene has no drawable elements" in res_empty.errors

    # 1 point
    raw_one = {
        "kind": "function_graph",
        "polylines": [{"id": "p1", "points": [[0.5, 0.5]]}],
    }
    res_one = validate_scene(raw_one)
    assert res_one.scene is None
    assert "Scene has no drawable elements" in res_one.errors

    # 2 points: valid and drawable
    raw_two = {
        "kind": "function_graph",
        "polylines": [{"id": "p1", "points": [[0.1, 0.1], [0.9, 0.9]]}],
    }
    res_two = validate_scene(raw_two)
    assert res_two.scene is not None
    assert len(res_two.scene.polylines) == 1


# ===========================================================================
# F15: Dedupe IDs Before Dangling Segment Check
# ===========================================================================


def test_f15_dedupe_ids_before_dangling_segment_check() -> None:
    """Duplicate point ID deduplicated before dangling check so segment binds properly."""
    raw = {
        "kind": "geometry",
        "points": [
            {"id": "P", "x": 0.1, "y": 0.1},
            {"id": "P", "x": 0.9, "y": 0.9},  # deduped to P_2
        ],
        "segments": [
            {"id": "s1", "a": "P", "b": "P_2"},
        ],
    }
    res = validate_scene(raw)
    assert res.scene is not None
    assert len(res.scene.points) == 2
    point_ids = {p.id for p in res.scene.points}
    assert point_ids == {"P", "P_2"}
    assert len(res.scene.segments) == 1
    assert res.scene.segments[0].a == "P"
    assert res.scene.segments[0].b == "P_2"


# ===========================================================================
# F12: Spoken String Sanitization & Length Caps
# ===========================================================================


def test_f12_sanitises_spoken_strings_and_strips_control_characters() -> None:
    """Cf, Cc, Zl, Zp characters are stripped and whitespace is collapsed."""
    raw = {
        "kind": "geometry",
        # U+202E (right-to-left override), U+200B (zero-width space), U+FEFF (BOM)
        "title": "\ufeffDiagram\u200b  with   \u2028spaces\u2029",
        "points": [
            {"id": "A", "x": 0.2, "y": 0.2, "label": "Point\u200b  \u202eA"},
            {"id": "B", "x": 0.8, "y": 0.8, "label": "Point   \t\n  B"},
        ],
        "segments": [{"id": "s1", "a": "A", "b": "B", "label": "Line \u200b AB"}],
        "facts": ["Fact  \u200b  one\u2028."],
    }
    res = validate_scene(raw)
    assert res.scene is not None
    assert res.scene.title == "Diagram with spaces"
    assert res.scene.points[0].label == "Point A"
    assert res.scene.points[1].label == "Point B"
    assert res.scene.segments[0].label == "Line AB"
    assert res.scene.facts == ["Fact one."]


def test_f12_length_caps_enforced() -> None:
    """Labels capped to 60, title to 120, fact to 280 characters."""
    raw = {
        "kind": "geometry",
        "title": "T" * 200,
        "points": [
            {"id": "A", "x": 0.2, "y": 0.2, "label": "L" * 100},
            {"id": "B", "x": 0.8, "y": 0.8},
        ],
        "segments": [{"id": "s1", "a": "A", "b": "B"}],
        "facts": ["F" * 350],
    }
    res = validate_scene(raw)
    assert res.scene is not None
    assert len(res.scene.title or "") == 120
    assert len(res.scene.points[0].label or "") == 60
    assert len(res.scene.facts[0]) == 280


def test_f12_rejects_empty_ids() -> None:
    """validate_scene rejects elements with empty or whitespace-only ids."""
    raw_empty_id = {
        "kind": "geometry",
        "points": [
            {"id": "", "x": 0.2, "y": 0.2},
            {"id": "B", "x": 0.8, "y": 0.8},
        ],
        "segments": [],
    }
    res = validate_scene(raw_empty_id)
    assert res.scene is None
    assert any("empty id" in err for err in res.errors)

    raw_ws_id = {
        "kind": "geometry",
        "points": [
            {"id": "   \u200b   ", "x": 0.2, "y": 0.2},
            {"id": "B", "x": 0.8, "y": 0.8},
        ],
        "segments": [],
    }
    res_ws = validate_scene(raw_ws_id)
    assert res_ws.scene is None
    assert any("empty id" in err for err in res_ws.errors)


# ===========================================================================
# B2-05: Normalise Inverted Bars
# ===========================================================================


def test_b2_05_normalise_inverted_bars() -> None:
    """validate_scene normalises inverted bar coordinates so bars are hittable."""
    raw = {
        "kind": "bar_chart",
        "bars": [
            {
                "id": "b1",
                "x0": 0.6,
                "x1": 0.2,  # inverted x
                "y_top": 0.8,
                "y_base": 0.3,  # inverted y
                "label": "Quarter",
                "value": 15.0,
            }
        ],
    }
    res = validate_scene(raw)
    assert res.scene is not None
    b = res.scene.bars[0]
    assert b.x0 == 0.2
    assert b.x1 == 0.6
    assert b.y_top == 0.3
    assert b.y_base == 0.8
    assert b.x0 <= b.x1
    assert b.y_top <= b.y_base


# ===========================================================================
# F2: Aspect Ratio Preservation in Scene & Semantic Calculations
# ===========================================================================


def test_f2_aspect_ratio_in_diagram_scene() -> None:
    """DiagramScene accepts optional aspect ratio; defaults to 1.0; rejects non-positive/infinite."""
    # Default 1.0
    scene_default = DiagramScene(kind="geometry")
    assert scene_default.aspect == 1.0

    # Explicit aspect
    scene_aspect = DiagramScene(kind="geometry", aspect=2.5)
    assert scene_aspect.aspect == 2.5

    # Rejection of <= 0 or non-finite
    with pytest.raises(ValidationError):
        DiagramScene(kind="geometry", aspect=0.0)
    with pytest.raises(ValidationError):
        DiagramScene(kind="geometry", aspect=-1.0)
    with pytest.raises(ValidationError):
        DiagramScene(kind="geometry", aspect=float("nan"))
    with pytest.raises(ValidationError):
        DiagramScene(kind="geometry", aspect=float("inf"))


def test_f2_semantic_longest_side_with_aspect() -> None:
    """Longest side scales x-deltas by scene.aspect (Audit F2 example)."""
    # A(0,0), B(1,0), C(0.5,1)
    # AB dx=1, dy=0; AC dx=0.5, dy=1
    points = [
        Point(id="A", x=0.0, y=0.0),
        Point(id="B", x=1.0, y=0.0),
        Point(id="C", x=0.5, y=1.0),
    ]
    segments = [
        Segment(id="AB", a="A", b="B", label="AB"),
        Segment(id="AC", a="A", b="C", label="AC"),
    ]

    # Without aspect (default 1.0): AC length = sqrt(0.25+1) = 1.118 > AB length = 1.0
    scene_square = DiagramScene(kind="geometry", points=points, segments=segments, aspect=1.0)
    _, _, label_square = _find_longest_side(scene_square)
    assert label_square == "AC"

    # With aspect = 4.0 (4:1 wide image):
    # AB dx = 1 * 4 = 4.0, length = 4.0
    # AC dx = 0.5 * 4 = 2.0, dy = 1.0, length = sqrt(4+1) = 2.236
    # AB is now longer!
    scene_wide = DiagramScene(kind="geometry", points=points, segments=segments, aspect=4.0)
    _, _, label_wide = _find_longest_side(scene_wide)
    assert label_wide == "AB"


def test_f2_semantic_right_angle_with_aspect() -> None:
    """Right angle calculation scales x-deltas by scene.aspect."""
    # Vertex at origin (0, 0); segment 1 along y-axis to (0, 1)
    # Segment 2 in square coords at (0.5, 0)
    # With aspect = 2.0, segment 2 vector is (0.5 * 2.0, 0) = (1.0, 0)
    # Vector (0, 1) and (1, 0) form exact 90° angle
    points = [
        Point(id="O", x=0.0, y=0.0, label="origin"),
        Point(id="Y", x=0.0, y=0.5, label="Y"),
        Point(id="X", x=0.25, y=0.0, label="X"),
    ]
    segments = [
        Segment(id="OY", a="O", b="Y"),
        Segment(id="OX", a="O", b="X"),
    ]
    scene = DiagramScene(kind="geometry", points=points, segments=segments, aspect=2.0)
    target, coords, label = _find_right_angle(scene)
    assert target is not None
    assert target.element_id == "O"


# ===========================================================================
# B2-06: Structural Limits Enforced in validate_scene
# ===========================================================================


def test_b2_06_validate_scene_enforces_points_limit() -> None:
    """validate_scene rejects scene with > 500 points."""
    huge_points = [{"id": f"p{i}", "x": 0.5, "y": 0.5} for i in range(501)]
    res = validate_scene({"kind": "geometry", "points": huge_points})
    assert res.scene is None
    assert any("scene has too many points" in err for err in res.errors)


def test_b2_06_validate_scene_enforces_segments_limit() -> None:
    """validate_scene rejects scene with > 1000 segments."""
    huge_segments = [{"id": f"s{i}", "a": "p1", "b": "p2"} for i in range(1001)]
    res = validate_scene({"kind": "geometry", "segments": huge_segments})
    assert res.scene is None
    assert any("scene has too many segments" in err for err in res.errors)


def test_b2_06_validate_scene_enforces_polylines_limit() -> None:
    """validate_scene rejects scene with > 50 polylines."""
    huge_polylines = [{"id": f"pl{i}", "points": [[0.1, 0.1], [0.9, 0.9]]} for i in range(51)]
    res = validate_scene({"kind": "geometry", "polylines": huge_polylines})
    assert res.scene is None
    assert any("scene has too many polylines" in err for err in res.errors)


def test_b2_06_validate_scene_enforces_polyline_points_limit() -> None:
    """validate_scene rejects polyline with > 1000 points."""
    huge_pts = [[0.1, 0.1]] * 1001
    res = validate_scene({"kind": "geometry", "polylines": [{"id": "pl1", "points": huge_pts}]})
    assert res.scene is None
    assert any("a polyline has more than 1000 points" in err for err in res.errors)


def test_b2_06_validate_scene_enforces_bars_limit() -> None:
    """validate_scene rejects scene with > 100 bars."""
    huge_bars = [
        {
            "id": f"b{i}",
            "x0": 0.1,
            "x1": 0.2,
            "y_top": 0.3,
            "y_base": 0.8,
            "label": "bar",
            "value": 1.0,
        }
        for i in range(101)
    ]
    res = validate_scene({"kind": "bar_chart", "bars": huge_bars})
    assert res.scene is None
    assert any("scene has too many bars" in err for err in res.errors)


def test_b2_06_validate_scene_enforces_facts_limit() -> None:
    """validate_scene rejects scene with > 100 facts."""
    huge_facts = [f"fact {i}" for i in range(101)]
    res = validate_scene({"kind": "geometry", "facts": huge_facts})
    assert res.scene is None
    assert any("scene has too many facts" in err for err in res.errors)


# ===========================================================================
# B2-13: Colour/Shape Words with Punctuation
# ===========================================================================


def test_b2_13_colour_shape_words_with_punctuation_rejected() -> None:
    """Labels consisting only of colour/shape words with trailing punctuation are rejected."""
    assert _is_colour_shape_only("blue polygon.") is True
    assert _is_colour_shape_only("red triangle,") is True
    assert _is_colour_shape_only("green circle!") is True
    assert _is_colour_shape_only("blue polygon") is True
    assert _is_colour_shape_only("triangle ABC") is False
    assert _is_colour_shape_only("hypotenuse") is False
