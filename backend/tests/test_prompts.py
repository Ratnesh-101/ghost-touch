"""Tests for vision prompt builder (Task 8.2)."""

from __future__ import annotations

from app.vision.prompts import build_prompt


def test_build_prompt_includes_schema_and_teacher_vocabulary() -> None:
    prompt = build_prompt()
    assert "DiagramScene" in prompt or "properties" in prompt
    assert "hypotenuse" in prompt
    assert "vertex B" in prompt
    assert "Never label an element by its appearance" in prompt
    assert "long blue line" in prompt


def test_build_prompt_with_errors_appends_feedback() -> None:
    errors = [
        "segment s1: label 'blue polygon' describes appearance, not a teacher term",
        "Point coordinate out of range: x=1.5",
    ]
    prompt = build_prompt(errors)
    assert "Your previous JSON was invalid:" in prompt
    assert "segment s1: label 'blue polygon'" in prompt
    assert "Point coordinate out of range: x=1.5" in prompt
    assert "Use the vocabulary a teacher would use" in prompt
