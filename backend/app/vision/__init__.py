"""Vision provider package for Ghost Touch (Task 8.1, F2)."""

from __future__ import annotations

import logging
import os

from app.vision.base import VisionError, VisionProvider
from app.vision.chain import ProviderChain
from app.vision.gemini import GeminiProvider
from app.vision.nvidia import NvidiaProvider
from app.vision.openai_provider import OpenAIProvider

logger = logging.getLogger(__name__)


def build_chain_from_env() -> ProviderChain:
    """Build a ProviderChain from environment variables.

    Providers whose API keys are missing are skipped silently at startup.
    Treats empty or unset VISION_PROVIDERS as 'gemini,openai,nvidia' (Gemini first, then OpenAI,
    then NVIDIA, which is also the provider to use for key checks and bulk test runs).
    Logs one line with configured provider names only.
    """
    raw_setting = os.environ.get("VISION_PROVIDERS", "").strip()
    providers_str = raw_setting if raw_setting else "gemini,openai,nvidia"

    configured_providers = [p.strip().lower() for p in providers_str.split(",") if p.strip()]

    try:
        call_timeout = float(os.environ.get("PROVIDER_TIMEOUT_SECONDS", "8.0"))
        if call_timeout <= 0:
            call_timeout = 8.0
    except ValueError:
        logger.warning("Invalid PROVIDER_TIMEOUT_SECONDS; using default 8.0s")
        call_timeout = 8.0

    providers: list[VisionProvider] = []
    for name in configured_providers:
        if name == "gemini":
            if os.environ.get("GEMINI_API_KEY"):
                providers.append(GeminiProvider())
        elif name == "openai":
            if os.environ.get("OPENAI_API_KEY"):
                providers.append(OpenAIProvider())
        elif name == "nvidia":
            if os.environ.get("NVIDIA_API_KEY"):
                providers.append(NvidiaProvider())

    names_list = ", ".join(p.name for p in providers) or "(none)"
    logger.info("vision providers: %s", names_list)

    return ProviderChain(providers=providers, call_timeout=call_timeout)


__all__ = [
    "GeminiProvider",
    "NvidiaProvider",
    "OpenAIProvider",
    "ProviderChain",
    "VisionError",
    "VisionProvider",
    "build_chain_from_env",
]
