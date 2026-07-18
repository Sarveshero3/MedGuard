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
from fastapi import Request
from fastapi.responses import JSONResponse
import os

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
    # Startup validation check for configured orchestrator, vision, and disambiguation models
    try:
        from app.services.client import get_client
        from langchain_core.messages import HumanMessage
        
        print(f"🔍 Startup check: pinging configured orchestrator model '{settings.orchestrator_model}' on Groq...", flush=True)
        orchestrator_client = get_client(settings.orchestrator_model)
        orchestrator_client.invoke([HumanMessage(content="ping")])
        print("✅ Startup check successful: orchestrator model is reachable.", flush=True)

        print(f"🔍 Startup check: pinging configured vision model '{settings.vision_model}' on Groq...", flush=True)
        vision_client = get_client(settings.vision_model)
        vision_client.invoke([HumanMessage(content="ping")])
        print("✅ Startup check successful: vision model is reachable.", flush=True)

        print(f"🔍 Startup check: pinging configured disambiguation model '{settings.disambiguation_model}' on Groq...", flush=True)
        disambig_client = get_client(settings.disambiguation_model)
        disambig_client.invoke([HumanMessage(content="ping")])
        print("✅ Startup check successful: disambiguation model is reachable.", flush=True)

    except Exception as e:
        print(f"❌ CRITICAL CONFIGURATION ERROR: Failed to reach or validate models on Groq: {str(e)}", flush=True)
        import sys
        sys.exit(1)


@app.on_event("shutdown")
async def shutdown_event():
    print("🛑 ms2-agent-service shutting down...")
