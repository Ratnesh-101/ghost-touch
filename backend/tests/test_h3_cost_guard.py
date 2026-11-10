"""Regression tests for Lane h3-cost-guard (Task C1-C5, A8, R3-1, R3-2, R3-3, R3-5).

Zero external network calls; zero secrets. All providers mocked or faked.
"""

from __future__ import annotations

import asyncio
import json
import os
import threading
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import cv2
import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.ask import build_ask_prompt, prepare_ask_prompt
from app.limits import (
    MAX_RATE_LIMIT_KEYS,
    RequestGuardMiddleware,
    client_key,
    get_ask_in_flight_limiter,
    get_scene_in_flight_limiter,
    reset_in_flight_limits,
    reset_rate_limits,
)
from app.main import app, get_provider_chain, reset_scene_semaphore
from app.paid_budget import (
    get_consumed,
    is_budget_exhausted,
    reset_budget,
    set_clock_for_testing,
    try_consume,
)
from app.schema import DiagramScene, Point
from app.vision.base import VisionError
from app.vision.chain import ProviderChain
from app.vision.gemini import GeminiProvider
from app.vision.nebius import NebiusProvider
from app.vision.openai_provider import OpenAIProvider
from fixtures.triangle import triangle_scene


@pytest.fixture(autouse=True)
def _fresh_h3_state() -> Iterator[None]:
    """Ensure clean rate limits, in-flight limits, and budget state for every test."""
    reset_rate_limits()
    reset_in_flight_limits()
    reset_budget()
    yield
    reset_rate_limits()
    reset_in_flight_limits()
    reset_budget()


class FakeVisionProvider:
    """Fake provider for testing chains and budget consumption."""

    def __init__(
        self,
        name: str = "fake_paid",
        extract_response: str | Exception = '{"version":1,"kind":"geometry"}',
        complete_response: str | Exception = "The answer is 5 cm.",
        delay: float = 0.0,
    ) -> None:
        self.name = name
        self.extract_response = extract_response
        self.complete_response = complete_response
        self.delay = delay
        self.extract_calls = 0
        self.complete_calls = 0

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        self.extract_calls += 1
        if not try_consume(1):
            raise VisionError(self.name, "paid call budget exhausted", transient=False)
        if self.delay > 0:
            await asyncio.sleep(self.delay)
        if isinstance(self.extract_response, Exception):
            raise self.extract_response
        return self.extract_response

    async def complete(self, prompt: str, *, timeout: float) -> str:
        self.complete_calls += 1
        if not try_consume(1):
            raise VisionError(self.name, "paid call budget exhausted", transient=False)
        if self.delay > 0:
            await asyncio.sleep(self.delay)
        if isinstance(self.complete_response, Exception):
            raise self.complete_response
        return self.complete_response


# =============================================================================
# C1: paid_budget.py (daily UTC counter, lock, injectable clock, fallbacks)
# =============================================================================


def test_c1_budget_daily_consumption_and_limit() -> None:
    with patch.dict(os.environ, {"PAID_CALLS_PER_DAY": "5"}):
        assert not is_budget_exhausted()
        assert try_consume(3) is True
        assert get_consumed() == 3
        assert not is_budget_exhausted()

        assert try_consume(2) is True
        assert get_consumed() == 5
        assert is_budget_exhausted()

        # Over the limit: rejected, count not incremented
        assert try_consume(1) is False
        assert get_consumed() == 5


def test_c1_budget_zero_disables_paid_calls() -> None:
    with patch.dict(os.environ, {"PAID_CALLS_PER_DAY": "0"}):
        assert is_budget_exhausted()
        assert try_consume(1) is False
        assert get_consumed() == 0


def test_c1_budget_utc_date_rollover() -> None:
    time_day1 = datetime(2026, 11, 8, 23, 59, 50, tzinfo=UTC)
    time_day2 = datetime(2026, 11, 9, 0, 0, 10, tzinfo=UTC)

    current_time = time_day1

    def test_clock() -> datetime:
        return current_time

    set_clock_for_testing(test_clock)
    with patch.dict(os.environ, {"PAID_CALLS_PER_DAY": "2"}):
        assert try_consume(2) is True
        assert is_budget_exhausted()
        assert try_consume(1) is False

        # Advance to next UTC day: counter resets
        current_time = time_day2
        assert not is_budget_exhausted()
        assert get_consumed() == 0
        assert try_consume(1) is True
        assert get_consumed() == 1


def test_c1_budget_thread_safety() -> None:
    with patch.dict(os.environ, {"PAID_CALLS_PER_DAY": "100"}):
        results: list[bool] = []

        def worker() -> None:
            for _ in range(10):
                res = try_consume(1)
                results.append(res)

        threads = [threading.Thread(target=worker) for _ in range(15)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # 150 attempts against a budget of 100: exactly 100 should succeed
        assert results.count(True) == 100
        assert results.count(False) == 50
        assert get_consumed() == 100


def test_c1_providers_consume_budget_and_fail_when_spent() -> None:
    with patch.dict(os.environ, {"PAID_CALLS_PER_DAY": "1"}):
        gemini = GeminiProvider(api_key="fake-key", client=MagicMock())
        openai = OpenAIProvider(api_key="fake-key")
        nebius = NebiusProvider(api_key="fake-key")

        # 1st call consumes the 1 slot
        assert try_consume(1) is True
        assert is_budget_exhausted()

        # Gemini extract and complete should immediately fail with VisionError without calling API
        with pytest.raises(VisionError, match="paid call budget exhausted") as exc:
            asyncio.run(gemini.complete("test prompt", timeout=5.0))
        assert exc.value.transient is False

        with pytest.raises(VisionError, match="paid call budget exhausted") as exc:
            asyncio.run(openai.extract(b"fake", "image/png", "prompt", timeout=5.0))
        assert exc.value.transient is False

        with pytest.raises(VisionError, match="paid call budget exhausted") as exc:
            asyncio.run(nebius.complete("test prompt", timeout=5.0))
        assert exc.value.transient is False


def test_c1_ask_falls_back_when_budget_spent() -> None:
    client = TestClient(app)
    triangle = triangle_scene()

    fake = FakeVisionProvider(name="gemini")
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        with patch.dict(os.environ, {"PAID_CALLS_PER_DAY": "0"}):
            resp = client.post(
                "/api/v1/ask",
                json={
                    "scene": triangle.model_dump(),
                    "question": "What is the length of AB?",
                    "lang": "en",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            # Falls back to deterministic facts lookup
            assert data["source"] == "facts"
            assert "5 cm" in data["answer"]
            assert fake.complete_calls == 0  # Model was not called
    finally:
        app.dependency_overrides.clear()


# =============================================================================
# C2: Prompt compaction, 24k cap, coordinate dropping, ids once
# =============================================================================


def test_c2_prompt_compact_formatting_and_ids_once() -> None:
    scene = DiagramScene(
        kind="geometry",
        title="Test Diagram",
        points=[
            Point(id="p1", x=0.1, y=0.2, label="शीर्ष A"),
            Point(id="p2", x=0.5, y=0.8, label="शीर्ष B"),
        ],
        facts=["AB = 5 cm"],
    )
    prompt = build_ask_prompt(scene, "What is AB?", lang="hi")

    # ensure_ascii=False: Hindi characters must be preserved, not \uXXXX escaped
    assert "शीर्ष A" in prompt
    assert "\\u0936" not in prompt

    # No 2-space indentation in JSON
    assert '{\n  "version"' not in prompt

    # Element IDs block is present and lists element IDs compactly
    assert "Scene Element IDs:" in prompt
    assert "p1" in prompt
    assert "p2" in prompt


def test_c2_prompt_drops_coordinates_when_over_cap() -> None:
    # Build a scene with points whose coordinates inflate the prompt
    points = [
        Point(id=f"pt_{i:04d}", x=0.1234567, y=0.9876543, label=f"Vertex {i}") for i in range(300)
    ]
    scene = DiagramScene(kind="geometry", title="Huge Scene", points=points)

    raw_prompt = build_ask_prompt(scene, "Count vertices")
    assert len(raw_prompt) > 20_000

    # Custom cap of 20,000 chars: full prompt exceeds it, but dropping coords brings it under
    prepared = prepare_ask_prompt(scene, "Count vertices", max_chars=20_000)
    assert prepared is not None
    assert len(prepared) <= 20_000
    # Coordinates were dropped
    assert '"x":' not in prepared
    assert '"y":' not in prepared
    # Point IDs and labels retained
    assert '"pt_0001"' in prepared
    # Element IDs section must remain
    assert "Scene Element IDs:" in prepared
    assert "pt_0001" in prepared


def test_c2_prompt_exceeding_cap_without_coords_falls_back_to_facts() -> None:
    # Build a scene with huge facts/labels that exceeds 24k even without coordinates
    huge_facts = [f"Fact #{i}: " + ("x" * 200) for i in range(150)]
    scene = DiagramScene(kind="geometry", title="Huge Facts Scene", facts=huge_facts)

    prepared = prepare_ask_prompt(scene, "What is this?", max_chars=24_000)
    assert prepared is None  # Signals to skip model and answer from facts


# =============================================================================
# C3: Token caps (Gemini max_output_tokens=256, OpenAI/Nebius=256)
# =============================================================================


def test_c3_gemini_complete_max_output_tokens() -> None:
    mock_client = MagicMock()
    mock_aio_models = MagicMock()
    mock_client.aio.models = mock_aio_models

    async def fake_generate(**kwargs: Any) -> Any:
        config = kwargs.get("config")
        assert config is not None
        assert getattr(config, "max_output_tokens", None) == 256
        res = MagicMock()
        res.text = "Answer from model."
        return res

    mock_aio_models.generate_content = AsyncMock(side_effect=fake_generate)
    provider = GeminiProvider(api_key="fake-key", client=mock_client)

    ans = asyncio.run(provider.complete("Test question", timeout=5.0))
    assert ans == "Answer from model."


def test_c3_openai_and_nebius_complete_token_caps() -> None:
    openai_p = OpenAIProvider(api_key="fake-key", model="gpt-4.1-mini")
    nebius_p = NebiusProvider(api_key="fake-key")

    body_openai = openai_p._body("prompt", extract=False)
    assert body_openai["max_completion_tokens"] == 256

    body_nebius = nebius_p._body("prompt", max_tokens=256)
    assert body_nebius["max_tokens"] == 256


# =============================================================================
# C4 / R3-1: Per-client in-flight cap (429 over cap, also for /scene)
# =============================================================================


def test_c4_r3_1_ask_per_client_in_flight_cap() -> None:
    client = TestClient(app, client=("10.0.0.1", 5000))
    triangle = triangle_scene()

    # Provider that hangs until released
    slow_provider = FakeVisionProvider(name="slow", delay=1.0)
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([slow_provider])

    limiter = get_ask_in_flight_limiter()
    limiter.max_in_flight = 2

    try:
        # Manually occupy 2 in-flight slots for client IP 10.0.0.1
        assert limiter.acquire("10.0.0.1") is True
        assert limiter.acquire("10.0.0.1") is True

        # 3rd request from same client gets 429
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "What is AB?",
                "lang": "en",
            },
        )
        assert resp.status_code == 429
        assert "Too many concurrent" in resp.json()["detail"]

        # Different client IP 10.0.0.2 is allowed
        assert limiter.acquire("10.0.0.2") is True
        limiter.release("10.0.0.2")

        # After releasing 10.0.0.1, client is admitted again
        limiter.release("10.0.0.1")
        assert limiter.count("10.0.0.1") == 1
    finally:
        limiter.release("10.0.0.1")
        app.dependency_overrides.clear()


def test_c4_r3_1_scene_per_client_in_flight_cap() -> None:
    async def _run() -> None:
        limiter = get_scene_in_flight_limiter()
        limiter.max_in_flight = 1
        reset_scene_semaphore()

        valid_scene_json = json.dumps(
            {
                "version": 1,
                "kind": "geometry",
                "title": "Triangle",
                "points": [
                    {"id": "p1", "x": 0.2, "y": 0.2, "label": "vertex A"},
                    {"id": "p2", "x": 0.8, "y": 0.8, "label": "vertex B"},
                ],
                "segments": [
                    {"id": "s1", "a": "p1", "b": "p2", "label": "hypotenuse"},
                ],
                "polylines": [],
                "bars": [],
                "axes": None,
                "facts": ["AB = 5 cm"],
            }
        )

        slow_provider = FakeVisionProvider(
            name="gemini",
            extract_response=valid_scene_json,
            delay=0.3,
        )
        app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([slow_provider])

        # Generate tiny valid PNG buffers (distinct dimensions to avoid image cache collisions)
        def _make_png(w: int, h: int) -> bytes:
            img = np.zeros((h, w, 3), dtype=np.uint8)
            cv2.rectangle(img, (1, 1), (w - 2, h - 2), (255, 255, 255), 1)
            ok, buf = cv2.imencode(".png", img)
            assert ok
            return buf.tobytes()

        png_client1 = _make_png(10, 10)
        png_client2 = _make_png(12, 12)

        try:

            async def send_req(client_ip: str, data: bytes, fname: str) -> httpx.Response:
                transport = httpx.ASGITransport(app=app, client=(client_ip, 5000))
                async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
                    files = {"image": (fname, data, "image/png")}
                    return await ac.post("/api/v1/scene", files=files)

            async def req1_same_client() -> httpx.Response:
                return await send_req("10.0.0.5", png_client1, "diagram1.png")

            async def req2_same_client() -> httpx.Response:
                # Give req1 a moment to validate upload and acquire in-flight slot
                await asyncio.sleep(0.05)
                return await send_req("10.0.0.5", png_client1, "diagram2.png")

            async def req3_diff_client() -> httpx.Response:
                # Concurrent request from a different client while req1 is in flight
                await asyncio.sleep(0.05)
                return await send_req("10.0.0.6", png_client2, "diagram3.png")

            resp1, resp2, resp_diff = await asyncio.gather(
                req1_same_client(), req2_same_client(), req3_diff_client()
            )

            # 1st request from client 10.0.0.5 succeeds with 200
            assert resp1.status_code == 200
            assert resp1.json()["mode"] == "ai"

            # 2nd concurrent request from SAME client (10.0.0.5) is rejected with 429
            assert resp2.status_code == 429
            assert "Too many concurrent diagram requests" in resp2.json()["detail"]
            assert resp2.headers.get("retry-after") == "1"

            # Concurrent request from DIFFERENT client (10.0.0.6) succeeds with 200
            assert resp_diff.status_code == 200
            assert resp_diff.json()["mode"] == "ai"

            # After completion, in-flight counters are released back to 0
            assert limiter.count("10.0.0.5") == 0
            assert limiter.count("10.0.0.6") == 0
        finally:
            reset_scene_semaphore()
            app.dependency_overrides.clear()

    asyncio.run(_run())


# =============================================================================
# C5: PROVIDER_RETRIES semantics for /ask (at most 1 attempt per provider)
# =============================================================================


def test_c5_ask_makes_at_most_one_attempt_per_provider() -> None:
    p1 = FakeVisionProvider(
        name="p1", complete_response=VisionError("p1", "503 timeout", transient=True)
    )
    p2 = FakeVisionProvider(name="p2", complete_response="Answer from p2.")

    # Chain configured with retries=2
    chain = ProviderChain([p1, p2], retries=2)

    # complete() with max_attempts=1 (as invoked by /ask) makes at most 1 attempt per provider
    ans, used = asyncio.run(chain.complete("Test prompt", max_attempts=1))
    assert ans == "Answer from p2."
    assert used == "p2"
    assert (
        p1.complete_calls == 1
    )  # p1 was attempted exactly ONCE (no retry despite transient error)
    assert p2.complete_calls == 1


# =============================================================================
# A8: X-Vision-Provider header sanitization ('ai' or 'raw' only, no echoes)
# =============================================================================


def test_a8_x_vision_provider_header_and_no_echo() -> None:
    client = TestClient(app)

    # 1. 415 error must not echo arbitrary client content-type
    evil_type = "image/x-attacker-<script>alert(1)</script>"
    resp = client.post(
        "/api/v1/scene",
        files={"image": ("bad.bin", b"xyz", evil_type)},
    )
    assert resp.status_code == 415
    assert evil_type not in resp.text
    assert "Unsupported image format." in resp.json()["detail"]

    # 2. Raw Mode returns X-Vision-Provider: raw
    # Zero providers -> Raw Mode
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])
    try:
        # Valid tiny 10x10 PNG
        img = np.zeros((10, 10, 3), dtype=np.uint8)
        cv2.rectangle(img, (1, 1), (8, 8), (255, 255, 255), 1)
        _, buf = cv2.imencode(".png", img)
        png_bytes = buf.tobytes()

        resp = client.post(
            "/api/v1/scene",
            files={"image": ("diagram.png", png_bytes, "image/png")},
        )
        assert resp.status_code == 200
        assert resp.headers["X-Vision-Provider"] == "raw"
        assert resp.headers["X-Vision-Provider"] not in ("gemini", "openai", "nebius", "none")
    finally:
        app.dependency_overrides.clear()


# =============================================================================
# R3-2: Sweep throttled to at most once per second & table hard cap
# =============================================================================


def test_r3_2_sweep_throttled_and_hits_capped() -> None:
    from app.limits import _HITS

    app_mock = AsyncMock()
    guard = RequestGuardMiddleware(
        app_mock, body_limits={"/api/v1/ask": 512 * 1024}, rate_limits={"/api/v1/ask": 100}
    )

    fixed_now = 5000.0

    # Call _allow for 5000 distinct clients at the same fixed_now
    for i in range(5000):
        allowed = guard._allow(f"client_{i}", "/api/v1/ask", 100, now=fixed_now)
        assert allowed is True

    # Sweep must have run at most ONCE because now does not advance
    import app.limits as limits_mod

    assert limits_mod._sweep_count <= 1
    assert len(_HITS) <= MAX_RATE_LIMIT_KEYS


# =============================================================================
# R3-3: IPv6 /64 grouping, port/bracket stripping, IPv4-mapped canonicalisation
# =============================================================================


def test_r3_3_ipv6_64_grouping_and_port_stripping() -> None:
    # 1. IPv6 addresses in same /64 must produce the same key
    key1 = client_key("2001:db8::1", None, 0)
    key2 = client_key("2001:db8::ffff", None, 0)
    assert key1 == key2 == "2001:db8::/64"

    # Different /64 network produces different key
    key3 = client_key("2001:db8:1::1", None, 0)
    assert key3 == "2001:db8:1::/64"
    assert key1 != key3

    # 2. Strip brackets and port
    assert client_key("[2001:db8::1]:8080", None, 0) == "2001:db8::/64"
    assert client_key("[2001:db8::1]", None, 0) == "2001:db8::/64"
    assert client_key("192.0.2.1:5000", None, 0) == "192.0.2.1"

    # 3. Canonicalise IPv4-mapped IPv6 address
    assert client_key("::ffff:192.0.2.1", None, 0) == "192.0.2.1"

    # 4. Standard IPv4 behavior preserved
    assert client_key("192.0.2.1", None, 0) == "192.0.2.1"
    assert client_key("unknown", None, 0) == "unknown"


# =============================================================================
# R3-5: Content-Length safe parsing & duplicate X-Forwarded-For join
# =============================================================================


def test_r3_5_content_length_superscript_and_large_digits() -> None:
    async def _run() -> None:
        app_mock = AsyncMock()
        guard = RequestGuardMiddleware(app_mock, body_limits={"/api/v1/ask": 1024})

        sent_messages: list[dict[str, Any]] = []

        async def fake_send(msg: dict[str, Any]) -> None:
            sent_messages.append(msg)

        async def fake_receive() -> dict[str, Any]:
            return {"type": "http.request", "body": b""}

        # 1. Latin-1 superscript '\xb2' (digit in unicode, raises ValueError in int())
        scope_superscript: dict[str, Any] = {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/ask",
            "headers": [(b"content-length", b"\xb2")],
        }
        sent_messages.clear()
        await guard(scope_superscript, fake_receive, fake_send)
        assert sent_messages[0]["status"] == 400  # Never 500

        # 2. >4300 digits (would raise ValueError in int() due to Python integer conversion limit)
        scope_massive: dict[str, Any] = {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/ask",
            "headers": [(b"content-length", b"9" * 5000)],
        }
        sent_messages.clear()
        await guard(scope_massive, fake_receive, fake_send)
        assert sent_messages[0]["status"] in (400, 413)  # Never 500

    asyncio.run(_run())


def test_r3_5_duplicate_xff_header_lines_joined() -> None:
    async def dummy_app(scope: Any, receive: Any, send: Any) -> None:
        pass

    guard = RequestGuardMiddleware(dummy_app, body_limits={"/api/v1/ask": 1024})

    # Scope with duplicate X-Forwarded-For lines
    scope_duplicate_xff: dict[str, Any] = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/ask",
        "headers": [
            (b"x-forwarded-for", b"1.1.1.1"),
            (b"x-forwarded-for", b"2001:db8::1"),
        ],
    }

    # With TRUSTED_PROXY_HOPS=1, rightmost entry was the second XFF line: 2001:db8::1
    with patch.dict(os.environ, {"TRUSTED_PROXY_HOPS": "1"}):
        # 1. Directly extract from ASGI scope headers without manual pre-joining
        key_from_scope = guard._client_key(scope_duplicate_xff)
        assert key_from_scope == "2001:db8::/64"

        # 2. Backward compatibility with pre-extracted dict
        headers_dict = guard._client_key(
            scope_duplicate_xff,
            {"x-forwarded-for": "1.1.1.1, 2001:db8::1"},
        )
        assert headers_dict == "2001:db8::/64"
