"""Shared plumbing for OpenAI-compatible chat-completions providers (OpenAI, Nebius).

One place for the POST, the status-code to VisionError mapping, response parsing, fence
stripping and secret redaction, so the providers cannot drift apart (review finding 5).
"""

from __future__ import annotations

import re
from typing import Any

import cv2
import httpx
import numpy as np

from app.image_utils import MAX_IMAGE_PIXELS, sniff_image_dimensions
from app.vision.base import VisionError

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)
_BEARER = re.compile(r"Bearer\s+[A-Za-z0-9_\-\.]+")
_SK_KEY = re.compile(r"(?:sk|nvapi|csk)-[A-Za-z0-9_\-]{8,}")


def redact_secrets(text: str, secret: str | None) -> str:
    """Remove the API key and any Bearer token from text that may reach logs or errors."""
    result = _BEARER.sub("Bearer [REDACTED]", text)
    result = _SK_KEY.sub("[REDACTED]", result)
    if secret:
        result = result.replace(secret, "[REDACTED]")
    return result


def strip_fences(text: str) -> str:
    """Unwrap a ```json ... ``` markdown fence around a model reply."""
    return _FENCE.sub("", text.strip()).strip()


def parse_chat_response(name: str, response: httpx.Response, api_key: str) -> str:
    """Map an HTTP response to the reply text, raising VisionError for every failure."""
    status = response.status_code
    if status == 429:
        raise VisionError(name, "rate limited (429)")
    if status in (401, 403):
        snippet = redact_secrets(response.text[:200], api_key)
        raise VisionError(name, f"authentication failed ({status}): {snippet}")
    if status >= 500:
        raise VisionError(name, f"server error ({status})")
    if status != 200:
        raise VisionError(name, f"HTTP {status}: {redact_secrets(response.text[:200], api_key)}")

    try:
        data = response.json()
    except Exception as exc:
        raise VisionError(name, f"invalid response JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise VisionError(name, f"invalid response JSON: expected dict, got {type(data).__name__}")
    choices = data.get("choices")
    if not choices or not isinstance(choices, list):
        raise VisionError(name, "empty choices in response")
    first = choices[0]
    message = first.get("message") if isinstance(first, dict) else None
    if not isinstance(message, dict):
        raise VisionError(name, "message in response is not an object")
    content = message.get("content")
    if not content or not isinstance(content, str) or not content.strip():
        raise VisionError(name, "empty content in response")
    return content.strip()


async def post_chat_completion(
    *,
    name: str,
    base_url: str,
    api_key: str,
    body: dict[str, Any],
    timeout: float,
    client: httpx.AsyncClient | None = None,
) -> str:
    """POST ``body`` to ``{base_url}/chat/completions`` and return the reply text."""
    if not api_key:
        raise VisionError(name, "API key not configured")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    url = f"{base_url}/chat/completions"
    http = client or httpx.AsyncClient()
    try:
        try:
            response = await http.post(url, headers=headers, json=body, timeout=timeout)
        finally:
            if client is None:
                await http.aclose()
    except httpx.TimeoutException as exc:
        raise VisionError(name, f"request timed out after {timeout:.1f}s") from exc
    except httpx.RequestError as exc:
        raise VisionError(name, f"connection error: {redact_secrets(str(exc), api_key)}") from exc
    except Exception as exc:
        raise VisionError(name, f"request failed: {redact_secrets(str(exc), api_key)}") from exc
    return parse_chat_response(name, response, api_key)


DEFAULT_INLINE_LIMIT = 180_000  # bytes


def fit_image_for_inline(
    image: bytes, max_bytes: int = DEFAULT_INLINE_LIMIT, provider: str = "nebius"
) -> bytes:
    """Downscale and re-encode with OpenCV if the image exceeds max_bytes.

    Returns the original bytes if already <= max_bytes or if the image cannot be decoded.
    Raises VisionError if the image exceeds the resolution cap.
    """
    if len(image) <= max_bytes:
        return image

    dims = sniff_image_dimensions(image)
    if dims is not None and dims[0] * dims[1] > MAX_IMAGE_PIXELS:
        raise VisionError(
            provider,
            f"Image resolution ({dims[0]}x{dims[1]}) exceeds "
            f"{MAX_IMAGE_PIXELS // 1_000_000} MP limit",
        )

    decoded = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    if decoded is None:
        return image

    h, w = decoded.shape[:2]
    if h * w > MAX_IMAGE_PIXELS:
        raise VisionError(
            provider,
            f"Image resolution ({w}x{h}) exceeds {MAX_IMAGE_PIXELS // 1_000_000} MP limit",
        )

    side = min(1024, max(h, w))
    last_buffer: bytes = image

    while side >= 128:
        scale = min(1.0, side / max(h, w))
        if scale < 1.0:
            small = cv2.resize(decoded, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        else:
            small = decoded

        for quality in (85, 70, 55, 40, 25):
            ok, buf = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, quality])
            if ok:
                last_buffer = buf.tobytes()
                if len(last_buffer) <= max_bytes:
                    return last_buffer
        side = int(side * 0.75)

    return last_buffer
