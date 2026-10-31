"""VisionProvider interface (Task 8.1).

Abstract base protocol and exception types for diagram vision providers.
"""

from __future__ import annotations

from typing import Protocol


class VisionError(Exception):
    """Provider-level failure: HTTP error, 429, 5xx, timeout, empty body."""

    def __init__(self, provider: str, reason: str) -> None:
        super().__init__(f"[{provider}] {reason}")
        self.provider = provider
        self.reason = reason


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
