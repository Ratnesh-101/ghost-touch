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

from app.main import app, get_provider_chain, get_validator
from app.schema import DiagramScene
from app.validate import ValidationResult
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
    provider = FakeProvider("openai", [fenced])
    chain = ProviderChain([provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "ai"
    assert response.headers["X-Vision-Provider"] == "openai"


# --- 2. Fallback Chain in Route ---


def test_pipeline_first_fails_fallback_to_openai(client: TestClient) -> None:
    gemini = FakeProvider("gemini", [VisionError("gemini", "503 high demand")])
    openai = FakeProvider("openai", [VALID_SCENE_JSON])
    chain = ProviderChain([gemini, openai])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "ai"
    assert response.headers["X-Vision-Provider"] == "openai"
    assert gemini.call_count == 1
    assert openai.call_count == 1


def test_pipeline_all_providers_fail_returns_raw_mode(client: TestClient) -> None:
    gemini = FakeProvider("gemini", [VisionError("gemini", "429 quota")])
    openai = FakeProvider("openai", [VisionError("openai", "timeout")])
    chain = ProviderChain([gemini, openai])
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
    # first extraction, the validation retry, then one equation-route rescue before Raw Mode
    assert provider.call_count == 3


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


# --- 7. F2 Fixes: Hostile Images, Empty/Rejecting Raw Mode, CORS & Headers ---


def test_pipeline_text_file_declared_as_png_returns_415(client: TestClient) -> None:
    """Finding 3: Magic byte mismatch rejects text file declared as image/png."""
    files = {"image": ("fake.png", b"Hello, this is just plain text content", "image/png")}
    response = client.post("/api/v1/scene", files=files)
    assert response.status_code == 415
    assert "Invalid image file signature" in response.json()["detail"]


def test_pipeline_truncated_jpeg_returns_422(client: TestClient) -> None:
    """Finding 3: Truncated JPEG is rejected before OpenCV decode or paid providers."""
    truncated_jpg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00"
    files = {"image": ("corrupt.jpg", truncated_jpg, "image/jpeg")}
    response = client.post("/api/v1/scene", files=files)
    assert response.status_code == 422
    assert "corrupted or truncated" in response.json()["detail"]


def test_pipeline_huge_png_resolution_returns_422(client: TestClient) -> None:
    """Finding 3: PNG that decodes to a huge image (>40 MP) is capped and rejected."""
    import struct

    # Construct PNG IHDR with 10000x5000 = 50 MP (> 40 MP cap)
    huge_png_header = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        + struct.pack(">II", 10000, 5000)
        + b"\x08\x02\x00\x00\x00\x00\x00\x00\x00"
    )
    files = {"image": ("huge.png", huge_png_header, "image/png")}
    response = client.post("/api/v1/scene", files=files)
    assert response.status_code == 422
    assert "exceeds maximum allowed 12 megapixels" in response.json()["detail"]


def test_pipeline_blank_photo_returns_422(client: TestClient) -> None:
    """Finding 5: Blank or featureless photo returns clear spoken 422 error."""
    blank_img = np.zeros((200, 200, 3), dtype=np.uint8)  # Solid black, 0 outlines
    ok, buf = cv2.imencode(".png", blank_img)
    assert ok

    # Route to Raw Mode
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])
    files = {"image": ("blank.png", buf.tobytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 422
    assert "No diagram outlines detected" in response.json()["detail"]


def test_pipeline_rejecting_validator_on_raw_returns_422(client: TestClient) -> None:
    """Finding 5: If validator rejects the Raw Mode scene, never return unchecked scene."""
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])
    app.dependency_overrides[get_validator] = lambda: (
        lambda _raw: ValidationResult(scene=None, errors=["Rule 5 invariant violated"])
    )

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 422
    assert "Extracted outline could not be validated" in response.json()["detail"]


def test_pipeline_raw_mode_header_is_none(client: TestClient) -> None:
    """Finding 11: Header X-Vision-Provider is 'none' whenever mode is 'raw'."""
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    assert response.json()["mode"] == "raw"
    assert response.headers.get("X-Vision-Provider") == "none"


def test_pipeline_cors_expose_headers(client: TestClient) -> None:
    """Finding 12: CORS middleware exposes X-Vision-Provider."""
    response = client.get(
        "/api/v1/health",
        headers={"Origin": "http://localhost:5173"},
    )
    assert "x-vision-provider" in response.headers.get("access-control-expose-headers", "").lower()


def test_pipeline_retry_stays_on_answering_provider(client: TestClient) -> None:
    """Finding 14: Validation retry runs on the answering provider, not switching providers."""
    # Provider A returns invalid JSON on attempt 1, valid on retry
    provider_a = FakeProvider("gemini", ["{invalid json", VALID_SCENE_JSON])
    # Provider B should never be called
    provider_b = FakeProvider("openai", [VALID_SCENE_JSON])

    chain = ProviderChain([provider_a, provider_b])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    files = {"image": ("test.png", make_test_image_bytes(), "image/png")}
    response = client.post("/api/v1/scene", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "ai"
    assert response.headers.get("X-Vision-Provider") == "gemini"
    assert provider_a.call_count == 2
    assert provider_b.call_count == 0
