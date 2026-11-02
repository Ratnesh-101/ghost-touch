"""The equation route: ask the model for the graph SPEC, sample the curve ourselves.

Used by the scene pipeline (a) to upgrade a traced function graph and (b) as a last attempt
before Raw Mode when the normal extraction could not produce a valid scene.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from app.graphs.sample import GraphSpecError, build_graph_scene, parse_graph_spec
from app.vision._openai_compat import strip_fences
from app.vision.base import VisionError
from app.vision.chain import ProviderChain

logger = logging.getLogger(__name__)

MIN_SECONDS_LEFT = 2.5  # do not start a model call that cannot finish inside the budget

GRAPH_PROMPT = """You read images of school graphs of functions for a touch app used by blind
students.
Return ONLY one JSON object, no prose, with exactly these keys:
{
  "equation": string or null,
  "x_min": number, "x_max": number, "y_min": number, "y_max": number,
  "x_ticks": [numbers], "y_ticks": [numbers],
  "title": string or null
}
Rules:
- "equation" is the main plotted curve as plain text in x, for example "sin(x)", "2*x^2 - 3",
  "e^(-x)" or "x^3 - x". Use only: x, numbers, + - * / ^, parentheses, pi, e and the functions
  sin cos tan exp ln log sqrt abs. Take it from the label or legend if one is printed; otherwise
  infer the simplest standard function that matches the curve (line, parabola, sine, cosine,
  exponential...). If you cannot name a function with confidence, or the image is not a graph of
  a function y = f(x), set "equation" to null.
- x_min, x_max, y_min, y_max are the numeric values at the LEFT, RIGHT, BOTTOM and TOP edges of the
  plotted area, estimated from the tick labels. Do not leave the labelled area out. A sine over one
  period drawn from 0 to 2*pi has x_min 0 and x_max 6.2832.
- x_ticks and y_ticks list the numbers printed on the axes, in increasing order.
- Do not invent labels, numbers or equations that are not visible or implied by the curve.
"""


def build_graph_prompt() -> str:
    """The prompt for the graph-spec call."""
    return GRAPH_PROMPT


async def graph_scene_from_chain(
    chain: ProviderChain, image: bytes, mime: str, deadline: float
) -> dict[str, Any] | None:
    """Return a function_graph scene dict sampled from the model's spec, or None to fall back."""
    if deadline - time.monotonic() < MIN_SECONDS_LEFT:
        return None
    try:
        raw, provider = await chain.extract(image, mime, build_graph_prompt(), deadline=deadline)
    except VisionError as exc:
        logger.info("graph route: no spec (%s)", exc.reason)
        return None
    try:
        spec = parse_graph_spec(strip_fences(raw))
        scene = build_graph_scene(spec)
    except GraphSpecError as exc:
        logger.info("graph route: spec from %s unusable (%s)", provider, exc)
        return None
    logger.info("graph route: sampled %d curve(s) via %s", len(scene["polylines"]), provider)
    return scene
