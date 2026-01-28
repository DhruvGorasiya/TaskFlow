"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI

from app.api.routes import api_router
from app.config import settings
from app.jobs.sync_scheduler import shutdown_scheduler, start_scheduler


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="TaskFlow API",
        version="0.1.0",
    )

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        """Health check endpoint."""

        return {"status": "ok"}

    app.include_router(api_router, prefix="/api")

    if settings.enable_scheduler:

        @app.on_event("startup")
        async def _start_scheduler() -> None:  # type: ignore[unused-variable]
            """Start background scheduler on app startup."""

            start_scheduler()

        @app.on_event("shutdown")
        async def _shutdown_scheduler() -> None:  # type: ignore[unused-variable]
            """Stop background scheduler on app shutdown."""

            shutdown_scheduler()

    return app


app = create_app()
