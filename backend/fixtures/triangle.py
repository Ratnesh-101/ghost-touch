"""Triangle ABC sample diagram (Task 2.3).

A right-angled geometry scene used both as a backend test fixture and as an
in-app sample (Requirement 2.4). It is a 3-4-5 right triangle with the right
angle at C, so the bundled ``facts`` are internally consistent and the Ask
endpoint can answer questions such as "what is the length of AB?".

Coordinate layout (origin top-left, y grows downward):

    A (0.25, 0.25)  top vertex
    B (0.70, 0.85)  bottom-right vertex
    C (0.25, 0.85)  bottom-left vertex, the right angle

    CA is vertical (length 0.60 -> "4 cm")
    BC is horizontal (length 0.45 -> "3 cm")
    AB is the hypotenuse (length 0.75 -> "5 cm")

The side lengths are in the ratio 4 : 3 : 5, so ``angle C = 90 degrees`` holds.
"""

from __future__ import annotations

from app.schema import DiagramScene, Point, Segment


def triangle_scene() -> DiagramScene:
    """Return a validated right-triangle geometry scene (A, B, C)."""
    return DiagramScene(
        kind="geometry",
        title="Right Triangle ABC",
        points=[
            Point(id="A", x=0.25, y=0.25, label="A"),
            Point(id="B", x=0.70, y=0.85, label="B"),
            Point(id="C", x=0.25, y=0.85, label="C"),
        ],
        segments=[
            Segment(id="CA", a="C", b="A", label="CA"),
            Segment(id="AB", a="A", b="B", label="AB"),
            Segment(id="BC", a="B", b="C", label="BC"),
        ],
        facts=[
            "angle C = 90 degrees",
            "AC = 4 cm",
            "BC = 3 cm",
            "AB = 5 cm",
        ],
    )
