"""Tests for fit_image_for_inline helper (Task 8.1 / NVIDIA)."""

from __future__ import annotations

import cv2
import numpy as np

from app.vision.nvidia import fit_image_for_inline


def test_fit_image_small_input_returned_unchanged() -> None:
    small_bytes = b"tiny-payload-12345"
    result = fit_image_for_inline(small_bytes, max_bytes=1000)
    assert result == small_bytes


def test_fit_image_large_input_fits_limit_and_decodes() -> None:
    # 2500x2500 random image creates a large PNG payload > 2 MB
    img = np.random.randint(0, 255, (2000, 2000, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    raw_bytes = buf.tobytes()
    assert len(raw_bytes) > 200_000

    fitted = fit_image_for_inline(raw_bytes, max_bytes=180_000)
    assert len(fitted) <= 180_000

    # Still decodes as a valid image
    decoded = cv2.imdecode(np.frombuffer(fitted, np.uint8), cv2.IMREAD_COLOR)
    assert decoded is not None
    assert decoded.shape[0] > 0
    assert decoded.shape[1] > 0


def test_fit_image_undecodable_bytes_returned_as_is() -> None:
    garbage = b"x" * 200_000
    result = fit_image_for_inline(garbage, max_bytes=180_000)
    assert result == garbage
