"""Tests for provider retry on transient errors and error classification (Lane x-retry)."""

from __future__ import annotations

import asyncio
import logging
import time

import httpx
import pytest

from app.vision.base import VisionError, is_transient
from app.vision.chain import (
    DEFAULT_PROVIDER_RETRIES,
    DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS,
    ProviderChain,
    parse_provider_retries,
    parse_provider_retry_backoff,
)

# --- Error Classification Unit Tests ---


@pytest.mark.parametrize(
    "error",
    [
        VisionError("openai", "rate limited (429)", status_code=429),
        VisionError("gemini", "server error (500)", status_code=500),
        VisionError("nebius", "server error (502)", status_code=502),
        VisionError(
            "gemini",
            "API error (503): This model is currently experiencing high demand.",
            status_code=503,
        ),
        VisionError("gemini", "504 Gateway Timeout", status_code=504),
        VisionError("gemini", "The service is temporarily UNAVAILABLE"),
        VisionError(
            "gemini",
            "This model is currently experiencing high demand. Spikes in demand are usually temporary.",
        ),
        VisionError("openai", "connection reset by peer"),
        VisionError("nebius", "connect timeout: failed to connect to api"),
        VisionError("custom", "arbitrary message", transient=True),
        VisionError("custom", "server 503 error without status_code attr"),
        VisionError("custom", "rate limit exceeded (429)"),
    ],
)
def test_is_transient_true_cases(error: VisionError) -> None:
    assert is_transient(error) is True


def test_is_transient_cause_inspection() -> None:
    err_reset = VisionError("openai", "connection error")
    err_reset.__cause__ = ConnectionResetError("Connection reset by peer")
    assert is_transient(err_reset) is True

    err_connect_timeout = VisionError("openai", "network error")
    err_connect_timeout.__cause__ = httpx.ConnectTimeout("Connect timeout")
    assert is_transient(err_connect_timeout) is True


@pytest.mark.parametrize(
    "error",
    [
        VisionError("openai", "HTTP 400: Bad Request", status_code=400),
        VisionError("openai", "authentication failed (401): invalid api key", status_code=401),
        VisionError("openai", "authentication failed (403): forbidden", status_code=403),
        VisionError("openai", "HTTP 404: Not Found", status_code=404),
        VisionError("gemini", "API key not configured"),
        VisionError("chain", "validation failure: missing required field 'kind'"),
        VisionError("gemini", "schema error: invalid json structure"),
        VisionError("openai", "content filter refusal: response blocked by safety policy"),
        VisionError("nebius", "content-filter refusal: policy violation"),
        VisionError("gemini", "request timed out after 8.0s"),
        VisionError("custom", "arbitrary error", transient=False),
        VisionError("custom", "unclassified random error"),
    ],
)
def test_is_transient_false_cases(error: VisionError) -> None:
    assert is_transient(error) is False


def test_is_transient_none_and_non_exception() -> None:
    assert is_transient(None) is False
    assert is_transient("503 Service Unavailable") is True
    assert is_transient("401 Unauthorized") is False


# --- Environment Variable Parsing Unit Tests ---


def test_parse_provider_retries() -> None:
    assert parse_provider_retries("0") == 0
    assert parse_provider_retries("2") == 2
    assert parse_provider_retries("-1") == DEFAULT_PROVIDER_RETRIES
    assert parse_provider_retries("invalid") == DEFAULT_PROVIDER_RETRIES
    assert parse_provider_retries(None) == DEFAULT_PROVIDER_RETRIES


def test_parse_provider_retry_backoff() -> None:
    assert parse_provider_retry_backoff("0.0") == 0.0
    assert parse_provider_retry_backoff("1.5") == 1.5
    assert parse_provider_retry_backoff("-0.5") == DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS
    assert parse_provider_retry_backoff("abc") == DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS
    assert parse_provider_retry_backoff(None) == DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS


# --- ProviderChain Retry Behavior Tests ---


class ConfigurableFakeProvider:
    """Fake vision provider with configurable series of responses/errors."""

    def __init__(self, name: str, outcomes: list[str | VisionError]) -> None:
        self.name = name
        self.outcomes = list(outcomes)
        self.call_count = 0
        self.call_timeouts: list[float] = []

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        self.call_count += 1
        self.call_timeouts.append(timeout)
        if self.outcomes:
            outcome = self.outcomes.pop(0)
            if isinstance(outcome, VisionError):
                raise outcome
            return outcome
        return '{"kind": "default"}'

    async def complete(self, prompt: str, *, timeout: float) -> str:
        self.call_count += 1
        self.call_timeouts.append(timeout)
        if self.outcomes:
            outcome = self.outcomes.pop(0)
            if isinstance(outcome, VisionError):
                raise outcome
            return outcome
        return "default answer"


def test_retry_on_503_then_succeeds() -> None:
    """A provider that fails once with 503 then succeeds is retried and its answer used."""

    async def _run() -> None:
        sleep_calls: list[float] = []

        async def fake_sleep(duration: float) -> None:
            sleep_calls.append(duration)

        err_503 = VisionError(
            "gemini",
            "API error (503): High demand",
            status_code=503,
            transient=True,
        )
        p1 = ConfigurableFakeProvider("gemini", [err_503, '{"kind": "retried_success"}'])
        p2 = ConfigurableFakeProvider("openai", ['{"kind": "fallback"}'])

        chain = ProviderChain(
            [p1, p2],
            retries=1,
            retry_backoff=0.01,
            sleep_fn=fake_sleep,
        )

        raw, used = await chain.extract(b"img", "image/png", "prompt")
        assert raw == '{"kind": "retried_success"}'
        assert used == "gemini"
        assert p1.call_count == 2
        assert p2.call_count == 0
        assert len(sleep_calls) == 1
        assert sleep_calls[0] == 0.01

    asyncio.run(_run())


def test_no_retry_on_401_falls_to_next_provider() -> None:
    """A provider that fails with 401 is NOT retried and the next provider is tried."""

    async def _run() -> None:
        err_401 = VisionError(
            "gemini",
            "authentication failed (401): invalid key",
            status_code=401,
            transient=False,
        )
        p1 = ConfigurableFakeProvider("gemini", [err_401])
        p2 = ConfigurableFakeProvider("openai", ['{"kind": "fallback_success"}'])

        chain = ProviderChain([p1, p2], retries=1, retry_backoff=0.01)

        raw, used = await chain.extract(b"img", "image/png", "prompt")
        assert raw == '{"kind": "fallback_success"}'
        assert used == "openai"
        assert p1.call_count == 1  # Not retried!
        assert p2.call_count == 1

    asyncio.run(_run())


def test_provider_retries_zero_no_retry() -> None:
    """With PROVIDER_RETRIES=0 nothing is retried."""

    async def _run() -> None:
        err_503 = VisionError("gemini", "503 Unavailable", status_code=503)
        p1 = ConfigurableFakeProvider("gemini", [err_503, '{"kind": "ignored"}'])
        p2 = ConfigurableFakeProvider("openai", ['{"kind": "second_provider"}'])

        chain = ProviderChain([p1, p2], retries=0)

        raw, used = await chain.extract(b"img", "image/png", "prompt")
        assert raw == '{"kind": "second_provider"}'
        assert used == "openai"
        assert p1.call_count == 1
        assert p2.call_count == 1

    asyncio.run(_run())


def test_no_retry_when_remaining_deadline_too_small() -> None:
    """When the remaining deadline is too small (e.g. < backoff + 3.0s) no retry happens."""

    async def _run() -> None:
        err_503 = VisionError("gemini", "503 Unavailable", status_code=503)
        p1 = ConfigurableFakeProvider("gemini", [err_503, '{"kind": "ignored"}'])
        p2 = ConfigurableFakeProvider("openai", ['{"kind": "fallback_p2"}'])

        chain = ProviderChain([p1, p2], retries=1, retry_backoff=0.8, min_useful_call_time=3.0)

        # Remaining deadline is only 2.0s, which is less than 0.8 + 3.0 = 3.8s
        short_deadline = time.monotonic() + 2.0
        raw, used = await chain.extract(b"img", "image/png", "prompt", deadline=short_deadline)

        assert raw == '{"kind": "fallback_p2"}'
        assert used == "openai"
        assert p1.call_count == 1  # p1 was not retried because deadline was insufficient
        assert p2.call_count == 1

    asyncio.run(_run())


def test_retries_counted_against_total_deadline() -> None:
    """Retries are counted against the total deadline: timeout passed to retry call is capped."""

    async def _run() -> None:
        err_503 = VisionError("gemini", "503 High demand", status_code=503)
        p1 = ConfigurableFakeProvider("gemini", [err_503, '{"kind": "done"}'])

        chain = ProviderChain([p1], call_timeout=8.0, retries=1, retry_backoff=0.0)

        deadline = time.monotonic() + 4.5
        raw, used = await chain.extract(b"img", "image/png", "prompt", deadline=deadline)

        assert raw == '{"kind": "done"}'
        assert p1.call_count == 2
        # Both calls were capped by deadline <= 4.5s, well under call_timeout 8.0s
        assert p1.call_timeouts[0] <= 4.5
        assert p1.call_timeouts[1] <= 4.5
        assert p1.call_timeouts[1] <= p1.call_timeouts[0]

    asyncio.run(_run())


def test_two_transient_failures_fall_through_to_next_provider() -> None:
    """Two transient failures (initial + 1 retry) then fall through to the next provider."""

    async def _run() -> None:
        err_503_a = VisionError("gemini", "503 spike", status_code=503)
        err_503_b = VisionError("gemini", "503 spike again", status_code=503)
        p1 = ConfigurableFakeProvider("gemini", [err_503_a, err_503_b])
        p2 = ConfigurableFakeProvider("openai", ['{"kind": "openai_result"}'])

        chain = ProviderChain([p1, p2], retries=1, retry_backoff=0.0)

        raw, used = await chain.extract(b"img", "image/png", "prompt")
        assert raw == '{"kind": "openai_result"}'
        assert used == "openai"
        assert p1.call_count == 2  # initial attempt + 1 retry
        assert p2.call_count == 1

    asyncio.run(_run())


def test_retry_never_reorders_provider_list() -> None:
    """The retry mechanism never reorders or mutates the provider list."""

    async def _run() -> None:
        err_503 = VisionError("gemini", "503 Unavailable", status_code=503)
        p1 = ConfigurableFakeProvider("gemini", [err_503, '{"kind": "first"}'])
        p2 = ConfigurableFakeProvider("openai", ['{"kind": "second"}'])

        chain = ProviderChain([p1, p2], retries=1, retry_backoff=0.0)
        original_order = [p.name for p in chain.providers]

        await chain.extract(b"img", "image/png", "prompt")
        after_extract_order = [p.name for p in chain.providers]

        assert original_order == ["gemini", "openai"]
        assert after_extract_order == ["gemini", "openai"]
        assert chain.providers[0] is p1
        assert chain.providers[1] is p2

    asyncio.run(_run())


def test_complete_method_retries_transient_error() -> None:
    """complete() retries transient errors on the same provider."""

    async def _run() -> None:
        err_429 = VisionError("gemini", "rate limited (429)", status_code=429)
        p1 = ConfigurableFakeProvider("gemini", [err_429, "answer after retry"])
        p2 = ConfigurableFakeProvider("openai", ["fallback answer"])

        chain = ProviderChain([p1, p2], retries=1, retry_backoff=0.0)

        ans, used = await chain.complete("ask question")
        assert ans == "answer after retry"
        assert used == "gemini"
        assert p1.call_count == 2
        assert p2.call_count == 0

    asyncio.run(_run())


def test_retry_logging_safe_contents(caplog: pytest.LogCaptureFixture) -> None:
    """Logging logs one short line per retry with provider NAME and error CLASS only, no secrets/payloads."""

    async def _run() -> None:
        err_503 = VisionError(
            "gemini",
            "API error (503): High demand secret_key_12345",
            status_code=503,
        )
        p1 = ConfigurableFakeProvider("gemini", [err_503, '{"kind": "ok"}'])
        chain = ProviderChain([p1], retries=1, retry_backoff=0.0)

        with caplog.at_level(logging.INFO):
            await chain.extract(b"sensitive_image_bytes", "image/png", "secret prompt")

        retry_records = [r for r in caplog.records if "Retrying provider" in r.message]
        assert len(retry_records) == 1
        msg = retry_records[0].message
        assert "Retrying provider gemini after VisionError" in msg
        assert "secret_key" not in msg
        assert "sensitive_image_bytes" not in msg
        assert "secret prompt" not in msg

    asyncio.run(_run())


def test_chain_picks_up_env_retries_when_set(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.vision import build_chain_from_env

    monkeypatch.setenv("PROVIDER_RETRIES", "2")
    monkeypatch.setenv("PROVIDER_RETRY_BACKOFF_SECONDS", "1.2")
    chain = build_chain_from_env()
    assert chain.retries == 2
    assert chain.retry_backoff == 1.2


def test_main_get_provider_chain_retry_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.main import get_provider_chain, reset_provider_chain

    reset_provider_chain()
    monkeypatch.delenv("PROVIDER_RETRIES", raising=False)
    monkeypatch.delenv("PROVIDER_RETRY_BACKOFF_SECONDS", raising=False)
    chain = get_provider_chain()
    assert chain.retries == 1
    assert chain.retry_backoff == 0.8
    reset_provider_chain()


def test_main_get_provider_chain_retry_env_propagation(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.main import get_provider_chain, reset_provider_chain

    reset_provider_chain()
    monkeypatch.setenv("PROVIDER_RETRIES", "3")
    monkeypatch.setenv("PROVIDER_RETRY_BACKOFF_SECONDS", "0.5")
    chain = get_provider_chain()
    assert chain.retries == 3
    assert chain.retry_backoff == 0.5
    reset_provider_chain()


def test_main_validate_env_settings_retry_warnings(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    from app.vision import build_chain_from_env

    monkeypatch.setenv("PROVIDER_RETRIES", "-1")
    monkeypatch.setenv("PROVIDER_RETRY_BACKOFF_SECONDS", "not_a_number")
    with caplog.at_level(logging.WARNING):
        chain = build_chain_from_env()
    assert chain.retries == 1
    assert chain.retry_backoff == 0.8
    retries_warnings = [
        r for r in caplog.records if "PROVIDER_RETRIES must be non-negative" in r.message
    ]
    backoff_warnings = [
        r for r in caplog.records if "Invalid PROVIDER_RETRY_BACKOFF_SECONDS" in r.message
    ]
    assert len(retries_warnings) == 1
    assert len(backoff_warnings) == 1
