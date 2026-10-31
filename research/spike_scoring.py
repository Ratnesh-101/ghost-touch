"""Pure scoring of a predicted DiagramScene against ground truth (vision spike).

No network and no file I/O: ``vision_spike.py`` does the calling and reporting,
this module only compares two scene dicts. Keeping it pure makes it unit
testable (see ``tests/test_spike_scoring.py``) and lets ``--rescore`` re-grade
saved predictions without spending API quota.

Ground-truth coordinates are normalised to the diagram's own box, so the
README's rule applies: labels, shapes and counts are compared exactly,
positions loosely (see the ``*_TOLERANCE`` constants).

All inputs are untrusted LLM output, so every accessor tolerates missing keys
and wrong types instead of raising.
"""

from __future__ import annotations

import re
from bisect import bisect_left
from collections.abc import Callable
from dataclasses import dataclass
from difflib import SequenceMatcher
from math import hypot
from statistics import fmean
from typing import Any

Scene = dict[str, Any]
Metrics = dict[str, float | None]
Curve = list[tuple[float, float]]

# --- tolerances (normalised units; 0.15 = 15% of the diagram's box) ---------
CORNER_TOLERANCE = 0.15
CURVE_TOLERANCE = 0.10
AXIS_TOLERANCE = 0.10
VALUE_REL_TOLERANCE = 0.01
FACT_SIMILARITY = 0.85
CURVE_POINTS_MIN = 40  # CLAUDE.md Task 8 prompt: "40-150 points"
CURVE_POINTS_MAX = 150

# Words dropped when comparing labels, so "vertex B" == "B" == "Point B".
LABEL_STOPWORDS = frozenset({"point", "vertex", "corner"})

# A label made only of these words describes appearance, not a teacher term.
APPEARANCE_WORDS = frozenset(
    {
        "red", "blue", "green", "yellow", "black", "white", "orange", "purple",
        "pink", "brown", "grey", "gray", "dotted", "dashed", "solid", "thick",
        "thin", "polygon", "shape", "line", "curve", "circle", "square",
        "triangle", "rectangle", "oval", "blob", "thing", "figure", "box",
    }
)  # fmt: skip

# Composite weights per ground-truth kind. A metric that is None (not
# applicable, e.g. no ground-truth facts) is dropped and the rest renormalised.
WEIGHTS: dict[str, dict[str, float]] = {
    "geometry": {
        "kind": 0.15, "schema_valid": 0.10, "point_f1": 0.25,
        "segment_f1": 0.25, "corner_accuracy": 0.15, "facts_recall": 0.10,
    },
    "function_graph": {
        "kind": 0.15, "schema_valid": 0.10, "curve_score": 0.45,
        "axes_accuracy": 0.15, "point_range_ok": 0.05, "facts_recall": 0.10,
    },
    "bar_chart": {
        "kind": 0.15, "schema_valid": 0.10, "bar_label_f1": 0.25,
        "value_accuracy": 0.30, "height_concordance": 0.10, "facts_recall": 0.10,
    },
}  # fmt: skip
DEFAULT_WEIGHTS = {"kind": 1.0}


@dataclass(frozen=True)
class SceneScore:
    """All metrics for one sample plus the weighted 0..1 composite."""

    metrics: Metrics
    composite: float


# ---------------------------------------------------------------------------
# Tolerant accessors
# ---------------------------------------------------------------------------


def _items(scene: Scene, key: str) -> list[dict[str, Any]]:
    value = scene.get(key)
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _num(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value)


def label_key(label: Any) -> str:
    """Normalise a label for comparison: lowercase, no 'point'/'vertex' words."""
    tokens = re.findall(r"[a-z0-9°²]+", str(label or "").lower())
    return " ".join(t for t in tokens if t not in LABEL_STOPWORDS)


def f1_score(pred: set[Any], truth: set[Any]) -> float:
    """Set F1; two empty sets count as a perfect match."""
    if not pred and not truth:
        return 1.0
    hits = len(pred & truth)
    if hits == 0:
        return 0.0
    precision, recall = hits / len(pred), hits / len(truth)
    return 2 * precision * recall / (precision + recall)


def is_appearance_label(label: str) -> bool:
    """True for labels like "blue polygon" that only describe how things look."""
    tokens = re.findall(r"[a-z]+", label.lower())
    return bool(tokens) and all(token in APPEARANCE_WORDS for token in tokens)


def appearance_label_rate(scene: Scene) -> float | None:
    """Fraction of point/segment/polyline labels that are appearance-only."""
    labels = [
        label
        for key in ("points", "segments", "polylines")
        for item in _items(scene, key)
        if isinstance(label := item.get("label"), str) and label.strip()
    ]
    if not labels:
        return None
    return sum(is_appearance_label(label) for label in labels) / len(labels)


# ---------------------------------------------------------------------------
# Facts
# ---------------------------------------------------------------------------


def _fact_key(fact: str) -> str:
    text = fact.lower()
    text = re.sub(r"\bdegrees?\b|\bdeg\b", "°", text)
    text = re.sub(r"\bcentimet(?:re|er)s?\b", "cm", text)
    return re.sub(r"[\s_]+", "", text)


# Filler words that do not change what a fact says ("Length of PQ is 8 cm" = "PQ = 8 cm").
_FACT_FILLER = frozenset(
    {"is", "are", "the", "of", "a", "an", "at", "to", "and", "in", "on", "for", "has", "have",
     "this", "that", "with", "by", "as", "its", "it", "be", "length", "value", "shows",
     "represents", "graph", "chart"}
)  # fmt: skip
_NUMBER = re.compile(r"^\d+(?:\.\d+)?°?$")
CONTAINMENT_THRESHOLD = 0.75


def _fact_tokens(fact: str) -> set[str]:
    """Content words and numbers of a fact, lowercased, filler dropped, plurals folded."""
    text = fact.lower()
    text = re.sub(r"\bdegrees?\b|\bdeg\b", "°", text)
    text = re.sub(r"\bcentimet(?:re|er)s?\b", "cm", text)
    text = re.sub(r"(\d)\s+°", r"\1°", text)
    tokens = set()
    for raw in re.findall(r"[a-z0-9°²]+(?:\.\d+)?", text):
        if raw in _FACT_FILLER:
            continue
        tokens.add(raw[:-1] if len(raw) > 3 and raw.endswith("s") and not _NUMBER.match(raw) else raw)
    return tokens


def fact_matches(wanted: str, candidates: list[str]) -> bool:
    """A true fact is found if some candidate says the same thing: near-identical text, or it
    contains at least 75% of the fact's content words and every number in it."""
    key = _fact_key(wanted)
    if any(SequenceMatcher(None, key, _fact_key(c)).ratio() >= FACT_SIMILARITY for c in candidates):
        return True
    needed = _fact_tokens(wanted)
    if not needed:
        return False
    numbers = {t for t in needed if _NUMBER.match(t)}
    for candidate in candidates:
        have = _fact_tokens(candidate)
        if numbers <= have and len(needed & have) / len(needed) >= CONTAINMENT_THRESHOLD:
            return True
    return False


def facts_recall(pred: Scene, truth: Scene) -> float | None:
    """Fraction of ground-truth facts that the prediction states (see `fact_matches`)."""
    wanted = [f for f in truth.get("facts") or [] if isinstance(f, str)]
    if not wanted:
        return None
    got = [f for f in pred.get("facts") or [] if isinstance(f, str)]
    return sum(fact_matches(w, got) for w in wanted) / len(wanted)


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------


def _keyed_points(scene: Scene) -> dict[str, tuple[float, float]]:
    out: dict[str, tuple[float, float]] = {}
    for point in _items(scene, "points"):
        key = label_key(point.get("label") or point.get("id"))
        x, y = _num(point.get("x")), _num(point.get("y"))
        if key and x is not None and y is not None:
            out.setdefault(key, (x, y))
    return out


def _segment_pairs(scene: Scene) -> set[frozenset[str]]:
    names = {
        p.get("id"): label_key(p.get("label") or p.get("id")) for p in _items(scene, "points")
    }
    pairs: set[frozenset[str]] = set()
    for seg in _items(scene, "segments"):
        a, b = names.get(seg.get("a")), names.get(seg.get("b"))
        if a and b and a != b:
            pairs.add(frozenset((a, b)))
    return pairs


def _normalise_box(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Rescale points so their own bounding box becomes the unit square.

    The model frames a drawing by its tight bounding box (corners at 0 and 1) while a
    ground truth may carry margins. For touch exploration only the shape matters, because
    the canvas draws whatever frame it is given, so shape scores compare after this step.
    """
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    x0, y0 = min(xs), min(ys)
    width, height = (max(xs) - x0) or 1.0, (max(ys) - y0) or 1.0
    return [((x - x0) / width, (y - y0) / height) for x, y in points]


def _corner_accuracy(errors: list[float], expected: int) -> float | None:
    if expected == 0:
        return None
    return sum(max(0.0, 1 - e / CORNER_TOLERANCE) for e in errors) / expected


def geometry_metrics(pred: Scene, truth: Scene) -> Metrics:
    pred_pts, true_pts = _keyed_points(pred), _keyed_points(truth)
    matched = [k for k in true_pts if k in pred_pts]
    abs_errors = [
        hypot(pred_pts[k][0] - true_pts[k][0], pred_pts[k][1] - true_pts[k][1]) for k in matched
    ]
    # Shape-only comparison: both point sets rescaled to their own bounding boxes.
    shape_errors: list[float] = []
    if len(matched) >= 2:
        pred_norm = _normalise_box([pred_pts[k] for k in matched])
        true_norm = _normalise_box([true_pts[k] for k in matched])
        shape_errors = [
            hypot(p[0] - t[0], p[1] - t[1]) for p, t in zip(pred_norm, true_norm, strict=True)
        ]
    return {
        "point_f1": f1_score(set(pred_pts), set(true_pts)),
        "point_count_match": float(len(_items(pred, "points")) == len(_items(truth, "points"))),
        "segment_f1": f1_score(_segment_pairs(pred), _segment_pairs(truth)),
        "corner_error": fmean(abs_errors) if abs_errors else None,
        "corner_accuracy_abs": _corner_accuracy(abs_errors, len(true_pts)),
        "corner_accuracy": _corner_accuracy(shape_errors, len(true_pts)),
    }


# ---------------------------------------------------------------------------
# Function graphs
# ---------------------------------------------------------------------------


def _curve(polyline: dict[str, Any]) -> Curve:
    points = polyline.get("points")
    if not isinstance(points, list):
        return []
    pairs = [
        (x, y)
        for p in points
        if isinstance(p, list | tuple) and len(p) == 2
        if (x := _num(p[0])) is not None and (y := _num(p[1])) is not None
    ]
    return sorted(pairs)


def _interp(curve: Curve, xs: list[float], x: float) -> float:
    i = bisect_left(xs, x)
    if i <= 0:
        return curve[0][1]
    if i >= len(curve):
        return curve[-1][1]
    (x0, y0), (x1, y1) = curve[i - 1], curve[i]
    return y0 if x1 == x0 else y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def curve_score(pred: Curve, truth: Curve) -> float:
    """Shape score: both curves rescaled to their own bounding boxes, then
    (1 - mean |dy| / tolerance) times how much of the true x-extent the prediction spans
    (so a half-drawn curve is penalised). Compare `curve_score_abs`, which is frame-sensitive."""
    if len(pred) < 2 or len(truth) < 2:
        return 0.0
    true_span = truth[-1][0] - truth[0][0]
    if true_span <= 0:
        return 0.0
    pred_norm, true_norm = _normalise_box(pred), _normalise_box(truth)
    xs = [p[0] for p in true_norm]
    error = fmean(abs(y - _interp(true_norm, xs, x)) for x, y in pred_norm)
    extent = min(1.0, (pred[-1][0] - pred[0][0]) / true_span)
    return extent * max(0.0, 1 - error / CURVE_TOLERANCE)


def curve_score_abs(pred: Curve, truth: Curve) -> float:
    """Absolute-frame score: x-range coverage times (1 - mean |dy| / tolerance), clipped to 0..1."""
    if len(pred) < 2 or len(truth) < 2:
        return 0.0
    lo, hi = max(pred[0][0], truth[0][0]), min(pred[-1][0], truth[-1][0])
    span = truth[-1][0] - truth[0][0]
    if hi <= lo or span <= 0:
        return 0.0
    xs = [p[0] for p in truth]
    errors = [abs(y - _interp(truth, xs, x)) for x, y in pred if lo <= x <= hi]
    if not errors:
        return 0.0
    return min(1.0, (hi - lo) / span) * max(0.0, 1 - fmean(errors) / CURVE_TOLERANCE)


def axes_accuracy(pred: Scene, truth: Scene) -> float | None:
    true_axes, pred_axes = truth.get("axes"), pred.get("axes")
    if not isinstance(true_axes, dict):
        return None
    hits: list[float] = []
    for key in ("x_axis_y", "y_axis_x"):
        wanted = _num(true_axes.get(key))
        if wanted is None:
            continue
        got = _num(pred_axes.get(key)) if isinstance(pred_axes, dict) else None
        hits.append(float(got is not None and abs(got - wanted) <= AXIS_TOLERANCE))
    return fmean(hits) if hits else None


def graph_metrics(pred: Scene, truth: Scene) -> Metrics:
    true_curves = [c for c in map(_curve, _items(truth, "polylines")) if len(c) >= 2]
    pred_curves = [c for c in map(_curve, _items(pred, "polylines")) if c]
    curve = (
        fmean(max((curve_score(p, t) for p in pred_curves), default=0.0) for t in true_curves)
        if true_curves
        else None
    )
    # A truly simple curve (e.g. a straight line) legitimately needs fewer than
    # the prompt's 40 points, so never demand more than the ground truth has.
    lowest = min([CURVE_POINTS_MIN, *(len(c) for c in true_curves)])
    in_range = all(lowest <= len(c) <= CURVE_POINTS_MAX for c in pred_curves)
    curve_abs = (
        fmean(max((curve_score_abs(p, t) for p in pred_curves), default=0.0) for t in true_curves)
        if true_curves
        else None
    )
    return {
        "curve_score": curve,
        "curve_score_abs": curve_abs,
        "polyline_count_match": float(len(pred_curves) == len(true_curves)),
        "point_range_ok": float(bool(pred_curves) and in_range),
        "axes_accuracy": axes_accuracy(pred, truth),
    }


# ---------------------------------------------------------------------------
# Bar charts
# ---------------------------------------------------------------------------


def _keyed_bars(scene: Scene) -> dict[str, dict[str, float]]:
    out: dict[str, dict[str, float]] = {}
    for bar in _items(scene, "bars"):
        key = label_key(bar.get("label"))
        value, top, base = _num(bar.get("value")), _num(bar.get("y_top")), _num(bar.get("y_base"))
        if key and value is not None:
            height = base - top if top is not None and base is not None else 0.0
            out.setdefault(key, {"value": value, "height": height})
    return out


def _height_concordance(pred: dict[str, dict[str, float]], truth: dict[str, dict[str, float]]) -> float | None:
    """Do predicted bar heights order the same way as the true values?"""
    keys = [k for k in truth if k in pred]
    pairs = [
        (a, b)
        for i, a in enumerate(keys)
        for b in keys[i + 1 :]
        if truth[a]["value"] != truth[b]["value"]
    ]
    if not pairs:
        return None
    agree = sum(
        (pred[a]["height"] - pred[b]["height"]) * (truth[a]["value"] - truth[b]["value"]) > 0
        for a, b in pairs
    )
    return agree / len(pairs)


def bar_metrics(pred: Scene, truth: Scene) -> Metrics:
    pred_bars, true_bars = _keyed_bars(pred), _keyed_bars(truth)
    close = sum(
        k in pred_bars
        and abs(pred_bars[k]["value"] - t["value"])
        <= max(VALUE_REL_TOLERANCE * abs(t["value"]), 1e-9)
        for k, t in true_bars.items()
    )
    return {
        "bar_label_f1": f1_score(set(pred_bars), set(true_bars)),
        "bar_count_match": float(len(_items(pred, "bars")) == len(_items(truth, "bars"))),
        "value_accuracy": close / len(true_bars) if true_bars else None,
        "height_concordance": _height_concordance(pred_bars, true_bars),
    }


# ---------------------------------------------------------------------------
# Composite
# ---------------------------------------------------------------------------

_KIND_METRICS: dict[str, Callable[[Scene, Scene], Metrics]] = {
    "geometry": geometry_metrics,
    "function_graph": graph_metrics,
    "bar_chart": bar_metrics,
}


def _weighted_mean(metrics: Metrics, weights: dict[str, float]) -> float:
    pairs = [(w, metrics[k]) for k, w in weights.items() if metrics.get(k) is not None]
    total = sum(w for w, _ in pairs)
    return sum(w * m for w, m in pairs if m is not None) / total if total else 0.0


def score_scene(
    pred: Scene, truth: Scene, validate: Callable[[Scene], bool] | None = None
) -> SceneScore:
    """Score ``pred`` against ``truth``.

    ``validate`` should return True when the scene builds as a ``DiagramScene``;
    it is strict (no clamping), so it measures the raw model output, before
    ``validate.py`` repairs anything.
    """
    kind = truth.get("kind")
    metrics: Metrics = {
        "kind": float(pred.get("kind") == kind),
        "schema_valid": None if validate is None else float(validate(pred)),
    }
    kind_fn = _KIND_METRICS.get(kind) if isinstance(kind, str) else None
    if kind_fn is not None:
        metrics.update(kind_fn(pred, truth))
    metrics["facts_recall"] = facts_recall(pred, truth)
    metrics["appearance_labels"] = appearance_label_rate(pred)
    weights = WEIGHTS.get(kind, DEFAULT_WEIGHTS) if isinstance(kind, str) else DEFAULT_WEIGHTS
    return SceneScore(metrics, _weighted_mean(metrics, weights))
