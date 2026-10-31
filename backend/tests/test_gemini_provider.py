"""Tests for GeminiProvider (Task 8.1)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.vision.base import VisionError
from app.vision.gemini import GeminiProvider

FAKE_KEY = "mock-gemini-api-key-test-12345"


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
            await provider.complete("What is AB?", timeout=5.0)

        assert "empty response" in exc_info.value.reason

    asyncio.run(_run())
