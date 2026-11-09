"""Tests for the asynchronous 'Improve' pass (Lane B, Requirement 3).

Verifies that:
1. Fast result is returned immediately to the client.
2. The stronger model (GEMINI_IMPROVE_MODEL, opt-in, e.g. gemini-3.8-flash) runs non-blocking
   in a background task.
3. On success, the cache is updated under the same image hash so a re-fetch gets the better scene.
4. Failures in the improve pass never delay or fail the primary response and are never cached.
5. GeminiProvider defaults to gemini-3.5-flash-lite while preserving GEMINI_MODEL override.
"""

from __future__ import annotations

import io
import json
from collections.abc import Generator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_improve_provider, get_provider_chain
from app.scene_cache import scene_cache
from app.vision.base import VisionError
from app.vision.chain import ProviderChain
from app.vision.gemini import GeminiProvider
from tests.test_scene_pipeline import FakeProvider, make_test_image_bytes

FAST_SCENE_DICT: dict[str, Any] = {
    "version": 1,
    "kind": "geometry",
    "title": "Fast Triangle",
    "points": [
        {"id": "p1", "x": 0.2, "y": 0.8, "label": "A"},
        {"id": "p2", "x": 0.8, "y": 0.8, "label": "B"},
        {"id": "p3", "x": 0.8, "y": 0.2, "label": "C"},
    ],
    "segments": [
        {"id": "s1", "a": "p1", "b": "p2", "label": "AB"},
        {"id": "s2", "a": "p2", "b": "p3", "label": "BC"},
        {"id": "s3", "a": "p1", "b": "p3", "label": "AC"},
    ],
    "polylines": [],
    "bars": [],
    "axes": None,
    "facts": ["triangle ABC"],
}
FAST_SCENE_JSON = json.dumps(FAST_SCENE_DICT)

IMPROVED_SCENE_DICT: dict[str, Any] = {
    "version": 1,
    "kind": "geometry",
    "title": "Detailed Right Triangle",
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
    "facts": ["angle B = 90°", "base AB is 6 cm", "height BC is 6 cm"],
}
IMPROVED_SCENE_JSON = json.dumps(IMPROVED_SCENE_DICT)


@pytest.fixture(autouse=True)
def _clean() -> Generator[None, None, None]:
    scene_cache.clear()
    app.dependency_overrides.clear()
    yield
    scene_cache.clear()
    app.dependency_overrides.clear()


def _post(client: TestClient, image: bytes):  # type: ignore[no-untyped-def]
    return client.post(
        "/api/v1/scene", files={"image": ("test.png", io.BytesIO(image), "image/png")}
    )


# --- 1. Default Gemini Model --------------------------------------------------------------


def test_gemini_provider_defaults_to_flash_lite(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    provider = GeminiProvider(api_key="test-key")
    assert provider.model == "gemini-3.5-flash-lite"


def test_gemini_provider_respects_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.8-flash")
    provider = GeminiProvider(api_key="test-key")
    assert provider.model == "gemini-3.8-flash"


def test_gemini_provider_respects_explicit_model_param() -> None:
    provider = GeminiProvider(api_key="test-key", model="custom-gemini-model")
    assert provider.model == "custom-gemini-model"


# --- 2. Improve Pass Lifecycle ------------------------------------------------------------


def test_improve_pass_updates_cache_so_refetch_gets_better_scene() -> None:
    """Primary response returns the fast scene; background improve pass upgrades cache."""
    client = TestClient(app)
    fast_provider = FakeProvider("gemini", [FAST_SCENE_JSON])
    improve_provider = FakeProvider("gemini-3.8-flash", [IMPROVED_SCENE_JSON])

    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fast_provider])
    app.dependency_overrides[get_improve_provider] = lambda: improve_provider

    image = make_test_image_bytes(100, 100)

    # 1. Primary request: gets the fast scene immediately
    first_resp = _post(client, image)
    assert first_resp.status_code == 200
    first_data = first_resp.json()
    assert first_data["mode"] == "ai"
    assert first_data["scene"]["title"] == "Fast Triangle"
    assert first_resp.headers["X-Scene-Cache"] == "MISS"
    assert first_resp.headers["X-Vision-Provider"] == "ai"
    assert fast_provider.call_count == 1

    # In TestClient, background tasks run upon completing the response.
    # The improve provider should have been called once:
    assert improve_provider.call_count == 1

    # 2. Subsequent request (re-fetch): gets the upgraded scene from cache!
    second_resp = _post(client, image)
    assert second_resp.status_code == 200
    second_data = second_resp.json()
    assert second_data["mode"] == "ai"
    assert second_data["scene"]["title"] == "Detailed Right Triangle"
    assert second_resp.headers["X-Scene-Cache"] == "HIT"
    assert second_resp.headers["X-Vision-Provider"] == "ai"

    # Fast provider was NOT called again; improve provider was NOT called again:
    assert fast_provider.call_count == 1
    assert improve_provider.call_count == 1


def test_improve_pass_failure_leaves_fast_scene_in_cache() -> None:
    """If improve pass fails (e.g. quota, network, timeout), fast scene remains cached."""
    client = TestClient(app)
    fast_provider = FakeProvider("gemini", [FAST_SCENE_JSON])
    improve_provider = FakeProvider(
        "gemini-3.8-flash", [VisionError("gemini-3.8-flash", "quota exceeded")]
    )

    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fast_provider])
    app.dependency_overrides[get_improve_provider] = lambda: improve_provider

    image = make_test_image_bytes(100, 100)

    first_resp = _post(client, image)
    assert first_resp.status_code == 200
    assert first_resp.json()["scene"]["title"] == "Fast Triangle"

    # Background task ran and caught the failure without affecting cache or crashing:
    assert improve_provider.call_count == 1

    # Re-fetch gets the fast scene (cache was NOT cleared or invalidated by the failure)
    second_resp = _post(client, image)
    assert second_resp.status_code == 200
    assert second_resp.json()["scene"]["title"] == "Fast Triangle"
    assert second_resp.headers["X-Scene-Cache"] == "HIT"
    assert second_resp.headers["X-Vision-Provider"] == "ai"


def test_improve_pass_invalid_scene_is_discarded() -> None:
    """If improve pass returns invalid schema JSON, it is discarded and not cached."""
    client = TestClient(app)
    fast_provider = FakeProvider("gemini", [FAST_SCENE_JSON])
    invalid_json = '{"version": 1, "kind": "unknown", "points": "invalid"}'
    improve_provider = FakeProvider("gemini-3.8-flash", [invalid_json])

    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fast_provider])
    app.dependency_overrides[get_improve_provider] = lambda: improve_provider

    image = make_test_image_bytes(100, 100)

    first_resp = _post(client, image)
    assert first_resp.status_code == 200
    assert first_resp.json()["scene"]["title"] == "Fast Triangle"

    second_resp = _post(client, image)
    assert second_resp.status_code == 200
    # Original fast scene remains in cache
    assert second_resp.json()["scene"]["title"] == "Fast Triangle"
    assert second_resp.headers["X-Scene-Cache"] == "HIT"


def test_improve_pass_disabled_via_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """When GEMINI_IMPROVE_MODEL is set to 'off' or 'none', no improve pass runs."""
    monkeypatch.setenv("GEMINI_IMPROVE_MODEL", "off")
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-key")

    provider = get_improve_provider()
    assert provider is None


def test_improve_pass_not_scheduled_when_no_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """When GEMINI_API_KEY is empty, get_improve_provider returns None."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    provider = get_improve_provider()
    assert provider is None


def test_improve_pass_is_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unset GEMINI_IMPROVE_MODEL means no second Gemini request per scan (free-tier quota)."""
    monkeypatch.delenv("GEMINI_IMPROVE_MODEL", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key-for-test")
    assert get_improve_provider() is None
