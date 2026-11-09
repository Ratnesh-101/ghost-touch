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
