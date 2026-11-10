"""Gemini vision provider (Task 8.1, F2).

Primary vision provider using Google GenAI SDK (gemini-3.5-flash-lite default).
Robust thinking configuration supporting GEMINI_THINKING (off, minimal, low, medium,
high, default), deprecated GEMINI_THINKING_BUDGET alias, and automatic single retry
with process-level remembering if the model rejects thinking config.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import urllib.parse
from typing import Any

from google import genai
from google.genai import errors, types

from app.paid_budget import try_consume
from app.vision.base import VisionError

logger = logging.getLogger(__name__)

# PRIVACY.md §6.2 regex scrubbers for API keys and tokens
_BEARER = re.compile(r"Bearer\s+[A-Za-z0-9_\-\.]+", re.IGNORECASE)
_SK_KEY = re.compile(r"(?:sk|nvapi|csk)-[A-Za-z0-9_\-]{8,}", re.IGNORECASE)
_AIZA_KEY = re.compile(r"AIza[0-9A-Za-z_\-]{20,}", re.IGNORECASE)
_PARAM_KEY = re.compile(
    r"(?i)\b(key|api[_-]?key|x-goog-api-key)['\"]?\s*(=|:|\s*:\s*)\s*['\"]?([^&\s,\'\")\[\]]+)['\"]?"
)

# Process-level state: once thinking is rejected by Gemini, disable for the lifetime of process
_process_disable_thinking: bool = False


def reset_process_thinking_state() -> None:
    """Reset the process-level thinking disabled flag (primarily for tests)."""
    global _process_disable_thinking
    _process_disable_thinking = False


def _redact_secrets(text: Any, secret: str | None = None) -> str:
    """Strip secret string, API keys, and bearer tokens from error text (Finding 1)."""
    raw = str(text) if text is not None else ""
    if not raw:
        return ""

    result = raw

    # 1. Bearer tokens (PRIVACY.md §6.2)
    result = _BEARER.sub("Bearer [REDACTED]", result)

    # 2. sk / nvapi / csk keys
    result = _SK_KEY.sub("[REDACTED]", result)

    # 3. Google AIza key shape
    result = _AIZA_KEY.sub("[REDACTED]", result)

    # 4. Parameter and header keys: key=..., api_key=..., x-goog-api-key:...
    def _param_repl(m: re.Match[str]) -> str:
        param = m.group(1)
        sep = m.group(2)
        if ":" in sep:
            return f"{param}: [REDACTED]"
        return f"{param}=[REDACTED]"

    result = _PARAM_KEY.sub(_param_repl, result)

    # 5. Literal configured secret and its URL-encoded / percent-encoded variants
    target_secret = secret if (secret and secret.strip()) else os.environ.get("GEMINI_API_KEY", "")
    if target_secret and target_secret.strip():
        clean_sec = target_secret.strip()
        variants: set[str] = {clean_sec}
        try:
            q = urllib.parse.quote(clean_sec, safe="")
            variants.add(q)
            variants.add(re.sub(r"%([0-9a-fA-F]{2})", lambda m: f"%{m.group(1).lower()}", q))
            variants.add(re.sub(r"%([0-9a-fA-F]{2})", lambda m: f"%{m.group(1).upper()}", q))
            qp = urllib.parse.quote_plus(clean_sec, safe="")
            variants.add(qp)
            variants.add(re.sub(r"%([0-9a-fA-F]{2})", lambda m: f"%{m.group(1).lower()}", qp))
            variants.add(re.sub(r"%([0-9a-fA-F]{2})", lambda m: f"%{m.group(1).upper()}", qp))
        except Exception:
            pass

        for var in sorted(variants, key=len, reverse=True):
            if var and len(var) >= 4:
                result = re.sub(re.escape(var), "[REDACTED]", result, flags=re.IGNORECASE)

    return result


# Export alias matching _openai_compat.py
redact_secrets = _redact_secrets


def _is_thinking_error(exc: Exception) -> bool:
    """Check if an exception indicates the model rejected the thinking config."""
    msg = str(exc).lower()
    return "thinking" in msg and (
        "invalid" in msg
        or "not supported" in msg
        or "budget" in msg
        or getattr(exc, "code", None) == 400
        or isinstance(exc, (errors.APIError, errors.ClientError, ValueError))
    )


class GeminiProvider:
    """Vision provider using Google's Gemini models via the google-genai SDK."""

    name: str = "gemini"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        thinking: str | None = None,
        thinking_budget: int | None = None,
        client: Any | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.environ.get("GEMINI_API_KEY", "")
        self.model = model or os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
        self._raw_thinking = thinking
        self._raw_thinking_budget = thinking_budget
        self._client = client or (genai.Client(api_key=self.api_key) if self.api_key else None)

    def get_thinking_config(self) -> types.ThinkingConfig | None:
        """Resolve ThinkingConfig from settings, respecting process-level disable flag."""
        global _process_disable_thinking
        if _process_disable_thinking:
            return None

        # 1. Explicit parameter in constructor or GEMINI_THINKING env var
        setting = self._raw_thinking
        if setting is None:
            setting = os.environ.get("GEMINI_THINKING")

        # 2. If GEMINI_THINKING not set, check deprecated GEMINI_THINKING_BUDGET
        if setting is None or not setting.strip():
            budget_val = self._raw_thinking_budget
            if budget_val is None:
                budget_str = os.environ.get("GEMINI_THINKING_BUDGET", "").strip()
                if budget_str:
                    try:
                        budget_val = int(budget_str)
                    except ValueError:
                        logger.warning(
                            "Invalid GEMINI_THINKING_BUDGET '%s'; using default minimal thinking",
                            budget_str,
                        )
                        budget_val = None

            if budget_val is not None:
                if budget_val == 0:
                    return types.ThinkingConfig(thinking_budget=0)
                elif budget_val > 0:
                    return types.ThinkingConfig(thinking_budget=budget_val)

        # 3. Parse setting string (default 'minimal')
        mode = (setting or "minimal").strip().lower()

        if mode == "off":
            return types.ThinkingConfig(thinking_budget=0)
        elif mode == "minimal":
            return types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL)
        elif mode == "low":
            return types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW)
        elif mode == "medium":
            return types.ThinkingConfig(thinking_level=types.ThinkingLevel.MEDIUM)
        elif mode == "high":
            return types.ThinkingConfig(thinking_level=types.ThinkingLevel.HIGH)
        elif mode == "default":
            return None
        else:
            logger.warning(
                "Invalid GEMINI_THINKING setting '%s'; falling back to default 'minimal'",
                setting,
            )
            return types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL)

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        """Call Gemini to extract diagram JSON from an image.

        Raises VisionError on any failure.
        """
        global _process_disable_thinking
        if not self._client:
            raise VisionError(self.name, "API key not configured", transient=False)

        if not try_consume(1):
            raise VisionError(self.name, "paid call budget exhausted", transient=False)

        thinking_cfg = self.get_thinking_config()
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0,
            thinking_config=thinking_cfg,
        )
        contents = [
            types.Part.from_bytes(data=image, mime_type=mime),
            prompt,
        ]

        try:
            try:
                response = await asyncio.wait_for(
                    self._client.aio.models.generate_content(
                        model=self.model,
                        contents=contents,
                        config=config,
                    ),
                    timeout=timeout,
                )
            except Exception as initial_exc:
                if thinking_cfg is not None and _is_thinking_error(initial_exc):
                    logger.warning(
                        "Gemini rejected thinking config (%s); retrying once without thinking "
                        "and remembering choice for process",
                        _redact_secrets(str(initial_exc), self.api_key),
                    )
                    _process_disable_thinking = True
                    if not try_consume(1):
                        raise VisionError(
                            self.name, "paid call budget exhausted", transient=False
                        ) from initial_exc
                    retry_config = types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.0,
                        thinking_config=None,
                    )
                    response = await asyncio.wait_for(
                        self._client.aio.models.generate_content(
                            model=self.model,
                            contents=contents,
                            config=retry_config,
                        ),
                        timeout=timeout,
                    )
                else:
                    raise
        except TimeoutError as exc:
            raise VisionError(
                self.name, f"request timed out after {timeout:.1f}s", transient=False
            ) from exc
        except errors.APIError as exc:
            msg = _redact_secrets(str(exc), self.api_key)
            code = getattr(exc, "code", None)
            raise VisionError(
                self.name, f"API error ({exc.code}): {msg}", status_code=code
            ) from None
        except Exception as exc:
            msg = _redact_secrets(str(exc), self.api_key)
            raise VisionError(self.name, f"call failed: {msg}") from None

        try:
            text = response.text
        except Exception as exc:
            msg = _redact_secrets(str(exc), self.api_key)
            raise VisionError(self.name, f"failed reading response text: {msg}") from None

        if not text or not text.strip():
            raise VisionError(self.name, "empty response from gemini")

        # Unwrap markdown fences if present
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE).strip()
        return cleaned

    async def complete(self, prompt: str, *, timeout: float) -> str:
        """Call Gemini to complete a text-only prompt (Task 9.1).

        Raises VisionError on any failure.
        """
        global _process_disable_thinking
        if not self._client:
            raise VisionError(self.name, "API key not configured", transient=False)

        if not try_consume(1):
            raise VisionError(self.name, "paid call budget exhausted", transient=False)

        thinking_cfg = self.get_thinking_config()
        config = types.GenerateContentConfig(
            temperature=0.0,
            thinking_config=thinking_cfg,
            max_output_tokens=256,
        )

        try:
            try:
                response = await asyncio.wait_for(
                    self._client.aio.models.generate_content(
                        model=self.model,
                        contents=prompt,
                        config=config,
                    ),
                    timeout=timeout,
                )
            except Exception as initial_exc:
                if thinking_cfg is not None and _is_thinking_error(initial_exc):
                    logger.warning(
                        "Gemini rejected thinking config (%s) during ask; retrying once without "
                        "thinking and remembering choice for process",
                        _redact_secrets(str(initial_exc), self.api_key),
                    )
                    _process_disable_thinking = True
                    if not try_consume(1):
                        raise VisionError(
                            self.name, "paid call budget exhausted", transient=False
                        ) from initial_exc
                    retry_config = types.GenerateContentConfig(
                        temperature=0.0,
                        thinking_config=None,
                        max_output_tokens=256,
                    )
                    response = await asyncio.wait_for(
                        self._client.aio.models.generate_content(
                            model=self.model,
                            contents=prompt,
                            config=retry_config,
                        ),
                        timeout=timeout,
                    )
                else:
                    raise
        except TimeoutError as exc:
            raise VisionError(
                self.name, f"request timed out after {timeout:.1f}s", transient=False
            ) from exc
        except errors.APIError as exc:
            msg = _redact_secrets(str(exc), self.api_key)
            code = getattr(exc, "code", None)
            raise VisionError(
                self.name, f"API error ({exc.code}): {msg}", status_code=code
            ) from None
        except Exception as exc:
            msg = _redact_secrets(str(exc), self.api_key)
            raise VisionError(self.name, f"call failed: {msg}") from None

        try:
            text = response.text
        except Exception as exc:
            msg = _redact_secrets(str(exc), self.api_key)
            raise VisionError(self.name, f"failed reading response text: {msg}") from None

        if not text or not text.strip():
            raise VisionError(self.name, "empty response from gemini")

        return text.strip()
