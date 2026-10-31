"""Tests for ProviderChain and build_chain_from_env (Task 8.1)."""

from __future__ import annotations

import asyncio

import pytest

from app.vision import build_chain_from_env
from app.vision.base import VisionError
from app.vision.chain import ProviderChain


class MockProvider:
    def __init__(self, name: str, return_value: str | None = None, fail: bool = False) -> None:
        self.name = name
        self.return_value = return_value or '{"version": 1, "kind": "unknown"}'
        self.fail = fail
        self.call_count = 0

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        self.call_count += 1
        if self.fail:
            raise VisionError(self.name, f"{self.name} simulated failure")
        return self.return_value


def test_chain_first_provider_succeeds_second_never_called() -> None:
    async def _run() -> None:
        p1 = MockProvider("gemini", '{"kind": "geometry"}')
        p2 = MockProvider("nvidia", '{"kind": "bar_chart"}')
        chain = ProviderChain([p1, p2])

        raw, used = await chain.extract(b"img", "image/png", "prompt")
        assert raw == '{"kind": "geometry"}'
        assert used == "gemini"
        assert p1.call_count == 1
        assert p2.call_count == 0

    asyncio.run(_run())


def test_chain_first_fails_second_succeeds() -> None:
    async def _run() -> None:
        p1 = MockProvider("gemini", fail=True)
        p2 = MockProvider("nvidia", '{"kind": "bar_chart"}')
        chain = ProviderChain([p1, p2])

        raw, used = await chain.extract(b"img", "image/png", "prompt")
        assert raw == '{"kind": "bar_chart"}'
        assert used == "nvidia"
        assert p1.call_count == 1
        assert p2.call_count == 1

    asyncio.run(_run())


def test_chain_all_fail_raises_vision_error() -> None:
    async def _run() -> None:
        p1 = MockProvider("gemini", fail=True)
        p2 = MockProvider("nvidia", fail=True)
        chain = ProviderChain([p1, p2])

        with pytest.raises(VisionError) as exc_info:
            await chain.extract(b"img", "image/png", "prompt")

        assert exc_info.value.provider == "chain"
        assert p1.call_count == 1
        assert p2.call_count == 1

    asyncio.run(_run())


def test_build_chain_from_env_missing_keys_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VISION_PROVIDERS", "gemini,nvidia")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)

    chain = build_chain_from_env()
    assert len(chain.providers) == 0
