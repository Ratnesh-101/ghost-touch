"""Bar chart sample diagram (Task 2.3).

A ``bar_chart`` scene of quarterly sales, used both as a backend test fixture
and as an in-app sample (Requirement 2.4). Four bars (Q1-Q4) share a common
baseline; taller bars represent larger values, so a student can compare them
by touch and identify the highest (design.md checklist: "identify the highest
bar"). Q4 is intentionally the tallest.

Coordinate notes (origin top-left, y grows downward):
    * ``y_base = 0.85`` is the shared baseline near the bottom of the plot;
    * a taller bar has a smaller ``y_top`` (it reaches higher up the screen);
    * bar x-extents tile the plot area with even gaps.
"""

from __future__ import annotations

from app.schema import Axes, Bar, DiagramScene

# Shared baseline for every bar (the chart's x-axis line).
_BASELINE_Y = 0.85
_Y_AXIS_X = 0.10


def barchart_scene() -> DiagramScene:
    """Return a validated four-bar bar_chart scene (Q1-Q4 sales)."""
    return DiagramScene(
        kind="bar_chart",
        title="Sales by quarter",
        bars=[
            Bar(id="q1", x0=0.12, x1=0.27, y_top=0.69, y_base=_BASELINE_Y, label="Q1", value=10),
            Bar(id="q2", x0=0.32, x1=0.47, y_top=0.44, y_base=_BASELINE_Y, label="Q2", value=25),
            Bar(id="q3", x0=0.52, x1=0.67, y_top=0.56, y_base=_BASELINE_Y, label="Q3", value=18),
            Bar(id="q4", x0=0.72, x1=0.87, y_top=0.33, y_base=_BASELINE_Y, label="Q4", value=32),
        ],
        axes=Axes(x_axis_y=_BASELINE_Y, y_axis_x=_Y_AXIS_X),
        facts=[
            "values are in thousands of units",
            "Q4 was the highest quarter",
            "Q1 was the lowest quarter",
        ],
    )
