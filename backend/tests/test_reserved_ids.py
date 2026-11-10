"""Tests for reserved element ID validation and repair in backend/app/validate.py.

Lane a1-reserved-ids:
- Element IDs whose trimmed lower-case form is in RESERVED_ELEMENT_IDS must be
  renamed to el_<id> (made unique with suffix _2, _3 if taken).
- References to renamed points in segment endpoints (a, b) must be rewritten.
- Non-reserved IDs must remain untouched.
- All IDs must be unique in the output scene.
- Hypothesis property test runs 200+ examples verifying these invariants.
"""

from __future__ import annotations

import copy
from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.validate import RESERVED_ELEMENT_IDS, validate_scene


def test_reserved_point_id_renamed_and_segment_endpoints_rewritten() -> None:
    """Point 'title' is renamed to 'el_title' and referencing segments are updated."""
    scene_dict = {
        "version": 1,
        "kind": "geometry",
        "points": [
            {"id": "title", "x": 0.2, "y": 0.3, "label": "Top"},
            {"id": "B", "x": 0.8, "y": 0.9, "label": "Base"},
        ],
        "segments": [
            {"id": "S1", "a": "title", "b": "B", "label": "hypotenuse"},
        ],
    }

    result = validate_scene(scene_dict)
    assert result.scene is not None, f"Expected acceptance, got errors: {result.errors}"
    scene = result.scene

    pt_ids = [p.id for p in scene.points]
    assert "title" not in pt_ids
    assert "el_title" in pt_ids
    assert "B" in pt_ids

    assert len(scene.segments) == 1
    seg = scene.segments[0]
    assert seg.id == "S1"
    assert seg.a == "el_title"
    assert seg.b == "B"
    assert seg.label == "hypotenuse"


@pytest.mark.parametrize("reserved_id", sorted(RESERVED_ELEMENT_IDS))
def test_all_reserved_element_ids_renamed_across_all_kinds(reserved_id: str) -> None:
    """Each reserved ID is renamed across points, segments, polylines, and bars."""
    scene_dict = {
        "version": 1,
        "kind": "geometry",
        "points": [
            {"id": reserved_id, "x": 0.1, "y": 0.1},
            {"id": "P2", "x": 0.9, "y": 0.9},
        ],
        "segments": [
            {"id": f"seg_{reserved_id}", "a": reserved_id, "b": "P2"},
        ],
        "polylines": [
            {"id": f"poly_{reserved_id}", "points": [[0.1, 0.2], [0.3, 0.4]]},
        ],
        "bars": [
            {
                "id": f"bar_{reserved_id}",
                "label": "bar",
                "value": 5.0,
                "x0": 0.1,
                "x1": 0.2,
                "y_top": 0.3,
                "y_base": 0.8,
            },
        ],
    }

    result = validate_scene(scene_dict)
    assert result.scene is not None, f"Failed for {reserved_id}: {result.errors}"
    scene = result.scene

    all_ids = (
        [p.id for p in scene.points]
        + [s.id for s in scene.segments]
        + [pl.id for pl in scene.polylines]
        + [b.id for b in scene.bars]
    )
    for eid in all_ids:
        assert eid.strip().lower() not in RESERVED_ELEMENT_IDS
    assert f"el_{reserved_id}" in [p.id for p in scene.points]
    assert scene.segments[0].a == f"el_{reserved_id}"


def test_reserved_ids_case_insensitivity_and_whitespace() -> None:
    """Reserved IDs with arbitrary case and surrounding whitespace are sanitized and renamed."""
    scene_dict = {
        "version": 1,
        "kind": "geometry",
        "points": [
            {"id": "   TITLE   ", "x": 0.2, "y": 0.2},
            {"id": "  Constructor  ", "x": 0.5, "y": 0.5},
            {"id": "B", "x": 0.8, "y": 0.8},
        ],
        "segments": [
            {"id": "   __PROTO__   ", "a": "TITLE", "b": "Constructor"},
            {"id": "S2", "a": "  title  ", "b": "B"},
        ],
        "polylines": [
            {"id": "  Scene:Title  ", "points": [[0.1, 0.1], [0.2, 0.2]]},
        ],
        "bars": [
            {
                "id": "   TOSTRING   ",
                "label": "Data",
                "value": 10.0,
                "x0": 0.1,
                "x1": 0.3,
                "y_top": 0.2,
                "y_base": 0.9,
            },
        ],
    }

    result = validate_scene(scene_dict)
    assert result.scene is not None, f"Expected acceptance, got: {result.errors}"
    scene = result.scene

    all_ids = (
        [p.id for p in scene.points]
        + [s.id for s in scene.segments]
        + [pl.id for pl in scene.polylines]
        + [b.id for b in scene.bars]
    )
    for eid in all_ids:
        assert eid.strip().lower() not in RESERVED_ELEMENT_IDS
        assert eid == eid.strip()

    seg1 = next(s for s in scene.segments if s.b != "B")
    seg2 = next(s for s in scene.segments if s.b == "B")
    point_id_map = {p.id for p in scene.points}

    assert seg1.a in point_id_map
    assert seg1.b in point_id_map
    assert seg2.a in point_id_map
    assert seg2.b == "B"


def test_reserved_id_collision_uses_numeric_suffix() -> None:
    """If el_<id> is already taken, a numeric suffix _2, _3 is appended."""
    scene_dict = {
        "version": 1,
        "kind": "geometry",
        "points": [
            {"id": "el_title", "x": 0.1, "y": 0.1},
            {"id": "title", "x": 0.5, "y": 0.5},
        ],
        "segments": [
            {"id": "S1", "a": "title", "b": "el_title"},
        ],
    }

    result = validate_scene(scene_dict)
    assert result.scene is not None, f"Expected acceptance, got: {result.errors}"
    scene = result.scene

    pt_ids = {p.id for p in scene.points}
    assert pt_ids == {"el_title", "el_title_2"}

    seg = scene.segments[0]
    assert seg.a == "el_title_2"
    assert seg.b == "el_title"


def test_multiple_duplicate_reserved_ids_unique() -> None:
    """Two points with the same reserved ID get distinct unique non-reserved IDs."""
    scene_dict = {
        "version": 1,
        "kind": "geometry",
        "points": [
            {"id": "title", "x": 0.1, "y": 0.1},
            {"id": "title", "x": 0.9, "y": 0.9},
        ],
        "segments": [
            {"id": "S1", "a": "title", "b": "title"},
        ],
    }

    result = validate_scene(scene_dict)
    assert result.scene is not None, f"Expected acceptance, got: {result.errors}"
    scene = result.scene

    pt_ids = [p.id for p in scene.points]
    assert len(pt_ids) == 2
    assert len(set(pt_ids)) == 2
    for pid in pt_ids:
        assert pid.strip().lower() not in RESERVED_ELEMENT_IDS

    seg = scene.segments[0]
    assert seg.a in pt_ids
    assert seg.b in pt_ids


def test_dangling_segment_with_unmatched_reserved_endpoint_is_dropped() -> None:
    """A segment referencing a reserved ID with no matching point is dropped as dangling."""
    scene_dict = {
        "version": 1,
        "kind": "geometry",
        "points": [
            {"id": "A", "x": 0.1, "y": 0.1},
            {"id": "B", "x": 0.9, "y": 0.9},
        ],
        "segments": [
            {"id": "S1", "a": "A", "b": "B"},
            {"id": "S2", "a": "A", "b": "title"},  # point 'title' does not exist
        ],
    }

    result = validate_scene(scene_dict)
    assert result.scene is not None, f"Expected acceptance, got: {result.errors}"
    assert len(result.scene.segments) == 1
    assert result.scene.segments[0].id == "S1"


def test_dropped_reserved_point_used_by_segment_fails_f5() -> None:
    """If a point with reserved ID is dropped due to out-of-bounds coords, F5 rejects."""
    scene_dict = {
        "version": 1,
        "kind": "geometry",
        "points": [
            {"id": "title", "x": 2.5, "y": 0.1},  # out of bounds, will be dropped
            {"id": "B", "x": 0.5, "y": 0.5},
        ],
        "segments": [
            {"id": "S1", "a": "title", "b": "B"},
        ],
    }

    result = validate_scene(scene_dict)
    assert result.scene is None
    assert any("Validation dropped point 'title'" in err for err in result.errors)


# ---------------------------------------------------------------------------
# Hypothesis Property-Based Test (200+ examples)
# ---------------------------------------------------------------------------

reserved_list = sorted(RESERVED_ELEMENT_IDS)


@st.composite
def scenes_with_reserved_ids(draw: st.DrawFn) -> dict[str, Any]:
    """Generate scenes containing a mix of reserved and non-reserved IDs."""
    n_pts = draw(st.integers(min_value=2, max_value=8))
    point_defs: list[dict[str, Any]] = []

    for i in range(n_pts):
        use_reserved = draw(st.booleans())
        if use_reserved:
            base_name = draw(st.sampled_from(reserved_list))
            case_choice = draw(st.sampled_from(["lower", "upper", "title", "mixed"]))
            if case_choice == "upper":
                name = base_name.upper()
            elif case_choice == "title":
                name = base_name.capitalize()
            elif case_choice == "mixed":
                name = "".join(
                    c.upper() if idx % 2 == 0 else c.lower() for idx, c in enumerate(base_name)
                )
            else:
                name = base_name.lower()
            pad_left = " " * draw(st.integers(min_value=0, max_value=3))
            pad_right = " " * draw(st.integers(min_value=0, max_value=3))
            eid = f"{pad_left}{name}{pad_right}"
        else:
            eid = f"P_{i}_{draw(st.text(alphabet='ABCDEFGH', min_size=1, max_size=3))}"

        x = draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False))
        y = draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False))
        point_defs.append({"id": eid, "x": round(x, 4), "y": round(y, 4)})

    n_segs = draw(st.integers(min_value=1, max_value=6))
    seg_defs: list[dict[str, Any]] = []
    for j in range(n_segs):
        pt_a = draw(st.sampled_from(point_defs))
        pt_b = draw(st.sampled_from(point_defs))

        use_reserved_seg = draw(st.booleans())
        if use_reserved_seg:
            s_name = draw(st.sampled_from(reserved_list))
            sid = f" {s_name.upper()} " if draw(st.booleans()) else s_name
        else:
            sid = f"S_{j}"

        seg_defs.append({"id": sid, "a": pt_a["id"], "b": pt_b["id"]})

    return {
        "version": 1,
        "kind": "geometry",
        "points": point_defs,
        "segments": seg_defs,
    }


@settings(max_examples=250, deadline=None)
@given(scene_data=scenes_with_reserved_ids())
def test_hypothesis_reserved_ids_invariants(scene_data: dict[str, Any]) -> None:
    """Hypothesis test (200+ examples):
    - Reserved IDs in any letter case and with surrounding spaces never survive in the output.
    - Segments still connect the same (renamed) points.
    - Non-reserved IDs are untouched (unless deduplication was needed).
    - All IDs are unique afterwards.
    """
    input_copy = copy.deepcopy(scene_data)
    result = validate_scene(input_copy)
    assert result.scene is not None, f"Valid geometry scene was rejected: {result.errors}"
    scene = result.scene

    all_elements = list(scene.points) + list(scene.segments)
    all_ids = [el.id for el in all_elements]

    # Invariant 1: No reserved IDs survive (case-insensitive, trimmed)
    for eid in all_ids:
        assert eid.strip().lower() not in RESERVED_ELEMENT_IDS, (
            f"Reserved ID '{eid}' survived in output scene"
        )
        assert eid == eid.strip(), f"ID '{eid}' has surrounding whitespace"

    # Invariant 2: IDs are strictly unique
    assert len(all_ids) == len(set(all_ids)), f"Duplicate IDs in output: {all_ids}"

    # Invariant 3: Segments connect existing points
    pt_id_set = {p.id for p in scene.points}
    for seg in scene.segments:
        assert seg.a in pt_id_set, f"Segment '{seg.id}' endpoint a '{seg.a}' not in points"
        assert seg.b in pt_id_set, f"Segment '{seg.id}' endpoint b '{seg.b}' not in points"
