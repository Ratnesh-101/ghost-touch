"""DiagramScene Pydantic models — the single source of truth.

All coordinates are normalized to the closed interval [0, 1] with the origin at
the top-left corner of the image. The JSON Schema exported from
``DiagramScene`` generates ``frontend/src/types/scene.gen.ts`` (see
``app/export_schema.py``), so there is one schema shared across the Python
backend and the TypeScript frontend.

Invariants enforced here (Requirements 3.2 and 3.5):
    * every ``x``/``y`` coordinate lies in [0, 1];
    * every element carries a unique id, unique across the whole scene;
    * every segment endpoint (``a``, ``b``) refers to an existing point id.

The validators are strict on purpose. ``validate.py`` (Task 8.3) repairs the
trivial overshoot produced by the vision LLM — it clamps coordinates within
+/-0.02, drops dangling segments, and dedupes ids — *before* constructing a
``DiagramScene``. A scene that builds successfully therefore satisfies the
invariants by construction (see property P9).
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

UNIT_RANGE = "[0, 1]"
"""Documented coordinate range, used in validation messages."""


class Point(BaseModel):
    """A named vertex with normalized coordinates."""

    id: str
    x: float = Field(ge=0.0, le=1.0, allow_inf_nan=False)
    y: float = Field(ge=0.0, le=1.0, allow_inf_nan=False)
    label: str | None = None


class Segment(BaseModel):
    """A straight line between two existing points, referenced by id."""

    id: str
    a: str  # id of the start Point
    b: str  # id of the end Point
    label: str | None = None


class Polyline(BaseModel):
    """An ordered sequence of normalized (x, y) points; used for curves."""

    id: str
    points: list[
        Annotated[
            list[Annotated[float, Field(ge=0.0, le=1.0, allow_inf_nan=False)]],
            Field(min_length=2, max_length=2),
        ]
    ]
    label: str | None = None


class Bar(BaseModel):
    """A bar-chart bar with normalized geometry and a numeric value."""

    id: str
    x0: float = Field(ge=0.0, le=1.0, allow_inf_nan=False)
    x1: float = Field(ge=0.0, le=1.0, allow_inf_nan=False)
    y_top: float = Field(ge=0.0, le=1.0, allow_inf_nan=False)
    y_base: float = Field(ge=0.0, le=1.0, allow_inf_nan=False)
    label: str
    value: float = Field(allow_inf_nan=False)


class Axes(BaseModel):
    """Optional axis positions, normalized to [0, 1]."""

    x_axis_y: float | None = Field(default=None, ge=0.0, le=1.0, allow_inf_nan=False)
    y_axis_x: float | None = Field(default=None, ge=0.0, le=1.0, allow_inf_nan=False)


class DiagramScene(BaseModel):
    """The normalized, validated description of a diagram (source of truth)."""

    version: Literal[1] = 1
    kind: Literal["geometry", "function_graph", "bar_chart", "unknown"]
    title: str | None = None
    points: list[Point] = Field(default_factory=list)
    segments: list[Segment] = Field(default_factory=list)
    polylines: list[Polyline] = Field(default_factory=list)
    bars: list[Bar] = Field(default_factory=list)
    axes: Axes | None = None
    facts: list[str] = Field(
        default_factory=list
    )  # e.g. "AB = 5 cm", "angle C = 90°" — used by Ask
    aspect: float = Field(
        default=1.0,
        gt=0.0,
        allow_inf_nan=False,
        description="Aspect ratio (width / height) of the diagram's bounding box",
    )

    @model_validator(mode="after")
    def _check_invariants(self) -> DiagramScene:
        # Requirement 3.5: every element has a unique id across the whole scene.
        seen: set[str] = set()
        for element in (
            *self.points,
            *self.segments,
            *self.polylines,
            *self.bars,
        ):
            if element.id in seen:
                raise ValueError(f"duplicate element id: {element.id!r}")
            seen.add(element.id)

        # Requirement 3.5: every segment endpoint references an existing point.
        point_ids = {point.id for point in self.points}
        for segment in self.segments:
            for endpoint in (segment.a, segment.b):
                if endpoint not in point_ids:
                    raise ValueError(
                        f"segment {segment.id!r} references unknown point {endpoint!r}"
                    )

        return self
