"""NVIDIA hosted API vision provider (Task 8.1, F2).

Fallback vision provider using NVIDIA's OpenAI-compatible API.
Includes fit_image_for_inline to satisfy the inline image size limit.
Protects against decompression bombs, off-thread blocking, and malformed payload shapes.
"""

from __future__ import annotations

import asyncio
import base64
import os
from typing import Any

import cv2
import httpx
import numpy as np

from app.image_utils import MAX_IMAGE_PIXELS, sniff_image_dimensions
from app.vision._openai_compat import post_chat_completion, strip_fences
from app.vision.base import VisionError

DEFAULT_INLINE_LIMIT = 180_000  # bytes; hosted NVIDIA endpoints cap inline images


def fit_image_for_inline(image: bytes, max_bytes: int = DEFAULT_INLINE_LIMIT) -> bytes:
    """Downscale and re-encode with OpenCV if image exceeds max_bytes.

    Only applied to NVIDIA inline requests. Returns original bytes if already <= max_bytes
    or if the image cannot be decoded.
    Raises VisionError if image exceeds resolution cap.
    """
    if len(image) <= max_bytes:
        return image

    dims = sniff_image_dimensions(image)
    if dims is not None and dims[0] * dims[1] > MAX_IMAGE_PIXELS:
        raise VisionError(
            "nvidia",
            f"Image resolution ({dims[0]}x{dims[1]}) exceeds "
            f"{MAX_IMAGE_PIXELS // 1_000_000} MP limit",
        )

    decoded = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    if decoded is None:
        return image

    h, w = decoded.shape[:2]
    if h * w > MAX_IMAGE_PIXELS:
        raise VisionError(
            "nvidia",
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

        # Downscale and fit in worker thread if image exceeds inline limit
        fitted_image = await asyncio.to_thread(fit_image_for_inline, image, self.inline_limit)
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

        text = await post_chat_completion(
            name=self.name,
            base_url=self.base_url,
            api_key=self.api_key,
            body=body,
            timeout=timeout,
            client=self._client,
        )
        return strip_fences(text)

    async def complete(self, prompt: str, *, timeout: float) -> str:
        """Call NVIDIA hosted API to complete a text-only prompt (Task 9.1).

        Raises VisionError on any failure.
        """
        if not self.api_key:
            raise VisionError(self.name, "API key not configured")

        body: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            "temperature": 0.0,
            "max_tokens": 1024,
            "stream": False,
        }

        return await post_chat_completion(
            name=self.name,
            base_url=self.base_url,
            api_key=self.api_key,
            body=body,
            timeout=timeout,
            client=self._client,
        )
