"""Vision provider package for Ghost Touch (Task 8.1)."""

from __future__ import annotations

import logging
import os

from app.vision.base import VisionError, VisionProvider
from app.vision.chain import ProviderChain
from app.vision.gemini import GeminiProvider
from app.vision.nvidia import NvidiaProvider

logger = logging.getLogger(__name__)


def build_chain_from_env() -> ProviderChain:
    """Build a ProviderChain from environment variables.

    Providers whose API keys are missing are skipped silently at startup.
    Logs one line with configured provider names only.
    """
    configured_providers = [
        p.strip().lower()
        for p in os.environ.get("VISION_PROVIDERS", "gemini,nvidia").split(",")
        if p.strip()
    ]
    try:
        call_timeout = float(os.environ.get("PROVIDER_TIMEOUT_SECONDS", "8.0"))
    except ValueError:
        call_timeout = 8.0

    providers: list[VisionProvider] = []
    for name in configured_providers:
        if name == "gemini":
            if os.environ.get("GEMINI_API_KEY"):
                providers.append(GeminiProvider())
        elif name == "nvidia":
            if os.environ.get("NVIDIA_API_KEY"):
                providers.append(NvidiaProvider())

    names_list = ", ".join(p.name for p in providers) or "(none)"
    logger.info("vision providers: %s", names_list)

    return ProviderChain(providers=providers, call_timeout=call_timeout)


__all__ = [
    "GeminiProvider",
    "NvidiaProvider",
    "ProviderChain",
    "VisionError",
    "VisionProvider",
    "build_chain_from_env",
]
