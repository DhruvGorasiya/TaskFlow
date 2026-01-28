"""Sync orchestration and upsert logic."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.schemas.task import TaskCreate


async def upsert_tasks(session: AsyncSession, tasks: list[TaskCreate]) -> dict[str, int]:
    """Upsert tasks by `(source, external_id)` and return sync stats.

    Notes:
    - Provider-owned fields are overwritten on sync: title, description, due_date,
      course_or_category, source_metadata.
    - User-owned fields are preserved on sync: status, priority.
    """
    if not tasks:
        return {"created": 0, "updated": 0, "total": 0}

    now = datetime.now(tz=timezone.utc)

    rows = [
        {
            "external_id": t.external_id,
            "source": t.source,
            "source_metadata": t.source_metadata,
            "title": t.title,
            "description": t.description,
            "due_date": t.due_date,
            "course_or_category": t.course_or_category,
            "synced_at": now,
            # For newly created rows only:
            "status": t.status,
            "priority": t.priority,
        }
        for t in tasks
    ]

    stmt = insert(Task).values(rows)

    # Only overwrite provider-owned fields on conflict.
    update_cols = {
        "source_metadata": stmt.excluded.source_metadata,
        "title": stmt.excluded.title,
        "description": stmt.excluded.description,
        "due_date": stmt.excluded.due_date,
        "course_or_category": stmt.excluded.course_or_category,
        "synced_at": stmt.excluded.synced_at,
    }

    stmt = stmt.on_conflict_do_update(
        constraint="uq_tasks_source_external_id",
        set_=update_cols,
    ).returning(Task.id)

    result = await session.execute(stmt)
    returned_ids = list(result.scalars().all())
    await session.commit()

    # We don't get per-row info on create vs update from RETURNING alone.
    # For MVP, report total affected and leave created/updated as best-effort.
    # (We can refine later by checking existing keys before upsert.)
    return {
        "created": 0,
        "updated": len(returned_ids),
        "total": len(tasks),
    }

