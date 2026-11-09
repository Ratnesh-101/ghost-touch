"""Semantic diagram targets for the Ask endpoint.

Deterministic resolver for spatial and semantic queries (e.g. peak, trough,
origin, tallest/shortest bar, right angle, longest side) in English, Hindi,
and Gujarati. Computes exact targets and spoken coarse-position descriptions
without invoking vision or language models.

Completely pure value resolver decoupled from AskTarget and app.ask.
"""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from app.schema import DiagramScene


@dataclass(frozen=True)
class SemanticResult:
    """Deterministic semantic target result for a DiagramScene feature.

    Plain value object decoupled from AskTarget and app.ask.
    target_kind is 'point' (for coordinates in [0, 1]) or 'element' (for elementId).
    """

    name: str
    target_kind: Literal["element", "point"]
    element_id: str | None = None
    x: float | None = None
    y: float | None = None
    label: str | None = None

    @property
    def elementId(self) -> str | None:
        """CamelCase alias for element_id."""
        return self.element_id


# Coarse grid boundaries for normalized coordinates [0, 1]
_GRID_LOW = 1.0 / 3.0
_GRID_HIGH = 2.0 / 3.0
MAX_ANSWER_CHARS = 300

# Supported semantic features
FEATURE_PEAK = "peak"
FEATURE_TROUGH = "trough"
FEATURE_ORIGIN = "origin"
FEATURE_TALLEST_BAR = "tallest_bar"
FEATURE_SHORTEST_BAR = "shortest_bar"
FEATURE_RIGHT_ANGLE = "right_angle"
FEATURE_LONGEST_SIDE = "longest_side"

# Phrase dictionaries ordered by natural specificity
_PHRASES: list[tuple[str, str]] = [
    # Tallest bar (English, Hindi, Gujarati)
    ("tallest bar", FEATURE_TALLEST_BAR),
    ("highest bar", FEATURE_TALLEST_BAR),
    ("biggest bar", FEATURE_TALLEST_BAR),
    ("largest bar", FEATURE_TALLEST_BAR),
    ("maximum bar", FEATURE_TALLEST_BAR),
    ("सबसे ऊँचा बार", FEATURE_TALLEST_BAR),
    ("सबसे ऊंचा बार", FEATURE_TALLEST_BAR),
    ("सबसे बड़ा बार", FEATURE_TALLEST_BAR),
    ("सबसे बडा बार", FEATURE_TALLEST_BAR),
    ("सबसे ऊँचा स्तंभ", FEATURE_TALLEST_BAR),
    ("सबसे ऊंचा स्तंभ", FEATURE_TALLEST_BAR),
    ("सबसे बड़ा स्तंभ", FEATURE_TALLEST_BAR),
    ("सबसे बडा स्तंभ", FEATURE_TALLEST_BAR),
    ("સૌથી ઊંચો બાર", FEATURE_TALLEST_BAR),
    ("સૌથી મોટો બાર", FEATURE_TALLEST_BAR),
    ("સૌથી ઊંચો સ્તંભ", FEATURE_TALLEST_BAR),
    ("સૌથી મોટો સ્તંભ", FEATURE_TALLEST_BAR),
    # Shortest bar
    ("shortest bar", FEATURE_SHORTEST_BAR),
    ("smallest bar", FEATURE_SHORTEST_BAR),
    ("lowest bar", FEATURE_SHORTEST_BAR),
    ("minimum bar", FEATURE_SHORTEST_BAR),
    ("सबसे छोटा बार", FEATURE_SHORTEST_BAR),
    ("सबसे निचला बार", FEATURE_SHORTEST_BAR),
    ("सबसे छोटा स्तंभ", FEATURE_SHORTEST_BAR),
    ("सबसे निचला स्तंभ", FEATURE_SHORTEST_BAR),
    ("સૌથી નાનો બાર", FEATURE_SHORTEST_BAR),
    ("સૌથી નીચો બાર", FEATURE_SHORTEST_BAR),
    ("સૌથી નાનો સ્તંભ", FEATURE_SHORTEST_BAR),
    ("સૌથી નીચો સ્તંભ", FEATURE_SHORTEST_BAR),
    # Peak
    ("top of the curve", FEATURE_PEAK),
    ("top of curve", FEATURE_PEAK),
    ("curve peak", FEATURE_PEAK),
    ("highest point", FEATURE_PEAK),
    ("highest vertex", FEATURE_PEAK),
    ("peak", FEATURE_PEAK),
    ("maximum", FEATURE_PEAK),
    ("वक्र का सबसे ऊँचा बिंदु", FEATURE_PEAK),
    ("वक्र का सबसे ऊंचा बिंदु", FEATURE_PEAK),
    ("वक्र का सबसे ऊँचा बिन्दु", FEATURE_PEAK),
    ("वक्र का सबसे ऊंचा बिन्दु", FEATURE_PEAK),
    ("वक्र का शीर्ष", FEATURE_PEAK),
    ("सबसे ऊँचा बिंदु", FEATURE_PEAK),
    ("सबसे ऊंचा बिंदु", FEATURE_PEAK),
    ("सबसे ऊँचा बिन्दु", FEATURE_PEAK),
    ("सबसे ऊंचा बिन्दु", FEATURE_PEAK),
    ("अधिकतम बिंदु", FEATURE_PEAK),
    ("अधिकतम बिन्दु", FEATURE_PEAK),
    ("अधिकतम", FEATURE_PEAK),
    ("शिखर", FEATURE_PEAK),
    ("વક્રનું સૌથી ઊંચું બિંદુ", FEATURE_PEAK),
    ("વક્રની ટોચ", FEATURE_PEAK),
    ("સૌથી ઊંચો બિંદુ", FEATURE_PEAK),
    ("સૌથી ઊંચું બિંદુ", FEATURE_PEAK),
    ("મહત્તમ બિંદુ", FEATURE_PEAK),
    ("મહત્તમ", FEATURE_PEAK),
    ("શિખર", FEATURE_PEAK),
    # Trough / lowest point
    ("bottom of the curve", FEATURE_TROUGH),
    ("bottom of curve", FEATURE_TROUGH),
    ("curve trough", FEATURE_TROUGH),
    ("lowest point", FEATURE_TROUGH),
    ("lowest vertex", FEATURE_TROUGH),
    ("minimum", FEATURE_TROUGH),
    ("trough", FEATURE_TROUGH),
    ("वक्र का सबसे निचला बिंदु", FEATURE_TROUGH),
    ("वक्र का सबसे निचला बिन्दु", FEATURE_TROUGH),
    ("वक्र का निचला भाग", FEATURE_TROUGH),
    ("सबसे निचला बिंदु", FEATURE_TROUGH),
    ("सबसे निचला बिन्दु", FEATURE_TROUGH),
    ("न्यूनतम बिंदु", FEATURE_TROUGH),
    ("न्यूनतम बिन्दु", FEATURE_TROUGH),
    ("न्यूनतम", FEATURE_TROUGH),
    ("गर्त", FEATURE_TROUGH),
    ("तल", FEATURE_TROUGH),
    ("વક્રનું સૌથી નીચું બિંદુ", FEATURE_TROUGH),
    ("વક્રનું તળિયું", FEATURE_TROUGH),
    ("સૌથી નીચો બિંદુ", FEATURE_TROUGH),
    ("સૌથી નીચું બિંદુ", FEATURE_TROUGH),
    ("ન્યૂનતમ બિંદુ", FEATURE_TROUGH),
    ("ન્યૂનતમ", FEATURE_TROUGH),
    ("ગર્ત", FEATURE_TROUGH),
    # Origin
    ("where the axes cross", FEATURE_ORIGIN),
    ("where axes cross", FEATURE_ORIGIN),
    ("axes crossing", FEATURE_ORIGIN),
    ("axis crossing", FEATURE_ORIGIN),
    ("where the axes meet", FEATURE_ORIGIN),
    ("where axes meet", FEATURE_ORIGIN),
    ("axes intersection", FEATURE_ORIGIN),
    ("intersection of axes", FEATURE_ORIGIN),
    ("axes cross", FEATURE_ORIGIN),
    ("axes meet", FEATURE_ORIGIN),
    ("origin", FEATURE_ORIGIN),
    ("अक्ष कहाँ काटते हैं", FEATURE_ORIGIN),
    ("अक्ष कहां काटते हैं", FEATURE_ORIGIN),
    ("अक्षों का मिलन बिंदु", FEATURE_ORIGIN),
    ("अक्षों का मिलन बिन्दु", FEATURE_ORIGIN),
    ("अक्ष काटते हैं", FEATURE_ORIGIN),
    ("अक्षों का प्रतिच्छेदन", FEATURE_ORIGIN),
    ("मूल बिंदु", FEATURE_ORIGIN),
    ("मूल बिन्दु", FEATURE_ORIGIN),
    ("मूलबिंदु", FEATURE_ORIGIN),
    ("मूलबिन्दु", FEATURE_ORIGIN),
    ("અક્ષો ક્યાં છેદે છે", FEATURE_ORIGIN),
    ("અક્ષોનું છેદનબિંદુ", FEATURE_ORIGIN),
    ("અક્ષો ક્યાં મળે છે", FEATURE_ORIGIN),
    ("અક્ષો છેદે છે", FEATURE_ORIGIN),
    ("ઉદ્ભવ બિંદુ", FEATURE_ORIGIN),
    ("ઉદ્ભવબિંદુ", FEATURE_ORIGIN),
    # Right angle
    ("90 degree angle", FEATURE_RIGHT_ANGLE),
    ("90 degrees angle", FEATURE_RIGHT_ANGLE),
    ("90 degrees", FEATURE_RIGHT_ANGLE),
    ("90 degree", FEATURE_RIGHT_ANGLE),
    ("90° angle", FEATURE_RIGHT_ANGLE),
    ("90°", FEATURE_RIGHT_ANGLE),
    ("right angle", FEATURE_RIGHT_ANGLE),
    ("perpendicular", FEATURE_RIGHT_ANGLE),
    ("90 डिग्री का कोण", FEATURE_RIGHT_ANGLE),
    ("90 अंश का कोण", FEATURE_RIGHT_ANGLE),
    ("90 डिग्री", FEATURE_RIGHT_ANGLE),
    ("90 अंश", FEATURE_RIGHT_ANGLE),
    ("समकोण", FEATURE_RIGHT_ANGLE),
    ("90 ડિગ્રીનો ખૂણો", FEATURE_RIGHT_ANGLE),
    ("90 અંશનો ખૂણો", FEATURE_RIGHT_ANGLE),
    ("90 ડિગ્રી", FEATURE_RIGHT_ANGLE),
    ("90 અંશ", FEATURE_RIGHT_ANGLE),
    ("કાટખૂણો", FEATURE_RIGHT_ANGLE),
    # Longest side
    ("longest segment", FEATURE_LONGEST_SIDE),
    ("longest edge", FEATURE_LONGEST_SIDE),
    ("longest side", FEATURE_LONGEST_SIDE),
    ("largest side", FEATURE_LONGEST_SIDE),
    ("सबसे लंबा रेखाखंड", FEATURE_LONGEST_SIDE),
    ("सबसे लम्बा रेखाखंड", FEATURE_LONGEST_SIDE),
    ("सबसे लंबी भुजा", FEATURE_LONGEST_SIDE),
    ("सबसे बड़ी भुजा", FEATURE_LONGEST_SIDE),
    ("सबसे बडी भुजा", FEATURE_LONGEST_SIDE),
    ("સૌથી લાંબો રેખાખંડ", FEATURE_LONGEST_SIDE),
    ("સૌથી લાંબી બાજુ", FEATURE_LONGEST_SIDE),
    ("સૌથી મોટી બાજુ", FEATURE_LONGEST_SIDE),
]


def _base_lang(lang: str) -> str:
    """Return 'en', 'hi', or 'gu' for a BCP-47 language tag."""
    base = lang.split("-")[0].lower() if lang else "en"
    return base if base in ("en", "hi", "gu") else "en"


def normalize_semantic_text(text: str) -> str:
    """Normalize text for robust semantic feature matching.

    Handles:
    - Unicode NFKC normalization
    - Case folding (lower)
    - Chandrabindu (ँ / ઁ) mapped to anusvara (ं / ં)
    - Nukta marks (U+093C, U+0ABC) stripped so nukta variants match
    - Punctuation (Devanagari danda ।, double danda ॥, ?, quotes, etc.) replaced with space
    - Symbols (except °) and control characters replaced with space
    - Extra whitespace collapsed to single spaces
    - Preserves all Indic combining characters (matras, vowel signs, anusvara, virama)
    """
    if not text:
        return " "

    # 1. Unicode NFKC normalization
    normalized = unicodedata.normalize("NFKC", text)

    # 2. Case folding (lower)
    normalized = normalized.lower()

    # 3. Chandrabindu variants normalized to anusvara
    normalized = normalized.replace("\u0901", "\u0902").replace("\u0a81", "\u0a82")

    # 4. Nukta variants: decompose to NFD, strip nukta combining marks, recompose to NFC
    decomposed = unicodedata.normalize("NFD", normalized)
    no_nukta = decomposed.replace("\u093c", "").replace("\u0abc", "")
    normalized = unicodedata.normalize("NFC", no_nukta)

    # 5. Punctuation, controls, and symbols (except °) replaced with space
    cleaned_chars: list[str] = []
    for ch in normalized:
        if ch == "°":
            cleaned_chars.append(ch)
            continue
        cat = unicodedata.category(ch)
        if cat.startswith(("P", "C")) or cat.startswith("S"):
            cleaned_chars.append(" ")
        else:
            cleaned_chars.append(ch)

    # 6. Extra spaces collapsed
    collapsed = " ".join("".join(cleaned_chars).split())
    return f" {collapsed} "


# Build normalized phrase lookup table sorted by phrase length descending
_SEEN_PHRASES: set[str] = set()
_NORMALIZED_PHRASES: list[tuple[str, str]] = []

for _raw_phrase, _feat in _PHRASES:
    _norm = normalize_semantic_text(_raw_phrase).strip()
    if _norm and _norm not in _SEEN_PHRASES:
        _SEEN_PHRASES.add(_norm)
        _NORMALIZED_PHRASES.append((_norm, _feat))

_NORMALIZED_PHRASES.sort(key=lambda item: len(item[0]), reverse=True)


def match_semantic_feature(question: str) -> str | None:
    """Identify which semantic feature is requested, or None if non-semantic."""
    cleaned = normalize_semantic_text(question)
    for phrase, feature in _NORMALIZED_PHRASES:
        pattern = f" {phrase} "
        if pattern in cleaned:
            return feature
    return None


def coarse_position(x: float, y: float, lang: str = "en") -> str:
    """Describe normalized coordinates (x, y) coarsely: top/middle/bottom, left/centre/right."""
    base = _base_lang(lang)

    # Vertical coarse position
    if y < _GRID_LOW:
        vert = "top"
    elif y > _GRID_HIGH:
        vert = "bottom"
    else:
        vert = "middle"

    # Horizontal coarse position
    if x < _GRID_LOW:
        horiz = "left"
    elif x > _GRID_HIGH:
        horiz = "right"
    else:
        horiz = "centre"

    if base == "hi":
        vert_labels = {"top": "ऊपर", "middle": "मध्य", "bottom": "नीचे"}
        horiz_labels = {"left": "बाईं ओर", "centre": "मध्य", "right": "दाईं ओर"}
        if vert == "middle" and horiz == "centre":
            return "मध्य में"
        if horiz == "centre":
            return f"{vert_labels[vert]} मध्य में"
        if vert == "middle":
            return f"{horiz_labels[horiz]}"
        return f"{vert_labels[vert]} {horiz_labels[horiz]}"

    if base == "gu":
        vert_labels = {"top": "ઉપર", "middle": "મધ્ય", "bottom": "નીચે"}
        horiz_labels = {"left": "ડાબી બાજુ", "centre": "મધ્ય", "right": "જમણી બાજુ"}
        if vert == "middle" and horiz == "centre":
            return "મધ્યમાં"
        if horiz == "centre":
            return f"{vert_labels[vert]} મધ્યમાં"
        if vert == "middle":
            return f"{horiz_labels[horiz]}"
        return f"{vert_labels[vert]} {horiz_labels[horiz]}"

    # English default
    if vert == "middle" and horiz == "centre":
        return "centre"
    if horiz == "centre":
        return f"{vert} centre"
    if vert == "middle":
        return f"middle {horiz}"
    return f"{vert} {horiz}"


def _sanitize_spoken_answer(text: str) -> str:
    """Strip Unicode control/format characters (Cf, Cc, Zl, Zp) and clamp to 300 chars."""
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
    cleaned = "".join(chars).strip()
    if len(cleaned) > MAX_ANSWER_CHARS:
        cleaned = cleaned[: MAX_ANSWER_CHARS - 1].rsplit(" ", 1)[0].rstrip(",;:") + "."
    return cleaned


def _has_point_id(scene: DiagramScene, question: str) -> bool:
    """Check if the question names any point or element ID."""
    words = re.findall(r"[A-Za-z0-9]+", question)
    scene_ids: set[str] = set()
    for p in scene.points:
        scene_ids.add(p.id.lower())
    for s in scene.segments:
        scene_ids.add(s.id.lower())
        scene_ids.add(s.a.lower())
        scene_ids.add(s.b.lower())
    for poly in scene.polylines:
        scene_ids.add(poly.id.lower())
    for b in scene.bars:
        scene_ids.add(b.id.lower())

    for w in words:
        wl = w.lower()
        if wl in scene_ids:
            return True
        if 1 <= len(w) <= 3 and w.isalpha() and w.isupper() and w not in ("A", "I"):
            return True
    return False


def _find_peak(
    scene: DiagramScene,
    question: str = "",
) -> tuple[SemanticResult | None, tuple[float, float] | None, str | None]:
    """Find polyline vertex with smallest y across all polylines; ties: first in document order.

    F1: When no polylines exist (e.g. bar chart or geometry), falls back to bars or points.
    """
    best_pt: tuple[float, float] | None = None
    min_y = float("inf")

    for poly in scene.polylines:
        for pt in poly.points:
            py = float(pt[1])
            if py < min_y:
                min_y = py
                best_pt = (float(pt[0]), py)

    if best_pt is not None:
        cx = max(0.0, min(1.0, best_pt[0]))
        cy = max(0.0, min(1.0, best_pt[1]))
        target = SemanticResult(
            name=FEATURE_PEAK,
            target_kind="point",
            x=cx,
            y=cy,
            label="peak",
        )
        return target, (cx, cy), "peak"

    # F1 fallback: if no polylines (e.g. bar chart), fall back to tallest bar
    if scene.bars:
        return _find_tallest_bar(scene)

    # Geometry fallback: if points exist and question asks for highest point/vertex
    q_norm = normalize_semantic_text(question)
    wants_point = any(
        phrase in q_norm
        for phrase in (
            "highest point",
            "highest vertex",
            "top of",
            "top vertex",
            "सबसे ऊँचा बिंदु",
            "सबसे ऊंचा बिंदु",
            "सबसे ऊँचा बिन्दु",
            "सबसे ऊंचा बिन्दु",
            "शीर्ष",
            "સૌથી ઊંચું બિંદુ",
            "સૌથી ઊંચો બિંદુ",
            "ટોચ",
        )
    )
    if scene.points and wants_point:
        best_p = min(scene.points, key=lambda p: float(p.y))
        lbl = best_p.label if best_p.label else best_p.id
        target = SemanticResult(
            name=FEATURE_PEAK,
            target_kind="element",
            element_id=best_p.id,
            label=lbl,
        )
        return target, (float(best_p.x), float(best_p.y)), lbl

    return None, None, None


def _find_trough(
    scene: DiagramScene,
    question: str = "",
) -> tuple[SemanticResult | None, tuple[float, float] | None, str | None]:
    """Find polyline vertex with largest y across all polylines; ties: first in document order.

    F1: When no polylines exist (e.g. bar chart or geometry), falls back to bars or points.
    """
    best_pt: tuple[float, float] | None = None
    max_y = float("-inf")

    for poly in scene.polylines:
        for pt in poly.points:
            py = float(pt[1])
            if py > max_y:
                max_y = py
                best_pt = (float(pt[0]), py)

    if best_pt is not None:
        cx = max(0.0, min(1.0, best_pt[0]))
        cy = max(0.0, min(1.0, best_pt[1]))
        target = SemanticResult(
            name=FEATURE_TROUGH,
            target_kind="point",
            x=cx,
            y=cy,
            label="lowest point",
        )
        return target, (cx, cy), "lowest point"

    # F1 fallback: if no polylines (e.g. bar chart), fall back to shortest bar
    if scene.bars:
        return _find_shortest_bar(scene)

    # Geometry fallback: if points exist and question asks for lowest point/vertex
    q_norm = normalize_semantic_text(question)
    wants_point = any(
        phrase in q_norm
        for phrase in (
            "lowest point",
            "lowest vertex",
            "bottom of",
            "bottom vertex",
            "सबसे निचला बिंदु",
            "सबसे निचला बिन्दु",
            "निचला भाग",
            "तल",
            "સૌથી નીચું બિંદુ",
            "સૌથી નીચો બિંદુ",
            "તળિયું",
        )
    )
    if scene.points and wants_point:
        best_p = max(scene.points, key=lambda p: float(p.y))
        lbl = best_p.label if best_p.label else best_p.id
        target = SemanticResult(
            name=FEATURE_TROUGH,
            target_kind="element",
            element_id=best_p.id,
            label=lbl,
        )
        return target, (float(best_p.x), float(best_p.y)), lbl

    return None, None, None


def _find_origin(
    scene: DiagramScene,
) -> tuple[SemanticResult | None, tuple[float, float] | None, str | None]:
    """Find origin (where axes cross) when both axes are non-null."""
    if (
        scene.axes is not None
        and scene.axes.x_axis_y is not None
        and scene.axes.y_axis_x is not None
    ):
        ox = max(0.0, min(1.0, float(scene.axes.y_axis_x)))
        oy = max(0.0, min(1.0, float(scene.axes.x_axis_y)))
        target = SemanticResult(
            name=FEATURE_ORIGIN,
            target_kind="point",
            x=ox,
            y=oy,
            label="origin",
        )
        return target, (ox, oy), "origin"
    return None, None, None


def _find_tallest_bar(
    scene: DiagramScene,
) -> tuple[SemanticResult | None, tuple[float, float] | None, str | None]:
    """Find bar with maximum value; report ties and value/height order mismatches."""
    if not scene.bars:
        return None, None, None

    max_val = max(float(bar.value) for bar in scene.bars)
    tied_val_bars = [bar for bar in scene.bars if float(bar.value) == max_val]

    if len(tied_val_bars) > 1:
        labels = [b.label if b.label else b.id for b in tied_val_bars]
        labels_str = " and ".join(labels)
        first_bar = tied_val_bars[0]
        cx = (float(first_bar.x0) + float(first_bar.x1)) / 2.0
        cy = (float(first_bar.y_top) + float(first_bar.y_base)) / 2.0
        target = SemanticResult(
            name="tie_tallest_bar",
            target_kind="element",
            element_id=first_bar.id,
            label=labels_str,
        )
        return target, (cx, cy), labels_str

    best_bar = tied_val_bars[0]
    cx = (float(best_bar.x0) + float(best_bar.x1)) / 2.0
    cy = (float(best_bar.y_top) + float(best_bar.y_base)) / 2.0

    heights = [abs(float(b.y_base) - float(b.y_top)) for b in scene.bars]
    if max(heights) - min(heights) > 1e-4:
        tallest_by_height = max(
            scene.bars,
            key=lambda b: abs(float(b.y_base) - float(b.y_top)),
        )
        if best_bar.id != tallest_by_height.id:
            val_lbl = best_bar.label if best_bar.label else best_bar.id
            h_lbl = tallest_by_height.label if tallest_by_height.label else tallest_by_height.id
            combined_label = f"{val_lbl}|{h_lbl}"
            cx_h = (float(tallest_by_height.x0) + float(tallest_by_height.x1)) / 2.0
            cy_h = (float(tallest_by_height.y_top) + float(tallest_by_height.y_base)) / 2.0
            target = SemanticResult(
                name="mismatch_tallest_bar",
                target_kind="element",
                element_id=best_bar.id,
                label=combined_label,
            )
            return target, (cx_h, cy_h), combined_label

    target = SemanticResult(
        name=FEATURE_TALLEST_BAR,
        target_kind="element",
        element_id=best_bar.id,
        label=best_bar.label,
    )
    return target, (cx, cy), best_bar.label


def _find_shortest_bar(
    scene: DiagramScene,
) -> tuple[SemanticResult | None, tuple[float, float] | None, str | None]:
    """Find bar with minimum value; report ties and value/height order mismatches."""
    if not scene.bars:
        return None, None, None

    min_val = min(float(bar.value) for bar in scene.bars)
    tied_val_bars = [bar for bar in scene.bars if float(bar.value) == min_val]

    if len(tied_val_bars) > 1:
        labels = [b.label if b.label else b.id for b in tied_val_bars]
        labels_str = " and ".join(labels)
        first_bar = tied_val_bars[0]
        cx = (float(first_bar.x0) + float(first_bar.x1)) / 2.0
        cy = (float(first_bar.y_top) + float(first_bar.y_base)) / 2.0
        target = SemanticResult(
            name="tie_shortest_bar",
            target_kind="element",
            element_id=first_bar.id,
            label=labels_str,
        )
        return target, (cx, cy), labels_str

    best_bar = tied_val_bars[0]
    cx = (float(best_bar.x0) + float(best_bar.x1)) / 2.0
    cy = (float(best_bar.y_top) + float(best_bar.y_base)) / 2.0

    heights = [abs(float(b.y_base) - float(b.y_top)) for b in scene.bars]
    if max(heights) - min(heights) > 1e-4:
        shortest_by_height = min(
            scene.bars,
            key=lambda b: abs(float(b.y_base) - float(b.y_top)),
        )
        if best_bar.id != shortest_by_height.id:
            val_lbl = best_bar.label if best_bar.label else best_bar.id
            h_lbl = shortest_by_height.label if shortest_by_height.label else shortest_by_height.id
            combined_label = f"{val_lbl}|{h_lbl}"
            cx_h = (float(shortest_by_height.x0) + float(shortest_by_height.x1)) / 2.0
            cy_h = (float(shortest_by_height.y_top) + float(shortest_by_height.y_base)) / 2.0
            target = SemanticResult(
                name="mismatch_shortest_bar",
                target_kind="element",
                element_id=best_bar.id,
                label=combined_label,
            )
            return target, (cx_h, cy_h), combined_label

    target = SemanticResult(
        name=FEATURE_SHORTEST_BAR,
        target_kind="element",
        element_id=best_bar.id,
        label=best_bar.label,
    )
    return target, (cx, cy), best_bar.label


def _find_right_angle(
    scene: DiagramScene,
) -> tuple[SemanticResult | None, tuple[float, float] | None, str | None]:
    """Find point with exactly two incident segments forming an angle within 90 +/- 3 degrees."""
    point_map = {p.id: p for p in scene.points}
    aspect = float(getattr(scene, "aspect", 1.0) or 1.0)
    if not math.isfinite(aspect) or aspect <= 0.0:
        aspect = 1.0
    else:
        aspect = max(0.05, min(20.0, aspect))

    for p in scene.points:
        incident = [s for s in scene.segments if s.a == p.id or s.b == p.id]
        if len(incident) != 2:
            continue
        s1, s2 = incident[0], incident[1]
        other1_id = s1.b if s1.a == p.id else s1.a
        other2_id = s2.b if s2.a == p.id else s2.a
        if other1_id not in point_map or other2_id not in point_map:
            continue

        p1 = point_map[other1_id]
        p2 = point_map[other2_id]
        v1 = ((float(p1.x) - float(p.x)) * aspect, float(p1.y) - float(p.y))
        v2 = ((float(p2.x) - float(p.x)) * aspect, float(p2.y) - float(p.y))
        len1 = math.hypot(v1[0], v1[1])
        len2 = math.hypot(v2[0], v2[1])
        if len1 <= 1e-9 or len2 <= 1e-9:
            continue

        dot = v1[0] * v2[0] + v1[1] * v2[1]
        denom = len1 * len2
        if not math.isfinite(dot) or not math.isfinite(denom) or denom <= 0.0:
            continue
        ratio = dot / denom
        if not math.isfinite(ratio):
            continue
        cos_theta = max(-1.0, min(1.0, ratio))
        angle_deg = math.degrees(math.acos(cos_theta))
        if 87.0 <= angle_deg <= 93.0:
            label = p.label if p.label else p.id
            target = SemanticResult(
                name=FEATURE_RIGHT_ANGLE,
                target_kind="element",
                element_id=p.id,
                label=label,
            )
            return target, (float(p.x), float(p.y)), label

    return None, None, None


def _find_longest_side(
    scene: DiagramScene,
) -> tuple[SemanticResult | None, tuple[float, float] | None, str | None]:
    """Find segment with maximum Euclidean length; ties: first in document order."""
    point_map = {p.id: p for p in scene.points}
    aspect = float(getattr(scene, "aspect", 1.0) or 1.0)
    if not math.isfinite(aspect) or aspect <= 0.0:
        aspect = 1.0
    else:
        aspect = max(0.05, min(20.0, aspect))
    best_seg = None
    max_len = -1.0

    for seg in scene.segments:
        if seg.a not in point_map or seg.b not in point_map:
            continue
        pa = point_map[seg.a]
        pb = point_map[seg.b]
        dx = (float(pb.x) - float(pa.x)) * aspect
        dy = float(pb.y) - float(pa.y)
        length = math.hypot(dx, dy)
        if length > max_len:
            max_len = length
            best_seg = seg

    if best_seg is None:
        return None, None, None

    pa = point_map[best_seg.a]
    pb = point_map[best_seg.b]
    mx = (float(pa.x) + float(pb.x)) / 2.0
    my = (float(pa.y) + float(pb.y)) / 2.0
    label = best_seg.label if best_seg.label else best_seg.id
    target = SemanticResult(
        name=FEATURE_LONGEST_SIDE,
        target_kind="element",
        element_id=best_seg.id,
        label=label,
    )
    return target, (mx, my), label


def _build_answer(
    feature: str,
    target: SemanticResult | None,
    coords: tuple[float, float] | None,
    label: str | None,
    lang: str,
) -> str:
    """Format short spoken answer describing target position coarsely or explaining absence."""
    base = _base_lang(lang)

    if target is None or coords is None:
        # Absence messages per contract ("There is no X in this diagram.")
        if base == "hi":
            absence_hi = {
                FEATURE_PEAK: "इस आरेख में कोई शिखर नहीं है।",
                FEATURE_TROUGH: "इस आरेख में कोई निचला बिंदु नहीं है।",
                FEATURE_ORIGIN: "इस आरेख में कोई मूल बिंदु नहीं है।",
                FEATURE_TALLEST_BAR: "इस आरेख में कोई बार नहीं है।",
                FEATURE_SHORTEST_BAR: "इस आरेख में कोई बार नहीं है।",
                FEATURE_RIGHT_ANGLE: "इस आरेख में कोई समकोण नहीं है।",
                FEATURE_LONGEST_SIDE: "इस आरेख में कोई भुजा नहीं है।",
            }
            return _sanitize_spoken_answer(absence_hi.get(feature, "इस आरेख में यह ज्ञात नहीं है।"))

        if base == "gu":
            absence_gu = {
                FEATURE_PEAK: "આ આકૃતિમાં કોઈ શિખર નથી.",
                FEATURE_TROUGH: "આ આકૃતિમાં કોઈ નીચું બિંદુ નથી.",
                FEATURE_ORIGIN: "આ આકૃતિમાં કોઈ ઉદ્ભવ બિંદુ નથી.",
                FEATURE_TALLEST_BAR: "આ આકૃતિમાં કોઈ બાર નથી.",
                FEATURE_SHORTEST_BAR: "આ આકૃતિમાં કોઈ બાર નથી.",
                FEATURE_RIGHT_ANGLE: "આ આકૃતિમાં કોઈ કાટખૂણો નથી.",
                FEATURE_LONGEST_SIDE: "આ આકૃતિમાં કોઈ બાજુ નથી.",
            }
            return _sanitize_spoken_answer(absence_gu.get(feature, "આ આકૃતિ પરથી આની જાણ નથી."))

        absence_en = {
            FEATURE_PEAK: "There is no peak in this diagram.",
            FEATURE_TROUGH: "There is no lowest point in this diagram.",
            FEATURE_ORIGIN: "There is no origin in this diagram.",
            FEATURE_TALLEST_BAR: "There are no bars in this diagram.",
            FEATURE_SHORTEST_BAR: "There are no bars in this diagram.",
            FEATURE_RIGHT_ANGLE: "There is no right angle in this diagram.",
            FEATURE_LONGEST_SIDE: "There are no sides in this diagram.",
        }
        return _sanitize_spoken_answer(absence_en.get(feature, "I don't know from this diagram."))

    pos = coarse_position(coords[0], coords[1], lang)

    # F10: Tie in tallest or shortest bar
    if target.name == "tie_tallest_bar":
        if base == "hi":
            return _sanitize_spoken_answer(f"सबसे ऊँचे बार में {label} के बीच बराबरी है।")
        if base == "gu":
            return _sanitize_spoken_answer(f"સૌથી ઊંચા બારમાં {label} વચ્ચે બરાબરી છે.")
        return _sanitize_spoken_answer(f"There is a tie for the tallest bar between {label}.")

    if target.name == "tie_shortest_bar":
        if base == "hi":
            return _sanitize_spoken_answer(f"सबसे छोटे बार में {label} के बीच बराबरी है।")
        if base == "gu":
            return _sanitize_spoken_answer(f"સૌથી નાના બારમાં {label} વચ્ચે બરાબરી છે.")
        return _sanitize_spoken_answer(f"There is a tie for the shortest bar between {label}.")

    # F10: Value order versus height order mismatch
    if target.name == "mismatch_tallest_bar":
        val_lbl, h_lbl = (label or "|").split("|", 1)
        if base == "hi":
            return _sanitize_spoken_answer(
                f"मान के अनुसार सबसे ऊँचा बार {val_lbl} है, लेकिन ऊँचाई में {pos} पर {h_lbl} सबसे बड़ा है।"
            )
        if base == "gu":
            return _sanitize_spoken_answer(
                f"મૂલ્ય મુજબ સૌથી ઊંચો બાર {val_lbl} છે, પરંતુ ઊંચાઈમાં {pos} પર {h_lbl} સૌથી મોટો છે."
            )
        return _sanitize_spoken_answer(
            f"The tallest bar by value is {val_lbl}, but {h_lbl} is tallest in height at the {pos}."
        )

    if target.name == "mismatch_shortest_bar":
        val_lbl, h_lbl = (label or "|").split("|", 1)
        if base == "hi":
            return _sanitize_spoken_answer(
                f"मान के अनुसार सबसे छोटा बार {val_lbl} है, लेकिन ऊँचाई में {pos} पर {h_lbl} सबसे छोटा है।"
            )
        if base == "gu":
            return _sanitize_spoken_answer(
                f"મૂલ્ય મુજબ સૌથી નાનો બાર {val_lbl} છે, પરંતુ ઊંચાઈમાં {pos} પર {h_lbl} સૌથી નાનો છે."
            )
        return _sanitize_spoken_answer(
            f"The shortest bar by value is {val_lbl}, "
            f"but {h_lbl} is shortest in height at the {pos}."
        )

    # Bar answers (or peak/trough fallback to bars)
    if target.name == FEATURE_TALLEST_BAR:
        lbl = f" {label}" if label else ""
        if base == "hi":
            return _sanitize_spoken_answer(f"सबसे ऊँचा बार{lbl}, {pos} है।")
        if base == "gu":
            return _sanitize_spoken_answer(f"સૌથી ઊંચો બાર{lbl}, {pos} છે.")
        return _sanitize_spoken_answer(f"The tallest bar{lbl} is at the {pos}.")

    if target.name == FEATURE_SHORTEST_BAR:
        lbl = f" {label}" if label else ""
        if base == "hi":
            return _sanitize_spoken_answer(f"सबसे छोटा बार{lbl}, {pos} है।")
        if base == "gu":
            return _sanitize_spoken_answer(f"સૌથી નાનો બાર{lbl}, {pos} છે.")
        return _sanitize_spoken_answer(f"The shortest bar{lbl} is at the {pos}.")

    # F1 point fallback for highest/lowest vertex
    if target.name == FEATURE_PEAK and target.target_kind == "element":
        lbl = f" {label}" if label else ""
        if base == "hi":
            return _sanitize_spoken_answer(f"सबसे ऊँचा बिंदु{lbl}, {pos} है।")
        if base == "gu":
            return _sanitize_spoken_answer(f"સૌથી ઊંચું બિંદુ{lbl}, {pos} છે.")
        return _sanitize_spoken_answer(f"The highest point{lbl} is at the {pos}.")

    if target.name == FEATURE_TROUGH and target.target_kind == "element":
        lbl = f" {label}" if label else ""
        if base == "hi":
            return _sanitize_spoken_answer(f"सबसे निचला बिंदु{lbl}, {pos} है।")
        if base == "gu":
            return _sanitize_spoken_answer(f"સૌથી નીચું બિંદુ{lbl}, {pos} છે.")
        return _sanitize_spoken_answer(f"The lowest point{lbl} is at the {pos}.")

    if base == "hi":
        if feature == FEATURE_PEAK:
            return _sanitize_spoken_answer(f"शिखर {pos} है।")
        if feature == FEATURE_TROUGH:
            return _sanitize_spoken_answer(f"सबसे निचला बिंदु {pos} है।")
        if feature == FEATURE_ORIGIN:
            return _sanitize_spoken_answer(f"मूल बिंदु {pos} है।")
        if feature == FEATURE_RIGHT_ANGLE:
            lbl = f" {label}" if label else ""
            return _sanitize_spoken_answer(f"समकोण बिंदु{lbl} पर {pos} है।")
        if feature == FEATURE_LONGEST_SIDE:
            lbl = f" {label}" if label else ""
            return _sanitize_spoken_answer(f"सबसे लंबी भुजा{lbl}, {pos} है।")

    if base == "gu":
        if feature == FEATURE_PEAK:
            return _sanitize_spoken_answer(f"શિખર {pos} છે.")
        if feature == FEATURE_TROUGH:
            return _sanitize_spoken_answer(f"સૌથી નીચું બિંદુ {pos} છે.")
        if feature == FEATURE_ORIGIN:
            return _sanitize_spoken_answer(f"ઉદ્ભવ બિંદુ {pos} છે.")
        if feature == FEATURE_RIGHT_ANGLE:
            lbl = f" {label}" if label else ""
            return _sanitize_spoken_answer(f"કાટખૂણો બિંદુ{lbl} પર {pos} છે.")
        if feature == FEATURE_LONGEST_SIDE:
            lbl = f" {label}" if label else ""
            return _sanitize_spoken_answer(f"સૌથી લાંબી બાજુ{lbl}, {pos} છે.")

    # English default
    if feature == FEATURE_PEAK:
        return _sanitize_spoken_answer(f"The peak is at the {pos}.")
    if feature == FEATURE_TROUGH:
        return _sanitize_spoken_answer(f"The lowest point is at the {pos}.")
    if feature == FEATURE_ORIGIN:
        return _sanitize_spoken_answer(f"The origin is at the {pos}.")
    if feature == FEATURE_RIGHT_ANGLE:
        lbl = f" {label}" if label else ""
        return _sanitize_spoken_answer(f"The right angle at point{lbl} is at the {pos}.")
    if feature == FEATURE_LONGEST_SIDE:
        lbl = f" {label}" if label else ""
        return _sanitize_spoken_answer(f"The longest side{lbl} is at the {pos}.")

    return _sanitize_spoken_answer(f"The target is at the {pos}.")


def semantic_target(
    scene: DiagramScene,
    question: str,
    lang: str = "en",
) -> SemanticResult | None:
    """Resolve the semantic target for a question on scene, or None if not found/applicable."""
    feature = match_semantic_feature(question)
    if feature is None:
        return None

    # F11: If right angle query names a point ID, bypass semantic path so facts / LLM can answer
    if feature == FEATURE_RIGHT_ANGLE and _has_point_id(scene, question):
        return None

    if feature == FEATURE_PEAK:
        target, _, _ = _find_peak(scene, question)
    elif feature == FEATURE_TROUGH:
        target, _, _ = _find_trough(scene, question)
    elif feature == FEATURE_ORIGIN:
        target, _, _ = _find_origin(scene)
    elif feature == FEATURE_TALLEST_BAR:
        target, _, _ = _find_tallest_bar(scene)
    elif feature == FEATURE_SHORTEST_BAR:
        target, _, _ = _find_shortest_bar(scene)
    elif feature == FEATURE_RIGHT_ANGLE:
        target, _, _ = _find_right_angle(scene)
    elif feature == FEATURE_LONGEST_SIDE:
        target, _, _ = _find_longest_side(scene)
    else:
        target = None

    if target is None:
        # F1: On geometry without curves/bars, do not claim absence of peak for maximum/minimum
        q_norm = normalize_semantic_text(question)
        is_max_min = any(
            w in q_norm for w in ("maximum", "minimum", "अधिकतम", "न्यूनतम", "મહત્તમ", "ન્યૂનતમ")
        )
        if is_max_min and not scene.polylines and not scene.bars:
            return None

    return target


def semantic_spoken_answer(
    scene: DiagramScene,
    question: str,
    lang: str = "en",
) -> str | None:
    """Return spoken coarse position or absence answer if question is semantic, else None."""
    res = semantic_ask(scene, question, lang)
    return res[0] if res is not None else None


def semantic_ask(
    scene: DiagramScene,
    question: str,
    lang: str = "en",
) -> tuple[str, SemanticResult | None] | None:
    """Execute complete semantic check.

    Returns (spoken_answer, target) if question is semantic (even if target is None),
    or None if the question is non-semantic.
    """
    feature = match_semantic_feature(question)
    if feature is None:
        return None

    # F11: If right angle query names a point ID, bypass semantic path so facts / LLM can answer
    if feature == FEATURE_RIGHT_ANGLE and _has_point_id(scene, question):
        return None

    if feature == FEATURE_PEAK:
        target, coords, label = _find_peak(scene, question)
    elif feature == FEATURE_TROUGH:
        target, coords, label = _find_trough(scene, question)
    elif feature == FEATURE_ORIGIN:
        target, coords, label = _find_origin(scene)
    elif feature == FEATURE_TALLEST_BAR:
        target, coords, label = _find_tallest_bar(scene)
    elif feature == FEATURE_SHORTEST_BAR:
        target, coords, label = _find_shortest_bar(scene)
    elif feature == FEATURE_RIGHT_ANGLE:
        target, coords, label = _find_right_angle(scene)
    elif feature == FEATURE_LONGEST_SIDE:
        target, coords, label = _find_longest_side(scene)
    else:
        target, coords, label = None, None, None

    if target is None:
        # F1: On geometry without curves/bars, do not answer 'There is no peak' for maximum/minimum
        q_norm = normalize_semantic_text(question)
        is_max_min = any(
            w in q_norm for w in ("maximum", "minimum", "अधिकतम", "न्यूनतम", "મહત્તમ", "ન્યૂનતમ")
        )
        if is_max_min and not scene.polylines and not scene.bars:
            return None

    answer = _build_answer(feature, target, coords, label, lang)
    return answer, target
