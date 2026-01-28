"""Task CRUD API routes."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import DbSession
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services import task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get(
    "",
    response_model=list[TaskRead],
    status_code=status.HTTP_200_OK,
)
async def list_tasks_endpoint(
    db: DbSession,
    source: str | None = Query(default=None, description="Filter by source (e.g. 'canvas')"),
    status_value: str | None = Query(
        default=None,
        alias="status",
        description="Filter by task status (pending|completed|archived)",
    ),
    due_from: datetime | None = Query(default=None, description="Filter tasks due on/after this datetime"),
    due_to: datetime | None = Query(default=None, description="Filter tasks due on/before this datetime"),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[TaskRead]:
    """List tasks with optional filtering and pagination."""
    tasks = await task_service.list_tasks(
        db,
        source=source,
        status_value=status_value,
        due_from=due_from,
        due_to=due_to,
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
    task_id: Annotated[uuid.UUID, Depends()],
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
    task_id: Annotated[uuid.UUID, Depends()],
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
    task_id: Annotated[uuid.UUID, Depends()],
    db: DbSession,
) -> None:
    """Delete a task by ID."""
    await task_service.delete_task(db, task_id)

