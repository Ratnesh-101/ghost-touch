"""HX4 schema contract tests.

Asserts that frontend/src/types/scene.gen.ts stays in sync with DiagramScene
Pydantic model and its JSON Schema representation.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.schema import DiagramScene

SCENE_GEN_TS_PATH = (
    Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "types" / "scene.gen.ts"
)

EXPECTED_KINDS = ("geometry", "function_graph", "bar_chart", "unknown")


def _read_scene_gen_ts() -> str:
    """Read frontend/src/types/scene.gen.ts as text, or skip test if missing."""
    if not SCENE_GEN_TS_PATH.exists():
        pytest.skip(
            f"frontend/src/types/scene.gen.ts is missing at {SCENE_GEN_TS_PATH}; "
            "run 'npm run gen:types' in frontend/ to generate it"
        )
    return SCENE_GEN_TS_PATH.read_text(encoding="utf-8")


def _extract_interface_body(ts_text: str, interface_name: str) -> str:
    """Extract the body inside 'export interface <interface_name> { ... }'."""
    pattern = rf"export\s+interface\s+{re.escape(interface_name)}\s*\{{([^}}]*)\}}"
    match = re.search(pattern, ts_text)
    assert match is not None, f"Interface '{interface_name}' not found in TypeScript definitions"
    return match.group(1)


def _assert_property_in_body(interface_body: str, prop: str, interface_name: str) -> None:
    """Assert that a property name appears in the interface body."""
    found = (
        bool(re.search(rf"\b{re.escape(prop)}\??\s*:", interface_body)) or prop in interface_body
    )
    assert found, f"Property {prop!r} not found in interface '{interface_name}'"


def test_hx4_schema_contract_top_level_properties() -> None:
    """Every property in DiagramScene.model_json_schema() appears in the DiagramScene interface."""
    ts_text = _read_scene_gen_ts()
    schema = DiagramScene.model_json_schema()
    top_properties = schema.get("properties", {})
    assert top_properties, "DiagramScene JSON schema has no properties"

    body = _extract_interface_body(ts_text, "DiagramScene")
    for prop in top_properties:
        _assert_property_in_body(body, prop, "DiagramScene")


def test_hx4_schema_contract_defs_models_properties() -> None:
    """Every property in each $defs sub-model appears in the matching TypeScript interface."""
    ts_text = _read_scene_gen_ts()
    schema = DiagramScene.model_json_schema()
    defs = schema.get("$defs", {})
    assert defs, "DiagramScene JSON schema has no $defs"

    for model_name, def_schema in defs.items():
        body = _extract_interface_body(ts_text, model_name)
        properties = def_schema.get("properties", {})
        assert properties, f"$defs sub-model {model_name} has no properties"
        for prop in properties:
            _assert_property_in_body(body, prop, model_name)


def test_hx4_schema_contract_kind_literals() -> None:
    """The four 'kind' literals appear in scene.gen.ts."""
    ts_text = _read_scene_gen_ts()
    schema = DiagramScene.model_json_schema()
    kind_schema = schema.get("properties", {}).get("kind", {})
    schema_kinds = kind_schema.get("enum", list(EXPECTED_KINDS))

    assert len(schema_kinds) == 4, f"Expected 4 kind literals in schema, got {schema_kinds}"
    for kind in schema_kinds:
        assert f'"{kind}"' in ts_text, f'Kind literal "{kind}" missing from TypeScript definitions'
