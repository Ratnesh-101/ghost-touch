"""Nebius Token Factory vision provider: the last fallback in the chain.

Nebius exposes an OpenAI-compatible Chat Completions API. Environment:
    NEBIUS_API_KEY    required (a provider without a key is skipped at start-up)
    NEBIUS_MODEL      vision-capable model id (default ``openbmb/MiniCPM-V-4_5``)
    NEBIUS_TEXT_MODEL optional text-only model id for ``complete`` (Ask); defaults to NEBIUS_MODEL.
                      Text-only models such as ``nvidia/Nemotron-3-Ultra-550b-a55b`` reject images,
                      so they can only be used here, never in NEBIUS_MODEL.
    NEBIUS_BASE_URL   default ``https://api.tokenfactory.nebius.com/v1``

This is also the key used for bulk test runs, spike runs and other "labour", so that the
Gemini free tier and the OpenAI budget are kept for real use.
"""

from __future__ import annotations

import asyncio
import base64
import os
from typing import Any

import httpx

from app.vision._openai_compat import fit_image_for_inline, post_chat_completion, strip_fences

DEFAULT_MODEL = "openbmb/MiniCPM-V-4_5"
DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1"
INLINE_LIMIT = 1_500_000  # bytes; keeps requests small and fast without hurting diagram detail
EXTRACT_MAX_TOKENS = 4096
COMPLETE_MAX_TOKENS = 1024


class NebiusProvider:
    """Vision and text provider using Nebius Token Factory's OpenAI-compatible API."""

    name: str = "nebius"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        inline_limit: int = INLINE_LIMIT,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.environ.get("NEBIUS_API_KEY", "")
        self.model = model or os.environ.get("NEBIUS_MODEL", "").strip() or DEFAULT_MODEL
        self.text_model = os.environ.get("NEBIUS_TEXT_MODEL", "").strip() or self.model
        self.base_url = (
            base_url or os.environ.get("NEBIUS_BASE_URL", "").strip() or DEFAULT_BASE_URL
        ).rstrip("/")
        self.inline_limit = inline_limit
        self._client = client

    def _body(self, content: Any, max_tokens: int, model: str | None = None) -> dict[str, Any]:
        return {
            "model": model or self.model,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0.0,
            "max_tokens": max_tokens,
            "stream": False,
        }

    async def _post(self, body: dict[str, Any], timeout: float) -> str:
        return await post_chat_completion(
            name=self.name,
            base_url=self.base_url,
            api_key=self.api_key,
            body=body,
            timeout=timeout,
            client=self._client,
        )

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        """Extract diagram JSON text from an image. Raises VisionError on any failure."""
        fitted = await asyncio.to_thread(fit_image_for_inline, image, self.inline_limit)
        fitted_mime = "image/jpeg" if fitted is not image else mime
        data_url = f"data:{fitted_mime};base64,{base64.b64encode(fitted).decode('ascii')}"
        content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": data_url}},
        ]
        text = await self._post(self._body(content, EXTRACT_MAX_TOKENS), timeout)
        return strip_fences(text)

    async def complete(self, prompt: str, *, timeout: float) -> str:
        """Complete a text-only prompt (used by Ask). Raises VisionError on any failure."""
        return await self._post(self._body(prompt, COMPLETE_MAX_TOKENS, self.text_model), timeout)
