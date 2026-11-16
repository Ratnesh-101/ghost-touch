"""Tests for CORS hardening, origin filtering, and information leak prevention (Lane hx3).

Covers:
1. filter_production_origins in production (drops '*' and non-https, logs error count without values).
2. CORS methods and headers restrictions (allow_methods GET, POST, OPTIONS; allow_headers Content-Type).
3. Preflight from unlisted origins gets no access-control-allow-origin header.
4. Information leak checks:
   - Line ~361: improve pass logs len(errors) integer count, not error strings.
   - Line ~719: POST /api/v1/scene returns fixed outline validation failure detail with no validator text.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import (
    _run_improve_pass_locked,
    app,
    create_app,
    filter_production_origins,
    get_provider_chain,
    get_validator,
)
from app.validate import ValidationResult
from app.vision.chain import ProviderChain


def _make_test_image(width: int = 400, height: int = 300) -> bytes:
    """Create a test PNG image with geometric shapes."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.rectangle(img, (50, 50), (200, 200), (255, 255, 255), 3)
    cv2.circle(img, (300, 150), 40, (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


# ===========================================================================
# 1. filter_production_origins Tests
# ===========================================================================


def test_filter_production_origins_non_production_keeps_all(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """In non-production, wildcards and http origins are kept unchanged, no error logged."""
    monkeypatch.setenv("ENVIRONMENT", "development")
    origins = ["*", "http://localhost:5173", "https://example.com"]
    filtered = filter_production_origins(origins)
    assert filtered == origins


def test_filter_production_origins_production_drops_wildcard_and_http(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """In production, drop '*' and non-https origins, log one error with count only."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    raw_origins = [
        "*",
        "http://insecure.example.com",
        "http://localhost:5173",
        "https://ghost-touch.vercel.app",
        "ftp://sketchy.example.com",
        "https://secure-secondary.example.com",
    ]

    with caplog.at_level(logging.ERROR):
        filtered = filter_production_origins(raw_origins)

    # Only https:// origins survive
    assert filtered == [
        "https://ghost-touch.vercel.app",
        "https://secure-secondary.example.com",
    ]

    # Exactly 4 origins were dropped: '*', 2x 'http://', 1x 'ftp://'
    # Check that error is logged naming the count, but NOT the origin values
    assert "Dropped 4 disallowed origin(s)" in caplog.text or "Dropped 4 origin(s)" in caplog.text
    assert "http://insecure.example.com" not in caplog.text
    assert "http://localhost:5173" not in caplog.text
    assert "ftp://sketchy.example.com" not in caplog.text


def test_filter_production_origins_production_all_valid(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """In production, when origins start with https://, nothing is dropped and no error logged."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    origins = ["https://ghost-touch.vercel.app", "https://another.vercel.app"]

    with caplog.at_level(logging.ERROR):
        filtered = filter_production_origins(origins)

    assert filtered == origins
    assert "Dropped" not in caplog.text


# ===========================================================================
# 2. CORS Preflight & Methods/Headers Restrictions
# ===========================================================================


def test_cors_preflight_allowed_methods_and_headers() -> None:
    """Preflight for GET, POST, OPTIONS with Content-Type header succeeds."""
    client = TestClient(app)

    # POST with Content-Type header from allowed origin
    resp_post = client.options(
        "/api/v1/scene",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert resp_post.status_code == 200
    assert resp_post.headers["access-control-allow-origin"] == "http://localhost:5173"
    allowed_methods = resp_post.headers.get("access-control-allow-methods", "")
    assert "POST" in allowed_methods
    assert "GET" in allowed_methods
    assert "OPTIONS" in allowed_methods

    # GET request method
    resp_get = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp_get.status_code == 200
    assert resp_get.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_preflight_disallowed_method_rejected() -> None:
    """Preflight with method outside ['GET', 'POST', 'OPTIONS'] is rejected."""
    client = TestClient(app)
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "DELETE",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_cors_preflight_disallowed_header_rejected() -> None:
    """Preflight requesting headers outside ['Content-Type'] is rejected."""
    client = TestClient(app)
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "x-custom-unauthorized",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_cors_preflight_unlisted_origin_gets_no_allow_header() -> None:
    """Preflight from an unlisted origin receives no access-control-allow-origin header (test c)."""
    client = TestClient(app)
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "https://unauthorized-attacker.example.org",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_cors_production_app_drops_wildcard_and_http_origins(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """In production, app drops '*' and 'http://x', so they receive no allow-origin header."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv(
        "ALLOWED_ORIGINS",
        "*,http://x,https://production.ghost-touch.app",
    )

    prod_app = create_app()
    client = TestClient(prod_app)

    # 1. Origin '*' preflight gets no allow-origin header
    resp_wild = client.options(
        "/api/v1/health",
        headers={
            "Origin": "*",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in resp_wild.headers

    # 2. Origin 'http://x' preflight gets no allow-origin header
    resp_http = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://x",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in resp_http.headers

    # 3. Origin 'https://production.ghost-touch.app' preflight succeeds
    resp_https = client.options(
        "/api/v1/health",
        headers={
            "Origin": "https://production.ghost-touch.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp_https.status_code == 200
    assert resp_https.headers["access-control-allow-origin"] == "https://production.ghost-touch.app"


# ===========================================================================
# 3. Information Leak Prevention Tests (DO item 2)
# ===========================================================================


def test_improve_pass_logs_error_count_not_list(caplog: pytest.LogCaptureFixture) -> None:
    """Line ~361: Background improve pass logs len(val_result.errors), not the error list."""

    class DummyProvider:
        name = "dummy-improve"

        async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
            return "raw model output"

    secret_error_1 = "INTERNAL_LEAK_SECRET_KEY_123"
    secret_error_2 = "SENSITIVE_VALIDATOR_PATH_/usr/local/secret"

    def failing_validator(raw: Any) -> ValidationResult:
        return ValidationResult(
            scene=None,
            errors=[secret_error_1, secret_error_2],
        )

    caplog.set_level(logging.INFO)
    with caplog.at_level(logging.INFO, logger="app.main"):
        asyncio.run(
            _run_improve_pass_locked(
                improve_provider=DummyProvider(),  # type: ignore[arg-type]
                image_bytes=b"dummy_image_data",
                content_type="image/png",
                cache_key="test_cache_key",
                validator=failing_validator,
            )
        )

    # Must log the count 2
    assert "discarded (2)" in caplog.text
    # Must NOT leak the validator error messages
    assert secret_error_1 not in caplog.text
    assert secret_error_2 not in caplog.text


def test_raw_mode_validation_failure_returns_fixed_detail_without_validator_text() -> None:
    """Line ~719: POST /api/v1/scene returns fixed detail without leaking validator error text."""
    secret_validator_leak = "INTERNAL_SCHEMA_FAILURE_FIELD_XY_COLLISION"

    def failing_validator(raw: Any) -> ValidationResult:
        return ValidationResult(
            scene=None,
            errors=[secret_validator_leak],
        )

    # Override dependencies: empty chain forces raw mode, failing_validator checks output detail
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])
    app.dependency_overrides[get_validator] = lambda: failing_validator
    try:
        client = TestClient(app)
        img_bytes = _make_test_image()

        response = client.post(
            "/api/v1/scene",
            files={"image": ("test.png", img_bytes, "image/png")},
        )
        assert response.status_code == 422
        body = response.json()
        assert (
            body["detail"]
            == "Extracted outline could not be validated. Please upload a clearer photo."
        )
        assert secret_validator_leak not in response.text
    finally:
        app.dependency_overrides.clear()
