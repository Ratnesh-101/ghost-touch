"""OpenAIProvider tests: mock HTTP transport only, no network, no real key."""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from app.vision import build_chain_from_env
from app.vision.base import VisionError
from app.vision.openai_provider import DEFAULT_MODEL, OpenAIProvider

FAKE_KEY = "sk-test-fake-key-1234567890abcdef"


def _client(handler: Any) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _ok(text: str) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": text}}]})


@pytest.mark.anyio
async def test_extract_sends_image_json_mode_and_bearer_header() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers.get("authorization")
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return _ok('{"kind": "geometry"}')

    provider = OpenAIProvider(api_key=FAKE_KEY, client=_client(handler))
    text = await provider.extract(b"\x89PNGfake", "image/png", "Return JSON", timeout=5)

    assert text == '{"kind": "geometry"}'
    assert seen["auth"] == f"Bearer {FAKE_KEY}"
    assert seen["url"] == "https://api.openai.com/v1/chat/completions"
    body = seen["body"]
    assert body["model"] == DEFAULT_MODEL == "gpt-4.1-mini"
    assert body["response_format"] == {"type": "json_object"}
    assert body["temperature"] == 0
    assert body["max_completion_tokens"] == 4096
    parts = body["messages"][0]["content"]
    assert parts[0] == {"type": "text", "text": "Return JSON"}
    assert parts[1]["image_url"]["url"].startswith("data:image/png;base64,")
    assert parts[1]["image_url"]["detail"] == "high"


@pytest.mark.anyio
async def test_extract_unwraps_a_fenced_reply() -> None:
    provider = OpenAIProvider(
        api_key=FAKE_KEY, client=_client(lambda r: _ok('```json\n{"kind": "unknown"}\n```'))
    )
    assert await provider.extract(b"x", "image/jpeg", "p", timeout=5) == '{"kind": "unknown"}'


@pytest.mark.anyio
async def test_reasoning_models_get_no_temperature_and_a_larger_token_cap() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return _ok("{}")

    provider = OpenAIProvider(api_key=FAKE_KEY, model="gpt-5.4-mini", client=_client(handler))
    await provider.extract(b"x", "image/jpeg", "p", timeout=5)
    assert "temperature" not in seen["body"]
    assert seen["body"]["max_completion_tokens"] == 16384


@pytest.mark.anyio
async def test_complete_is_text_only_without_json_mode() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return _ok("  AB = 5 cm.  ")

    provider = OpenAIProvider(api_key=FAKE_KEY, client=_client(handler))
    assert await provider.complete("How long is AB?", timeout=5) == "AB = 5 cm."
    assert seen["body"]["messages"] == [{"role": "user", "content": "How long is AB?"}]
    assert "response_format" not in seen["body"]


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("status", "needle"),
    [(429, "rate limited"), (401, "authentication failed"), (500, "server error")],
)
async def test_http_errors_become_vision_errors(status: int, needle: str) -> None:
    provider = OpenAIProvider(
        api_key=FAKE_KEY, client=_client(lambda r: httpx.Response(status, text="nope"))
    )
    with pytest.raises(VisionError) as info:
        await provider.extract(b"x", "image/jpeg", "p", timeout=5)
    assert info.value.provider == "openai"
    assert needle in info.value.reason


@pytest.mark.anyio
@pytest.mark.parametrize(
    "payload",
    [{"choices": []}, {"choices": [{"message": {"content": "  "}}]}, {"choices": [1]}, []],
)
async def test_malformed_or_empty_replies_raise(payload: Any) -> None:
    provider = OpenAIProvider(
        api_key=FAKE_KEY, client=_client(lambda r: httpx.Response(200, json=payload))
    )
    with pytest.raises(VisionError):
        await provider.complete("hi", timeout=5)


@pytest.mark.anyio
async def test_timeout_and_connection_errors_never_leak_the_key() -> None:
    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"cannot reach server with {FAKE_KEY}", request=request)

    with pytest.raises(VisionError) as slow:
        await OpenAIProvider(api_key=FAKE_KEY, client=_client(timeout)).complete("p", timeout=1)
    assert "timed out" in slow.value.reason

    with pytest.raises(VisionError) as down:
        await OpenAIProvider(api_key=FAKE_KEY, client=_client(boom)).complete("p", timeout=1)
    assert FAKE_KEY not in str(down.value)
    assert "[REDACTED]" in down.value.reason


@pytest.mark.anyio
async def test_error_body_echoing_the_key_is_redacted() -> None:
    provider = OpenAIProvider(
        api_key=FAKE_KEY,
        client=_client(lambda r: httpx.Response(400, text=f"bad key {FAKE_KEY} supplied")),
    )
    with pytest.raises(VisionError) as info:
        await provider.complete("p", timeout=1)
    assert FAKE_KEY not in str(info.value)


@pytest.mark.anyio
async def test_missing_key_is_a_clean_error_and_makes_no_request() -> None:
    def never(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request should be sent without a key")

    provider = OpenAIProvider(api_key="", client=_client(never))
    with pytest.raises(VisionError, match="API key not configured"):
        await provider.extract(b"x", "image/jpeg", "p", timeout=1)


def test_model_and_base_url_come_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", FAKE_KEY)
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-nano")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://example.test/v1/")
    provider = OpenAIProvider()
    assert provider.model == "gpt-5.4-nano"
    assert provider.base_url == "https://example.test/v1"


def test_empty_model_setting_falls_back_to_the_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_MODEL", "   ")
    assert OpenAIProvider(api_key=FAKE_KEY).model == DEFAULT_MODEL


# --- the chain order: Gemini, then OpenAI, then Nebius (last) -------------------------------


def _clear_provider_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "GEMINI_API_KEY",
        "OPENAI_API_KEY",
        "NEBIUS_API_KEY",
        "VISION_PROVIDERS",
    ):
        monkeypatch.delenv(name, raising=False)


def test_default_order_is_gemini_then_openai_then_nebius(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_provider_env(monkeypatch)
    for name in ("GEMINI_API_KEY", "OPENAI_API_KEY", "NEBIUS_API_KEY"):
        monkeypatch.setenv(name, "fake-key-for-test")
    chain = build_chain_from_env()
    assert [p.name for p in chain.providers] == ["gemini", "openai", "nebius"]


def test_providers_without_keys_are_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_provider_env(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY", "fake-key-for-test")
    monkeypatch.setenv("NEBIUS_API_KEY", "fake-key-for-test")
    assert [p.name for p in build_chain_from_env().providers] == ["openai", "nebius"]


def test_explicit_order_is_respected(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_provider_env(monkeypatch)
    for name in ("GEMINI_API_KEY", "OPENAI_API_KEY", "NEBIUS_API_KEY"):
        monkeypatch.setenv(name, "fake-key-for-test")
    monkeypatch.setenv("VISION_PROVIDERS", "nebius,openai")
    assert [p.name for p in build_chain_from_env().providers] == ["nebius", "openai"]
