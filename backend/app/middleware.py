"""Security and caching middleware for Ghost Touch backend (SEC-07)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


class SecurityHeadersMiddleware:
    """Injects baseline security and cache headers on responses (SEC-07).

    - Sets 'X-Content-Type-Options: nosniff' on every HTTP response.
    - Sets 'Cache-Control: no-store' on JSON API responses (application/json).
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_security_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                raw_headers: list[tuple[bytes, bytes]] = list(message.get("headers", []))
                header_names = {h[0].lower() for h in raw_headers}

                if b"x-content-type-options" not in header_names:
                    raw_headers.append((b"x-content-type-options", b"nosniff"))

                is_json = False
                for name, value in raw_headers:
                    if name.lower() == b"content-type" and b"application/json" in value.lower():
                        is_json = True
                        break

                if is_json and b"cache-control" not in header_names:
                    raw_headers.append((b"cache-control", b"no-store"))

                message["headers"] = raw_headers
            await send(message)

        await self.app(scope, receive, send_with_security_headers)
