"""validate_scene must never raise on a wrongly typed top-level list field (Requirement 5, P9).

P9 found this on a random draw: the raw-input bookkeeping added in lane k3 iterated
``data.get("facts", [])`` and ``data.get("segments", [])`` before any type check, so a model
answer with ``"facts": 3`` or ``"segments": 7`` raised ``TypeError`` instead of being rejected.
"""

from __future__ import annotations

from typing import Any

import pytest

from app.validate import validate_scene


def _scene(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "version": 1,
        "kind": "geometry",
        "points": [{"id": "A", "x": 0.1, "y": 0.1}, {"id": "B", "x": 0.9, "y": 0.9}],
        "segments": [{"id": "s0", "a": "A", "b": "B"}],
    }
    base.update(overrides)
    return base


@pytest.mark.parametrize("field", ["facts", "segments"])
@pytest.mark.parametrize("bad", [3, 2.5, True, "AB = 5", {"a": 1}])
def test_wrongly_typed_list_field_does_not_raise(field: str, bad: object) -> None:
    result = validate_scene(_scene(**{field: bad}))
    # Never raises; the result is either a clean rejection or a scene without that field's junk.
    assert result.scene is not None or result.errors


def test_facts_as_int_is_handled_like_any_other_bad_value() -> None:
    result = validate_scene(_scene(facts=3))
    assert result.scene is not None or result.errors
