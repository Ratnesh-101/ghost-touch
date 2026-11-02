"""FastAPI application and routes for Ghost Touch (Task 8, F2).

Wires CORS, liveness probe (/api/v1/health), the scene pipeline
(POST /api/v1/scene) with Gemini primary, NVIDIA fallback, and OpenCV Raw Mode,
and the question answering endpoint (POST /api/v1/ask).
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Single import of validate_scene from the TEMP stub (Kiro replaces with app/validate.py in 8.3)
from app._temp.validate_stub import ValidationResult, validate_scene
from app.ask import AskRequest, AskResponse, answer_question
from app.image_utils import validate_image_bytes
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
RAW_MODE_RESERVE_SECONDS = 2.5  # Reserve inside 15s total budget for Raw Mode fallback

_cached_chain: ProviderChain | None = None


def reset_provider_chain() -> None:
    """Reset the cached provider chain (useful in tests when env changes)."""
    global _cached_chain
    _cached_chain = None


def get_validator() -> Callable[[str | dict[str, Any]], ValidationResult]:
    """Dependency provider for the scene validator."""
    return validate_scene


def get_provider_chain() -> ProviderChain:
    """Dependency provider for the vision provider chain.

    Builds the chain once per process and caches it (Finding 7).
    Can still be overridden per-request via app.dependency_overrides.
    """
    global _cached_chain
    if _cached_chain is None:
        _cached_chain = build_chain_from_env()
    return _cached_chain


def validate_env_settings() -> None:
    """Validate numeric and configuration environment settings at start-up with clear logging."""
    scene_timeout_raw = os.environ.get("SCENE_TIMEOUT_SECONDS", "15.0")
    try:
        val = float(scene_timeout_raw)
        if val <= 0:
            logger.warning("SCENE_TIMEOUT_SECONDS must be positive; using default 15.0s")
    except ValueError:
        logger.warning("Invalid SCENE_TIMEOUT_SECONDS '%s'; using default 15.0s", scene_timeout_raw)

    provider_timeout_raw = os.environ.get("PROVIDER_TIMEOUT_SECONDS", "8.0")
    try:
        val = float(provider_timeout_raw)
        if val <= 0:
            logger.warning("PROVIDER_TIMEOUT_SECONDS must be positive; using default 8.0s")
    except ValueError:
        logger.warning(
            "Invalid PROVIDER_TIMEOUT_SECONDS '%s'; using default 8.0s",
            provider_timeout_raw,
        )

    ask_timeout_raw = os.environ.get("ASK_TIMEOUT_SECONDS", "10.0")
    try:
        val = float(ask_timeout_raw)
        if val <= 0:
            logger.warning("ASK_TIMEOUT_SECONDS must be positive; using default 10.0s")
    except ValueError:
        logger.warning("Invalid ASK_TIMEOUT_SECONDS '%s'; using default 10.0s", ask_timeout_raw)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Validate settings and initialize provider chain at startup."""
    validate_env_settings()
    get_provider_chain()
    yield


app = FastAPI(
    title="Ghost Touch API",
    version="0.1.0",
    description="Turns a photo of a STEM diagram into a tactile DiagramScene.",
    lifespan=lifespan,
)

# CORS: allow frontend origins. expose_headers allows browser to read
# X-Vision-Provider (Finding 12).
_allowed = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
_origins = [o.strip() for o in _allowed.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Vision-Provider"],
)


@app.get("/api/v1/health")
async def health() -> dict[str, bool]:
    """Liveness probe. DoD: returns ``{"ok": true}``."""
    return {"ok": True}


@app.post("/api/v1/scene")
async def process_scene(
    request: Request,
    response: Response,
    image: Annotated[UploadFile, File(...)],
    chain: Annotated[ProviderChain, Depends(get_provider_chain)],
    validator: Annotated[
        Callable[[str | dict[str, Any]], ValidationResult], Depends(get_validator)
    ],
) -> dict[str, Any]:
    """Convert an uploaded diagram image into a validated DiagramScene.

    Pipeline:
      1. Validate file size (<=10 MB, streaming check) and content type.
      2. Verify magic bytes and pixel resolution cap (<=40 MP) without blocking.
      3. If zero providers configured -> Raw Mode (reason="no_provider").
      4. ProviderChain extracts raw JSON using the teacher-vocabulary prompt.
      5. validate_scene checks DiagramScene invariants.
      6. If invalid: retry once on the same provider with validation errors appended.
      7. If still invalid, provider fails, or deadline (15 s) exceeded -> OpenCV Raw Mode.
      8. Raw Mode scenes also pass through validate_scene before return.
      9. Response header X-Vision-Provider exposes provider name (gemini|nvidia|none).
    """
    start_time = time.monotonic()

    # Step 1: Content-Type header check
    content_type = (image.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported image format: '{content_type}'. "
                "Please upload a JPEG, PNG, or WebP image."
            ),
        )

    # Step 2: Content-Length check before buffering (Finding 8)
    cl_header = request.headers.get("content-length")
    if cl_header:
        try:
            if int(cl_header) > MAX_UPLOAD_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail="Image file exceeds 10 MB limit. Please upload a smaller image.",
                )
        except ValueError:
            pass

    # Read image in chunks to prevent large allocations
    chunks: list[bytes] = []
    total_read = 0
    chunk_size = 64 * 1024
    while True:
        chunk = await image.read(chunk_size)
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Image file exceeds 10 MB limit. Please upload a smaller image.",
            )
        chunks.append(chunk)

    image_bytes = b"".join(chunks)
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=422,
            detail="Empty image upload. Please provide a valid diagram image.",
        )

    # Step 3: Validate magic bytes, header integrity, and resolution cap (Finding 3)
    validate_image_bytes(image_bytes, content_type)

    try:
        total_deadline = float(os.environ.get("SCENE_TIMEOUT_SECONDS", "15.0"))
        if total_deadline <= 0:
            total_deadline = 15.0
    except ValueError:
        total_deadline = 15.0

    async def run_raw_mode(reason: str, provider_used: str = "none") -> dict[str, Any]:
        """Execute Raw Mode off the event loop within remaining total deadline."""
        elapsed = time.monotonic() - start_time
        remaining = max(0.5, total_deadline - elapsed)
        try:
            # Finding 4: execute build_raw_scene in worker thread with remaining deadline
            raw_scene = await asyncio.wait_for(
                asyncio.to_thread(build_raw_scene, image_bytes),
                timeout=remaining,
            )
        except TimeoutError as exc:
            raise HTTPException(
                status_code=504,
                detail="Diagram processing timed out. Please try again with a simpler image.",
            ) from exc
        except RawModeError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Could not process image: {exc}. Please upload a clear diagram photo.",
            ) from exc

        # Finding 5: detect empty scene (blank photo) and reject unvalidated raw scenes
        if (
            len(raw_scene.points) == 0
            and len(raw_scene.segments) == 0
            and len(raw_scene.bars) == 0
            and len(raw_scene.polylines) == 0
        ):
            raise HTTPException(
                status_code=422,
                detail="No diagram outlines detected in image. Please take a clearer photo.",
            )

        # Rule 5: Pass raw mode scenes through validator
        val_result = validator(raw_scene.model_dump())
        if val_result.scene is None:
            errors_msg = "; ".join(val_result.errors) if val_result.errors else "invalid scene"
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Extracted outline could not be validated: {errors_msg}. "
                    "Please upload a clearer photo."
                ),
            )

        final_scene = val_result.scene

        # Finding 11: Header is 'none' whenever mode is 'raw'
        response.headers["X-Vision-Provider"] = "none"
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

    # Step 4: Zero providers configured -> Raw Mode immediately
    if not chain.providers:
        return await run_raw_mode("no_provider", "none")

    used_provider_name = "none"
    if total_deadline > RAW_MODE_RESERVE_SECONDS:
        ai_budget = total_deadline - RAW_MODE_RESERVE_SECONDS
    else:
        ai_budget = max(0.05, total_deadline * 0.7)

    try:
        async with asyncio.timeout(ai_budget):
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
            remaining = ai_budget - (time.monotonic() - start_time)
            if remaining < 3.0:
                return await run_raw_mode("timeout", used_provider_name)

            provider = chain.get_provider(used_provider_name)
            if provider is None:
                return await run_raw_mode("invalid", used_provider_name)

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

            return await run_raw_mode("invalid", used_provider_name)

    except TimeoutError:
        return await run_raw_mode("timeout", used_provider_name)
    except VisionError as exc:
        logger.warning("All vision providers failed: %s", exc)
        return await run_raw_mode("provider_error", used_provider_name)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected error in scene pipeline: %s", exc)
        return await run_raw_mode("error", used_provider_name)


@app.post("/api/v1/ask", response_model=AskResponse)
async def ask_question_route(
    request: AskRequest,
    chain: Annotated[ProviderChain, Depends(get_provider_chain)],
) -> AskResponse:
    """Answer questions about a diagram scene (Task 9.1).

    Uses vision/language provider completion with fallback to deterministic facts lookup.
    """
    return await answer_question(request, chain)
