"""Regression and security fix tests for lane x1-w2-fixes.

Covers:
- Finding 1 (HIGH): API key, URL-encoded key, AIza shape, parameter and bearer token
  scrubbing in gemini.py before logging or error raising.
- Finding 2 (MED): Multi-line X-Forwarded-For alignment between RequestGuardMiddleware
  and request_client_key using extract_joined_xff across TRUSTED_PROXY_HOPS 0, 1, and 2.
- Finding 5 (LOW): WebP extended VP8X canvas dimension parsing with leading metadata chunks,
  12 MP cap preservation, and rejection of truncated headers.
"""

from __future__ import annotations

import asyncio
import gc
import inspect
import os
import struct
import urllib.parse
import warnings
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.image_utils import sniff_image_dimensions, validate_image_bytes
from app.limits import (
    RequestGuardMiddleware,
    extract_joined_xff,
    request_client_key,
)
from app.vision.base import VisionError
from app.vision.gemini import GeminiProvider, _redact_secrets

# =============================================================================
# Finding 1 (HIGH): Secret Scrubbing in gemini.py
# =============================================================================


def test_gemini_redact_secrets_plain_and_url_encoded_variants() -> None:
    """Configured key in plain, URL-encoded, percent-encoded, and query forms is scrubbed."""
    key = "AIzaSyD_FakeSecretKey1234567890ABCDEF"
    encoded_lower = urllib.parse.quote(key, safe="").lower()
    encoded_upper = urllib.parse.quote(key, safe="").upper()

    error_text = (
        f"API call failed: https://generativelanguage.googleapis.com/v1beta/models?key={key} "
        f"raw_key={key} encoded_low={encoded_lower} encoded_up={encoded_upper} "
        f"Bearer ya29.fake-token-12345 sk-ant-api03-abcdefgh12345678"
    )

    scrubbed = _redact_secrets(error_text, key)

    # Secret key material must not be present in any form
    assert key not in scrubbed
    assert encoded_lower not in scrubbed
    assert encoded_upper not in scrubbed
    assert "ya29.fake-token-12345" not in scrubbed
    assert "sk-ant-api03-abcdefgh12345678" not in scrubbed
    assert "key=[REDACTED]" in scrubbed
    assert "Bearer [REDACTED]" in scrubbed
    assert "[REDACTED]" in scrubbed


def test_gemini_redact_secrets_preserves_ordinary_error_text() -> None:
    """Standard error messages without secrets or tokens remain unmodified."""
    ordinary_msg = "Resource has been exhausted (e.g. check quota). Please retry in 15s."
    key = "AIzaSyD_FakeSecretKey1234567890ABCDEF"

    scrubbed = _redact_secrets(ordinary_msg, key)
    assert scrubbed == ordinary_msg


def test_gemini_redact_secrets_parameter_and_header_formats() -> None:
    """Query parameters (api_key=, key=) and headers (x-goog-api-key:) are redacted."""
    raw = (
        "Details: x-goog-api-key: secret-header-value-xyz, "
        "api_key='custom-api-key-val', api-key=\"another-key\""
    )
    scrubbed = _redact_secrets(raw)
    assert "secret-header-value-xyz" not in scrubbed
    assert "custom-api-key-val" not in scrubbed
    assert "another-key" not in scrubbed
    assert "x-goog-api-key: [REDACTED]" in scrubbed
    assert "api_key=[REDACTED]" in scrubbed
    assert "api-key=[REDACTED]" in scrubbed


def test_gemini_redact_secrets_handles_exception_instance() -> None:
    """_redact_secrets accepts an Exception instance directly."""
    key = "AIzaSyD_ExceptionKey1234567890"
    exc = ValueError(f"Connection error to endpoint with key={key}")
    scrubbed = _redact_secrets(exc, key)
    assert key not in scrubbed
    assert "key=[REDACTED]" in scrubbed


def test_gemini_provider_extract_scrubs_error_in_vision_error() -> None:
    """GeminiProvider.extract catches client exceptions and redacts key material."""
    key = "AIzaSyD_VisionErrorKey123456789"
    mock_client = AsyncMock()
    mock_client.aio.models.generate_content.side_effect = RuntimeError(
        f"SDK error requesting url https://generativelanguage.googleapis.com?key={key}"
    )

    with patch("app.vision.gemini.try_consume", return_value=True):
        provider = GeminiProvider(api_key=key, client=mock_client)
        with pytest.raises(VisionError) as exc_info:
            asyncio.run(provider.extract(b"fake_image", "image/png", "prompt", timeout=5.0))

    error_message = str(exc_info.value)
    assert key not in error_message
    assert "key=[REDACTED]" in error_message


# =============================================================================
# Finding 2 (MED): Multi-line X-Forwarded-For Alignment in limits.py
# =============================================================================


def test_extract_joined_xff_merges_multiple_headers() -> None:
    """extract_joined_xff merges multiple header lines with comma separation."""
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/scene",
        "headers": [
            (b"x-forwarded-for", b"203.0.113.1"),
            (b"x-forwarded-for", b"198.51.100.2"),
        ],
    }
    req = Request(scope)
    joined = extract_joined_xff(req.headers)
    assert joined == "203.0.113.1, 198.51.100.2"


@pytest.mark.filterwarnings("ignore:coroutine '.*' was never awaited:RuntimeWarning")
def test_extract_joined_xff_handles_mock_coroutine_getlist_fallback() -> None:
    """extract_joined_xff safely falls back to .get() when .getlist() returns non-iterable."""

    # 1. Realistic mock: plain MagicMock where getlist returns a coroutine, but get returns a str
    async def _dummy_coro() -> list[str]:
        return []

    coro = _dummy_coro()
    mock_headers = MagicMock()
    mock_headers.getlist.return_value = coro
    mock_headers.get.return_value = "192.0.2.1"

    assert extract_joined_xff(mock_headers) == "192.0.2.1"
    coro.close()

    # Also verify with getlist as an AsyncMock and get returning str
    mock_headers_async = MagicMock()
    mock_headers_async.getlist = AsyncMock()
    mock_headers_async.get = MagicMock(return_value="192.0.2.1")
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="coroutine '.*' was never awaited",
            category=RuntimeWarning,
        )
        assert extract_joined_xff(mock_headers_async) == "192.0.2.1"

    # 2. Second assertion with a fully-AsyncMock headers object expecting None
    fully_async_headers = AsyncMock()
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="coroutine '.*' was never awaited",
            category=RuntimeWarning,
        )
        assert extract_joined_xff(fully_async_headers) is None

    # Clean up any unawaited mock coroutines across garbage collection
    for obj in gc.get_objects():
        if inspect.iscoroutine(obj):
            try:
                obj.close()
            except Exception:
                pass

    # 3. Object without getlist or get returns None without raising
    assert extract_joined_xff(12345) is None
    assert extract_joined_xff(None) is None


@pytest.mark.parametrize(
    ("hops", "expected_key"),
    [
        (0, "10.0.0.1"),  # Peer address when 0 trusted proxy hops
        (1, "198.51.100.2"),  # Rightmost hop (line 2)
        (2, "203.0.113.1"),  # Second from right (line 1)
    ],
)
def test_rate_limiter_and_in_flight_limiter_produce_same_key_for_all_hops(
    hops: int, expected_key: str
) -> None:
    """Both RequestGuardMiddleware and request_client_key produce identical client keys."""
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/scene",
        "client": ("10.0.0.1", 45678),
        "headers": [
            (b"x-forwarded-for", b"203.0.113.1"),
            (b"x-forwarded-for", b"198.51.100.2"),
        ],
    }
    req = Request(scope)

    with patch.dict(os.environ, {"TRUSTED_PROXY_HOPS": str(hops)}):
        middleware_key = RequestGuardMiddleware._client_key(scope)
        in_flight_key = request_client_key(req)

        assert middleware_key == expected_key
        assert in_flight_key == expected_key
        assert middleware_key == in_flight_key


def test_ipv6_duplicate_xff_headers_produce_same_cidr_key() -> None:
    """Duplicate XFF headers with IPv6 addresses normalize to matching /64 CIDR."""
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/ask",
        "client": ("10.0.0.1", 54321),
        "headers": [
            (b"x-forwarded-for", b"192.0.2.1"),
            (b"x-forwarded-for", b"2001:db8:85a3::8a2e:370:7334"),
        ],
    }
    req = Request(scope)

    with patch.dict(os.environ, {"TRUSTED_PROXY_HOPS": "1"}):
        middleware_key = RequestGuardMiddleware._client_key(scope)
        in_flight_key = request_client_key(req)

        assert middleware_key == "2001:db8:85a3::/64"
        assert in_flight_key == "2001:db8:85a3::/64"
        assert middleware_key == in_flight_key


# =============================================================================
# Finding 5 (LOW): WebP Extended VP8X Canvas Parsing in image_utils.py
# =============================================================================


def _make_vp8x_bytes(width: int, height: int, leading_chunks: bytes = b"") -> bytes:
    """Build a minimal valid RIFF WEBP VP8X byte stream."""
    w_bytes = struct.pack("<I", width - 1)[:3]
    h_bytes = struct.pack("<I", height - 1)[:3]
    flags = b"\x00\x00\x00\x00"
    vp8x_payload = flags + w_bytes + h_bytes  # 10 bytes
    vp8x_chunk = b"VP8X" + struct.pack("<I", 10) + vp8x_payload  # 18 bytes

    payload = leading_chunks + vp8x_chunk
    riff_len = 4 + len(payload)
    return b"RIFF" + struct.pack("<I", riff_len) + b"WEBP" + payload


def _make_vp8_bytes(width: int, height: int) -> bytes:
    """Build a minimal valid RIFF WEBP VP8 (lossy) byte stream."""
    frame_header = (
        b"\x00\x00\x00"  # 3-byte frame tag
        b"\x9d\x01\x2a"  # 3-byte start code
        + struct.pack("<H", width & 0x3FFF)
        + struct.pack("<H", height & 0x3FFF)
    )
    chunk = b"VP8 " + struct.pack("<I", len(frame_header)) + frame_header
    riff_len = 4 + len(chunk)
    return b"RIFF" + struct.pack("<I", riff_len) + b"WEBP" + chunk


def _make_vp8l_bytes(width: int, height: int) -> bytes:
    """Build a minimal valid RIFF WEBP VP8L (lossless) byte stream."""
    val = ((width - 1) & 0x3FFF) | (((height - 1) & 0x3FFF) << 14)
    packed_dims = struct.pack("<I", val)
    payload = b"\x2f" + packed_dims
    chunk = b"VP8L" + struct.pack("<I", len(payload)) + payload
    riff_len = 4 + len(chunk)
    return b"RIFF" + struct.pack("<I", riff_len) + b"WEBP" + chunk


def test_sniff_image_dimensions_vp8x_standard() -> None:
    """Sniffs width and height from standard VP8X header."""
    data = _make_vp8x_bytes(800, 600)
    dims = sniff_image_dimensions(data)
    assert dims == (800, 600)


def test_sniff_image_dimensions_vp8x_with_leading_iccp_chunk() -> None:
    """Sniffs width and height from VP8X preceded by an ICCP metadata chunk."""
    iccp_data = b"sample_icc_profile_data"
    pad = b"\x00" if len(iccp_data) % 2 == 1 else b""
    iccp_chunk = b"ICCP" + struct.pack("<I", len(iccp_data)) + iccp_data + pad

    data = _make_vp8x_bytes(1024, 768, leading_chunks=iccp_chunk)
    dims = sniff_image_dimensions(data)
    assert dims == (1024, 768)


def test_sniff_image_dimensions_vp8_and_vp8l_still_pass() -> None:
    """Existing VP8 and VP8L sniffing continues to pass correctly."""
    vp8_data = _make_vp8_bytes(640, 480)
    assert sniff_image_dimensions(vp8_data) == (640, 480)

    vp8l_data = _make_vp8l_bytes(320, 240)
    assert sniff_image_dimensions(vp8l_data) == (320, 240)


def test_sniff_image_dimensions_vp8x_truncated_rejected() -> None:
    """Truncated VP8X headers are rejected with None and 422."""
    full_data = _make_vp8x_bytes(800, 600)
    truncated = full_data[:24]  # Missing height bytes

    assert sniff_image_dimensions(truncated) is None

    with pytest.raises(HTTPException) as exc_info:
        validate_image_bytes(truncated)
    assert exc_info.value.status_code == 422


def test_validate_image_bytes_vp8x_resolution_cap_enforced() -> None:
    """VP8X images exceeding 12 MP are rejected with HTTP 422."""
    # 4000 x 3001 = 12,004,000 pixels (> 12,000,000)
    data = _make_vp8x_bytes(4000, 3001)

    assert sniff_image_dimensions(data) == (4000, 3001)

    with pytest.raises(HTTPException) as exc_info:
        validate_image_bytes(data)
    assert exc_info.value.status_code == 422
    assert "exceeds maximum allowed 12 megapixels" in exc_info.value.detail
