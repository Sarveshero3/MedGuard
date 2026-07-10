"""
Health check endpoint for ms2-agent-service.
"""

from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Return service health status."""
    return {
        "success": True,
        "data": {
            "service": "ms2-agent-service",
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }
