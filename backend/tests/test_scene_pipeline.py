"""End-to-end tests for POST /api/v1/scene pipeline (Tasks 8.1, 8.2, 8.4, 8.5).

All tests use fake providers or dependency overrides: zero network calls, zero secrets.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Generator
from typing import Any

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app._temp.validate_stub import ValidationResult
from app.main import app, get_provider_chain, get_validator
from app.schema import DiagramScene
from app.vision.base import VisionError
from app.vision.chain import ProviderChain

VALID_SCENE_DICT: dict[str, Any] = {
    "version": 1,
    "kind": "geometry",
    "title": "Right Triangle",
    "points": [
        {"id": "p1", "x": 0.2, "y": 0.8, "label": "vertex A"},
        {"id": "p2", "x": 0.8, "y": 0.8, "label": "vertex B"},
        {"id": "p3", "x": 0.8, "y": 0.2, "label": "vertex C"},
    ],
    "segments": [
        {"id": "s1", "a": "p1", "b": "p2", "label": "base AB"},
        {"id": "s2", "a": "p2", "b": "p3", "label": "height BC"},
        {"id": "s3", "a": "p1", "b": "p3", "label": "hypotenuse AC"},
    ],
    "polylines": [],
    "bars": [],
    "axes": None,
    "facts": ["angle B = 90°", "AB = 3 cm", "BC = 4 cm"],
}
VALID_SCENE_JSON = json.dumps(VALID_SCENE_DICT)


def make_test_image_bytes(width: int = 100, height: int = 100) -> bytes:
    img = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.rectangle(img, (10, 10), (80, 80), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


class FakeProvider:
    def __init__(
        self,
        name: str,
        responses: list[str | Exception],
        delay: float = 0.0,
    ) -> None:
        self.name = name
        self.responses = list(responses)
        self.delay = delay
        self.prompts_received: list[str] = []
        self.call_count = 0

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        self.call_count += 1
        self.prompts_received.append(prompt)
        if self.delay > 0:
            await asyncio.sleep(self.delay)

        if not self.responses:
            raise VisionError(self.name, "No more canned responses")

        resp = self.responses.pop(0)
        if isinstance(resp, Exception):
            raise resp
        return resp


@pytest.fixture(autouse=True)
def clean_overrides() -> Generator[None, None, None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# --- 1. Basic AI and Header Tests ---


def test_pipeline_valid_json_returns_ai_mode(client: TestClient) -> None:
    provider = FakeProvider("gemini", [VALID_SCENE_JSON])
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "ai"
    assert data["scene"]["kind"] == "geometry"
    assert response.headers["X-Vision-Provider"] == "gemini"


def test_pipeline_fenced_json_is_accepted(client: TestClient) -> None:
    fenced = f"```json\n{VALID_SCENE_JSON}\n```"
    provider = FakeProvider("nvidia", [fenced])
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "ai"
    assert response.headers["X-Vision-Provider"] == "nvidia"


# --- 2. Fallback Chain in Route ---


def test_pipeline_first_fails_fallback_to_nvidia(client: TestClient) -> None:
    gemini = FakeProvider("gemini", [VisionError("gemini", "503 high demand")])
    nvidia = FakeProvider("nvidia", [VALID_SCENE_JSON])
    chain = ProviderChain([gemini, nvidia])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "ai"
    assert response.headers["X-Vision-Provider"] == "nvidia"
    assert gemini.call_count == 1
    assert nvidia.call_count == 1


def test_pipeline_all_providers_fail_returns_raw_mode(client: TestClient) -> None:
    gemini = FakeProvider("gemini", [VisionError("gemini", "429 quota")])
    nvidia = FakeProvider("nvidia", [VisionError("nvidia", "timeout")])
    chain = ProviderChain([gemini, nvidia])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "raw"
    assert data["reason"] == "provider_error"


def test_pipeline_zero_providers_returns_raw_mode_no_provider(client: TestClient) -> None:
    chain = ProviderChain([])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "raw"
    assert data["reason"] == "no_provider"
    assert response.headers["X-Vision-Provider"] == "none"


# --- 3. Retry Logic & Validation ---


def test_pipeline_invalid_then_valid_on_retry(client: TestClient) -> None:
    invalid_json = '{"version": 1, "kind": "geometry", "points": "not a list"}'
    provider = FakeProvider("gemini", [invalid_json, VALID_SCENE_JSON])
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "ai"
    assert provider.call_count == 2
    # Second prompt must contain retry error feedback
    assert "Your previous JSON was invalid:" in provider.prompts_received[1]


def test_pipeline_invalid_twice_falls_back_to_raw(client: TestClient) -> None:
    invalid_json = '{"version": 1, "kind": "geometry", "points": "bad"}'
    provider = FakeProvider("gemini", [invalid_json, invalid_json])
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "raw"
    assert data["reason"] == "invalid"
    assert provider.call_count == 2


def test_pipeline_garbage_non_json_falls_back_to_raw(client: TestClient) -> None:
    garbage = "I am an AI and cannot process this diagram."
    provider = FakeProvider("gemini", [garbage, garbage])
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "raw"
    assert data["reason"] == "invalid"


# --- 4. Vocabulary Check Retry with Fake Validator ---


def test_pipeline_vocabulary_rule_retry_succeeds(client: TestClient) -> None:
    """Fake validator rejects appearance-only label ('blue polygon'), then accepts corrected scene."""
    bad_scene_dict = dict(VALID_SCENE_DICT)
    bad_scene_dict["segments"] = [
        {"id": "s1", "a": "p1", "b": "p2", "label": "blue polygon"},
        {"id": "s2", "a": "p2", "b": "p3", "label": "height BC"},
        {"id": "s3", "a": "p1", "b": "p3", "label": "hypotenuse AC"},
    ]
    bad_json = json.dumps(bad_scene_dict)

    call_index = 0

    def fake_validator(raw: str | dict[str, Any]) -> ValidationResult:
        nonlocal call_index
        call_index += 1
        data = json.loads(raw) if isinstance(raw, str) else raw
        # Check for "blue polygon"
        labels = [s.get("label") for s in data.get("segments", [])]
        if "blue polygon" in labels:
            return ValidationResult(
                scene=None,
                errors=[
                    "segment s1: label 'blue polygon' describes appearance, not a teacher term"
                ],
            )
        scene = DiagramScene.model_validate(data)
        return ValidationResult(scene=scene, errors=[])

    provider = FakeProvider("gemini", [bad_json, VALID_SCENE_JSON])
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain
    app.dependency_overrides[get_validator] = lambda: fake_validator

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "ai"
    assert provider.call_count == 2
    assert "blue polygon" in provider.prompts_received[1]


def test_pipeline_vocabulary_rule_fails_twice_returns_raw(client: TestClient) -> None:
    bad_scene_dict = dict(VALID_SCENE_DICT)
    bad_scene_dict["segments"] = [
        {"id": "s1", "a": "p1", "b": "p2", "label": "blue polygon"},
    ]
    bad_json = json.dumps(bad_scene_dict)

    def fake_validator(raw: str | dict[str, Any]) -> ValidationResult:
        data = json.loads(raw) if isinstance(raw, str) else raw
        labels = [s.get("label") for s in data.get("segments", [])]
        if "blue polygon" in labels:
            return ValidationResult(
                scene=None,
                errors=[
                    "segment s1: label 'blue polygon' describes appearance, not a teacher term"
                ],
            )
        scene = DiagramScene.model_validate(data)
        return ValidationResult(scene=scene, errors=[])

    provider = FakeProvider("gemini", [bad_json, bad_json])
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain
    app.dependency_overrides[get_validator] = lambda: fake_validator

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "raw"
    assert data["reason"] == "invalid"


# --- 5. Timeout Handling ---


def test_pipeline_provider_timeout_falls_back_to_raw(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Short total deadline
    monkeypatch.setenv("SCENE_TIMEOUT_SECONDS", "0.2")

    provider = FakeProvider("gemini", [VALID_SCENE_JSON], delay=0.5)
    chain = ProviderChain([provider], call_timeout=0.4)
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "raw"
    assert data["reason"] == "timeout"


# --- 6. Upload Validation (413, 415, 422) ---


def test_pipeline_unsupported_media_type_returns_415(client: TestClient) -> None:
    files = {"image": ("diagram.pdf", b"%PDF-1.4...", "application/pdf")}
    response = client.post("/api/v1/scene", files=files)
    assert response.status_code == 415
    assert "Unsupported image format" in response.json()["detail"]


def test_pipeline_oversized_upload_returns_413(client: TestClient) -> None:
    oversized_data = b"x" * (10 * 1024 * 1024 + 100)
    files = {"image": ("big.png", oversized_data, "image/png")}
    response = client.post("/api/v1/scene", files=files)
    assert response.status_code == 413
    assert "exceeds 10 MB limit" in response.json()["detail"]


def test_pipeline_empty_upload_returns_422(client: TestClient) -> None:
    files = {"image": ("empty.png", b"", "image/png")}
    response = client.post("/api/v1/scene", files=files)
    assert response.status_code == 422
