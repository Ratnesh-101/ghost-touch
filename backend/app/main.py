"""FastAPI application and routes for Ghost Touch (Task 8, F2, Lane T11b).

Wires CORS, liveness probe (/api/v1/health), the scene pipeline
(POST /api/v1/scene) with Gemini primary, OpenAI and Nebius fallbacks, and OpenCV Raw Mode,
the question answering endpoint (POST /api/v1/ask),
and diagram scene validation (POST /api/v1/validate).
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import time
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from app.ask import AskRequest, AskResponse, _check_scene_size, answer_question
from app.graphs.route import graph_scene_from_chain
from app.image_utils import validate_image_bytes
from app.limits import MULTIPART_OVERHEAD, RequestGuardMiddleware, default_rate_limits
from app.middleware import SecurityHeadersMiddleware
from app.raw_mode import RawModeError, build_raw_scene
from app.scene_cache import image_key, scene_cache
from app.schema import DiagramScene
from app.validate import ValidationResult, validate_scene
from app.vision import (
    GeminiProvider,
    ProviderChain,
    VisionError,
    VisionProvider,
    build_chain_from_env,
)
from app.vision._openai_compat import close_shared_client
from app.vision.prompts import build_prompt

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ASK_DISCONNECT_POLL_SECONDS = 0.25  # how often a running /ask call checks for a hang-up
MAX_VALIDATE_POLYLINE_POINTS = 1000  # /validate keeps its own structural limit (/ask allows 2000)
MAX_ASK_BODY_SIZE = 512 * 1024  # a scene plus a 500-character question is far smaller
MAX_VALIDATE_BODY_SIZE = 512 * 1024  # scene JSON for teacher correct validation
RAW_MODE_RESERVE_SECONDS = 2.5  # Reserve inside 15s total budget for Raw Mode fallback
DEFAULT_SCENE_MAX_CONCURRENCY = 2
DEFAULT_SCENE_QUEUE_WAIT_SECONDS = 6.0
DEFAULT_ASK_MAX_CONCURRENCY = 4
DEFAULT_ASK_QUEUE_WAIT_SECONDS = 5.0

_cached_chain: ProviderChain | None = None
_scene_semaphore: asyncio.Semaphore | None = None
_ask_semaphore: asyncio.Semaphore | None = None
_improve_semaphore: asyncio.Semaphore | None = None
DEFAULT_IMPROVE_MAX_CONCURRENCY = 1


def parse_scene_max_concurrency() -> int:
    """Parse SCENE_MAX_CONCURRENCY env var (default 2, min 1 with warning)."""
    raw = os.environ.get("SCENE_MAX_CONCURRENCY")
    if raw is None or not raw.strip():
        return DEFAULT_SCENE_MAX_CONCURRENCY
    try:
        val = int(raw)
        if val < 1:
            logger.warning(
                "SCENE_MAX_CONCURRENCY must be at least 1; using default %d",
                DEFAULT_SCENE_MAX_CONCURRENCY,
            )
            return DEFAULT_SCENE_MAX_CONCURRENCY
        return val
    except (ValueError, TypeError):
        logger.warning(
            "Invalid SCENE_MAX_CONCURRENCY '%s'; using default %d",
            raw,
            DEFAULT_SCENE_MAX_CONCURRENCY,
        )
        return DEFAULT_SCENE_MAX_CONCURRENCY


def parse_scene_queue_wait_seconds() -> float:
    """Parse SCENE_QUEUE_WAIT_SECONDS env var (default 6.0, non-negative with warning)."""
    raw = os.environ.get("SCENE_QUEUE_WAIT_SECONDS")
    if raw is None or not raw.strip():
        return DEFAULT_SCENE_QUEUE_WAIT_SECONDS
    try:
        val = float(raw)
        if val < 0:
            logger.warning(
                "SCENE_QUEUE_WAIT_SECONDS must be non-negative; using default %.1fs",
                DEFAULT_SCENE_QUEUE_WAIT_SECONDS,
            )
            return DEFAULT_SCENE_QUEUE_WAIT_SECONDS
        return val
    except (ValueError, TypeError):
        logger.warning(
            "Invalid SCENE_QUEUE_WAIT_SECONDS '%s'; using default %.1fs",
            raw,
            DEFAULT_SCENE_QUEUE_WAIT_SECONDS,
        )
        return DEFAULT_SCENE_QUEUE_WAIT_SECONDS


async def acquire_slot(sem: asyncio.Semaphore, wait_seconds: float) -> None:
    """Take a slot, waiting at most `wait_seconds`; raises TimeoutError when none frees up.

    A free slot is always taken. `asyncio.wait_for(..., timeout=0)` would raise even when the
    semaphore is free, which made a wait of 0 mean "always busy".
    """
    if not sem.locked():
        await sem.acquire()
        return
    await asyncio.wait_for(sem.acquire(), timeout=wait_seconds)


def get_scene_semaphore() -> asyncio.Semaphore:
    """Get or create the process-wide scene processing semaphore."""
    global _scene_semaphore
    if _scene_semaphore is None:
        cap = parse_scene_max_concurrency()
        _scene_semaphore = asyncio.Semaphore(cap)
    return _scene_semaphore


def reset_scene_semaphore() -> None:
    """Reset the scene semaphore (for testing)."""
    global _scene_semaphore
    _scene_semaphore = None


def parse_ask_max_concurrency() -> int:
    """Parse ASK_MAX_CONCURRENCY env var (default 4, min 1 with warning)."""
    raw = os.environ.get("ASK_MAX_CONCURRENCY")
    if raw is None or not raw.strip():
        return DEFAULT_ASK_MAX_CONCURRENCY
    try:
        val = int(raw)
        if val < 1:
            logger.warning(
                "ASK_MAX_CONCURRENCY must be at least 1; using default %d",
                DEFAULT_ASK_MAX_CONCURRENCY,
            )
            return DEFAULT_ASK_MAX_CONCURRENCY
        return val
    except (ValueError, TypeError):
        logger.warning(
            "Invalid ASK_MAX_CONCURRENCY '%s'; using default %d",
            raw,
            DEFAULT_ASK_MAX_CONCURRENCY,
        )
        return DEFAULT_ASK_MAX_CONCURRENCY


def parse_ask_queue_wait_seconds() -> float:
    """Parse ASK_QUEUE_WAIT_SECONDS env var (default 5.0, non-negative with warning)."""
    raw = os.environ.get("ASK_QUEUE_WAIT_SECONDS")
    if raw is None or not raw.strip():
        return DEFAULT_ASK_QUEUE_WAIT_SECONDS
    try:
        val = float(raw)
        if val < 0:
            logger.warning(
                "ASK_QUEUE_WAIT_SECONDS must be non-negative; using default %.1fs",
                DEFAULT_ASK_QUEUE_WAIT_SECONDS,
            )
            return DEFAULT_ASK_QUEUE_WAIT_SECONDS
        return val
    except (ValueError, TypeError):
        logger.warning(
            "Invalid ASK_QUEUE_WAIT_SECONDS '%s'; using default %.1fs",
            raw,
            DEFAULT_ASK_QUEUE_WAIT_SECONDS,
        )
        return DEFAULT_ASK_QUEUE_WAIT_SECONDS


def get_ask_semaphore() -> asyncio.Semaphore:
    """Get or create the process-wide ask processing semaphore."""
    global _ask_semaphore
    if _ask_semaphore is None:
        cap = parse_ask_max_concurrency()
        _ask_semaphore = asyncio.Semaphore(cap)
    return _ask_semaphore


def reset_ask_semaphore() -> None:
    """Reset the ask semaphore (for testing)."""
    global _ask_semaphore
    _ask_semaphore = None


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


def get_improve_provider() -> VisionProvider | None:
    """Dependency provider for the asynchronous improve-pass vision provider (Lane B).

    Returns a GeminiProvider configured with GEMINI_IMPROVE_MODEL (opt-in: unset means off,
    because each scan would otherwise spend a second Gemini request on the free tier)
    if GEMINI_API_KEY is present and the model is not disabled ('none', 'off', 'false', '0').
    Can be overridden in tests via app.dependency_overrides[get_improve_provider].
    """
    model = os.environ.get("GEMINI_IMPROVE_MODEL", "").strip()
    if not model or model.lower() in ("none", "off", "false", "0"):
        return None
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    return GeminiProvider(api_key=api_key, model=model)


def get_improve_semaphore() -> asyncio.Semaphore:
    """Process-wide cap on background improve passes (A6-10).

    Set `IMPROVE_MAX_CONCURRENCY` to change it; the default is 1.
    """
    global _improve_semaphore
    if _improve_semaphore is None:
        try:
            cap = int(
                os.environ.get("IMPROVE_MAX_CONCURRENCY", str(DEFAULT_IMPROVE_MAX_CONCURRENCY))
            )
        except ValueError:
            cap = DEFAULT_IMPROVE_MAX_CONCURRENCY
        _improve_semaphore = asyncio.Semaphore(cap if cap >= 1 else DEFAULT_IMPROVE_MAX_CONCURRENCY)
    return _improve_semaphore


def reset_improve_semaphore() -> None:
    """Reset the improve-pass semaphore (for testing)."""
    global _improve_semaphore
    _improve_semaphore = None


async def run_improve_pass(
    improve_provider: VisionProvider,
    image_bytes: bytes,
    content_type: str,
    cache_key: str,
    validator: Callable[[str | dict[str, Any]], ValidationResult],
) -> None:
    """Run stronger model in a non-blocking background task (Lane B).

    If it returns a valid scene, stores it in the cache under the same image hash so
    subsequent requests get the improved scene. Never fails or delays the primary response,
    and never caches failures. Best effort and bounded: when every improve slot is busy the
    pass is skipped, so a burst of scenes cannot fan out into unlimited paid model calls.
    """
    sem = get_improve_semaphore()
    if sem.locked():
        logger.info("Background improve pass skipped: all improve slots are busy")
        return
    async with sem:
        await _run_improve_pass_locked(
            improve_provider, image_bytes, content_type, cache_key, validator
        )


async def _run_improve_pass_locked(
    improve_provider: VisionProvider,
    image_bytes: bytes,
    content_type: str,
    cache_key: str,
    validator: Callable[[str | dict[str, Any]], ValidationResult],
) -> None:
    try:
        timeout = float(os.environ.get("IMPROVE_TIMEOUT_SECONDS", "30.0"))
        if timeout <= 0:
            timeout = 30.0
    except ValueError:
        timeout = 30.0

    try:
        logger.info("Starting background improve pass using provider '%s'", improve_provider.name)
        raw_text = await improve_provider.extract(
            image_bytes,
            content_type,
            build_prompt(),
            timeout=timeout,
        )
        val_result = validator(raw_text)
        if val_result.scene is not None:
            improved_payload = {
                "scene": val_result.scene.model_dump(),
                "mode": "ai",
            }
            scene_cache.put(cache_key, improved_payload, improve_provider.name)
            logger.info("Background improve pass succeeded; updated cache for %s", cache_key)
        else:
            logger.info(
                "Background improve pass returned invalid scene; discarded (%s)",
                val_result.errors,
            )
    except Exception as exc:
        logger.warning("Background improve pass failed: %s", exc)


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


def parse_allowed_origins(raw: str | None) -> list[str]:
    """Parse ALLOWED_ORIGINS string into a list of normalized origin URLs.

    Handles comma-separated lists, trailing slashes, and surrounding whitespace.
    """
    if not raw:
        return []
    origins: list[str] = []
    for item in raw.split(","):
        cleaned = item.strip()
        if not cleaned:
            continue
        while len(cleaned) > 1 and cleaned.endswith("/"):
            cleaned = cleaned.rstrip("/")
        if cleaned and cleaned not in origins:
            origins.append(cleaned)
    return origins


def is_production() -> bool:
    """Check if current environment is production (SEC-08)."""
    return os.environ.get("ENVIRONMENT", "").strip().lower() == "production"


router = APIRouter()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Validate settings and initialize provider chain at startup."""
    validate_env_settings()
    allowed = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
    origins = parse_allowed_origins(allowed)
    logger.info("allowed CORS origins: %s", origins)
    get_provider_chain()
    try:
        yield
    finally:
        await close_shared_client()


def create_app() -> FastAPI:
    """Create FastAPI application configured for current environment (SEC-07, SEC-08)."""
    prod = is_production()
    docs_url = None if prod else "/docs"
    redoc_url = None if prod else "/redoc"
    openapi_url = None if prod else "/openapi.json"

    app_instance = FastAPI(
        title="Ghost Touch API",
        version="0.1.0",
        description="Turns a photo of a STEM diagram into a tactile DiagramScene.",
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
    )

    allowed = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
    origins = parse_allowed_origins(allowed)

    app_instance.add_middleware(
        RequestGuardMiddleware,
        body_limits={
            "/api/v1/scene": MAX_UPLOAD_SIZE + MULTIPART_OVERHEAD,
            "/api/v1/ask": MAX_ASK_BODY_SIZE,
            "/api/v1/validate": MAX_VALIDATE_BODY_SIZE,
        },
        rate_limits=default_rate_limits(),
    )

    app_instance.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Vision-Provider", "X-Scene-Cache"],
    )

    app_instance.add_middleware(SecurityHeadersMiddleware)
    app_instance.include_router(router)
    return app_instance


app = create_app()


@router.get("/api/v1/health")
async def health() -> dict[str, bool]:
    """Liveness probe. DoD: returns ``{"ok": true}``."""
    return {"ok": True}


@router.post("/api/v1/scene")
async def process_scene(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    image: Annotated[UploadFile, File(...)],
    chain: Annotated[ProviderChain, Depends(get_provider_chain)],
    validator: Annotated[
        Callable[[str | dict[str, Any]], ValidationResult], Depends(get_validator)
    ],
    improve_provider: Annotated[VisionProvider | None, Depends(get_improve_provider)] = None,
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
      9. Response header X-Vision-Provider exposes provider name (gemini|openai|nebius|none).
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

    # A repeated image (a demo, a retry) is served from the cache of validated AI scenes, so it
    # costs no provider quota. Failures and Raw Mode results are never cached.
    cache_key = image_key(image_bytes, build_prompt())
    cached = scene_cache.get(cache_key)
    if cached is not None:
        cached_payload, cached_provider = cached
        response.headers["X-Vision-Provider"] = cached_provider
        response.headers["X-Scene-Cache"] = "HIT"
        logger.info("scene served from cache: provider=%s", cached_provider)
        return cached_payload

    sem = get_scene_semaphore()
    wait_seconds = parse_scene_queue_wait_seconds()
    try:
        await acquire_slot(sem, wait_seconds)
    except TimeoutError as exc:
        raise HTTPException(
            status_code=503,
            detail="Server is busy processing other diagram requests. reason: queue_timeout",
            headers={"Retry-After": "5"},
        ) from exc

    try:
        # SEC-03: Client disconnect check before vision processing
        if await request.is_disconnected():
            logger.info("Client disconnected before vision chain; aborting")
            return Response(status_code=499)

        try:
            total_deadline = float(os.environ.get("SCENE_TIMEOUT_SECONDS", "15.0"))
            if total_deadline <= 0:
                total_deadline = 15.0
        except ValueError:
            total_deadline = 15.0

        async def run_raw_mode(reason: str, provider_used: str = "none") -> dict[str, Any]:
            """Execute Raw Mode off the event loop within remaining total deadline."""
            if await request.is_disconnected():
                logger.info("Client disconnected before raw mode; aborting")
                return Response(status_code=499)

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

        provider_state = {"name": "none"}
        if total_deadline > RAW_MODE_RESERVE_SECONDS:
            ai_budget = total_deadline - RAW_MODE_RESERVE_SECONDS
        else:
            ai_budget = max(0.05, total_deadline * 0.7)
        ai_deadline = start_time + ai_budget

        def ai_payload(scene: Any, provider: str, note: str = "") -> dict[str, Any]:
            response.headers["X-Vision-Provider"] = provider
            elapsed_ms = int((time.monotonic() - start_time) * 1000)
            logger.info(
                "scene processed: provider=%s mode=ai reason=none%s elapsed_ms=%d",
                provider,
                note,
                elapsed_ms,
            )
            return {"scene": scene.model_dump(), "mode": "ai"}

        async def attempt_ai() -> tuple[dict[str, Any] | None, str]:
            """One AI extraction plus at most one validation retry.

            Returns (payload, "") on success or (None, fallback_reason). Raw Mode is NOT run here,
            so the AI deadline can never cancel it half way (it runs once, after this returns).
            """
            raw_text, provider_state["name"] = await chain.extract(
                image_bytes, content_type, build_prompt(), deadline=ai_deadline
            )
            used = provider_state["name"]
            result = validator(raw_text)
            if result.scene is not None:
                if result.scene.kind == "function_graph":
                    # A traced curve is imprecise: read the equation and sample it ourselves.
                    sampled = await sampled_graph_scene()
                    if sampled is not None:
                        return ai_payload(sampled, used, " (equation route)"), ""
                return ai_payload(result.scene, used), ""

            # One validation retry on the same provider that answered
            remaining = ai_deadline - time.monotonic()
            if remaining < 3.0:
                return None, "timeout"
            provider = chain.get_provider(used)
            if provider is None:
                return None, "invalid"

            retry_raw = await provider.extract(
                image_bytes,
                content_type,
                build_prompt(result.errors),
                timeout=min(remaining, chain.call_timeout),
            )
            retry_result = validator(retry_raw)
            if retry_result.scene is not None:
                return ai_payload(retry_result.scene, used, " (after retry)"), ""

            # Last attempt before Raw Mode: it may be a function graph the tracer could not draw.
            rescued = await sampled_graph_scene()
            if rescued is not None:
                return ai_payload(rescued, used, " (equation rescue)"), ""
            return None, "invalid"

        async def sampled_graph_scene() -> Any | None:
            """A validated function_graph scene sampled from the model's equation, or None."""
            spec_scene = await graph_scene_from_chain(chain, image_bytes, content_type, ai_deadline)
            if spec_scene is None:
                return None
            return validator(spec_scene).scene

        payload: dict[str, Any] | None = None
        fallback_reason = "error"
        try:
            async with asyncio.timeout(ai_budget):
                payload, fallback_reason = await attempt_ai()
        except TimeoutError:
            fallback_reason = "timeout"
        except VisionError as exc:
            logger.warning("All vision providers failed: %s", exc)
            fallback_reason = "provider_error"
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Unexpected error in scene pipeline: %s", exc)
            fallback_reason = "error"

        if payload is not None:
            scene_cache.put(cache_key, payload, provider_state["name"])
            response.headers["X-Scene-Cache"] = "MISS"
            if improve_provider is not None:
                background_tasks.add_task(
                    run_improve_pass,
                    improve_provider=improve_provider,
                    image_bytes=image_bytes,
                    content_type=content_type,
                    cache_key=cache_key,
                    validator=validator,
                )
            return payload
        return await run_raw_mode(fallback_reason, provider_state["name"])
    finally:
        sem.release()


@router.post("/api/v1/ask", response_model=AskResponse)
async def ask_question_route(
    request: AskRequest,
    raw_request: Request,
    chain: Annotated[ProviderChain, Depends(get_provider_chain)],
) -> Any:
    """Answer questions about a diagram scene (Task 9.1).

    Uses vision/language provider completion with fallback to deterministic facts lookup.
    """
    sem = get_ask_semaphore()
    wait_seconds = parse_ask_queue_wait_seconds()
    try:
        await acquire_slot(sem, wait_seconds)
    except TimeoutError as exc:
        raise HTTPException(
            status_code=503,
            detail="Server is busy processing other ask requests.",
            headers={"Retry-After": "5"},
        ) from exc

    try:
        if await raw_request.is_disconnected():
            logger.info("Client disconnected before ask processing; aborting")
            return Response(status_code=499)
        # Run the model call as a task so a client that hangs up mid-call frees the slot and
        # the paid request is cancelled instead of running to completion.
        work = asyncio.create_task(answer_question(request, chain))
        try:
            while True:
                done, _ = await asyncio.wait({work}, timeout=ASK_DISCONNECT_POLL_SECONDS)
                if done:
                    return work.result()
                if await raw_request.is_disconnected():
                    logger.info("Client disconnected during ask processing; cancelling")
                    return Response(status_code=499)
        finally:
            if not work.done():
                work.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await work
    finally:
        sem.release()


class ValidateRequest(BaseModel):
    """Request model for POST /api/v1/validate (Teacher Correct mode)."""

    scene: dict[str, Any]

    @field_validator("scene")
    @classmethod
    def _validate_scene_size(cls, value: dict[str, Any]) -> dict[str, Any]:
        if isinstance(value, dict):
            _check_scene_size(value, max_polyline_points=MAX_VALIDATE_POLYLINE_POINTS)
        return value


class ValidateResponse(BaseModel):
    """Response model for POST /api/v1/validate."""

    ok: bool
    scene: DiagramScene | None = None
    errors: list[str] = Field(default_factory=list)


@router.post("/api/v1/validate", response_model=ValidateResponse)
async def validate_scene_route(
    request: ValidateRequest,
    validator: Annotated[
        Callable[[str | dict[str, Any]], ValidationResult], Depends(get_validator)
    ],
) -> ValidateResponse:
    """Validate and normalize a diagram scene for Teacher Correct mode (Req 9.3)."""
    val_result = validator(request.scene)
    if val_result.scene is not None:
        return ValidateResponse(ok=True, scene=val_result.scene, errors=[])
    return ValidateResponse(
        ok=False,
        scene=None,
        errors=val_result.errors if val_result.errors else ["Invalid scene"],
    )
