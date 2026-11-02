"""Prompt builder for STEM diagram extraction (Task 8.2, F2).

Provides the extraction prompt with DiagramScene JSON schema and
teacher vocabulary rules (TouchSight lessons), plus retry prompt with capped validation errors.
"""

from __future__ import annotations

import json

from app.schema import DiagramScene

BASE_PROMPT_TEMPLATE = (
    "You convert images of school STEM diagrams into JSON for a "
    "touch-and-vibration app used by blind students.\n"
    "Return ONLY JSON matching this schema: {schema}\n"
    "Rules:\n"
    "- Coordinates are normalized to [0,1], origin top-left, relative to diagram bounding box.\n"
    "- kind: geometry | function_graph | bar_chart | unknown.\n"
    "- geometry: every labeled corner is a point; every drawn edge is a segment between\n"
    "  point ids.\n"
    "- function_graph: sample each curve as a polyline of 40-150 points; set axes.\n"
    "- bar_chart: one bar per bar with label and numeric value.\n"
    "- Put every given measurement or relation from the image into 'facts' as short sentences.\n"
    "- Do not invent labels or values that are not visible. If unsure, use kind 'unknown'.\n"
    "- Label things the way a maths or science teacher would say them aloud, using standard\n"
    "  terms: 'hypotenuse', 'vertex B', 'right angle at B', 'x-axis', 'radius', 'parallel to AB'.\n"
    "  Prefer the label printed in the diagram (A, B, C, 'AB', 'h') and add the role when clear\n"
    "  ('hypotenuse AC').\n"
    "- Never label an element by its appearance. Colours, line styles and generic shape words are\n"
    "  not labels: not 'blue polygon', 'red line', 'dotted shape', 'green circle thing'.\n"
    "  Example: use 'hypotenuse AC', never 'long blue line'.\n"
    "- If an element has no printed label and no standard name, leave its label empty. An empty\n"
    "  label is better than an appearance label.\n"
    "- Put standard names in labels and facts in plain words ('angle B = 90°'), never visual "
    "descriptions."
)


def build_prompt(errors: list[str] | None = None) -> str:
    """Build the vision extraction prompt, optionally with capped validation retry feedback."""
    schema_json = json.dumps(DiagramScene.model_json_schema())
    prompt = BASE_PROMPT_TEMPLATE.replace("{schema}", schema_json)

    if errors:
        # Finding 11: cap number of error lines to 5 and line length to 150 chars
        capped_errors = [f"- {err[:150]}" for err in errors[:5]]
        error_lines = "\n".join(capped_errors)
        prompt += (
            f"\n\nYour previous JSON was invalid:\n{error_lines}\n"
            "Return corrected JSON only.\n"
            "Use the vocabulary a teacher would use; remove colour and shape descriptions "
            "from labels."
        )

    return prompt
