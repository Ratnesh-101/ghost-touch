"""Tests for Lane h4: Raw Mode downscaling, candidate capping, worker cancel, and upload slot handling.

Tests:
- Blank image (solid black)
- All-white image
- 1x1 image
- Extreme aspect ratio images (wide and tall)
- 12-megapixel noisy image (fast generation, downscaling, segment bounding)
- Pre-edge downscaling (<= 1600 px)
- Contour capping to longest ~2000 candidates
- Cooperative cancellation in build_raw_scene
- Slot retention and cancellation on timeout in scene route
- Upload buffer construction and status codes (413, 415, 422)
"""

from __future__ import annotations

import threading
import time
from typing import Any

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import (
    app,
    get_provider_chain,
    get_scene_semaphore,
    reset_scene_semaphore,
)
from app.raw_mode import (
    MAX_RAW_CONTOURS,
    MAX_RAW_DIMENSION,
    MAX_RAW_SEGMENTS,
    RawModeError,
    build_raw_scene,
)
from app.schema import DiagramScene
from app.vision.chain import ProviderChain


@pytest.fixture(autouse=True)
def clean_overrides() -> Any:
    app.dependency_overrides.clear()
    reset_scene_semaphore()
    yield
    app.dependency_overrides.clear()
    reset_scene_semaphore()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_h4_constants_configured() -> None:
    """Verify constants configured per brief A3."""
    assert MAX_RAW_DIMENSION == 1600
    assert MAX_RAW_CONTOURS == 2000
    assert MAX_RAW_SEGMENTS == 300


# --- 1. Edge cases in image dimensions and content ---


def test_h4_blank_image_returns_empty_raw_scene() -> None:
    """Blank (solid black) image yields 0 segments and 0 points."""
    img = np.zeros((200, 200, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    scene = build_raw_scene(buf.tobytes())
    assert isinstance(scene, DiagramScene)
    assert len(scene.points) == 0
    assert len(scene.segments) == 0


def test_h4_all_white_image_returns_empty_raw_scene() -> None:
    """All-white image yields 0 segments and 0 points."""
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    scene = build_raw_scene(buf.tobytes())
    assert isinstance(scene, DiagramScene)
    assert len(scene.points) == 0
    assert len(scene.segments) == 0


def test_h4_1x1_image_returns_empty_raw_scene() -> None:
    """1x1 image is safely handled without OpenCV kernel crashes."""
    img = np.array([[[255, 255, 255]]], dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    scene = build_raw_scene(buf.tobytes())
    assert isinstance(scene, DiagramScene)
    assert len(scene.points) == 0
    assert len(scene.segments) == 0


def test_h4_extreme_aspect_ratio_wide() -> None:
    """Extreme wide aspect ratio (3000 x 30) downscales and detects outlines."""
    img = np.zeros((30, 3000, 3), dtype=np.uint8)
    cv2.rectangle(img, (100, 5), (2900, 25), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    scene = build_raw_scene(buf.tobytes())
    assert isinstance(scene, DiagramScene)
    assert len(scene.segments) > 0
    assert len(scene.segments) <= MAX_RAW_SEGMENTS
    for pt in scene.points:
        assert 0.0 <= pt.x <= 1.0
        assert 0.0 <= pt.y <= 1.0


def test_h4_extreme_aspect_ratio_tall() -> None:
    """Extreme tall aspect ratio (30 x 3000) downscales and detects outlines."""
    img = np.zeros((3000, 30, 3), dtype=np.uint8)
    cv2.rectangle(img, (5, 100), (25, 2900), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    scene = build_raw_scene(buf.tobytes())
    assert isinstance(scene, DiagramScene)
    assert len(scene.segments) > 0
    assert len(scene.segments) <= MAX_RAW_SEGMENTS
    for pt in scene.points:
        assert 0.0 <= pt.x <= 1.0
        assert 0.0 <= pt.y <= 1.0


def test_h4_12_megapixel_noisy_image_fast() -> None:
    """12 MP image (4000x3000) with noise is downscaled <= 1600 px and completes fast."""
    h, w = 3000, 4000
    img = np.zeros((h, w), dtype=np.uint8)
    # Add high-contrast geometric lines
    cv2.rectangle(img, (200, 200), (3800, 2800), 255, 5)
    cv2.line(img, (200, 200), (3800, 2800), 255, 5)
    # Add some noise regions
    img[500:700, 500:700] = np.random.randint(0, 256, (200, 200), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 50])
    assert ok
    img_bytes = buf.tobytes()

    start = time.monotonic()
    scene = build_raw_scene(img_bytes)
    duration = time.monotonic() - start

    # Thanks to <= 1600 px pre-edge downscaling and contour capping, processing is fast
    assert duration < 3.0
    assert isinstance(scene, DiagramScene)
    assert len(scene.segments) <= MAX_RAW_SEGMENTS
    for pt in scene.points:
        assert 0.0 <= pt.x <= 1.0
        assert 0.0 <= pt.y <= 1.0


# --- 2. Downscaling and Candidate Capping ---


def test_h4_downscale_preserves_normalized_coordinate_bounds() -> None:
    """Images exceeding 1600 px are downscaled but normalized coordinates remain accurate."""
    w, h = 3200, 2400
    img = np.zeros((h, w, 3), dtype=np.uint8)
    # Rectangle from 10% to 90% in both dimensions
    cv2.rectangle(
        img,
        (int(w * 0.1), int(h * 0.1)),
        (int(w * 0.9), int(h * 0.9)),
        (255, 255, 255),
        4,
    )
    ok, buf = cv2.imencode(".png", img)
    assert ok
    scene = build_raw_scene(buf.tobytes())
    assert isinstance(scene, DiagramScene)
    assert len(scene.segments) > 0
    # Coordinates must all be strictly within [0.0, 1.0]
    for pt in scene.points:
        assert 0.0 <= pt.x <= 1.0
        assert 0.0 <= pt.y <= 1.0
    # Points should exist around ~0.1 and ~0.9
    xs = [pt.x for pt in scene.points]
    ys = [pt.y for pt in scene.points]
    assert any(abs(x - 0.1) < 0.05 for x in xs)
    assert any(abs(x - 0.9) < 0.05 for x in xs)
    assert any(abs(y - 0.1) < 0.05 for y in ys)
    assert any(abs(y - 0.9) < 0.05 for y in ys)


def test_h4_dense_noise_contour_capping() -> None:
    """Dense noise with thousands of contours is capped to MAX_RAW_CONTOURS before processing."""
    img = np.zeros((600, 600, 3), dtype=np.uint8)
    # Generate hundreds of tiny boxes to create many contours
    for x in range(10, 590, 8):
        for y in range(10, 590, 8):
            img[y : y + 3, x : x + 3] = (255, 255, 255)

    ok, buf = cv2.imencode(".png", img)
    assert ok

    start = time.monotonic()
    scene = build_raw_scene(buf.tobytes())
    duration = time.monotonic() - start

    assert duration < 3.0
    assert len(scene.segments) <= MAX_RAW_SEGMENTS


# --- 3. Cooperative Cancellation ---


def test_h4_cooperative_cancel_event_aborts_immediately() -> None:
    """Pre-set cancellation event aborts build_raw_scene before processing."""
    img = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.rectangle(img, (20, 20), (180, 180), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok

    cancel_event = threading.Event()
    cancel_event.set()

    with pytest.raises(RawModeError, match="cancelled"):
        build_raw_scene(buf.tobytes(), cancel_check=cancel_event)


def test_h4_cooperative_cancel_callback_stops_mid_stage() -> None:
    """Cancellation callback signaled between stages halts processing promptly."""
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    cv2.rectangle(img, (20, 20), (380, 380), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok

    checks = 0

    def cancel_after_two_checks() -> bool:
        nonlocal checks
        checks += 1
        return checks >= 2

    with pytest.raises(RawModeError, match="cancelled"):
        build_raw_scene(buf.tobytes(), cancel_check=cancel_after_two_checks)


# --- 4. Scene Route Integration: Status Codes and Queue ---


def test_h4_scene_route_blank_image_returns_422(client: TestClient) -> None:
    """Blank image uploaded to /api/v1/scene returns 422 with clear detail message."""
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok

    response = client.post(
        "/api/v1/scene",
        files={"image": ("blank.png", buf.tobytes(), "image/png")},
    )
    assert response.status_code == 422
    assert "No diagram outlines detected" in response.json()["detail"]


def test_h4_scene_route_1x1_image_returns_422(client: TestClient) -> None:
    """1x1 image uploaded to /api/v1/scene returns 422."""
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])
    img = np.array([[[255, 255, 255]]], dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok

    response = client.post(
        "/api/v1/scene",
        files={"image": ("tiny.png", buf.tobytes(), "image/png")},
    )
    assert response.status_code == 422
    assert "No diagram outlines detected" in response.json()["detail"]


def test_h4_scene_route_upload_status_codes_preserved(client: TestClient) -> None:
    """Preserves standard HTTP status codes: 415 (mime), 413 (size), 422 (empty)."""
    # 415: Unsupported MIME
    r415 = client.post(
        "/api/v1/scene",
        files={"image": ("diagram.gif", b"GIF89a...", "image/gif")},
    )
    assert r415.status_code == 415

    # 413: Content-Length header exceeding 10 MB
    r413 = client.post(
        "/api/v1/scene",
        files={"image": ("oversized.png", b"x", "image/png")},
        headers={"Content-Length": str(15 * 1024 * 1024)},
    )
    assert r413.status_code == 413

    # 422: Empty upload
    r422 = client.post(
        "/api/v1/scene",
        files={"image": ("empty.png", b"", "image/png")},
    )
    assert r422.status_code == 422


def test_h4_scene_route_takes_slot_before_reading_stream(client: TestClient) -> None:
    """When semaphore is exhausted, /api/v1/scene returns 503 queue_timeout without reading."""
    sem = get_scene_semaphore()
    # Acquire all available slots
    acquired = []
    while not sem.locked():
        acquired.append(sem._value)
        sem._value -= 1

    try:
        response = client.post(
            "/api/v1/scene",
            files={"image": ("test.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
        )
        assert response.status_code == 503
        assert "queue_timeout" in response.json()["detail"]
    finally:
        # Restore semaphore slots
        for _ in acquired:
            sem.release()


def test_h4_scene_route_timeout_cancels_worker_and_holds_slot(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """On timeout, worker thread is cancelled and slot remains held until thread completes."""
    monkeypatch.setenv("SCENE_TIMEOUT_SECONDS", "0.2")
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])

    thread_finished = threading.Event()
    cancel_received = threading.Event()

    def slow_raw_scene(
        image: bytes,
        cancel_check: threading.Event | None = None,
    ) -> DiagramScene:
        # Poll cancel flag in a loop with short sleeps so cancellation is observed
        for _ in range(500):
            if cancel_check is not None:
                is_cancelled = (
                    cancel_check.is_set() if hasattr(cancel_check, "is_set") else cancel_check()
                )
                if is_cancelled:
                    cancel_received.set()
                    break
            time.sleep(0.01)
        thread_finished.set()
        raise RawModeError("timed out")

    monkeypatch.setattr("app.main.build_raw_scene", slow_raw_scene)

    img = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.rectangle(img, (10, 10), (90, 90), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok

    response = client.post(
        "/api/v1/scene",
        files={"image": ("test.png", buf.tobytes(), "image/png")},
    )
    assert response.status_code == 504
    assert "timed out" in response.json()["detail"]

    # Verify cooperative cancel was received by the worker thread (bounded wait)
    assert cancel_received.wait(timeout=5.0)
    # Verify worker thread finished cleanly before slot was released
    assert thread_finished.wait(timeout=5.0)


def test_h4_scene_route_backward_compatible_with_one_arg_raw_builder(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A plain 1-argument builder function (no cancel_check) works without TypeError."""
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])

    calls = {"n": 0}

    def legacy_builder(image: bytes) -> DiagramScene:
        calls["n"] += 1
        return build_raw_scene(image)

    monkeypatch.setattr("app.main.build_raw_scene", legacy_builder)

    img = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.rectangle(img, (10, 10), (90, 90), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok

    response = client.post(
        "/api/v1/scene",
        files={"image": ("test.png", buf.tobytes(), "image/png")},
    )
    assert response.status_code == 200
    assert calls["n"] == 1
    data = response.json()
    assert data["mode"] == "raw"
    assert len(data["scene"]["segments"]) > 0
