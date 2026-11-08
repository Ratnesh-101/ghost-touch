"""Raw Mode — OpenCV edge detection fallback (Task 8.4, F2).

Grayscale -> GaussianBlur(5) -> Canny(50, 150) -> findContours -> approxPolyDP
simplification, capped at <= 300 normalized segments with segment deduplication,
nearby endpoint merging, and resolution safety capping.
"""

from __future__ import annotations

import math

import cv2
import numpy as np

from app.image_utils import MAX_IMAGE_PIXELS, sniff_image_dimensions
from app.schema import DiagramScene, Point, Segment

MAX_RAW_SEGMENTS = 300  # Requirement 8.2
MAX_DEDUPE_CANDIDATES = 1000  # bounds the quadratic de-duplication (A6-08)


class RawModeError(Exception):
    """Raised when Raw Mode cannot process or decode image bytes."""


def _dedupe_segments(
    segments: list[tuple[float, float, float, float]], tol: float = 4.0
) -> list[tuple[float, float, float, float]]:
    """Remove near-identical duplicate segments (e.g., dual contour traces of thin lines)."""
    deduped: list[tuple[float, float, float, float]] = []
    for s in segments:
        x1, y1, x2, y2 = s
        is_dup = False
        for d in deduped:
            dx1, dy1, dx2, dy2 = d
            # Check forward orientation
            if math.hypot(x1 - dx1, y1 - dy1) <= tol and math.hypot(x2 - dx2, y2 - dy2) <= tol:
                is_dup = True
                break
            # Check reverse orientation
            if math.hypot(x1 - dx2, y1 - dy2) <= tol and math.hypot(x2 - dx1, y2 - dy1) <= tol:
                is_dup = True
                break
        if not is_dup:
            deduped.append(s)
    return deduped


def build_raw_scene(image: bytes) -> DiagramScene:
    """Detect edges in an image with OpenCV and return a normalized DiagramScene.

    Grayscale -> GaussianBlur(5) -> Canny(50, 150) -> findContours -> approxPolyDP.
    Dedupes twin contours, merges nearby vertices, and keeps the longest segments up to 300.
    Coordinates are normalized to [0, 1] relative to image dimensions.
    Raises RawModeError if image bytes cannot be decoded or exceed pixel cap.
    """
    # Header check before full decode
    dims = sniff_image_dimensions(image)
    if dims is not None and dims[0] * dims[1] > MAX_IMAGE_PIXELS:
        raise RawModeError(
            f"Image resolution ({dims[0]}x{dims[1]}) exceeds "
            f"{MAX_IMAGE_PIXELS // 1_000_000} MP limit"
        )

    decoded = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    if decoded is None:
        raise RawModeError("Could not decode image bytes")

    height, width = decoded.shape[:2]
    if height <= 0 or width <= 0:
        raise RawModeError("Invalid image dimensions")

    if height * width > MAX_IMAGE_PIXELS:
        raise RawModeError(
            f"Image resolution ({width}x{height}) exceeds {MAX_IMAGE_PIXELS // 1_000_000} MP limit"
        )

    gray = cv2.cvtColor(decoded, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    extracted_segments: list[tuple[float, float, float, float]] = []

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
            if math.hypot(x2 - x1, y2 - y1) > 0.0:
                extracted_segments.append((x1, y1, x2, y2))
        else:
            for i in range(num_points):
                pt1 = approx[i][0]
                pt2 = approx[(i + 1) % num_points][0]
                x1, y1 = float(pt1[0]), float(pt1[1])
                x2, y2 = float(pt2[0]), float(pt2[1])
                if math.hypot(x2 - x1, y2 - y1) > 0.0:
                    extracted_segments.append((x1, y1, x2, y2))

    # Longest first. De-duplication is quadratic, and a noisy photo yields tens of thousands of
    # tiny edges (a 400x400 noise image gave 24k, about 21 s). Only the longest 300 are kept,
    # so de-duplicate just the longest MAX_DEDUPE_CANDIDATES (A6-08). In this order the longer of
    # two near-identical twins is the one kept.
    extracted_segments.sort(key=lambda s: math.hypot(s[2] - s[0], s[3] - s[1]), reverse=True)
    candidates = extracted_segments[:MAX_DEDUPE_CANDIDATES]

    # Deduplicate near-identical segments (Finding 10)
    merge_tol = max(3.0, 0.01 * min(width, height))
    deduped_segments = _dedupe_segments(candidates, tol=merge_tol)
    top_segments = deduped_segments[:MAX_RAW_SEGMENTS]

    # Merge nearby endpoints to create shared vertices for corner haptics
    point_registry: list[tuple[float, float, float, float, str]] = []  # (nx, ny, rx, ry, pid)

    def get_or_create_point(rx: float, ry: float) -> str:
        for _nx, _ny, px, py, pid in point_registry:
            if math.hypot(rx - px, ry - py) <= merge_tol:
                return pid
        pid = f"raw_p{len(point_registry)}"
        nx = max(0.0, min(1.0, rx / width))
        ny = max(0.0, min(1.0, ry / height))
        point_registry.append((nx, ny, rx, ry, pid))
        return pid

    segments: list[Segment] = []
    for idx, (x1, y1, x2, y2) in enumerate(top_segments):
        p_a = get_or_create_point(x1, y1)
        p_b = get_or_create_point(x2, y2)
        if p_a != p_b:
            segments.append(Segment(id=f"raw_s{idx}", a=p_a, b=p_b))

    points = [Point(id=pid, x=nx, y=ny) for nx, ny, _, _, pid in point_registry]

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
