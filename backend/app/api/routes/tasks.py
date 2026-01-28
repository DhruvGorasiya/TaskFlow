"""Task CRUD API routes."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Body, Query, status
from pydantic import BaseModel

from app.api.dependencies import DbSession
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services import task_service
from app.services.priority_service import prioritize_task, should_recalculate_priority
from app.models.task import Task
from sqlalchemy import select, update

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get(
    "",
    response_model=list[TaskRead],
    status_code=status.HTTP_200_OK,
)
async def list_tasks_endpoint(
    db: DbSession,
    source: str | None = Query(
        default=None, description="Filter by source (e.g. 'canvas')"
    ),
    status_value: str | None = Query(
        default=None,
        alias="status",
        description="Filter by task status (pending|completed|archived)",
    ),
    due_from: datetime | None = Query(
        default=None, description="Filter tasks due on/after this datetime"
    ),
    due_to: datetime | None = Query(
        default=None, description="Filter tasks due on/before this datetime"
    ),
    course_ids: list[int] = Query(
        default=[],
        description="Filter Canvas tasks by course IDs (e.g. ?course_ids=1&course_ids=2)",
    ),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[TaskRead]:
    """List tasks with optional filtering and pagination."""
    cids = course_ids if course_ids else None
    tasks = await task_service.list_tasks(
        db,
        source=source,
        status_value=status_value,
        due_from=due_from,
        due_to=due_to,
        course_ids=cids,
        limit=limit,
        offset=offset,
    )
    return [TaskRead.model_validate(t) for t in tasks]


@router.get(
    "/{task_id}",
    response_model=TaskRead,
    status_code=status.HTTP_200_OK,
)
async def get_task_endpoint(
    task_id: uuid.UUID,
    db: DbSession,
) -> TaskRead:
    """Get a single task by ID."""
    task = await task_service.get_task(db, task_id)
    return TaskRead.model_validate(task)


@router.post(
    "",
    response_model=TaskRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_endpoint(
    payload: TaskCreate,
    db: DbSession,
) -> TaskRead:
    """Create a new task."""
    task = await task_service.create_task(db, payload)
    return TaskRead.model_validate(task)


@router.patch(
    "/{task_id}",
    response_model=TaskRead,
    status_code=status.HTTP_200_OK,
)
async def update_task_endpoint(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: DbSession,
) -> TaskRead:
    """Update an existing task."""
    task = await task_service.update_task(db, task_id, payload)
    return TaskRead.model_validate(task)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_task_endpoint(
    task_id: uuid.UUID,
    db: DbSession,
) -> None:
    """Delete a task by ID."""
    await task_service.delete_task(db, task_id)


class PrioritizeRequest(BaseModel):
    """Optional body for POST /api/tasks/prioritize."""

    task_ids: list[str] | None = None
    course_ids: list[int] | None = None


class PrioritizeResponse(BaseModel):
    """Response for task prioritization."""

    prioritized: int
    skipped: int
    ai_used: int


@router.post(
    "/prioritize",
    response_model=PrioritizeResponse,
    status_code=status.HTTP_200_OK,
)
async def prioritize_tasks_endpoint(
    db: DbSession,
    payload: PrioritizeRequest | None = Body(default=None),
) -> PrioritizeResponse:
    """Prioritize tasks using AI-powered analysis.

    Optional body:
    - `{ "task_ids": ["uuid1", "uuid2", ...] }` - prioritize specific tasks
    - `{ "course_ids": [1, 2, 3] }` - prioritize Canvas tasks from those courses
    - No body - prioritize all pending tasks

    Returns stats: { prioritized, skipped, ai_used }
    """
    # Build query based on request
    stmt = select(Task).where(Task.status == "pending")

    if payload:
        if payload.task_ids:
            try:
                task_uuids = [uuid.UUID(tid) for tid in payload.task_ids]
                stmt = stmt.where(Task.id.in_(task_uuids))
            except ValueError:
                from fastapi import HTTPException

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid task_id in task_ids",
                )
        elif payload.course_ids:
            # Filter Canvas tasks by course_ids (same logic as task_service)
            from sqlalchemy import cast
            from sqlalchemy.types import Integer

            def _course_id_expr():
                raw = Task.source_metadata["course"]["id"]
                return cast(raw.astext, Integer)

            stmt = stmt.where(Task.source == "canvas").where(
                _course_id_expr().in_(payload.course_ids)
            )

    # Execute query
    result = await db.execute(stmt)
    tasks = list(result.scalars().all())

    if not tasks:
        return PrioritizeResponse(prioritized=0, skipped=0, ai_used=0)

    # Prioritize each task
    prioritized = 0
    skipped = 0
    ai_used = 0
    updates: list[tuple[uuid.UUID, str]] = []

    for task in tasks:
        # Check if we should recalculate
        if not should_recalculate_priority(task, task.due_date):
            skipped += 1
            continue

        # Calculate priority
        priority = await prioritize_task(task, use_ai=True)
        if priority is None:
            skipped += 1
            continue

        # Track AI usage
        from app.config import settings
        from app.services.priority_service import calculate_priority_baseline

        if settings.openai_api_key:
            baseline = calculate_priority_baseline(task.due_date, task.status)
            if baseline and priority != baseline:
                ai_used += 1

        updates.append((task.id, priority))
        prioritized += 1

    # Batch update priorities
    if updates:
        for task_id, priority_value in updates:
            stmt_update = (
                update(Task).where(Task.id == task_id).values(priority=priority_value)
            )
            await db.execute(stmt_update)
        await db.commit()

    return PrioritizeResponse(
        prioritized=prioritized, skipped=skipped, ai_used=ai_used
    )
