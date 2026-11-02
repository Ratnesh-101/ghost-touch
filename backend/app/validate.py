"""Post-LLM validation and repair (Task 8.3).

Enforces DiagramScene invariants: unique ids, valid point references, and all
coordinates in [0, 1]. Repairs trivial overshoot (clamp within +/-0.02), drops
dangling segments, and dedupes ids. A scene with no drawable elements is
rejected so the pipeline can fall back to Raw Mode.

Requirement 3.6: rejects labels that consist only of colour or generic shape
words (for example "blue polygon").
"""

from __future__ import annotations

import json
import re
from typing import Any, NamedTuple

from pydantic import ValidationError

from app.schema import DiagramScene

# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------


class ValidationResult(NamedTuple):
    scene: DiagramScene | None
    errors: list[str]  # empty iff scene is not None


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CLAMP_TOLERANCE = 0.02

COLOUR_WORDS = frozenset(
    {
        "red",
        "blue",
        "green",
        "yellow",
        "orange",
        "purple",
        "pink",
        "black",
        "white",
        "grey",
        "gray",
        "brown",
        "cyan",
        "magenta",
        "violet",
        "indigo",
    }
)

SHAPE_WORDS = frozenset(
    {
        "polygon",
        "triangle",
        "square",
        "rectangle",
        "circle",
        "shape",
        "figure",
    }
)

COLOUR_SHAPE_WORDS = COLOUR_WORDS | SHAPE_WORDS


# ---------------------------------------------------------------------------
# Repair helpers (silent: modify data in place)
# ---------------------------------------------------------------------------


def _clamp_coord(value: Any) -> float | None:
    """Clamp a coordinate to [0, 1] if within +/-0.02 tolerance. None if beyond."""
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    v = float(value)
    if v < -CLAMP_TOLERANCE or v > 1 + CLAMP_TOLERANCE:
        return None
    return max(0.0, min(1.0, v))


def _repair_coords(data: dict[str, Any]) -> None:
    """Clamp coordinates in all elements; drop elements with out-of-tolerance coords."""
    # Points
    pts = data.get("points")
    if isinstance(pts, list):
        kept: list[dict[str, Any]] = []
        for p in pts:
            if not isinstance(p, dict):
                continue
            x = _clamp_coord(p.get("x"))
            y = _clamp_coord(p.get("y"))
            if x is not None and y is not None:
                p["x"] = x
                p["y"] = y
                kept.append(p)
        data["points"] = kept

    # Polylines
    polys = data.get("polylines")
    if isinstance(polys, list):
        for poly in polys:
            if not isinstance(poly, dict):
                continue
            raw_pts = poly.get("points")
            if not isinstance(raw_pts, list):
                continue
            repaired: list[list[float]] = []
            for pt in raw_pts:
                if isinstance(pt, (list, tuple)) and len(pt) == 2:
                    x = _clamp_coord(pt[0])
                    y = _clamp_coord(pt[1])
                    if x is not None and y is not None:
                        repaired.append([x, y])
                elif isinstance(pt, dict):
                    x = _clamp_coord(pt.get("x"))
                    y = _clamp_coord(pt.get("y"))
                    if x is not None and y is not None:
                        repaired.append([x, y])
            poly["points"] = repaired

    # Bars
    bars = data.get("bars")
    if isinstance(bars, list):
        kept_bars: list[dict[str, Any]] = []
        for bar in bars:
            if not isinstance(bar, dict):
                continue
            x0 = _clamp_coord(bar.get("x0"))
            x1 = _clamp_coord(bar.get("x1"))
            y_top = _clamp_coord(bar.get("y_top"))
            y_base = _clamp_coord(bar.get("y_base"))
            if all(v is not None for v in (x0, x1, y_top, y_base)):
                bar["x0"] = x0
                bar["x1"] = x1
                bar["y_top"] = y_top
                bar["y_base"] = y_base
                kept_bars.append(bar)
        data["bars"] = kept_bars

    # Axes
    axes = data.get("axes")
    if isinstance(axes, dict):
        if axes.get("x_axis_y") is not None:
            v = _clamp_coord(axes.get("x_axis_y"))
            if v is not None:
                axes["x_axis_y"] = v
            else:
                axes["x_axis_y"] = None
        if axes.get("y_axis_x") is not None:
            v = _clamp_coord(axes.get("y_axis_x"))
            if v is not None:
                axes["y_axis_x"] = v
            else:
                axes["y_axis_x"] = None


def _drop_dangling_segments(data: dict[str, Any]) -> None:
    """Remove segments whose endpoint ids don't exist in points."""
    pts = data.get("points")
    if not isinstance(pts, list):
        return
    point_ids = {p.get("id") for p in pts if isinstance(p, dict) and isinstance(p.get("id"), str)}
    segs = data.get("segments")
    if not isinstance(segs, list):
        return
    data["segments"] = [
        s
        for s in segs
        if isinstance(s, dict) and s.get("a") in point_ids and s.get("b") in point_ids
    ]


def _dedupe_ids(data: dict[str, Any]) -> None:
    """Rename duplicate element ids by appending _2, _3, etc."""
    seen: set[str] = set()
    for key in ("points", "segments", "polylines", "bars"):
        elements = data.get(key)
        if not isinstance(elements, list):
            continue
        for elem in elements:
            if not isinstance(elem, dict):
                continue
            eid = elem.get("id")
            if not isinstance(eid, str):
                continue
            if eid in seen:
                base = eid
                counter = 2
                new_id = f"{base}_{counter}"
                while new_id in seen:
                    counter += 1
                    new_id = f"{base}_{counter}"
                elem["id"] = new_id
                seen.add(new_id)
            else:
                seen.add(eid)


# ---------------------------------------------------------------------------
# Rejection checks (produce errors)
# ---------------------------------------------------------------------------


def _is_colour_shape_only(label: str) -> bool:
    """True if the label consists only of colour or generic shape words."""
    words = label.lower().strip().split()
    if not words:
        return False
    return all(w in COLOUR_SHAPE_WORDS for w in words)


def _check_labels(data: dict[str, Any], errors: list[str]) -> None:
    """Reject labels that consist only of colour or generic shape words (Req 3.6)."""
    for key in ("points", "segments", "polylines"):
        elements = data.get(key)
        if not isinstance(elements, list):
            continue
        for elem in elements:
            if not isinstance(elem, dict):
                continue
            label = elem.get("label")
            if isinstance(label, str) and label.strip() and _is_colour_shape_only(label):
                errors.append(
                    f"Label '{label}' on {key[:-1]} '{elem.get('id', '?')}' "
                    f"consists only of colour or generic shape words"
                )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_scene(raw: str | dict[str, Any]) -> ValidationResult:
    """Validate raw LLM output or dict against DiagramScene with repair rules.

    Never raises an exception, even on invalid JSON or arbitrary garbage.

    Repair rules (silent):
    - Clamp coordinates within +/-0.02 of [0, 1]; drop elements beyond.
    - Drop dangling segments (endpoint ids not in points).
    - Dedupe element ids.

    Rejection rules (produce errors):
    - Colour/shape-only labels (Req 3.6).
    - Schema validation failure.
    - Zero drawable elements.
    """
    # Parse input
    if isinstance(raw, str):
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(
                    r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE
                ).strip()
            data = json.loads(cleaned)
        except Exception as exc:
            return ValidationResult(scene=None, errors=[f"Invalid JSON: {exc}"])
    elif isinstance(raw, dict):
        data = raw
    else:
        return ValidationResult(
            scene=None, errors=[f"Expected str or dict, got {type(raw).__name__}"]
        )

    if not isinstance(data, dict):
        return ValidationResult(
            scene=None, errors=[f"Expected JSON object, got {type(data).__name__}"]
        )

    # Repair: clamp coordinates (drops elements with out-of-tolerance coords)
    _repair_coords(data)

    # Repair: drop dangling segments
    _drop_dangling_segments(data)

    # Repair: dedupe ids
    _dedupe_ids(data)

    # Check: reject colour/shape-only labels
    errors: list[str] = []
    _check_labels(data, errors)
    if errors:
        return ValidationResult(scene=None, errors=errors)

    # Validate against schema
    try:
        scene = DiagramScene.model_validate(data)
    except (ValidationError, ValueError) as exc:
        return ValidationResult(scene=None, errors=[str(exc)])
    except Exception as exc:
        return ValidationResult(scene=None, errors=[f"Unexpected error: {exc}"])

    # Check: reject zero drawable elements
    if (
        len(scene.points) == 0
        and len(scene.segments) == 0
        and len(scene.polylines) == 0
        and len(scene.bars) == 0
    ):
        return ValidationResult(scene=None, errors=["Scene has no drawable elements"])

    return ValidationResult(scene=scene, errors=[])
