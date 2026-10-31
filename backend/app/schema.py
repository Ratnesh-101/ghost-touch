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

from typing import Literal

from pydantic import BaseModel, field_validator, model_validator

UNIT_RANGE = "[0, 1]"
"""Documented coordinate range, used in validation messages."""


def _in_unit_interval(value: float, name: str) -> float:
    """Return ``value`` if it lies in [0, 1], else raise ``ValueError``."""
    if not 0.0 <= value <= 1.0:
        raise ValueError(
            f"{name}={value!r} is out of range; all coordinates must be in {UNIT_RANGE}"
        )
    return value


class Point(BaseModel):
    """A named vertex with normalized coordinates."""

    id: str
    x: float
    y: float
    label: str | None = None

    @field_validator("x", "y")
    @classmethod
    def _coords_in_range(cls, value: float) -> float:
        return _in_unit_interval(value, "Point coordinate")


class Segment(BaseModel):
    """A straight line between two existing points, referenced by id."""

    id: str
    a: str  # id of the start Point
    b: str  # id of the end Point
    label: str | None = None


class Polyline(BaseModel):
    """An ordered sequence of normalized (x, y) points; used for curves."""

    id: str
    points: list[tuple[float, float]]
    label: str | None = None

    @field_validator("points")
    @classmethod
    def _points_in_range(cls, value: list[tuple[float, float]]) -> list[tuple[float, float]]:
        for index, (x, y) in enumerate(value):
            _in_unit_interval(x, f"Polyline points[{index}].x")
            _in_unit_interval(y, f"Polyline points[{index}].y")
        return value


class Bar(BaseModel):
    """A bar-chart bar with normalized geometry and a numeric value."""

    id: str
    x0: float
    x1: float
    y_top: float
    y_base: float
    label: str
    value: float

    @field_validator("x0", "x1", "y_top", "y_base")
    @classmethod
    def _coords_in_range(cls, value: float) -> float:
        return _in_unit_interval(value, "Bar coordinate")


class Axes(BaseModel):
    """Optional axis positions, normalized to [0, 1]."""

    x_axis_y: float | None = None
    y_axis_x: float | None = None

    @field_validator("x_axis_y", "y_axis_x")
    @classmethod
    def _coords_in_range(cls, value: float | None) -> float | None:
        if value is None:
            return value
        return _in_unit_interval(value, "Axes coordinate")


class DiagramScene(BaseModel):
    """The normalized, validated description of a diagram (source of truth)."""

    version: Literal[1] = 1
    kind: Literal["geometry", "function_graph", "bar_chart", "unknown"]
    title: str | None = None
    points: list[Point] = []
    segments: list[Segment] = []
    polylines: list[Polyline] = []
    bars: list[Bar] = []
    axes: Axes | None = None
    facts: list[str] = []  # e.g. "AB = 5 cm", "angle C = 90°" — used by Ask

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
