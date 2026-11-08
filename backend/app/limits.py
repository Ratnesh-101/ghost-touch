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
DEFAULT_VALIDATE_PER_MINUTE = 40


# Sweep for expired clients at most this often (and always once the table is large).
SWEEP_INTERVAL_SECONDS = 5.0
SWEEP_TABLE_SIZE = 1000
MAX_CLIENT_KEY_CHARS = 64
DEFAULT_TRUSTED_HOPS_ON_RENDER = 1


def normalize_path(path: str) -> str:
    """Collapse repeated slashes and drop trailing ones, so `/api/v1/ask/` is `/api/v1/ask`."""
    parts = [part for part in path.split("/") if part]
    return "/" + "/".join(parts)


def trusted_proxy_hops() -> int:
    """How many right-most `X-Forwarded-For` entries were appended by proxies we trust.

    `TRUSTED_PROXY_HOPS` sets it (0 means trust nothing). When unset it is 1 on Render, which
    sets `RENDER`, and 0 everywhere else.
    """
    raw = os.environ.get("TRUSTED_PROXY_HOPS")
    default = DEFAULT_TRUSTED_HOPS_ON_RENDER if os.environ.get("RENDER") else 0
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value >= 0 else default


def client_key(peer: str | None, forwarded_for: str | None, trusted_hops: int) -> str:
    """Identify a client for rate limiting without trusting anything the client wrote.

    With no trusted proxy the key is the network peer. Behind `n` trusted proxies the key is the
    n-th entry from the right of `X-Forwarded-For` (the address the nearest trusted proxy saw).
    Entries to its left were written by the client or by untrusted hops and are never read.
    """
    fallback = peer or "unknown"
    if trusted_hops <= 0 or not forwarded_for:
        return fallback[:MAX_CLIENT_KEY_CHARS]
    entries = [entry.strip() for entry in forwarded_for.split(",") if entry.strip()]
    if len(entries) < trusted_hops:
        return fallback[:MAX_CLIENT_KEY_CHARS]
    return entries[-trusted_hops][:MAX_CLIENT_KEY_CHARS]


_HITS: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_last_sweep: float = float("-inf")


def reset_rate_limits() -> None:
    """Forget all rate-limit history (used by tests)."""
    global _last_sweep
    _HITS.clear()
    _last_sweep = float("-inf")


class _BodyTooLarge(BaseException):  # noqa: N818 - control-flow signal, not an error
    """Raised from the wrapped receive() once the streamed body passes its cap.

    Deliberately a BaseException: FastAPI turns any `Exception` raised while it reads the body
    into a 400, so an ordinary exception would hide the 413 this guard is meant to send.
    """


def _int_env(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        return default
    return value if value > 0 else default


def _sweep(now: float) -> None:
    """Drop every client whose window holds nothing newer than the rate window."""
    expired = [
        key for key, window in _HITS.items() if not window or now - window[-1] > RATE_WINDOW_SECONDS
    ]
    for key in expired:
        del _HITS[key]


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

        path = normalize_path(scope.get("path", ""))
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
        client = scope.get("client")
        peer = str(client[0]) if client else None
        return client_key(peer, headers.get("x-forwarded-for"), trusted_proxy_hops())

    def _allow(self, client: str, path: str, per_minute: int, now: float | None = None) -> bool:
        global _last_sweep
        now = time.monotonic() if now is None else now
        if now - _last_sweep >= SWEEP_INTERVAL_SECONDS or len(_HITS) > SWEEP_TABLE_SIZE:
            _sweep(now)
            _last_sweep = now
        key = (client, path)
        window = _HITS[key]
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
        "/api/v1/validate": _int_env("RATE_LIMIT_VALIDATE_PER_MIN", DEFAULT_VALIDATE_PER_MINUTE),
    }
