"""Round 2 security regression tests (Task 25, Requirement 16).

Written by Kiro before the fixes, to confirm each audit finding reproduces:
- A6-01 X-Forwarded-For spoofing        - A6-02 limiter memory growth
- A6-03 /ask concurrency cap            - A6-04 CSP on API responses
- A6-05 trailing-slash guard bypass     - A6-15 streamed overflow gives 413, not 500
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterator

import httpx
import pytest
from fastapi.testclient import TestClient

from app.limits import (
    _HITS,
    RATE_WINDOW_SECONDS,
    RequestGuardMiddleware,
    client_key,
    normalize_path,
    reset_rate_limits,
    trusted_proxy_hops,
)
from app.main import app, get_provider_chain, reset_ask_semaphore
from app.vision.chain import ProviderChain
from fixtures.triangle import triangle_scene

VALIDATE_BODY = {"scene": triangle_scene().model_dump()}


class FakeAskProvider:
    """Minimal slow text provider: returns canned replies after a delay."""

    def __init__(self, name: str, responses: list[str], delay: float = 0.0) -> None:
        self.name = name
        self.responses = list(responses)
        self.delay = delay

    async def complete(self, prompt: str, *, timeout: float) -> str:
        await asyncio.sleep(self.delay)
        return self.responses.pop(0) if self.responses else "{}"


@pytest.fixture(autouse=True)
def _clean(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv("TRUSTED_PROXY_HOPS", raising=False)
    monkeypatch.delenv("RENDER", raising=False)
    app.dependency_overrides.clear()
    reset_rate_limits()
    reset_ask_semaphore()
    yield
    app.dependency_overrides.clear()
    reset_rate_limits()
    reset_ask_semaphore()


# ---------------------------------------------------------------------------
# A6-01: client identity
# ---------------------------------------------------------------------------


def test_client_key_without_trusted_hops_is_the_peer_address() -> None:
    assert client_key("203.0.113.9", "1.1.1.1, 2.2.2.2", 0) == "203.0.113.9"
    assert client_key(None, "1.1.1.1", 0) == "unknown"


def test_client_key_uses_the_entry_the_trusted_proxy_appended() -> None:
    # The client wrote "6.6.6.6"; the trusted proxy appended the real address.
    assert client_key("10.0.0.1", "6.6.6.6, 198.51.100.7", 1) == "198.51.100.7"
    # Two trusted hops: take the second from the right.
    assert client_key("10.0.0.1", "6.6.6.6, 198.51.100.7, 172.16.0.5", 2) == "198.51.100.7"


def test_client_key_falls_back_to_peer_when_header_is_shorter_than_trusted_hops() -> None:
    assert client_key("203.0.113.9", "", 1) == "203.0.113.9"
    assert client_key("203.0.113.9", None, 2) == "203.0.113.9"
    assert client_key("203.0.113.9", "1.1.1.1", 2) == "203.0.113.9"


def test_client_key_is_bounded_in_length() -> None:
    assert len(client_key("x", "a" * 500, 1)) <= 64


def test_trusted_proxy_hops_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    assert trusted_proxy_hops() == 0
    monkeypatch.setenv("RENDER", "true")
    assert trusted_proxy_hops() == 1
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "2")
    assert trusted_proxy_hops() == 2
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "-3")
    assert trusted_proxy_hops() == 1  # invalid value falls back to the default
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "0")
    assert trusted_proxy_hops() == 0  # explicit zero wins over the Render default


def test_forged_forwarded_for_does_not_bypass_the_rate_limit_off_render() -> None:
    client = TestClient(app)
    codes = [
        client.post(
            "/api/v1/validate", json=VALIDATE_BODY, headers={"X-Forwarded-For": f"10.0.0.{i}"}
        ).status_code
        for i in range(45)
    ]
    assert codes[:40] == [200] * 40
    assert 429 in codes[40:]


def test_forged_leftmost_entry_does_not_bypass_the_rate_limit_behind_a_trusted_proxy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    client = TestClient(app)
    codes = [
        client.post(
            "/api/v1/validate",
            json=VALIDATE_BODY,
            headers={"X-Forwarded-For": f"10.0.0.{i}, 198.51.100.7"},
        ).status_code
        for i in range(45)
    ]
    assert codes[:40] == [200] * 40
    assert 429 in codes[40:]


def test_different_real_clients_behind_the_proxy_get_separate_budgets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    client = TestClient(app)
    for _ in range(40):
        assert (
            client.post(
                "/api/v1/validate", json=VALIDATE_BODY, headers={"X-Forwarded-For": "198.51.100.7"}
            ).status_code
            == 200
        )
    other = client.post(
        "/api/v1/validate", json=VALIDATE_BODY, headers={"X-Forwarded-For": "198.51.100.8"}
    )
    assert other.status_code == 200


# ---------------------------------------------------------------------------
# A6-02: limiter memory
# ---------------------------------------------------------------------------


def _middleware() -> RequestGuardMiddleware:
    async def _noop(scope, receive, send):  # type: ignore[no-untyped-def]
        return None

    return RequestGuardMiddleware(_noop, body_limits={}, rate_limits={"/api/v1/ask": 40})


def test_expired_clients_are_removed_not_kept_as_empty_windows() -> None:
    mw = _middleware()
    for i in range(300):
        assert mw._allow(f"10.1.{i // 250}.{i % 250}", "/api/v1/ask", 40, now=1000.0)
    assert len(_HITS) == 300

    # Two windows later one new client arrives; every earlier client has expired.
    assert mw._allow("192.0.2.1", "/api/v1/ask", 40, now=1000.0 + 2 * RATE_WINDOW_SECONDS)
    assert len(_HITS) == 1
    assert all(len(window) > 0 for window in _HITS.values())


def test_a_client_that_is_still_active_is_kept() -> None:
    mw = _middleware()
    assert mw._allow("192.0.2.1", "/api/v1/ask", 40, now=1000.0)
    assert mw._allow("192.0.2.2", "/api/v1/ask", 40, now=1000.0 + RATE_WINDOW_SECONDS / 2)
    assert mw._allow("192.0.2.3", "/api/v1/ask", 40, now=1000.0 + RATE_WINDOW_SECONDS + 10.0)
    keys = {client for client, _ in _HITS}
    assert "192.0.2.2" in keys and "192.0.2.3" in keys


# ---------------------------------------------------------------------------
# A6-03: /ask concurrency cap
# ---------------------------------------------------------------------------


def test_ask_returns_503_with_retry_after_when_all_slots_are_busy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ASK_MAX_CONCURRENCY", "1")
    monkeypatch.setenv("ASK_QUEUE_WAIT_SECONDS", "0")
    reset_ask_semaphore()
    slow = FakeAskProvider("slow", responses=['{"answer": "It is a triangle."}'] * 4, delay=0.4)
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([slow])
    body = {"scene": triangle_scene().model_dump(), "question": "Describe this picture please"}

    async def _run() -> list[httpx.Response]:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
            return list(await asyncio.gather(*(c.post("/api/v1/ask", json=body) for _ in range(3))))

    responses = asyncio.run(_run())
    codes = sorted(r.status_code for r in responses)
    assert codes.count(200) >= 1
    assert 503 in codes
    busy = next(r for r in responses if r.status_code == 503)
    assert busy.headers.get("retry-after")


# ---------------------------------------------------------------------------
# A6-04: API headers
# ---------------------------------------------------------------------------


def test_api_responses_forbid_framing_and_scripts() -> None:
    response = TestClient(app).get("/api/v1/health")
    assert (
        response.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"
    )
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-content-type-options"] == "nosniff"


# ---------------------------------------------------------------------------
# A6-05: path normalisation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("/api/v1/ask", "/api/v1/ask"),
        ("/api/v1/ask/", "/api/v1/ask"),
        ("/api/v1/ask///", "/api/v1/ask"),
        ("//api/v1/ask", "/api/v1/ask"),
        ("/api//v1///ask/", "/api/v1/ask"),
        ("/", "/"),
        ("", "/"),
        ("///", "/"),
    ],
)
def test_normalize_path(raw: str, expected: str) -> None:
    assert normalize_path(raw) == expected


def test_trailing_slash_is_guarded_on_the_first_hop() -> None:
    # Without normalisation the first request is unguarded and only the redirect it earns is
    # checked. The first hop must be rejected itself.
    client = TestClient(app, follow_redirects=False)
    response = client.post(
        "/api/v1/ask/", content=b"x" * (600 * 1024), headers={"content-type": "application/json"}
    )
    assert response.status_code == 413


def test_trailing_slash_requests_count_against_the_rate_limit() -> None:
    client = TestClient(app, follow_redirects=False)
    codes = [
        client.post(path, json=VALIDATE_BODY).status_code
        for path in ["/api/v1/validate/"] * 20
        + ["/api/v1/validate"] * 20
        + ["/api/v1/validate//"] * 5
    ]
    assert 429 in codes


def test_ask_disconnect_in_the_middle_of_a_model_call_cancels_it_and_returns_499() -> None:
    from unittest.mock import AsyncMock

    from app.ask import AskRequest
    from app.main import ask_question_route

    slow = FakeAskProvider("slow", responses=['{"answer": "late"}'], delay=5.0)
    req = AskRequest(scene=triangle_scene(), question="Describe this picture please", lang="en")
    raw_request = AsyncMock()
    raw_request.is_disconnected.side_effect = [False, False, True]

    async def _run() -> tuple[int, float]:
        loop = asyncio.get_running_loop()
        t0 = loop.time()
        resp = await ask_question_route(req, raw_request, ProviderChain([slow]))
        return resp.status_code, loop.time() - t0

    status, elapsed = asyncio.run(_run())
    assert status == 499
    assert elapsed < 2.0  # the 5 s model call was cancelled, not waited for


# ---------------------------------------------------------------------------
# A6-15: streamed overflow
# ---------------------------------------------------------------------------


def test_streamed_oversize_body_returns_413_not_500() -> None:
    def chunks() -> Iterator[bytes]:
        for _ in range(80):
            yield b"x" * 8192  # 640 KB, no Content-Length

    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/api/v1/ask", content=chunks(), headers={"content-type": "application/json"}
    )
    assert response.status_code == 413


# ---------------------------------------------------------------------------
# A6-08: Raw Mode work is bounded on noisy photos
# ---------------------------------------------------------------------------


def test_raw_mode_bounds_dedupe_candidates_on_a_noisy_photo(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import cv2
    import numpy as np

    import app.raw_mode as rm

    seen: list[int] = []
    original = rm._dedupe_segments

    def counting(segments, *args, **kwargs):  # type: ignore[no-untyped-def]
        seen.append(len(segments))
        return original(segments, *args, **kwargs)

    monkeypatch.setattr(rm, "_dedupe_segments", counting)
    noise = (np.random.default_rng(7).random((400, 400)) * 255).astype("uint8")
    ok, buf = cv2.imencode(".png", cv2.cvtColor(noise, cv2.COLOR_GRAY2BGR))
    assert ok

    scene = rm.build_raw_scene(bytes(buf))

    # Before the fix this image sent about 24 000 candidates into the quadratic step (21 s).
    assert seen and max(seen) <= rm.MAX_DEDUPE_CANDIDATES
    assert 0 < len(scene.segments) <= rm.MAX_RAW_SEGMENTS


def test_raw_mode_keeps_the_longest_segment_of_a_simple_drawing() -> None:
    import cv2
    import numpy as np

    from app.raw_mode import build_raw_scene

    img = np.full((400, 400, 3), 255, "uint8")
    cv2.line(img, (20, 200), (380, 200), (0, 0, 0), 3)  # one long line
    for i in range(40):  # plus lots of short clutter
        x = 20 + i * 9
        cv2.line(img, (x, 40), (x + 4, 44), (0, 0, 0), 1)
    ok, buf = cv2.imencode(".png", img)
    scene = build_raw_scene(bytes(buf))
    pts = {p.id: p for p in scene.points}
    lengths = [abs(pts[s.a].x - pts[s.b].x) + abs(pts[s.a].y - pts[s.b].y) for s in scene.segments]
    assert max(lengths) > 0.8  # the long horizontal line survived


# ---------------------------------------------------------------------------
# A6-10: background improve passes are bounded
# ---------------------------------------------------------------------------


class _CountingImproveProvider:
    """Counts how many extract() calls are in flight at once."""

    name = "improve-fake"

    def __init__(self) -> None:
        self.in_flight = 0
        self.max_in_flight = 0
        self.calls = 0

    async def extract(self, image: bytes, content_type: str, prompt: str, *, timeout: float) -> str:
        self.calls += 1
        self.in_flight += 1
        self.max_in_flight = max(self.max_in_flight, self.in_flight)
        try:
            await asyncio.sleep(0.15)
        finally:
            self.in_flight -= 1
        return "{}"


def _run_many_improve_passes(count: int) -> _CountingImproveProvider:
    from app.main import run_improve_pass
    from app.validate import ValidationResult

    provider = _CountingImproveProvider()

    def validator(raw):  # type: ignore[no-untyped-def]
        return ValidationResult(scene=None, errors=["not needed"])

    async def _run() -> None:
        await asyncio.gather(
            *(
                run_improve_pass(provider, b"img", "image/png", f"key-{i}", validator)  # type: ignore[arg-type]
                for i in range(count)
            )
        )

    asyncio.run(_run())
    return provider


def test_improve_passes_never_run_more_than_the_cap_at_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.main import reset_improve_semaphore

    monkeypatch.setenv("IMPROVE_MAX_CONCURRENCY", "1")
    reset_improve_semaphore()
    provider = _run_many_improve_passes(8)
    assert provider.max_in_flight == 1
    # Best effort: passes that find every slot busy are skipped, not queued without bound.
    assert 1 <= provider.calls < 8
    reset_improve_semaphore()


def test_improve_pass_cap_can_be_raised(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.main import reset_improve_semaphore

    monkeypatch.setenv("IMPROVE_MAX_CONCURRENCY", "3")
    reset_improve_semaphore()
    provider = _run_many_improve_passes(8)
    assert provider.max_in_flight == 3
    reset_improve_semaphore()
