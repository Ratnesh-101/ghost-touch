"""Equation route for function graphs: safe parser, sampler, spec validation, pipeline hooks."""

from __future__ import annotations

import io
import json
import math

import pytest
from fastapi.testclient import TestClient
from hypothesis import given, settings
from hypothesis import strategies as st

from app.graphs.expr import ExpressionError, evaluate, parse_expression
from app.graphs.sample import (
    GraphSpec,
    GraphSpecError,
    build_graph_scene,
    parse_graph_spec,
    sample_curves,
)
from app.main import app, get_provider_chain
from app.schema import DiagramScene
from app.vision.chain import ProviderChain
from fixtures.sine import sine_scene
from tests.test_scene_pipeline import VALID_SCENE_JSON, FakeProvider, make_test_image_bytes


def value(text: str, x: float = 0.0) -> float:
    return evaluate(parse_expression(text), x)


# --- parser: correct maths ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "x", "expected"),
    [
        ("x", 3.0, 3.0),
        ("y = 2x^2 - 3", 2.0, 5.0),
        ("f(x) = sin(x)", math.pi / 2, 1.0),
        ("2sin(3x)", math.pi / 6, 2.0),
        ("e^(-x)", 0.0, 1.0),
        ("-x^2", 3.0, -9.0),
        ("2^3^2", 0.0, 512.0),
        ("3(x+1)", 1.0, 6.0),
        ("x sin(x)", math.pi / 2, math.pi / 2),
        ("sqrt(x)", 9.0, 3.0),
        ("abs(x - 5)", 2.0, 3.0),
        ("ln(e)", 0.0, 1.0),
        ("x²", 4.0, 16.0),
        ("2×x", 4.0, 8.0),
        ("pi", 0.0, math.pi),
        ("1/x", 4.0, 0.25),
        ("x ** 2", 3.0, 9.0),
    ],
)
def test_expression_values(text: str, x: float, expected: float) -> None:
    assert value(text, x) == pytest.approx(expected)


def test_undefined_points_are_nan_not_errors() -> None:
    assert math.isnan(value("1/x", 0.0))
    assert math.isnan(value("ln(x)", -1.0))
    assert math.isnan(value("sqrt(x)", -4.0))
    assert math.isnan(value("(-8)^0.5", 0.0))
    assert math.isnan(value("exp(1000*x)", 10.0))


# --- parser: hostile input ----------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "__import__('os').system('echo hi')",
        "x.__class__",
        "open('f')",
        "eval(x)",
        "exec(x)",
        "lambda: 1",
        "x; y",
        "x[0]",
        "{x: 1}",
        "a + 1",
        "sin x",
        "sin",
        "((",
        "x +",
        "",
        "   ",
        "1e999999",
        "x" * 500,
        "(" * 60 + "x" + ")" * 60,
        "x+" * 150 + "x",
    ],
)
def test_hostile_or_malformed_input_is_rejected(text: str) -> None:
    with pytest.raises(ExpressionError):
        parse_expression(text)


def test_huge_exponents_cannot_hang_or_blow_up() -> None:
    assert math.isnan(value("x^999999", 2.0))
    assert math.isnan(value("9^9^9", 0.0))


@settings(max_examples=300, deadline=None)
@given(st.text(max_size=300))
def test_any_text_either_parses_or_raises_expression_error(text: str) -> None:
    try:
        tree = parse_expression(text)
    except ExpressionError:
        return
    result = evaluate(tree, 1.5)
    assert isinstance(result, float)


# --- spec validation ----------------------------------------------------------------------


GOOD_SPEC = {
    "equation": "sin(x)",
    "x_min": 0,
    "x_max": 6.2832,
    "y_min": -1.2,
    "y_max": 1.2,
    "x_ticks": [0, 3.14, 6.28],
    "y_ticks": [-1, 0, 1],
    "title": "Sine wave",
}


def test_good_spec_is_accepted() -> None:
    spec = parse_graph_spec(json.dumps(GOOD_SPEC))
    assert spec.equation == "sin(x)"
    assert spec.x_ticks == (0.0, 3.14, 6.28)
    assert spec.title == "Sine wave"


@pytest.mark.parametrize(
    "patch",
    [
        {"equation": None},
        {"equation": ""},
        {"equation": "open('x')"},
        {"x_min": 5, "x_max": 5},
        {"y_min": 3, "y_max": -3},
        {"x_max": "wide"},
        {"x_max": True},
        {"y_max": 1e12},
        {"x_min": float("inf")},
    ],
)
def test_bad_specs_are_rejected(patch: dict[str, object]) -> None:
    with pytest.raises(GraphSpecError):
        parse_graph_spec({**GOOD_SPEC, **patch})


def test_non_json_and_non_objects_are_rejected() -> None:
    with pytest.raises(GraphSpecError):
        parse_graph_spec("the graph shows a wave")
    with pytest.raises(GraphSpecError):
        parse_graph_spec("[1, 2, 3]")


# --- sampling -----------------------------------------------------------------------------


def test_sine_samples_100_points_inside_the_unit_square() -> None:
    spec = parse_graph_spec(GOOD_SPEC)
    (curve,) = sample_curves(spec)

    assert len(curve) == 100
    assert all(0.0 <= px <= 1.0 and 0.0 <= py <= 1.0 for px, py in curve)
    assert curve[0][0] == 0.0 and curve[-1][0] == 1.0
    # y = 0 is the top: the first quarter rises (sin goes up), so ny falls below the midline.
    assert min(py for _, py in curve) < 0.5 < max(py for _, py in curve)


def test_sine_peak_is_where_sine_peaks() -> None:
    (curve,) = sample_curves(parse_graph_spec(GOOD_SPEC))
    top = min(curve, key=lambda p: p[1])  # smallest ny = highest value
    assert top[0] == pytest.approx(0.25, abs=0.02)


def test_sampled_sine_matches_the_analytic_curve() -> None:
    """ny = 0.5 - 0.3 sin(x) when the y range is +-1/0.6 (the repo's fixture normalisation)."""
    spec = GraphSpec("sin(x)", 0.0, 2 * math.pi, -1 / 0.6, 1 / 0.6)
    (curve,) = sample_curves(spec, samples=100)
    for px, py in curve:
        assert py == pytest.approx(0.5 - 0.3 * math.sin(px * 2 * math.pi), abs=1e-4)


def test_parabola_and_line_stay_in_range() -> None:
    parabola = GraphSpec("x^2", -2, 2, -1, 5)
    line = GraphSpec("2x + 1", -3, 3, -6, 8)
    for spec in (parabola, line):
        curves = sample_curves(spec)
        assert curves
        assert all(0 <= p <= 1 for curve in curves for point in curve for p in point)


def test_asymptote_splits_the_curve_into_branches() -> None:
    curves = sample_curves(GraphSpec("1/x", -4, 4, -4, 4))
    assert len(curves) == 2
    assert all(len(c) >= 2 for c in curves)


def test_curve_leaving_the_window_is_clipped() -> None:
    curves = sample_curves(GraphSpec("x^3", -3, 3, -2, 2))
    assert curves
    assert all(0 <= p <= 1 for curve in curves for point in curve for p in point)


def test_sample_count_is_capped() -> None:
    (curve,) = sample_curves(GraphSpec("x", 0, 1, 0, 1), samples=10_000)
    assert len(curve) <= 400


def test_no_visible_points_is_an_error() -> None:
    with pytest.raises(GraphSpecError):
        build_graph_scene(GraphSpec("x + 100", 0, 1, 0, 1))


def test_built_scene_is_a_valid_diagram_scene_with_axes_and_facts() -> None:
    scene = build_graph_scene(parse_graph_spec(GOOD_SPEC))
    model = DiagramScene.model_validate(scene)

    assert model.kind == "function_graph"
    assert model.axes is not None
    assert model.axes.x_axis_y == pytest.approx(0.5)  # y = 0 is the middle of -1.2..1.2
    assert model.axes.y_axis_x == pytest.approx(0.0)  # x = 0 is the left edge
    joined = " ".join(model.facts)
    assert "y = sin(x)" in joined and "x tick marks at 0, 3.14, 6.28" in joined


def test_axis_outside_the_window_is_omitted() -> None:
    scene = build_graph_scene(GraphSpec("x", 1, 5, 1, 5))
    assert scene["axes"] == {"x_axis_y": None, "y_axis_x": None}


# --- pipeline hooks -----------------------------------------------------------------------


def _post(client: TestClient, seed: int = 100):  # type: ignore[no-untyped-def]
    image = make_test_image_bytes(seed, 100)
    return client.post("/api/v1/scene", files={"image": ("a.png", io.BytesIO(image), "image/png")})


@pytest.fixture(autouse=True)
def _clean_overrides():  # type: ignore[no-untyped-def]
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_traced_function_graph_is_upgraded_to_the_sampled_curve() -> None:
    traced = sine_scene().model_dump_json()
    provider = FakeProvider("gemini", [traced, json.dumps(GOOD_SPEC)])
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([provider])

    response = _post(TestClient(app))
    data = response.json()

    assert data["mode"] == "ai"
    assert provider.call_count == 2  # trace, then the equation spec
    assert len(data["scene"]["polylines"][0]["points"]) == 100
    assert "y = sin(x)" in data["scene"]["facts"]


def test_unreadable_equation_keeps_the_traced_polyline() -> None:
    traced = sine_scene()
    provider = FakeProvider("gemini", [traced.model_dump_json(), '{"equation": null}'])
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([provider])

    data = _post(TestClient(app)).json()

    assert data["mode"] == "ai"
    assert data["scene"]["polylines"][0]["points"] == [list(p) for p in traced.polylines[0].points]


def test_non_graph_scenes_never_trigger_the_equation_route() -> None:
    provider = FakeProvider("gemini", [VALID_SCENE_JSON])
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([provider])

    data = _post(TestClient(app)).json()

    assert data["mode"] == "ai"
    assert provider.call_count == 1


def test_equation_rescue_before_raw_mode_when_tracing_is_invalid() -> None:
    bad = '{"version": 1, "kind": "function_graph", "polylines": "bad"}'
    provider = FakeProvider("gemini", [bad, bad, json.dumps(GOOD_SPEC)])
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([provider])

    data = _post(TestClient(app)).json()

    assert data["mode"] == "ai"
    assert data["scene"]["kind"] == "function_graph"
    assert provider.call_count == 3


def test_hostile_equation_from_the_model_falls_back_safely() -> None:
    evil = dict(GOOD_SPEC, equation="__import__('os').system('echo pwned')")
    provider = FakeProvider("gemini", [sine_scene().model_dump_json(), json.dumps(evil)])
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([provider])

    data = _post(TestClient(app)).json()

    assert data["mode"] == "ai"  # the traced polyline is kept
    assert len(data["scene"]["polylines"][0]["points"]) == len(sine_scene().polylines[0].points)


# --- facts computed from the equation -----------------------------------------------------


def facts_for(equation: str, x: tuple[float, float], y: tuple[float, float]) -> list[str]:
    from app.graphs.facts import derived_facts

    return derived_facts(GraphSpec(equation, x[0], x[1], y[0], y[1]))


def test_sine_facts_match_the_textbook_answers() -> None:
    facts = facts_for("sin(x)", (0, 2 * math.pi), (-1.2, 1.2))
    assert "maximum value 1 near x = 1.57" in facts
    assert "minimum value -1 near x = 4.71" in facts
    assert "crosses the x-axis at 0, 3.14, 6.28" in facts
    assert "y-intercept 0" in facts


def test_parabola_facts() -> None:
    facts = facts_for("x^2 - 4", (-3, 3), (-5, 6))
    assert "vertex at (0, -4)" in facts
    assert "opens upward" in facts
    assert "crosses the x-axis at -2, 2" in facts
    assert "y-intercept -4" in facts


def test_downward_parabola_opens_downward() -> None:
    facts = facts_for("-x^2 + 1", (-3, 3), (-8, 3))
    assert "vertex at (0, 1)" in facts and "opens downward" in facts


def test_line_facts() -> None:
    facts = facts_for("2x + 1", (-3, 3), (-6, 8))
    assert "slope 2" in facts
    assert "y-intercept 1" in facts
    assert "crosses the x-axis at -0.5" in facts
    assert not any("vertex" in f or "maximum" in f for f in facts)


def test_negative_slope_line() -> None:
    assert "slope -0.5" in facts_for("-0.5x + 2", (-2, 6), (-2, 4))


def test_asymptote_sign_flips_are_not_reported_as_zeros() -> None:
    facts = facts_for("tan(x)", (-4, 4), (-5, 5))
    crossing = next(f for f in facts if f.startswith("crosses the x-axis at"))
    assert "1.57" not in crossing and "-1.57" not in crossing
    assert "0" in crossing and "3.14" in crossing


def test_cosine_peaks_at_zero() -> None:
    facts = facts_for("cos(x)", (-math.pi, math.pi), (-1.2, 1.2))
    assert "maximum value 1 near x = 0" in facts
    assert "y-intercept 1" in facts


def test_reciprocal_has_no_zeros_or_turning_points() -> None:
    facts = facts_for("1/x", (-4, 4), (-4, 4))
    assert not any(f.startswith(("crosses", "vertex", "maximum", "minimum")) for f in facts)


def test_extremum_outside_the_visible_range_is_not_reported() -> None:
    facts = facts_for("x^2", (-3, 3), (0, 4))  # the curve leaves the window; vertex at 0 is visible
    assert "vertex at (0, 0)" in facts
    hidden = facts_for("x^2 + 10", (-3, 3), (0, 4))
    assert not any(f.startswith("vertex") for f in hidden)


def test_scene_facts_include_the_derived_ones() -> None:
    scene = build_graph_scene(parse_graph_spec(GOOD_SPEC))
    assert "crosses the x-axis at 0, 3.14, 6.28" in scene["facts"]
