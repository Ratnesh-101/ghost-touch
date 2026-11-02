"""Request guards: body-size caps and a small per-client rate limit (review F3, F4).

Both /api/v1/scene and /api/v1/ask spend paid model tokens and are unauthenticated, so the
body is capped *before* the framework buffers it, and each client gets a modest request budget.
Implemented as a pure ASGI middleware so it runs ahead of multipart parsing.
"""

from __future__ import annotations

import json
import logging
import os
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

logger = logging.getLogger(__name__)

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]

MULTIPART_OVERHEAD = 256 * 1024  # form fields and boundaries around the 10 MB image
RATE_WINDOW_SECONDS = 60.0
DEFAULT_ASK_PER_MINUTE = 40
DEFAULT_SCENE_PER_MINUTE = 20


_HITS: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def reset_rate_limits() -> None:
    """Forget all rate-limit history (used by tests)."""
    _HITS.clear()


class _BodyTooLarge(Exception):
    """Raised from the wrapped receive() once the streamed body passes its cap."""


def _int_env(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        return default
    return value if value > 0 else default


class RequestGuardMiddleware:
    """Cap body size and rate-limit POSTs for the configured paths."""

    def __init__(
        self,
        app: ASGIApp,
        body_limits: dict[str, int],
        rate_limits: dict[str, int] | None = None,
    ) -> None:
        self.app = app
        self.body_limits = body_limits
        self.rate_limits = rate_limits or {}

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("method") != "POST":
            await self.app(scope, receive, send)
            return

        path: str = scope.get("path", "")
        limit = self.body_limits.get(path)
        rate = self.rate_limits.get(path)
        if limit is None and rate is None:
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}

        if rate is not None and not self._allow(self._client_key(scope, headers), path, rate):
            await self._reject(send, 429, "Too many requests. Please wait a moment and retry.")
            return

        if limit is None:
            await self.app(scope, receive, send)
            return

        declared = headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > limit:
            await self._reject(send, 413, "Request body is too large.")
            return

        received = 0
        started = False

        async def guarded_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise _BodyTooLarge
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, guarded_receive, tracking_send)
        except _BodyTooLarge:
            if not started:
                await self._reject(send, 413, "Request body is too large.")

    @staticmethod
    def _client_key(scope: Scope, headers: dict[str, str]) -> str:
        forwarded = headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        client = scope.get("client")
        return str(client[0]) if client else "unknown"

    def _allow(self, client: str, path: str, per_minute: int) -> bool:
        now = time.monotonic()
        window = _HITS[(client, path)]
        while window and now - window[0] > RATE_WINDOW_SECONDS:
            window.popleft()
        if len(window) >= per_minute:
            logger.warning("rate limit hit: path=%s", path)
            return False
        window.append(now)
        return True

    @staticmethod
    async def _reject(send: Send, status: int, detail: str) -> None:
        body = json.dumps({"detail": detail}).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


def default_rate_limits() -> dict[str, int]:
    """Per-minute limits per client, tunable by env (RATE_LIMIT_ASK_PER_MIN, ..._SCENE_...)."""
    return {
        "/api/v1/ask": _int_env("RATE_LIMIT_ASK_PER_MIN", DEFAULT_ASK_PER_MINUTE),
        "/api/v1/scene": _int_env("RATE_LIMIT_SCENE_PER_MIN", DEFAULT_SCENE_PER_MINUTE),
    }
