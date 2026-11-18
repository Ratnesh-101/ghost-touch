"""Tests for GET /api/v1/status and observability logging (Lane ux11).

Covers:
- Status endpoint shape and privacy (assert exact key set, leaks nothing)
- ai_available is False when no vision provider is configured
- ai_available is False when emergency kill switch is active (PAID_CALLS_PER_DAY=0)
- ai_available is True when provider configured and budget healthy
- commit hash from RENDER_GIT_COMMIT or "unknown"
- Rate limiting behavior (unthrottled GET like health)
- INFO line emitted for processed scene (caplog)
"""

from __future__ import annotations

import json
import logging
from typing import Any

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app, get_provider_chain
from app.paid_budget import reset_budget
from app.vision.base import VisionProvider
from app.vision.chain import ProviderChain


class MockVisionProvider(VisionProvider):
    """Mock provider for status and scene tests."""

    def __init__(self, name: str = "mock-provider") -> None:
        self._name = name

    @property
    def name(self) -> str:
        return self._name

    async def extract(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        *,
        timeout: float | None = None,
    ) -> str:
        return json.dumps(
            {
                "version": 1,
                "kind": "geometry",
                "title": "Triangle",
                "points": [
                    {"id": "A", "x": 0.1, "y": 0.9, "label": "A"},
                    {"id": "B", "x": 0.9, "y": 0.9, "label": "B"},
                    {"id": "C", "x": 0.5, "y": 0.1, "label": "C"},
                ],
                "segments": [
                    {"id": "AB", "a": "A", "b": "B"},
                    {"id": "BC", "a": "B", "b": "C"},
                    {"id": "CA", "a": "C", "b": "A"},
                ],
                "polylines": [],
                "bars": [],
                "axes": None,
                "facts": [],
            }
        )

    async def complete(self, prompt: str, *, timeout: float | None = None) -> str:
        return "mock answer"


def _make_test_png(width: int = 60, height: int = 60) -> bytes:
    img = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.rectangle(img, (5, 5), (width - 5, height - 5), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


# ===========================================================================
# Status endpoint tests
# ===========================================================================


def test_status_shape_and_leaks_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Status returns exactly {'commit', 'ai_available'} and leaks no internals or secrets."""
    monkeypatch.delenv("RENDER_GIT_COMMIT", raising=False)
    client = TestClient(app)

    resp = client.get("/api/v1/status")
    assert resp.status_code == 200

    data: dict[str, Any] = resp.json()

    # Exact key set assertion - leaks nothing
    assert set(data.keys()) == {"commit", "ai_available"}
    assert isinstance(data["commit"], str)
    assert isinstance(data["ai_available"], bool)

    # Explicit negative leak assertions
    for forbidden in (
        "api_key",
        "key",
        "secret",
        "token",
        "provider",
        "providers",
        "model",
        "models",
        "budget",
        "client_ip",
        "headers",
        "env",
    ):
        assert forbidden not in data


def test_status_commit_from_env_or_unknown(monkeypatch: pytest.MonkeyPatch) -> None:
    """commit comes from RENDER_GIT_COMMIT env var, or 'unknown' when unset or blank."""
    client = TestClient(app)

    # 1. When RENDER_GIT_COMMIT is set
    monkeypatch.setenv("RENDER_GIT_COMMIT", "7d4b912c")
    resp = client.get("/api/v1/status")
    assert resp.status_code == 200
    assert resp.json()["commit"] == "7d4b912c"

    # 2. When RENDER_GIT_COMMIT is unset
    monkeypatch.delenv("RENDER_GIT_COMMIT", raising=False)
    resp = client.get("/api/v1/status")
    assert resp.status_code == 200
    assert resp.json()["commit"] == "unknown"

    # 3. When RENDER_GIT_COMMIT is empty or whitespace
    monkeypatch.setenv("RENDER_GIT_COMMIT", "   ")
    resp = client.get("/api/v1/status")
    assert resp.status_code == 200
    assert resp.json()["commit"] == "unknown"


def test_status_ai_available_false_with_no_provider() -> None:
    """ai_available is False when chain has zero configured vision providers."""
    empty_chain = ProviderChain([])
    app.dependency_overrides[get_provider_chain] = lambda: empty_chain

    try:
        client = TestClient(app)
        resp = client.get("/api/v1/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ai_available"] is False
    finally:
        app.dependency_overrides.clear()


def test_status_ai_available_false_with_kill_switch(monkeypatch: pytest.MonkeyPatch) -> None:
    """ai_available is False when emergency kill switch is active (PAID_CALLS_PER_DAY=0)."""
    monkeypatch.setenv("PAID_CALLS_PER_DAY", "0")
    reset_budget()

    mock_chain = ProviderChain([MockVisionProvider()])
    app.dependency_overrides[get_provider_chain] = lambda: mock_chain

    try:
        client = TestClient(app)
        resp = client.get("/api/v1/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ai_available"] is False
    finally:
        reset_budget()
        app.dependency_overrides.clear()


def test_status_ai_available_true_when_healthy(monkeypatch: pytest.MonkeyPatch) -> None:
    """ai_available is True when provider exists and daily budget is available."""
    monkeypatch.setenv("PAID_CALLS_PER_DAY", "2000")
    reset_budget()

    mock_chain = ProviderChain([MockVisionProvider()])
    app.dependency_overrides[get_provider_chain] = lambda: mock_chain

    try:
        client = TestClient(app)
        resp = client.get("/api/v1/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ai_available"] is True
    finally:
        reset_budget()
        app.dependency_overrides.clear()


def test_status_rate_limited_like_health() -> None:
    """GET /api/v1/status is a lightweight GET probe, rate-limited like /api/v1/health."""
    client = TestClient(app)

    # 10 rapid GET requests all succeed without 429
    for _ in range(10):
        resp = client.get("/api/v1/status")
        assert resp.status_code == 200


# ===========================================================================
# Observability / logging tests
# ===========================================================================


def test_info_line_emitted_for_processed_scene(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Lifespan configures logging.getLogger('app') to INFO and emits an INFO log on scene processing."""
    caplog.set_level(logging.INFO)

    monkeypatch.setenv("PAID_CALLS_PER_DAY", "2000")
    reset_budget()

    mock_chain = ProviderChain([MockVisionProvider()])
    app.dependency_overrides[get_provider_chain] = lambda: mock_chain

    try:
        # with TestClient(app) enters the lifespan context manager
        with TestClient(app) as client:
            img_bytes = _make_test_png(80, 80)
            files = {"image": ("test.png", img_bytes, "image/png")}
            resp = client.post("/api/v1/scene", files=files)
            assert resp.status_code == 200

            # Verify an INFO line with 'scene processed:' is emitted
            scene_logs = [
                rec
                for rec in caplog.records
                if rec.levelno == logging.INFO and "scene processed:" in rec.message
            ]
            assert len(scene_logs) >= 1
            log_record = scene_logs[0]
            assert "mode=ai" in log_record.message or "mode=raw" in log_record.message
            assert "elapsed_ms=" in log_record.message
    finally:
        reset_budget()
        app.dependency_overrides.clear()
