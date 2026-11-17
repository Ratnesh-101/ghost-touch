"""Tests for per-provider circuit breaker (Lane UX12).

Verifies:
- Breaker opens after 2 consecutive failures for 60 s.
- Skips open provider for 60 s.
- In half-open: one call allowed, probe once, closes on success, reopens on failure.
- Interleaved successes never open it.
- When all providers are open, still tries the one whose open-until is earliest.
- Failures that count: timeout, HTTP 5xx, HTTP 429, connect error.
- State changes logged at INFO with provider name only.
"""

from __future__ import annotations

import asyncio
import logging

import pytest

from app.vision.base import VisionError
from app.vision.chain import ProviderChain, is_breaker_failure


class FakeClock:
    """Injectable monotonic clock for deterministic breaker testing."""

    def __init__(self, initial: float = 100.0) -> None:
        self.current: float = initial

    def __call__(self) -> float:
        return self.current

    def advance(self, seconds: float) -> None:
        self.current += seconds

    def set(self, timestamp: float) -> None:
        self.current = timestamp


class BreakerTestProvider:
    """Mock provider with controllable responses and call counting."""

    def __init__(
        self,
        name: str,
        responses: list[str | Exception] | None = None,
        default_response: str | Exception = "healthy response",
    ) -> None:
        self.name = name
        self.responses: list[str | Exception] = list(responses) if responses is not None else []
        self.default_response = default_response
        self.call_count: int = 0
        self.extract_call_count: int = 0

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        self.extract_call_count += 1
        return await self._get_next_response()

    async def complete(self, prompt: str, *, timeout: float) -> str:
        self.call_count += 1
        return await self._get_next_response()

    async def _get_next_response(self) -> str:
        if self.responses:
            item = self.responses.pop(0)
        else:
            item = self.default_response

        if isinstance(item, Exception):
            raise item
        return item


def test_breaker_opens_after_2_failures_skips_60s_probes_once_closes_on_success() -> None:
    """Breaker opens after 2 failures, skips for 60 s, probes once, closes on success."""

    async def _run() -> None:
        clock = FakeClock(100.0)
        p1 = BreakerTestProvider(
            "p1",
            responses=[
                TimeoutError("p1 timed out"),
                VisionError("p1", "server error 500", status_code=500),
                "p1 recovered response",  # Probe response
            ],
        )
        p2 = BreakerTestProvider("p2", default_response="p2 fallback response")

        chain = ProviderChain([p1, p2], clock=clock)
        b1 = chain.get_breaker("p1")

        # Call 1 (t=100.0): p1 fails once
        ans, used = await chain.complete("query 1")
        assert used == "p2"
        assert ans == "p2 fallback response"
        assert b1.consecutive_failures == 1
        assert b1.state == "closed"
        assert p1.call_count == 1
        assert p2.call_count == 1

        # Call 2 (t=101.0): p1 fails a 2nd time -> breaker OPENS
        clock.advance(1.0)
        ans, used = await chain.complete("query 2")
        assert used == "p2"
        assert b1.consecutive_failures == 2
        assert b1.state == "open"
        assert b1.open_until == 161.0  # 101.0 + 60.0s
        assert p1.call_count == 2
        assert p2.call_count == 2

        # Call 3 (t=120.0): 19s later (t < 161.0) -> p1 is SKIPPED
        clock.advance(19.0)
        ans, used = await chain.complete("query 3")
        assert used == "p2"
        # p1 was not called because its breaker is open
        assert p1.call_count == 2
        assert p2.call_count == 3

        # Advance clock to t=162.0 (t >= 161.0) -> transitions to half-open
        clock.set(162.0)
        assert b1.state == "half-open"

        # Call 4: probes once -> p1 succeeds!
        ans, used = await chain.complete("query 4")
        assert used == "p1"
        assert ans == "p1 recovered response"
        assert p1.call_count == 3
        # Success closes breaker and resets consecutive failures
        assert b1.state == "closed"
        assert b1.consecutive_failures == 0
        assert b1.open_until == 0.0

        # Call 5: p1 is used normally now that breaker is closed
        ans, used = await chain.complete("query 5")
        assert used == "p1"
        assert p1.call_count == 4

    asyncio.run(_run())


def test_breaker_half_open_failure_reopens_for_60s() -> None:
    """In half-open, failure reopens breaker for another 60 s."""

    async def _run() -> None:
        clock = FakeClock(100.0)
        p1 = BreakerTestProvider(
            "p1",
            responses=[
                TimeoutError("p1 timeout 1"),
                TimeoutError("p1 timeout 2"),
                VisionError("p1", "rate limited 429", status_code=429),  # probe fails
            ],
        )
        p2 = BreakerTestProvider("p2", default_response="p2 response")
        chain = ProviderChain([p1, p2], clock=clock)
        b1 = chain.get_breaker("p1")

        # 2 failures open the breaker
        await chain.complete("q1")
        await chain.complete("q2")
        assert b1.state == "open"
        assert b1.open_until == 160.0

        # Advance past 60s
        clock.set(165.0)
        assert b1.state == "half-open"

        # Probe fails -> reopens for 60s from current clock (165.0 + 60.0 = 225.0)
        ans, used = await chain.complete("q3")
        assert used == "p2"
        assert b1.state == "open"
        assert b1.open_until == 225.0

        # Call at t=180.0 skips p1
        clock.set(180.0)
        await chain.complete("q4")
        assert p1.call_count == 3  # 2 initial + 1 probe

    asyncio.run(_run())


def test_breaker_interleaved_successes_never_open() -> None:
    """Interleaved successes reset consecutive failures and never open breaker."""

    async def _run() -> None:
        clock = FakeClock(100.0)
        p1 = BreakerTestProvider(
            "p1",
            responses=[
                TimeoutError("fail 1"),
                "success 1",
                TimeoutError("fail 2"),
                "success 2",
                TimeoutError("fail 3"),
                "success 3",
            ],
        )
        p2 = BreakerTestProvider("p2", default_response="p2 fallback")
        chain = ProviderChain([p1, p2], clock=clock)
        b1 = chain.get_breaker("p1")

        for _ in range(6):
            await chain.complete("query")
            # Consecutive failures never reaches 2
            assert b1.consecutive_failures <= 1
            assert b1.state == "closed"

        assert b1.state == "closed"
        assert p1.call_count == 6

    asyncio.run(_run())


def test_breaker_all_open_still_tries_one() -> None:
    """When every provider is open, try the one whose open-until is earliest."""

    async def _run() -> None:
        clock = FakeClock(100.0)
        # p1 opened at t=100.0 -> open_until = 160.0
        p1 = BreakerTestProvider(
            "p1",
            responses=[
                "p1 emergency recovered answer",
            ],
        )
        # p2 opened at t=105.0 -> open_until = 165.0
        p2 = BreakerTestProvider(
            "p2",
            responses=[
                "p2 response",
            ],
        )

        chain = ProviderChain([p1, p2], clock=clock)
        b1 = chain.get_breaker("p1")
        b2 = chain.get_breaker("p2")

        # Open p1
        b1.state = "open"
        b1.open_until = 160.0
        b1.consecutive_failures = 2

        # Open p2
        b2.state = "open"
        b2.open_until = 165.0
        b2.consecutive_failures = 2

        # At t=110.0: both are open! Neither has expired
        clock.set(110.0)
        assert b1.state == "open"
        assert b2.state == "open"

        # Chain tries p1 because its open_until (160.0) is earlier than p2 (165.0)
        ans, used = await chain.complete("query")
        assert used == "p1"
        assert ans == "p1 emergency recovered answer"
        assert p1.call_count == 1
        assert p2.call_count == 0  # p2 was not tried ("all-open still tries one")
        # Since p1 succeeded, b1 closed
        assert b1.state == "closed"

    asyncio.run(_run())


def test_breaker_all_open_fails_gracefully_never_no_providers() -> None:
    """When all providers are open and the attempted earliest fails, raises error, not 'no providers'."""

    async def _run() -> None:
        clock = FakeClock(100.0)
        p1 = BreakerTestProvider(
            "p1",
            responses=[
                TimeoutError("p1 err"),
            ],
        )
        chain = ProviderChain([p1], clock=clock)
        b1 = chain.get_breaker("p1")
        b1.state = "open"
        b1.open_until = 160.0
        b1.consecutive_failures = 2

        clock.set(110.0)
        with pytest.raises(VisionError) as exc_info:
            await chain.complete("query")

        # Did NOT fail with "no providers configured"
        assert "no providers configured" not in exc_info.value.reason
        assert p1.call_count == 1

    asyncio.run(_run())


def test_breaker_counting_failures_classification() -> None:
    """Failures that count: timeout, HTTP 5xx, HTTP 429, connect error. Others do not."""
    # Count:
    assert is_breaker_failure(TimeoutError("operation timed out")) is True
    assert is_breaker_failure(TimeoutError()) is True
    assert is_breaker_failure(VisionError("p", "request timed out after 5.0s")) is True
    assert is_breaker_failure(VisionError("p", "server error (500)", status_code=500)) is True
    assert is_breaker_failure(VisionError("p", "bad gateway", status_code=502)) is True
    assert is_breaker_failure(VisionError("p", "service unavailable", status_code=503)) is True
    assert is_breaker_failure(VisionError("p", "gateway timeout", status_code=504)) is True
    assert is_breaker_failure(VisionError("p", "rate limited", status_code=429)) is True
    assert is_breaker_failure(ConnectionError("connect refused")) is True
    assert is_breaker_failure(ConnectionResetError()) is True
    assert is_breaker_failure(VisionError("p", "connect error: connection refused")) is True
    assert is_breaker_failure(VisionError("p", "connection reset: peer closed")) is True

    # Do NOT count:
    assert is_breaker_failure(VisionError("p", "bad request (400)", status_code=400)) is False
    assert is_breaker_failure(VisionError("p", "unauthorized (401)", status_code=401)) is False
    assert is_breaker_failure(VisionError("p", "forbidden (403)", status_code=403)) is False
    assert is_breaker_failure(VisionError("p", "not found (404)", status_code=404)) is False
    assert is_breaker_failure(VisionError("p", "API key not configured")) is False
    assert is_breaker_failure(VisionError("p", "paid call budget exhausted")) is False
    assert is_breaker_failure(VisionError("p", "invalid response JSON")) is False


def test_breaker_logs_state_changes_at_info_with_provider_name_only(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Log state changes at INFO with the provider name only."""

    async def _run() -> None:
        caplog.set_level(logging.INFO)
        clock = FakeClock(100.0)
        p1 = BreakerTestProvider(
            "p1",
            responses=[
                TimeoutError("err1"),
                TimeoutError("err2"),
                "recovered",
            ],
        )
        chain = ProviderChain([p1], clock=clock)

        # 2 failures -> open
        try:
            await chain.complete("q1")
        except VisionError:
            pass
        try:
            await chain.complete("q2")
        except VisionError:
            pass

        # Check log for 'open'
        open_records = [
            r
            for r in caplog.records
            if r.levelno == logging.INFO
            and "circuit breaker open" in r.message
            and "p1" in r.message
        ]
        assert len(open_records) >= 1
        # Provider name is logged, secret prompt text is not
        for r in open_records:
            assert "p1" in r.message
            assert "q1" not in r.message

        # Advance past 60s -> half-open
        clock.set(165.0)
        _ = chain.get_breaker("p1").state  # triggers transition to half-open

        half_open_records = [
            r
            for r in caplog.records
            if r.levelno == logging.INFO
            and "circuit breaker half-open" in r.message
            and "p1" in r.message
        ]
        assert len(half_open_records) >= 1

        # Probe succeeds -> closed
        await chain.complete("q3")
        closed_records = [
            r
            for r in caplog.records
            if r.levelno == logging.INFO
            and "circuit breaker closed" in r.message
            and "p1" in r.message
        ]
        assert len(closed_records) >= 1

    asyncio.run(_run())


def test_breaker_extract_method_works_with_breaker() -> None:
    """Breaker operates identically for chain.extract calls."""

    async def _run() -> None:
        clock = FakeClock(100.0)
        p1 = BreakerTestProvider(
            "p1",
            responses=[
                TimeoutError("timeout 1"),
                TimeoutError("timeout 2"),
                '{"version": 1, "kind": "p1_recovered"}',
            ],
        )
        p2 = BreakerTestProvider(
            "p2",
            default_response='{"version": 1, "kind": "p2_fallback"}',
        )
        chain = ProviderChain([p1, p2], clock=clock)
        b1 = chain.get_breaker("p1")

        # Call 1 & 2 fail on p1
        await chain.extract(b"img", "image/png", "prompt")
        await chain.extract(b"img", "image/png", "prompt")
        assert b1.state == "open"
        assert p1.extract_call_count == 2

        # Call 3: p1 skipped
        clock.advance(10.0)
        raw, used = await chain.extract(b"img", "image/png", "prompt")
        assert used == "p2"
        assert p1.extract_call_count == 2

        # Advance 60s: probe succeeds
        clock.advance(60.0)
        raw, used = await chain.extract(b"img", "image/png", "prompt")
        assert used == "p1"
        assert b1.state == "closed"
        assert p1.extract_call_count == 3

    asyncio.run(_run())
