"""
MedGuard ms2-agent-service — FastAPI + LangGraph
Responsible for: prescription extraction, brand-to-generic resolution,
lab report parsing, and visit-brief generation.
Strictly internal: no direct DB writes, no side-effects.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.extract import router as extract_router
from app.config import settings

app = FastAPI(
    title="MedGuard Agent Service",
    description="AI agent service for prescription extraction and analysis",
    version="1.0.0",
    docs_url="/docs" if settings.log_level == "debug" else None,
    redoc_url=None,
)

# ── Middleware ────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    # Lock down allowed origins to core API
    allow_origins=[settings.ms1_base_url, "http://localhost:4000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────
app.include_router(health_router, tags=["Health"])
app.include_router(extract_router, prefix="/api", tags=["Extraction"])


@app.on_event("startup")
async def startup_event():
    print(f"🚀 ms2-agent-service running on port {settings.ms2_port}")


@app.on_event("shutdown")
async def shutdown_event():
    print("🛑 ms2-agent-service shutting down...")
