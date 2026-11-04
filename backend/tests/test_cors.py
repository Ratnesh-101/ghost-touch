"""Tests for CORS configuration and ALLOWED_ORIGINS parsing (Lane A / Deploy prep).

Verifies:
- Comma-separated origins, trailing slashes, and surrounding whitespace are parsed cleanly.
- Preflight (OPTIONS) requests from allowed origins succeed with expected CORS headers.
- Preflight (OPTIONS) requests from disallowed origins are rejected.
- Expose headers include X-Vision-Provider and X-Scene-Cache.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.main import app, parse_allowed_origins


def test_parse_allowed_origins_empty_and_none() -> None:
    """Empty or None inputs return an empty list."""
    assert parse_allowed_origins(None) == []
    assert parse_allowed_origins("") == []
    assert parse_allowed_origins("   ") == []


def test_parse_allowed_origins_single_and_trailing_slash() -> None:
    """Trailing slashes are stripped so browser Origin matches."""
    assert parse_allowed_origins("https://ghost-touch.vercel.app") == [
        "https://ghost-touch.vercel.app"
    ]
    assert parse_allowed_origins("https://ghost-touch.vercel.app/") == [
        "https://ghost-touch.vercel.app"
    ]
    assert parse_allowed_origins("https://ghost-touch.vercel.app///") == [
        "https://ghost-touch.vercel.app"
    ]


def test_parse_allowed_origins_comma_list_and_whitespace() -> None:
    """Comma lists with arbitrary spacing and trailing slashes are parsed cleanly."""
    raw = " https://ghost-touch.vercel.app/ , http://localhost:5173/ ,  "
    expected = ["https://ghost-touch.vercel.app", "http://localhost:5173"]
    assert parse_allowed_origins(raw) == expected


def test_parse_allowed_origins_deduplication() -> None:
    """Duplicate origins (with or without trailing slash) are deduplicated."""
    raw = "https://app.vercel.app, https://app.vercel.app/, http://localhost:5173"
    assert parse_allowed_origins(raw) == [
        "https://app.vercel.app",
        "http://localhost:5173",
    ]


def test_cors_preflight_allowed_origin() -> None:
    """Preflight OPTIONS request from an allowed origin returns 200 and CORS headers."""
    client = TestClient(app)
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "GET" in response.headers["access-control-allow-methods"]


def test_cors_preflight_disallowed_origin() -> None:
    """Preflight OPTIONS request from an unauthorized origin is rejected."""
    client = TestClient(app)
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "https://unauthorized-attacker.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    # Starlette CORSMiddleware rejects disallowed preflight with 400
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_cors_preflight_post_scene() -> None:
    """Preflight OPTIONS request for POST /api/v1/scene from allowed origin succeeds."""
    client = TestClient(app)
    response = client.options(
        "/api/v1/scene",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_actual_request_allowed_origin() -> None:
    """A simple GET request with allowed Origin returns Access-Control-Allow-Origin."""
    client = TestClient(app)
    response = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    # Finding 12: expose headers for vision provider and cache status
    exposed = response.headers.get("access-control-expose-headers", "")
    assert "X-Vision-Provider" in exposed
    assert "X-Scene-Cache" in exposed


def test_cors_actual_request_disallowed_origin() -> None:
    """A simple GET request from disallowed Origin does not include CORS allow header."""
    client = TestClient(app)
    response = client.get(
        "/api/v1/health",
        headers={"Origin": "https://disallowed.example.com"},
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_cors_parsed_trailing_slash_works_with_browser_origin() -> None:
    """When env contains trailing slash, browser (which omits trailing slash) is accepted."""
    test_app = FastAPI()
    test_origins = parse_allowed_origins("https://production.vercel.app/")
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=test_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @test_app.get("/ping")
    def ping() -> dict[str, str]:
        return {"ping": "pong"}

    client = TestClient(test_app)
    # Browser sends Origin without trailing slash per RFC 6454
    response = client.options(
        "/ping",
        headers={
            "Origin": "https://production.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://production.vercel.app"
