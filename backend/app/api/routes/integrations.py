"""Integration-related API routes (Canvas sync trigger, etc.)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import DbSession
from app.integrations.base import IntegrationAuthError, IntegrationRequestError
from app.integrations.canvas.adapter import CanvasAdapter

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.post(
    "/canvas/sync",
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_canvas_sync(db: DbSession) -> dict[str, int]:
    """Trigger a manual Canvas sync and upsert tasks into Postgres."""
    try:
        adapter = CanvasAdapter()
        stats = await adapter.sync(db)
        return stats
    except IntegrationAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except IntegrationRequestError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

