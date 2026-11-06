"""Property-based tests for Ask target validation (Lane g3-ask-target).

Hypothesis invariant:
For arbitrary dict/target junk, validate_ask_target returns either None,
or an ElementTarget referring to an existing element id in the scene,
or a PointTarget with finite (x, y) coordinates within [0, 1].
It never raises an exception.
"""

from __future__ import annotations

import math
from typing import Any

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from app.ask import (
    ElementTarget,
    PointTarget,
    extract_scene_element_ids,
    parse_model_ask_output,
    validate_ask_target,
)
from app.schema import DiagramScene, Point, Segment
from fixtures.triangle import triangle_scene


def json_scalars() -> st.SearchStrategy[Any]:
    """Scalar values including non-finite floats, booleans, and arbitrary strings."""
    return st.one_of(
        st.none(),
        st.booleans(),
        st.integers(),
        st.floats(allow_nan=True, allow_infinity=True),
        st.text(max_size=50),
    )


def arbitrary_target_junk() -> st.SearchStrategy[Any]:
    """Arbitrary recursive data structures (lists, dicts, primitives, mixed types)."""
    return st.recursive(
        json_scalars(),
        lambda children: st.one_of(
            st.lists(children, max_size=5),
            st.dictionaries(st.text(max_size=20), children, max_size=5),
        ),
        max_leaves=25,
    )


def target_like_dict() -> st.SearchStrategy[dict[str, Any]]:
    """Dicts with keys that mimic real or near-miss target payloads."""
    keys = st.sampled_from(["elementId", "x", "y", "kind", "id", "target", "answer", "extra"])
    return st.dictionaries(keys, json_scalars(), max_size=6)


@st.composite
def random_scene(draw: st.DrawFn) -> DiagramScene:
    """Generate a valid minimal DiagramScene with random element IDs."""
    n_points = draw(st.integers(min_value=1, max_value=4))
    points: list[Point] = []
    for i in range(n_points):
        pid = f"pt_{i}_{draw(st.integers(min_value=1, max_value=999))}"
        x = draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
        y = draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
        points.append(Point(id=pid, x=x, y=y, label=pid))

    segments: list[Segment] = []
    if n_points >= 2:
        seg_id = f"seg_{draw(st.integers(min_value=1, max_value=999))}"
        segments.append(Segment(id=seg_id, a=points[0].id, b=points[1].id, label=seg_id))

    return DiagramScene(kind="geometry", points=points, segments=segments, facts=[])


# ---------------------------------------------------------------------------
# Property 1: validate_ask_target with arbitrary junk on fixed triangle scene
# ---------------------------------------------------------------------------


@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(raw_target=st.one_of(arbitrary_target_junk(), target_like_dict()))
def test_prop_validate_ask_target_on_triangle(raw_target: Any) -> None:
    scene = triangle_scene()
    valid_ids = set(extract_scene_element_ids(scene))

    target = validate_ask_target(raw_target, scene)

    if target is None:
        assert True
    elif isinstance(target, ElementTarget):
        assert target.elementId in valid_ids
        assert len(target.elementId) > 0
    elif isinstance(target, PointTarget):
        assert math.isfinite(target.x)
        assert math.isfinite(target.y)
        assert 0.0 <= target.x <= 1.0
        assert 0.0 <= target.y <= 1.0
    else:
        pytest.fail(f"validate_ask_target returned unexpected type: {type(target)}")


# ---------------------------------------------------------------------------
# Property 2: validate_ask_target with arbitrary junk on randomized scenes
# ---------------------------------------------------------------------------


@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
@given(
    scene=random_scene(),
    raw_target=st.one_of(arbitrary_target_junk(), target_like_dict()),
)
def test_prop_validate_ask_target_on_random_scenes(scene: DiagramScene, raw_target: Any) -> None:
    valid_ids = set(extract_scene_element_ids(scene))

    target = validate_ask_target(raw_target, scene)

    if target is None:
        assert True
    elif isinstance(target, ElementTarget):
        assert target.elementId in valid_ids
    elif isinstance(target, PointTarget):
        assert math.isfinite(target.x)
        assert math.isfinite(target.y)
        assert 0.0 <= target.x <= 1.0
        assert 0.0 <= target.y <= 1.0
    else:
        pytest.fail(f"validate_ask_target returned unexpected type: {type(target)}")


# ---------------------------------------------------------------------------
# Property 3: parse_model_ask_output with arbitrary text never raises
# and pipeline always yields safe validated target
# ---------------------------------------------------------------------------


@settings(max_examples=150, suppress_health_check=[HealthCheck.too_slow])
@given(text=st.text(max_size=300))
def test_prop_parse_model_output_safe_pipeline(text: str) -> None:
    scene = triangle_scene()
    valid_ids = set(extract_scene_element_ids(scene))

    ans, raw_tgt = parse_model_ask_output(text)
    assert isinstance(ans, str)

    target = validate_ask_target(raw_tgt, scene)
    if target is not None:
        if isinstance(target, ElementTarget):
            assert target.elementId in valid_ids
        elif isinstance(target, PointTarget):
            assert 0.0 <= target.x <= 1.0
            assert 0.0 <= target.y <= 1.0
            assert math.isfinite(target.x) and math.isfinite(target.y)
        else:
            pytest.fail(f"Unexpected target type: {type(target)}")
