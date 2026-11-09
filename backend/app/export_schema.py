"""Export the DiagramScene JSON Schema for TypeScript generation (Task 2.2).

This is the second half of the "one schema, two languages" architecture rule
from ``tech.md``: ``DiagramScene`` is defined once as a Pydantic model in
``schema.py``, and its JSON Schema feeds ``json-schema-to-typescript`` to
generate ``frontend/src/types/scene.gen.ts``. Nobody hand-writes the
TypeScript copy.

Run from the ``backend/`` directory::

    python -m app.export_schema

This writes ``backend/scene.schema.json`` (gitignored as a build artifact).
Then, from the ``frontend/`` directory::

    npm run gen:types

which runs ``json2ts -i ../backend/scene.schema.json -o src/types/scene.gen.ts``.

Requirements covered: 3.1 (kind classification surfaced as an enum), 3.2 and
3.5 (the coordinate-range and unique-id invariants are encoded in the
schema), and 2.4 (sample diagrams reuse the same schema, validated through
this single source of truth).
"""

from __future__ import annotations

import json
from pathlib import Path

from app.schema import DiagramScene

OUTPUT_FILENAME = "scene.schema.json"
"""Name of the generated JSON Schema file (sibling of this package's parent)."""

# The set of top-level property names that DiagramScene must surface in its
# JSON Schema. Kept in sync with ``schema.py``; the export test asserts these.
EXPECTED_TOP_LEVEL_PROPERTIES = frozenset(
    {
        "version",
        "kind",
        "title",
        "points",
        "segments",
        "polylines",
        "bars",
        "axes",
        "facts",
        "aspect",
    }
)

# Requirement 3.1: the scene kind is one of these literals.
EXPECTED_KIND_ENUM = ("geometry", "function_graph", "bar_chart", "unknown")


def build_schema() -> dict[str, object]:
    """Return the JSON Schema dict for :class:`DiagramScene`.

    The dict is built fresh on every call from the live Pydantic model, so it
    always reflects the current ``schema.py``. Returning the dict (rather than
    writing immediately) keeps this function pure and easy to test.
    """
    return DiagramScene.model_json_schema()


def default_output_path() -> Path:
    """Return the canonical output path: ``<backend>/scene.schema.json``.

    Resolved relative to this module's location so the script works regardless
    of the caller's working directory (e.g. ``python -m app.export_schema`` from
    ``backend/`` or an IDE run config rooted elsewhere).
    """
    # This file lives at backend/app/export_schema.py; the schema.json belongs
    # one directory up, alongside pyproject.toml.
    return Path(__file__).resolve().parent.parent / OUTPUT_FILENAME


def write_schema(output_path: Path | None = None) -> Path:
    """Write the JSON Schema to disk and return the path written.

    A path argument is accepted so tests can target a :class:`tmp_path` rather
    than polluting the repo. The JSON is pretty-printed with sorted keys for
    deterministic, diff-friendly output.
    """
    target = output_path if output_path is not None else default_output_path()
    schema = build_schema()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return target


def main() -> None:
    """CLI entry point: write the schema to its default location."""
    path = write_schema()
    print(f"Wrote JSON Schema for DiagramScene to {path}")


if __name__ == "__main__":
    main()
