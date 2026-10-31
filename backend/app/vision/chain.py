"""Fallback chain of vision providers (Task 8.1).

Tries providers in configured order, falling back to the next on VisionError.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence

from app.vision.base import VisionError, VisionProvider

logger = logging.getLogger(__name__)


class ProviderChain:
    """Chain of VisionProviders with fallback on VisionError."""

    def __init__(
        self,
        providers: Sequence[VisionProvider],
        call_timeout: float = 8.0,
    ) -> None:
        self.providers: list[VisionProvider] = list(providers)
        self.call_timeout = call_timeout

    def get_provider(self, name: str) -> VisionProvider | None:
        """Find a provider by name."""
        for provider in self.providers:
            if provider.name == name:
                return provider
        return None

    async def extract(self, image: bytes, mime: str, prompt: str) -> tuple[str, str]:
        """Extract diagram text using the first succeeding provider.

        Returns (raw_text, provider_name_used).
        Raises VisionError if all providers fail or if no providers are configured.
        """
        if not self.providers:
            raise VisionError("chain", "no providers configured")

        last_error: VisionError | None = None
        for provider in self.providers:
            try:
                logger.info("Calling vision provider: %s", provider.name)
                raw_text = await provider.extract(image, mime, prompt, timeout=self.call_timeout)
                return raw_text, provider.name
            except VisionError as exc:
                logger.warning("Vision provider %s failed: %s", provider.name, exc.reason)
                last_error = exc
                continue

        error_reason = last_error.reason if last_error else "all providers failed"
        raise VisionError("chain", error_reason)
