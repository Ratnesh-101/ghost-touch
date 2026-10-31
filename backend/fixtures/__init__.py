"""Bundled sample DiagramScenes (Task 2.3).

The three scenes here -- a right triangle, a sine curve, and a bar chart --
serve two purposes at once:

* **Backend test fixtures** -- imported by ``tests/test_fixtures.py`` and
  reused wherever a representative validated scene is needed.
* **In-app sample diagrams** (Requirement 2.4) -- ``export_samples.py`` dumps
  each one to ``frontend/public/samples/*.json`` so the PWA can offer them
  with no camera or network.

Each module exposes a zero-argument factory that returns a *fresh*, validated
:class:`~app.schema.DiagramScene`. Factories (rather than module-level
constants) keep tests from mutating shared state.
"""

from __future__ import annotations

from collections.abc import Callable

from app.schema import DiagramScene
from fixtures.barchart import barchart_scene
from fixtures.sine import sine_scene
from fixtures.triangle import triangle_scene

#: A sample id paired with the factory that builds it. The id is also the
#: basename of the JSON file written to ``frontend/public/samples/``.
SAMPLES: tuple[tuple[str, Callable[[], DiagramScene]], ...] = (
    ("triangle", triangle_scene),
    ("sine", sine_scene),
    ("barchart", barchart_scene),
)

__all__ = ["SAMPLES", "barchart_scene", "sine_scene", "triangle_scene"]
