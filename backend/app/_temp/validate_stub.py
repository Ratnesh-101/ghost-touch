# TEMP-STUB: replaced by app/validate.py (Task 8.3, Kiro). Do not extend.
from __future__ import annotations

import json
from typing import Any, NamedTuple

from pydantic import ValidationError

from app.schema import DiagramScene


class ValidationResult(NamedTuple):
    scene: DiagramScene | None
    errors: list[str]  # empty iff scene is not None


def validate_scene(raw: str | dict[str, Any]) -> ValidationResult:
    """Validate raw LLM output or dict against DiagramScene without repair rules.

    Never raises an exception, even on invalid JSON or arbitrary garbage.
    """
    if isinstance(raw, str):
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                import re

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
            scene=None,
            errors=[f"Expected str or dict, got {type(raw).__name__}"],
        )

    try:
        scene = DiagramScene.model_validate(data)
        return ValidationResult(scene=scene, errors=[])
    except (ValidationError, ValueError) as exc:
        return ValidationResult(scene=None, errors=[str(exc)])
    except Exception as exc:
        return ValidationResult(scene=None, errors=[f"Unexpected error: {exc}"])
