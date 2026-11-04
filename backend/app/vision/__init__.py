"""Vision provider package for Ghost Touch (Task 8.1, F2)."""

from __future__ import annotations

import logging
import os

from app.vision.base import VisionError, VisionProvider
from app.vision.chain import ProviderChain
from app.vision.gemini import GeminiProvider
from app.vision.nebius import NebiusProvider
from app.vision.openai_provider import OpenAIProvider

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER_ORDER = "gemini,openai,nebius"


def build_chain_from_env() -> ProviderChain:
    """Build a ProviderChain from environment variables.

    Providers whose API keys are missing are skipped silently at startup.
    Treats empty or unset VISION_PROVIDERS as 'gemini,openai,nebius' (Gemini first, then OpenAI,
    then Nebius as the last fallback; Nebius is also the key used for bulk test runs).
    """
    raw_setting = os.environ.get("VISION_PROVIDERS", "").strip()
    providers_str = raw_setting if raw_setting else DEFAULT_PROVIDER_ORDER

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
        elif name == "nebius":
            if os.environ.get("NEBIUS_API_KEY"):
                providers.append(NebiusProvider())

    names_list = ", ".join(p.name for p in providers) or "(none)"
    logger.info("vision providers: %s", names_list)

    return ProviderChain(providers=providers, call_timeout=call_timeout)


__all__ = [
    "GeminiProvider",
    "NebiusProvider",
    "OpenAIProvider",
    "ProviderChain",
    "VisionError",
    "VisionProvider",
    "build_chain_from_env",
]
