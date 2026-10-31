"""Gemini vision provider (Task 8.1).

Primary vision provider using Google GenAI SDK (gemini-3.8-flash default).
Configurable thinking budget to keep latency within the 15 s total budget.
"""

from __future__ import annotations

import asyncio
import os
import re
from typing import Any

from google import genai
from google.genai import errors, types

from app.vision.base import VisionError


def _redact_secrets(text: str, secret: str | None) -> str:
    """Strip secret string from message if present."""
    if not secret:
        return text
    return text.replace(secret, "[REDACTED]")


class GeminiProvider:
    """Vision provider using Google's Gemini models via the google-genai SDK."""

    name: str = "gemini"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        thinking_budget: int | None = None,
        client: Any | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.environ.get("GEMINI_API_KEY", "")
        self.model = model or os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
        if thinking_budget is not None:
            self.thinking_budget: int | None = thinking_budget
        else:
            budget_str = os.environ.get("GEMINI_THINKING_BUDGET", "0").strip()
            self.thinking_budget = int(budget_str) if budget_str else 0

        self._client = client or (genai.Client(api_key=self.api_key) if self.api_key else None)

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        """Call Gemini to extract diagram JSON from an image.

        Raises VisionError on any failure.
        """
        if not self._client:
            raise VisionError(self.name, "API key not configured")

        try:
            thinking_cfg = (
                types.ThinkingConfig(thinking_budget=self.thinking_budget)
                if self.thinking_budget is not None
                else None
            )
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
                thinking_config=thinking_cfg,
            )
            contents = [
                types.Part.from_bytes(data=image, mime_type=mime),
                prompt,
            ]
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self.model,
                    contents=contents,
                    config=config,
                ),
                timeout=timeout,
            )
        except TimeoutError as exc:
            raise VisionError(self.name, f"request timed out after {timeout:.1f}s") from exc
        except errors.APIError as exc:
            msg = _redact_secrets(str(exc), self.api_key)
            raise VisionError(self.name, f"API error ({exc.code}): {msg}") from exc
        except Exception as exc:
            msg = _redact_secrets(str(exc), self.api_key)
            raise VisionError(self.name, f"call failed: {msg}") from exc

        text = response.text
        if not text or not text.strip():
            raise VisionError(self.name, "empty response from gemini")

        # Unwrap markdown fences if present
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE).strip()
        return cleaned
