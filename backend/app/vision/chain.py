"""Fallback chain of vision providers (Task 8.1).

Tries providers in configured order, falling back to the next on VisionError.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import Awaitable, Callable, Sequence

from app.vision.base import VisionError, VisionProvider, is_transient

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER_RETRIES: int = 1
DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS: float = 0.8
MIN_USEFUL_CALL_TIME_SECONDS: float = 3.0


def parse_provider_retries(raw: str | None = None) -> int:
    """Parse PROVIDER_RETRIES environment variable with fallback to default."""
    if raw is None:
        raw = os.environ.get("PROVIDER_RETRIES", str(DEFAULT_PROVIDER_RETRIES))
    try:
        val = int(raw)
        if val < 0:
            logger.warning(
                "PROVIDER_RETRIES must be non-negative; using default %d",
                DEFAULT_PROVIDER_RETRIES,
            )
            return DEFAULT_PROVIDER_RETRIES
        return val
    except (ValueError, TypeError):
        logger.warning(
            "Invalid PROVIDER_RETRIES '%s'; using default %d",
            raw,
            DEFAULT_PROVIDER_RETRIES,
        )
        return DEFAULT_PROVIDER_RETRIES


def parse_provider_retry_backoff(raw: str | None = None) -> float:
    """Parse PROVIDER_RETRY_BACKOFF_SECONDS environment variable with fallback to default."""
    if raw is None:
        raw = os.environ.get(
            "PROVIDER_RETRY_BACKOFF_SECONDS",
            str(DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS),
        )
    try:
        val = float(raw)
        if val < 0:
            logger.warning(
                "PROVIDER_RETRY_BACKOFF_SECONDS must be non-negative; using default %.1fs",
                DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS,
            )
            return DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS
        return val
    except (ValueError, TypeError):
        logger.warning(
            "Invalid PROVIDER_RETRY_BACKOFF_SECONDS '%s'; using default %.1fs",
            raw,
            DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS,
        )
        return DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS


class ProviderChain:
    """Chain of VisionProviders with fallback on VisionError."""

    def __init__(
        self,
        providers: Sequence[VisionProvider],
        call_timeout: float = 8.0,
        retries: int | None = None,
        retry_backoff: float | None = None,
        min_useful_call_time: float = MIN_USEFUL_CALL_TIME_SECONDS,
        sleep_fn: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self.providers: list[VisionProvider] = list(providers)
        self.call_timeout = call_timeout
        self.retries = retries if retries is not None else 0
        self.retry_backoff = (
            retry_backoff if retry_backoff is not None else DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS
        )

        self.min_useful_call_time = min_useful_call_time
        self._sleep = sleep_fn

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
            stop_chain = False
            for attempt in range(1 + self.retries):
                try:
                    logger.info("Calling vision provider: %s", provider.name)
                    timeout = self._call_timeout(self.call_timeout, deadline)
                    raw_text = await provider.extract(image, mime, prompt, timeout=timeout)
                    return raw_text, provider.name
                except VisionError as exc:
                    last_error = exc
                    if "budget exhausted" in exc.reason.lower():
                        logger.warning(
                            "Vision provider %s budget exhausted; stopping chain", provider.name
                        )
                        stop_chain = True
                        break
                    if attempt < self.retries and is_transient(exc):
                        if deadline is not None:
                            remaining = deadline - time.monotonic()
                            required = self.retry_backoff + self.min_useful_call_time
                            if remaining < required:
                                logger.warning(
                                    "Vision provider %s transient failure (%s) not retried: "
                                    "remaining deadline (%.2fs) < required (%.2fs)",
                                    provider.name,
                                    exc.__class__.__name__,
                                    remaining,
                                    required,
                                )
                                break
                        logger.info(
                            "Retrying provider %s after %s",
                            provider.name,
                            exc.__class__.__name__,
                        )
                        if self.retry_backoff > 0:
                            await self._sleep(self.retry_backoff)
                        continue
                    else:
                        logger.warning("Vision provider %s failed: %s", provider.name, exc.reason)
                        break
            if stop_chain:
                break

        error_reason = last_error.reason if last_error else "all providers failed"
        raise VisionError(
            "chain",
            error_reason,
            status_code=getattr(last_error, "status_code", None),
            transient=getattr(last_error, "transient", None),
        )

    async def complete(
        self,
        prompt: str,
        *,
        timeout: float | None = None,
        deadline: float | None = None,
        retries: int | None = None,
        max_attempts: int | None = None,
    ) -> tuple[str, str]:
        """Complete prompt text using the first succeeding provider (Task 9.1).

        ``timeout`` is the per-call cap; ``deadline`` (absolute ``time.monotonic()``) caps it
        further so every provider in the chain still gets a turn.
        ``max_attempts`` (or ``retries``) controls per-provider attempts; default None preserves
        the chain's configured retry behaviour (1 + self.retries attempts).
        /ask passes max_attempts=1 (C5).
        Returns (answer_text, provider_name_used).
        Raises VisionError if all providers fail or if no providers are configured.
        """
        if not self.providers:
            raise VisionError("chain", "no providers configured")

        if max_attempts is not None:
            effective_attempts = max(1, max_attempts)
        elif retries is not None:
            effective_attempts = 1 + max(0, retries)
        else:
            effective_attempts = 1 + self.retries

        base_timeout = timeout if timeout is not None else self.call_timeout
        last_error: VisionError | None = None
        for provider in self.providers:
            stop_chain = False
            for attempt in range(effective_attempts):
                try:
                    logger.info("Calling text completion provider: %s", provider.name)
                    call_to = self._call_timeout(base_timeout, deadline)
                    answer_text = await provider.complete(prompt, timeout=call_to)
                    return answer_text, provider.name
                except VisionError as exc:
                    last_error = exc
                    if "budget exhausted" in exc.reason.lower():
                        logger.warning(
                            "Provider %s budget exhausted; stopping chain", provider.name
                        )
                        stop_chain = True
                        break
                    if attempt + 1 < effective_attempts and is_transient(exc):
                        if deadline is not None:
                            remaining = deadline - time.monotonic()
                            required = self.retry_backoff + self.min_useful_call_time
                            if remaining < required:
                                logger.warning(
                                    "Provider %s complete transient failure (%s) not retried: "
                                    "remaining deadline (%.2fs) < required (%.2fs)",
                                    provider.name,
                                    exc.__class__.__name__,
                                    remaining,
                                    required,
                                )
                                break
                        logger.info(
                            "Retrying provider %s after %s",
                            provider.name,
                            exc.__class__.__name__,
                        )
                        if self.retry_backoff > 0:
                            await self._sleep(self.retry_backoff)
                        continue
                    else:
                        logger.warning("Provider %s complete failed: %s", provider.name, exc.reason)
                        break
            if stop_chain:
                break

        error_reason = last_error.reason if last_error else "all providers failed"
        raise VisionError(
            "chain",
            error_reason,
            status_code=getattr(last_error, "status_code", None),
            transient=getattr(last_error, "transient", None),
        )
