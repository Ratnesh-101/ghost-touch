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
import math
import re
import unicodedata
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

# Structural bounds matching /ask (B2-06)
MAX_SCENE_POINTS = 500
MAX_SCENE_SEGMENTS = 1000
MAX_SCENE_POLYLINES = 50
MAX_POLYLINE_POINTS = 1000
MAX_SCENE_BARS = 100
MAX_SCENE_FACTS = 100

# Spoken string length caps (F12)
MAX_LABEL_CHARS = 60
MAX_TITLE_CHARS = 120
MAX_FACT_CHARS = 280
MAX_TEXT_CHARS = 300

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
# String sanitization & normalization (F12)
# ---------------------------------------------------------------------------


def _sanitize_string(text: Any, max_len: int | None = None) -> str:
    """Strip Cf/Cc/Zl/Zp characters, collapse whitespace, and optionally cap length."""
    if not isinstance(text, str):
        text = str(text) if text is not None else ""
    chars: list[str] = []
    for ch in text:
        cat = unicodedata.category(ch)
        if cat in ("Cf", "Zl", "Zp"):
            continue
        if cat == "Cc":
            if ch in ("\t", "\n", "\r"):
                chars.append(" ")
            continue
        chars.append(ch)
    collapsed = " ".join("".join(chars).split())
    if max_len is not None and len(collapsed) > max_len:
        collapsed = collapsed[:max_len].rstrip()
    return collapsed


def _sanitize_scene_strings(data: dict[str, Any]) -> None:
    """Sanitise titles, facts, labels, and ids in place across the scene dict (F12)."""
    raw_title = data.get("title")
    if raw_title is not None:
        t_clean = _sanitize_string(raw_title, max_len=MAX_TITLE_CHARS)
        data["title"] = t_clean if t_clean else None

    raw_facts = data.get("facts")
    if isinstance(raw_facts, list):
        clean_facts: list[str] = []
        for f in raw_facts:
            if f is not None:
                fc = _sanitize_string(f, max_len=MAX_FACT_CHARS)
                if fc:
                    clean_facts.append(fc)
        data["facts"] = clean_facts

    for key in ("points", "segments", "polylines", "bars"):
        elements = data.get(key)
        if isinstance(elements, list):
            for elem in elements:
                if not isinstance(elem, dict):
                    continue
                if "id" in elem:
                    elem["id"] = _sanitize_string(elem["id"])
                if "label" in elem and elem["label"] is not None:
                    lbl_clean = _sanitize_string(elem["label"], max_len=MAX_LABEL_CHARS)
                    if key == "bars":
                        elem["label"] = lbl_clean
                    else:
                        elem["label"] = lbl_clean if lbl_clean else None


def _check_empty_ids(data: dict[str, Any], errors: list[str]) -> None:
    """Reject empty element ids (F12)."""
    for key in ("points", "segments", "polylines", "bars"):
        elements = data.get(key)
        if isinstance(elements, list):
            for elem in elements:
                if not isinstance(elem, dict):
                    continue
                eid = elem.get("id")
                if not isinstance(eid, str) or not eid.strip():
                    errors.append(f"Element in {key} has an empty id")


# ---------------------------------------------------------------------------
# Repair helpers (silent: modify data in place)
# ---------------------------------------------------------------------------


def _clamp_coord(value: Any) -> float | None:
    """Clamp a coordinate to [0, 1] if within +/-0.02 tolerance. None if beyond or non-finite."""
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    try:
        v = float(value)
    except (ValueError, TypeError):
        return None
    if not math.isfinite(v):
        return None
    if v < -CLAMP_TOLERANCE or v > 1 + CLAMP_TOLERANCE:
        return None
    return max(0.0, min(1.0, v))


def _repair_coords(data: dict[str, Any], dropped_tracker: dict[str, list[Any]]) -> None:
    """Clamp coordinates in all elements; drop elements with out-of-tolerance coords."""
    # Points
    pts = data.get("points")
    if isinstance(pts, list):
        kept_pts: list[dict[str, Any]] = []
        for p in pts:
            if not isinstance(p, dict):
                continue
            x = _clamp_coord(p.get("x"))
            y = _clamp_coord(p.get("y"))
            if x is not None and y is not None:
                p["x"] = x
                p["y"] = y
                kept_pts.append(p)
            else:
                pid = p.get("id")
                if isinstance(pid, str) and pid:
                    dropped_tracker["points"].append((pid, p.get("label")))
        data["points"] = kept_pts

    # Polylines (F9: polylines need >= 2 points to be drawable)
    polys = data.get("polylines")
    if isinstance(polys, list):
        kept_polys: list[dict[str, Any]] = []
        for poly in polys:
            if not isinstance(poly, dict):
                continue
            raw_pts = poly.get("points")
            if not isinstance(raw_pts, list):
                plid = poly.get("id")
                if isinstance(plid, str) and plid:
                    dropped_tracker["polylines"].append((plid, poly.get("label")))
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
            if len(repaired) >= 2:
                poly["points"] = repaired
                kept_polys.append(poly)
            else:
                plid = poly.get("id")
                if isinstance(plid, str) and plid:
                    dropped_tracker["polylines"].append((plid, poly.get("label")))
        data["polylines"] = kept_polys

    # Bars (B2-05: normalise inverted bars, F6: reject non-finite value)
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
            raw_val = bar.get("value")
            val_ok = False
            if isinstance(raw_val, (int, float)) and not isinstance(raw_val, bool):
                try:
                    fv = float(raw_val)
                    if math.isfinite(fv):
                        bar["value"] = fv
                        val_ok = True
                except (ValueError, TypeError):
                    val_ok = False
            if all(v is not None for v in (x0, x1, y_top, y_base)) and val_ok:
                bar["x0"] = min(x0, x1)
                bar["x1"] = max(x0, x1)
                bar["y_top"] = min(y_top, y_base)
                bar["y_base"] = max(y_top, y_base)
                kept_bars.append(bar)
            else:
                bid = bar.get("id")
                if isinstance(bid, str) and bid:
                    dropped_tracker["bars"].append((bid, bar.get("label")))
        data["bars"] = kept_bars

    # Axes
    axes = data.get("axes")
    if isinstance(axes, dict):
        if axes.get("x_axis_y") is not None:
            v = _clamp_coord(axes.get("x_axis_y"))
            axes["x_axis_y"] = v
        if axes.get("y_axis_x") is not None:
            v = _clamp_coord(axes.get("y_axis_x"))
            axes["y_axis_x"] = v

    # Aspect (F2, M4-05: optional aspect ratio float, bounded between 0.05 and 20.0)
    raw_aspect = data.get("aspect")
    if raw_aspect is not None:
        if isinstance(raw_aspect, (int, float)) and not isinstance(raw_aspect, bool):
            try:
                asp = float(raw_aspect)
                if math.isfinite(asp) and asp > 0.0:
                    data["aspect"] = max(0.05, min(20.0, asp))
                else:
                    data["aspect"] = 1.0
            except (ValueError, TypeError):
                data["aspect"] = 1.0
        else:
            data["aspect"] = 1.0
    elif "aspect" in data:
        data["aspect"] = 1.0


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


def _drop_dangling_segments(data: dict[str, Any], dropped_tracker: dict[str, list[Any]]) -> None:
    """Remove segments whose endpoint ids don't exist in points (F7: never raises)."""
    pts = data.get("points")
    if not isinstance(pts, list):
        return
    point_ids: set[str] = {
        p.get("id") for p in pts if isinstance(p, dict) and isinstance(p.get("id"), str)
    }
    segs = data.get("segments")
    if not isinstance(segs, list):
        return
    kept_segs: list[dict[str, Any]] = []
    for s in segs:
        if not isinstance(s, dict):
            continue
        a = s.get("a")
        b = s.get("b")
        if isinstance(a, str) and isinstance(b, str) and a in point_ids and b in point_ids:
            kept_segs.append(s)
        else:
            sid = s.get("id")
            if isinstance(sid, str) and sid:
                sa = a if isinstance(a, str) else None
                sb = b if isinstance(b, str) else None
                dropped_tracker["segments"].append((sid, sa, sb, s.get("label")))
    data["segments"] = kept_segs


# ---------------------------------------------------------------------------
# Rejection checks (produce errors)
# ---------------------------------------------------------------------------


def _element_named_in_facts(
    eid: str | None,
    label: str | None,
    facts: list[str],
    segment_endpoints: tuple[str | None, str | None] | None = None,
) -> bool:
    """Check if an element (by id, label, or endpoints) is referenced in any fact string."""
    for fact in facts:
        f_norm = fact.strip()
        if label and len(label.strip()) > 0:
            lbl = label.strip()
            if re.search(rf"\b{re.escape(lbl)}\b", f_norm, re.IGNORECASE):
                return True

        if eid and len(eid.strip()) > 0:
            eid_clean = eid.strip()
            if len(eid_clean) == 1 and eid_clean.isalpha():
                if re.search(rf"\b{re.escape(eid_clean)}\b", f_norm):
                    return True
                for m in re.finditer(r"[A-Z]{2,}", f_norm):
                    if eid_clean in m.group(0):
                        return True
            else:
                if re.search(rf"\b{re.escape(eid_clean)}\b", f_norm, re.IGNORECASE):
                    return True

        if segment_endpoints:
            a, b = segment_endpoints
            if isinstance(a, str) and isinstance(b, str) and a and b:
                pair1 = f"{a}{b}"
                pair2 = f"{b}{a}"
                if re.search(rf"\b({re.escape(pair1)}|{re.escape(pair2)})\b", f_norm):
                    return True
    return False


def _check_dropped_references(
    raw_input_meta: dict[str, Any],
    dropped_tracker: dict[str, list[Any]],
    errors: list[str],
) -> None:
    """F5: Fail validation if any dropped element is referenced by other elements or facts."""
    used_points = raw_input_meta.get("raw_points_used_by_segments", set())
    raw_facts = raw_input_meta.get("raw_facts", [])

    for pid, plabel in dropped_tracker.get("points", []):
        if pid in used_points:
            errors.append(
                f"Validation dropped point '{pid}' which is used by segments; scene is invalid"
            )
            return
        if _element_named_in_facts(pid, plabel, raw_facts):
            errors.append(
                f"Validation dropped point '{pid}' which is referenced in facts; scene is invalid"
            )
            return

    for sid, sa, sb, slabel in dropped_tracker.get("segments", []):
        if _element_named_in_facts(sid, slabel, raw_facts, segment_endpoints=(sa, sb)):
            errors.append(
                f"Validation dropped segment '{sid}' which is referenced in facts; scene is invalid"
            )
            return

    for bid, blabel in dropped_tracker.get("bars", []):
        if _element_named_in_facts(bid, blabel, raw_facts):
            errors.append(
                f"Validation dropped bar '{bid}' which is referenced in facts; scene is invalid"
            )
            return

    for plid, pllabel in dropped_tracker.get("polylines", []):
        if _element_named_in_facts(plid, pllabel, raw_facts):
            errors.append(
                f"Validation dropped polyline '{plid}' which is referenced in facts; "
                f"scene is invalid"
            )
            return


def _is_colour_shape_only(label: str) -> bool:
    """True if the label consists only of colour or generic shape words (B2-13)."""
    cleaned = re.sub(r"[^\w\s]", "", label.lower())
    words = cleaned.split()
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


def _check_structural_limits(data: dict[str, Any], errors: list[str]) -> None:
    """Reject scenes that exceed structural limits (B2-06, consistent with /ask)."""
    counts = (
        (len(data.get("points") or []), MAX_SCENE_POINTS, "points"),
        (len(data.get("segments") or []), MAX_SCENE_SEGMENTS, "segments"),
        (len(data.get("polylines") or []), MAX_SCENE_POLYLINES, "polylines"),
        (len(data.get("bars") or []), MAX_SCENE_BARS, "bars"),
        (len(data.get("facts") or []), MAX_SCENE_FACTS, "facts"),
    )
    for actual, limit, name in counts:
        if actual > limit:
            errors.append(f"scene has too many {name} ({actual} > {limit})")

    polys = data.get("polylines")
    if isinstance(polys, list):
        for poly in polys:
            if isinstance(poly, dict):
                pts = poly.get("points")
                if isinstance(pts, list) and len(pts) > MAX_POLYLINE_POINTS:
                    errors.append(
                        f"a polyline has more than {MAX_POLYLINE_POINTS} points "
                        f"({len(pts)} > {MAX_POLYLINE_POINTS})"
                    )
                    break


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_scene(raw: str | dict[str, Any]) -> ValidationResult:
    """Validate raw LLM output or dict against DiagramScene with repair rules.

    Never raises an exception, even on invalid JSON or arbitrary garbage.

    Repair rules (silent):
    - Clamp coordinates within +/-0.02 of [0, 1]; drop elements beyond.
    - Drop dangling segments (endpoint ids not in points).
    - Dedupe element ids before dangling segment resolution.
    - Normalise inverted bars (min/max on x0/x1 and y_top/y_base).
    - Sanitise spoken strings (strip Cf/Cc/Zl/Zp, collapse whitespace, cap lengths).

    Rejection rules (produce errors):
    - Colour/shape-only labels (Req 3.6).
    - Dropping referenced elements (used by segments or named in facts; F5).
    - Empty element ids (F12).
    - Structural limit violations (B2-06).
    - Schema validation failure.
    - Zero drawable elements (F9).
    """
    # Parse input
    if isinstance(raw, str):
        try:
            cleaned = raw.strip()
            # B2-12: Handle markdown code blocks even if preceded by conversational prose
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
            if match:
                cleaned = match.group(1).strip()
            elif cleaned.startswith("```"):
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

    errors: list[str] = []

    # Meta-tracking for F5 (referenced element drop prevention)
    # Only real lists are read here; wrong types are rejected or dropped later (P9: never raise).
    segments_in = data.get("segments")
    facts_in = data.get("facts")
    raw_segments = [
        s for s in (segments_in if isinstance(segments_in, list) else []) if isinstance(s, dict)
    ]
    raw_points_used_by_segments: set[str] = set()
    for s in raw_segments:
        a, b = s.get("a"), s.get("b")
        if isinstance(a, str) and a:
            raw_points_used_by_segments.add(a)
        if isinstance(b, str) and b:
            raw_points_used_by_segments.add(b)

    raw_input_meta = {
        "raw_points_used_by_segments": raw_points_used_by_segments,
        "raw_facts": [
            str(f) for f in (facts_in if isinstance(facts_in, list) else []) if f is not None
        ],
    }

    dropped_tracker: dict[str, list[Any]] = {
        "points": [],
        "segments": [],
        "bars": [],
        "polylines": [],
    }

    try:
        # 1. Structural limits check (B2-06)
        _check_structural_limits(data, errors)
        if errors:
            return ValidationResult(scene=None, errors=errors)

        # 2. String sanitization (F12)
        _sanitize_scene_strings(data)

        # 3. Check for empty IDs (F12)
        _check_empty_ids(data, errors)
        if errors:
            return ValidationResult(scene=None, errors=errors)

        # 4. Repair coordinates and drop out-of-bounds/non-finite elements (F6, B2-05)
        _repair_coords(data, dropped_tracker)

        # 5. Dedupe element IDs BEFORE dangling segments (F15)
        _dedupe_ids(data)

        # 6. Drop dangling segments (F7: never raises on unhashable endpoints)
        _drop_dangling_segments(data, dropped_tracker)

        # 7. Check if dropped elements were referenced by remaining elements or facts (F5)
        _check_dropped_references(raw_input_meta, dropped_tracker, errors)
        if errors:
            return ValidationResult(scene=None, errors=errors)

        # 8. Check labels for colour/shape words only (Req 3.6, B2-13)
        _check_labels(data, errors)
        if errors:
            return ValidationResult(scene=None, errors=errors)

    except Exception as exc:
        return ValidationResult(scene=None, errors=[f"Unexpected error: {exc}"])

    # Validate against schema
    try:
        scene = DiagramScene.model_validate(data)
    except (ValidationError, ValueError) as exc:
        return ValidationResult(scene=None, errors=[str(exc)])
    except Exception as exc:
        return ValidationResult(scene=None, errors=[f"Unexpected error: {exc}"])

    # Check: reject zero drawable elements (F9: polylines need >= 2 points to be drawable)
    drawable_polylines = [p for p in scene.polylines if len(p.points) >= 2]
    if (
        len(scene.points) == 0
        and len(scene.segments) == 0
        and len(drawable_polylines) == 0
        and len(scene.bars) == 0
    ):
        return ValidationResult(scene=None, errors=["Scene has no drawable elements"])

    return ValidationResult(scene=scene, errors=[])
