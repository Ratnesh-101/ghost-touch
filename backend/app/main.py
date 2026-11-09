"""FastAPI application and routes for Ghost Touch (Task 8, F2, Lane T11b).

Wires CORS, liveness probe (/api/v1/health), the scene pipeline
(POST /api/v1/scene) with Gemini primary, OpenAI and Nebius fallbacks, and OpenCV Raw Mode,
the question answering endpoint (POST /api/v1/ask),
and diagram scene validation (POST /api/v1/validate).
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import os
import threading
import time
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any

import cv2
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
from app.limits import (
    MULTIPART_OVERHEAD,
    RequestGuardMiddleware,
    default_rate_limits,
    get_ask_in_flight_limiter,
    get_scene_in_flight_limiter,
    request_client_key,
)
from app.middleware import SecurityHeadersMiddleware
from app.paid_budget import is_budget_exhausted
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
    if is_budget_exhausted():
        logger.info("Background improve pass skipped: daily paid budget is exhausted")
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
        existing_cached = scene_cache.get(cache_key)
        if existing_cached is not None:
            existing_payload, _ = existing_cached
            if existing_payload.get("scene", {}).get("kind") == "function_graph":
                logger.info(
                    "Background improve pass skipped: preserving equation-route function graph"
                )
                return

        logger.info("Starting background improve pass using provider '%s'", improve_provider.name)
        raw_text = await improve_provider.extract(
            image_bytes,
            content_type,
            build_prompt(),
            timeout=timeout,
        )
        val_result = validator(raw_text)
        if val_result.scene is not None:
            if val_result.scene.kind == "function_graph":
                logger.info(
                    "Background improve pass generated function_graph trace; "
                    "skipping cache overwrite"
                )
                return
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


def _call_raw_scene(
    builder: Callable[..., DiagramScene],
    image: bytes,
    cancel_check: threading.Event | None = None,
) -> DiagramScene:
    """Invoke raw scene builder, passing cancel_check only if the callable accepts it."""
    try:
        sig = inspect.signature(builder)
        params = sig.parameters
        if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()):
            return builder(image, cancel_check=cancel_check)
        if "cancel_check" in params:
            return builder(image, cancel_check=cancel_check)
        if any(p.kind == inspect.Parameter.VAR_POSITIONAL for p in params.values()):
            return builder(image, cancel_check)
        pos_params = [
            p
            for p in params.values()
            if p.kind
            in (
                inspect.Parameter.POSITIONAL_ONLY,
                inspect.Parameter.POSITIONAL_OR_KEYWORD,
            )
        ]
        if len(pos_params) >= 2:
            return builder(image, cancel_check)
        return builder(image)
    except (ValueError, TypeError):
        try:
            return builder(image, cancel_check=cancel_check)
        except TypeError:
            return builder(image)


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
      2. Verify magic bytes and pixel resolution cap (<=12 MP) without blocking.
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
            detail="Unsupported image format. Please upload a JPEG, PNG, or WebP image.",
        )

    # Step 2: Content-Length check before buffering (Finding 8, R3-5)
    cl_header = request.headers.get("content-length")
    if cl_header:
        if not (cl_header.isascii() and cl_header.isdigit()) or len(cl_header) > 18:
            raise HTTPException(
                status_code=400,
                detail="Invalid Content-Length header.",
            )
        try:
            if int(cl_header) > MAX_UPLOAD_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail="Image file exceeds 10 MB limit. Please upload a smaller image.",
                )
        except ValueError as err:
            raise HTTPException(
                status_code=400,
                detail="Invalid Content-Length header.",
            ) from err

    # C4, R3-1, M4-01: Enforce per-client in-flight cap before waiting for global slot
    client_key_val = request_client_key(request)
    scene_in_flight = get_scene_in_flight_limiter()
    if not scene_in_flight.acquire(client_key_val):
        raise HTTPException(
            status_code=429,
            detail=(
                "Too many concurrent diagram requests for this client. "
                "Please wait a moment and retry."
            ),
            headers={"Retry-After": "1"},
        )

    slot_acquired = False
    sem = get_scene_semaphore()
    wait_seconds = parse_scene_queue_wait_seconds()
    try:
        try:
            await acquire_slot(sem, wait_seconds)
            slot_acquired = True
        except TimeoutError as exc:
            raise HTTPException(
                status_code=503,
                detail="Server is busy processing other diagram requests. reason: queue_timeout",
                headers={"Retry-After": "5"},
            ) from exc

        # Read image in chunks into a single bytearray to prevent multiple copies (A5)
        buf = bytearray()
        chunk_size = 64 * 1024
        while True:
            chunk = await image.read(chunk_size)
            if not chunk:
                break
            if len(buf) + len(chunk) > MAX_UPLOAD_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail="Image file exceeds 10 MB limit. Please upload a smaller image.",
                )
            buf.extend(chunk)

        if len(buf) == 0:
            raise HTTPException(
                status_code=422,
                detail="Empty image upload. Please provide a valid diagram image.",
            )

        image_bytes = bytes(buf)
        del buf

        # Step 3: Validate magic bytes, header integrity, and resolution cap (Finding 3)
        validate_image_bytes(image_bytes, content_type)

        # A repeated image (a demo, a retry) is served from the cache of validated AI scenes, so it
        # costs no provider quota. Failures and Raw Mode results are never cached.
        cache_key = image_key(image_bytes, build_prompt())
        cached = scene_cache.get(cache_key)
        if cached is not None:
            cached_payload, cached_provider = cached
            response.headers["X-Vision-Provider"] = "ai"
            response.headers["X-Scene-Cache"] = "HIT"
            logger.info("scene served from cache: provider=%s", cached_provider)
            return cached_payload

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
            remaining = max(0.05, total_deadline - elapsed)
            cancel_event = threading.Event()
            raw_task = asyncio.create_task(
                asyncio.to_thread(
                    _call_raw_scene,
                    build_raw_scene,
                    image_bytes,
                    cancel_event,
                )
            )
            try:
                # Finding 4 & A3: execute build_raw_scene in worker thread with remaining deadline
                raw_scene = await asyncio.wait_for(
                    asyncio.shield(raw_task),
                    timeout=remaining,
                )
            except TimeoutError as exc:
                cancel_event.set()
                try:
                    await asyncio.wait_for(asyncio.shield(raw_task), timeout=0.5)
                except Exception:
                    pass
                raise HTTPException(
                    status_code=504,
                    detail="Diagram processing timed out. Please try again with a simpler image.",
                ) from exc
            except (RawModeError, cv2.error) as exc:
                raise HTTPException(
                    status_code=422,
                    detail="Could not process image. Please upload a clear diagram photo.",
                ) from exc
            except (Exception, asyncio.CancelledError):
                cancel_event.set()
                try:
                    await asyncio.wait_for(asyncio.shield(raw_task), timeout=0.5)
                except Exception:
                    pass
                raise
            finally:
                cancel_event.set()

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

            # A8: X-Vision-Provider is 'raw' or 'ai' only (never provider names or 'none')
            response.headers["X-Vision-Provider"] = "raw"
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

        # Step 4: Zero providers configured or budget spent -> Raw Mode immediately (C1)
        if not chain.providers:
            return await run_raw_mode("no_provider", "none")
        if is_budget_exhausted():
            logger.info("Daily paid budget exhausted; skipping AI and using Raw Mode immediately")
            return await run_raw_mode("budget_exhausted", "none")

        provider_state = {"name": "none"}
        if total_deadline > RAW_MODE_RESERVE_SECONDS:
            ai_budget = total_deadline - RAW_MODE_RESERVE_SECONDS
        else:
            ai_budget = max(0.05, total_deadline * 0.7)
        ai_deadline = start_time + ai_budget

        def ai_payload(scene: Any, provider: str, note: str = "") -> dict[str, Any]:
            # A8: Return 'ai' to client; provider name kept in server logs only
            response.headers["X-Vision-Provider"] = "ai"
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
        remaining_ai = ai_deadline - time.monotonic()
        if remaining_ai <= 0:
            fallback_reason = "timeout"
        else:
            work = asyncio.create_task(attempt_ai())
            handler_cancelled = False
            try:
                try:
                    while True:
                        now = time.monotonic()
                        remaining = ai_deadline - now
                        if remaining <= 0:
                            work.cancel()
                            fallback_reason = "timeout"
                            break
                        poll_timeout = min(ASK_DISCONNECT_POLL_SECONDS, remaining)
                        done, _ = await asyncio.wait({work}, timeout=poll_timeout)
                        if done:
                            if work.cancelled():
                                fallback_reason = "timeout"
                            else:
                                payload, fallback_reason = work.result()
                            break
                        if await request.is_disconnected():
                            logger.info("Client disconnected during scene vision call; cancelling")
                            work.cancel()
                            return Response(status_code=499)
                except TimeoutError:
                    fallback_reason = "timeout"
                except VisionError as exc:
                    logger.warning("All vision providers failed: %s", exc)
                    reason_lower = exc.reason.lower()
                    if time.monotonic() >= ai_deadline or "deadline reached" in reason_lower:
                        fallback_reason = "timeout"
                    elif "budget exhausted" in reason_lower:
                        fallback_reason = "budget_exhausted"
                    else:
                        fallback_reason = "provider_error"
                except HTTPException:
                    raise
                except asyncio.CancelledError:
                    handler_cancelled = True
                    raise
                except Exception as exc:
                    logger.error("Unexpected error in scene pipeline: %s", exc)
                    fallback_reason = "error"
            finally:
                if not work.done():
                    work.cancel()
                    try:
                        await work
                    except asyncio.CancelledError:
                        pass
                if handler_cancelled or (
                    hasattr(asyncio.current_task(), "cancelling")
                    and asyncio.current_task().cancelling() > 0
                ):
                    raise asyncio.CancelledError()

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
        if slot_acquired:
            sem.release()
        scene_in_flight.release(client_key_val)


@router.post("/api/v1/ask", response_model=AskResponse)
async def ask_question_route(
    request: AskRequest,
    raw_request: Request,
    chain: Annotated[ProviderChain, Depends(get_provider_chain)],
) -> Any:
    """Answer questions about a diagram scene (Task 9.1).

    Uses vision/language provider completion with fallback to deterministic facts lookup.
    """
    # C4, R3-1, M4-01: Per-client in-flight cap (429 over cap)
    client_key_val = request_client_key(raw_request)
    ask_limiter = get_ask_in_flight_limiter()
    if not ask_limiter.acquire(client_key_val):
        raise HTTPException(
            status_code=429,
            detail=(
                "Too many concurrent ask requests for this client. Please wait a moment and retry."
            ),
            headers={"Retry-After": "1"},
        )

    slot_acquired = False
    sem = get_ask_semaphore()
    wait_seconds = parse_ask_queue_wait_seconds()
    try:
        try:
            await acquire_slot(sem, wait_seconds)
            slot_acquired = True
        except TimeoutError as exc:
            raise HTTPException(
                status_code=503,
                detail="Server is busy processing other ask requests.",
                headers={"Retry-After": "5"},
            ) from exc

        if await raw_request.is_disconnected():
            logger.info("Client disconnected before ask processing; aborting")
            return Response(status_code=499)
        # Run the model call as a task so a client that hangs up mid-call frees the slot and
        # the paid request is cancelled instead of running to completion.
        work = asyncio.create_task(answer_question(request, chain))
        handler_cancelled = False
        try:
            while True:
                done, _ = await asyncio.wait({work}, timeout=ASK_DISCONNECT_POLL_SECONDS)
                if done:
                    return work.result()
                if await raw_request.is_disconnected():
                    logger.info("Client disconnected during ask processing; cancelling")
                    return Response(status_code=499)
        except asyncio.CancelledError:
            handler_cancelled = True
            raise
        finally:
            if not work.done():
                work.cancel()
                try:
                    await work
                except asyncio.CancelledError:
                    pass
            if handler_cancelled or (
                hasattr(asyncio.current_task(), "cancelling")
                and asyncio.current_task().cancelling() > 0
            ):
                raise asyncio.CancelledError()
    finally:
        if slot_acquired:
            sem.release()
        ask_limiter.release(client_key_val)


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
    try:
        val_result = validator(request.scene)
    except Exception:
        return ValidateResponse(ok=False, scene=None, errors=["Validation failed"])
    if val_result.scene is not None:
        return ValidateResponse(ok=True, scene=val_result.scene, errors=[])
    return ValidateResponse(
        ok=False,
        scene=None,
        errors=val_result.errors if val_result.errors else ["Invalid scene"],
    )
