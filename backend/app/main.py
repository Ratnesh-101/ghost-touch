"""FastAPI application and routes for Ghost Touch.

Scaffold scope (Task 1): wire the app, CORS, and the `/api/v1/health` route so
the backend starts and reports readiness. The scene (`POST /api/v1/scene`) and
ask (`POST /api/v1/ask`) routes are added in Tasks 8 and 9.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Ghost Touch API",
    version="0.1.0",
    description="Turns a photo of a STEM diagram into a tactile DiagramScene.",
)

# CORS: allow the Vercel frontend origin(s). Configurable via env.
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
