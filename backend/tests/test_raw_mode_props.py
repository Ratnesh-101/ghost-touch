"""Property-based tests for Raw Mode OpenCV edge detection fallback (Task 8.7, P10).

Validates: Requirement 8.2 (Property P10)
For any image, raw_mode returns <= 300 segments, all coordinates within [0, 1].
"""

from __future__ import annotations

import cv2
import numpy as np
from hypothesis import given, settings
from hypothesis import strategies as st

from app.raw_mode import RawModeError, build_raw_scene
from app.schema import DiagramScene


@st.composite
def random_diagram_image(draw: st.DrawFn) -> bytes:
    """Generate a random PNG image with lines, shapes, and/or noise."""
    w = draw(st.integers(min_value=64, max_value=256))
    h = draw(st.integers(min_value=64, max_value=256))

    bg_type = draw(st.sampled_from(["black", "white", "noise", "gray"]))
    if bg_type == "black":
        img = np.zeros((h, w, 3), dtype=np.uint8)
    elif bg_type == "white":
        img = np.full((h, w, 3), 255, dtype=np.uint8)
    elif bg_type == "gray":
        val = draw(st.integers(min_value=30, max_value=220))
        img = np.full((h, w, 3), val, dtype=np.uint8)
    else:
        # Uniform noise
        img = np.random.randint(0, 256, (h, w, 3), dtype=np.uint8)

    # Optionally draw random geometric elements
    num_elements = draw(st.integers(min_value=0, max_value=15))
    for _ in range(num_elements):
        elem_type = draw(st.sampled_from(["rect", "line", "circle", "noise_patch"]))
        color = (
            draw(st.integers(0, 255)),
            draw(st.integers(0, 255)),
            draw(st.integers(0, 255)),
        )
        thickness = draw(st.integers(1, 4))
        x1 = draw(st.integers(0, w - 1))
        y1 = draw(st.integers(0, h - 1))
        x2 = draw(st.integers(0, w - 1))
        y2 = draw(st.integers(0, h - 1))

        if elem_type == "rect":
            cv2.rectangle(
                img,
                (min(x1, x2), min(y1, y2)),
                (max(x1, x2), max(y1, y2)),
                color,
                thickness,
            )
        elif elem_type == "line":
            cv2.line(img, (x1, y1), (x2, y2), color, thickness)
        elif elem_type == "circle":
            r = draw(st.integers(2, max(2, min(w, h) // 4)))
            cv2.circle(img, (x1, y1), r, color, thickness)
        elif elem_type == "noise_patch":
            pw = draw(st.integers(5, max(5, w // 4)))
            ph = draw(st.integers(5, max(5, h // 4)))
            px = min(x1, w - pw)
            py = min(y1, h - ph)
            img[py : py + ph, px : px + pw] = np.random.randint(0, 256, (ph, pw, 3), dtype=np.uint8)

    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


@settings(max_examples=40, deadline=None)
@given(random_diagram_image())
def test_p10_raw_mode_segment_bound_and_coordinates(image_bytes: bytes) -> None:
    """P10: build_raw_scene returns at most 300 segments, all coordinates within [0, 1]."""
    try:
        scene = build_raw_scene(image_bytes)
    except RawModeError:
        # Blank images or images with no detectable edges legitimately raise RawModeError
        return

    assert isinstance(scene, DiagramScene)
    assert len(scene.segments) <= 300

    # Invariant: all points are in [0, 1]
    for pt in scene.points:
        assert 0.0 <= pt.x <= 1.0, f"Point {pt.id} x={pt.x} out of range [0, 1]"
        assert 0.0 <= pt.y <= 1.0, f"Point {pt.id} y={pt.y} out of range [0, 1]"

    # Invariant: segment endpoints reference valid points
    point_ids = {pt.id for pt in scene.points}
    for seg in scene.segments:
        assert seg.a in point_ids, f"Segment {seg.id} references missing point {seg.a}"
        assert seg.b in point_ids, f"Segment {seg.id} references missing point {seg.b}"
