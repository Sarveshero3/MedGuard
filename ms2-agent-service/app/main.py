"""
MedGuard ms2-agent-service — FastAPI + LangGraph
Responsible for: prescription extraction, brand-to-generic resolution,
lab report parsing, and visit-brief generation.
Strictly internal: no direct DB writes, no side-effects.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os

from app.api.health import router as health_router
from app.api.extract import router as extract_router
from app.config import settings
from app.services.client import get_client
from langchain_core.messages import HumanMessage


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"🚀 ms2-agent-service running on port {settings.ms2_port}", flush=True)
    if settings.groq_api_key:
        try:
            print(f"🔍 Startup check: verifying orchestrator model '{settings.orchestrator_model}'...", flush=True)
            orchestrator_client = get_client(settings.orchestrator_model)
            orchestrator_client.invoke([HumanMessage(content="ping")])
            print("✅ Startup check successful: orchestrator model is reachable.", flush=True)
        except Exception as e:
            print(f"⚠️ Startup warning: Could not ping model: {e}", flush=True)
    else:
        print("ℹ️ GROQ_API_KEY not configured; model ping skipped.", flush=True)
    yield
    print("🛑 ms2-agent-service shutting down...", flush=True)


app = FastAPI(
    title="MedGuard Agent Service",
    description="AI agent service for prescription extraction and analysis",
    version="1.0.0",
    docs_url="/docs" if settings.log_level == "debug" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────


@app.middleware("http")
async def verify_internal_auth(request: Request, call_next):
    if request.url.path.startswith("/api/extract"):
        auth_header = request.headers.get("x-internal-auth")
        secret = os.getenv("MS2_INTERNAL_SECRET", "dev-secret")
        if auth_header != secret:
            return JSONResponse(
                status_code=401,
                content={"success": False, "error": "Unauthorized internal request."}
            )
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.ms1_base_url, "http://localhost:4000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────
app.include_router(health_router, tags=["Health"])
app.include_router(extract_router, prefix="/api", tags=["Extraction"])
