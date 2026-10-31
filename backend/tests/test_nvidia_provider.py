"""Tests for NvidiaProvider against httpx.MockTransport (Task 8.1)."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app.vision.base import VisionError
from app.vision.nvidia import NvidiaProvider

FAKE_KEY = "mock-nvidia-api-key-test-12345"


def test_nvidia_provider_success_and_bearer_header() -> None:
    captured_request: httpx.Request | None = None

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_request
        captured_request = request
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": '{"version": 1, "kind": "unknown"}',
                        }
                    }
                ]
            },
        )

    async def _run() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            provider = NvidiaProvider(api_key=FAKE_KEY, client=client)
            result = await provider.extract(
                b"fake-image-bytes", "image/png", "Test prompt", timeout=5.0
            )

        assert captured_request is not None
        assert captured_request.headers.get("Authorization") == f"Bearer {FAKE_KEY}"
        body = json.loads(captured_request.content.decode("utf-8"))
        assert body["messages"][0]["content"][0]["type"] == "text"
        assert body["messages"][0]["content"][1]["type"] == "image_url"
        assert result == '{"version": 1, "kind": "unknown"}'

    asyncio.run(_run())


def test_nvidia_provider_unwraps_fenced_reply() -> None:
    fenced_content = """```json
{"version": 1, "kind": "geometry"}
```"""

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"role": "assistant", "content": fenced_content}}]},
        )

    async def _run() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            provider = NvidiaProvider(api_key=FAKE_KEY, client=client)
            result = await provider.extract(
                b"fake-image", "image/png", "Extract prompt", timeout=5.0
            )

        assert result == '{"version": 1, "kind": "geometry"}'
        assert not result.startswith("```")

    asyncio.run(_run())


def test_nvidia_provider_rate_limit_429() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": "Rate limit exceeded"})

    async def _run() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            provider = NvidiaProvider(api_key=FAKE_KEY, client=client)
            with pytest.raises(VisionError) as exc_info:
                await provider.extract(b"image", "image/png", "prompt", timeout=5.0)

        assert "429" in exc_info.value.reason
        assert FAKE_KEY not in str(exc_info.value)

    asyncio.run(_run())


def test_nvidia_provider_empty_choices() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": []})

    async def _run() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            provider = NvidiaProvider(api_key=FAKE_KEY, client=client)
            with pytest.raises(VisionError) as exc_info:
                await provider.extract(b"image", "image/png", "prompt", timeout=5.0)

        assert "empty choices" in exc_info.value.reason
        assert FAKE_KEY not in str(exc_info.value)

    asyncio.run(_run())


def test_nvidia_provider_key_never_appears_in_error_text() -> None:
    secret_key = "mock-nvidia-very-secret-token-xyz"

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, text=f"Unauthorized: token {secret_key} invalid or expired")

    async def _run() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            provider = NvidiaProvider(api_key=secret_key, client=client)
            with pytest.raises(VisionError) as exc_info:
                await provider.extract(b"image", "image/png", "prompt", timeout=5.0)

        error_str = str(exc_info.value)
        assert secret_key not in error_str
        assert "[REDACTED]" in error_str

    asyncio.run(_run())


def test_nvidia_provider_complete_success() -> None:
    captured_request: httpx.Request | None = None

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_request
        captured_request = request
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "AB is 5 cm.",
                        }
                    }
                ]
            },
        )

    async def _run() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            provider = NvidiaProvider(api_key=FAKE_KEY, client=client)
            result = await provider.complete("What is AB?", timeout=5.0)

        assert captured_request is not None
        assert captured_request.headers.get("Authorization") == f"Bearer {FAKE_KEY}"
        body = json.loads(captured_request.content.decode("utf-8"))
        assert body["messages"][0]["content"] == "What is AB?"
        assert result == "AB is 5 cm."

    asyncio.run(_run())


def test_nvidia_provider_complete_empty_content_raises() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"role": "assistant", "content": "   "}}]},
        )

    async def _run() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            provider = NvidiaProvider(api_key=FAKE_KEY, client=client)
            with pytest.raises(VisionError) as exc_info:
                await provider.complete("What is AB?", timeout=5.0)

        assert "empty content" in exc_info.value.reason

    asyncio.run(_run())
