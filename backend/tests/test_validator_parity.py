"""Validator parity, backend side (Kiro, task 37.3).

Runs every case in ``fixtures/validator_parity.json`` through ``validate_scene``. The same file
is run through the share validator by ``frontend/tests/validator.parity.test.ts``. A case marked
``known_mismatch`` records what this side gives today (``backend``), so the suite stays green and
any change in either validator shows up here. Mismatches are written up in
``docs/reports/validator-parity.md``.
"""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any

import pytest

from app.validate import validate_scene

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "validator_parity.json"
CASES: list[dict[str, Any]] = json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]

# Backend error text -> fixture reason key. First match wins.
REASONS: tuple[tuple[str, str], ...] = (
    (r"Validation dropped", "dropped_referenced"),
    (r"too many points", "too_many_points"),
    (r"too many facts", "too_many_facts"),
    (r"too many bars", "too_many_bars"),
    (r"polyline has more than", "polyline_too_long"),
    (r"no drawable elements", "no_drawable"),
    (r"colour or generic shape", "colour_only_label"),
    (r"empty id", "empty_id"),
    (r"(?s)version.*(Input should be 1|literal)", "bad_version"),
    (r"(?s)kind.*Input should be", "invalid_kind"),
)


def reason_of(errors: list[str]) -> str:
    text = "\n".join(errors)
    for pattern, key in REASONS:
        if re.search(pattern, text):
            return key
    return "unclassified: " + text[:200]


def test_fixture_is_well_formed() -> None:
    names = [c["name"] for c in CASES]
    assert len(names) == len(set(names)), "case names must be unique"
    assert len(CASES) >= 20
    for c in CASES:
        assert c["expected"]["verdict"] in ("accept", "reject")
        if c["expected"]["verdict"] == "reject":
            assert c["expected"].get("reason"), c["name"]
        if c.get("known_mismatch"):
            assert c["backend"] != c["frontend"], f"{c['name']}: not a mismatch"


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_backend_verdict(case: dict[str, Any]) -> None:
    want = case["backend"] if case.get("known_mismatch") else case["expected"]
    result = validate_scene(copy.deepcopy(case["scene"]))  # validate_scene edits its input
    got = "accept" if result.scene is not None else "reject"
    assert got == want["verdict"], f"{case['name']}: {result.errors}"
    if got == "reject":
        assert reason_of(result.errors) == want["reason"], result.errors


# Lane a1 oracle (Kiro, task 40.3, Requirement 24.2). Same list as RESERVED_ELEMENT_IDS in
# frontend/src/core/correct.ts. Red until lane a1 renames reserved ids in validate.py.
RESERVED_IDS = frozenset(
    {
        "title",
        "scene:title",
        "__proto__",
        "constructor",
        "prototype",
        "tostring",
        "valueof",
        "hasownproperty",
        "isprototypeof",
        "propertyisenumerable",
        "tolocalestring",
    }
)
STRUCTURAL = [c for c in CASES if c.get("structural")]


def _position_pairs(points: list[Any], segments: list[Any]) -> list[tuple[Any, ...]]:
    def get(o: Any, k: str) -> Any:
        return o[k] if isinstance(o, dict) else getattr(o, k)

    where = {get(p, "id"): (get(p, "x"), get(p, "y")) for p in points}
    return sorted(tuple(sorted((where[get(s, "a")], where[get(s, "b")]))) for s in segments)


@pytest.mark.parametrize("case", STRUCTURAL, ids=[c["name"] for c in STRUCTURAL])
def test_backend_reserved_ids_renamed_and_segments_kept(case: dict[str, Any]) -> None:
    raw = case["scene"]
    result = validate_scene(copy.deepcopy(raw))
    assert result.scene is not None, result.errors
    s = result.scene
    ids = [e.id for e in (*s.points, *s.segments, *s.polylines, *s.bars)]
    assert len(ids) == len(set(ids)), f"duplicate ids: {ids}"
    reserved = [i for i in ids if i.strip().lower() in RESERVED_IDS]
    assert reserved == [], f"reserved ids left: {reserved}"
    assert len(s.segments) == len(raw["segments"])
    assert _position_pairs(s.points, s.segments) == _position_pairs(raw["points"], raw["segments"])
