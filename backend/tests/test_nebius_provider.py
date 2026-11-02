"""Tests for the Nebius provider and the default provider order (no network, no real keys)."""

from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
import pytest

from app.vision import DEFAULT_PROVIDER_ORDER, build_chain_from_env
from app.vision.base import VisionError
from app.vision.nebius import DEFAULT_BASE_URL, DEFAULT_MODEL, NebiusProvider

FAKE_KEY = "fake-nebius-key-1234567890abcdef"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


def _reply(content: str, status: int = 200) -> httpx.Response:
    return httpx.Response(status, json={"choices": [{"message": {"content": content}}]})


def _run_extract(handler: Any) -> str:
    async def go() -> str:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = NebiusProvider(api_key=FAKE_KEY, client=client)
            return await provider.extract(PNG, "image/png", "prompt", timeout=5.0)

    return asyncio.run(go())


def test_extract_sends_openai_style_request_and_strips_fences() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return _reply('```json\n{"kind": "unknown"}\n```')

    text = _run_extract(handler)

    assert text == '{"kind": "unknown"}'
    assert seen["url"] == f"{DEFAULT_BASE_URL}/chat/completions"
    assert seen["auth"] == f"Bearer {FAKE_KEY}"
    assert seen["body"]["model"] == DEFAULT_MODEL
    parts = seen["body"]["messages"][0]["content"]
    assert parts[0] == {"type": "text", "text": "prompt"}
    assert parts[1]["image_url"]["url"].startswith("data:image/png;base64,")


def test_complete_is_text_only() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return _reply("  three centimetres  ")

    async def go() -> str:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = NebiusProvider(api_key=FAKE_KEY, client=client)
            return await provider.complete("How long is AB?", timeout=5.0)

    answer = asyncio.run(go())

    assert answer == "three centimetres"
    assert seen["body"]["messages"][0]["content"] == "How long is AB?"


def test_auth_failure_never_leaks_the_key() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, text=f"bad token {FAKE_KEY}")

    with pytest.raises(VisionError) as exc_info:
        _run_extract(handler)

    message = str(exc_info.value)
    assert FAKE_KEY not in message
    assert "401" in message


@pytest.mark.parametrize("status", [429, 500, 503])
def test_rate_limit_and_server_errors_become_vision_errors(status: int) -> None:
    with pytest.raises(VisionError):
        _run_extract(lambda request: httpx.Response(status, text="nope"))


def test_missing_key_raises_without_a_request() -> None:
    provider = NebiusProvider(api_key="")
    with pytest.raises(VisionError, match="not configured"):
        asyncio.run(provider.complete("hi", timeout=1.0))


def test_model_and_base_url_come_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NEBIUS_MODEL", "some/other-vl-model")
    monkeypatch.setenv("NEBIUS_BASE_URL", "https://example.test/v1/")
    provider = NebiusProvider(api_key=FAKE_KEY)
    assert provider.model == "some/other-vl-model"
    assert provider.base_url == "https://example.test/v1"


def test_default_order_puts_nebius_last_and_drops_nvidia(monkeypatch: pytest.MonkeyPatch) -> None:
    assert DEFAULT_PROVIDER_ORDER == "gemini,openai,nebius"
    monkeypatch.delenv("VISION_PROVIDERS", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "g")
    monkeypatch.setenv("OPENAI_API_KEY", "o")
    monkeypatch.setenv("NEBIUS_API_KEY", "n")
    monkeypatch.setenv("NVIDIA_API_KEY", "v")

    names = [p.name for p in build_chain_from_env().providers]

    assert names == ["gemini", "openai", "nebius"]


def test_providers_without_keys_are_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VISION_PROVIDERS", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("NEBIUS_API_KEY", "n")

    assert [p.name for p in build_chain_from_env().providers] == ["nebius"]


def test_nvidia_still_works_when_listed_explicitly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VISION_PROVIDERS", "nebius,nvidia")
    monkeypatch.setenv("NEBIUS_API_KEY", "n")
    monkeypatch.setenv("NVIDIA_API_KEY", "v")

    assert [p.name for p in build_chain_from_env().providers] == ["nebius", "nvidia"]
