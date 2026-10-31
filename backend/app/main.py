"""FastAPI application and routes for Ghost Touch (Task 8).

Wires CORS, liveness probe (/api/v1/health), and the scene pipeline
(POST /api/v1/scene) with Gemini primary, NVIDIA fallback, and OpenCV Raw Mode.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import Callable
from typing import Annotated, Any

from fastapi import Depends, FastAPI, File, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Single import of validate_scene from the TEMP stub (Kiro replaces with app/validate.py in 8.3)
from app._temp.validate_stub import ValidationResult, validate_scene
from app.raw_mode import RawModeError, build_raw_scene
from app.vision import ProviderChain, VisionError, build_chain_from_env
from app.vision.prompts import build_prompt

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


def get_validator() -> Callable[[str | dict[str, Any]], ValidationResult]:
    """Dependency provider for the scene validator."""
    return validate_scene


def get_provider_chain() -> ProviderChain:
    """Dependency provider for the vision provider chain."""
    return build_chain_from_env()


app = FastAPI(
    title="Ghost Touch API",
    version="0.1.0",
    description="Turns a photo of a STEM diagram into a tactile DiagramScene.",
)

# CORS: allow the frontend origin(s). Configurable via env, no wildcard.
_allowed = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
_origins = [o.strip() for o in _allowed.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
async def health() -> dict[str, bool]:
    """Liveness probe. DoD: returns ``{"ok": true}``."""
    return {"ok": True}


@app.post("/api/v1/scene")
async def process_scene(
    response: Response,
    image: Annotated[UploadFile, File(...)],
    chain: Annotated[ProviderChain, Depends(get_provider_chain)],
    validator: Annotated[
        Callable[[str | dict[str, Any]], ValidationResult], Depends(get_validator)
    ],
) -> dict[str, Any]:
    """Convert an uploaded diagram image into a validated DiagramScene.

    Pipeline:
      1. Validate file size (<=10 MB) and type (JPEG/PNG/WebP).
      2. If zero providers configured -> Raw Mode (reason="no_provider").
      3. ProviderChain extracts raw JSON using the teacher-vocabulary prompt.
      4. validate_scene checks DiagramScene invariants.
      5. If invalid: retry once on the same provider with validation errors appended.
      6. If still invalid, provider fails, or deadline (15 s) exceeded -> OpenCV Raw Mode.
      7. Raw Mode scenes also pass through validate_scene before return.
      8. Response header X-Vision-Provider exposes provider name (gemini|nvidia|none).
    """
    start_time = time.monotonic()
    content_type = (image.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported image format: '{content_type}'. "
                "Please upload a JPEG, PNG, or WebP image."
            ),
        )

    image_bytes = await image.read()
    if len(image_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image file exceeds 10 MB limit. Please upload a smaller image.",
        )
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=422,
            detail="Empty image upload. Please provide a valid diagram image.",
        )

    try:
        total_deadline = float(os.environ.get("SCENE_TIMEOUT_SECONDS", "15.0"))
    except ValueError:
        total_deadline = 15.0

    def build_raw_mode_response(reason: str, provider_used: str = "none") -> dict[str, Any]:
        try:
            raw_scene = build_raw_scene(image_bytes)
        except RawModeError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Could not process image: {exc}. Please upload a clear diagram photo.",
            ) from exc

        # Rule 5: Pass raw mode scenes through validate_scene before returning
        val_result = validator(raw_scene.model_dump())
        final_scene = val_result.scene if val_result.scene is not None else raw_scene

        response.headers["X-Vision-Provider"] = provider_used
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        logger.info(
            "scene processed: provider=%s mode=raw reason=%s elapsed_ms=%d",
            provider_used,
            reason,
            elapsed_ms,
        )
        return {
            "scene": final_scene.model_dump(),
            "mode": "raw",
            "reason": reason,
        }

    # Step 2: Zero providers configured -> Raw Mode immediately
    if not chain.providers:
        return build_raw_mode_response("no_provider", "none")

    used_provider_name = "none"

    try:
        async with asyncio.timeout(total_deadline):
            initial_prompt = build_prompt()
            raw_text, used_provider_name = await chain.extract(
                image_bytes, content_type, initial_prompt
            )
            result = validator(raw_text)

            if result.scene is not None:
                response.headers["X-Vision-Provider"] = used_provider_name
                elapsed_ms = int((time.monotonic() - start_time) * 1000)
                logger.info(
                    "scene processed: provider=%s mode=ai reason=none elapsed_ms=%d",
                    used_provider_name,
                    elapsed_ms,
                )
                return {
                    "scene": result.scene.model_dump(),
                    "mode": "ai",
                }

            # Step 5: One validation retry on the same provider that answered
            remaining = total_deadline - (time.monotonic() - start_time)
            if remaining < 3.0:
                return build_raw_mode_response("timeout", used_provider_name)

            provider = chain.get_provider(used_provider_name)
            if provider is None:
                return build_raw_mode_response("invalid", used_provider_name)

            retry_prompt = build_prompt(result.errors)
            retry_timeout = min(remaining, chain.call_timeout)
            retry_raw = await provider.extract(
                image_bytes, content_type, retry_prompt, timeout=retry_timeout
            )
            retry_result = validator(retry_raw)

            if retry_result.scene is not None:
                response.headers["X-Vision-Provider"] = used_provider_name
                elapsed_ms = int((time.monotonic() - start_time) * 1000)
                logger.info(
                    "scene processed: provider=%s mode=ai reason=none (after retry) elapsed_ms=%d",
                    used_provider_name,
                    elapsed_ms,
                )
                return {
                    "scene": retry_result.scene.model_dump(),
                    "mode": "ai",
                }

            return build_raw_mode_response("invalid", used_provider_name)

    except TimeoutError:
        return build_raw_mode_response("timeout", used_provider_name)
    except VisionError as exc:
        logger.warning("All vision providers failed: %s", exc)
        return build_raw_mode_response("provider_error", used_provider_name)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected error in scene pipeline: %s", exc)
        return build_raw_mode_response("error", used_provider_name)
