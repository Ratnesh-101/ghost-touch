"""Fallback chain of vision providers (Task 8.1, UX12).

Tries providers in configured order, falling back to the next on VisionError.
Includes per-provider circuit breaker to prevent cascading outages from slow or failing providers.
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
BREAKER_FAILURE_THRESHOLD: int = 2
BREAKER_OPEN_DURATION_SECONDS: float = 60.0


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


def is_breaker_failure(exc: BaseException) -> bool:
    """Classify whether a failure counts toward opening the circuit breaker.

    Failures that count: timeout, HTTP 5xx, HTTP 429, connect error.
    """
    if exc is None:
        return False

    if isinstance(exc, TimeoutError):
        return True

    # 1. Status code checks (from VisionError, httpx, or other exception)
    status_code = getattr(exc, "status_code", None)
    if status_code is None:
        status_code = getattr(exc, "code", None)
    if status_code is None and hasattr(exc, "response"):
        status_code = getattr(exc.response, "status_code", None)

    if status_code is not None:
        try:
            sc = int(status_code)
            if sc == 429 or (500 <= sc < 600):
                return True
            if sc in (400, 401, 403, 404):
                return False
        except (ValueError, TypeError):
            pass

    # 2. Underlying cause checks
    cause = getattr(exc, "__cause__", None)
    if cause is not None and is_breaker_failure(cause):
        return True

    # 3. Connection error types
    target = cause if cause is not None else exc
    if isinstance(target, (ConnectionError, ConnectionResetError, ConnectionRefusedError)):
        return True
    target_type = type(target).__name__.lower()
    if "connect" in target_type or "timeout" in target_type:
        return True

    # 4. Text inspection
    reason = getattr(exc, "reason", "")
    text = f"{reason} {exc}".lower()

    # Priority NOT counting checks
    if any(
        marker in text
        for marker in (
            "400",
            "401",
            "403",
            "404",
            "validation",
            "schema",
            "invalid response json",
            "content filter",
            "safety",
            "not configured",
            "budget exhausted",
        )
    ):
        return False

    # Counting checks
    if any(marker in text for marker in ("timeout", "timed out", "time out")):
        return True
    if any(marker in text for marker in ("429", "rate limit", "rate limited", "too many requests")):
        return True
    if any(marker in text for marker in ("500", "502", "503", "504", "server error", "5xx")):
        return True
    if any(
        marker in text
        for marker in (
            "connect error",
            "connection error",
            "connection reset",
            "connection refused",
            "connect timeout",
            "reset by peer",
        )
    ):
        return True

    return False


class ProviderBreaker:
    """Per-provider circuit breaker held on the chain object (UX12)."""

    def __init__(
        self,
        provider_name: str,
        clock: Callable[[], float] = time.monotonic,
        failure_threshold: int = BREAKER_FAILURE_THRESHOLD,
        open_duration: float = BREAKER_OPEN_DURATION_SECONDS,
    ) -> None:
        self.provider_name = provider_name
        self.clock = clock
        self.failure_threshold = failure_threshold
        self.open_duration = open_duration
        self.consecutive_failures: int = 0
        self.open_until: float = 0.0
        self._state: str = "closed"
        self._probe_in_flight: bool = False

    @property
    def state(self) -> str:
        if self._state == "open" and self.clock() >= self.open_until:
            self._transition_to("half-open")
        return self._state

    @state.setter
    def state(self, new_state: str) -> None:
        self._state = new_state

    def _transition_to(self, new_state: str) -> None:
        if self._state != new_state:
            self._state = new_state
            logger.info("circuit breaker %s: %s", new_state, self.provider_name)

    def allow_call(self) -> bool:
        """Check if breaker permits a call."""
        s = self.state
        if s == "closed":
            return True
        if s == "half-open":
            return not self._probe_in_flight
        return False

    def start_call(self) -> None:
        """Mark a call as started."""
        if self.state == "half-open":
            self._probe_in_flight = True

    def record_success(self) -> None:
        """Success closes the breaker and resets failure count."""
        self._probe_in_flight = False
        self.consecutive_failures = 0
        self.open_until = 0.0
        self._transition_to("closed")

    def record_failure(self, exc: BaseException) -> None:
        """Record a failure that counts toward the breaker."""
        self._probe_in_flight = False
        if not is_breaker_failure(exc):
            return

        now = self.clock()
        self.consecutive_failures += 1
        s = self.state
        if s == "half-open":
            self.open_until = now + self.open_duration
            self._transition_to("open")
        elif s == "closed":
            if self.consecutive_failures >= self.failure_threshold:
                self.open_until = now + self.open_duration
                self._transition_to("open")
        elif s == "open":
            self.open_until = now + self.open_duration


class ProviderChain:
    """Chain of VisionProviders with fallback on VisionError and per-provider breaker."""

    def __init__(
        self,
        providers: Sequence[VisionProvider],
        call_timeout: float = 8.0,
        retries: int | None = None,
        retry_backoff: float | None = None,
        min_useful_call_time: float = MIN_USEFUL_CALL_TIME_SECONDS,
        sleep_fn: Callable[[float], Awaitable[None]] = asyncio.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.providers: list[VisionProvider] = list(providers)
        self.call_timeout = call_timeout
        self.retries = retries if retries is not None else 0
        self.retry_backoff = (
            retry_backoff if retry_backoff is not None else DEFAULT_PROVIDER_RETRY_BACKOFF_SECONDS
        )

        self.min_useful_call_time = min_useful_call_time
        self._sleep = sleep_fn
        self.clock = clock
        self.breakers: dict[str, ProviderBreaker] = {
            p.name: ProviderBreaker(p.name, clock=lambda: self.clock()) for p in self.providers
        }

    def get_provider(self, name: str) -> VisionProvider | None:
        """Find a provider by name."""
        for provider in self.providers:
            if provider.name == name:
                return provider
        return None

    def get_breaker(self, name: str) -> ProviderBreaker:
        """Find or create circuit breaker for a provider."""
        if name not in self.breakers:
            self.breakers[name] = ProviderBreaker(name, clock=lambda: self.clock())
        return self.breakers[name]

    def _select_providers(self) -> list[VisionProvider]:
        """Select providers to try based on circuit breaker states.

        When every provider is open, try the one whose open-until is earliest
        (never return 'no provider' because of the breaker alone).
        """
        if not self.providers:
            return []

        available = [p for p in self.providers if self.get_breaker(p.name).allow_call()]
        if available:
            return available

        earliest = min(self.providers, key=lambda p: self.get_breaker(p.name).open_until)
        return [earliest]

    def _call_timeout(self, base: float, deadline: float | None) -> float:
        """Per-call timeout: the base timeout, capped by the time left before the deadline."""
        if deadline is None:
            return base
        remaining = deadline - self.clock()
        if remaining <= 0:
            raise VisionError("chain", "deadline reached before a provider answered")
        return min(base, remaining)

    async def extract(
        self, image: bytes, mime: str, prompt: str, *, deadline: float | None = None
    ) -> tuple[str, str]:
        """Extract diagram text using the first succeeding provider.

        ``deadline`` is an absolute time value; each call gets at most the
        time left, so one slow provider cannot starve the fallbacks of their turn.
        Returns (raw_text, provider_name_used).
        Raises VisionError if all providers fail or if no providers are configured.
        """
        if not self.providers:
            raise VisionError("chain", "no providers configured")

        providers_to_try = self._select_providers()
        last_error: VisionError | None = None
        for provider in providers_to_try:
            breaker = self.get_breaker(provider.name)
            breaker.start_call()
            stop_chain = False
            attempts = 1 if breaker.state == "half-open" else (1 + self.retries)
            for attempt in range(attempts):
                try:
                    logger.info("Calling vision provider: %s", provider.name)
                    timeout = self._call_timeout(self.call_timeout, deadline)
                    raw_text = await provider.extract(image, mime, prompt, timeout=timeout)
                    breaker.record_success()
                    return raw_text, provider.name
                except VisionError as exc:
                    last_error = exc
                    if "budget exhausted" in exc.reason.lower():
                        logger.warning(
                            "Vision provider %s budget exhausted; stopping chain", provider.name
                        )
                        stop_chain = True
                        break
                    if attempt + 1 < attempts and is_transient(exc):
                        if deadline is not None:
                            remaining = deadline - self.clock()
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
                                breaker.record_failure(exc)
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
                        breaker.record_failure(exc)
                        break
                except Exception as exc:
                    last_error = (
                        exc
                        if isinstance(exc, VisionError)
                        else VisionError(provider.name, str(exc))
                    )
                    logger.warning("Vision provider %s failed: %s", provider.name, exc)
                    breaker.record_failure(exc)
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

        ``timeout`` is the per-call cap; ``deadline`` caps it
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
        providers_to_try = self._select_providers()
        last_error: VisionError | None = None
        for provider in providers_to_try:
            breaker = self.get_breaker(provider.name)
            breaker.start_call()
            stop_chain = False
            attempts = 1 if breaker.state == "half-open" else effective_attempts
            for attempt in range(attempts):
                try:
                    logger.info("Calling text completion provider: %s", provider.name)
                    call_to = self._call_timeout(base_timeout, deadline)
                    answer_text = await provider.complete(prompt, timeout=call_to)
                    breaker.record_success()
                    return answer_text, provider.name
                except VisionError as exc:
                    last_error = exc
                    if "budget exhausted" in exc.reason.lower():
                        logger.warning(
                            "Provider %s budget exhausted; stopping chain", provider.name
                        )
                        stop_chain = True
                        break
                    if attempt + 1 < attempts and is_transient(exc):
                        if deadline is not None:
                            remaining = deadline - self.clock()
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
                                breaker.record_failure(exc)
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
                        breaker.record_failure(exc)
                        break
                except Exception as exc:
                    last_error = (
                        exc
                        if isinstance(exc, VisionError)
                        else VisionError(provider.name, str(exc))
                    )
                    logger.warning("Provider %s complete failed: %s", provider.name, exc)
                    breaker.record_failure(exc)
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
