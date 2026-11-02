"""Shared pytest fixtures for the backend test suite."""

from __future__ import annotations

from collections.abc import Iterator

import pytest

from app.limits import reset_rate_limits
from app.scene_cache import scene_cache


@pytest.fixture(autouse=True)
def _fresh_rate_limits() -> Iterator[None]:
    """Every test starts with an empty rate-limit history (TestClient shares one client IP)."""
    reset_rate_limits()
    yield
    reset_rate_limits()


@pytest.fixture(autouse=True)
def _fresh_scene_cache() -> Iterator[None]:
    """Tests reuse the same image bytes, so no cached scene may leak from one to the next."""
    scene_cache.clear()
    yield
    scene_cache.clear()
