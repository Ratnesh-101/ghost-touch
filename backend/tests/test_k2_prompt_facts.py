"""Tests for structured fact format in extraction prompt (Lane k2-prompt-facts).

Asserts:
- Every exact fact shape is present in the prompt.
- 'not to scale' rule is present.
- 'PRINTED in the image; never compute or invent' and points-id consistency rules are present.
- Schema placeholder and JSON-only instructions are preserved.
- The contradiction phrase 'as short sentences' next to the facts rule is resolved.
- Teacher vocabulary rules and coordinate rules are preserved semantically.
- Prompt stays strictly under the provider length budget.
- Existing prompt test assertions continue to pass.
"""

from __future__ import annotations

import json
import re

from app.schema import DiagramScene
from app.vision.prompts import BASE_PROMPT_TEMPLATE, build_prompt

# Maximum character budget for extraction prompt (providers comfortably support up to 24k)
MAX_PROMPT_CHARS_BUDGET = 24_000


def test_prompt_contains_all_fact_shape_examples() -> None:
    """The extraction prompt must ask for each of the exact fact shapes."""
    prompt = build_prompt()

    assert "AB = 3 cm" in prompt
    assert "angle B = 90°" in prompt
    assert "label: 35" in prompt
    assert "AB is parallel to CD" in prompt
    assert "AB = CD" in prompt
    assert "or a short sentence only for relations that fit no shape" in prompt


def test_prompt_contains_not_to_scale_rule() -> None:
    """If the figure says 'not drawn to scale' the fact 'not to scale' must be added."""
    prompt = build_prompt()

    assert "not drawn to scale" in prompt
    assert "not to scale" in prompt


def test_prompt_contains_printed_measurements_and_ids_rule() -> None:
    """Prompt forbids computing or inventing, and requires identical point ids."""
    prompt = build_prompt()

    assert "Copy only measurements and relations PRINTED in the image" in prompt
    assert "never compute or invent" in prompt
    assert "Keep ids identical to the 'points' ids" in prompt


def test_prompt_preserves_schema_and_json_only_and_do_not_invent() -> None:
    """Prompt retains schema substitution, JSON-only constraint, and do-not-invent rule."""
    assert "{schema}" in BASE_PROMPT_TEMPLATE

    prompt = build_prompt()
    assert "Return ONLY JSON" in prompt
    assert "DiagramScene" in prompt or "properties" in prompt
    assert "Do not invent labels or values that are not visible" in prompt
    assert "If unsure, use kind 'unknown'" in prompt


def test_prompt_has_no_short_sentences_contradiction() -> None:
    """The old contradictory instruction 'into 'facts' as short sentences' must be gone.

    Short sentences are only permitted as a fallback for relations fitting no shape.
    """
    prompt = build_prompt()

    assert "into 'facts' as short sentences" not in prompt
    assert "in 'facts' as short sentences" not in prompt
    assert "as short sentences" not in prompt

    # Verify that the only occurrence of "short sentence" is the fallback clause
    matches = re.findall(r"short sentence[s]?", prompt, re.IGNORECASE)
    assert len(matches) == 1
    assert "or a short sentence only for relations that fit no shape" in prompt


def test_prompt_preserves_coordinate_and_kind_rules() -> None:
    """Coordinate normalization and kind rules must remain semantically unchanged."""
    prompt = build_prompt()

    assert "Coordinates are normalized to [0,1]" in prompt
    assert "kind: geometry | function_graph | bar_chart | unknown" in prompt
    assert "sample each curve as a polyline of 40-150 points" in prompt
    assert "one bar per bar with label and numeric value" in prompt


def test_prompt_preserves_teacher_vocabulary() -> None:
    """Teacher vocabulary and appearance-label rejection must remain intact."""
    prompt = build_prompt()

    assert "hypotenuse" in prompt
    assert "vertex B" in prompt
    assert "hypotenuse AC" in prompt
    assert "Never label an element by its appearance" in prompt
    assert "long blue line" in prompt
    assert "blue polygon" in prompt


def test_prompt_length_within_budget() -> None:
    """Prompt must stay well within provider length budget."""
    base_prompt = build_prompt()
    assert len(base_prompt) < MAX_PROMPT_CHARS_BUDGET
    # Also verify it stays reasonably compact (under 8,000 characters)
    assert len(base_prompt) < 8_000

    errors = ["Error line 1", "Error line 2"]
    retry_prompt = build_prompt(errors)
    assert len(retry_prompt) < MAX_PROMPT_CHARS_BUDGET


def test_prompt_json_schema_is_valid() -> None:
    """The schema injected into the prompt must be valid JSON matching DiagramScene."""
    schema_dict = DiagramScene.model_json_schema()
    schema_str = json.dumps(schema_dict)
    prompt = build_prompt()

    assert schema_str in prompt


def test_existing_prompts_test_assertions_pass() -> None:
    """Verify all assertions from backend/tests/test_prompts.py pass against current prompt."""
    prompt = build_prompt()
    assert "DiagramScene" in prompt or "properties" in prompt
    assert "hypotenuse" in prompt
    assert "vertex B" in prompt
    assert "Never label an element by its appearance" in prompt
    assert "long blue line" in prompt

    errors = [
        "segment s1: label 'blue polygon' describes appearance, not a teacher term",
        "Point coordinate out of range: x=1.5",
    ]
    retry_prompt = build_prompt(errors)
    assert "Your previous JSON was invalid:" in retry_prompt
    assert "segment s1: label 'blue polygon'" in retry_prompt
    assert "Point coordinate out of range: x=1.5" in retry_prompt
    assert "Use the vocabulary a teacher would use" in retry_prompt
