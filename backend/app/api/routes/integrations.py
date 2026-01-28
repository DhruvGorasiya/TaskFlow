"""Integration-related API routes (Canvas sync trigger, Notion push, etc.)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Body, HTTPException, status

from app.api.dependencies import DbSession
from app.integrations.base import IntegrationAuthError, IntegrationRequestError
from app.integrations.canvas.adapter import CanvasAdapter
from app.integrations.canvas.schemas import CanvasCourseListItem, CanvasSyncRequest
from app.integrations.notion.adapter import NotionAdapter
from app.integrations.notion.schemas import NotionSyncRequest, NotionSyncResponse

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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc
    except IntegrationRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc


@router.post(
    "/canvas/sync",
    status_code=status.HTTP_200_OK,
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc
    except IntegrationRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc


@router.post(
    "/notion/sync",
    response_model=NotionSyncResponse,
    status_code=status.HTTP_200_OK,
)
async def trigger_notion_sync(
    db: DbSession,
    payload: NotionSyncRequest | None = Body(default=None),
) -> NotionSyncResponse:
    """Push TaskFlow tasks to the configured Notion database.

    Optional body: { "task_ids": ["uuid1", "uuid2", ...] }. If provided, only
    those tasks are pushed; otherwise all tasks (up to 500) are synced.
    Creates new Notion pages for tasks without notion_page_id; updates existing
    pages otherwise. Requires NOTION_API_TOKEN and NOTION_DATABASE_ID.
    """
    task_ids: list[uuid.UUID] | None = None
    if payload and payload.task_ids:
        try:
            task_ids = [uuid.UUID(tid) for tid in payload.task_ids]
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid task_id in task_ids",
            ) from exc
    course_ids = payload.course_ids if payload else None

    try:
        adapter = NotionAdapter()
        await adapter.authenticate()
        stats = await adapter.push(db, task_ids=task_ids, course_ids=course_ids)
        return NotionSyncResponse(**stats)
    except IntegrationAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc
    except IntegrationRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc
