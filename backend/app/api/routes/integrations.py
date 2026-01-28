"""Integration-related API routes (Canvas sync trigger, etc.)."""

from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException, status

from app.api.dependencies import DbSession
from app.integrations.base import IntegrationAuthError, IntegrationRequestError
from app.integrations.canvas.adapter import CanvasAdapter
from app.integrations.canvas.schemas import CanvasCourseListItem, CanvasSyncRequest

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get(
    "/canvas/courses",
    response_model=list[CanvasCourseListItem],
    status_code=status.HTTP_200_OK,
)
async def list_canvas_courses() -> list[CanvasCourseListItem]:
    """List active Canvas courses for UI toggles (select which to sync / show)."""
    try:
        adapter = CanvasAdapter()
        await adapter.authenticate()
        return await adapter.list_courses()
    except IntegrationAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except IntegrationRequestError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.post(
    "/canvas/sync",
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_canvas_sync(
    db: DbSession,
    payload: CanvasSyncRequest | None = Body(default=None),
) -> dict[str, int]:
    """Trigger a manual Canvas sync and upsert tasks into Postgres.

    Optional body: { "course_ids": [1, 2, 3] }. If provided, only those courses
    are synced; otherwise all active courses are synced.
    """
    course_ids = payload.course_ids if payload else None
    try:
        adapter = CanvasAdapter()
        stats = await adapter.sync(db, course_ids=course_ids)
        return stats
    except IntegrationAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except IntegrationRequestError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

