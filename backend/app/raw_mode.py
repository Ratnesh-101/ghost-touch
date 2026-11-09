"""Raw Mode — OpenCV edge detection fallback (Task 8.4, F2, Lane h4).

Grayscale -> GaussianBlur(5) -> Canny(50, 150) -> findContours -> approxPolyDP
simplification, capped at <= 300 normalized segments with segment deduplication,
nearby endpoint merging, resolution safety capping, pre-edge downscaling (<=1600 px),
contour capping (~2000 longest), and cooperative cancellation.
"""

from __future__ import annotations

import heapq
import math
import threading
from collections.abc import Callable

import cv2
import numpy as np

from app.image_utils import MAX_IMAGE_PIXELS, get_exif_orientation, sniff_image_dimensions
from app.schema import DiagramScene, Point, Segment

MAX_RAW_SEGMENTS = 300  # Requirement 8.2
MAX_DEDUPE_CANDIDATES = 1000  # bounds the quadratic de-duplication (A6-08)
MAX_RAW_DIMENSION = 1600  # Downscale to at most 1600 px on long side before edge detection (A3)
# Cap contour/edge list to longest ~2000 before building objects & sorting (A3)
MAX_RAW_CONTOURS = 2000


class RawModeError(Exception):
    """Raised when Raw Mode cannot process or decode image bytes."""


def _check_cancel(cancel_check: threading.Event | Callable[[], bool] | None) -> None:
    """Check cooperative cancellation flag and abort early if signaled (A3)."""
    if cancel_check is None:
        return
    if isinstance(cancel_check, threading.Event):
        is_cancelled = cancel_check.is_set()
    else:
        is_cancelled = cancel_check()
    if is_cancelled:
        raise RawModeError("Raw mode processing cancelled")


def _dedupe_segments(
    segments: list[tuple[float, float, float, float]],
    tol: float = 4.0,
    cancel_check: threading.Event | Callable[[], bool] | None = None,
) -> list[tuple[float, float, float, float]]:
    """Remove near-identical duplicate segments (e.g., dual contour traces of thin lines)."""
    deduped: list[tuple[float, float, float, float]] = []
    for idx, s in enumerate(segments):
        if idx % 100 == 0:
            _check_cancel(cancel_check)
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


def apply_exif_orientation(img: np.ndarray, orientation: int | None) -> np.ndarray:
    """Rotate or flip decoded image array according to EXIF orientation tag (1..8)."""
    if orientation is None or orientation == 1:
        return img
    if orientation == 2:
        return cv2.flip(img, 1)
    if orientation == 3:
        return cv2.rotate(img, cv2.ROTATE_180)
    if orientation == 4:
        return cv2.flip(img, 0)
    if orientation == 5:
        return cv2.flip(cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE), 0)
    if orientation == 6:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    if orientation == 7:
        return cv2.flip(cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE), 0)
    if orientation == 8:
        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img


def build_raw_scene(
    image: bytes,
    cancel_check: threading.Event | Callable[[], bool] | None = None,
) -> DiagramScene:
    """Detect edges in an image with OpenCV and return a normalized DiagramScene.

    Pre-edge downscales images > 1600 px on the long side (A3).
    Grayscale -> GaussianBlur -> Canny(50, 150) -> findContours -> approxPolyDP.
    Caps contour/edge list to ~2000 longest candidates before full object creation (A3).
    Dedupes twin contours, merges nearby vertices, and keeps the longest segments up to 300.
    Supports cooperative cancellation between OpenCV stages (A3).
    Coordinates are normalized to [0, 1] relative to processed image dimensions.
    Raises RawModeError if image bytes cannot be decoded, exceed pixel cap, or are cancelled.
    """
    _check_cancel(cancel_check)

    # Header check before full decode
    dims = sniff_image_dimensions(image)
    if dims is not None and dims[0] * dims[1] > MAX_IMAGE_PIXELS:
        raise RawModeError(
            f"Image resolution ({dims[0]}x{dims[1]}) exceeds "
            f"{MAX_IMAGE_PIXELS // 1_000_000} MP limit",
        )

    _check_cancel(cancel_check)

    try:
        decoded = cv2.imdecode(
            np.frombuffer(image, np.uint8),
            cv2.IMREAD_COLOR | cv2.IMREAD_IGNORE_ORIENTATION,
        )
        if decoded is None:
            raise RawModeError("Could not decode image bytes")

        orientation = get_exif_orientation(image)
        if orientation is not None and orientation != 1:
            decoded = apply_exif_orientation(decoded, orientation)

        height, width = decoded.shape[:2]
        if height <= 0 or width <= 0:
            raise RawModeError("Invalid image dimensions")

        if height * width > MAX_IMAGE_PIXELS:
            raise RawModeError(
                f"Image resolution ({width}x{height}) exceeds "
                f"{MAX_IMAGE_PIXELS // 1_000_000} MP limit",
            )

        _check_cancel(cancel_check)

        # 1x1 or <3x3 images cannot contain polygonal diagram outlines
        if width < 3 or height < 3:
            return DiagramScene(
                version=1,
                kind="unknown",
                title=None,
                points=[],
                segments=[],
                polylines=[],
                bars=[],
                axes=None,
                facts=[],
            )

        # Convert to grayscale first, then free the 3-channel decoded buffer
        gray = cv2.cvtColor(decoded, cv2.COLOR_BGR2GRAY)
        del decoded

        # Downscale to at most MAX_RAW_DIMENSION (1600 px) on the long side
        # before edge detection (A3)
        max_dim = max(height, width)
        if max_dim > MAX_RAW_DIMENSION:
            scale = MAX_RAW_DIMENSION / max_dim
            proc_w = max(1, int(round(width * scale)))
            proc_h = max(1, int(round(height * scale)))
            gray = cv2.resize(gray, (proc_w, proc_h), interpolation=cv2.INTER_AREA)
        else:
            proc_w, proc_h = width, height

        _check_cancel(cancel_check)

        if proc_w < 3 or proc_h < 3:
            return DiagramScene(
                version=1,
                kind="unknown",
                title=None,
                points=[],
                segments=[],
                polylines=[],
                bars=[],
                axes=None,
                facts=[],
            )

        ksize = 5 if min(proc_w, proc_h) >= 5 else 3
        blurred = cv2.GaussianBlur(gray, (ksize, ksize), 0)
        del gray

        _check_cancel(cancel_check)

        edges = cv2.Canny(blurred, 50, 150)
        del blurred

        _check_cancel(cancel_check)

        contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        del edges

        _check_cancel(cancel_check)

        # Cap contour list to the longest ~2000 before building Python objects and sorting (A3)
        if len(contours) > MAX_RAW_CONTOURS:
            sorted_contours = sorted(
                contours,
                key=lambda c: cv2.arcLength(c, True),
                reverse=True,
            )
            contours = sorted_contours[:MAX_RAW_CONTOURS]

        _check_cancel(cancel_check)

        extracted_segments: list[tuple[float, float, float, float]] = []

        for idx, contour in enumerate(contours):
            if idx % 100 == 0:
                _check_cancel(cancel_check)
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
    except cv2.error as exc:
        raise RawModeError(f"OpenCV processing error: {exc}") from exc

    _check_cancel(cancel_check)

    # Longest first. Cap edge candidates to ~2000 longest before quadratic deduplication (A3, A6-08)
    if len(extracted_segments) > MAX_RAW_CONTOURS:
        extracted_segments = heapq.nlargest(
            MAX_RAW_CONTOURS,
            extracted_segments,
            key=lambda s: math.hypot(s[2] - s[0], s[3] - s[1]),
        )
    else:
        extracted_segments.sort(
            key=lambda s: math.hypot(s[2] - s[0], s[3] - s[1]),
            reverse=True,
        )

    candidates = extracted_segments[:MAX_DEDUPE_CANDIDATES]

    # Deduplicate near-identical segments (Finding 10)
    merge_tol = max(3.0, 0.01 * min(proc_w, proc_h))
    deduped_segments = _dedupe_segments(candidates, tol=merge_tol, cancel_check=cancel_check)
    top_segments = deduped_segments[:MAX_RAW_SEGMENTS]

    _check_cancel(cancel_check)

    # Merge nearby endpoints to create shared vertices for corner haptics
    point_registry: list[tuple[float, float, float, float, str]] = []  # (nx, ny, rx, ry, pid)

    def get_or_create_point(rx: float, ry: float) -> str:
        for _nx, _ny, px, py, pid in point_registry:
            if math.hypot(rx - px, ry - py) <= merge_tol:
                return pid
        pid = f"raw_p{len(point_registry)}"
        nx = max(0.0, min(1.0, rx / proc_w))
        ny = max(0.0, min(1.0, ry / proc_h))
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
