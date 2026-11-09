"""Regression tests for lane n1-backend-round4.

Covers:
- M4-01 (HIGH): Per-client in-flight permit released on cancellation / disconnect / timeout
  while waiting for semaphore slot.
- M4-05 (HIGH): Bounded aspect ratio in schema and validator ([0.05, 20.0]) preventing math domain
  errors in semantic ask; safe fall-through when semantic stage raises unexpected exception.
- M4-06 (MED): Normalization of IPv6 addresses with zone/scope identifiers and ports.
- M4-07 (MED): Client disconnect polling during vision model extraction.
- M4-08 (MED): CLAMP_TOLERANCE 0.02 (2%) per project spec enforces +/-0.02 bounds.
- M4-11 (LOW): Bounded wait (0.5s) on worker raw task cancellation.
- M4-12 (LOW): Image resolution limit alignment (12 MP) across docstrings.
"""

from __future__ import annotations

import asyncio
import io
import time
from typing import Any
from unittest.mock import patch

import cv2
import numpy as np
import pytest
from fastapi import BackgroundTasks, HTTPException, Response, UploadFile
from pydantic import ValidationError

from app.ask import AskRequest, answer_question
from app.image_utils import validate_image_bytes
from app.limits import (
    _normalize_ip_key,
    client_key,
    get_ask_in_flight_limiter,
    get_scene_in_flight_limiter,
    reset_in_flight_limits,
)
from app.main import (
    ask_question_route,
    get_ask_semaphore,
    get_scene_semaphore,
    parse_ask_max_concurrency,
    parse_scene_max_concurrency,
    process_scene,
    reset_ask_semaphore,
    reset_scene_semaphore,
)
from app.schema import DiagramScene, Point, Segment
from app.semantic import _find_longest_side, _find_right_angle
from app.validate import CLAMP_TOLERANCE, validate_scene
from app.vision.chain import ProviderChain


def _make_png_bytes(width: int = 120, height: int = 80) -> bytes:
    """Generate a small valid test PNG with a drawn rectangle."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.rectangle(img, (10, 10), (width - 10, height - 10), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


# ---------------------------------------------------------------------------
# M4-01: In-flight permit released on cancellation / timeout
# ---------------------------------------------------------------------------


def test_m4_01_scene_in_flight_permit_released_on_cancellation_waiting_for_semaphore() -> None:
    """Task cancellation while queued for scene semaphore frees per-client permit."""

    async def _run() -> None:
        reset_in_flight_limits()
        reset_scene_semaphore()
        sem = get_scene_semaphore()
        cap = parse_scene_max_concurrency()
        for _ in range(cap):
            await sem.acquire()

        limiter = get_scene_in_flight_limiter()
        client_key_val = "10.0.0.1"

        class MockClient:
            host = "10.0.0.1"
            port = 12345

        class MockRequest:
            headers = {"content-type": "image/png", "content-length": "100"}
            client = MockClient()

            async def is_disconnected(self) -> bool:
                return False

        png_bytes = _make_png_bytes()
        mock_file = UploadFile(
            file=io.BytesIO(png_bytes),
            filename="test.png",
            headers={"content-type": "image/png"},
        )

        task = asyncio.create_task(
            process_scene(
                request=MockRequest(),  # type: ignore[arg-type]
                response=Response(),
                background_tasks=BackgroundTasks(),
                image=mock_file,
                chain=ProviderChain([]),
                validator=validate_scene,
            )
        )

        await asyncio.sleep(0.05)
        assert limiter.count(client_key_val) == 1

        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        assert limiter.count(client_key_val) == 0

        for _ in range(cap):
            sem.release()

        assert limiter.acquire(client_key_val) is True
        limiter.release(client_key_val)

    asyncio.run(_run())


def test_m4_01_ask_in_flight_permit_released_on_cancellation_waiting_for_semaphore() -> None:
    """Task cancellation while queued for ask semaphore frees per-client permit."""

    async def _run() -> None:
        reset_in_flight_limits()
        reset_ask_semaphore()
        sem = get_ask_semaphore()
        cap = parse_ask_max_concurrency()
        for _ in range(cap):
            await sem.acquire()

        ask_limiter = get_ask_in_flight_limiter()
        client_key_val = "10.0.0.2"

        class MockClient:
            host = "10.0.0.2"
            port = 54321

        class MockRawRequest:
            headers = {}
            client = MockClient()

            async def is_disconnected(self) -> bool:
                return False

        scene = DiagramScene(
            kind="geometry",
            points=[Point(id="A", x=0.0, y=0.0), Point(id="B", x=1.0, y=1.0)],
        )
        ask_req = AskRequest(scene=scene, question="What is this?", lang="en")

        task = asyncio.create_task(
            ask_question_route(
                request=ask_req,
                raw_request=MockRawRequest(),  # type: ignore[arg-type]
                chain=ProviderChain([]),
            )
        )

        await asyncio.sleep(0.05)
        assert ask_limiter.count(client_key_val) == 1

        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        assert ask_limiter.count(client_key_val) == 0

        for _ in range(cap):
            sem.release()

        assert ask_limiter.acquire(client_key_val) is True
        ask_limiter.release(client_key_val)

    asyncio.run(_run())


def test_m4_01_scene_queue_timeout_releases_in_flight_permit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Queue wait timeout in process_scene releases per-client in-flight permit."""

    async def _run() -> None:
        reset_in_flight_limits()
        reset_scene_semaphore()
        monkeypatch.setenv("SCENE_QUEUE_WAIT_SECONDS", "0.02")

        sem = get_scene_semaphore()
        cap = parse_scene_max_concurrency()
        for _ in range(cap):
            await sem.acquire()

        limiter = get_scene_in_flight_limiter()
        client_key_val = "10.0.0.3"

        class MockClient:
            host = "10.0.0.3"
            port = 11111

        class MockRequest:
            headers = {"content-type": "image/png", "content-length": "100"}
            client = MockClient()

            async def is_disconnected(self) -> bool:
                return False

        png_bytes = _make_png_bytes()
        mock_file = UploadFile(
            file=io.BytesIO(png_bytes),
            filename="test.png",
            headers={"content-type": "image/png"},
        )

        with pytest.raises(HTTPException) as exc_info:
            await process_scene(
                request=MockRequest(),  # type: ignore[arg-type]
                response=Response(),
                background_tasks=BackgroundTasks(),
                image=mock_file,
                chain=ProviderChain([]),
                validator=validate_scene,
            )

        assert exc_info.value.status_code == 503
        assert limiter.count(client_key_val) == 0

        for _ in range(cap):
            sem.release()

    asyncio.run(_run())


def test_m4_01_ask_queue_timeout_releases_in_flight_permit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Queue wait timeout in ask_question_route releases per-client in-flight permit."""

    async def _run() -> None:
        reset_in_flight_limits()
        reset_ask_semaphore()
        monkeypatch.setenv("ASK_QUEUE_WAIT_SECONDS", "0.02")

        sem = get_ask_semaphore()
        cap = parse_ask_max_concurrency()
        for _ in range(cap):
            await sem.acquire()

        ask_limiter = get_ask_in_flight_limiter()
        client_key_val = "10.0.0.4"

        class MockClient:
            host = "10.0.0.4"
            port = 22222

        class MockRawRequest:
            headers = {}
            client = MockClient()

            async def is_disconnected(self) -> bool:
                return False

        scene = DiagramScene(
            kind="geometry",
            points=[Point(id="A", x=0.0, y=0.0), Point(id="B", x=1.0, y=1.0)],
        )
        ask_req = AskRequest(scene=scene, question="What is this?", lang="en")

        with pytest.raises(HTTPException) as exc_info:
            await ask_question_route(
                request=ask_req,
                raw_request=MockRawRequest(),  # type: ignore[arg-type]
                chain=ProviderChain([]),
            )

        assert exc_info.value.status_code == 503
        assert ask_limiter.count(client_key_val) == 0

        for _ in range(cap):
            sem.release()

    asyncio.run(_run())


# ---------------------------------------------------------------------------
# M4-05: Aspect ratio bounded & semantic ask exception fall-through
# ---------------------------------------------------------------------------


def test_m4_05_schema_bounds_aspect() -> None:
    """DiagramScene validates aspect within [0.05, 20.0] and rejects extreme values."""
    s1 = DiagramScene(kind="geometry", aspect=20.0)
    assert s1.aspect == 20.0
    s2 = DiagramScene(kind="geometry", aspect=0.05)
    assert s2.aspect == 0.05

    with pytest.raises(ValidationError):
        DiagramScene(kind="geometry", aspect=20.01)

    with pytest.raises(ValidationError):
        DiagramScene(kind="geometry", aspect=0.049)

    with pytest.raises(ValidationError):
        DiagramScene(kind="geometry", aspect=1e200)

    with pytest.raises(ValidationError):
        DiagramScene(kind="geometry", aspect=float("nan"))


def test_m4_05_validator_clamps_extreme_aspect() -> None:
    """validate_scene clamps aspect to [0.05, 20.0] and defaults invalid to 1.0."""
    res_high = validate_scene(
        {
            "version": 1,
            "kind": "geometry",
            "aspect": 1e200,
            "points": [{"id": "A", "x": 0.1, "y": 0.1}, {"id": "B", "x": 0.9, "y": 0.9}],
            "segments": [{"id": "AB", "a": "A", "b": "B"}],
        }
    )
    assert res_high.scene is not None
    assert res_high.scene.aspect == 20.0

    res_low = validate_scene(
        {
            "version": 1,
            "kind": "geometry",
            "aspect": 0.001,
            "points": [{"id": "A", "x": 0.1, "y": 0.1}, {"id": "B", "x": 0.9, "y": 0.9}],
            "segments": [{"id": "AB", "a": "A", "b": "B"}],
        }
    )
    assert res_low.scene is not None
    assert res_low.scene.aspect == 0.05

    res_neg = validate_scene(
        {
            "version": 1,
            "kind": "geometry",
            "aspect": -5.0,
            "points": [{"id": "A", "x": 0.1, "y": 0.1}, {"id": "B", "x": 0.9, "y": 0.9}],
            "segments": [{"id": "AB", "a": "A", "b": "B"}],
        }
    )
    assert res_neg.scene is not None
    assert res_neg.scene.aspect == 1.0

    res_str = validate_scene(
        {
            "version": 1,
            "kind": "geometry",
            "aspect": "invalid",
            "points": [{"id": "A", "x": 0.1, "y": 0.1}, {"id": "B", "x": 0.9, "y": 0.9}],
            "segments": [{"id": "AB", "a": "A", "b": "B"}],
        }
    )
    assert res_str.scene is not None
    assert res_str.scene.aspect == 1.0


def test_m4_05_semantic_calculations_safe_with_boundary_aspect() -> None:
    """_find_right_angle and _find_longest_side handle boundary aspect ratios cleanly."""
    scene_high = DiagramScene(
        kind="geometry",
        aspect=20.0,
        points=[
            Point(id="A", x=0.0, y=0.0),
            Point(id="B", x=0.5, y=0.0),
            Point(id="C", x=0.0, y=0.5),
        ],
        segments=[Segment(id="AB", a="A", b="B"), Segment(id="AC", a="A", b="C")],
    )
    # Should calculate without overflow or math domain error
    res, coords, lbl = _find_right_angle(scene_high)
    assert coords is not None or res is None

    best_seg, _, _ = _find_longest_side(scene_high)
    assert best_seg is not None


def test_m4_05_semantic_ask_unexpected_exception_falls_through_in_ask() -> None:
    """Unexpected exception in _semantic_ask falls through without HTTP 500 or leaked error."""

    async def _run() -> None:
        scene = DiagramScene(
            kind="geometry",
            points=[Point(id="A", x=0.0, y=0.0), Point(id="B", x=1.0, y=0.0)],
            segments=[Segment(id="s1", a="A", b="B")],
            facts=["AB = 5 cm"],
        )
        req = AskRequest(scene=scene, question="How long is AB?", lang="en")
        chain = ProviderChain([])

        with patch("app.ask._semantic_ask", side_effect=ValueError("math domain error")):
            resp = await answer_question(req, chain)

        # Successfully falls through to facts_lookup, no 500 crash
        assert resp.source == "facts"
        assert "5 cm" in resp.answer
        assert "math domain error" not in resp.answer

    asyncio.run(_run())


# ---------------------------------------------------------------------------
# M4-06: IPv6 zone ID and port normalization
# ---------------------------------------------------------------------------


def test_m4_06_ipv6_zone_id_and_port_normalizes_to_64_network() -> None:
    """IPv6 addresses with zone identifier and port normalize to /64 network key."""
    k1 = _normalize_ip_key("[fe80::1%eth0]:5000")
    k2 = _normalize_ip_key("[fe80::2%eth0]:6000")
    k3 = _normalize_ip_key("fe80::1%12")
    k4 = _normalize_ip_key("fe80::1")

    assert k1 == "fe80::/64"
    assert k2 == "fe80::/64"
    assert k3 == "fe80::/64"
    assert k4 == "fe80::/64"
    assert k1 == k2 == k3 == k4


def test_m4_06_client_key_with_ipv6_zone_id() -> None:
    """client_key groups IPv6 addresses with zone IDs into consistent /64 key."""
    key = client_key("[fe80::1%eth0]:5000", None, 0)
    assert key == "fe80::/64"


# ---------------------------------------------------------------------------
# M4-07: Client disconnect polling in scene vision pipeline
# ---------------------------------------------------------------------------


def test_m4_07_scene_vision_aborts_on_client_disconnect(monkeypatch: pytest.MonkeyPatch) -> None:
    """process_scene polls disconnect and aborts in-flight AI call with HTTP 499."""

    async def _run() -> None:
        monkeypatch.setattr("app.main.ASK_DISCONNECT_POLL_SECONDS", 0.01)

        class SlowProvider:
            name = "slow_fake"

            async def extract(self, *args: Any, **kwargs: Any) -> str:
                await asyncio.sleep(2.0)
                return "{}"

        chain = ProviderChain([SlowProvider()])  # type: ignore[list-item]

        polls = 0

        class MockClient:
            host = "10.0.0.88"
            port = 40000

        class MockDisconnectingRequest:
            headers = {"content-type": "image/png", "content-length": "100"}
            client = MockClient()

            async def is_disconnected(self) -> bool:
                nonlocal polls
                polls += 1
                return polls > 1

        png_bytes = _make_png_bytes()
        mock_file = UploadFile(
            file=io.BytesIO(png_bytes),
            filename="test.png",
            headers={"content-type": "image/png"},
        )

        resp = await process_scene(
            request=MockDisconnectingRequest(),  # type: ignore[arg-type]
            response=Response(),
            background_tasks=BackgroundTasks(),
            image=mock_file,
            chain=chain,
            validator=validate_scene,
        )

        assert isinstance(resp, Response)
        assert resp.status_code == 499

    asyncio.run(_run())


# ---------------------------------------------------------------------------
# M4-08: CLAMP_TOLERANCE 0.02 adheres to project spec
# ---------------------------------------------------------------------------


def test_m4_08_clamp_tolerance_is_0_02() -> None:
    """Verify CLAMP_TOLERANCE constant is 0.02 (2%) per project spec."""
    assert CLAMP_TOLERANCE == 0.02


def test_m4_08_minor_boundary_overshoot_clamps_without_invalidating_referenced_point() -> None:
    """Point coordinate at 1.015 (within 2% tolerance) clamps to 1.0 and preserves segments."""
    data = {
        "version": 1,
        "kind": "geometry",
        "points": [
            {"id": "A", "x": 0.0, "y": 0.0},
            {"id": "B", "x": 1.015, "y": 0.5},
            {"id": "C", "x": -0.015, "y": 0.5},
        ],
        "segments": [
            {"id": "s1", "a": "A", "b": "B"},
            {"id": "s2", "a": "A", "b": "C"},
        ],
    }
    res = validate_scene(data)
    assert res.scene is not None
    assert len(res.errors) == 0
    # Clamped to [0.0, 1.0]
    p_b = next(p for p in res.scene.points if p.id == "B")
    p_c = next(p for p in res.scene.points if p.id == "C")
    assert p_b.x == 1.0
    assert p_c.x == 0.0
    assert len(res.scene.segments) == 2


def test_m4_08_overshoot_beyond_tolerance_still_dropped() -> None:
    """Point coordinate at 1.05 exceeds 2% tolerance and is dropped, invalidating segment."""
    data = {
        "version": 1,
        "kind": "geometry",
        "points": [
            {"id": "A", "x": 0.0, "y": 0.0},
            {"id": "B", "x": 1.05, "y": 0.5},
        ],
        "segments": [{"id": "s1", "a": "A", "b": "B"}],
    }
    res = validate_scene(data)
    assert res.scene is None
    assert any("dropped point 'B'" in err for err in res.errors)


# ---------------------------------------------------------------------------
# M4-11: Bounded wait on raw task cancellation
# ---------------------------------------------------------------------------


def test_m4_11_bounded_wait_on_raw_task_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    """Raw Mode timeout wait for worker task completion is bounded to 0.5s."""

    async def _run() -> None:
        monkeypatch.setenv("SCENE_TIMEOUT_SECONDS", "0.01")

        def slow_blocking_raw_scene(image_bytes: bytes, cancel_check: Any = None) -> DiagramScene:
            # Simulates slow OpenCV contour finding that delays checking cancel_event
            time.sleep(1.0)
            return DiagramScene(kind="geometry")

        monkeypatch.setattr("app.main.build_raw_scene", slow_blocking_raw_scene)

        class MockClient:
            host = "10.0.0.77"
            port = 33333

        class MockRequest:
            headers = {"content-type": "image/png", "content-length": "100"}
            client = MockClient()

            async def is_disconnected(self) -> bool:
                return False

        png_bytes = _make_png_bytes()
        mock_file = UploadFile(
            file=io.BytesIO(png_bytes),
            filename="test.png",
            headers={"content-type": "image/png"},
        )

        start = time.monotonic()
        with pytest.raises(HTTPException) as exc_info:
            await process_scene(
                request=MockRequest(),  # type: ignore[arg-type]
                response=Response(),
                background_tasks=BackgroundTasks(),
                image=mock_file,
                chain=ProviderChain([]),
                validator=validate_scene,
            )

        elapsed = time.monotonic() - start
        assert exc_info.value.status_code == 504
        # Should timeout quickly and bound worker wait to ~0.5s, well under the 1.0s worker sleep
        assert elapsed < 0.85

    asyncio.run(_run())


# ---------------------------------------------------------------------------
# M4-12: Docstring image resolution cap alignment (12 MP)
# ---------------------------------------------------------------------------


def test_m4_12_docstrings_match_12_mp_limit() -> None:
    """Docstrings in main.py and image_utils.py align with MAX_IMAGE_PIXELS = 12 MP."""
    assert process_scene.__doc__ is not None
    assert "12 MP" in process_scene.__doc__
    assert "40 MP" not in process_scene.__doc__

    assert validate_image_bytes.__doc__ is not None
    assert "12 MP" in validate_image_bytes.__doc__
    assert "40 MP" not in validate_image_bytes.__doc__
