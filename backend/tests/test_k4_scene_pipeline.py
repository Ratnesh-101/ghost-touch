"""Regression tests for lane k4-scene-pipeline.

Covers:
- B2-01: Absolute remaining deadline calculation (no budget overrun).
- B2-02: Client disconnect cancellation in POST /api/v1/scene (frees slot and permit).
- B2-03: OpenCV internal errors (cv2.error) become clean HTTP 422, never HTTP 500.
- B2-04: EXIF orientation applied before Raw Mode contour extraction.
- B2-07 / F13: Improve pass does not overwrite cached equation-route function graph.
- B2-08: Vision provider timeouts mapped to reason="timeout" only on real deadline overrun.
- B2-09: OpenAIProvider downscales large images inline to prevent upload timeouts.
- F14: Cancellation aimed at request handler is re-raised.
- F16: Generic error messages without echoing raw exception text or provider names.
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import struct
import time
from typing import Any

import cv2
import numpy as np
import pytest
from fastapi import HTTPException, Response
from fastapi.testclient import TestClient

from app.image_utils import get_exif_orientation, validate_image_bytes
from app.limits import get_scene_in_flight_limiter, reset_in_flight_limits
from app.main import (
    _run_improve_pass_locked,
    app,
    get_provider_chain,
    get_scene_semaphore,
    process_scene,
    reset_scene_semaphore,
)
from app.raw_mode import RawModeError, apply_exif_orientation, build_raw_scene
from app.scene_cache import scene_cache
from app.validate import ValidationResult
from app.vision.base import VisionError
from app.vision.chain import ProviderChain
from app.vision.openai_provider import OpenAIProvider


def _make_png_bytes(width: int = 120, height: int = 80) -> bytes:
    """Generate a small valid test PNG with a drawn rectangle."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.rectangle(img, (10, 10), (width - 10, height - 10), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


def _make_jpeg_with_exif_orientation(
    width: int = 200, height: int = 60, orientation: int = 6
) -> bytes:
    """Generate a JPEG with an APP1 EXIF segment containing the given orientation tag."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.rectangle(img, (10, 10), (width - 10, height - 10), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    raw_jpg = buf.tobytes()

    # Construct TIFF IFD with orientation tag 0x0112 (little endian)
    app1_payload = (
        b"Exif\x00\x00"
        b"II\x2a\x00"
        b"\x08\x00\x00\x00"  # IFD0 offset
        b"\x01\x00"  # 1 entry
        b"\x12\x01\x03\x00\x01\x00\x00\x00"  # tag=0x0112, type=SHORT, count=1
        + struct.pack("<H", orientation)
        + b"\x00\x00"  # value padded to 4 bytes
        b"\x00\x00\x00\x00"  # next IFD offset
    )
    seg_len = len(app1_payload) + 2
    app1_marker = b"\xff\xe1" + struct.pack(">H", seg_len) + app1_payload
    return raw_jpg[:2] + app1_marker + raw_jpg[2:]


class FakeSlowProvider:
    """Fake provider with controllable latency or failure."""

    def __init__(self, delay: float = 0.0, error: Exception | None = None) -> None:
        self.name = "gemini"
        self.delay = delay
        self.error = error
        self.call_count = 0
        self.cancelled = False

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        self.call_count += 1
        try:
            if self.delay > 0:
                await asyncio.sleep(self.delay)
            if self.error is not None:
                raise self.error
            return json.dumps(
                {
                    "version": 1,
                    "kind": "geometry",
                    "title": "Test Triangle",
                    "points": [
                        {"id": "p1", "x": 0.1, "y": 0.1},
                        {"id": "p2", "x": 0.9, "y": 0.1},
                        {"id": "p3", "x": 0.5, "y": 0.8},
                    ],
                    "segments": [
                        {"id": "s1", "a": "p1", "b": "p2"},
                        {"id": "s2", "a": "p2", "b": "p3"},
                        {"id": "s3", "a": "p3", "b": "p1"},
                    ],
                    "polylines": [],
                    "bars": [],
                    "axes": None,
                    "facts": [],
                }
            )
        except asyncio.CancelledError:
            self.cancelled = True
            raise


@pytest.fixture(autouse=True)
def _reset_state() -> Any:
    scene_cache.clear()
    reset_scene_semaphore()
    reset_in_flight_limits()
    app.dependency_overrides.clear()
    yield
    scene_cache.clear()
    reset_scene_semaphore()
    reset_in_flight_limits()
    app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# --- B2-01: Absolute remaining deadline ---


def test_b2_01_ai_timeout_uses_absolute_deadline_without_overrun(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AI deadline accounts for elapsed time and does not overrun total budget."""
    monkeypatch.setenv("SCENE_TIMEOUT_SECONDS", "1.0")
    monkeypatch.setenv("PROVIDER_TIMEOUT_SECONDS", "5.0")
    provider = FakeSlowProvider(delay=3.0)
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    png_bytes = _make_png_bytes()
    start = time.monotonic()
    resp = client.post(
        "/api/v1/scene",
        files={"image": ("test.png", io.BytesIO(png_bytes), "image/png")},
    )
    elapsed = time.monotonic() - start

    assert resp.status_code == 200
    assert resp.json()["mode"] == "raw"
    assert resp.json()["reason"] == "timeout"
    # Must finish around 1.0s, not wait for 3.0s provider delay
    assert elapsed < 1.8


# --- B2-02: Client disconnect during model call ---


def test_b2_02_client_disconnect_cancels_vision_call_and_frees_slot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Client disconnect mid-call cancels provider, returns 499, and releases permits."""
    monkeypatch.setattr("app.main.ASK_DISCONNECT_POLL_SECONDS", 0.01)
    provider = FakeSlowProvider(delay=2.0)
    chain = ProviderChain([provider])

    disconnect_after_polls = 1
    polls = 0

    class MockAddress:
        host = "10.0.0.99"
        port = 54321

    class MockDisconnectingRequest:
        headers = {"content-type": "image/png"}
        client = MockAddress()

        async def is_disconnected(self) -> bool:
            nonlocal polls
            polls += 1
            return polls > disconnect_after_polls

    class MockUploadFile:
        content_type = "image/png"
        filename = "test.png"
        _read = False

        async def read(self, size: int = -1) -> bytes:
            if not self._read:
                self._read = True
                return _make_png_bytes()
            return b""

    sem = get_scene_semaphore()
    assert sem._value == 2

    response = Response()
    from fastapi import BackgroundTasks

    bg_tasks = BackgroundTasks()

    async def _run() -> Response:
        return await process_scene(
            request=MockDisconnectingRequest(),  # type: ignore[arg-type]
            response=response,
            background_tasks=bg_tasks,
            image=MockUploadFile(),  # type: ignore[arg-type]
            chain=chain,
            validator=lambda x: ValidationResult(scene=None, errors=[]),
        )

    resp = asyncio.run(_run())

    assert isinstance(resp, Response)
    assert resp.status_code == 499
    assert provider.cancelled is True
    # Global semaphore slot must be released
    assert sem._value == 2
    # Client in-flight limiter permit must be released
    limiter = get_scene_in_flight_limiter()
    assert limiter.count("10.0.0.99") == 0
    assert limiter.acquire("10.0.0.99") is True
    limiter.release("10.0.0.99")


# --- B2-03: OpenCV internal error handling ---


def test_b2_03_cv2_error_becomes_clean_422_not_500(monkeypatch: pytest.MonkeyPatch) -> None:
    """OpenCV internal cv2.error is caught and converted to clean HTTP 422."""
    png_bytes = _make_png_bytes(50, 50)

    def _failing_gaussian(*args: Any, **kwargs: Any) -> Any:
        raise cv2.error("OpenCV internal assertion failure: ksize.width > 0")

    monkeypatch.setattr(cv2, "GaussianBlur", _failing_gaussian)

    # In raw_mode directly
    with pytest.raises(RawModeError, match="OpenCV processing error"):
        build_raw_scene(png_bytes)

    # In route
    client = TestClient(app)
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])
    resp = client.post(
        "/api/v1/scene",
        files={"image": ("test.png", io.BytesIO(png_bytes), "image/png")},
    )
    assert resp.status_code == 422
    assert "Could not process image" in resp.json()["detail"]
    assert "OpenCV" not in resp.json()["detail"]  # No internal details leaked


# --- B2-04: EXIF orientation in Raw Mode ---


def test_b2_04_exif_orientation_applied_before_raw_mode() -> None:
    """EXIF orientation rotates image so detected coordinates match screen orientation."""
    # Create horizontal rectangle (width 200, height 60) with orientation 6 (90 CW)
    jpeg_bytes = _make_jpeg_with_exif_orientation(width=200, height=60, orientation=6)
    ori = get_exif_orientation(jpeg_bytes)
    assert ori == 6

    scene = build_raw_scene(jpeg_bytes)
    assert len(scene.segments) > 0

    # After 90 deg rotation, horizontal rectangle becomes vertical: height > width
    ys = [pt.y for pt in scene.points]
    xs = [pt.x for pt in scene.points]
    y_span = max(ys) - min(ys)
    x_span = max(xs) - min(xs)
    assert y_span > x_span


def test_b2_04_dual_app1_orientation_not_overwritten() -> None:
    """Dual APP1 segments (Exif then XMP) preserve the parsed orientation (B2-11)."""
    raw_jpg = _make_jpeg_with_exif_orientation(orientation=6)
    # Append second APP1 segment (e.g. XMP namespace)
    xmp_payload = b"http://ns.adobe.com/xap/1.0/\x00"
    xmp_marker = b"\xff\xe1" + struct.pack(">H", len(xmp_payload) + 2) + xmp_payload
    dual_jpg = raw_jpg[:2] + raw_jpg[2:36] + xmp_marker + raw_jpg[36:]

    assert get_exif_orientation(dual_jpg) == 6


def test_b2_04_apply_exif_orientation_all_tags() -> None:
    """Test all EXIF orientation transforms (1 through 8)."""
    img = np.zeros((40, 60, 3), dtype=np.uint8)
    for tag in range(1, 9):
        transformed = apply_exif_orientation(img, tag)
        assert transformed is not None
        if tag in (5, 6, 7, 8):
            assert transformed.shape[:2] == (60, 40)
        else:
            assert transformed.shape[:2] == (40, 60)


# --- B2-07 / F13: Function graph equation route preserved in cache ---


def test_b2_07_f13_improve_pass_does_not_overwrite_equation_graph() -> None:
    """Background improve pass never overwrites equation-sampled function graph."""
    cache_key = "test_func_graph_hash"
    equation_scene = {
        "version": 1,
        "kind": "function_graph",
        "title": "f(x) = sin(x)",
        "points": [],
        "segments": [],
        "polylines": [{"id": "curve", "points": [[0.1, 0.5], [0.9, 0.5]]}],
        "bars": [],
        "axes": None,
        "facts": ["y = sin(x)"],
    }
    scene_cache.put(cache_key, {"scene": equation_scene, "mode": "ai"}, "gemini")

    crude_trace_scene = {
        "version": 1,
        "kind": "function_graph",
        "title": "crude trace",
        "points": [],
        "segments": [{"id": "s1", "a": "p1", "b": "p2"}],
        "polylines": [],
        "bars": [],
        "axes": None,
        "facts": [],
    }

    class FakeImproveProvider:
        name = "gemini_improve"

        async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
            return json.dumps(crude_trace_scene)

    async def _run() -> None:
        await _run_improve_pass_locked(
            improve_provider=FakeImproveProvider(),  # type: ignore[arg-type]
            image_bytes=b"dummy",
            content_type="image/png",
            cache_key=cache_key,
            validator=lambda x: ValidationResult(scene=None, errors=[]),
        )

    asyncio.run(_run())

    cached_entry = scene_cache.get(cache_key)
    assert cached_entry is not None
    payload, provider = cached_entry
    assert payload["scene"]["title"] == "f(x) = sin(x)"
    assert provider == "gemini"


# --- B2-08: Provider timeouts mapped to reason="timeout" only on real deadline overrun ---


def test_b2_08_provider_timeout_sets_reason_timeout(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Vision model call that overruns the scene deadline sets fallback_reason='timeout'."""
    monkeypatch.setenv("SCENE_TIMEOUT_SECONDS", "0.2")
    provider = FakeSlowProvider(
        delay=0.4,
        error=VisionError("gemini", "request timed out after 8.0s", transient=False),
    )
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    png_bytes = _make_png_bytes()
    resp = client.post(
        "/api/v1/scene",
        files={"image": ("test.png", io.BytesIO(png_bytes), "image/png")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "raw"
    assert data["reason"] == "timeout"


def test_b2_08_deadline_reached_sets_reason_timeout(client: TestClient) -> None:
    """VisionError with 'deadline reached' sets fallback_reason='timeout'."""
    provider = FakeSlowProvider(
        error=VisionError("chain", "deadline reached before a provider answered")
    )
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    png_bytes = _make_png_bytes()
    resp = client.post(
        "/api/v1/scene",
        files={"image": ("test.png", io.BytesIO(png_bytes), "image/png")},
    )
    assert resp.status_code == 200
    assert resp.json()["reason"] == "timeout"


def test_b2_08_provider_error_quick_failure_sets_reason_provider_error(client: TestClient) -> None:
    """Providers failing quickly before the deadline set fallback_reason='provider_error'."""
    provider = FakeSlowProvider(
        delay=0.0,
        error=VisionError("gemini", "503 service unavailable", transient=False),
    )
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    png_bytes = _make_png_bytes()
    resp = client.post(
        "/api/v1/scene",
        files={"image": ("test.png", io.BytesIO(png_bytes), "image/png")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "raw"
    assert data["reason"] == "provider_error"


# --- B2-09: OpenAIProvider downscales large images inline ---


def test_b2_09_openai_provider_downscales_large_image(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """OpenAIProvider downscales image exceeding inline_limit before base64 encoding."""
    posted_body: dict[str, Any] = {}

    async def _mock_post(body: dict[str, Any], timeout: float) -> str:
        nonlocal posted_body
        posted_body = body
        return json.dumps({"kind": "unknown"})

    inline_limit = 20_000
    provider = OpenAIProvider(api_key="test-key", inline_limit=inline_limit)
    monkeypatch.setattr(provider, "_post", _mock_post)

    # Seeded random noise saved as high-quality JPEG gives a genuinely large byte
    # payload well above inline_limit and 3000x3000 dimensions well above the limit.
    orig_w, orig_h = 3000, 3000
    rng = np.random.default_rng(42)
    img = rng.integers(0, 256, size=(orig_h, orig_w, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    assert ok
    image_bytes = buf.tobytes()
    assert len(image_bytes) > 20_000
    assert len(image_bytes) > provider.inline_limit

    async def _run() -> None:
        await provider.extract(image_bytes, "image/jpeg", "Extract diagram", timeout=8.0)

    asyncio.run(_run())

    assert "messages" in posted_body
    content = posted_body["messages"][0]["content"]
    image_url = content[1]["image_url"]["url"]
    assert image_url.startswith("data:image/jpeg;base64,")

    b64_data = image_url.split(",", 1)[1]
    fitted_bytes = base64.b64decode(b64_data)
    assert len(fitted_bytes) <= provider.inline_limit
    assert len(fitted_bytes) < len(image_bytes)

    fitted_img = cv2.imdecode(np.frombuffer(fitted_bytes, np.uint8), cv2.IMREAD_COLOR)
    assert fitted_img is not None
    fitted_h, fitted_w = fitted_img.shape[:2]
    assert max(fitted_h, fitted_w) <= 1024
    assert max(fitted_h, fitted_w) <= 1600
    assert fitted_h < orig_h
    assert fitted_w < orig_w


# --- F14: Re-raise cancellation aimed at handler ---


def test_f14_cancellation_aimed_at_handler_is_reraised() -> None:
    """Handler cancellation is re-raised and releases the semaphore and client permit."""
    provider = FakeSlowProvider(delay=10.0)
    chain = ProviderChain([provider])

    class MockAddress:
        host = "10.0.0.12"
        port = 1234

    class MockRequest:
        headers = {"content-type": "image/png"}
        client = MockAddress()

        async def is_disconnected(self) -> bool:
            return False

    class MockUploadFile:
        content_type = "image/png"
        filename = "test.png"
        _read = False

        async def read(self, size: int = -1) -> bytes:
            if not self._read:
                self._read = True
                return _make_png_bytes()
            return b""

    sem = get_scene_semaphore()
    assert sem._value == 2

    from fastapi import BackgroundTasks

    async def _run() -> None:
        task = asyncio.create_task(
            process_scene(
                request=MockRequest(),  # type: ignore[arg-type]
                response=Response(),
                background_tasks=BackgroundTasks(),
                image=MockUploadFile(),  # type: ignore[arg-type]
                chain=chain,
                validator=lambda x: ValidationResult(scene=None, errors=[]),
            )
        )
        await asyncio.sleep(0.02)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(_run())

    # Slot must be cleanly released back to capacity
    assert sem._value == 2
    limiter = get_scene_in_flight_limiter()
    assert limiter.count("10.0.0.12") == 0


# --- F16: Generic error messages ---


def test_f16_validate_image_bytes_does_not_echo_raw_mime() -> None:
    """415 response from validate_image_bytes does not echo unvalidated input."""
    png_bytes = _make_png_bytes()
    with pytest.raises(HTTPException) as exc_info:
        validate_image_bytes(png_bytes, declared_mime="image/jpeg")

    assert exc_info.value.status_code == 415
    detail = exc_info.value.detail
    assert "image/jpeg" not in detail
    assert "Declared content type does not match" in detail


def test_f16_scene_headers_expose_ai_or_raw_only(client: TestClient) -> None:
    """X-Vision-Provider exposes 'ai' or 'raw' only, never provider names."""
    provider = FakeSlowProvider(delay=0.0)
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    png_bytes = _make_png_bytes()
    resp = client.post(
        "/api/v1/scene",
        files={"image": ("test.png", io.BytesIO(png_bytes), "image/png")},
    )
    assert resp.status_code == 200
    assert resp.headers["X-Vision-Provider"] == "ai"
    assert resp.headers["X-Vision-Provider"] not in ("gemini", "openai", "nebius")
