"""Tests for Raw Mode OpenCV edge detection fallback (Task 8.4)."""

from __future__ import annotations

import cv2
import numpy as np
import pytest

from app.raw_mode import RawModeError, build_raw_scene
from app.schema import DiagramScene


def _make_test_image(width: int = 400, height: int = 300) -> bytes:
    """Create a simple test PNG image with geometric shapes."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.rectangle(img, (50, 50), (200, 200), (255, 255, 255), 3)
    cv2.circle(img, (300, 150), 40, (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


def test_build_raw_scene_produces_valid_diagram_scene() -> None:
    img_bytes = _make_test_image()
    scene = build_raw_scene(img_bytes)

    assert isinstance(scene, DiagramScene)
    assert scene.kind == "unknown"
    assert len(scene.segments) > 0
    assert len(scene.segments) <= 300
    assert len(scene.points) == 2 * len(scene.segments)

    # Invariants: every point in [0, 1]
    for pt in scene.points:
        assert 0.0 <= pt.x <= 1.0
        assert 0.0 <= pt.y <= 1.0

    # Invariants: unique ids across the scene
    all_ids = [pt.id for pt in scene.points] + [seg.id for seg in scene.segments]
    assert len(all_ids) == len(set(all_ids))

    # Invariants: every segment endpoint points to an existing point id
    point_ids = {pt.id for pt in scene.points}
    for seg in scene.segments:
        assert seg.a in point_ids
        assert seg.b in point_ids


def test_build_raw_scene_caps_at_300_segments() -> None:
    # Dense noisy image with many contours
    img = np.zeros((500, 500, 3), dtype=np.uint8)
    for x in range(10, 490, 15):
        for y in range(10, 490, 15):
            cv2.rectangle(img, (x, y), (x + 10, y + 10), (255, 255, 255), 1)

    ok, buf = cv2.imencode(".png", img)
    assert ok
    scene = build_raw_scene(buf.tobytes())
    assert len(scene.segments) <= 300


def test_build_raw_scene_raises_on_invalid_bytes() -> None:
    with pytest.raises(RawModeError):
        build_raw_scene(b"not an image file")
