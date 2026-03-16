import logging
import time
from datetime import datetime, timezone

import sentry_sdk
from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.db import get_supabase
from app.error_tracking import init_sentry
from app.routes.rooms import router as rooms_router
from app.routes.profile import router as profile_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

init_sentry()
app = FastAPI(title="VeryFastChat API", version="0.1.0")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return proper JSON so CORS headers are applied."""
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {type(exc).__name__}: {exc}")
    sentry_sdk.capture_exception(exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.on_event("startup")
async def startup_validation():
    """Validate required environment variables on startup."""
    if settings.skip_startup_validation or settings.api_env == "test":
        logger.info("Skipping external startup validation in test mode")
        return

    required_vars = {
        "SUPABASE_URL": settings.supabase_url,
        "SUPABASE_SERVICE_ROLE_KEY": settings.supabase_service_role_key,
        "SESSION_SECRET": settings.session_secret,
    }
    
    missing = [name for name, value in required_vars.items() if not value]
    
    if missing:
        error_msg = f"Missing required environment variables: {', '.join(missing)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)
    
    # Test Supabase connection
    try:
        sb = get_supabase()
        sb.table("rooms").select("id").limit(1).execute()
        logger.info("✓ Supabase connection successful")
    except Exception as e:
        logger.error(f"✗ Supabase connection failed: {e}")
        raise RuntimeError(f"Supabase connection failed: {e}")
    
    logger.info("✓ All environment variables validated")
    logger.info(f"✓ API starting in {settings.api_env} mode")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "%s %s %s %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)


@app.get("/health")
def healthcheck() -> dict[str, str | dict]:
    """
    Health check endpoint with dependency verification.
    Returns 200 if all systems are operational, 503 if degraded.
    """
    checks = {"api": "ok"}
    
    # Check Supabase connection
    try:
        sb = get_supabase()
        sb.table("rooms").select("id").limit(1).execute()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:100]}"
    
    # Check Redis connection (if configured)
    if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
        try:
            from app.rate_limit import _get_redis
            redis = _get_redis()
            if redis:
                redis.ping()
                checks["redis"] = "ok"
            else:
                checks["redis"] = "not_configured"
        except Exception as e:
            checks["redis"] = f"error: {str(e)[:100]}"
    else:
        checks["redis"] = "not_configured"
    
    # Determine overall status
    all_ok = all(v == "ok" or v == "not_configured" for v in checks.values())
    status = "ok" if all_ok else "degraded"
    
    return {"status": status, "checks": checks}


@app.get("/metrics")
def metrics(
    x_metrics_secret: str | None = Header(None, alias="X-Metrics-Secret"),
) -> dict[str, str | dict[str, int]]:
    if settings.metrics_secret and x_metrics_secret != settings.metrics_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    from app.metrics import get_counts
    return {"status": "ok", "counts": get_counts()}





app.include_router(rooms_router, prefix="/v1")
app.include_router(profile_router, prefix="/v1")
