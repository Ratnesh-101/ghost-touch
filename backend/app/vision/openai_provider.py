"""OpenAI vision provider: the first fallback after Gemini.

Uses the Chat Completions API over httpx (no SDK). Environment:
    OPENAI_API_KEY   required (a provider without a key is skipped at start-up)
    OPENAI_MODEL     default ``gpt-4.1-mini`` (non-reasoning, vision capable, fast)
    OPENAI_BASE_URL  default ``https://api.openai.com/v1``

Parameters are chosen by model family: ``gpt-4*`` models get ``temperature=0``; newer reasoning
models (``gpt-5*``, ``o*``) reject a non-default temperature and spend completion tokens on
reasoning, so they get no temperature and a larger token cap.
"""

from __future__ import annotations

import base64
import os
from typing import Any

import httpx

from app.paid_budget import try_consume
from app.vision._openai_compat import post_chat_completion, strip_fences
from app.vision.base import VisionError

DEFAULT_MODEL = "gpt-4.1-mini"
DEFAULT_BASE_URL = "https://api.openai.com/v1"
EXTRACT_MAX_TOKENS = 4096
EXTRACT_MAX_TOKENS_REASONING = 16384
COMPLETE_MAX_TOKENS = 256
COMPLETE_MAX_TOKENS_REASONING = 1024


def _is_gpt4_family(model: str) -> bool:
    return model.lower().startswith("gpt-4")


class OpenAIProvider:
    """Vision and text provider using OpenAI's Chat Completions API."""

    name: str = "openai"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.environ.get("OPENAI_API_KEY", "")
        self.model = model or os.environ.get("OPENAI_MODEL", "").strip() or DEFAULT_MODEL
        self.base_url = (
            base_url or os.environ.get("OPENAI_BASE_URL", "").strip() or DEFAULT_BASE_URL
        ).rstrip("/")
        self._client = client

    def _body(self, content: Any, *, extract: bool) -> dict[str, Any]:
        gpt4 = _is_gpt4_family(self.model)
        if extract:
            max_tokens = EXTRACT_MAX_TOKENS if gpt4 else EXTRACT_MAX_TOKENS_REASONING
        else:
            max_tokens = COMPLETE_MAX_TOKENS if gpt4 else COMPLETE_MAX_TOKENS_REASONING
        body: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": content}],
            "max_completion_tokens": max_tokens,
        }
        if gpt4:
            body["temperature"] = 0
        if extract:
            # The prompt asks for JSON, which json_object mode requires to be mentioned.
            body["response_format"] = {"type": "json_object"}
        return body

    async def _post(self, body: dict[str, Any], timeout: float) -> str:
        """POST to /chat/completions and return the reply text. Raises VisionError."""
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
        if not try_consume(1):
            raise VisionError(self.name, "paid call budget exhausted", transient=False)
        data_url = f"data:{mime};base64,{base64.b64encode(image).decode('ascii')}"
        content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
        ]
        text = await self._post(self._body(content, extract=True), timeout)
        return strip_fences(text)

    async def complete(self, prompt: str, *, timeout: float) -> str:
        """Complete a text-only prompt (used by Ask). Raises VisionError on any failure."""
        if not try_consume(1):
            raise VisionError(self.name, "paid call budget exhausted", transient=False)
        return await self._post(self._body(prompt, extract=False), timeout)
