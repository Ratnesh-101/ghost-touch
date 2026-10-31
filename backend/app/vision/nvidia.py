"""NVIDIA hosted API vision provider (Task 8.1).

Fallback vision provider using NVIDIA's OpenAI-compatible API.
Includes fit_image_for_inline to satisfy the inline image size limit.
"""

from __future__ import annotations

import base64
import os
import re
from typing import Any

import cv2
import httpx
import numpy as np

from app.vision.base import VisionError

DEFAULT_INLINE_LIMIT = 180_000  # bytes; hosted NVIDIA endpoints cap inline images


def fit_image_for_inline(image: bytes, max_bytes: int = DEFAULT_INLINE_LIMIT) -> bytes:
    """Downscale and re-encode with OpenCV if image exceeds max_bytes.

    Only applied to NVIDIA inline requests. Returns original bytes if already <= max_bytes
    or if the image cannot be decoded.
    """
    if len(image) <= max_bytes:
        return image

    decoded = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    if decoded is None:
        return image

    h, w = decoded.shape[:2]
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


def _redact_secrets(text: str, secret: str | None) -> str:
    """Redact secret string and Bearer tokens from text."""
    result = re.sub(r"Bearer\s+[A-Za-z0-9_\-\.]+", "Bearer [REDACTED]", text)
    if secret:
        result = result.replace(secret, "[REDACTED]")
    return result


class NvidiaProvider:
    """Vision provider using NVIDIA's OpenAI-compatible hosted API."""

    name: str = "nvidia"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        inline_limit: int = DEFAULT_INLINE_LIMIT,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.environ.get("NVIDIA_API_KEY", "")
        self.model = model or os.environ.get("NVIDIA_MODEL", "meta/llama-3.2-11b-vision-instruct")
        self.base_url = (
            base_url or os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
        ).rstrip("/")
        self.inline_limit = inline_limit
        self._client = client

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        """Call NVIDIA hosted API to extract diagram JSON from an image.

        Raises VisionError on any failure.
        """
        if not self.api_key:
            raise VisionError(self.name, "API key not configured")

        # Downscale and fit if image exceeds inline limit
        fitted_image = fit_image_for_inline(image, self.inline_limit)
        fitted_mime = "image/jpeg" if fitted_image != image else mime

        b64 = base64.b64encode(fitted_image).decode("ascii")
        data_url = f"data:{fitted_mime};base64,{b64}"

        body: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            "temperature": 0.0,
            "max_tokens": 4096,
            "stream": False,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        url = f"{self.base_url}/chat/completions"

        client_to_use = self._client or httpx.AsyncClient()
        try:
            try:
                response = await client_to_use.post(
                    url,
                    headers=headers,
                    json=body,
                    timeout=timeout,
                )
            finally:
                if self._client is None:
                    await client_to_use.aclose()
        except httpx.TimeoutException as exc:
            raise VisionError(self.name, f"request timed out after {timeout:.1f}s") from exc
        except httpx.RequestError as exc:
            msg = _redact_secrets(str(exc), self.api_key)
            raise VisionError(self.name, f"connection error: {msg}") from exc
        except Exception as exc:
            msg = _redact_secrets(str(exc), self.api_key)
            raise VisionError(self.name, f"request failed: {msg}") from exc

        if response.status_code == 429:
            raise VisionError(self.name, "rate limited (429)")
        if response.status_code >= 500:
            raise VisionError(self.name, f"server error ({response.status_code})")
        if response.status_code != 200:
            msg = _redact_secrets(response.text[:200], self.api_key)
            raise VisionError(self.name, f"HTTP {response.status_code}: {msg}")

        try:
            data = response.json()
        except Exception as exc:
            raise VisionError(self.name, f"invalid response JSON: {exc}") from exc

        choices = data.get("choices") or []
        if not choices:
            raise VisionError(self.name, "empty choices in response")

        content = choices[0].get("message", {}).get("content")
        if not content or not content.strip():
            raise VisionError(self.name, "empty content in response")

        # Unwrap markdown fences (```json ... ```)
        cleaned = re.sub(
            r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.IGNORECASE
        ).strip()
        return cleaned
