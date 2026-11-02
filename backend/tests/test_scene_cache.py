"""Scene cache: validated AI scenes are reused by image hash; failures are never cached."""

from __future__ import annotations

import io
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_provider_chain
from app.scene_cache import SceneCache, image_key
from app.scene_cache import scene_cache as shared_cache
from app.vision.base import VisionError
from app.vision.chain import ProviderChain
from tests.test_scene_pipeline import (
    VALID_SCENE_JSON,
    FakeProvider,
    make_test_image_bytes,
)

AI_PAYLOAD = {"scene": {"kind": "geometry"}, "mode": "ai"}


@pytest.fixture(autouse=True)
def _clean() -> Generator[None, None, None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def _post(client: TestClient, image: bytes):  # type: ignore[no-untyped-def]
    return client.post("/api/v1/scene", files={"image": ("a.png", io.BytesIO(image), "image/png")})


# --- the cache object ---------------------------------------------------------------------


def test_put_then_get_returns_a_private_copy() -> None:
    cache = SceneCache(max_entries=4, ttl_seconds=60)
    cache.put("k", AI_PAYLOAD, "gemini")

    payload, provider = cache.get("k")  # type: ignore[misc]
    payload["scene"]["kind"] = "mutated"

    assert provider == "gemini"
    assert cache.get("k")[0]["scene"]["kind"] == "geometry"  # type: ignore[index]


def test_only_ai_payloads_are_stored() -> None:
    cache = SceneCache(max_entries=4, ttl_seconds=60)
    cache.put("raw", {"scene": {}, "mode": "raw", "reason": "timeout"}, "none")
    assert cache.get("raw") is None
    assert len(cache) == 0


def test_least_recently_used_entry_is_evicted() -> None:
    cache = SceneCache(max_entries=2, ttl_seconds=60)
    cache.put("a", AI_PAYLOAD, "x")
    cache.put("b", AI_PAYLOAD, "x")
    cache.get("a")  # a is now the most recently used
    cache.put("c", AI_PAYLOAD, "x")

    assert cache.get("b") is None
    assert cache.get("a") is not None
    assert cache.get("c") is not None


def test_entries_expire_after_the_ttl() -> None:
    now = [100.0]
    cache = SceneCache(max_entries=4, ttl_seconds=10, clock=lambda: now[0])
    cache.put("k", AI_PAYLOAD, "x")

    now[0] = 109.0
    assert cache.get("k") is not None
    now[0] = 111.0
    assert cache.get("k") is None


def test_size_zero_disables_the_cache() -> None:
    cache = SceneCache(max_entries=0, ttl_seconds=60)
    cache.put("k", AI_PAYLOAD, "x")
    assert cache.get("k") is None
    assert not cache.enabled


def test_key_changes_with_image_or_prompt() -> None:
    assert image_key(b"a", "p") != image_key(b"b", "p")
    assert image_key(b"a", "p") != image_key(b"a", "q")
    assert image_key(b"a", "p") == image_key(b"a", "p")


# --- through the endpoint -----------------------------------------------------------------


def test_second_identical_upload_never_calls_a_provider() -> None:
    client = TestClient(app)
    provider = FakeProvider("gemini", [VALID_SCENE_JSON])
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([provider])
    image = make_test_image_bytes()

    first = _post(client, image)
    second = _post(client, image)

    assert first.json()["mode"] == "ai"
    assert provider.call_count == 1
    assert second.json() == first.json()
    assert second.headers["X-Scene-Cache"] == "HIT"
    assert second.headers["X-Vision-Provider"] == "gemini"
    assert first.headers["X-Scene-Cache"] == "MISS"


def test_a_different_image_is_a_miss() -> None:
    client = TestClient(app)
    provider = FakeProvider("gemini", [VALID_SCENE_JSON, VALID_SCENE_JSON])
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([provider])

    _post(client, make_test_image_bytes(100, 100))
    _post(client, make_test_image_bytes(120, 90))

    assert provider.call_count == 2


def test_failures_are_not_cached_and_the_retry_can_succeed() -> None:
    client = TestClient(app)
    provider = FakeProvider("gemini", [VisionError("gemini", "boom"), VALID_SCENE_JSON])
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([provider])
    image = make_test_image_bytes()

    first = _post(client, image)  # provider error -> Raw Mode, must not be cached
    assert first.json()["mode"] == "raw"
    assert len(shared_cache) == 0

    second = _post(client, image)  # the provider recovers
    assert second.json()["mode"] == "ai"
    assert "X-Scene-Cache" in second.headers
    assert second.headers["X-Scene-Cache"] == "MISS"
    assert provider.call_count == 2
