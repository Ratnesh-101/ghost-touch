"""VisionProvider interface (Task 8.1).

Abstract base protocol and exception types for diagram vision providers.
"""

from __future__ import annotations

import re
from typing import Any, Protocol


class VisionError(Exception):
    """Provider-level failure: HTTP error, 429, 5xx, timeout, empty body."""

    def __init__(
        self,
        provider: str,
        reason: str,
        *,
        status_code: int | None = None,
        transient: bool | None = None,
    ) -> None:
        super().__init__(f"[{provider}] {reason}")
        self.provider = provider
        self.reason = reason
        self.status_code = status_code
        self.transient = transient


TRANSIENT_STATUS_CODES = frozenset({429, 500, 502, 503, 504})
NON_TRANSIENT_STATUS_CODES = frozenset({400, 401, 403, 404})

_RE_NON_TRANSIENT_CODES = re.compile(r"\b(400|401|403|404)\b")
_RE_TRANSIENT_CODES = re.compile(r"\b(429|500|502|503|504)\b")


def is_transient(error: Any) -> bool:
    """Classify whether a provider failure is transient and eligible for retry.

    TRANSIENT:
      - HTTP 429, 500, 502, 503, 504
      - Provider-side 'UNAVAILABLE' or 'high demand' messages
      - Connection reset or connect timeout

    NOT TRANSIENT:
      - HTTP 400, 401, 403, 404
      - Schema or validation failure
      - 'not configured'
      - Content-filter / safety refusals
      - Provider-call timeout that already consumed the whole per-provider budget
    """
    if error is None:
        return False

    # 1. Explicit transient flag on VisionError
    explicit = getattr(error, "transient", None)
    if explicit is not None:
        return bool(explicit)

    # 2. Explicit status code (from VisionError or underlying exception)
    status_code = getattr(error, "status_code", None)
    if status_code is None:
        status_code = getattr(error, "code", None)
    if status_code is None and hasattr(error, "response"):
        status_code = getattr(error.response, "status_code", None)

    if status_code is not None:
        try:
            sc = int(status_code)
            if sc in NON_TRANSIENT_STATUS_CODES:
                return False
            if sc in TRANSIENT_STATUS_CODES or (500 <= sc < 600):
                return True
        except (ValueError, TypeError):
            pass

    # 3. Underlying cause inspection (e.g. ConnectionResetError, ConnectTimeout)
    cause = getattr(error, "__cause__", None)
    if cause is not None:
        cause_type_name = type(cause).__name__.lower()
        if isinstance(cause, ConnectionResetError) or "connectionreset" in cause_type_name:
            return True
        if "connecttimeout" in cause_type_name:
            return True

    # 4. Text inspection of reason and str(error)
    reason = getattr(error, "reason", "")
    text_parts = [str(reason), str(error)]
    if cause is not None:
        text_parts.append(str(cause))
    text = " ".join(text_parts).lower()

    # Priority NOT TRANSIENT checks
    if "not configured" in text:
        return False
    if any(
        marker in text
        for marker in ("validation", "schema", "invalid response json", "invalid scene")
    ):
        return False
    if any(
        marker in text
        for marker in ("content filter", "content-filter", "safety", "refusal", "prohibited")
    ):
        return False
    # Provider-call timeout that consumed the whole per-provider budget
    if "timed out after" in text:
        return False
    if _RE_NON_TRANSIENT_CODES.search(text):
        return False

    # TRANSIENT checks
    if _RE_TRANSIENT_CODES.search(text):
        return True
    if any(marker in text for marker in ("rate limit", "rate limited", "too many requests")):
        return True
    if "unavailable" in text:
        return True
    if "high demand" in text:
        return True
    if "connect timeout" in text or "connection timeout" in text:
        return True
    if any(
        marker in text
        for marker in (
            "connection reset",
            "reset by peer",
            "connection error",
            "connection refused",
        )
    ):
        return True

    return False


class VisionProvider(Protocol):
    """Protocol for vision model providers."""

    name: str

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        """Extract raw diagram text (expected JSON) from an image.

        Raises VisionError on failure. Never returns unvalidated DiagramScene.
        """
        ...

    async def complete(self, prompt: str, *, timeout: float) -> str:
        """Generate text completion from a prompt (text-only).

        Raises VisionError on failure.
        """
        ...
