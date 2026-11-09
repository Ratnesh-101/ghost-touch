"""Request guards: body-size caps and a small per-client rate limit (review F3, F4).

Both /api/v1/scene and /api/v1/ask spend paid model tokens and are unauthenticated, so the
body is capped *before* the framework buffers it, and each client gets a modest request budget.
Implemented as a pure ASGI middleware so it runs ahead of multipart parsing.
"""

from __future__ import annotations

import ipaddress
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
MIN_SWEEP_INTERVAL_SECONDS = 1.0  # R3-2: throttle sweep regardless of table size
SWEEP_INTERVAL_SECONDS = 5.0
SWEEP_TABLE_SIZE = 1000
MAX_RATE_LIMIT_KEYS = 50_000  # R3-2: hard cap on _HITS table size
MAX_CLIENT_KEY_CHARS = 64
DEFAULT_TRUSTED_HOPS_ON_RENDER = 1
DEFAULT_CLIENT_MAX_IN_FLIGHT = 2


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


def _normalize_ip_key(raw: Any) -> str:
    """Parse key with ipaddress, group IPv6 on /64, strip port/brackets.

    Also canonicalise IPv4-mapped addresses (R3-3).
    """
    if not isinstance(raw, str):
        return "unknown"
    cleaned = raw.strip()
    if not cleaned:
        return "unknown"

    # Strip brackets if present, e.g. [2001:db8::1]:8080 or [2001:db8::1]
    if cleaned.startswith("["):
        end_bracket = cleaned.find("]")
        if end_bracket != -1:
            cleaned = cleaned[1:end_bracket]
    elif cleaned.count(":") == 1:
        # IPv4 with port, e.g. 1.2.3.4:80
        host, sep, port = cleaned.partition(":")
        if port.isdigit():
            cleaned = host

    try:
        ip = ipaddress.ip_address(cleaned)
    except ValueError:
        # Non-IP string (e.g. "unknown" or test hostname); return as bounded string
        return raw[:MAX_CLIENT_KEY_CHARS]

    # Canonicalise IPv4-mapped IPv6 address (e.g. ::ffff:192.0.2.1 -> 192.0.2.1)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped

    if isinstance(ip, ipaddress.IPv6Address):
        # Key IPv6 addresses on their /64 network
        network = ipaddress.IPv6Network(f"{ip}/64", strict=False)
        return str(network)[:MAX_CLIENT_KEY_CHARS]

    return str(ip)[:MAX_CLIENT_KEY_CHARS]


def client_key(peer: Any, forwarded_for: Any, trusted_hops: int) -> str:
    """Identify a client for rate limiting without trusting anything the client wrote.

    With no trusted proxy the key is the network peer. Behind `n` trusted proxies the key is the
    n-th entry from the right of `X-Forwarded-For` (the address the nearest trusted proxy saw).
    Entries to its left were written by the client or by untrusted hops and are never read.
    IPv6 addresses are grouped by their /64 network (R3-3).
    """
    safe_peer = peer if isinstance(peer, str) else None
    safe_xff = forwarded_for if isinstance(forwarded_for, str) else None

    fallback = safe_peer or "unknown"
    if trusted_hops <= 0 or not safe_xff:
        return _normalize_ip_key(fallback)
    entries = [entry.strip() for entry in safe_xff.split(",") if entry.strip()]
    if len(entries) < trusted_hops:
        return _normalize_ip_key(fallback)
    return _normalize_ip_key(entries[-trusted_hops])


_HITS: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_last_sweep: float = float("-inf")
_sweep_count: int = 0


def reset_rate_limits() -> None:
    """Forget all rate-limit history (used by tests)."""
    global _last_sweep, _sweep_count
    _HITS.clear()
    _last_sweep = float("-inf")
    _sweep_count = 0


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
    global _sweep_count
    _sweep_count += 1
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

        # R3-5: Join duplicate X-Forwarded-For header lines with comma
        raw_headers: list[tuple[str, str]] = [
            (k.decode("latin-1").lower(), v.decode("latin-1")) for k, v in scope.get("headers", [])
        ]
        headers: dict[str, str] = {}
        xff_lines: list[str] = []
        for k, v in raw_headers:
            if k == "x-forwarded-for":
                xff_lines.append(v)
            else:
                headers[k] = v
        if xff_lines:
            headers["x-forwarded-for"] = ", ".join(xff_lines)

        if rate is not None and not self._allow(self._client_key(scope, headers), path, rate):
            await self._reject(send, 429, "Too many requests. Please wait a moment and retry.")
            return

        if limit is None:
            await self.app(scope, receive, send)
            return

        declared = headers.get("content-length")
        if declared is not None:
            # R3-5: Safe parsing for Content-Length (superscripts / >4300 digits
            # must give 400/413, never 500)
            if not (declared.isascii() and declared.isdigit()) or len(declared) > 18:
                await self._reject(send, 400, "Invalid Content-Length header.")
                return
            try:
                parsed_len = int(declared)
            except ValueError:
                await self._reject(send, 400, "Invalid Content-Length header.")
                return
            if parsed_len > limit:
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
        # R3-2: Throttle sweep to at most once per second regardless of table size
        if (now - _last_sweep >= SWEEP_INTERVAL_SECONDS or len(_HITS) > SWEEP_TABLE_SIZE) and (
            now - _last_sweep >= MIN_SWEEP_INTERVAL_SECONDS
        ):
            _sweep(now)
            _last_sweep = now

        key = (client, path)
        if key not in _HITS and len(_HITS) >= MAX_RATE_LIMIT_KEYS:
            # R3-2: Hard cap on _HITS: evict oldest entry to prevent unbounded table growth
            try:
                oldest_key = next(iter(_HITS))
                del _HITS[oldest_key]
            except (StopIteration, KeyError):
                pass

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


class ClientInFlightLimiter:
    """Per-client in-flight request tracking (C4, R3-1).

    Prevents one client IP from occupying all global concurrency slots.
    """

    def __init__(self, max_in_flight: int = DEFAULT_CLIENT_MAX_IN_FLIGHT) -> None:
        self.max_in_flight = max_in_flight
        self._counts: dict[str, int] = defaultdict(int)

    def acquire(self, key: str) -> bool:
        if self._counts[key] >= self.max_in_flight:
            return False
        self._counts[key] += 1
        return True

    def release(self, key: str) -> None:
        if key in self._counts:
            self._counts[key] -= 1
            if self._counts[key] <= 0:
                del self._counts[key]

    def clear(self) -> None:
        self._counts.clear()

    def count(self, key: str) -> int:
        return self._counts.get(key, 0)


_ask_in_flight: ClientInFlightLimiter | None = None
_scene_in_flight: ClientInFlightLimiter | None = None


def get_ask_in_flight_limiter() -> ClientInFlightLimiter:
    """Get process-wide in-flight limiter for /ask."""
    global _ask_in_flight
    if _ask_in_flight is None:
        cap = _int_env("ASK_CLIENT_MAX_CONCURRENCY", DEFAULT_CLIENT_MAX_IN_FLIGHT)
        _ask_in_flight = ClientInFlightLimiter(max_in_flight=cap)
    return _ask_in_flight


def get_scene_in_flight_limiter() -> ClientInFlightLimiter:
    """Get process-wide in-flight limiter for /scene."""
    global _scene_in_flight
    if _scene_in_flight is None:
        cap = _int_env("SCENE_CLIENT_MAX_CONCURRENCY", DEFAULT_CLIENT_MAX_IN_FLIGHT)
        _scene_in_flight = ClientInFlightLimiter(max_in_flight=cap)
    return _scene_in_flight


def reset_in_flight_limits() -> None:
    """Reset all in-flight tracking state (used by tests)."""
    global _ask_in_flight, _scene_in_flight
    if _ask_in_flight is not None:
        _ask_in_flight.clear()
    _ask_in_flight = None
    if _scene_in_flight is not None:
        _scene_in_flight.clear()
    _scene_in_flight = None


def request_client_key(request: Any) -> str:
    """Extract client key from a FastAPI/Starlette Request."""
    client = getattr(request, "client", None)
    peer = getattr(client, "host", None) if client else None
    if not isinstance(peer, str):
        peer = None
    headers = getattr(request, "headers", None)
    xff = None
    if headers is not None and hasattr(headers, "get"):
        val = headers.get("x-forwarded-for")
        if isinstance(val, str):
            xff = val
    return client_key(peer, xff, trusted_proxy_hops())
