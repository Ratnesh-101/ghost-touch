"""Facts about a function graph, computed exactly from its equation.

These are the things a student asks about a graph ("where does it cross the x-axis?", "what is
the highest point?", "what is the slope?"). Computing them from the equation is exact; asking a
vision model to read them off a picture is not. All numbers are found numerically on a dense
grid and refined, so any supported expression works, not only textbook shapes.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

from app.graphs.expr import Node, evaluate, parse_expression

if TYPE_CHECKING:
    from app.graphs.sample import GraphSpec

DENSE_POINTS = 2001
REFINE_STEPS = 60
MAX_ZEROS = 6
MAX_EXTREMA = 4
LINEAR_TOLERANCE = 1e-9
DECIMALS = 2


def _num(value: float) -> str:
    rounded = round(value, DECIMALS)
    return f"{(0.0 if rounded == 0 else rounded):g}"


def _grid(spec: GraphSpec, tree: Node) -> tuple[list[float], list[float]]:
    step = (spec.x_max - spec.x_min) / (DENSE_POINTS - 1)
    xs = [spec.x_min + i * step for i in range(DENSE_POINTS)]
    return xs, [evaluate(tree, x) for x in xs]


def _bisect_zero(tree: Node, left: float, right: float) -> float:
    f_left = evaluate(tree, left)
    for _ in range(REFINE_STEPS):
        mid = (left + right) / 2
        f_mid = evaluate(tree, mid)
        if not math.isfinite(f_mid):
            break
        if (f_left < 0) == (f_mid < 0):
            left, f_left = mid, f_mid
        else:
            right = mid
    return (left + right) / 2


def _zeros(spec: GraphSpec, tree: Node, xs: list[float], ys: list[float]) -> list[float]:
    if not spec.y_min <= 0.0 <= spec.y_max:
        return []
    y_span = spec.y_max - spec.y_min
    zero_tolerance = LINEAR_TOLERANCE * max(1.0, y_span)
    found: list[float] = []
    for i in range(len(xs) - 1):
        y0, y1 = ys[i], ys[i + 1]
        if not (math.isfinite(y0) and math.isfinite(y1)):
            continue
        if abs(y0) <= zero_tolerance:
            found.append(xs[i])
        elif y0 * y1 < 0 and abs(y1 - y0) < y_span:  # a bigger jump is an asymptote, not a zero
            found.append(_bisect_zero(tree, xs[i], xs[i + 1]))
    if math.isfinite(ys[-1]) and abs(ys[-1]) <= zero_tolerance:
        found.append(xs[-1])
    unique: list[float] = []
    for x in found:
        if not any(abs(round(x, DECIMALS) - round(u, DECIMALS)) < 1e-9 for u in unique):
            unique.append(x)
    return unique[:MAX_ZEROS]


def _refine_extremum(tree: Node, left: float, right: float, is_max: bool) -> tuple[float, float]:
    sign = 1.0 if is_max else -1.0
    for _ in range(REFINE_STEPS):
        m1, m2 = left + (right - left) / 3, right - (right - left) / 3
        if sign * evaluate(tree, m1) < sign * evaluate(tree, m2):
            left = m1
        else:
            right = m2
    x = (left + right) / 2
    return x, evaluate(tree, x)


def _extrema(
    spec: GraphSpec, tree: Node, xs: list[float], ys: list[float]
) -> list[tuple[float, float, bool]]:
    """Interior turning points as (x, y, is_max), left to right, inside the visible y range."""
    noise = LINEAR_TOLERANCE * max(1.0, spec.y_max - spec.y_min)
    points: list[tuple[float, float, bool]] = []
    for i in range(1, len(xs) - 1):
        a, b, c = ys[i - 1], ys[i], ys[i + 1]
        if not all(math.isfinite(v) for v in (a, b, c)):
            continue
        is_max = b - a > noise and b >= c
        is_min = a - b > noise and b <= c
        if not (is_max or is_min):
            continue
        x, y = _refine_extremum(tree, xs[i - 1], xs[i + 1], is_max)
        if math.isfinite(y) and spec.y_min <= y <= spec.y_max:
            points.append((x, y, is_max))
    return points[:MAX_EXTREMA]


def _linear_slope(xs: list[float], ys: list[float]) -> float | None:
    """The slope if every sample lies on one straight line, else None."""
    if not all(math.isfinite(y) for y in ys):
        return None
    slope = (ys[-1] - ys[0]) / (xs[-1] - xs[0])
    scale = max(1.0, max(abs(y) for y in ys))
    for x, y in zip(xs, ys, strict=True):
        if abs(ys[0] + slope * (x - xs[0]) - y) > LINEAR_TOLERANCE * scale:
            return None
    return slope


def _is_quadratic(ys: list[float]) -> bool:
    """True when the samples are a parabola (constant second differences on the uniform grid)."""
    if not all(math.isfinite(y) for y in ys):
        return False
    second = [ys[i + 1] - 2 * ys[i] + ys[i - 1] for i in range(1, len(ys) - 1)]
    mean = sum(second) / len(second)
    return abs(mean) > 0 and max(second) - min(second) <= 1e-6 * max(1.0, abs(mean))


def derived_facts(spec: GraphSpec) -> list[str]:
    """Short sentences about the curve: slope, intercepts, axis crossings, extremes, vertex."""
    tree = parse_expression(spec.equation)
    xs, ys = _grid(spec, tree)
    facts: list[str] = []

    slope = _linear_slope(xs, ys)
    if slope is not None:
        facts.append(f"slope {_num(slope)}")

    if spec.x_min <= 0.0 <= spec.x_max:
        at_zero = evaluate(tree, 0.0)
        if math.isfinite(at_zero) and spec.y_min <= at_zero <= spec.y_max:
            facts.append(f"y-intercept {_num(at_zero)}")

    zeros = _zeros(spec, tree, xs, ys)
    if zeros:
        facts.append("crosses the x-axis at " + ", ".join(_num(x) for x in zeros))

    extrema = [] if slope is not None else _extrema(spec, tree, xs, ys)
    if len(extrema) == 1 and _is_quadratic(ys):
        x, y, is_max = extrema[0]
        facts.append(f"vertex at ({_num(x)}, {_num(y)})")
        facts.append("opens downward" if is_max else "opens upward")
    else:
        for x, y, is_max in extrema:
            kind = "maximum" if is_max else "minimum"
            facts.append(f"{kind} value {_num(y)} near x = {_num(x)}")
    return facts
