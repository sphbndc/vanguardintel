"""FastAPI entrypoint and resilient TTL-cached threat API."""

from __future__ import annotations

import asyncio
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.services.fetcher import fetch_all_sources
from app.services.storage import ThreatStorage

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


class ThreatCache:
    """Small single-process TTL cache with stampede protection and stale fallback."""

    def __init__(self, ttl_seconds: int = 900) -> None:
        self.ttl_seconds = ttl_seconds
        self._payload: dict[str, Any] | None = None
        self._stored_at = 0.0
        self._lock = asyncio.Lock()

    def _fresh(self) -> bool:
        return self._payload is not None and (time.monotonic() - self._stored_at) < self.ttl_seconds

    async def get(self) -> dict[str, Any]:
        if self._fresh():
            return self._with_cache_state(self._payload, "hit")

        async with self._lock:
            if self._fresh():
                return self._with_cache_state(self._payload, "hit")

            previous = self._payload
            try:
                threats, sources = await fetch_all_sources()
                stored = await storage.persist_and_fetch(threats)
                source_degraded = any(source["status"] != "operational" for source in sources)
                status = "degraded" if source_degraded or stored.status != "operational" else "operational"
                payload = self._build_payload(
                    stored.threats,
                    sources,
                    status,
                    storage_info={**storage.metadata, "records_available": stored.total, "records_returned": len(stored.threats)},
                    message=stored.message,
                    severity_counts=stored.counts,
                )
                self._payload = payload
                self._stored_at = time.monotonic()
                return self._with_cache_state(payload, "miss")
            except Exception as exc:  # final boundary: the API must remain available
                if previous:
                    stale = self._with_cache_state(previous, "stale")
                    stale["status"] = "degraded"
                    stale["message"] = f"Refresh failed; serving the last known snapshot ({type(exc).__name__})."
                    return stale
                return self._with_cache_state(
                    self._build_payload([], [], "degraded", "All intelligence sources are temporarily unavailable.", storage_info=storage.metadata),
                    "empty",
                )

    def _build_payload(
        self,
        threats: list[dict[str, Any]],
        sources: list[dict[str, Any]],
        status: str,
        message: str | None = None,
        storage_info: dict[str, Any] | None = None,
        severity_counts: dict[str, int] | None = None,
    ) -> dict[str, Any]:
        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for threat in threats:
            severity = threat.get("severity", "medium")
            counts[severity] = counts.get(severity, 0) + 1
        if severity_counts:
            counts.update(severity_counts)
        return {
            "status": status,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "message": message,
            "stats": {"total": int((storage_info or {}).get("records_available", len(threats))), "returned": len(threats), **counts, "sources_operational": sum(s["status"] == "operational" for s in sources)},
            "sources": sources,
            "storage": storage_info or {},
            "threats": threats,
        }

    def _with_cache_state(self, payload: dict[str, Any] | None, state: str) -> dict[str, Any]:
        result = dict(payload or {})
        result["cache"] = {"state": state, "ttl_seconds": self.ttl_seconds}
        return result


def _safe_env_int(name: str, default: int) -> int:
    """Return a positive integer even when a hosting dashboard value is blank/invalid."""
    raw_value = os.getenv(name, "").strip()
    try:
        return max(1, int(raw_value or str(default)))
    except ValueError:
        return default


storage = ThreatStorage(
    retention_days=_safe_env_int("THREAT_RETENTION_DAYS", 90),
    max_api_records=_safe_env_int("MAX_API_RECORDS", 250),
)
cache = ThreatCache()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Initialize local history without blocking startup on third-party services.
    await storage.initialize()
    yield


app = FastAPI(
    title="Vanguard Intel API",
    description="Actionable OSINT correlation for vulnerability and threat prioritization.",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

# Same-origin Render hosting needs no CORS. When the optional Vercel frontend is
# used, explicitly list its origin(s) rather than allowing arbitrary websites.
allowed_frontend_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]
if allowed_frontend_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_frontend_origins,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["Accept"],
        max_age=600,
    )

# Vite emits immutable bundles under /assets and copies public source icons to /sources.
# check_dir=False keeps API startup available before the first frontend production build.
app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets"), check_dir=False), name="frontend-assets")
app.mount("/sources", StaticFiles(directory=str(FRONTEND_DIST / "sources"), check_dir=False), name="frontend-sources")


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
        "font-src https://fonts.gstatic.com; img-src 'self' data: https://fastapi.tiangolo.com https://otx.alienvault.com https://*.alienvault.com; connect-src 'self'"
    )
    return response


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def dashboard(request: Request):
    frontend_index = FRONTEND_DIST / "index.html"
    if frontend_index.is_file():
        return FileResponse(frontend_index)
    return templates.TemplateResponse(request=request, name="index.html", context={"app_version": app.version})


@app.get("/api/v1/threats", response_class=JSONResponse)
async def get_threats() -> dict[str, Any]:
    return await cache.get()


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}
