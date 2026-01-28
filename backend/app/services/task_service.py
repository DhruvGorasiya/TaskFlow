"""Task business logic.

This layer keeps SQLAlchemy details out of API routes.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import Select, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate


def _apply_task_filters(
    stmt: Select[tuple[Task]],
    *,
    source: str | None,
    status_value: str | None,
    due_from: datetime | None,
    due_to: datetime | None,
) -> Select[tuple[Task]]:
    if source:
        stmt = stmt.where(Task.source == source)
    if status_value:
        stmt = stmt.where(Task.status == status_value)
    if due_from:
        stmt = stmt.where(Task.due_date.is_not(None)).where(Task.due_date >= due_from)
    if due_to:
        stmt = stmt.where(Task.due_date.is_not(None)).where(Task.due_date <= due_to)
    return stmt


async def list_tasks(
    session: AsyncSession,
    *,
    source: str | None = None,
    status_value: str | None = None,
    due_from: datetime | None = None,
    due_to: datetime | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[Task]:
    """List tasks with optional filters."""
    stmt = select(Task).order_by(Task.due_date.asc().nullslast(), Task.created_at.desc())
    stmt = _apply_task_filters(stmt, source=source, status_value=status_value, due_from=due_from, due_to=due_to)
    stmt = stmt.limit(limit).offset(offset)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_task(session: AsyncSession, task_id: uuid.UUID) -> Task:
    """Fetch a single task by ID or raise 404."""
    task = await session.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


async def create_task(session: AsyncSession, payload: TaskCreate) -> Task:
    """Create a new task."""
    task = Task(
        external_id=payload.external_id,
        source=payload.source,
        source_metadata=payload.source_metadata,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        priority=payload.priority,
        status=payload.status,
        course_or_category=payload.course_or_category,
    )
    session.add(task)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    await session.refresh(task)
    return task


async def update_task(session: AsyncSession, task_id: uuid.UUID, payload: TaskUpdate) -> Task:
    """Patch update for a task."""
    task = await get_task(session, task_id)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)

    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    await session.refresh(task)
    return task


async def delete_task(session: AsyncSession, task_id: uuid.UUID) -> None:
    """Delete a task by ID."""
    stmt = delete(Task).where(Task.id == task_id)
    result = await session.execute(stmt)
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    await session.commit()

