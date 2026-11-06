"""Property-based tests for semantic targets using Hypothesis (Lane g5).

Invariants verified:
1. For random polylines: peak target y <= every vertex y across all polylines.
2. For random polylines: lowest point (trough) target y >= every vertex y across all polylines.
3. For random bars: tallest bar target value >= every other bar's value, and shortest bar value <= every other bar.
4. The target returned by semantic_target always passes validate_ask_target.
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from app.ask import ElementTarget, PointTarget, semantic_target, validate_ask_target
from app.schema import Bar, DiagramScene, Polyline
from app.semantic import SemanticResult
from app.semantic import semantic_target as pure_semantic_target

# Strategy for normalized coordinates [0.0, 1.0]
st_norm_float = st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)

# Strategy for a single (x, y) vertex in a polyline
st_vertex = st.tuples(st_norm_float, st_norm_float).map(list)

# Strategy for a polyline with 1 to 30 vertices
st_polyline_points = st.lists(st_vertex, min_size=1, max_size=30)


@st.composite
def random_polylines_scene(draw) -> DiagramScene:
    """Generate a DiagramScene with 1 to 5 polylines having valid vertices."""
    num_polys = draw(st.integers(min_value=1, max_value=5))
    polylines: list[Polyline] = []
    for i in range(num_polys):
        pts = draw(st_polyline_points)
        polylines.append(Polyline(id=f"poly_{i}", points=pts))
    return DiagramScene(kind="function_graph", polylines=polylines)


@st.composite
def random_barchart_scene(draw) -> DiagramScene:
    """Generate a DiagramScene with 1 to 10 bars having distinct ids."""
    num_bars = draw(st.integers(min_value=1, max_value=10))
    bars: list[Bar] = []
    for i in range(num_bars):
        x0 = draw(st.floats(min_value=0.0, max_value=0.45, allow_nan=False, allow_infinity=False))
        x1 = draw(st.floats(min_value=0.5, max_value=1.0, allow_nan=False, allow_infinity=False))
        val = draw(
            st.floats(min_value=-1000.0, max_value=1000.0, allow_nan=False, allow_infinity=False)
        )
        bars.append(
            Bar(
                id=f"bar_{i}",
                x0=x0,
                x1=x1,
                y_top=0.2,
                y_base=0.8,
                label=f"B{i}",
                value=val,
            )
        )
    return DiagramScene(kind="bar_chart", bars=bars)


# ---------------------------------------------------------------------------
# Property 1: Peak target y <= every vertex y across all polylines
# ---------------------------------------------------------------------------


@given(scene=random_polylines_scene())
@settings(max_examples=50)
def test_prop_peak_y_le_every_vertex(scene: DiagramScene) -> None:
    # Pure SemanticResult invariant
    pure_res = pure_semantic_target(scene, "where is the peak?", "en")
    assert pure_res is not None
    assert isinstance(pure_res, SemanticResult)
    assert pure_res.target_kind == "point"
    assert pure_res.y is not None
    for poly in scene.polylines:
        for pt in poly.points:
            assert pure_res.y <= pt[1]

    # Converted AskTarget
    target = semantic_target(scene, "where is the peak?", "en")
    assert target is not None
    assert isinstance(target, PointTarget)

    # Invariant: peak target y <= every vertex y
    for poly in scene.polylines:
        for pt in poly.points:
            assert target.y <= pt[1]

    # Target always validates against scene
    validated = validate_ask_target(target, scene)
    assert validated is not None
    assert validated == target


# ---------------------------------------------------------------------------
# Property 2: Trough target y >= every vertex y across all polylines
# ---------------------------------------------------------------------------


@given(scene=random_polylines_scene())
@settings(max_examples=50)
def test_prop_trough_y_ge_every_vertex(scene: DiagramScene) -> None:
    # Pure SemanticResult invariant
    pure_res = pure_semantic_target(scene, "where is the lowest point?", "en")
    assert pure_res is not None
    assert isinstance(pure_res, SemanticResult)
    assert pure_res.target_kind == "point"
    assert pure_res.y is not None
    for poly in scene.polylines:
        for pt in poly.points:
            assert pure_res.y >= pt[1]

    # Converted AskTarget
    target = semantic_target(scene, "where is the lowest point?", "en")
    assert target is not None
    assert isinstance(target, PointTarget)

    # Invariant: trough target y >= every vertex y
    for poly in scene.polylines:
        for pt in poly.points:
            assert target.y >= pt[1]

    # Target always validates against scene
    validated = validate_ask_target(target, scene)
    assert validated is not None
    assert validated == target


# ---------------------------------------------------------------------------
# Property 3: Tallest and shortest bars match max and min values
# ---------------------------------------------------------------------------


@given(scene=random_barchart_scene())
@settings(max_examples=50)
def test_prop_tallest_and_shortest_bars(scene: DiagramScene) -> None:
    bar_map = {b.id: b.value for b in scene.bars}
    max_val = max(b.value for b in scene.bars)
    min_val = min(b.value for b in scene.bars)

    # Pure SemanticResult
    pure_tall = pure_semantic_target(scene, "which is the tallest bar?", "en")
    assert pure_tall is not None
    assert isinstance(pure_tall, SemanticResult)
    assert pure_tall.target_kind == "element"
    assert bar_map[pure_tall.element_id] == max_val

    # Tallest bar
    t_tall = semantic_target(scene, "which is the tallest bar?", "en")
    assert t_tall is not None
    assert isinstance(t_tall, ElementTarget)
    assert bar_map[t_tall.elementId] == max_val
    assert validate_ask_target(t_tall, scene) is not None

    # Pure SemanticResult
    pure_short = pure_semantic_target(scene, "which is the shortest bar?", "en")
    assert pure_short is not None
    assert isinstance(pure_short, SemanticResult)
    assert pure_short.target_kind == "element"
    assert bar_map[pure_short.element_id] == min_val

    # Shortest bar
    t_short = semantic_target(scene, "which is the shortest bar?", "en")
    assert t_short is not None
    assert isinstance(t_short, ElementTarget)
    assert bar_map[t_short.elementId] == min_val
    assert validate_ask_target(t_short, scene) is not None
