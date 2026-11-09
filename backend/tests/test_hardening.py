"""Tests for backend hardening findings (SEC-01, SEC-02, SEC-04, SEC-06, SEC-07, SEC-08, SEC-03)."""

from __future__ import annotations

import asyncio
import json
import logging
import struct
from unittest.mock import AsyncMock

import cv2
import httpx
import numpy as np
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.image_utils import (
    MAX_IMAGE_PIXELS,
    sniff_image_dimensions,
    validate_image_bytes,
)
from app.main import (
    app,
    create_app,
    get_provider_chain,
    parse_scene_max_concurrency,
    parse_scene_queue_wait_seconds,
    reset_scene_semaphore,
)
from app.vision.base import VisionError
from app.vision.chain import ProviderChain


def make_test_png(width: int = 100, height: int = 100) -> bytes:
    """Create a valid PNG image buffer."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.rectangle(img, (10, 10), (width - 10, height - 10), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


class SlowFakeProvider:
    """Fake vision provider with configurable delay and responses."""

    def __init__(self, name: str = "fake", delay: float = 0.0, fail: bool = False) -> None:
        self.name = name
        self.delay = delay
        self.fail = fail
        self.call_count = 0

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        self.call_count += 1
        if self.delay > 0:
            await asyncio.sleep(self.delay)
        if self.fail:
            raise VisionError(self.name, "Simulated provider failure")
        return json.dumps(
            {
                "version": 1,
                "kind": "geometry",
                "title": "Square",
                "points": [
                    {"id": "p1", "x": 0.2, "y": 0.2, "label": "corner A"},
                    {"id": "p2", "x": 0.8, "y": 0.8, "label": "corner B"},
                ],
                "segments": [
                    {"id": "s1", "a": "p1", "b": "p2", "label": "diagonal"},
                ],
                "polylines": [],
                "bars": [],
                "axes": None,
                "facts": ["diagonal = 5 cm"],
            }
        )

    async def complete(self, prompt: str, *, timeout: float) -> str:
        return "fake answer"


# ===========================================================================
# SEC-01: Concurrency Cap Tests
# ===========================================================================


def test_parse_scene_concurrency_settings(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING)

    # Valid settings
    monkeypatch.setenv("SCENE_MAX_CONCURRENCY", "4")
    assert parse_scene_max_concurrency() == 4

    monkeypatch.setenv("SCENE_QUEUE_WAIT_SECONDS", "8.5")
    assert parse_scene_queue_wait_seconds() == 8.5

    # Invalid / below minimum fallbacks
    monkeypatch.setenv("SCENE_MAX_CONCURRENCY", "0")
    assert parse_scene_max_concurrency() == 2
    assert any("SCENE_MAX_CONCURRENCY must be at least 1" in r.message for r in caplog.records)

    monkeypatch.setenv("SCENE_QUEUE_WAIT_SECONDS", "-1.0")
    assert parse_scene_queue_wait_seconds() == 6.0
    assert any("SCENE_QUEUE_WAIT_SECONDS must be non-negative" in r.message for r in caplog.records)


def test_concurrency_cap_third_request_waits_then_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """3 concurrent requests with cap=2 and slow provider: 3rd waits and succeeds."""

    async def _run() -> None:
        monkeypatch.setenv("SCENE_MAX_CONCURRENCY", "2")
        monkeypatch.setenv("SCENE_QUEUE_WAIT_SECONDS", "3.0")
        reset_scene_semaphore()

        provider = SlowFakeProvider(delay=0.2)
        chain = ProviderChain([provider])
        app.dependency_overrides[get_provider_chain] = lambda: chain

        try:
            img_bytes = make_test_png(120, 120)

            async def send_req(i: int) -> httpx.Response:
                transport = httpx.ASGITransport(app=app, client=(f"10.0.0.{i}", 5000))
                async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                    files = {"image": (f"test_{i}.png", img_bytes, "image/png")}
                    return await client.post("/api/v1/scene", files=files)

            # Fire 3 requests concurrently
            responses = await asyncio.gather(send_req(1), send_req(2), send_req(3))

            for r in responses:
                assert r.status_code == 200
                data = r.json()
                assert data["mode"] == "ai"
        finally:
            reset_scene_semaphore()
            app.dependency_overrides.clear()

    asyncio.run(_run())


def test_concurrency_cap_queue_timeout_returns_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """3 concurrent requests with cap=2 and short queue wait: 3rd gets 503 Retry-After."""

    async def _run() -> None:
        monkeypatch.setenv("SCENE_MAX_CONCURRENCY", "2")
        monkeypatch.setenv("SCENE_QUEUE_WAIT_SECONDS", "0.05")
        reset_scene_semaphore()

        provider = SlowFakeProvider(delay=0.3)
        chain = ProviderChain([provider])
        app.dependency_overrides[get_provider_chain] = lambda: chain

        try:
            img_bytes = make_test_png(120, 120)

            async def send_req(i: int) -> httpx.Response:
                transport = httpx.ASGITransport(app=app, client=(f"10.0.0.{i}", 5000))
                async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                    files = {"image": (f"test_{i}.png", img_bytes, "image/png")}
                    return await client.post("/api/v1/scene", files=files)

            responses = await asyncio.gather(send_req(1), send_req(2), send_req(3))
            status_codes = [r.status_code for r in responses]

            assert 503 in status_codes
            assert status_codes.count(200) == 2

            err_resp = next(r for r in responses if r.status_code == 503)
            assert err_resp.headers.get("retry-after") == "5"
            data = err_resp.json()
            assert "detail" in data
            assert "reason: queue_timeout" in data["detail"]
        finally:
            reset_scene_semaphore()
            app.dependency_overrides.clear()

    asyncio.run(_run())


def test_concurrency_cap_slot_released_on_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Semaphore slot is always released when an exception occurs inside the handler."""

    async def _run() -> None:
        monkeypatch.setenv("SCENE_MAX_CONCURRENCY", "1")
        monkeypatch.setenv("SCENE_QUEUE_WAIT_SECONDS", "1.0")
        reset_scene_semaphore()

        failing_provider = SlowFakeProvider(fail=True)
        chain = ProviderChain([failing_provider])
        app.dependency_overrides[get_provider_chain] = lambda: chain

        try:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_bytes = make_test_png(120, 120)

                # First request fails in AI and falls back to raw mode (returns 200 raw mode)
                files1 = {"image": ("test_1.png", img_bytes, "image/png")}
                resp1 = await client.post("/api/v1/scene", files=files1)
                assert resp1.status_code == 200

                # Second request must immediately get a slot without timing out
                files2 = {"image": ("test_2.png", img_bytes, "image/png")}
                resp2 = await client.post("/api/v1/scene", files=files2)
                assert resp2.status_code == 200
        finally:
            reset_scene_semaphore()
            app.dependency_overrides.clear()

    asyncio.run(_run())


# ===========================================================================
# SEC-02: Pixel Limit Tests
# ===========================================================================


def test_pixel_limit_12_megapixels() -> None:
    """12 MP cap: 12.1 MP image is rejected with 422; 11 MP image is accepted."""
    assert MAX_IMAGE_PIXELS == 12_000_000

    # 12.1 MP PNG header (4000 x 3025 = 12,100,000 pixels)
    header_12_1mp = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        + struct.pack(">II", 4000, 3025)
        + b"\x08\x02\x00\x00\x00\x00\x00\x00\x00"
    )
    with pytest.raises(HTTPException) as exc_info:
        validate_image_bytes(header_12_1mp, "image/png")
    assert exc_info.value.status_code == 422
    assert "exceeds maximum allowed 12 megapixels" in exc_info.value.detail

    # 11 MP PNG header (4000 x 2750 = 11,000,000 pixels)
    header_11mp = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        + struct.pack(">II", 4000, 2750)
        + b"\x08\x02\x00\x00\x00\x00\x00\x00\x00"
    )
    mime, w, h = validate_image_bytes(header_11mp, "image/png")
    assert mime == "image/png"
    assert w == 4000
    assert h == 2750


# ===========================================================================
# SEC-04: EXIF Orientation Investigation & Test
# ===========================================================================


def make_jpeg_with_exif_orientation_6(width: int = 100, height: int = 50) -> bytes:
    """Construct a minimal JPEG with an APP1 EXIF Orientation tag set to 6 (90° CW)."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[10:20, 10:40] = 255
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    raw_jpg = buf.tobytes()

    app1_payload = (
        b"Exif\x00\x00"
        b"II*\x00\x08\x00\x00\x00"
        b"\x01\x00"
        b"\x12\x01\x03\x00\x01\x00\x00\x00\x06\x00\x00\x00"
        b"\x00\x00\x00\x00"
    )
    app1_length = len(app1_payload) + 2
    app1_segment = b"\xff\xe1" + struct.pack(">H", app1_length) + app1_payload
    return raw_jpg[:2] + app1_segment + raw_jpg[2:]


def test_sec_04_exif_orientation_behavior() -> None:
    """Assert behavior of dimension sniffing vs cv2.imdecode on JPEG with EXIF orientation 6.

    Evidence collected & verified:
    - OpenCV's cv2.imdecode(..., cv2.IMREAD_COLOR) rotates JPEG by EXIF orientation tag 6:
      decoded array shape is (100, 50, 3) (height=100, width=50).
    - sniff_image_dimensions inspects APP1 EXIF orientation tag 6 and adjusts dimensions:
      reported dimensions are (width=50, height=100).
    - Decoded array dimensions and sniffed dimensions are in full agreement (width=50, height=100).
    """
    jpeg_bytes = make_jpeg_with_exif_orientation_6(width=100, height=50)

    # 1. Dimension sniffing from SOF0 + EXIF orientation 6 tag
    sniffed = sniff_image_dimensions(jpeg_bytes)
    assert sniffed == (50, 100)

    # 2. cv2.imdecode behavior
    decoded = cv2.imdecode(np.frombuffer(jpeg_bytes, np.uint8), cv2.IMREAD_COLOR)
    assert decoded is not None
    dec_h, dec_w = decoded.shape[:2]

    # Both agree on the oriented dimensions (width 50, height 100)
    assert dec_w == 50
    assert dec_h == 100
    assert (dec_w, dec_h) == sniffed


# ===========================================================================
# SEC-06: POST /api/v1/validate Structural Limits Tests
# ===========================================================================


def test_validate_structural_limits() -> None:
    """POST /api/v1/validate rejects oversized scenes with HTTP 422 and standard validation shape."""
    client = TestClient(app)

    # 1. Exceeds points limit (> 500)
    huge_points = [{"id": f"p{i}", "x": 0.5, "y": 0.5} for i in range(501)]
    resp = client.post(
        "/api/v1/validate", json={"scene": {"kind": "geometry", "points": huge_points}}
    )
    assert resp.status_code == 422
    assert "scene has too many points" in str(resp.json())

    # 2. Exceeds segments limit (> 1000)
    huge_segments = [{"id": f"s{i}", "a": "p1", "b": "p2"} for i in range(1001)]
    resp = client.post(
        "/api/v1/validate", json={"scene": {"kind": "geometry", "segments": huge_segments}}
    )
    assert resp.status_code == 422
    assert "scene has too many segments" in str(resp.json())

    # 3. Exceeds polylines limit (> 50)
    huge_polylines = [{"id": f"pl{i}", "points": [[0.1, 0.1], [0.2, 0.2]]} for i in range(51)]
    resp = client.post(
        "/api/v1/validate", json={"scene": {"kind": "geometry", "polylines": huge_polylines}}
    )
    assert resp.status_code == 422
    assert "scene has too many polylines" in str(resp.json())

    # 4. Exceeds polyline points limit (> 1000)
    huge_poly_points = [{"id": "pl1", "points": [[0.1, 0.1]] * 1001}]
    resp = client.post(
        "/api/v1/validate", json={"scene": {"kind": "geometry", "polylines": huge_poly_points}}
    )
    assert resp.status_code == 422
    assert "a polyline has more than 1000 points" in str(resp.json())

    # 5. Exceeds bars limit (> 100)
    huge_bars = [{"id": f"b{i}", "label": "bar", "value": 1.0} for i in range(101)]
    resp = client.post("/api/v1/validate", json={"scene": {"kind": "bar_chart", "bars": huge_bars}})
    assert resp.status_code == 422
    assert "scene has too many bars" in str(resp.json())

    # 6. Exceeds facts limit (> 100)
    huge_facts = [f"fact {i}" for i in range(101)]
    resp = client.post(
        "/api/v1/validate", json={"scene": {"kind": "geometry", "facts": huge_facts}}
    )
    assert resp.status_code == 422
    assert "scene has too many facts" in str(resp.json())

    # 7. Exceeds max text chars (> 300)
    long_label = [{"id": "p1", "x": 0.5, "y": 0.5, "label": "a" * 301}]
    resp = client.post(
        "/api/v1/validate", json={"scene": {"kind": "geometry", "points": long_label}}
    )
    assert resp.status_code == 422
    assert "longer than 300 characters" in str(resp.json())


# ===========================================================================
# SEC-07 & SEC-08: Headers and Docs Exposure Tests
# ===========================================================================


def test_security_headers_middleware() -> None:
    """Every response gets X-Content-Type-Options: nosniff; JSON gets Cache-Control: no-store."""
    client = TestClient(app)

    # JSON response
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert "no-store" in resp.headers.get("cache-control", "")


def test_docs_exposure_modes(monkeypatch: pytest.MonkeyPatch) -> None:
    """Default mode exposes /docs and /openapi.json; ENVIRONMENT=production disables them."""
    # 1. Default (development) mode
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    dev_app = create_app()
    dev_client = TestClient(dev_app)
    assert dev_client.get("/docs").status_code == 200
    assert dev_client.get("/openapi.json").status_code == 200

    # 2. Production mode
    monkeypatch.setenv("ENVIRONMENT", "production")
    prod_app = create_app()
    prod_client = TestClient(prod_app)
    assert prod_client.get("/docs").status_code == 404
    assert prod_client.get("/redoc").status_code == 404
    assert prod_client.get("/openapi.json").status_code == 404


# ===========================================================================
# SEC-03: Client Disconnect Test
# ===========================================================================


def test_client_disconnect_returns_499() -> None:
    """A client disconnecting while queued for a slot aborts with HTTP 499

    without calling the provider and frees its concurrency slot cleanly.
    """
    from app.ask import AskRequest
    from app.limits import reset_in_flight_limits
    from app.main import (
        ask_question_route,
        get_ask_in_flight_limiter,
        get_ask_semaphore,
        reset_ask_semaphore,
    )
    from fixtures.triangle import triangle_scene

    reset_ask_semaphore()
    reset_in_flight_limits()
    sem = get_ask_semaphore()

    class CountingProvider:
        def __init__(self) -> None:
            self.name = "counting"
            self.calls = 0

        async def complete(self, prompt: str, *, timeout: float) -> str:
            self.calls += 1
            return '{"answer": "ok"}'

    provider = CountingProvider()
    chain = ProviderChain([provider])
    req = AskRequest(scene=triangle_scene(), question="What is the length of AB?", lang="en")

    async def _run() -> None:
        # Step 1: saturate all concurrency slots to force the next request to queue
        slots_held: list[bool] = []
        while not sem.locked():
            await sem.acquire()
            slots_held.append(True)

        raw_request = AsyncMock()
        # Simulated client that disconnected while waiting in queue
        raw_request.is_disconnected = AsyncMock(return_value=True)
        raw_request.client.host = "10.0.0.1"
        raw_request.headers.get.return_value = None

        # Step 2: schedule releasing one slot after a brief delay so queued request advances
        async def _release_later() -> None:
            await asyncio.sleep(0.05)
            sem.release()

        release_task = asyncio.create_task(_release_later())
        resp = await ask_question_route(req, raw_request, chain)
        await release_task

        # Release the remaining manually saturated slots
        for _ in slots_held[:-1]:
            sem.release()

        # Assert real route-level behaviour
        assert resp.status_code == 499
        assert provider.calls == 0
        assert not sem.locked()
        assert get_ask_in_flight_limiter().count("10.0.0.1") == 0

    try:
        asyncio.run(_run())
    finally:
        reset_ask_semaphore()
        reset_in_flight_limits()
