"""Tests for the bundled sample DiagramScene fixtures (Task 2.3).

The three fixtures double as backend test inputs and as the in-app sample
diagrams (Requirement 2.4). These tests assert that each fixture constructs
through every schema validator, classifies to the right ``kind``, and carries
the geometry the design expects -- so a regression in a fixture is caught
before it ships inside the PWA bundle.

Requirements covered: 3.1 (kind classification), 3.2 (coordinates in [0, 1]),
3.5 (unique ids + valid references), and 2.4 (at least three bundled samples).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.schema import DiagramScene
from fixtures import SAMPLES
from fixtures.barchart import barchart_scene
from fixtures.sine import sine_scene
from fixtures.triangle import triangle_scene

# frontend/public/samples/ -- resolved from backend/tests/ up to the repo root.
SAMPLES_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "samples"


# --- shared construction & invariants -------------------------------------


@pytest.mark.parametrize("name,factory", SAMPLES)
def test_every_fixture_constructs_as_diagram_scene(name: str, factory) -> None:
    """Each sample builds through all schema validators (Req 3.2, 3.5)."""
    scene = factory()
    assert isinstance(scene, DiagramScene)
    assert scene.version == 1


@pytest.mark.parametrize("name,factory", SAMPLES)
def test_every_fixture_has_unique_ids_and_unit_coords(name: str, factory) -> None:
    """Construction already enforces invariants; assert them explicitly."""
    scene = factory()
    ids = [e.id for e in (*scene.points, *scene.segments, *scene.polylines, *scene.bars)]
    assert len(ids) == len(set(ids)), f"duplicate ids in {name}: {ids}"
    for point in scene.points:
        assert 0.0 <= point.x <= 1.0
        assert 0.0 <= point.y <= 1.0


def test_at_least_three_bundled_samples() -> None:
    """Requirement 2.4: at least three bundled samples."""
    assert len(SAMPLES) >= 3
    assert {name for name, _ in SAMPLES} == {"triangle", "sine", "barchart"}


# --- triangle -------------------------------------------------------------


def test_triangle_fixture() -> None:
    scene = triangle_scene()
    assert scene.kind == "geometry"  # Req 3.1
    assert len(scene.points) == 3
    assert len(scene.segments) == 3

    # Req 3.5: every segment endpoint references an existing point.
    point_ids = {p.id for p in scene.points}
    for segment in scene.segments:
        assert segment.a in point_ids
        assert segment.b in point_ids

    # Vertices are labelled so the engine can speak them (Req 4.3).
    assert all(p.label is not None for p in scene.points)
    assert scene.facts  # Ask needs facts (Req 7.2)


# --- sine -----------------------------------------------------------------


def test_sine_fixture() -> None:
    scene = sine_scene()
    assert scene.kind == "function_graph"  # Req 3.1
    assert scene.polylines, "sine must have a polyline"

    curve = scene.polylines[0]
    assert 20 <= len(curve.points) <= 30, "task asks for 20-30 sample points"
    assert scene.axes is not None, "function_graph must carry axes"
    assert curve.label == "sin(x)"

    # Every polyline point stays in the unit square (Req 3.2).
    for x, y in curve.points:
        assert 0.0 <= x <= 1.0
        assert 0.0 <= y <= 1.0


# --- bar chart ------------------------------------------------------------


def test_barchart_fixture() -> None:
    scene = barchart_scene()
    assert scene.kind == "bar_chart"  # Req 3.1
    assert len(scene.bars) == 4

    for bar in scene.bars:
        assert bar.label, "every bar needs a label (Req 6.1)"
        assert isinstance(bar.value, (int, float))
        assert bar.y_top < bar.y_base, "bar grows upward (smaller y_top = taller)"

    # Two peaks of value comparison: the tallest bar is identifiable by value
    # (design.md checklist: "identify the highest bar").
    tallest = max(scene.bars, key=lambda b: b.value)
    assert tallest.label == "Q4"
    # ...and the smallest y_top belongs to that same tallest bar.
    topmost = min(scene.bars, key=lambda b: b.y_top)
    assert topmost is tallest


# --- on-disk JSON samples (Requirement 2.4) --------------------------------


@pytest.mark.parametrize("name,factory", SAMPLES)
def test_sample_json_exists_and_is_valid(name: str, factory) -> None:
    """Each bundled JSON file exists and round-trips through the schema."""
    path = SAMPLES_DIR / f"{name}.json"
    assert path.exists(), f"missing sample JSON: {path}"
    data = json.loads(path.read_text(encoding="utf-8"))
    DiagramScene.model_validate(data)  # raises if invalid


@pytest.mark.parametrize("name,factory", SAMPLES)
def test_sample_json_matches_factory(name: str, factory) -> None:
    """The on-disk JSON is the canonical factory output, byte for value."""
    path = SAMPLES_DIR / f"{name}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    # model_dump(mode="json") yields JSON-native types (tuples become lists),
    # matching what json.loads reads back from the on-disk file.
    assert data == factory().model_dump(mode="json")
