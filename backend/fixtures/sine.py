"""Sine graph sample diagram (Task 2.3).

A ``function_graph`` scene used both as a backend test fixture and as an
in-app sample (Requirement 2.4). The curve ``y = sin(x)`` is sampled as a
single polyline of about 100 points spanning one full period (x from 0 to 2*pi),
so a student can trace it with smooth pitch transitions.

Coordinate mapping (origin top-left, y grows downward):
    * screen x runs from 0.10 to 0.90 across the plot area;
    * the x-axis sits at y = 0.50 (the sine zero line);
    * amplitude 1 maps to +/-0.30 in normalized y, so the curve stays in
      [0.20, 0.80] — well inside the unit square.
A higher point on the graph has a smaller normalized y, which the frontend
``pitchForY`` maps to a higher pitch (Requirement 5.1).
"""

from __future__ import annotations

import math

from app.schema import Axes, DiagramScene, Polyline

# Number of polyline samples: about 100 points requested by the spec.
_NUM_SAMPLES = 100
# One full period (2*pi).
_ANGLE_SPAN = 2.0 * math.pi
# Plot-area bounds in normalized coordinates.
_X_START = 0.10
_X_END = 0.90
_X_AXIS_Y = 0.50
_AMPLITUDE = 0.30
_Y_AXIS_X = 0.08


def sine_scene() -> DiagramScene:
    """Return a validated sine-curve function_graph scene."""
    points: list[tuple[float, float]] = []
    for i in range(_NUM_SAMPLES):
        t = i / (_NUM_SAMPLES - 1)
        angle = t * _ANGLE_SPAN
        sx = _X_START + t * (_X_END - _X_START)
        # sin = +1 is the top of the graph (smallest y); sin = -1 is the bottom.
        sy = _X_AXIS_Y - math.sin(angle) * _AMPLITUDE
        points.append((round(sx, 4), round(sy, 4)))

    return DiagramScene(
        kind="function_graph",
        title="y = sin(x)",
        polylines=[Polyline(id="sine_curve", points=points, label="sin(x)")],
        axes=Axes(x_axis_y=_X_AXIS_Y, y_axis_x=_Y_AXIS_X),
        facts=["amplitude = 1", "period = 2 pi", "one full period is shown"],
    )
