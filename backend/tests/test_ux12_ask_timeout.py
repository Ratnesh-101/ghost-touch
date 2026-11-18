"""Tests for ask timeout budget capping (Lane UX12).

Verifies: one slow provider must not be everyone's outage.
Per-call timeout passed to chain.complete is min(chain.call_timeout, total_budget * 0.55).
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.ask import AskRequest, answer_question
from app.main import app, get_provider_chain
from app.schema import DiagramScene
from app.vision.base import VisionError
from app.vision.chain import ProviderChain
from fixtures.triangle import triangle_scene


class RecordingFakeProvider:
    """Fake provider that records timeouts and can simulate slowness/timeouts."""

    def __init__(
        self,
        name: str,
        answer: str | None = None,
        fail_on_timeout: float | None = None,
        raise_exc: Exception | None = None,
    ) -> None:
        self.name = name
        self.answer = answer or "The answer is 42."
        self.fail_on_timeout = fail_on_timeout
        self.raise_exc = raise_exc
        self.timeouts_received: list[float] = []
        self.prompts_received: list[str] = []
        self.call_count: int = 0

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        raise NotImplementedError("extract not used in ask timeout tests")

    async def complete(self, prompt: str, *, timeout: float) -> str:
        self.call_count += 1
        self.timeouts_received.append(timeout)
        self.prompts_received.append(prompt)

        if self.raise_exc is not None:
            raise self.raise_exc

        if self.fail_on_timeout is not None and timeout <= self.fail_on_timeout:
            raise VisionError(
                self.name,
                f"request timed out after {timeout:.1f}s",
                transient=False,
            )

        return self.answer


@pytest.fixture
def triangle() -> DiagramScene:
    return triangle_scene()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_ask_slow_first_healthy_second_answers_within_budget(triangle: DiagramScene) -> None:
    """Slow first provider times out within per-call cap; healthy second provider answers."""

    async def _run() -> None:
        # total_budget = 10.0s. chain.call_timeout = 8.0s.
        # Cap is min(8.0, 10.0 * 0.55) = 5.5s.
        p1 = RecordingFakeProvider(
            "slow_provider",
            fail_on_timeout=5.5,
        )
        p2 = RecordingFakeProvider(
            "healthy_provider",
            answer="The hypotenuse AB is 5 cm long.",
        )

        chain = ProviderChain([p1, p2], call_timeout=8.0)
        request = AskRequest(
            scene=triangle,
            question="What is the length of AB?",
            lang="en",
        )

        resp = await answer_question(request, chain, timeout=10.0)

        assert resp.source == "ai"
        assert "5 cm" in resp.answer
        assert p1.call_count == 1
        assert len(p1.timeouts_received) == 1
        # Provider 1 per-call cap was bounded to 55% of 10.0s budget (5.5s)
        assert pytest.approx(p1.timeouts_received[0], rel=1e-3) == 5.5
        assert p2.call_count == 1

    asyncio.run(_run())


def test_ask_per_call_timeout_cap_formula(triangle: DiagramScene) -> None:
    """Verify timeout=min(chain.call_timeout, total_budget * 0.55) under various settings."""

    async def _run() -> None:
        # Case A: chain.call_timeout (4.0) < budget * 0.55 (5.5) -> cap is 4.0
        p_fast_cap = RecordingFakeProvider("provider_a", answer="Answer A")
        chain_a = ProviderChain([p_fast_cap], call_timeout=4.0)
        req = AskRequest(scene=triangle, question="Length of AB?", lang="en")
        await answer_question(req, chain_a, timeout=10.0)
        assert pytest.approx(p_fast_cap.timeouts_received[0], rel=1e-3) == 4.0

        # Case B: budget * 0.55 (6.0 * 0.55 = 3.3) < chain.call_timeout (8.0) -> cap is 3.3
        p_budget_cap = RecordingFakeProvider("provider_b", answer="Answer B")
        chain_b = ProviderChain([p_budget_cap], call_timeout=8.0)
        await answer_question(req, chain_b, timeout=6.0)
        assert pytest.approx(p_budget_cap.timeouts_received[0], rel=1e-3) == 3.3

    asyncio.run(_run())


def test_ask_route_slow_provider_fallback_to_second(
    client: TestClient,
    triangle: DiagramScene,
) -> None:
    """HTTP POST /api/v1/ask succeeds when first provider times out and second succeeds."""
    p1 = RecordingFakeProvider("slow_provider", fail_on_timeout=5.5)
    p2 = RecordingFakeProvider("healthy_provider", answer="The hypotenuse AB is 5 cm long.")
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([p1, p2], call_timeout=8.0)

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "What is the length of AB?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data: dict[str, Any] = resp.json()
        assert data["source"] == "ai"
        assert "5 cm" in data["answer"]
        assert p1.call_count == 1
        assert p2.call_count == 1
    finally:
        app.dependency_overrides.clear()
