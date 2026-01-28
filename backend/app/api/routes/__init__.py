"""API routers for TaskFlow."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes.integrations import router as integrations_router
from app.api.routes.tasks import router as tasks_router

api_router = APIRouter()

api_router.include_router(tasks_router)
api_router.include_router(integrations_router)
