"""Shared pytest fixtures for the backend test suite."""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from hypothesis import settings

from app.limits import reset_rate_limits
from app.scene_cache import scene_cache

# Register Hypothesis profiles for CI and Soak testing
settings.register_profile("ci", print_blob=True)
settings.register_profile("soak", max_examples=1000, deadline=None)

# Load profile if HYPOTHESIS_PROFILE environment variable is set
if _profile := os.getenv("HYPOTHESIS_PROFILE"):
    settings.load_profile(_profile)


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
