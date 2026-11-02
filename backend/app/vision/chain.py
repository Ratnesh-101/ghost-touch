"""Fallback chain of vision providers (Task 8.1).

Tries providers in configured order, falling back to the next on VisionError.
"""

from __future__ import annotations

import logging
import time
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

    def _call_timeout(self, base: float, deadline: float | None) -> float:
        """Per-call timeout: the base timeout, capped by the time left before the deadline."""
        if deadline is None:
            return base
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise VisionError("chain", "deadline reached before a provider answered")
        return min(base, remaining)

    async def extract(
        self, image: bytes, mime: str, prompt: str, *, deadline: float | None = None
    ) -> tuple[str, str]:
        """Extract diagram text using the first succeeding provider.

        ``deadline`` is an absolute ``time.monotonic()`` value; each call gets at most the
        time left, so one slow provider cannot starve the fallbacks of their turn.
        Returns (raw_text, provider_name_used).
        Raises VisionError if all providers fail or if no providers are configured.
        """
        if not self.providers:
            raise VisionError("chain", "no providers configured")

        last_error: VisionError | None = None
        for provider in self.providers:
            try:
                logger.info("Calling vision provider: %s", provider.name)
                raw_text = await provider.extract(
                    image, mime, prompt, timeout=self._call_timeout(self.call_timeout, deadline)
                )
                return raw_text, provider.name
            except VisionError as exc:
                logger.warning("Vision provider %s failed: %s", provider.name, exc.reason)
                last_error = exc
                continue

        error_reason = last_error.reason if last_error else "all providers failed"
        raise VisionError("chain", error_reason)

    async def complete(
        self, prompt: str, *, timeout: float | None = None, deadline: float | None = None
    ) -> tuple[str, str]:
        """Complete prompt text using the first succeeding provider (Task 9.1).

        ``timeout`` is the per-call cap; ``deadline`` (absolute ``time.monotonic()``) caps it
        further so every provider in the chain still gets a turn.
        Returns (answer_text, provider_name_used).
        Raises VisionError if all providers fail or if no providers are configured.
        """
        if not self.providers:
            raise VisionError("chain", "no providers configured")

        base_timeout = timeout if timeout is not None else self.call_timeout
        last_error: VisionError | None = None
        for provider in self.providers:
            try:
                logger.info("Calling text completion provider: %s", provider.name)
                answer_text = await provider.complete(
                    prompt, timeout=self._call_timeout(base_timeout, deadline)
                )
                return answer_text, provider.name
            except VisionError as exc:
                logger.warning("Provider %s complete failed: %s", provider.name, exc.reason)
                last_error = exc
                continue

        error_reason = last_error.reason if last_error else "all providers failed"
        raise VisionError("chain", error_reason)
