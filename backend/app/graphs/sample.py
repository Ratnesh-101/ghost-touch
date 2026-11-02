"""Turn a graph SPEC (equation + axis ranges + ticks) read by a vision model into a DiagramScene.

Why: asking a small, fast vision model to trace a curve point by point scores badly, but reading
the equation, the axis ranges and the tick marks is easy for it. We then sample the polyline
ourselves, exactly, in Python. The traced polyline from the normal extraction stays the fallback
when no equation is readable.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any

from app.graphs.expr import ExpressionError, evaluate, parse_expression
from app.graphs.facts import derived_facts

DEFAULT_SAMPLES = 100
MAX_SAMPLES = 400
MAX_ABS_VALUE = 1e6
MAX_TICKS = 24
JUMP_FRACTION = 0.6  # a step bigger than this share of the y range is an asymptote: break the curve
MIN_POINTS_PER_CURVE = 2


class GraphSpecError(ValueError):
    """The model's graph description is unusable (no equation, bad ranges, not a graph...)."""


@dataclass(frozen=True)
class GraphSpec:
    equation: str
    x_min: float
    x_max: float
    y_min: float
    y_max: float
    x_ticks: tuple[float, ...] = ()
    y_ticks: tuple[float, ...] = ()
    title: str | None = None


def _number(raw: dict[str, Any], key: str) -> float:
    value = raw.get(key)
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise GraphSpecError(f"{key} must be a number")
    number = float(value)
    if not math.isfinite(number) or abs(number) > MAX_ABS_VALUE:
        raise GraphSpecError(f"{key} is out of range")
    return number


def _ticks(raw: dict[str, Any], key: str) -> tuple[float, ...]:
    values = raw.get(key) or []
    if not isinstance(values, list):
        return ()
    cleaned = [
        float(v)
        for v in values[:MAX_TICKS]
        if isinstance(v, int | float) and not isinstance(v, bool) and math.isfinite(float(v))
    ]
    return tuple(cleaned)


def parse_graph_spec(raw: str | dict[str, Any]) -> GraphSpec:
    """Validate the model's JSON. Raises GraphSpecError (never evaluates anything unsafe)."""
    if isinstance(raw, str):
        text = raw.strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise GraphSpecError("not valid JSON") from exc
    else:
        data = raw
    if not isinstance(data, dict):
        raise GraphSpecError("expected a JSON object")

    equation = data.get("equation")
    if not isinstance(equation, str) or not equation.strip():
        raise GraphSpecError("no readable equation")
    try:
        parse_expression(equation)
    except ExpressionError as exc:
        raise GraphSpecError(f"unsupported equation: {exc}") from exc

    x_min, x_max = _number(data, "x_min"), _number(data, "x_max")
    y_min, y_max = _number(data, "y_min"), _number(data, "y_max")
    if x_max <= x_min or y_max <= y_min:
        raise GraphSpecError("axis ranges must have min < max")
    title = data.get("title")
    return GraphSpec(
        equation=equation.strip(),
        x_min=x_min,
        x_max=x_max,
        y_min=y_min,
        y_max=y_max,
        x_ticks=_ticks(data, "x_ticks"),
        y_ticks=_ticks(data, "y_ticks"),
        title=title.strip()[:120] if isinstance(title, str) and title.strip() else None,
    )


def sample_curves(spec: GraphSpec, samples: int = DEFAULT_SAMPLES) -> list[list[list[float]]]:
    """Sample y = f(x) over the x range into normalised [0,1] polylines (y = 0 at the top).

    The curve is split wherever f is undefined, leaves the visible y range, or jumps (asymptotes).
    """
    count = max(2, min(int(samples), MAX_SAMPLES))
    tree = parse_expression(spec.equation)
    x_span, y_span = spec.x_max - spec.x_min, spec.y_max - spec.y_min

    curves: list[list[list[float]]] = []
    current: list[list[float]] = []
    previous_ny: float | None = None
    for i in range(count):
        x = spec.x_min + x_span * i / (count - 1)
        y = evaluate(tree, x)
        ny = 1.0 - (y - spec.y_min) / y_span if math.isfinite(y) else math.nan
        visible = math.isfinite(ny) and 0.0 <= ny <= 1.0
        jumped = (
            previous_ny is not None and abs(ny - previous_ny) > JUMP_FRACTION if visible else False
        )
        if not visible or jumped:
            if len(current) >= MIN_POINTS_PER_CURVE:
                curves.append(current)
            current = []
        if visible:
            current.append([round((x - spec.x_min) / x_span, 6), round(ny, 6)])
            previous_ny = ny
        else:
            previous_ny = None
    if len(current) >= MIN_POINTS_PER_CURVE:
        curves.append(current)
    return curves


def _fmt(value: float) -> str:
    return f"{value:g}"


def build_graph_scene(spec: GraphSpec, samples: int = DEFAULT_SAMPLES) -> dict[str, Any]:
    """Build a DiagramScene dict (kind function_graph) from a validated GraphSpec."""
    curves = sample_curves(spec, samples)
    if not curves:
        raise GraphSpecError("the equation has no visible points inside the axis ranges")

    label = f"y = {spec.equation.split('=', 1)[-1].strip()}"
    polylines = [
        {"id": f"curve{i + 1}", "points": points, "label": label} for i, points in enumerate(curves)
    ]
    x_axis_y = 1.0 - (0.0 - spec.y_min) / (spec.y_max - spec.y_min)
    y_axis_x = (0.0 - spec.x_min) / (spec.x_max - spec.x_min)
    axes = {
        "x_axis_y": round(x_axis_y, 6) if 0.0 <= x_axis_y <= 1.0 else None,
        "y_axis_x": round(y_axis_x, 6) if 0.0 <= y_axis_x <= 1.0 else None,
    }
    facts = [
        label,
        f"The x axis runs from {_fmt(spec.x_min)} to {_fmt(spec.x_max)}.",
        f"The y axis runs from {_fmt(spec.y_min)} to {_fmt(spec.y_max)}.",
    ]
    facts.extend(derived_facts(spec))
    if spec.x_ticks:
        facts.append("x tick marks at " + ", ".join(_fmt(t) for t in spec.x_ticks) + ".")
    if spec.y_ticks:
        facts.append("y tick marks at " + ", ".join(_fmt(t) for t in spec.y_ticks) + ".")
    return {
        "version": 1,
        "kind": "function_graph",
        "title": spec.title or label,
        "points": [],
        "segments": [],
        "polylines": polylines,
        "bars": [],
        "axes": axes,
        "facts": facts,
    }
