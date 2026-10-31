"""Raw Mode — OpenCV edge detection fallback (Task 8.4).

Grayscale -> GaussianBlur(5) -> Canny(50, 150) -> findContours -> approxPolyDP
simplification, capped at <= 300 normalized segments. Used when the vision LLM
fails validation twice, times out, or throws.
"""

from __future__ import annotations

import math

import cv2
import numpy as np

from app.schema import DiagramScene, Point, Segment


class RawModeError(Exception):
    """Raised when Raw Mode cannot process or decode image bytes."""


def build_raw_scene(image: bytes) -> DiagramScene:
    """Detect edges in an image with OpenCV and return a normalized DiagramScene.

    Grayscale -> GaussianBlur(5) -> Canny(50, 150) -> findContours -> approxPolyDP.
    Keeps the longest segments up to 300.
    Coordinates are normalized to [0, 1] relative to image dimensions.
    Raises RawModeError if image bytes cannot be decoded.
    """
    decoded = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    if decoded is None:
        raise RawModeError("Could not decode image bytes")

    height, width = decoded.shape[:2]
    if height <= 0 or width <= 0:
        raise RawModeError("Invalid image dimensions")

    gray = cv2.cvtColor(decoded, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    extracted_segments: list[tuple[float, float, float, float, float]] = []

    for contour in contours:
        perimeter = cv2.arcLength(contour, True)
        epsilon = 0.01 * perimeter
        approx = cv2.approxPolyDP(contour, epsilon, True)
        num_points = len(approx)

        if num_points < 2:
            continue

        if num_points == 2:
            pt1 = approx[0][0]
            pt2 = approx[1][0]
            x1, y1 = float(pt1[0]), float(pt1[1])
            x2, y2 = float(pt2[0]), float(pt2[1])
            length = math.hypot(x2 - x1, y2 - y1)
            if length > 0.0:
                extracted_segments.append((length, x1, y1, x2, y2))
        else:
            for i in range(num_points):
                pt1 = approx[i][0]
                pt2 = approx[(i + 1) % num_points][0]
                x1, y1 = float(pt1[0]), float(pt1[1])
                x2, y2 = float(pt2[0]), float(pt2[1])
                length = math.hypot(x2 - x1, y2 - y1)
                if length > 0.0:
                    extracted_segments.append((length, x1, y1, x2, y2))

    # Keep longest segments up to 300
    extracted_segments.sort(key=lambda s: s[0], reverse=True)
    top_segments = extracted_segments[:300]

    points: list[Point] = []
    segments: list[Segment] = []

    for idx, (_, x1, y1, x2, y2) in enumerate(top_segments):
        # Normalize to [0, 1] clamped to unit interval
        norm_x1 = max(0.0, min(1.0, x1 / width))
        norm_y1 = max(0.0, min(1.0, y1 / height))
        norm_x2 = max(0.0, min(1.0, x2 / width))
        norm_y2 = max(0.0, min(1.0, y2 / height))

        p_a = Point(id=f"raw_p{idx}_a", x=norm_x1, y=norm_y1)
        p_b = Point(id=f"raw_p{idx}_b", x=norm_x2, y=norm_y2)
        seg = Segment(id=f"raw_s{idx}", a=p_a.id, b=p_b.id)

        points.extend([p_a, p_b])
        segments.append(seg)

    return DiagramScene(
        version=1,
        kind="unknown",
        title=None,
        points=points,
        segments=segments,
        polylines=[],
        bars=[],
        axes=None,
        facts=[],
    )
