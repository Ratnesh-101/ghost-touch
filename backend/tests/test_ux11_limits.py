"""Tests for rate limiting, Retry-After header, and in-flight slot refunds (Lane ux11).

Covers:
- 429 rate limit response carries Retry-After header between 1 and 60
- compute_retry_after helper correctly computes remaining window and clamps to [1, 60]
- give_back_rate_slot removes the newest hit for a client and path
- In-flight rejection (429) does not reduce the client's remaining rate allowance
"""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock

import cv2
import httpx
import numpy as np
import pytest

from app.limits import (
    _HITS,
    RequestGuardMiddleware,
    compute_retry_after,
    give_back_rate_slot,
    reset_in_flight_limits,
    reset_rate_limits,
)
from app.main import create_app, get_provider_chain, reset_scene_semaphore
from app.vision.base import VisionProvider
from app.vision.chain import ProviderChain


class SlowMockVisionProvider(VisionProvider):
    """Vision provider that delays briefly to test concurrency."""

    def __init__(self, delay: float = 0.2) -> None:
        self.delay = delay

    @property
    def name(self) -> str:
        return "slow-mock"

    async def extract(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        *,
        timeout: float | None = None,
    ) -> str:
        if self.delay > 0:
            await asyncio.sleep(self.delay)
        return json.dumps(
            {
                "version": 1,
                "kind": "geometry",
                "title": "Box",
                "points": [
                    {"id": "p1", "x": 0.2, "y": 0.2},
                    {"id": "p2", "x": 0.8, "y": 0.8},
                ],
                "segments": [{"id": "s1", "a": "p1", "b": "p2"}],
                "polylines": [],
                "bars": [],
                "axes": None,
                "facts": [],
            }
        )

    async def complete(self, prompt: str, *, timeout: float | None = None) -> str:
        return "mock answer"


def _make_test_png(width: int = 50, height: int = 50) -> bytes:
    img = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.rectangle(img, (2, 2), (width - 2, height - 2), (255, 255, 255), 1)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


# ===========================================================================
# Retry-After computation and header tests
# ===========================================================================


def test_compute_retry_after_clamping() -> None:
    """compute_retry_after correctly calculates remaining window and strictly clamps to [1, 60]."""
    oldest = 1000.0

    # 1. Immediate hit: 60 seconds remaining
    assert compute_retry_after(oldest, now=1000.0, window_seconds=60.0) == 60

    # 2. Halfway through window: 30 seconds remaining
    assert compute_retry_after(oldest, now=1030.0, window_seconds=60.0) == 30

    # 3. Near window expiration: ceil to 1
    assert compute_retry_after(oldest, now=1059.2, window_seconds=60.0) == 1

    # 4. Exactly at window expiration: clamped to 1
    assert compute_retry_after(oldest, now=1060.0, window_seconds=60.0) == 1

    # 5. Overdue / past window: clamped to 1
    assert compute_retry_after(oldest, now=1075.0, window_seconds=60.0) == 1

    # 6. Future / negative elapsed: clamped to 60
    assert compute_retry_after(oldest, now=950.0, window_seconds=60.0) == 60


def test_rate_limit_429_has_retry_after_between_1_and_60() -> None:
    """Rate limit 429 response sends a Retry-After header with value between 1 and 60."""
    reset_rate_limits()
    test_app = AsyncMock()
    middleware = RequestGuardMiddleware(
        app=test_app,
        body_limits={},
        rate_limits={"/api/v1/scene": 2},
    )

    client_ip = "192.168.1.100"
    path = "/api/v1/scene"

    # Fill rate limit allowance (2 requests allowed)
    assert middleware._allow(client_ip, path, per_minute=2) is True
    assert middleware._allow(client_ip, path, per_minute=2) is True

    # 3rd request is denied
    assert middleware._allow(client_ip, path, per_minute=2) is False

    # Simulate RequestGuardMiddleware ASGI call for the denied request
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/scene",
        "client": (client_ip, 12345),
        "headers": [],
    }

    sent_messages: list[dict] = []

    async def fake_send(message: dict) -> None:
        sent_messages.append(message)

    async def fake_receive() -> dict:
        return {"type": "http.request", "body": b"", "more_body": False}

    asyncio.run(middleware(scope, fake_receive, fake_send))

    # Verify 429 response was sent with Retry-After header
    start_msg = next((m for m in sent_messages if m["type"] == "http.response.start"), None)
    assert start_msg is not None
    assert start_msg["status"] == 429

    headers_dict = dict(start_msg["headers"])
    assert b"retry-after" in headers_dict

    retry_after_str = headers_dict[b"retry-after"].decode("ascii")
    retry_after_int = int(retry_after_str)
    assert 1 <= retry_after_int <= 60


# ===========================================================================
# In-flight rejection rate slot refund tests
# ===========================================================================


def test_give_back_rate_slot_unit() -> None:
    """give_back_rate_slot removes the latest hit for the specified client and path."""
    reset_rate_limits()
    client = "client-a"
    path = "/api/v1/scene"

    # Initially empty
    assert len(_HITS[(client, path)]) == 0

    # Add 2 hits
    _HITS[(client, path)].append(100.0)
    _HITS[(client, path)].append(105.0)
    assert len(_HITS[(client, path)]) == 2

    # Give back one slot
    give_back_rate_slot(client, path)
    assert len(_HITS[(client, path)]) == 1
    assert _HITS[(client, path)][0] == 100.0

    # Give back another
    give_back_rate_slot(client, path)
    assert len(_HITS[(client, path)]) == 0

    # Giving back on empty deque does not raise
    give_back_rate_slot(client, path)
    assert len(_HITS[(client, path)]) == 0


def test_middleware_refunds_rate_slot_on_downstream_429() -> None:
    """RequestGuardMiddleware restores the deducted rate slot if downstream returns 429."""
    reset_rate_limits()

    client_ip = "192.168.1.50"
    path = "/api/v1/scene"

    # Mock downstream app that simulates an in-flight rejection (HTTP 429)
    async def downstream_in_flight_reject(scope, receive, send):
        body = json.dumps({"detail": "Too many concurrent requests"}).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 429,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                    (b"retry-after", b"1"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})

    middleware = RequestGuardMiddleware(
        app=downstream_in_flight_reject,
        body_limits={},
        rate_limits={path: 5},
    )

    scope = {
        "type": "http",
        "method": "POST",
        "path": path,
        "client": (client_ip, 12345),
        "headers": [],
    }

    sent: list[dict] = []

    async def fake_send(msg: dict) -> None:
        sent.append(msg)

    async def fake_receive() -> dict:
        return {"type": "http.request", "body": b"", "more_body": False}

    # Execute request
    asyncio.run(middleware(scope, fake_receive, fake_send))

    # Downstream rejected with 429, so the rate slot must have been refunded
    assert len(_HITS[(client_ip, path)]) == 0


def test_rejected_by_in_flight_does_not_reduce_remaining_rate_allowance(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An in-flight 429 rejection does not consume the client's per-minute rate allowance."""

    async def _run() -> None:
        # Cap client in-flight to 1 request, rate limit per minute to 2
        monkeypatch.setenv("SCENE_CLIENT_MAX_CONCURRENCY", "1")
        monkeypatch.setenv("RATE_LIMIT_SCENE_PER_MIN", "2")
        reset_rate_limits()
        reset_in_flight_limits()
        reset_scene_semaphore()

        provider = SlowMockVisionProvider(delay=0.3)
        chain = ProviderChain([provider])
        test_app = create_app()
        test_app.dependency_overrides[get_provider_chain] = lambda: chain

        try:
            img_bytes = _make_test_png(60, 60)
            client_ip = "192.168.1.77"

            transport = httpx.ASGITransport(app=test_app, client=(client_ip, 5000))
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                files1 = {"image": ("test1.png", img_bytes, "image/png")}
                files2 = {"image": ("test2.png", img_bytes, "image/png")}

                # Fire request 1 (holds the in-flight slot for 0.3s)
                task1 = asyncio.create_task(client.post("/api/v1/scene", files=files1))
                await asyncio.sleep(0.05)

                # Fire request 2 concurrently from same client (hits in-flight cap -> 429)
                resp2 = await client.post("/api/v1/scene", files=files2)
                assert resp2.status_code == 429
                assert "Too many concurrent" in resp2.json()["detail"]

                # Wait for request 1 to complete (succeeds -> 200)
                resp1 = await task1
                assert resp1.status_code == 200

                # Because request 2 was rejected by in-flight limiter, its rate slot was refunded.
                # Therefore, client still has 1 remaining slot in their rate allowance (2 - 1 = 1).
                # Request 3 must succeed with 200 instead of hitting the rate limit!
                files3 = {"image": ("test3.png", img_bytes, "image/png")}
                resp3 = await client.post("/api/v1/scene", files=files3)
                assert resp3.status_code == 200

                # Now 2 successful requests have been made; 4th request hits per-minute rate limit
                files4 = {"image": ("test4.png", img_bytes, "image/png")}
                resp4 = await client.post("/api/v1/scene", files=files4)
                assert resp4.status_code == 429
                assert "Too many requests" in resp4.json()["detail"]
                assert "retry-after" in resp4.headers
                assert 1 <= int(resp4.headers["retry-after"]) <= 60
        finally:
            reset_rate_limits()
            reset_in_flight_limits()
            reset_scene_semaphore()
            test_app.dependency_overrides.clear()

    asyncio.run(_run())
