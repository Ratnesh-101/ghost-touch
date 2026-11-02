"""Tests for GeminiProvider (Task 8.1, F2)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from google.genai import types

from app.vision.base import VisionError
from app.vision.gemini import (
    GeminiProvider,
    reset_process_thinking_state,
)

FAKE_KEY = "mock-gemini-api-key-test-12345"


@pytest.fixture(autouse=True)
def _reset_thinking() -> None:
    reset_process_thinking_state()
    yield
    reset_process_thinking_state()


def test_gemini_provider_uses_thinking_config() -> None:
    async def _run() -> None:
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = '{"version": 1, "kind": "unknown"}'
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        provider = GeminiProvider(
            api_key=FAKE_KEY,
            model="gemini-3.8-flash",
            thinking_budget=100,
            client=mock_client,
        )
        result = await provider.extract(b"bytes", "image/png", "prompt", timeout=5.0)

        assert result == '{"version": 1, "kind": "unknown"}'
        assert mock_client.aio.models.generate_content.called
        call_kwargs = mock_client.aio.models.generate_content.call_args.kwargs
        assert call_kwargs["config"].thinking_config.thinking_budget == 100

    asyncio.run(_run())


def test_gemini_provider_thinking_setting_levels(monkeypatch: pytest.MonkeyPatch) -> None:
    # Default is minimal
    monkeypatch.delenv("GEMINI_THINKING", raising=False)
    monkeypatch.delenv("GEMINI_THINKING_BUDGET", raising=False)
    provider_default = GeminiProvider(api_key=FAKE_KEY)
    cfg = provider_default.get_thinking_config()
    assert cfg is not None
    assert cfg.thinking_level == types.ThinkingLevel.MINIMAL

    # 'off' -> budget 0
    monkeypatch.setenv("GEMINI_THINKING", "off")
    provider_off = GeminiProvider(api_key=FAKE_KEY)
    cfg_off = provider_off.get_thinking_config()
    assert cfg_off is not None
    assert cfg_off.thinking_budget == 0

    # 'low' -> LOW level
    monkeypatch.setenv("GEMINI_THINKING", "low")
    provider_low = GeminiProvider(api_key=FAKE_KEY)
    cfg_low = provider_low.get_thinking_config()
    assert cfg_low is not None
    assert cfg_low.thinking_level == types.ThinkingLevel.LOW

    # 'default' -> None
    monkeypatch.setenv("GEMINI_THINKING", "default")
    provider_none = GeminiProvider(api_key=FAKE_KEY)
    assert provider_none.get_thinking_config() is None


def test_gemini_provider_invalid_thinking_setting_falls_back_to_minimal(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("GEMINI_THINKING", "ultra_fast_bogus")
    provider = GeminiProvider(api_key=FAKE_KEY)
    cfg = provider.get_thinking_config()
    assert cfg is not None
    assert cfg.thinking_level == types.ThinkingLevel.MINIMAL
    assert "Invalid GEMINI_THINKING setting" in caplog.text


def test_gemini_provider_deprecated_budget_alias(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_THINKING", raising=False)
    monkeypatch.setenv("GEMINI_THINKING_BUDGET", "0")
    provider = GeminiProvider(api_key=FAKE_KEY)
    cfg = provider.get_thinking_config()
    assert cfg is not None
    assert cfg.thinking_budget == 0

    monkeypatch.setenv("GEMINI_THINKING_BUDGET", "256")
    provider2 = GeminiProvider(api_key=FAKE_KEY)
    cfg2 = provider2.get_thinking_config()
    assert cfg2 is not None
    assert cfg2.thinking_budget == 256


def test_gemini_provider_thinking_rejected_then_retried_and_remembered() -> None:
    async def _run() -> None:
        mock_client = MagicMock()
        mock_resp_success = MagicMock()
        mock_resp_success.text = '{"version": 1, "kind": "geometry"}'

        # First call raises invalid-argument mentioning thinking, retry succeeds
        calls = []

        async def fake_generate_content(*_args, **kwargs) -> MagicMock:
            calls.append(kwargs)
            if len(calls) == 1:
                raise ValueError("InvalidArgument: thinking_config is not supported for this model")
            return mock_resp_success

        mock_client.aio.models.generate_content = fake_generate_content

        provider = GeminiProvider(
            api_key=FAKE_KEY,
            thinking="minimal",
            client=mock_client,
        )

        # Call 1: should attempt with minimal, catch error, retry without thinking config, and succeed
        res1 = await provider.extract(b"img", "image/png", "prompt", timeout=5.0)
        assert res1 == '{"version": 1, "kind": "geometry"}'
        assert len(calls) == 2
        # First attempt had thinking config
        assert calls[0]["config"].thinking_config is not None
        # Second attempt (retry) had no thinking config
        assert calls[0]["config"].thinking_config.thinking_level == types.ThinkingLevel.MINIMAL
        assert calls[1]["config"].thinking_config is None

        # Call 2: since process remembered the rejection, it should NOT send thinking_config at all
        res2 = await provider.extract(b"img", "image/png", "prompt", timeout=5.0)
        assert res2 == '{"version": 1, "kind": "geometry"}'
        assert len(calls) == 3
        assert calls[2]["config"].thinking_config is None

    asyncio.run(_run())


def test_gemini_provider_timeout_raises_vision_error() -> None:
    async def _run() -> None:
        mock_client = MagicMock()

        async def slow_call(*_args, **_kwargs) -> MagicMock:
            await asyncio.sleep(0.5)
            mock_resp = MagicMock()
            mock_resp.text = "{}"
            return mock_resp

        mock_client.aio.models.generate_content = slow_call

        provider = GeminiProvider(api_key=FAKE_KEY, client=mock_client)
        with pytest.raises(VisionError) as exc_info:
            await provider.extract(b"bytes", "image/png", "prompt", timeout=0.05)

        assert "timed out" in exc_info.value.reason

    asyncio.run(_run())


def test_gemini_provider_empty_reply_raises_vision_error() -> None:
    async def _run() -> None:
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = ""
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_resp)

        provider = GeminiProvider(api_key=FAKE_KEY, client=mock_client)
        with pytest.raises(VisionError) as exc_info:
            await provider.extract(b"bytes", "image/png", "prompt", timeout=5.0)

        assert "empty response" in exc_info.value.reason

    asyncio.run(_run())


def test_gemini_provider_complete_success() -> None:
    async def _run() -> None:
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = "AB is 5 cm long."
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_resp)

        provider = GeminiProvider(api_key=FAKE_KEY, client=mock_client)
        result = await provider.complete("What is AB?", timeout=5.0)

        assert result == "AB is 5 cm long."
        assert mock_client.aio.models.generate_content.called

    asyncio.run(_run())


def test_gemini_provider_complete_empty_reply_raises() -> None:
    async def _run() -> None:
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = "   "
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_resp)

        provider = GeminiProvider(api_key=FAKE_KEY, client=mock_client)
        with pytest.raises(VisionError) as exc_info:
            await provider.complete("prompt", timeout=5.0)

        assert "empty response" in exc_info.value.reason

    asyncio.run(_run())
