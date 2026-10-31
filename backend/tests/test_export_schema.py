"""Tests for the DiagramScene JSON Schema export (Task 2.2).

These guard the "one schema, two languages" architecture rule: the JSON
Schema that feeds ``json-schema-to-typescript`` (→ ``scene.gen.ts``) must
stay in lock-step with the Pydantic model in ``app/schema.py``. If a field is
added or a literal changes there, these tests fail until the schema is
re-exported and regenerated.

Coverage:
    * the exported schema is a well-formed JSON Schema object with the
      expected top-level properties (Requirements 3.1, 3.2, 3.5, 2.4);
    * the ``kind`` classification is surfaced as a four-value enum (Req 3.1);
    * ``$defs`` exposes every sub-model the frontend needs;
    * ``write_schema`` round-trips to disk deterministically;
    * the default output path is ``backend/scene.schema.json`` (gitignored);
    * a constructed scene's data is described by the schema's properties.

JSON Schema validity is asserted structurally (the schema comes from
``DiagramScene.model_json_schema()``, which produces valid JSON Schema by
construction) and through an on-disk round-trip, avoiding a hard dependency
on the ``jsonschema`` package.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.export_schema import (
    EXPECTED_KIND_ENUM,
    EXPECTED_TOP_LEVEL_PROPERTIES,
    build_schema,
    default_output_path,
    write_schema,
)
from app.schema import DiagramScene, Point, Segment

# --- structural validity of the in-memory schema --------------------------


def test_build_schema_returns_object_schema() -> None:
    """The root schema describes an object with declared properties."""
    schema = build_schema()
    assert isinstance(schema, dict)
    assert schema["type"] == "object"
    assert "properties" in schema
    assert "$defs" in schema


def test_schema_has_all_expected_top_level_properties() -> None:
    """Every DiagramScene field is represented in the schema's properties."""
    properties = build_schema()["properties"]
    assert set(properties.keys()) == set(EXPECTED_TOP_LEVEL_PROPERTIES)


def test_kind_is_four_value_enum() -> None:
    """Requirement 3.1: kind classifies the scene into exactly these values."""
    kind_schema = build_schema()["properties"]["kind"]
    assert kind_schema["enum"] == list(EXPECTED_KIND_ENUM)


def test_version_is_const_one() -> None:
    """``version`` is locked to the literal 1."""
    version_schema = build_schema()["properties"]["version"]
    assert version_schema.get("const") == 1


def test_kind_is_required() -> None:
    """``kind`` is the one field without a default, so it must be required."""
    assert build_schema()["required"] == ["kind"]


def test_defs_contain_every_sub_model() -> None:
    """The frontend generates one TS interface per sub-model in $defs."""
    defs = build_schema()["$defs"]
    assert set(defs.keys()) == {"Point", "Segment", "Polyline", "Bar", "Axes"}


def test_point_def_requires_id_x_y() -> None:
    """Point exposes its mandatory geometry fields to TypeScript."""
    point_def = build_schema()["$defs"]["Point"]
    assert set(point_def["required"]) == {"id", "x", "y"}


def test_bar_def_requires_label_and_value() -> None:
    """Bar's required label/value survive into the generated types (Req 2.4
    sample charts depend on these)."""
    bar_def = build_schema()["$defs"]["Bar"]
    assert set(bar_def["required"]) == {"id", "x0", "x1", "y_top", "y_base", "label", "value"}


def test_segment_endpoints_are_strings() -> None:
    """Segment endpoints are point-id strings (Req 3.5 references)."""
    seg_def = build_schema()["$defs"]["Segment"]
    assert seg_def["properties"]["a"]["type"] == "string"
    assert seg_def["properties"]["b"]["type"] == "string"
    assert set(seg_def["required"]) == {"id", "a", "b"}


# --- deterministic on-disk round-trip --------------------------------------


def test_write_schema_round_trips_to_disk(tmp_path: Path) -> None:
    """Writing to a path produces JSON equal to the in-memory schema."""
    out = write_schema(tmp_path / "scene.schema.json")
    assert out.exists()
    on_disk = json.loads(out.read_text(encoding="utf-8"))
    assert on_disk == build_schema()


def test_write_schema_is_deterministic(tmp_path: Path) -> None:
    """Two writes produce byte-identical output (sorted keys) for clean diffs."""
    first = tmp_path / "a.json"
    second = tmp_path / "b.json"
    write_schema(first)
    write_schema(second)
    assert first.read_bytes() == second.read_bytes()


def test_default_output_path_is_backend_scene_schema_json() -> None:
    """The canonical artifact lives next to pyproject.toml, not in app/."""
    path = default_output_path()
    assert path.name == "scene.schema.json"
    # backend/ is the parent of both app/ and scene.schema.json
    assert path.parent == Path(__file__).resolve().parent.parent
    assert (path.parent / "pyproject.toml").exists()


# --- the schema actually describes the model --------------------------------


def test_constructed_scene_dump_matches_schema_property_keys() -> None:
    """A real scene serialises to exactly the schema's top-level keys."""
    scene = DiagramScene(
        kind="geometry",
        title="Triangle ABC",
        points=[Point(id="A", x=0.2, y=0.2, label="A")],
        segments=[Segment(id="AB", a="A", b="A")],
        facts=["AB = 5 cm"],
    )
    dumped_keys = set(scene.model_dump(mode="json").keys())
    schema_keys = set(build_schema()["properties"].keys())
    assert dumped_keys == schema_keys


# --- the committed/regenerated artifact on disk ----------------------------


def test_on_disk_artifact_is_in_sync_with_model() -> None:
    """``backend/scene.schema.json`` (regenerated by the export script) matches
    the live model schema. Fails if the model changed but the script wasn't
    re-run — the exact drift this task exists to prevent."""
    artifact = default_output_path()
    if not artifact.exists():
        pytest.skip("scene.schema.json not yet generated; run `python -m app.export_schema`")
    on_disk = json.loads(artifact.read_text(encoding="utf-8"))
    assert on_disk == build_schema()
