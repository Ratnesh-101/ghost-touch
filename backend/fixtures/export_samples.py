"""Dump the bundled sample DiagramScenes to ``frontend/public/samples/`` (Task 2.3).

Requirement 2.4: the PWA ships at least three sample diagrams usable without a
camera or network. This script regenerates ``triangle.json``, ``sine.json``,
and ``barchart.json`` from the canonical Pydantic factories so the on-disk
JSON always matches the validated schema (one source of truth, per
``tech.md``).

Run from the ``backend/`` directory::

    python -m fixtures.export_samples

The output path resolves relative to this file, so the script works no matter
where it is launched from.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.schema import DiagramScene
from fixtures import SAMPLES


def default_output_dir() -> Path:
    """Return ``<repo>/frontend/public/samples``.

    This file lives at ``backend/fixtures/export_samples.py``; the repo root is
    three parents up, then ``frontend/public/samples`` beneath it.
    """
    return Path(__file__).resolve().parents[2] / "frontend" / "public" / "samples"


def dump_samples(output_dir: Path | None = None) -> list[Path]:
    """Write one JSON file per sample and return the paths written.

    Each file is the pretty-printed ``model_dump()`` of a freshly built,
    validated scene. Accepting ``output_dir`` lets tests target a
    :class:`tmp_path` instead of the real bundle directory.
    """
    target = output_dir if output_dir is not None else default_output_dir()
    target.mkdir(parents=True, exist_ok=True)

    written: list[Path] = []
    for name, factory in SAMPLES:
        scene = factory()
        # model_dump() is already validated by construction; model_validate
        # is unnecessary here but kept defensive against future schema drift.
        DiagramScene.model_validate(scene.model_dump())
        path = target / f"{name}.json"
        path.write_text(
            json.dumps(scene.model_dump(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        written.append(path)
    return written


def main() -> None:
    """CLI entry point: write every sample to its default location."""
    for path in dump_samples():
        print(f"Wrote {path.name} -> {path}")


if __name__ == "__main__":
    main()
