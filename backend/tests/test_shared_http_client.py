"""Tests for shared httpx.AsyncClient management and lifecycle (audit SEC-10).

Verifies lazy initialization, instance reuse, preservation of injected clients,
retention across calls, and shutdown cleanup. All HTTP interactions use MockTransport.
"""

from __future__ import annotations

import httpx
import pytest

from app.main import app
from app.vision._openai_compat import (
    close_shared_client,
    get_shared_client,
    post_chat_completion,
    set_shared_client,
)

FAKE_API_KEY = "sk-test-shared-client-key-9876543210"


@pytest.mark.anyio
async def test_getter_returns_same_instance_twice() -> None:
    """The shared client getter lazily initializes and returns the same instance on repeat calls."""
    await close_shared_client()
    try:
        client1 = get_shared_client()
        client2 = get_shared_client()
        assert client1 is client2
        assert not client1.is_closed
    finally:
        await close_shared_client()


@pytest.mark.anyio
async def test_injected_client_is_used_and_not_closed() -> None:
    """An injected client is used for the request and is never closed by post_chat_completion."""
    called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        assert request.headers.get("authorization") == f"Bearer {FAKE_API_KEY}"
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"kind": "geometry"}'}}]},
        )

    injected = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    try:
        reply = await post_chat_completion(
            name="openai",
            base_url="https://api.openai.com/v1",
            api_key=FAKE_API_KEY,
            body={"model": "gpt-4.1-mini", "messages": []},
            timeout=5.0,
            client=injected,
        )
        assert reply == '{"kind": "geometry"}'
        assert called is True
        assert not injected.is_closed
    finally:
        await injected.aclose()


@pytest.mark.anyio
async def test_shared_client_is_not_closed_after_a_call() -> None:
    """When no client is passed, the shared client is used and remains open after the call finishes."""
    called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        assert request.headers.get("authorization") == f"Bearer {FAKE_API_KEY}"
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "shared provider response"}}]},
        )

    await close_shared_client()
    # Install a mock-transport client as the shared client to prevent real network calls
    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    set_shared_client(mock_client)

    try:
        reply = await post_chat_completion(
            name="openai",
            base_url="https://api.openai.com/v1",
            api_key=FAKE_API_KEY,
            body={"model": "gpt-4.1-mini", "messages": []},
            timeout=5.0,
            client=None,
        )
        assert reply == "shared provider response"
        assert called is True
        # Shared client must stay open for subsequent reuse
        shared = get_shared_client()
        assert shared is mock_client
        assert not shared.is_closed
    finally:
        await close_shared_client()


@pytest.mark.anyio
async def test_shutdown_helper_closes_client_and_later_getter_makes_fresh_one() -> None:
    """close_shared_client shuts down the active client; subsequent get_shared_client creates a fresh one."""
    await close_shared_client()
    try:
        initial = get_shared_client()
        assert not initial.is_closed

        await close_shared_client()
        assert initial.is_closed

        fresh = get_shared_client()
        assert fresh is not initial
        assert not fresh.is_closed
    finally:
        await close_shared_client()


@pytest.mark.anyio
async def test_app_lifespan_closes_shared_client() -> None:
    """FastAPI application lifespan shutdown hook cleanly closes the process-wide shared client."""
    await close_shared_client()
    client = get_shared_client()
    assert not client.is_closed

    async with app.router.lifespan_context(app):
        # Client remains usable during lifespan
        assert not client.is_closed

    # Once lifespan exits, shared client is closed
    assert client.is_closed

    # Subsequent getter invocation spawns a fresh unclosed instance
    fresh = get_shared_client()
    try:
        assert fresh is not client
        assert not fresh.is_closed
    finally:
        await close_shared_client()
